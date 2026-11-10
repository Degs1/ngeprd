import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAuthContext } from "@/lib/auth/owner";
import { getPrdById } from "@/lib/db/prdRepository";
import { createJob } from "@/lib/jobs/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  if (process.env.AI_JOB_SUBMISSIONS_ENABLED === "false") return NextResponse.json({ error: { code: "SUBMISSIONS_PAUSED" } }, { status: 503 });
  const { id } = await Promise.resolve(context.params);
  const auth = await getAuthContext(req.headers.get("x-owner-id") || undefined);
  const prd = await getPrdById(id, auth.ownerId);
  if (!prd) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  if (prd.brainstorm.questions.length) return NextResponse.json({ questions: prd.brainstorm.questions, lang: prd.lang, state: "waiting_user" });
  try {
    const submissionId = req.headers.get("idempotency-key") || randomUUID();
    const job = await createJob({ ownerId: auth.ownerId, prdId: prd._id, kind: "brainstorm", submissionId });
    return NextResponse.json({ jobId: job._id.toString(), state: job.state, statusUrl: `/api/prds/${id}/jobs/${job._id}` }, { status: 202 });
  } catch (error: any) {
    if (error?.message === "ACTIVE_JOB_LIMIT") return NextResponse.json({ error: { code: "ACTIVE_JOB_LIMIT" } }, { status: 409 });
    if (error?.message === "SUBMISSION_ID_CONFLICT") return NextResponse.json({ error: { code: "SUBMISSION_ID_CONFLICT" } }, { status: 409 });
    throw error;
  }
}
