import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/owner";
import { getPrdById, saveBrainstormQuestions } from "@/lib/db/prdRepository";
import { runBrainstormer } from "@/lib/agent/brainstormer";
import { AiError } from "@/lib/ai/generateJson";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * POST /api/prds/[id]/brainstorm
 * Idempotent:
 * - If brainstorm questions already exist, returns them immediately.
 * - Otherwise, invokes the Brainstormer agent to generate domain-specific questions,
 *   saves them to the PRD document in MongoDB, and returns them.
 * - On AI failure, returns structured error (NO fallback templates).
 */
export async function POST(req: NextRequest, context: RouteParams) {
  const { id } = await Promise.resolve(context.params);
  try {
    const explicitId = req.headers.get("x-owner-id") || undefined;
    const authCtx = await getAuthContext(explicitId);
    const ownerId = authCtx.ownerId;
    const prd = await getPrdById(id, ownerId);
    
    if (!prd) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Dokumen PRD tidak ditemukan" } },
        { status: 404 }
      );
    }

    // Idempotency: Return existing questions if already generated
    if (prd.brainstorm?.questions && prd.brainstorm.questions.length > 0) {
      return NextResponse.json({
        questions: prd.brainstorm.questions,
        lang: prd.lang || "id",
      });
    }

    // Generate questions using Brainstormer agent
    const result = await runBrainstormer({
      idea: prd.idea,
      docId: prd._id.toString(),
    });

    // Save to database
    const updated = await saveBrainstormQuestions(
      prd._id,
      ownerId,
      result.questions,
      result.lang
    );

    if (!updated) {
      return NextResponse.json(
        {
          error: {
            code: "SAVE_FAILED",
            message: "Gagal menyimpan pertanyaan brainstorming ke database",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      questions: result.questions,
      lang: result.lang,
    });
  } catch (err: unknown) {
    if (err instanceof AiError) {
      const statusCode =
        err.code === "AI_TIMEOUT"
          ? 504
          : err.code === "AI_AUTH_ERROR"
          ? 401
          : 502;

      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.message,
            stage: err.stage,
          },
        },
        { status: statusCode }
      );
    }

    console.error(`POST /api/prds/${id}/brainstorm failed:`, err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error ? err.message : "Terjadi kesalahan internal",
        },
      },
      { status: 500 }
    );
  }
}
