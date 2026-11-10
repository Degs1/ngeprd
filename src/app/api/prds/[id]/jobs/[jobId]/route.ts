import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/owner";
import { getPrdById } from "@/lib/db/prdRepository";
import { getEvents, getJob } from "@/lib/jobs/repository";
import { COLLECTIONS, getDb } from "@/lib/db/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string; jobId: string }> | { id: string; jobId: string } }) {
  const { id, jobId } = await Promise.resolve(context.params);
  const auth = await getAuthContext(req.headers.get("x-owner-id") || undefined);
  const job = await getJob(jobId, auth.ownerId);
  if (!job || job.prdId.toString() !== id) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  const after = Math.max(0, Number(new URL(req.url).searchParams.get("after") || 0));
  const db = await getDb();
  const [prd, events, usage] = await Promise.all([getPrdById(id, auth.ownerId), getEvents(job._id, auth.ownerId, after),
    db.collection(COLLECTIONS.AI_USAGE).aggregate([
      { $match: { prdId: job.prdId } },
      { $group: { _id: "$stage", requests: { $sum: 1 }, inputTokens: { $sum: { $ifNull: ["$inputTokens", 0] } },
        outputTokens: { $sum: { $ifNull: ["$outputTokens", 0] } },
        costUsd: { $sum: { $ifNull: ["$costUsd", 0] } },
        unknownCost: { $sum: { $cond: [{ $eq: ["$costUsd", null] }, 1, 0] } },
        unknownUsage: { $sum: { $cond: [{ $or: [{ $eq: ["$inputTokens", null] }, { $eq: ["$outputTokens", null] }] }, 1, 0] } },
        errors: { $sum: { $cond: [{ $eq: ["$outcome", "error"] }, 1, 0] } } } },
    ]).toArray()]);
  return NextResponse.json({ job: { id: jobId, kind: job.kind, state: job.state, stage: job.stage,
    progress: job.progress, reason: job.reason, eventSeq: job.eventSeq }, prd, events,
    usage: { byStage: usage, totals: usage.reduce((acc, row) => ({ requests: acc.requests + row.requests,
      inputTokens: acc.inputTokens + row.inputTokens, outputTokens: acc.outputTokens + row.outputTokens,
      costUsd: acc.costUsd + row.costUsd, unknownCost: acc.unknownCost + row.unknownCost,
      unknownUsage: acc.unknownUsage + row.unknownUsage, errors: acc.errors + row.errors }),
      { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, unknownCost: 0, unknownUsage: 0, errors: 0 }) } });
}
