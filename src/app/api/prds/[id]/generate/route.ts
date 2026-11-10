import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getAuthContext } from "@/lib/auth/owner";
import { getPrdById } from "@/lib/db/prdRepository";
import { createJob } from "@/lib/jobs/repository";
import { COLLECTIONS, getDb } from "@/lib/db/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Body = z.object({ sectionIds: z.array(z.string().min(1)).optional() });

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  if (process.env.AI_JOB_SUBMISSIONS_ENABLED === "false") return NextResponse.json({ error: { code: "SUBMISSIONS_PAUSED" } }, { status: 503 });
  const { id } = await Promise.resolve(context.params);
  const auth = await getAuthContext(req.headers.get("x-owner-id") || undefined);
  const prd = await getPrdById(id, auth.ownerId);
  if (!prd) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR" } }, { status: 400 });
  const unanswered = prd.brainstorm.questions.filter((q) => !prd.brainstorm.answers.some((a) => a.questionId === q.id && a.value.trim()));
  if (!prd.brainstorm.questions.length || unanswered.length) return NextResponse.json({ error: { code: "ANSWERS_INCOMPLETE" } }, { status: 409 });
  const sectionIds = parsed.data.sectionIds;
  if (sectionIds?.some((sectionId) => !prd.sections.some((s) => s.id === sectionId))) return NextResponse.json({ error: { code: "INVALID_SECTION" } }, { status: 400 });
  try {
    const submissionId = req.headers.get("idempotency-key") || randomUUID();
    const job = await createJob({ ownerId: auth.ownerId, prdId: prd._id, kind: "generation", submissionId, sectionIds });
    const db = await getDb();
    if (["queued", "running", "retry_scheduled", "waiting_capacity"].includes(job.state)) {
      await db.collection(COLLECTIONS.PRD_DOCUMENTS).updateOne({ _id: prd._id, ownerId: auth.ownerId },
        { $set: { status: "generating", updatedAt: new Date() } });
    }
    return NextResponse.json({ jobId: job._id.toString(), state: job.state, statusUrl: `/api/prds/${id}/jobs/${job._id}` }, { status: 202 });
  } catch (error: any) {
    if (error?.message === "ACTIVE_JOB_LIMIT") return NextResponse.json({ error: { code: "ACTIVE_JOB_LIMIT" } }, { status: 409 });
    if (error?.message === "SUBMISSION_ID_CONFLICT") return NextResponse.json({ error: { code: "SUBMISSION_ID_CONFLICT" } }, { status: 409 });
    throw error;
  }
}
