import { existsSync } from "node:fs";
import { resolve } from "node:path";

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

  const jobs = await db.collection(COLLECTIONS.AI_JOBS).find().sort({ createdAt: -1 }).limit(5).toArray();
  console.log("--- RECENT JOBS ---");
  for (const j of jobs) {
    console.log(j._id.toString(), "kind:", j.kind, "state:", j.state, "stage:", j.stage, "reason:", j.reason);
  }

  const docs = await db.collection(COLLECTIONS.PRD_DOCUMENTS).find().sort({ createdAt: -1 }).limit(5).toArray();
  console.log("--- RECENT PRD DOCS ---");
  for (const d of docs) {
    console.log(d._id.toString(), "ownerId:", d.ownerId, "status:", d.status, "title:", d.title);
  }

  const tasks = await db.collection(COLLECTIONS.AI_TASKS).find().sort({ createdAt: -1 }).limit(5).toArray();
  console.log("--- RECENT TASKS ---");
  for (const t of tasks) {
    console.log(t._id.toString(), "key:", t.key, "state:", t.state, "stage:", t.stage, "error:", t.error);
  }

  const providers = await db.collection(COLLECTIONS.AI_PROVIDERS).find().toArray();
  console.log("--- PROVIDERS --- (" + providers.length + ")");
  for (const p of providers) {
    console.log(p._id.toString(), p.name, "model:", p.model, "baseURL:", p.baseURL, "enabled:", p.enabled, "capabilities:", p.capabilities);
  }

  const accounts = await db.collection(COLLECTIONS.AI_ACCOUNTS).find().toArray();
  console.log("--- ACCOUNTS --- (" + accounts.length + ")");
  for (const a of accounts) {
    console.log(a._id.toString(), "providerId:", a.providerId?.toString(), "label:", a.label, "enabled:", a.enabled, "cooldownUntil:", a.cooldownUntil, "failureCount:", a.failureCount);
  }

  const usage = await db.collection(COLLECTIONS.AI_USAGE).find().sort({ createdAt: -1 }).limit(5).toArray();
  console.log("--- RECENT AI USAGE --- (" + usage.length + ")");
  for (const u of usage) {
    console.log(u.stage, "model:", u.model, "outcome:", u.outcome, "errorCode:", u.errorCode, "durationMs:", u.durationMs);
  }

  await closeMongo();
}

main().catch(console.error);

