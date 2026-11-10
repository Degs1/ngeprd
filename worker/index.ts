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

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { Section } from "../src/lib/schemas/prd";
import type { AiJob as Job } from "../src/lib/jobs/contracts";
import { runBrainstormer } from "../src/lib/agent/brainstormer";
import { runPlanner } from "../src/lib/agent/planner";
import { runSectionWriter } from "../src/lib/agent/sectionWriter";
import { runDiagramGenerator } from "../src/lib/agent/diagramGenerator";
import { COLLECTIONS, closeMongo, getDb } from "../src/lib/db/mongo";
import { getPrdById } from "../src/lib/db/prdRepository";
import { addTask, appendEvent, claimTask, commitCheckpoint, finishTask, getJob, heartbeatTask, listTasks, setJobState } from "../src/lib/jobs/repository";
import type { AiJob, AiTask } from "../src/lib/jobs/contracts";
import { CapacityError, invokeWithPool } from "../src/lib/providers/invoke";

export const workerId = `worker_${randomUUID()}`;
const leaseMs = Number(process.env.AI_WORKER_LEASE_MS) || 120000;
const heartbeatMs = Number(process.env.AI_WORKER_HEARTBEAT_MS) || 30000;
const pollMs = Number(process.env.AI_WORKER_POLL_INTERVAL_MS) || 1500;
const maxAttempts = Number(process.env.AI_MAX_TASK_RETRIES) || 3;
let stopping = false;
let lastReconcile = 0;
const running = new Set<Promise<void>>();

function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function scheduleSections(job: AiJob, sections: Section[], edges: { from: string; to: string }[]) {
  const target = job.sectionIds?.length ? sections.filter((s) => job.sectionIds!.includes(s.id)) : sections;
  const keys: string[] = [];
  for (const section of target) {
    const key = `section:${section.id}`;
    const dependencies = edges.filter((e) => e.to === section.id && target.some((s) => s.id === e.from)).map((e) => `section:${e.from}`);
    await addTask(job, key, "section", section.id, dependencies);
    keys.push(key);
    if (section.diagramHint) {
      const diagramKey = `diagram:${section.id}`;
      await addTask(job, diagramKey, "diagram", section.id, [key]);
      keys.push(diagramKey);
    }
  }
  await addTask(job, "finalize", "finalize", undefined, keys);
  const db = await getDb();
  await db.collection<Job>(COLLECTIONS.AI_JOBS).updateOne({ _id: job._id },
    { $set: { "progress.total": target.length, "progress.ready": target.filter((s) => s.status === "ready").length,
      "progress.diagrams": target.filter((s) => Boolean(s.diagram?.code)).length, updatedAt: new Date() } });
}

