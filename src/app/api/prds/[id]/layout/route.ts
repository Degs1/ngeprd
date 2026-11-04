import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/owner";
import { updatePrdLayout } from "@/lib/db/prdRepository";
import { UpdateLayoutSchema } from "@/lib/schemas/prd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * PATCH /api/prds/[id]/layout
 * Saves section positions without incrementing rev.
 */
export async function PATCH(req: NextRequest, context: RouteParams) {
  const { id } = await Promise.resolve(context.params);
  try {
    const explicitId = req.headers.get("x-owner-id") || undefined;
    const authCtx = await getAuthContext(explicitId);
    const ownerId = authCtx.ownerId;
    const body = await req.json().catch(() => null);

    const parsed = UpdateLayoutSchema.safeParse(body);
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

    const updated = await updatePrdLayout(id, ownerId, parsed.data.positions);
    if (!updated) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "PRD document not found" } },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(`PATCH /api/prds/${id}/layout failed:`, err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to update layout" } },
      { status: 500 }
    );
  }
}
