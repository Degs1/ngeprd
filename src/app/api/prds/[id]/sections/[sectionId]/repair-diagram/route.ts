import { NextRequest, NextResponse } from "next/server";
import { getOwnerId } from "@/lib/auth/owner";
import { getPrdById } from "@/lib/db/prdRepository";
import {
  RepairDiagramInputSchema,
  runDiagramRepair,
} from "@/lib/agent/diagramGenerator";
import type { Section } from "@/lib/schemas/prd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
    sectionId: string;
  };
}

/**
 * POST /api/prds/[id]/sections/[sectionId]/repair-diagram
 * Repairs malformed Mermaid diagram syntax using the diagram repair agent.
 * Responds with { code: string }.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ownerId = getOwnerId();
    const body = await req.json().catch(() => null);

    const parsed = RepairDiagramInputSchema.safeParse(body);
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

    const doc = await getPrdById(params.id, ownerId);
    if (!doc) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "PRD document not found" } },
        { status: 404 }
      );
    }

    const section = (doc.sections as Section[]).find((s) => s.id === params.sectionId);
    if (!section) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Section not found" } },
        { status: 404 }
      );
    }

    const repairedCode = await runDiagramRepair({
      code: parsed.data.code,
      error: parsed.data.error,
      lang: doc.lang || "id",
      docId: params.id,
      sectionId: params.sectionId,
    });

    return NextResponse.json({ code: repairedCode });
  } catch (err: unknown) {
    console.error(
      `POST /api/prds/${params.id}/sections/${params.sectionId}/repair-diagram failed:`,
      err
    );

    const errorMessage =
      err instanceof Error ? err.message : "Failed to repair diagram syntax";

    return NextResponse.json(
      {
        error: {
          code: "AI_ERROR",
          message: errorMessage,
        },
      },
      { status: 502 }
    );
  }
}
