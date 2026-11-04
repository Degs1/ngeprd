import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/owner";
import { upsertBrainstormAnswer } from "@/lib/db/prdRepository";
import { BrainstormAnswerSchema } from "@/lib/schemas/prd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * PUT /api/prds/[id]/brainstorm/answers
 * Upserts a brainstorm answer in prd.brainstorm.answers.
 * Persists immediately on question answer or text change.
 */
export async function PUT(req: NextRequest, context: RouteParams) {
  const { id } = await Promise.resolve(context.params);
  try {
    const explicitId = req.headers.get("x-owner-id") || undefined;
    const authCtx = await getAuthContext(explicitId);
    const ownerId = authCtx.ownerId;
    const body = await req.json().catch(() => null);

    const validation = BrainstormAnswerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: validation.error.issues
              .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
              .join(", "),
          },
        },
        { status: 400 }
      );
    }

    const updatedDoc = await upsertBrainstormAnswer(
      id,
      ownerId,
      validation.data
    );

    if (!updatedDoc) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Dokumen PRD tidak ditemukan",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      answer: validation.data,
      answers: updatedDoc.brainstorm?.answers || [],
    });
  } catch (err: unknown) {
    console.error(`PUT /api/prds/${id}/brainstorm/answers failed:`, err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error ? err.message : "Gagal menyimpan jawaban",
        },
      },
      { status: 500 }
    );
  }
}