export async function processTask(task: AiTask) {
  const claimantId = task.leaseOwner || workerId;
  const job = await getJob(task.jobId.toString(), task.ownerId);
  if (!job) return;
  if (["cancelling", "cancelled", "completed", "failed", "blocked"].includes(job.state)) return;
  const doc = await getPrdById(task.prdId, task.ownerId);
  if (!doc) {
    const finished = await finishTask(task, claimantId, "failed", undefined, "PRD missing");
    if (finished) await setJobState(job._id, "failed", "PRD missing");
    return;
  }
  const controller = new AbortController();
  const heartbeat = setInterval(() => { void heartbeatTask(task, claimantId, leaseMs).then((ok) => { if (!ok) controller.abort(); }).catch(() => controller.abort()); }, heartbeatMs);
  try {
    if (task.stage === "brainstorm") {
      if (doc.brainstorm.questions.length) {
        await finishTask(task, claimantId, "completed");
      } else {
        const result = await invokeWithPool(task, ({ client, model, onUsage, signal }) => runBrainstormer({ idea: doc.idea,
          docId: doc._id.toString(), client, model, onUsage, bypassQueue: true, poolManaged: true, signal }), controller.signal);
        const db = await getDb();
        const ok = await commitCheckpoint(task, claimantId, async (session) => {
          const write = await db.collection(COLLECTIONS.PRD_DOCUMENTS).updateOne({ _id: doc._id, ownerId: task.ownerId,
            "brainstorm.questions.0": { $exists: false } }, { $set: { "brainstorm.questions": result.questions, lang: result.lang, updatedAt: new Date() } }, { session });
          return write.matchedCount === 1;
        });
        if (!ok) return;
        await appendEvent(job, "brainstorm.ready", { questions: result.questions, lang: result.lang });
      }
      await setJobState(job._id, "waiting_user");
      return;
    }

    if (task.stage === "planner") {
      if (doc.sections.length) {
        await scheduleSections(job, doc.sections, doc.edges);
        await finishTask(task, claimantId, "completed");
        return;
      }
      const plan = await invokeWithPool(task, ({ client, model, onUsage, signal }) => runPlanner({ idea: doc.idea,
        answers: doc.brainstorm.answers, questions: doc.brainstorm.questions, lang: doc.lang,
        docId: doc._id.toString(), client, model, onUsage, bypassQueue: true, poolManaged: true, signal }), controller.signal);
      if (plan.sections.length !== 11) throw new Error("Planner did not return exactly 11 sections");
      const db = await getDb();
      const ok = await commitCheckpoint(task, claimantId, async (session) => {
        const write = await db.collection(COLLECTIONS.PRD_DOCUMENTS).updateOne({ _id: doc._id, ownerId: task.ownerId,
          "sections.0": { $exists: false } }, { $set: { chapters: plan.chapters, sections: plan.sections,
            edges: plan.edges, keyDecisions: plan.keyDecisions, updatedAt: new Date() } }, { session });
        if (write.matchedCount && !doc.titleEdited) await db.collection(COLLECTIONS.PRD_DOCUMENTS).updateOne(
          { _id: doc._id, ownerId: task.ownerId, titleEdited: false }, { $set: { title: plan.title } }, { session });
        return write.matchedCount === 1;
      });
      if (!ok) return;
      await scheduleSections(job, plan.sections, plan.edges);
      await appendEvent(job, "plan.ready", { title: plan.title, chapters: plan.chapters, sections: plan.sections, edges: plan.edges });
      return;
    }

    if (task.stage === "section") {
      const section = doc.sections.find((s) => s.id === task.sectionId);
      if (!section) throw new Error("Section missing");
      if (section.status === "ready" && (!job.sectionIds || !job.sectionIds.includes(section.id))) {
        await finishTask(task, claimantId, "completed");
        return;
      }
      const lookup = new Map(doc.brainstorm.questions.map((q) => [q.id, q.text]));
      const content = await invokeWithPool(task, ({ client, model, onUsage, signal }) => runSectionWriter({
        idea: doc.idea, answers: doc.brainstorm.answers.map((a) => ({ questionText: lookup.get(a.questionId) || a.questionId, answerText: a.value })),
        keyDecisions: doc.keyDecisions || [], outline: (doc.sections || []).map((s) => ({ id: s.id, title: s.title, type: s.type, brief: s.brief })),
        section: { id: section.id, title: section.title, type: section.type, brief: section.brief },
        lang: doc.lang, docId: doc._id.toString(), client, model, onUsage, bypassQueue: true, poolManaged: true, signal,
      }), controller.signal);
      const db = await getDb();
      const ok = await commitCheckpoint(task, claimantId, async (session) => {
        const write = await db.collection(COLLECTIONS.PRD_DOCUMENTS).updateOne({ _id: doc._id, ownerId: task.ownerId,
          sections: { $elemMatch: { id: section.id, rev: section.rev } } },
        { $set: { "sections.$[s].content": content, "sections.$[s].status": "ready", "sections.$[s].updatedAt": new Date(), updatedAt: new Date() },
          $inc: { "sections.$[s].rev": 1 } }, { arrayFilters: [{ "s.id": section.id }], session });
        return write.matchedCount === 1;
      });
      if (ok) {
        await db.collection<Job>(COLLECTIONS.AI_JOBS).updateOne({ _id: job._id }, { $inc: { "progress.ready": 1 } });
        await appendEvent(job, "section.completed", { sectionId: section.id, content });
      }
      return;
    }

    if (task.stage === "diagram") {
      const section = doc.sections.find((s) => s.id === task.sectionId);
      if (!section?.diagramHint) { await finishTask(task, claimantId, "completed"); return; }
      if (section.diagram?.code) { await finishTask(task, claimantId, "completed"); return; }
      const diagram = await invokeWithPool(task, ({ client, model, onUsage, signal }) => runDiagramGenerator({
        content: section.content, sectionTitle: section.title, diagramHint: section.diagramHint!,
        lang: doc.lang, docId: doc._id.toString(), sectionId: section.id, client, model, onUsage, bypassQueue: true, poolManaged: true, signal,
      }), controller.signal);
      const db = await getDb();
      const ok = await commitCheckpoint(task, claimantId, async (session) => {
        const write = await db.collection(COLLECTIONS.PRD_DOCUMENTS).updateOne({ _id: doc._id, ownerId: task.ownerId,
          sections: { $elemMatch: { id: section.id, rev: section.rev, "diagram.code": { $in: [null, ""] } } } },
        { $set: { "sections.$[s].diagram": diagram, "sections.$[s].updatedAt": new Date(), updatedAt: new Date() },
          $inc: { "sections.$[s].rev": 1 } }, { arrayFilters: [{ "s.id": section.id }], session });
        return write.matchedCount === 1;
      });
      if (ok) {
        await db.collection<Job>(COLLECTIONS.AI_JOBS).updateOne({ _id: job._id }, { $inc: { "progress.diagrams": 1 } });
        await appendEvent(job, "diagram.completed", { sectionId: section.id, diagram });
      }
      return;
    }

    if (task.stage === "finalize") {
      const fresh = await getPrdById(doc._id, task.ownerId);
      const ready = fresh?.sections.filter((s) => s.status === "ready").length || 0;
      const total = fresh?.sections.length || 0;
      const complete = total > 0 && ready === total;
      const db = await getDb();
      const ok = await commitCheckpoint(task, claimantId, async (session) => {
        const write = await db.collection(COLLECTIONS.PRD_DOCUMENTS).updateOne({ _id: doc._id, ownerId: task.ownerId },
          { $set: { status: complete ? "ready" : "failed", updatedAt: new Date() } }, { session });
        return write.matchedCount === 1;
      });
      if (ok) {
        await setJobState(job._id, complete ? "completed" : "failed");
        await appendEvent(job, complete ? "run.completed" : "run.failed", { ready, failed: total - ready });
      }
    }
  } catch (error: any) {
    if (controller.signal.aborted) return;
    if (error instanceof CapacityError) {
      const maxWaitMs = Math.max(60000, Number(process.env.AI_MAX_CAPACITY_WAIT_MS) || 86400000);
      const exhaustedWait = Date.now() - job.createdAt.getTime() > maxWaitMs;
      if (error.permanent || exhaustedWait) {
        const reason = exhaustedWait ? "Provider capacity unavailable beyond configured wait budget" : error.message;
        console.warn(JSON.stringify({ event: "worker.job_blocked", jobId: String(job._id), taskId: String(task._id), reason }));
        await finishTask(task, claimantId, "failed", undefined, reason);
        await setJobState(job._id, "blocked", reason);
        const db = await getDb();
        await db.collection(COLLECTIONS.PRD_DOCUMENTS).updateOne({ _id: task.prdId, ownerId: task.ownerId },
          { $set: { status: "failed", lastError: { code: "PROVIDER_BLOCKED", message: reason, stage: task.stage, at: new Date() } } });
        if (task.stage === "section" && task.sectionId) {
          await db.collection(COLLECTIONS.PRD_DOCUMENTS).updateOne(
            { _id: task.prdId, ownerId: task.ownerId, "sections.id": task.sectionId },
            { $set: { "sections.$.status": "failed" } }
          );
        }
      } else {
        const jitter = Math.floor(Math.random() * 5000);
        const retryAt = new Date((error.retryAt?.getTime() || Date.now() + 60000) + jitter);
        console.warn(JSON.stringify({ event: "worker.capacity_waiting", jobId: String(job._id), taskId: String(task._id), retryAt: retryAt.toISOString(), reason: error.message }));
        await finishTask(task, claimantId, "waiting_capacity", retryAt, error.message);
        await setJobState(job._id, "waiting_capacity", "Provider capacity unavailable");
      }
    } else if (task.attempt < maxAttempts) {
      const backoff = Math.min(300000, 1000 * 2 ** task.attempt) + Math.floor(Math.random() * 1000);
      console.warn(JSON.stringify({ event: "worker.task_retry", jobId: String(job._id), taskId: String(task._id), attempt: task.attempt, error: String(error?.message || error) }));
      await finishTask(task, claimantId, "retry_scheduled", new Date(Date.now() + backoff), String(error?.message || error));
      await setJobState(job._id, "retry_scheduled", "Retry scheduled");
    } else {
      console.error(JSON.stringify({ event: "worker.task_failed", jobId: String(job._id), taskId: String(task._id), error: String(error?.message || error) }));
      await finishTask(task, claimantId, "failed", undefined, String(error?.message || error));
      await setJobState(job._id, "failed", "Task failed after retry budget");
      const db = await getDb();
      await db.collection(COLLECTIONS.PRD_DOCUMENTS).updateOne({ _id: task.prdId, ownerId: task.ownerId },
        { $set: { status: "failed", lastError: { code: "WORKER_TASK_FAILED", message: "Generasi gagal setelah percobaan maksimal", stage: task.stage, at: new Date() } } });
      if (task.stage === "section" && task.sectionId) {
        await db.collection(COLLECTIONS.PRD_DOCUMENTS).updateOne(
          { _id: task.prdId, ownerId: task.ownerId, "sections.id": task.sectionId },
          { $set: { "sections.$.status": "failed" } }
        );
      }
    }
        await appendEvent(job, "task.state", { stage: task.stage, sectionId: task.sectionId,
          error: error instanceof CapacityError ? error.message : "Task failed; see worker logs" });
  } finally {
    clearInterval(heartbeat);
  }
}

