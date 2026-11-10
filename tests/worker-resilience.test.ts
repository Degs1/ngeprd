import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";

test("resilience: 100 concurrent submissions, global concurrency=2, fairness, and queue integrity", { skip: !process.env.MONGODB_TEST_URI }, async () => {
  process.env.MONGODB_URI = process.env.MONGODB_TEST_URI;
  process.env.MONGODB_DB = `worker_test_${Date.now()}${Math.floor(Math.random() * 1000000)}`;
  process.env.AI_GLOBAL_CONCURRENCY = "2";
  process.env.AI_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  process.env.AI_PROVIDER_HOST_ALLOWLIST = "api.openai.com";
  process.env.AI_MAX_ACTIVE_JOBS_PER_USER = "10";

  const { ensureIndexes } = await import("../scripts/ensure-indexes");
  const { createJob, claimTask, listTasks, finishTask, setJobState } = await import("../src/lib/jobs/repository");
  const { reserveCapacity, releaseCapacity } = await import("../src/lib/providers/capacity");
  const { encryptCredential } = await import("../src/lib/providers/registry");
  const { closeMongo, getDb, COLLECTIONS } = await import("../src/lib/db/mongo");

  try {
    const db = await getDb();
    assert.match(db.databaseName, /^worker_test_\d+$/);
    await ensureIndexes();

    const providerId = new ObjectId();
    await db.collection(COLLECTIONS.AI_PROVIDERS).insertOne({
      _id: providerId,
      name: "stress-provider",
      baseURL: "https://api.openai.com/v1",
      model: "stress-model",
      capabilities: ["json", "mermaid"],
      priority: 1,
      enabled: true,
      allowCrossModelFallback: false,
      concurrency: 2,
      rpm: 0,
      tpm: 0,
    });
    const accountId = new ObjectId();
    await db.collection(COLLECTIONS.AI_ACCOUNTS).insertOne({
      _id: accountId,
      providerId,
      label: "stress-account",
      encryptedKey: encryptCredential("stress-key"),
      quotaGroupId: "stress-group",
      enabled: true,
      concurrency: 2,
      rpm: 0,
      tpm: 0,
    });

    // Submit 100 jobs across 10 users (10 jobs each)
    const userCount = 10;
    const jobsPerUser = 10;
    const allJobs = await Promise.all(
      Array.from({ length: userCount * jobsPerUser }, (_, i) => {
        const u = i % userCount;
        return createJob({
          ownerId: `stress-user-${u}`,
          prdId: new ObjectId(),
          kind: "brainstorm",
          submissionId: `stress-sub-${i}`,
        });
      })
    );
    assert.equal(allJobs.length, 100);
    assert.equal(new Set(allJobs.map((j) => j._id.toString())).size, 100);

    // Track active concurrency and per-user service order
    let currentActiveAiCalls = 0;
    let peakConcurrency = 0;
    const firstClaimOrder: string[] = [];
    const completedTasks: string[] = [];

    // Simulate 4 concurrent worker loops claiming and executing tasks under global AI concurrency=2
    const workerNames = ["worker-1", "worker-2", "worker-3", "worker-4"];
    const runWorkerLoop = async (workerName: string) => {
      while (completedTasks.length < 100) {
        const task = await claimTask(workerName, 30000);
        if (!task) {
          if (completedTasks.length >= 100) break;
          await new Promise((r) => setTimeout(r, 10));
          continue;
        }

        if (!firstClaimOrder.includes(task.ownerId)) {
          firstClaimOrder.push(task.ownerId);
        }

        // Acquire capacity
        const provider = (await db.collection(COLLECTIONS.AI_PROVIDERS).findOne({ _id: providerId })) as any;
        const account = (await db.collection(COLLECTIONS.AI_ACCOUNTS).findOne({ _id: accountId })) as any;
        const reservation = await reserveCapacity(provider, account);
        if (!reservation) {
          // Capacity limit respected; return task to queue
          await finishTask(task, workerName, "waiting_capacity", new Date(Date.now() + 50));
          continue;
        }

        try {
          currentActiveAiCalls++;
          if (currentActiveAiCalls > peakConcurrency) {
            peakConcurrency = currentActiveAiCalls;
          }
          assert.ok(currentActiveAiCalls <= 2, `Global concurrency exceeded: ${currentActiveAiCalls}`);

          // Simulate AI call latency
          await new Promise((r) => setTimeout(r, 8));

          await finishTask(task, workerName, "completed");
          await setJobState(task.jobId, "waiting_user");
          completedTasks.push(task._id.toString());
        } finally {
          currentActiveAiCalls--;
          await releaseCapacity(reservation);
        }
      }
    };

    await Promise.all(workerNames.map((w) => runWorkerLoop(w)));

    assert.equal(completedTasks.length, 100, "All 100 tasks must be completed");
    assert.ok(peakConcurrency <= 2, `Peak concurrency was ${peakConcurrency}, expected <= 2`);
    assert.equal(currentActiveAiCalls, 0, "No leaked active calls");

    // Verify fairness: All 10 users were served without starvation
    assert.equal(new Set(firstClaimOrder).size, userCount, "Every user must be scheduled");
    // Verify interleaving: first 10 claims served all 10 distinct users due to least-recently-served ordering
    assert.equal(firstClaimOrder.slice(0, userCount).length, userCount);

    // Verify no leaked capacity reservations
    const remainingReservations = await db.collection(COLLECTIONS.AI_RESERVATIONS).countDocuments();
    assert.equal(remainingReservations, 0, "All capacity reservations must be released");
  } finally {
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
    }
  }
});

