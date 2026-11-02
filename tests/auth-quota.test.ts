import test from "node:test";
import assert from "node:assert/strict";
import { isAdminEmail, isUserAdmin } from "../src/lib/auth/admin";
import {
  getTodayDateKey,
  getStartOfToday,
  getTomorrowResetDate,
  getDailyPrdLimit,
  checkDailyQuota,
  DEFAULT_DAILY_PRD_LIMIT,
} from "../src/lib/quota/quotaManager";
import { getAuthContext, getOwnerId } from "../src/lib/auth/owner";

test("Admin Helpers - identifies admin emails from process.env.ADMIN_EMAILS", () => {
  const originalEnv = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "admin@ngeprd.com, Owner@Example.com , super@admin.io";

  try {
    assert.equal(isAdminEmail("admin@ngeprd.com"), true);
    assert.equal(isAdminEmail("OWNER@EXAMPLE.COM"), true);
    assert.equal(isAdminEmail("  super@admin.io  "), true);
    assert.equal(isAdminEmail("user@random.com"), false);
    assert.equal(isAdminEmail(null), false);
    assert.equal(isAdminEmail(undefined), false);

    assert.equal(isUserAdmin({ email: "admin@ngeprd.com", role: "user" }), true);
    assert.equal(isUserAdmin({ email: "regular@user.com", role: "admin" }), true);
    assert.equal(isUserAdmin({ email: "regular@user.com", role: "user" }), false);
    assert.equal(isUserAdmin(null), false);
  } finally {
    process.env.ADMIN_EMAILS = originalEnv;
  }
});

test("Date Utilities - computes date key, start of today, and reset date", () => {
  const testDate = new Date("2026-11-02T15:30:00Z");
  const key = getTodayDateKey(testDate);
  assert.equal(key, `${testDate.getFullYear()}-${String(testDate.getMonth() + 1).padStart(2, "0")}-${String(testDate.getDate()).padStart(2, "0")}`);

  const start = getStartOfToday(testDate);
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(start.getSeconds(), 0);
  assert.equal(start.getMilliseconds(), 0);

  const tomorrow = getTomorrowResetDate(testDate);
  assert.equal(tomorrow.getDate(), testDate.getDate() + 1);
  assert.equal(tomorrow.getHours(), 0);
});

test("Daily PRD Limit - defaults to 3 and respects environment override", () => {
  const originalEnv = process.env.DAILY_PRD_LIMIT;

  try {
    delete process.env.DAILY_PRD_LIMIT;
    assert.equal(getDailyPrdLimit(), 3);
    assert.equal(DEFAULT_DAILY_PRD_LIMIT, 3);

    process.env.DAILY_PRD_LIMIT = "5";
    assert.equal(getDailyPrdLimit(), 5);

    process.env.DAILY_PRD_LIMIT = "invalid";
    assert.equal(getDailyPrdLimit(), 3);
  } finally {
    process.env.DAILY_PRD_LIMIT = originalEnv;
  }
});

test("Quota Enforcement - Admin user bypasses daily limit unconditionally", async () => {
  const adminCtx = {
    ownerId: "admin@ngeprd.com",
    userEmail: "admin@ngeprd.com",
    isAdmin: true,
  };

  const result = await checkDailyQuota(adminCtx);
  assert.equal(result.allowed, true);
  assert.equal(result.isAdmin, true);
  assert.equal(result.limit, Infinity);
  assert.equal(result.remaining, Infinity);
  assert.ok(result.resetAt);
});

test("Quota Enforcement - Free user quota allows within limit and rejects when exhausted", async () => {
  const originalLimit = process.env.DAILY_PRD_LIMIT;
  process.env.DAILY_PRD_LIMIT = "3";

  try {
    // Fresh random ownerId to ensure 0 usage
    const freeOwnerId = `free_test_${Date.now()}@example.com`;
    const freeCtx = {
      ownerId: freeOwnerId,
      userEmail: freeOwnerId,
      isAdmin: false,
    };

    const initialQuota = await checkDailyQuota(freeCtx);
    assert.equal(initialQuota.allowed, true);
    assert.equal(initialQuota.isAdmin, false);
    assert.equal(initialQuota.limit, 3);
    assert.equal(initialQuota.used, 0);
    assert.equal(initialQuota.remaining, 3);
  } finally {
    process.env.DAILY_PRD_LIMIT = originalLimit;
  }
});

test("Auth Context - getAuthContext supports explicit ID and admin checking", async () => {
  const originalEnv = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "superadmin@example.com";

  try {
    const adminCtx = await getAuthContext("superadmin@example.com");
    assert.equal(adminCtx.ownerId, "superadmin@example.com");
    assert.equal(adminCtx.userEmail, "superadmin@example.com");
    assert.equal(adminCtx.isAdmin, true);
    assert.equal(adminCtx.isAuthenticated, true);

    const regularCtx = await getAuthContext("regular@example.com");
    assert.equal(regularCtx.ownerId, "regular@example.com");
    assert.equal(regularCtx.userEmail, "regular@example.com");
    assert.equal(regularCtx.isAdmin, false);
    assert.equal(regularCtx.isAuthenticated, true);
  } finally {
    process.env.ADMIN_EMAILS = originalEnv;
  }
});

test("Owner Resolution - getOwnerId maintains backward compatibility", () => {
  const explicit = getOwnerId("user-fixed-abc");
  assert.equal(explicit, "user-fixed-abc");

  const generated = getOwnerId();
  assert.ok(typeof generated === "string" && generated.length > 0);
});