export async function reconcileJobs() {
  const db = await getDb();
  const jobs = await db.collection<Job>(COLLECTIONS.AI_JOBS).find({ state: { $in: ["queued", "running", "retry_scheduled", "waiting_capacity"] } }).limit(100).toArray();
  for (const job of jobs) {
    const tasks = await listTasks(job._id);
    const doc = await getPrdById(job.prdId, job.ownerId);
    if (!doc) continue;
    if (!tasks.length) {
      await addTask(job, job.kind === "brainstorm" ? "brainstorm" : "planner", job.kind === "brainstorm" ? "brainstorm" : "planner");
      continue;
    }
    if (job.kind === "brainstorm" && doc.brainstorm.questions.length && tasks.some((t) => t.key === "brainstorm" && t.state === "completed")) {
      await setJobState(job._id, "waiting_user");
    } else if (job.kind === "generation" && doc.sections.length && tasks.some((t) => t.key === "planner" && t.state === "completed")) {
      await scheduleSections(job, doc.sections, doc.edges);
    }
  }
}

async function main() {
  console.log(JSON.stringify({ event: "worker.started", workerId }));
  const health = createServer(async (request, response) => {
    if (request.url !== "/healthz" && request.url !== "/metrics") {
      response.writeHead(404).end(); return;
    }
    try {
      const db = await getDb();
      await db.command({ ping: 1 });
      const metrics = request.url === "/metrics" ? {
        queued: await db.collection(COLLECTIONS.AI_TASKS).countDocuments({ state: "queued" }),
        waitingCapacity: await db.collection(COLLECTIONS.AI_TASKS).countDocuments({ state: "waiting_capacity" }),
        blocked: await db.collection(COLLECTIONS.AI_JOBS).countDocuments({ state: "blocked" }),
        activeLocalTasks: running.size,
      } : { ok: true };
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(metrics));
    } catch {
      response.writeHead(503, { "content-type": "application/json" }).end('{"ok":false}');
    }
  });
  health.listen(Number(process.env.AI_WORKER_HEALTH_PORT) || 8787, "127.0.0.1");
  process.on("SIGTERM", () => { stopping = true; });
  process.on("SIGINT", () => { stopping = true; });
  while (!stopping) {
    try {
      if (Date.now() - lastReconcile > 10000) { lastReconcile = Date.now(); await reconcileJobs(); }
      if (running.size < (Number(process.env.AI_WORKER_TASK_CONCURRENCY) || 2)) {
        const task = await claimTask(workerId, leaseMs);
        if (task) {
          const promise = processTask(task).catch((error) => console.error(JSON.stringify({ event: "worker.task_error", taskId: task._id, error: String(error) })));
          running.add(promise);
          void promise.finally(() => running.delete(promise));
          continue;
        }
      }
    } catch (error) { console.error(JSON.stringify({ event: "worker.db_error", error: String(error) })); }
    await delay(pollMs);
  }
  await Promise.allSettled(Array.from(running));
  health.close();
  await closeMongo();
  console.log(JSON.stringify({ event: "worker.stopped", workerId }));
}

if (process.argv[1] && /(?:^|[\\/])worker[\\/]index\.ts$/.test(process.argv[1])) void main();
