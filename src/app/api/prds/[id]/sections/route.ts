import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/owner";
import { addSection } from "@/lib/db/prdRepository";
import { AddSectionSchema } from "@/lib/schemas/prd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * POST /api/prds/[id]/sections
 * Adds a new manual section to a chapter.
 */
export async function POST(req: NextRequest, context: RouteParams) {
  const { id } = await Promise.resolve(context.params);
  try {
    const explicitId = req.headers.get("x-owner-id") || undefined;
    const authCtx = await getAuthContext(explicitId);
    const ownerId = authCtx.ownerId;
    const body = await req.json().catch(() => null);

    const parsed = AddSectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues.map((e) => e.message).join(", "),
          },
        },
        { status: 400 }
      );
    }

    const section = await addSection(id, ownerId, parsed.data);
    if (!section) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "PRD document not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json(section, { status: 201 });
  } catch (err) {
    console.error(`POST /api/prds/${id}/sections failed:`, err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to add section" } },
      { status: 500 }
    );
  }
}
