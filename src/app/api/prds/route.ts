import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/owner";
import { createPrd, getPrds } from "@/lib/db/prdRepository";
import { CreatePrdSchema } from "@/lib/schemas/prd";
import { checkDailyQuota, incrementDailyUsage } from "@/lib/quota/quotaManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/prds
 * Returns lightweight list of PRDs for the active authenticated user or owner.
 */
export async function GET(req: NextRequest) {
  try {
    const explicitId = req.headers.get("x-owner-id") || undefined;
    const authCtx = await getAuthContext(explicitId);
    const prds = await getPrds(authCtx.ownerId);
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
 * Enforces authentication and daily generation quota for free users (3 PRDs/day, unlimited for admins).
 */
export async function POST(req: NextRequest) {
  try {
    const explicitId = req.headers.get("x-owner-id") || undefined;
    const authCtx = await getAuthContext(explicitId);

    // 1. Enforce authentication for PRD creation
    if (!authCtx.isAuthenticated) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Silakan masuk dengan akun Google terlebih dahulu untuk membuat PRD.",
          },
        },
        { status: 401 }
      );
    }

    // 2. Enforce daily creation quota (3 PRDs/day for free users, unlimited for admins)
    const quota = await checkDailyQuota(authCtx);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "DAILY_LIMIT_EXCEEDED",
            message: `Batas harian tercapai. Pengguna gratis dibatasi maksimal ${quota.limit} PRD per hari. Silakan coba lagi besok setelah reset atau gunakan akun admin.`,
          },
          quota,
        },
        { status: 429 }
      );
    }

    // 3. Validate request payload
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

    // 4. Create document & atomically track usage
    const prd = await createPrd(authCtx.ownerId, parsed.data);
    await incrementDailyUsage(authCtx.ownerId);

    return NextResponse.json(
      {
        id: prd._id.toString(),
        quota: {
          used: quota.used + 1,
          limit: quota.limit,
          remaining: Math.max(0, quota.remaining - 1),
          isAdmin: quota.isAdmin,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/prds failed:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to create PRD" } },
      { status: 500 }
    );
  }
}
