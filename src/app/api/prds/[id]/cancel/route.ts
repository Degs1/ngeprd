import { NextRequest, NextResponse } from "next/server";
import { getOwnerId } from "@/lib/auth/owner";
import {
  getPrdById,
  releaseExecutionLock,
  resetWritingSectionsToPending,
} from "@/lib/db/prdRepository";
import { cancelJob } from "@/lib/agent/jobRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/prds/[id]/cancel
 * Explicitly terminates an active generation background job, resets any 'writing'
 * sections back to 'pending', and releases the document execution lock.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const ownerId = getOwnerId();
    const prdId = params.id;

    // 1. Cancel in server active job registry (signals AbortController)
    const cancelled = cancelJob(prdId, "Generasi dibatalkan oleh pengguna");

    // 2. Reset any in-flight writing sections in MongoDB
    await resetWritingSectionsToPending(prdId, ownerId).catch(() => {});

    // 3. Release lock if still marked as generating in MongoDB
    const prd = await getPrdById(prdId, ownerId);
    if (prd && prd.status === "generating") {
      const readySections = (prd.sections || []).filter((s) => s.status === "ready").length;
      const finalStatus = readySections > 0 ? "ready" : "brainstorming";
      const runId = prd.run?.id || "manual_cancel";
      await releaseExecutionLock(prdId, runId, finalStatus).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      cancelled,
      message: cancelled
        ? "Proses generasi PRD berhasil dibatalkan."
        : "Tidak ada proses generasi aktif yang sedang berjalan.",
    });
  } catch (err) {
    console.error(`POST /api/prds/${params.id}/cancel failed:`, err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Gagal membatalkan proses generasi" } },
      { status: 500 }
    );
  }
}