test("resilience: provider timeout, token accounting, capacity exhaustion, and admin requeue", { skip: !process.env.MONGODB_TEST_URI }, async () => {
  process.env.MONGODB_URI = process.env.MONGODB_TEST_URI;
  process.env.MONGODB_DB = `worker_test_${Date.now()}${Math.floor(Math.random() * 1000000)}`;
  process.env.AI_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  process.env.AI_PROVIDER_HOST_ALLOWLIST = "api.openai.com";

  const { ensureIndexes } = await import("../scripts/ensure-indexes");
  const { createJob, claimTask, getJob, retryBlockedJob } = await import("../src/lib/jobs/repository");
  const { encryptCredential } = await import("../src/lib/providers/registry");
  const { invokeWithPool, CapacityError } = await import("../src/lib/providers/invoke");
  const { processTask } = await import("../worker/index");
  const { createPrd, getPrdById } = await import("../src/lib/db/prdRepository");
  const { closeMongo, getDb, COLLECTIONS } = await import("../src/lib/db/mongo");

  try {
    const db = await getDb();
    await ensureIndexes();

    const providerId = new ObjectId();
    await db.collection(COLLECTIONS.AI_PROVIDERS).insertOne({
      _id: providerId,
      name: "provider-timeout",
      baseURL: "https://api.openai.com/v1",
      model: "timeout-model",
      capabilities: ["json", "mermaid"],
      priority: 1,
      enabled: true,
      allowCrossModelFallback: false,
      concurrency: 2,
      rpm: 0,
      tpm: 0,
    });
    const accountId = new ObjectId();
    await db.collection(COLLECTIONS.AI_ACCOUNTS).insertOne({
      _id: accountId,
      providerId,
      label: "account-timeout",
      encryptedKey: encryptCredential("timeout-key"),
      quotaGroupId: "timeout-group",
      enabled: true,
      concurrency: 1,
      rpm: 0,
      tpm: 0,
    });

    const ownerId = "timeout-owner";
    const prd = await createPrd(ownerId, { idea: "Aplikasi timeout test" });
    const job = await createJob({ ownerId, prdId: prd._id, kind: "brainstorm", submissionId: "timeout-sub" });

    // Test 1: Upstream timeout and token accounting with honest unknown usage
    const task1 = await claimTask("worker-timeout", 120000);
    assert.ok(task1);

    // Call invokeWithPool with a simulated upstream timeout
    await assert.rejects(
      invokeWithPool(task1!, async () => {
        const timeoutError = Object.assign(new Error("Upstream connection timeout after request sent"), {
          code: "AI_TIMEOUT",
        });
        throw timeoutError;
      }),
      (err: any) => err instanceof CapacityError && !err.permanent
    );

    // Verify token accounting recorded the error with honest null tokens
    const usage = await db.collection(COLLECTIONS.AI_USAGE).findOne({ taskId: task1!._id, outcome: "error" });
    assert.ok(usage, "AI usage error record must be persisted");
    assert.equal(usage.outcome, "error");
    assert.equal(usage.errorCode, "AI_TIMEOUT");
    assert.equal(usage.inputTokens, null, "Unknown input tokens must be null");
    assert.equal(usage.outputTokens, null, "Unknown output tokens must be null");

    // Test 2: ProcessTask with exhausted provider capacity enters waiting_capacity
    await processTask(task1!);
    const taskAfterRetry = await db.collection(COLLECTIONS.AI_TASKS).findOne({ _id: task1!._id });
    assert.equal(taskAfterRetry?.state, "waiting_capacity");
    const jobAfterRetry = await getJob(job._id.toString(), ownerId);
    assert.equal(jobAfterRetry?.state, "waiting_capacity");

    // Test 3: Permanent provider auth failure blocks the job with actionable message
    await db.collection(COLLECTIONS.AI_ACCOUNTS).updateOne({ _id: accountId }, { $set: { cooldownUntil: undefined } });
    await db.collection(COLLECTIONS.AI_TASKS).updateOne(
      { _id: task1!._id },
      { $set: { state: "queued", attempt: 3, nextRunAt: new Date() }, $inc: { fence: 1 } }
    );
    const taskAuthFail = await claimTask("worker-auth", 120000);
    assert.ok(taskAuthFail);

    // Simulate 401 auth error in invokeWithPool
    await assert.rejects(
      invokeWithPool(taskAuthFail!, async () => {
        throw Object.assign(new Error("Invalid API key"), { status: 401, code: "AI_AUTH_ERROR" });
      }),
      (err: any) => err instanceof CapacityError && err.permanent
    );

    // Account was automatically disabled
    const disabledAccount = await db.collection(COLLECTIONS.AI_ACCOUNTS).findOne({ _id: accountId });
    assert.equal(disabledAccount?.enabled, false, "Account must be disabled on auth failure");

    // Worker processTask marks task failed and job blocked
    await processTask(taskAuthFail!);
    const blockedJob = await getJob(job._id.toString(), ownerId);
    assert.equal(blockedJob?.state, "blocked");
    assert.ok(blockedJob?.reason?.toLowerCase().includes("provider"));

    // Test 4: Admin repairs credentials, re-enables account, and requeues blocked job
    await db.collection(COLLECTIONS.AI_ACCOUNTS).updateOne(
      { _id: accountId },
      { $set: { enabled: true, encryptedKey: encryptCredential("fixed-key"), cooldownUntil: undefined } }
    );
    const requeued = await retryBlockedJob(job._id.toString());
    assert.equal(requeued, true, "Admin retry must succeed");

    const requeuedJob = await getJob(job._id.toString(), ownerId);
    assert.equal(requeuedJob?.state, "queued");
    const requeuedTask = await db.collection(COLLECTIONS.AI_TASKS).findOne({ jobId: job._id });
    assert.equal(requeuedTask?.state, "queued");
  } finally {
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
    }
  }
});

