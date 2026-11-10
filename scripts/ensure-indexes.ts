import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Auto-load .env.worker, .env.local, or .env if MONGODB_URI is not already provided
if (!process.env.MONGODB_URI && typeof process.loadEnvFile === "function") {
  for (const file of [".env.worker", ".env.local", ".env"]) {
    const fullPath = resolve(process.cwd(), file);
    if (existsSync(fullPath)) {
      try {
        process.loadEnvFile(fullPath);
        if (process.env.MONGODB_URI) break;
      } catch {}
    }
  }
}

import { getDb, closeMongo, COLLECTIONS } from "../src/lib/db/mongo";

export async function ensureIndexes(): Promise<void> {
  const db = await getDb();
  console.log(`Setting up MongoDB indexes for ${db.databaseName}...`);

  const prdCol = db.collection(COLLECTIONS.PRD_DOCUMENTS);
  const prdIndexName = await prdCol.createIndex(
    { ownerId: 1, updatedAt: -1 },
    { name: "owner_updated_idx" }
  );
  console.log(`Created index on ${COLLECTIONS.PRD_DOCUMENTS}: ${prdIndexName}`);

  const csCol = db.collection(COLLECTIONS.PRD_CHANGESETS);
  const csIndexName = await csCol.createIndex(
    { ownerId: 1, docId: 1, createdAt: -1 },
    { name: "owner_doc_created_idx" }
  );
  console.log(`Created index on ${COLLECTIONS.PRD_CHANGESETS}: ${csIndexName}`);

  const jobs = db.collection(COLLECTIONS.AI_JOBS);
  await jobs.createIndex({ ownerId: 1, submissionId: 1 }, { unique: true, name: "submission_unique" });
  await jobs.createIndex({ prdId: 1, ownerId: 1, createdAt: -1 }, { name: "prd_jobs" });
  await jobs.createIndex({ ownerId: 1, state: 1 }, { name: "owner_active" });
  await jobs.createIndex({ activeOwnerId: 1 }, { unique: true, partialFilterExpression: { activeOwnerId: { $exists: true } }, name: "one_active_job_per_owner" });
  const tasks = db.collection(COLLECTIONS.AI_TASKS);
  await tasks.createIndex({ jobId: 1, key: 1 }, { unique: true, name: "task_unique" });
  await tasks.createIndex({ state: 1, nextRunAt: 1, createdAt: 1 }, { name: "task_eligibility" });
  await tasks.createIndex({ state: 1, leaseUntil: 1 }, { name: "task_recovery" });
  await tasks.createIndex({ ownerId: 1, state: 1, updatedAt: -1 }, { name: "task_fairness" });
  await db.collection(COLLECTIONS.AI_EVENTS).createIndex({ jobId: 1, seq: 1 }, { unique: true, name: "job_event_seq" });
  await db.collection(COLLECTIONS.AI_EVENTS).createIndex({ createdAt: 1 }, { expireAfterSeconds: 604800, name: "event_ttl" });
  await db.collection(COLLECTIONS.AI_PROVIDERS).createIndex({ enabled: 1, priority: 1 }, { name: "provider_selection" });
  await db.collection(COLLECTIONS.AI_ACCOUNTS).createIndex({ providerId: 1, enabled: 1 }, { name: "provider_accounts" });
  await db.collection(COLLECTIONS.AI_RESERVATIONS).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "reservation_ttl" });
  await db.collection(COLLECTIONS.AI_USAGE).createIndex({ prdId: 1, stage: 1, createdAt: -1 }, { name: "usage_prd_stage" });
  await db.collection(COLLECTIONS.AI_RATE_BUCKETS).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "rate_bucket_ttl" });
  await db.collection("edit_rate_buckets").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "edit_rate_ttl" });

  console.log("MongoDB indexes verified successfully.");
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith("ensure-indexes.ts") ||
    process.argv[1].endsWith("ensure-indexes.js"))
) {
  ensureIndexes()
    .then(async () => {
      await closeMongo();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Failed to ensure indexes:", err);
      await closeMongo();
      process.exit(1);
    });
}
