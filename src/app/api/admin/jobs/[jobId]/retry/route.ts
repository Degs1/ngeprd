import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/owner";
import { retryBlockedJob } from "@/lib/jobs/repository";

export const runtime = "nodejs";
export async function POST(_req: NextRequest, context: { params: Promise<{ jobId: string }> | { jobId: string } }) {
  const auth = await getAuthContext();
  if (!auth.isAuthenticated || !auth.isAdmin) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  const { jobId } = await Promise.resolve(context.params);
  const requeued = await retryBlockedJob(jobId);
  return NextResponse.json({ requeued }, { status: requeued ? 200 : 409 });
}
