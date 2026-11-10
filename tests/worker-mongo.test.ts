import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";

test("Mongo jobs: claims, fencing, cancellation, shared quotas, and provider fallback", { skip: !process.env.MONGODB_TEST_URI }, async () => {
  process.env.MONGODB_URI = process.env.MONGODB_TEST_URI;
  process.env.MONGODB_DB = `worker_test_${Date.now()}${Math.floor(Math.random() * 1000000)}`;
  process.env.AI_GLOBAL_CONCURRENCY = "2";
  const { ensureIndexes } = await import("../scripts/ensure-indexes");
  const { createJob, claimTask, commitCheckpoint, cancelJob } = await import("../src/lib/jobs/repository");
  const { reserveCapacity, releaseCapacity } = await import("../src/lib/providers/capacity");
  const { encryptCredential } = await import("../src/lib/providers/registry");
  const { CapacityError, invokeWithPool } = await import("../src/lib/providers/invoke");
  const { closeMongo, getDb, COLLECTIONS } = await import("../src/lib/db/mongo");
  try {
    const db = await getDb();
    assert.match(db.databaseName, /^worker_test_\d+$/, "refusing to write to a non-test database");
    assert.equal(process.env.MONGODB_URI, process.env.MONGODB_TEST_URI);
    await ensureIndexes();
    const jobs = await Promise.all(Array.from({ length: 100 }, (_, i) => createJob({
      ownerId: `user-${i}`, prdId: new ObjectId(), kind: "brainstorm", submissionId: `submit-${i}`,
    })));
    assert.equal(new Set(jobs.map((j) => j._id.toString())).size, 100);
    console.log("mongo-test: submissions persisted");
    const repeated = await createJob({ ownerId: "user-0", prdId: jobs[0].prdId, kind: "brainstorm", submissionId: "submit-0" });
    assert.equal(repeated._id.toString(), jobs[0]._id.toString());
    const claims = await Promise.all([claimTask("worker-a", 5), claimTask("worker-b", 5)]);
    assert.equal(claims.filter(Boolean).length, 2);
    assert.notEqual(claims[0]!._id.toString(), claims[1]!._id.toString());
    await db.collection(COLLECTIONS.AI_TASKS).updateMany({ _id: { $nin: claims.map((c) => c!._id) } },
      { $set: { state: "cancelled" } });
    await new Promise((resolve) => setTimeout(resolve, 15));
    const renewed = await claimTask("worker-c", 120000);
    assert.ok(renewed);
    const oldClaim = claims.find((c) => c!._id.equals(renewed!._id));
    assert.ok(oldClaim, "expected an expired task to be reclaimed");
    assert.ok(renewed!.fence > oldClaim!.fence);
    assert.equal(await commitCheckpoint(oldClaim!, oldClaim!.leaseOwner!, async () => true), false);
    assert.equal(await cancelJob(renewed!.prdId.toString(), renewed!.ownerId), true);
    const cancelled = await db.collection(COLLECTIONS.AI_TASKS).findOne({ _id: renewed!._id });
    assert.equal(cancelled?.state, "cancelled");
    console.log("mongo-test: claims, fencing, cancellation verified");
    const provider = { _id: new ObjectId(), concurrency: 100, rpm: 0, tpm: 0 } as any;
    const account = { _id: new ObjectId(), quotaGroupId: "one-upstream-project", concurrency: 100, rpm: 0, tpm: 0 } as any;
    const reservations = await Promise.all(Array.from({ length: 100 }, () => reserveCapacity(provider, account)));
    const granted = reservations.filter((r) => r !== null);
    assert.ok(granted.length <= 2, `global concurrency exceeded: ${granted.length}`);
    assert.ok(granted.length >= 1);
    await Promise.all(granted.map((r) => releaseCapacity(r!)));
    console.log("mongo-test: global capacity verified");

    process.env.AI_GLOBAL_CONCURRENCY = "4";
    const sharedProviderIds = [new ObjectId(), new ObjectId()];
    await db.collection(COLLECTIONS.AI_PROVIDERS).insertMany(sharedProviderIds.map((_id) => ({
      _id, enabled: true, capabilities: [], concurrency: 2, rpm: 0, tpm: 0,
    })));
    const sharedAccounts = Array.from({ length: 3 }, (_, index) => ({ _id: new ObjectId(),
      providerId: sharedProviderIds[index % 2], quotaGroupId: "shared-project", enabled: true,
      concurrency: 1, rpm: 0, tpm: 0 }));
    await db.collection(COLLECTIONS.AI_ACCOUNTS).insertMany(sharedAccounts);
    const sharedReservations = await Promise.all(sharedAccounts.map((a) => reserveCapacity(
      { _id: a.providerId, concurrency: 2, rpm: 0, tpm: 0 } as any, a as any)));
    const sharedGranted = sharedReservations.filter(Boolean);
    assert.ok(sharedGranted.length <= 2, `shared quota group exceeded: ${sharedGranted.length}`);
    assert.ok(sharedGranted.length >= 1);
    await Promise.all(sharedGranted.map((r) => releaseCapacity(r!)));
    console.log("mongo-test: shared quota verified");

    process.env.AI_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    process.env.AI_PROVIDER_HOST_ALLOWLIST = "api.openai.com";
    const fallbackJob = await createJob({ ownerId: "fallback-user", prdId: new ObjectId(),
      kind: "brainstorm", submissionId: "fallback-submit" });
    await db.collection(COLLECTIONS.AI_TASKS).updateMany({ jobId: { $ne: fallbackJob._id } },
      { $set: { state: "cancelled" }, $inc: { fence: 1 } });
    const fallbackTask = await claimTask("fallback-worker", 120000);
    assert.ok(fallbackTask);
    assert.equal(fallbackTask!.jobId.toString(), fallbackJob._id.toString());
    const fallbackProviders = [new ObjectId(), new ObjectId()];
    await db.collection(COLLECTIONS.AI_PROVIDERS).insertMany(fallbackProviders.map((_id, priority) => ({
      _id, name: `fallback-${priority}`, baseURL: "https://api.openai.com/v1", model: "test-model",
      capabilities: ["json", "mermaid"], priority, enabled: true, allowCrossModelFallback: false,
      concurrency: 2, rpm: 0, tpm: 0,
    })));
    const fallbackAccountIds = [new ObjectId(), new ObjectId()];
    await db.collection(COLLECTIONS.AI_ACCOUNTS).insertMany(fallbackProviders.map((providerId, index) => ({
      _id: fallbackAccountIds[index], providerId, label: `account-${index}`,
      encryptedKey: encryptCredential(`test-key-${index}`), quotaGroupId: `fallback-group-${index}`,
      enabled: true, concurrency: 1, rpm: 0, tpm: 0,
    })));
    let mockCalls = 0;
    const fallbackResult = await invokeWithPool(fallbackTask!, async () => {
      mockCalls++;
      if (mockCalls === 1) throw Object.assign(new Error("rate limited"), { status: 429 });
      return "fallback-ok";
    });
    assert.equal(fallbackResult, "fallback-ok");
    assert.equal(mockCalls, 2);
    console.log("mongo-test: provider fallback verified");
    await db.collection(COLLECTIONS.AI_ACCOUNTS).updateMany({ _id: { $in: fallbackAccountIds } },
      { $set: { cooldownUntil: new Date(Date.now() + 60000) } });
    await assert.rejects(invokeWithPool(fallbackTask!, async () => "unexpected"),
      (error: unknown) => error instanceof CapacityError && !error.permanent);
    await db.collection(COLLECTIONS.AI_ACCOUNTS).updateMany({ _id: { $in: fallbackAccountIds } },
      { $set: { enabled: false } });
    await assert.rejects(invokeWithPool(fallbackTask!, async () => "unexpected"),
      (error: unknown) => error instanceof CapacityError && error.permanent);
    console.log("mongo-test: provider exhaustion verified");

    const routePrdId = new ObjectId();
    await db.collection(COLLECTIONS.PRD_DOCUMENTS).insertOne({ _id: routePrdId, ownerId: "route-owner", sections: [] });
    const { POST: changeSetPost } = await import("../src/app/api/prds/[id]/changesets/route");
    const { POST: repairPost } = await import("../src/app/api/prds/[id]/sections/[sectionId]/repair-diagram/route");
    const routeUrl = `http://localhost/api/prds/${routePrdId}`;
    const authorized = new NextRequest(routeUrl, { method: "POST", headers: { "x-owner-id": "route-owner" } });
    assert.equal((await changeSetPost(authorized, { params: { id: routePrdId.toString() } })).status, 410);
    assert.equal((await repairPost(authorized, { params: { id: routePrdId.toString() } })).status, 410);
    const otherOwner = new NextRequest(routeUrl, { method: "POST", headers: { "x-owner-id": "another-owner" } });
    assert.equal((await changeSetPost(otherOwner, { params: { id: routePrdId.toString() } })).status, 404);
    console.log("mongo-test: retired AI routes verified");
  } finally {
    console.log("mongo-test: cleanup started");
    try {
      const db = await getDb();
      if (/^worker_test_\d+$/.test(db.databaseName) && process.env.MONGODB_URI === process.env.MONGODB_TEST_URI &&
        process.env.MONGODB_TEST_KEEP_DB !== "true") {
        try { await db.dropDatabase(); }
        catch (error: any) {
          if (error?.code === 8000 || /not allowed.*dropDatabase/i.test(String(error?.message))) {
            const cols = await db.listCollections().toArray();
            for (const c of cols) {
              await db.collection(c.name).drop().catch(() => {});
            }
          } else {
            throw error;
          }
        }
      }
    } finally {
      await closeMongo();
      console.log("mongo-test: cleanup finished");
    }
  }
});
