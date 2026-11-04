import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/owner";
import { updateSection, deleteSection } from "@/lib/db/prdRepository";
import { UpdateSectionSchema } from "@/lib/schemas/prd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; sectionId: string }> | { id: string; sectionId: string };
}

/**
 * PATCH /api/prds/[id]/sections/[sectionId]
 * Updates section content with optimistic concurrency baseRev check.
 * Returns 409 REV_CONFLICT if baseRev is stale.
 */
export async function PATCH(req: NextRequest, context: RouteParams) {
  const { id, sectionId } = await Promise.resolve(context.params);
  try {
    const explicitId = req.headers.get("x-owner-id") || undefined;
    const authCtx = await getAuthContext(explicitId);
    const ownerId = authCtx.ownerId;
    const body = await req.json().catch(() => null);

    const parsed = UpdateSectionSchema.safeParse(body);
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

    const { baseRev, title, content, diagram } = parsed.data;
    const result = await updateSection(
      id,
      ownerId,
      sectionId,
      baseRev,
      { title, content, diagram }
    );

    if (result.notFound) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "PRD or section not found" } },
        { status: 404 }
      );
    }

    if (result.conflict) {
      return NextResponse.json(
        {
          error: {
            code: "REV_CONFLICT",
            message: `Section ${sectionId} has been modified (current rev: ${result.currentRev}, provided: ${baseRev})`,
            currentRev: result.currentRev,
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ rev: result.rev });
  } catch (err) {
    console.error(
      `PATCH /api/prds/${id}/sections/${sectionId} failed:`,
      err
    );
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to update section" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/prds/[id]/sections/[sectionId]
 * Deletes section and any connected edges.
 */
export async function DELETE(req: NextRequest, context: RouteParams) {
  const { id, sectionId } = await Promise.resolve(context.params);
  try {
    const explicitId = req.headers.get("x-owner-id") || undefined;
    const authCtx = await getAuthContext(explicitId);
    const ownerId = authCtx.ownerId;
    const deleted = await deleteSection(id, ownerId, sectionId);

    if (!deleted) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "PRD or section not found" } },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(
      `DELETE /api/prds/${id}/sections/${sectionId} failed:`,
      err
    );
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to delete section" } },
      { status: 500 }
    );
  }
}
