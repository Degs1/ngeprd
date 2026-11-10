import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/owner";
import { getLatestJob } from "@/lib/jobs/repository";

export const runtime = "nodejs";
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await Promise.resolve(context.params);
  const auth = await getAuthContext(req.headers.get("x-owner-id") || undefined);
  const job = await getLatestJob(id, auth.ownerId);
  if (!job) return NextResponse.json({ job: null });
  return NextResponse.json({ job: { id: job._id.toString(), kind: job.kind, state: job.state, stage: job.stage,
    reason: job.reason, progress: job.progress }, statusUrl: `/api/prds/${id}/jobs/${job._id}` });
}
