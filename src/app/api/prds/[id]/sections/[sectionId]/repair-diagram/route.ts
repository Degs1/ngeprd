import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/owner";
import { getPrdById } from "@/lib/db/prdRepository";
import {
  RepairDiagramInputSchema,
  runDiagramRepair,
} from "@/lib/agent/diagramGenerator";
import type { Section } from "@/lib/schemas/prd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; sectionId: string }> | { id: string; sectionId: string };
}

/**
 * POST /api/prds/[id]/sections/[sectionId]/repair-diagram
 * Repairs malformed Mermaid diagram syntax using the diagram repair agent.
 * Responds with { code: string }.
 */
export async function POST(req: NextRequest, context: RouteParams) {
  const { id, sectionId } = await Promise.resolve(context.params);
  try {
    const explicitId = req.headers.get("x-owner-id") || undefined;
    const authCtx = await getAuthContext(explicitId);
    const ownerId = authCtx.ownerId;
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

    const doc = await getPrdById(id, ownerId);
    if (!doc) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "PRD document not found" } },
        { status: 404 }
      );
    }

    const section = (doc.sections as Section[]).find((s) => s.id === sectionId);
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
      docId: id,
      sectionId: sectionId,
    });

    return NextResponse.json({ code: repairedCode });
  } catch (err: unknown) {
    console.error(
      `POST /api/prds/${id}/sections/${sectionId}/repair-diagram failed:`,
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
