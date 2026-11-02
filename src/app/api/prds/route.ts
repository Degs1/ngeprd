import { NextRequest, NextResponse } from "next/server";
import { getOwnerId } from "@/lib/auth/owner";
import { createPrd, getPrds } from "@/lib/db/prdRepository";
import { CreatePrdSchema } from "@/lib/schemas/prd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/prds
 * Returns lightweight list of PRDs for the active owner.
 */
export async function GET() {
  try {
    const ownerId = getOwnerId();
    const prds = await getPrds(ownerId);
    return NextResponse.json(prds);
  } catch (err) {
    console.error("GET /api/prds failed:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to fetch PRDs" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prds
 * Creates a new PRD document with status 'brainstorming'.
 */
export async function POST(req: NextRequest) {
  try {
    const ownerId = getOwnerId();
    const body = await req.json().catch(() => null);

    const parsed = CreatePrdSchema.safeParse(body);
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

    const prd = await createPrd(ownerId, parsed.data);
    return NextResponse.json({ id: prd._id.toString() }, { status: 201 });
  } catch (err) {
    console.error("POST /api/prds failed:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to create PRD" } },
      { status: 500 }
    );
  }
}
