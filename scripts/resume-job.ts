import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ObjectId } from "mongodb";

if (typeof process.loadEnvFile === "function") {
  for (const file of [".env.local", ".env.worker", ".env"]) {
    const fullPath = resolve(process.cwd(), file);
    if (existsSync(fullPath)) {
      try { process.loadEnvFile(fullPath); } catch {}
    }
  }
}

import { getDb, closeMongo, COLLECTIONS } from "../src/lib/db/mongo";

async function main() {
  const db = await getDb();
  console.log(`Connected to database: ${db.databaseName}`);

  // 1. Re-enable all AI accounts
  const accResult = await db.collection(COLLECTIONS.AI_ACCOUNTS).updateMany(
    {},
    { $set: { enabled: true, failureCount: 0 }, $unset: { cooldownUntil: "" } }
  );
  console.log(`Re-enabled accounts: ${accResult.modifiedCount} accounts updated.`);

  // 2. Find blocked or waiting jobs
  const blockedJobs = await db.collection(COLLECTIONS.AI_JOBS).find({
    state: { $in: ["blocked", "waiting_capacity", "retry_scheduled"] },
  }).toArray();

  if (!blockedJobs.length) {
    console.log("No blocked or waiting jobs found.");
    await closeMongo();
    return;
  }

  for (const job of blockedJobs) {
    console.log(`\nResuming Job: ${job._id} (kind: ${job.kind}, stage: ${job.stage})`);

    // Reset failed or waiting tasks to queued
    const taskResult = await db.collection(COLLECTIONS.AI_TASKS).updateMany(
      { jobId: job._id, state: { $in: ["failed", "waiting_capacity", "retry_scheduled", "leased"] } },
      {
        $set: { state: "queued", attempt: 0, nextRunAt: new Date(), updatedAt: new Date() },
        $inc: { fence: 1 },
        $unset: { leaseOwner: "", leaseUntil: "" },
      }
    );
    console.log(`  - Reset ${taskResult.modifiedCount} tasks to queued.`);

    // Reset job state to queued
    await db.collection(COLLECTIONS.AI_JOBS).updateOne(
      { _id: job._id },
      { $set: { state: "queued", reason: null, updatedAt: new Date() } }
    );
    console.log(`  - Job ${job._id} state set to queued.`);
  }

  console.log("\nAll blocked jobs and tasks have been resumed!");
  await closeMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

