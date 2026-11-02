import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/owner";
import { checkDailyQuota } from "@/lib/quota/quotaManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/user/quota
 * Returns current authenticated user profile and daily PRD generation quota.
 */
export async function GET() {
  try {
    const authCtx = await getAuthContext();
    const quota = await checkDailyQuota(authCtx);

    return NextResponse.json({
      user: {
        ownerId: authCtx.ownerId,
        email: authCtx.userEmail,
        name: authCtx.userName,
        image: authCtx.userImage,
        isAdmin: authCtx.isAdmin,
        isAuthenticated: authCtx.isAuthenticated,
      },
      quota,
    });
  } catch (err) {
    console.error("GET /api/user/quota failed:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to fetch user quota" } },
      { status: 500 }
    );
  }
}
