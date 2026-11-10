import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/owner";
import { getPrdById } from "@/lib/db/prdRepository";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await Promise.resolve(context.params);
  const auth = await getAuthContext(req.headers.get("x-owner-id") || undefined);
  if (!(await getPrdById(id, auth.ownerId))) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  return NextResponse.json({ error: { code: "AI_EDIT_RETIRED" } }, { status: 410 });
}
