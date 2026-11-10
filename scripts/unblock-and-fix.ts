import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ObjectId } from "mongodb";

if (typeof process.loadEnvFile === "function") {
  for (const file of [".env.worker", ".env.local", ".env"]) {
    const fullPath = resolve(process.cwd(), file);
    if (existsSync(fullPath)) {
      try { process.loadEnvFile(fullPath); } catch {}
    }
  }
}

import { getDb, closeMongo, COLLECTIONS } from "../src/lib/db/mongo";

async function main() {
  const db = await getDb();
  console.log("Connected to database:", db.databaseName);

  // 1. Re-enable all accounts
  const accRes = await db.collection(COLLECTIONS.AI_ACCOUNTS).updateMany(
    {},
    { $set: { enabled: true, failureCount: 0 }, $unset: { cooldownUntil: "" } }
  );
  console.log(`Re-enabled ${accRes.matchedCount} AI accounts in ai_accounts.`);

  // 2. Ensure all PRD documents have keyDecisions array
  const prdRes = await db.collection(COLLECTIONS.PRD_DOCUMENTS).updateMany(
    { keyDecisions: { $exists: false } },
    { $set: { keyDecisions: [] } }
  );
  console.log(`Updated ${prdRes.matchedCount} PRD documents missing keyDecisions.`);

  // 3. Reset all blocked or failed jobs to queued
  const jobRes = await db.collection(COLLECTIONS.AI_JOBS).updateMany(
    { state: { $in: ["blocked", "failed"] } },
    { $set: { state: "queued", reason: null, updatedAt: new Date() } }
  );
  console.log(`Reset ${jobRes.matchedCount} blocked/failed jobs back to queued in ai_jobs.`);

  // 4. Reset failed tasks for those jobs back to queued
  const taskRes = await db.collection(COLLECTIONS.AI_TASKS).updateMany(
    { state: { $in: ["failed", "blocked"] } },
    { $set: { state: "queued", attempt: 0, nextRunAt: new Date(), updatedAt: new Date() } }
  );
  console.log(`Reset ${taskRes.matchedCount} failed tasks back to queued in ai_tasks.`);

  await closeMongo();
  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

