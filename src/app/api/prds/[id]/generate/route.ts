import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerId } from "@/lib/auth/owner";
import {
  getPrdById,
  acquireExecutionLock,
  releaseExecutionLock,
} from "@/lib/db/prdRepository";
import { runGeneration } from "@/lib/agent/runner";
import { encodeSseEvent, SSE_HEADERS } from "@/lib/sse/encode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

const GenerateRequestSchema = z.object({
  sectionIds: z.array(z.string().min(1)).optional(),
});

/**
 * POST /api/prds/[id]/generate
 * Initiates or resumes multi-stage agent runtime generation and streams SSE events:
 * - run.started
 * - plan.ready
 * - section.started
 * - section.completed
 * - section.failed
 * - run.completed / run.failed
 * - heartbeat (every 15s)
 *
 * Concurrent runs on the same document are rejected synchronously with HTTP 409 RUN_IN_PROGRESS.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  let runId = "";
  let lockAcquired = false;
  let currentDocStatus = "generating";

  try {
    const ownerId = getOwnerId();
    const prd = await getPrdById(params.id, ownerId);

    if (!prd) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Dokumen PRD tidak ditemukan" } },
        { status: 404 }
      );
    }

    currentDocStatus = prd.status;

    // Optional body parsing
    let sectionIds: string[] | undefined;
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const rawBody = await req.json().catch(() => null);
      if (rawBody) {
        const parsed = GenerateRequestSchema.safeParse(rawBody);
        if (!parsed.success) {
          return NextResponse.json(
            {
              error: {
                code: "VALIDATION_ERROR",
                message: parsed.error.issues.map((i) => i.message).join(", "),
              },
            },
            { status: 400 }
          );
        }
        sectionIds = parsed.data.sectionIds;
      }
    }

    // Guard: Prevent concurrent runs atomically (synchronous 409 RUN_IN_PROGRESS)
    runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const lockResult = await acquireExecutionLock(params.id, ownerId, runId);
    if (!lockResult.acquired) {
      if (lockResult.reason === "NOT_FOUND") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Dokumen PRD tidak ditemukan" } },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          error: {
            code: "RUN_IN_PROGRESS",
            message: "Proses generate sedang berjalan untuk dokumen ini",
          },
        },
        { status: 409 }
      );
    }

    lockAcquired = true;
    const lockedDoc = lockResult.doc || prd;

    // Set up Server-Sent Events stream
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const textEncoder = new TextEncoder();

    let isClosed = false;

    const emit = (event: string, data: unknown) => {
      if (isClosed) return;
      try {
        const encoded = encodeSseEvent(event, data);
        writer.write(textEncoder.encode(encoded)).catch(() => {
          isClosed = true;
        });
      } catch {
        isClosed = true;
      }
    };

    // Execute agent runtime pipeline asynchronously in the background
    (async () => {
      try {
        await runGeneration(lockedDoc, {
          ownerId,
          sectionIds,
          emit,
          signal: req.signal,
          runId,
          preAcquiredLock: true,
        });
      } catch (err) {
        console.error(`Agent runtime failed for PRD ${params.id}:`, err);
      } finally {
        if (!isClosed) {
          isClosed = true;
          try {
            await writer.close();
          } catch {
            // Ignore writer close error
          }
        }
      }
    })();

    return new Response(responseStream.readable, {
      headers: SSE_HEADERS,
    });
  } catch (err) {
    if (lockAcquired && runId) {
      try {
        await releaseExecutionLock(
          params.id,
          runId,
          (currentDocStatus as any) || "failed"
        );
      } catch {
        // Ignore lock release failure on error
      }
    }
    console.error(`POST /api/prds/${params.id}/generate failed:`, err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to initiate generation" } },
      { status: 500 }
    );
  }
}
