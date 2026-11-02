import { cookies } from "next/headers";

export const OWNER_COOKIE_NAME = "bp_owner";
export const OWNER_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

/**
 * Resolves the anonymous owner ID from the `bp_owner` cookie.
 * If the cookie does not exist, a new UUID is generated and set with:
 * - httpOnly: true
 * - sameSite: "lax"
 * - secure: true only in production
 * - maxAge: 1 year
 * - path: "/"
 */
export function getOwnerId(explicitId?: string): string {
  if (explicitId && explicitId.trim().length > 0) {
    return explicitId.trim();
  }

  try {
    const cookieStore = cookies();
    const existing = cookieStore.get(OWNER_COOKIE_NAME)?.value;
    if (existing && existing.trim().length > 0) {
      return existing.trim();
    }

    const newOwnerId = crypto.randomUUID();
    cookieStore.set(OWNER_COOKIE_NAME, newOwnerId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: OWNER_COOKIE_MAX_AGE,
      path: "/",
    });
    return newOwnerId;
  } catch {
    // If called outside Next.js request context (e.g., unit test or script)
    return explicitId || crypto.randomUUID();
  }
}
