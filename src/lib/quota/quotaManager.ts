import { getPrdCollection, getUserUsageCollection } from "../db/mongo";

export const DEFAULT_DAILY_PRD_LIMIT = 3;

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  isAdmin: boolean;
  resetAt: string;
}

/**
 * Returns formatted date key YYYY-MM-DD for the current day.
 */
export function getTodayDateKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns Date object pointing to the start of today (00:00:00 local time).
 */
export function getStartOfToday(d: Date = new Date()): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Returns Date object pointing to midnight of next day (reset time).
 */
export function getTomorrowResetDate(d: Date = new Date()): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

/**
 * Resolves the configured daily limit from environment or default (3).
 */
export function getDailyPrdLimit(): number {
  const envLimit = process.env.DAILY_PRD_LIMIT;
  if (envLimit) {
    const parsed = parseInt(envLimit, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_DAILY_PRD_LIMIT;
}

/**
 * Returns the number of PRDs created by ownerId today.
 * Combines atomic usage records with prd_documents creation timestamp to guarantee accuracy.
 */
export async function getDailyUsage(ownerId: string): Promise<number> {
  if (!ownerId) return 0;

  try {
    const dateKey = getTodayDateKey();
    const usageCol = await getUserUsageCollection();
    const usageDoc = await usageCol.findOne({ ownerId, dateKey });

    const prdCol = await getPrdCollection();
    const prdDocCount = await prdCol.countDocuments({
      ownerId,
      createdAt: { $gte: getStartOfToday() },
    });

    const recordedCount = usageDoc?.count ?? 0;
    return Math.max(recordedCount, prdDocCount);
  } catch (err) {
    console.error("Failed to query daily usage for ownerId:", ownerId, err);
    return 0;
  }
}

/**
 * Atomically increments the daily PRD creation counter for ownerId.
 */
export async function incrementDailyUsage(ownerId: string): Promise<number> {
  if (!ownerId) return 0;

  try {
    const dateKey = getTodayDateKey();
    const now = new Date();
    const usageCol = await getUserUsageCollection();

    const res = await usageCol.findOneAndUpdate(
      { ownerId, dateKey },
      {
        $inc: { count: 1 },
        $setOnInsert: { createdAt: now },
        $set: { updatedAt: now },
      },
      { upsert: true, returnDocument: "after" }
    );

    return res?.count ?? 1;
  } catch (err) {
    console.error("Failed to increment daily usage for ownerId:", ownerId, err);
    return 1;
  }
}

/**
 * Evaluates whether ownerId is permitted to create/generate a new PRD today.
 * Admins are unconditionally allowed without decrementing quota.
 */
export async function checkDailyQuota(authCtx: {
  ownerId: string;
  userEmail?: string | null;
  isAdmin: boolean;
}): Promise<QuotaCheckResult> {
  const resetAt = getTomorrowResetDate().toISOString();

  // Admin bypass: unlimited access
  if (authCtx.isAdmin) {
    return {
      allowed: true,
      used: 0,
      limit: Infinity,
      remaining: Infinity,
      isAdmin: true,
      resetAt,
    };
  }

  const limit = getDailyPrdLimit();
  const used = await getDailyUsage(authCtx.ownerId);
  const remaining = Math.max(0, limit - used);

  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
    isAdmin: false,
    resetAt,
  };
}
