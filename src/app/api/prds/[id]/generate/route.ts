import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth/owner";
import {
  getPrdById,
  acquireExecutionLock,
  releaseExecutionLock,
} from "@/lib/db/prdRepository";
import { runGeneration } from "@/lib/agent/runner";
import { encodeSseEvent, SSE_HEADERS } from "@/lib/sse/encode";
import {
  registerJob,
  isJobActive,
  addJobListener,
  emitToJob,
  finishJob,
} from "@/lib/agent/jobRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

const GenerateRequestSchema = z.object({
  sectionIds: z.array(z.string().min(1)).optional(),
});

/**
 * POST /api/prds/[id]/generate
 * Initiates or attaches to a headless multi-stage agent runtime generation and streams SSE events:
 * - run.started
 * - plan.ready
 * - section.started
 * - section.completed
 * - section.failed
 * - run.completed / run.failed
 * - heartbeat (every 15s)
 *
 * Background generation is decoupled from the client's HTTP request lifecycle:
 * If the user navigates away or closes the tab, generation continues smoothly on the server.
 * Multiple PRDs can be generated simultaneously in parallel.
 */
export async function POST(req: NextRequest, context: RouteParams) {
  const params = await Promise.resolve(context.params);
  let runId = "";
  let lockAcquired = false;
  let currentDocStatus = "generating";

  try {
    const explicitId = req.headers.get("x-owner-id") || undefined;
    const authCtx = await getAuthContext(explicitId);
    const ownerId = authCtx.ownerId;
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

    // 1. Reconnect/Attach branch: If a job is ALREADY active on the server for this PRD
    if (isJobActive(params.id)) {
      if (sectionIds && sectionIds.length > 0) {
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

      // Attach this request as an SSE listener to the running background job
      const responseStream = new TransformStream();
      const writer = responseStream.writable.getWriter();
      const textEncoder = new TextEncoder();
      let isStreamClosed = false;

      const safeClose = async () => {
        if (isStreamClosed) return;
        isStreamClosed = true;
        try {
          await writer.close();
        } catch {
          // Ignore writer close error
        }
      };

      const emitToClient = (event: string, data: unknown) => {
        if (isStreamClosed) return;
        try {
          const encoded = encodeSseEvent(event, data);
          writer.write(textEncoder.encode(encoded)).catch(() => {
            isStreamClosed = true;
          });
          if (event === "run.completed" || event === "run.failed") {
            safeClose();
          }
        } catch {
          isStreamClosed = true;
        }
      };

      const unsubscribe = addJobListener(params.id, emitToClient);

      // If client disconnects, only unsubscribe from listener; do not stop job
      req.signal.addEventListener("abort", () => {
        if (unsubscribe) unsubscribe();
        safeClose();
      });

      // Send initial heartbeat to acknowledge connection
      emitToClient("heartbeat", { reconnected: true });

      return new Response(responseStream.readable, {
        headers: SSE_HEADERS,
      });
    }

    // 2. New Run branch: Guard with atomic DB lock
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

    // Server-managed AbortController decoupled from client HTTP request
    const jobAbortController = new AbortController();
    registerJob(params.id, runId, ownerId, jobAbortController);

    // Set up Server-Sent Events stream for caller
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const textEncoder = new TextEncoder();
    let isClosed = false;

    const safeCloseWriter = async () => {
      if (isClosed) return;
      isClosed = true;
      try {
        await writer.close();
      } catch {
        // Ignore writer close error
      }
    };

    const emit = (event: string, data: unknown) => {
      if (isClosed) return;
      try {
        const encoded = encodeSseEvent(event, data);
        writer.write(textEncoder.encode(encoded)).catch(() => {
          isClosed = true;
        });
        if (event === "run.completed" || event === "run.failed") {
          safeCloseWriter();
        }
      } catch {
        isClosed = true;
      }
    };

    const unsubscribeCaller = addJobListener(params.id, emit);

    // If client disconnects/navigates away, detach listener and close writer
    // The background job keeps executing until completion!
    req.signal.addEventListener("abort", () => {
      if (unsubscribeCaller) unsubscribeCaller();
      safeCloseWriter();
    });

    // Execute agent runtime pipeline asynchronously in the background
    (async () => {
      try {
        await runGeneration(lockedDoc, {
          ownerId,
          sectionIds,
          emit: (event, data) => {
            emitToJob(params.id, event, data);
          },
          signal: jobAbortController.signal,
          runId,
          preAcquiredLock: true,
        });
      } catch (err) {
        console.error(`Agent runtime failed for PRD ${params.id}:`, err);
        try {
          await releaseExecutionLock(
            params.id,
            runId,
            (currentDocStatus as any) || "failed"
          );
        } catch {
          // Ignore release failure
        }
      } finally {
        finishJob(params.id, runId);
        safeCloseWriter();
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
    finishJob(params.id, runId);
    console.error(`POST /api/prds/${params.id}/generate failed:`, err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to initiate generation" } },
      { status: 500 }
    );
  }
}
