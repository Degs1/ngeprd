import { NextRequest, NextResponse } from "next/server";
import { getOwnerId } from "@/lib/auth/owner";
import {
  getPrdById,
  updatePrdTitle,
  deletePrd,
} from "@/lib/db/prdRepository";
import { UpdatePrdTitleSchema } from "@/lib/schemas/prd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/prds/[id]
 * Retrieves the full PRD document scoped by ownerId.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const ownerId = getOwnerId();
    const prd = await getPrdById(params.id, ownerId);

    if (!prd) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "PRD document not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json(prd);
  } catch (err) {
    console.error(`GET /api/prds/${params.id} failed:`, err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to retrieve PRD" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/prds/[id]
 * Updates the document title and sets titleEdited: true.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const ownerId = getOwnerId();
    const body = await req.json().catch(() => null);

    const parsed = UpdatePrdTitleSchema.safeParse(body);
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

    const updated = await updatePrdTitle(params.id, ownerId, parsed.data.title);
    if (!updated) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "PRD document not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error(`PATCH /api/prds/${params.id} failed:`, err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to update PRD title" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/prds/[id]
 * Deletes the document and its associated changesets.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const ownerId = getOwnerId();
    const deleted = await deletePrd(params.id, ownerId);

    if (!deleted) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "PRD document not found" } },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(`DELETE /api/prds/${params.id} failed:`, err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to delete PRD" } },
      { status: 500 }
    );
  }
}
