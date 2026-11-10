import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/owner";
import { cancelJob } from "@/lib/jobs/repository";
import { getPrdById } from "@/lib/db/prdRepository";
import { COLLECTIONS, getDb } from "@/lib/db/mongo";

export const runtime = "nodejs";
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await Promise.resolve(context.params);
  const auth = await getAuthContext(req.headers.get("x-owner-id") || undefined);
  const cancelled = await cancelJob(id, auth.ownerId);
  if (cancelled) {
    const doc = await getPrdById(id, auth.ownerId);
    if (doc) {
      const db = await getDb();
      await db.collection(COLLECTIONS.PRD_DOCUMENTS).updateOne({ _id: doc._id, ownerId: auth.ownerId },
        { $set: { status: doc.sections.some((s) => s.status === "ready") ? "ready" : "brainstorming" } });
    }
  }
  return NextResponse.json({ success: true, cancelled });
}
