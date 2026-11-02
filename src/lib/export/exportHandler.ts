import { NextRequest, NextResponse } from "next/server";
import { getOwnerId as defaultGetOwnerId } from "@/lib/auth/owner";
import { getPrdById as defaultGetPrdById } from "@/lib/db/prdRepository";
import { docToMarkdown, generateSlug } from "@/lib/converter/docToMarkdown";
import type { PrdDocument } from "@/lib/schemas/prd";

export interface ExportPrdDeps {
  getOwnerId?: () => string;
  getPrdById?: (id: string, ownerId: string) => Promise<PrdDocument | null>;
}

/**
 * Core handler logic for exporting PRD document to markdown.
 */
export async function handleExportPrd(
  req: NextRequest,
  params: { id: string },
  deps?: ExportPrdDeps
) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "md";

    if (format !== "md") {
      return NextResponse.json(
        {
          error: {
            code: "UNSUPPORTED_FORMAT",
            message: "Hanya format markdown (md) yang didukung",
          },
        },
        { status: 400 }
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_ID",
            message: "ID PRD tidak valid",
          },
        },
        { status: 400 }
      );
    }

    const getOwner = deps?.getOwnerId || defaultGetOwnerId;
    const fetchPrd = deps?.getPrdById || defaultGetPrdById;

    const ownerId = getOwner();
    const prd = await fetchPrd(id, ownerId);

    if (!prd) {
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

    // Requirement 1: harus status ready dulu
    if (prd.status !== "ready") {
      return NextResponse.json(
        {
          error: {
            code: "PRD_NOT_READY",
            message: "PRD harus berstatus ready untuk diekspor",
          },
        },
        { status: 400 }
      );
    }

    // Convert document to clean numbered markdown
    const markdown = docToMarkdown(prd);

    // Requirement 2: slug dari judul
    const slug = generateSlug(prd.title);
    const filename = `${slug}.md`;

    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (err) {
    console.error("[Export PRD Error]:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Gagal mengekspor PRD",
        },
      },
      { status: 500 }
    );
  }
}
