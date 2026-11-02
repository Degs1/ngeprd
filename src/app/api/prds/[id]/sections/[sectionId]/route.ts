import { NextRequest, NextResponse } from "next/server";
import { getOwnerId } from "@/lib/auth/owner";
import { updateSection, deleteSection } from "@/lib/db/prdRepository";
import { UpdateSectionSchema } from "@/lib/schemas/prd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
    sectionId: string;
  };
}

/**
 * PATCH /api/prds/[id]/sections/[sectionId]
 * Updates section content with optimistic concurrency baseRev check.
 * Returns 409 REV_CONFLICT if baseRev is stale.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const ownerId = getOwnerId();
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
      params.id,
      ownerId,
      params.sectionId,
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
            message: `Section ${params.sectionId} has been modified (current rev: ${result.currentRev}, provided: ${baseRev})`,
            currentRev: result.currentRev,
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ rev: result.rev });
  } catch (err) {
    console.error(
      `PATCH /api/prds/${params.id}/sections/${params.sectionId} failed:`,
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
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const ownerId = getOwnerId();
    const deleted = await deleteSection(params.id, ownerId, params.sectionId);

    if (!deleted) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "PRD or section not found" } },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(
      `DELETE /api/prds/${params.id}/sections/${params.sectionId} failed:`,
      err
    );
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to delete section" } },
      { status: 500 }
    );
  }
}
