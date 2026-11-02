import { NextRequest } from "next/server";
import { handleExportPrd } from "@/lib/export/exportHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * GET /api/prds/[id]/export?format=md
 */
export async function GET(req: NextRequest, context: RouteParams) {
  const resolvedParams = await Promise.resolve(context.params);
  return handleExportPrd(req, resolvedParams);
}
