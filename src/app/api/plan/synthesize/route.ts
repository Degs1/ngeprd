import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generatePrd, streamPrd } from "@/lib/ai/client";
import { generateFallbackPrd } from "@/lib/ai/fallbackPrd";

const RequestBodySchema = z.object({
  idea: z.string().optional(),
  answers: z
    .union([z.record(z.string(), z.unknown()), z.array(z.unknown())])
    .optional(),
  answersMap: z.record(z.string(), z.unknown()).optional(),
  stream: z.boolean().optional(),
  format: z.enum(["json", "markdown", "text"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const validation = RequestBodySchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const body = validation.data;

    // Resolve idea from body.idea or attempt to find it in answers/answersMap
    let idea = body.idea?.trim() || "";

    const combinedAnswers = body.answersMap || body.answers || {};

    if (!idea && typeof combinedAnswers === "object" && combinedAnswers !== null) {
      const answersRecord = combinedAnswers as Record<string, unknown>;
      const startNode = answersRecord["start-node"] as
        | { answer?: string; idea?: string; label?: string }
        | undefined;
      if (startNode) {
        idea = (startNode.idea || startNode.answer || startNode.label || "").trim();
      }
    }

    if (!idea) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: { idea: ["Idea must not be empty"] },
        },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const isStreamRequested =
      searchParams.get("stream") === "true" ||
      body.stream === true ||
      request.headers.get("accept") === "text/event-stream";

    const formatParam =
      searchParams.get("format") ||
      body.format ||
      (request.headers.get("accept")?.includes("text/markdown") ||
      request.headers.get("accept")?.includes("text/plain")
        ? "markdown"
        : "json");

    // Handle Streaming Text Response
    if (isStreamRequested) {
      try {
        const streamResult = await streamPrd(idea, combinedAnswers);
        return streamResult.toTextStreamResponse({
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      } catch (streamError) {
        console.warn(
          "[POST /api/plan/synthesize] Streaming failed, falling back to static text stream:",
          streamError
        );
        const fallbackText = generateFallbackPrd(idea, combinedAnswers);
        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(fallbackText));
            controller.close();
          },
        });

        return new Response(readableStream, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      }
    }

    // Handle Non-Streaming Response
    const markdown = await generatePrd(idea, combinedAnswers);

    // If client requested raw markdown or plain text
    if (formatParam === "markdown" || formatParam === "text") {
      return new Response(markdown, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
        },
      });
    }

    // Default: Markdown JSON Response for smooth UI rendering
    return NextResponse.json(
      {
        markdown,
        prd: markdown,
        idea,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/plan/synthesize] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
