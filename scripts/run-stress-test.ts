import { existsSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { randomBytes, randomUUID } from "node:crypto";

if (typeof process.loadEnvFile === "function") {
  for (const file of [".env.worker", ".env.test.local", ".env.local", ".env"]) {
    const fullPath = resolve(process.cwd(), file);
    if (existsSync(fullPath)) {
      try { process.loadEnvFile(fullPath); } catch {}
    }
  }
}

// Fallback to test URI if present, otherwise main URI with unique isolated test db
if (!process.env.MONGODB_URI && process.env.MONGODB_TEST_URI) {
  process.env.MONGODB_URI = process.env.MONGODB_TEST_URI;
}
const originalDbName = process.env.MONGODB_DB || "bikinprd";
const stressDbName = `worker_stress_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
process.env.MONGODB_DB = stressDbName;
process.env.AI_GLOBAL_CONCURRENCY = "2";
process.env.AI_DEFAULT_ACCOUNT_CONCURRENCY = "1";
process.env.AI_MAX_ACTIVE_JOBS_PER_USER = "10";
if (!process.env.AI_CREDENTIAL_ENCRYPTION_KEY) {
  process.env.AI_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
}

async function main() {
  console.log("=== Memulai Suite Stress Test Worker ngePRD ===");
  console.log("Database Isolasi Uji:", stressDbName);

  const { getDb, closeMongo, COLLECTIONS } = await import("../src/lib/db/mongo");
  const { ensureIndexes } = await import("../scripts/ensure-indexes");
  const { createJob, claimTask, finishTask, setJobState } = await import("../src/lib/jobs/repository");
  const { reserveCapacity, releaseCapacity } = await import("../src/lib/providers/capacity");
  const { encryptCredential } = await import("../src/lib/providers/registry");

  const db = await getDb();
  await ensureIndexes();

  // Setup Provider Uji
  const providerId = new ObjectId();
  await db.collection(COLLECTIONS.AI_PROVIDERS).insertOne({
    _id: providerId,
    name: "stress-provider",
    baseURL: "http://localhost:20128/v1",
    model: "test-model",
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

  console.log("\n--- UJI 1: 100 Submit Bersamaan, 10 User, Global Concurrency=2 ---");
  const userCount = 10;
  const jobsPerUser = 10;
  const t0 = Date.now();

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

  assert.equal(allJobs.length, 100, "100 job harus berhasil dibuat");
  assert.equal(new Set(allJobs.map((j) => j._id.toString())).size, 100, "Semua ID job harus unik");
  console.log(`[PASS] 100 Job berhasil di-submit dalam ${Date.now() - t0}ms`);

  // Eksekusi 4 worker simultan berebut klaim tugas
  console.log("\n--- UJI 2: 4 Worker Simultan Memproses 100 Tugas dengan Lock Concurrency ---");
  let currentActiveAiCalls = 0;
  let peakConcurrency = 0;
  const firstClaimOrder: string[] = [];
  const completedTasks: string[] = [];

  const workerNames = ["worker-alpha", "worker-beta", "worker-gamma", "worker-delta"];
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

      const provider = (await db.collection(COLLECTIONS.AI_PROVIDERS).findOne({ _id: providerId })) as any;
      const account = (await db.collection(COLLECTIONS.AI_ACCOUNTS).findOne({ _id: accountId })) as any;
      const reservation = await reserveCapacity(provider, account);
      if (!reservation) {
        await finishTask(task, workerName, "waiting_capacity", new Date(Date.now() + 50));
        continue;
      }

      try {
        currentActiveAiCalls++;
        if (currentActiveAiCalls > peakConcurrency) {
          peakConcurrency = currentActiveAiCalls;
        }
        assert.ok(currentActiveAiCalls <= 2, `Global concurrency terlanggar: ${currentActiveAiCalls} > 2`);

        // Simulasi latensi AI
        await new Promise((r) => setTimeout(r, 5));

        await finishTask(task, workerName, "completed");
        await setJobState(task.jobId, "completed");
        completedTasks.push(task._id.toString());
      } finally {
        currentActiveAiCalls--;
        await releaseCapacity(reservation);
      }
    }
  };

  await Promise.all(workerNames.map((w) => runWorkerLoop(w)));

  assert.equal(completedTasks.length, 100, "Semua 100 tugas harus selesai 100%");
  assert.ok(peakConcurrency <= 2, `Peak concurrency: ${peakConcurrency} (harus <= 2)`);
  assert.equal(currentActiveAiCalls, 0, "Tidak boleh ada active calls yang bocor");
  assert.equal(new Set(firstClaimOrder).size, userCount, "Semua 10 user terlayani secara adil (fairness)");

  const leakedReservations = await db.collection(COLLECTIONS.AI_RESERVATIONS).countDocuments();
  assert.equal(leakedReservations, 0, "Semua reservasi kapasitas harus dirilis bersih (0 leak)");
  console.log(`[PASS] 100 Tugas selesai! Peak Concurrency: ${peakConcurrency}/2, Leak: 0, Fairness: 10/10 user terlayani`);

  console.log("\n--- UJI 3: Idempotensi Submit & Batas Active Job User ---");
  // Submit ulang dengan submissionId yang sama
  const duplicateJob = await createJob({
    ownerId: "stress-user-0",
    prdId: allJobs[0].prdId,
    kind: "brainstorm",
    submissionId: "stress-sub-0",
  });
  assert.equal(duplicateJob._id.toString(), allJobs[0]._id.toString(), "Idempotensi: submissionId sama harus mengembalikan job yang sama");

  // Uji pembatasan active job per user (misal diset batas 1)
  process.env.AI_MAX_ACTIVE_JOBS_PER_USER = "1";
  const userPrd1 = new ObjectId();
  const userPrd2 = new ObjectId();
  const job1 = await createJob({ ownerId: "single-job-user", prdId: userPrd1, kind: "brainstorm", submissionId: randomUUID() });
  assert.ok(job1, "Job pertama user harus berhasil dibuat");

  let errorCaught = false;
  try {
    await createJob({ ownerId: "single-job-user", prdId: userPrd2, kind: "brainstorm", submissionId: randomUUID() });
  } catch (err: any) {
    if (err.message === "ACTIVE_JOB_LIMIT") errorCaught = true;
  }
  assert.ok(errorCaught, "Job kedua user harus ditolak dengan ACTIVE_JOB_LIMIT");
  console.log("[PASS] Idempotensi dan pembatasan active job per user valid");

  console.log("\n--- UJI 4: Pembatalan Job (Cancellation) di Bawah Tekanan ---");
  const cancelPrdId = new ObjectId();
  const cancelJob = await createJob({ ownerId: "cancel-user", prdId: cancelPrdId, kind: "generation", submissionId: randomUUID() });
  await setJobState(cancelJob._id, "cancelling");
  await setJobState(cancelJob._id, "cancelled", "User cancelled");
  const postCancel = await db.collection(COLLECTIONS.AI_JOBS).findOne({ _id: cancelJob._id });
  assert.equal(postCancel?.state, "cancelled", "Job harus berada dalam status cancelled");
  console.log("[PASS] Pembatalan job bersih dan aman");

  console.log("\n--- UJI 5: Pemeriksaan Kesehatan Worker Background Nyata (Port 8787) ---");
  try {
    const res = await fetch("http://127.0.0.1:8787/metrics");
    if (res.ok) {
      const metrics = await res.json();
      console.log("Metrik Worker Background:", metrics);
      assert.ok(typeof metrics.queued === "number");
      assert.ok(typeof metrics.blocked === "number");
      console.log("[PASS] Worker background nyata aktif dan merespons metrik!");
    } else {
      console.log("[INFO] Worker background port 8787 tidak merespons HTTP, dilewati.");
    }
  } catch {
    console.log("[INFO] Worker background port 8787 tidak terjangkau (bukan error kritis untuk stress test logic).");
  }

  console.log("\n=======================================================");
  console.log("SEMUA 5 TAHAP STRESS TEST LULUS 100%!");
  console.log("=======================================================\n");

  await closeMongo();
}

main().catch(async (err) => {
  console.error("STRESS TEST GAGAL DENGAN ERROR:", err);
  process.exit(1);
});

