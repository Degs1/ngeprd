import { cookies } from "next/headers";
import { auth } from "@/auth";
import { isAdminEmail } from "./admin";
import { getPrdCollection, getChangeSetCollection } from "../db/mongo";

export const OWNER_COOKIE_NAME = "bp_owner";
export const OWNER_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

export interface AuthContext {
  ownerId: string;
  userEmail: string | null;
  userName: string | null;
  userImage: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
}

/**
 * Resolves the authenticated user from Auth.js session, or falls back to
 * anonymous owner ID from the `bp_owner` cookie.
 */
export async function getAuthContext(explicitId?: string): Promise<AuthContext> {
  // If explicit ID passed (e.g. testing or explicit header)
  if (explicitId && explicitId.trim().length > 0) {
    const trimmed = explicitId.trim();
    const email = trimmed.includes("@") ? trimmed.toLowerCase() : null;
    return {
      ownerId: trimmed,
      userEmail: email,
      userName: null,
      userImage: null,
      isAdmin: isAdminEmail(email),
      isAuthenticated: true,
    };
  }

  // 1. Try resolving Auth.js session
  try {
    const session = await auth();
    if (session?.user?.email) {
      const email = session.user.email.toLowerCase().trim();
      const isAdmin = (session.user as any)?.role === "admin" || isAdminEmail(email);

      // Opportunistically migrate anonymous PRDs if cookie exists
      try {
        const cookieStore = cookies();
        const anonId = cookieStore.get(OWNER_COOKIE_NAME)?.value;
        if (anonId && anonId !== email) {
          await migratePrdOwner(anonId, email);
        }
      } catch {
        // Ignore cookie read failures in edge contexts
      }

      return {
        ownerId: email,
        userEmail: email,
        userName: session.user.name || null,
        userImage: session.user.image || null,
        isAdmin,
        isAuthenticated: true,
      };
    }
  } catch (err) {
    // Session retrieval error or non-request context
  }

  // 2. Fall back to anonymous cookie
  const anonId = getOwnerId();
  return {
    ownerId: anonId,
    userEmail: null,
    userName: null,
    userImage: null,
    isAdmin: false,
    isAuthenticated: false,
  };
}

/**
 * Migrates PRD documents and changesets from an anonymous owner to an authenticated user.
 */
export async function migratePrdOwner(fromOwnerId: string, toOwnerId: string): Promise<number> {
  if (!fromOwnerId || !toOwnerId || fromOwnerId === toOwnerId) return 0;
  try {
    const prdCol = await getPrdCollection();
    const result = await prdCol.updateMany(
      { ownerId: fromOwnerId },
      { $set: { ownerId: toOwnerId, updatedAt: new Date() } }
    );

    if (result.modifiedCount > 0) {
      const csCol = await getChangeSetCollection();
      await csCol.updateMany(
        { ownerId: fromOwnerId },
        { $set: { ownerId: toOwnerId, updatedAt: new Date() } }
      );
    }

    return result.modifiedCount;
  } catch (err) {
    console.error(`Failed to migrate PRDs from ${fromOwnerId} to ${toOwnerId}:`, err);
    return 0;
  }
}

/**
 * Resolves the anonymous owner ID from the `bp_owner` cookie.
 * Synchronous and backward-compatible for existing code and unit tests.
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
