import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/owner";
import { getPrdById } from "@/lib/db/prdRepository";
import {
  createChangeSet,
  getActiveChangeSet,
  getChangeSets,
  updateChangeSet,
} from "@/lib/db/changeSetRepository";
import { CreateChangeSetSchema } from "@/lib/schemas/agent";
import { runChangeSetGeneration } from "@/lib/agent/changeSetRunner";
import { encodeSseEvent, SSE_HEADERS } from "@/lib/sse/encode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * GET /api/prds/[id]/changesets?sectionId=&status=
 * Retrieves changeset history for the PRD, optionally filtered by sectionId or status.
 */
export async function GET(req: NextRequest, context: RouteParams) {
  const { id } = await Promise.resolve(context.params);
  try {
    const explicitId = req.headers.get("x-owner-id") || undefined;
    const authCtx = await getAuthContext(explicitId);
    const ownerId = authCtx.ownerId;
    const { searchParams } = new URL(req.url);
    const sectionId = searchParams.get("sectionId") || undefined;
    const status = searchParams.get("status") || undefined;

    const changesets = await getChangeSets(id, ownerId, {
      sectionId,
      status,
    });

    return NextResponse.json(changesets);
  } catch (err) {
    console.error(`GET /api/prds/${id}/changesets failed:`, err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to fetch changesets" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prds/[id]/changesets
 * Initiates multi-section chained AI revision engine and streams SSE events:
 * - changeset.started
 * - origin.ready
 * - impact.ready
 * - item.ready
 * - item.failed
 * - changeset.redirect
 * - changeset.ready
 * - changeset.failed
 * - heartbeat (every 15s)
 *
 * Enforces FR-AI-09: returns 409 CHANGESET_ACTIVE if an active changeset is already in progress.
 */
export async function POST(req: NextRequest, context: RouteParams) {
  const { id } = await Promise.resolve(context.params);
  try {
    const explicitId = req.headers.get("x-owner-id") || undefined;
    const authCtx = await getAuthContext(explicitId);
    const ownerId = authCtx.ownerId;
    const rawBody = await req.json().catch(() => null);

    const parsed = CreateChangeSetSchema.safeParse(rawBody);
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

    const { originSectionId, instruction } = parsed.data;

    // 1. Validate document exists
    const prd = await getPrdById(id, ownerId);
    if (!prd) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Dokumen PRD tidak ditemukan" } },
        { status: 404 }
      );
    }

    // 2. Validate origin section exists and is ready
    const originSection = prd.sections.find((s) => s.id === originSectionId);
    if (!originSection) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Origin section "${originSectionId}" tidak ditemukan di dokumen`,
          },
        },
        { status: 400 }
      );
    }

    if (originSection.status !== "ready") {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Hanya section dengan status "ready" yang dapat direvisi (status saat ini: "${originSection.status}")`,
          },
        },
        { status: 400 }
      );
    }

    // 3. Check for active changeset (generating or pending)
    const activeCs = await getActiveChangeSet(prd._id, ownerId);
    if (activeCs) {
      const isStale =
        activeCs.status === "generating" &&
        Date.now() - new Date(activeCs.updatedAt).getTime() > 3 * 60 * 1000;

      if (isStale) {
        // Stale generating changeset (> 3 mins) is marked as failed
        await updateChangeSet(activeCs._id, ownerId, {
          status: "failed",
          error: {
            code: "TIMEOUT",
            message: "Change set generating sebelumnya kedaluwarsa (> 3 menit)",
          },
        });
      } else {
        return NextResponse.json(
          {
            error: {
              code: "CHANGESET_ACTIVE",
              message:
                "Terdapat change set aktif (generating/pending) yang belum selesai atau diputuskan",
            },
          },
          { status: 409 }
        );
      }
    }

    // 4. Create new changeset in MongoDB with status 'generating'
    const newCs = await createChangeSet(prd._id, ownerId, {
      originSectionId,
      instruction,
    });

    if (!newCs) {
      return NextResponse.json(
        { error: { code: "INTERNAL", message: "Gagal membuat change set" } },
        { status: 500 }
      );
    }

    // 5. Setup SSE stream
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

    const abortController = new AbortController();
    req.signal.addEventListener("abort", () => {
      abortController.abort();
      isClosed = true;
      writer.close().catch(() => {});
    });

    // Launch changeset runner asynchronously
    (async () => {
      try {
        await runChangeSetGeneration({
          doc: prd,
          originSectionId,
          instruction,
          ownerId,
          changesetId: newCs._id.toString(),
          emit,
          signal: abortController.signal,
        });
      } catch (err) {
        console.error("ChangeSet generation background execution error:", err);
      } finally {
        if (!isClosed) {
          isClosed = true;
          await writer.close().catch(() => {});
        }
      }
    })();

    return new Response(responseStream.readable, {
      headers: SSE_HEADERS,
    });
  } catch (err) {
    console.error(`POST /api/prds/${id}/changesets failed:`, err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to create changeset" } },
      { status: 500 }
    );
  }
}
