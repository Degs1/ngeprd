import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateQuestions } from "@/lib/ai/client";
import { QuestionItemSchema } from "@/lib/ai/prompts";

const RequestBodySchema = z.object({
  idea: z.string().trim().min(1, "Idea must not be empty"),
});

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const validation = RequestBodySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { idea } = validation.data;
    const questions = await generateQuestions(idea);

    // Ensure every question matches QuestionItemSchema
    const validatedQuestions = questions.filter((q) =>
      QuestionItemSchema.safeParse(q).success
    );

    // Support optional object wrapper if explicitly requested via query param
    const format = request.nextUrl.searchParams.get("format");
    if (format === "object") {
      return NextResponse.json({ questions: validatedQuestions }, { status: 200 });
    }

    // Default: return structured array of questions
    return NextResponse.json(validatedQuestions, { status: 200 });
  } catch (error) {
    console.error("[POST /api/plan/questions] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