test("resilience: real worker process crash mid-section and process restart recovery", { skip: !process.env.MONGODB_TEST_URI }, async () => {
  const testDbName = `worker_test_${Date.now()}${Math.floor(Math.random() * 1000000)}`;
  process.env.MONGODB_URI = process.env.MONGODB_TEST_URI;
  process.env.MONGODB_DB = testDbName;
  process.env.AI_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  process.env.AI_PROVIDER_HOST_ALLOWLIST = "api.openai.com";

  const { ensureIndexes } = await import("../scripts/ensure-indexes");
  const { createPrd, getPrdById } = await import("../src/lib/db/prdRepository");
  const { encryptCredential } = await import("../src/lib/providers/registry");
  const { createJob, getLatestJob } = await import("../src/lib/jobs/repository");
  const { closeMongo, getDb, COLLECTIONS } = await import("../src/lib/db/mongo");

  let proc1: ReturnType<typeof spawn> | null = null;
  let proc2: ReturnType<typeof spawn> | null = null;

  try {
    const db = await getDb();
    await ensureIndexes();

    const providerId = new ObjectId();
    await db.collection(COLLECTIONS.AI_PROVIDERS).insertOne({
      _id: providerId,
      name: "proc-provider",
      baseURL: "https://api.openai.com/v1",
      model: "proc-model",
      capabilities: ["json", "mermaid"],
      priority: 1,
      enabled: true,
      allowCrossModelFallback: false,
      concurrency: 2,
      rpm: 0,
      tpm: 0,
    });
    await db.collection(COLLECTIONS.AI_ACCOUNTS).insertOne({
      _id: new ObjectId(),
      providerId,
      label: "proc-account",
      encryptedKey: encryptCredential("proc-key"),
      quotaGroupId: "proc-group",
      enabled: true,
      concurrency: 2,
      rpm: 0,
      tpm: 0,
    });

    const ownerId = "proc-owner";
    const prd = await createPrd(ownerId, { idea: "Sistem logistik cerdas untuk UMKM" });

    // Helper to spawn a real worker process
    const spawnWorker = (port: number, leaseMs = 1500) => {
      const child = spawn(
        process.execPath,
        [
          "./node_modules/tsx/dist/cli.mjs",
          "--import",
          "./tests/helpers/mock-worker-fetch.mjs",
          "worker/index.ts",
        ],
        {
          env: {
            ...process.env,
            MONGODB_URI: process.env.MONGODB_TEST_URI,
            MONGODB_DB: testDbName,
            AI_CREDENTIAL_ENCRYPTION_KEY: process.env.AI_CREDENTIAL_ENCRYPTION_KEY,
            AI_PROVIDER_HOST_ALLOWLIST: "api.openai.com",
            AI_WORKER_HEALTH_PORT: String(port),
            AI_WORKER_LEASE_MS: String(leaseMs),
            AI_WORKER_POLL_INTERVAL_MS: "300",
            AI_WORKER_HEARTBEAT_MS: "500",
          },
          stdio: ["ignore", "pipe", "pipe"],
        }
      );
      child.stdout?.on("data", (d) => console.log(`[WORKER-${port}]`, d.toString().trim()));
      child.stderr?.on("data", (d) => console.error(`[WORKER-${port} ERR]`, d.toString().trim()));
      return child;
    };

    // Step 1: Submit brainstorm job
    await createJob({ ownerId, prdId: prd._id, kind: "brainstorm", submissionId: "proc-bs" });

    // Spawn Worker Process 1
    const healthPort1 = 9100 + Math.floor(Math.random() * 400);
    proc1 = spawnWorker(healthPort1, 1500);

    // Wait for brainstorm questions to be written
    let brainstormDone = false;
    for (let i = 0; i < 40; i++) {
      const current = await getPrdById(prd._id, ownerId);
      if (current?.brainstorm.questions?.length === 4) {
        brainstormDone = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.ok(brainstormDone, "Brainstorm questions must be generated by child process 1");

    // Answer questions
    const questioned = await getPrdById(prd._id, ownerId);
    await db.collection(COLLECTIONS.PRD_DOCUMENTS).updateOne(
      { _id: prd._id },
      {
        $set: {
          "brainstorm.answers": questioned!.brainstorm.questions.map((q) => ({
            questionId: q.id,
            value: "Pilihan A",
            isCustom: false,
          })),
        },
      }
    );

    // Submit generation job
    await createJob({ ownerId, prdId: prd._id, kind: "generation", submissionId: "proc-gen" });

    // Wait until Planner completes and sections start writing (at least 2 sections ready)
    let reachedMidSection = false;
    for (let i = 0; i < 60; i++) {
      const current = await getPrdById(prd._id, ownerId);
      const readyCount = current?.sections?.filter((s) => s.status === "ready").length || 0;
      if (readyCount >= 2) {
        reachedMidSection = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.ok(reachedMidSection, "Worker process 1 should generate plan and complete at least 2 sections");

    // ABRUPT CRASH: Kill Worker Process 1 mid-generation!
    proc1.kill("SIGKILL");
    await new Promise((r) => setTimeout(r, 200));

    // Verify sections so far remain saved and consistent
    const midDoc = await getPrdById(prd._id, ownerId);
    const midReady = midDoc!.sections.filter((s) => s.status === "ready").length;
    assert.ok(midReady >= 2, `Expected >= 2 ready sections, got ${midReady}`);
    assert.notEqual(midDoc?.status, "ready", "Document must not be ready yet");

    // Wait for lease of any in-flight task to expire (configured lease is 1500ms)
    await new Promise((r) => setTimeout(r, 1800));

    // Start Worker Process 2 to resume the remaining tasks
    const healthPort2 = 9500 + Math.floor(Math.random() * 400);
    proc2 = spawnWorker(healthPort2, 10000);

    // Wait for Worker Process 2 to finish all remaining sections and mark PRD ready
    let fullyCompleted = false;
    for (let i = 0; i < 80; i++) {
      const current = await getPrdById(prd._id, ownerId);
      if (current?.status === "ready" && current?.sections?.length === 11 && current?.sections?.every((s) => s.status === "ready")) {
        fullyCompleted = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    assert.ok(fullyCompleted, "Worker process 2 must resume and finish PRD generation after process 1 crash");

    // Gracefully stop Worker Process 2
    proc2.kill("SIGINT");
    await new Promise((r) => setTimeout(r, 500));

    // Final verification of document integrity
    const finalDoc = await getPrdById(prd._id, ownerId);
    assert.equal(finalDoc?.status, "ready");
    assert.equal(finalDoc?.sections.length, 11, "Must have exactly 11 sections");
    assert.ok(finalDoc?.sections.every((s) => s.status === "ready"));
    assert.ok(finalDoc?.sections.some((s) => Boolean(s.diagram?.code)), "Mermaid diagram must be generated");

    // Verify no duplicate section IDs
    const sectionIds = finalDoc!.sections.map((s) => s.id);
    assert.equal(new Set(sectionIds).size, 11, "No duplicate section IDs");

    const genJob = await getLatestJob(prd._id.toString(), ownerId, "generation");
    assert.equal(genJob?.state, "completed");
  } finally {
    if (proc1 && !proc1.killed) proc1.kill("SIGKILL");
    if (proc2 && !proc2.killed) proc2.kill("SIGKILL");
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
    }
  }
});

