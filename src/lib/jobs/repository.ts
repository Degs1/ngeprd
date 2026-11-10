import { ObjectId, type Collection } from "mongodb";
import { COLLECTIONS, getDb } from "../db/mongo";
import { getClient } from "../db/mongo";
import type { AiEvent, AiJob, AiTask, JobKind, JobState, TaskStage } from "./contracts";

const now = () => new Date();
const activeStates: JobState[] = ["queued", "running", "waiting_capacity", "retry_scheduled", "cancelling"];

async function collections() {
  const db = await getDb();
  return {
    jobs: db.collection<AiJob>(COLLECTIONS.AI_JOBS),
    tasks: db.collection<AiTask>(COLLECTIONS.AI_TASKS),
    events: db.collection<AiEvent>(COLLECTIONS.AI_EVENTS),
  };
}

export async function getJob(id: string, ownerId: string) {
  if (!ObjectId.isValid(id)) return null;
  const { jobs } = await collections();
  return jobs.findOne({ _id: new ObjectId(id), ownerId });
}

export async function getLatestJob(prdId: string, ownerId: string, kind?: JobKind) {
  if (!ObjectId.isValid(prdId)) return null;
  const { jobs } = await collections();
  return jobs.find({ prdId: new ObjectId(prdId), ownerId, ...(kind ? { kind } : {}) })
    .sort({ createdAt: -1 }).limit(1).next();
}

export async function createJob(input: {
  ownerId: string; prdId: ObjectId; kind: JobKind; submissionId: string;
  sectionIds?: string[];
}) {
  const { jobs, tasks } = await collections();
  const prior = await jobs.findOne({ ownerId: input.ownerId, submissionId: input.submissionId });
  if (prior) {
    if (!prior.prdId.equals(input.prdId) || prior.kind !== input.kind) throw new Error("SUBMISSION_ID_CONFLICT");
    return prior;
  }
  const existing = await jobs.findOne({ ownerId: input.ownerId, prdId: input.prdId, kind: input.kind, state: { $in: activeStates } });
  if (existing) return existing;
  const date = now();
  const job: AiJob = {
    _id: new ObjectId(), ownerId: input.ownerId, prdId: input.prdId,
    kind: input.kind, submissionId: input.submissionId,
    sectionIds: input.sectionIds, state: "queued",
    stage: input.kind === "brainstorm" ? "brainstorm" : "planner",
    progress: { total: 0, ready: 0, failed: 0, diagrams: 0 },
    eventSeq: 0, createdAt: date, updatedAt: date,
  };
  let inserted = false;
  const limit = Math.max(1, Number(process.env.AI_MAX_ACTIVE_JOBS_PER_USER) || 1);
  if (await jobs.countDocuments({ ownerId: input.ownerId, state: { $in: activeStates } }) >= limit) {
    throw new Error("ACTIVE_JOB_LIMIT");
  }
  for (let slot = 0; slot < limit; slot++) {
    try {
      job.activeOwnerId = `${input.ownerId}:${slot}`;
      await jobs.insertOne(job);
      inserted = true;
      break;
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      const found = await jobs.findOne({ ownerId: input.ownerId, submissionId: input.submissionId });
      if (found) {
        if (!found.prdId.equals(input.prdId) || found.kind !== input.kind) throw new Error("SUBMISSION_ID_CONFLICT");
        return found;
      }
    }
  }
  if (!inserted) throw new Error("ACTIVE_JOB_LIMIT");
  const key = input.kind === "brainstorm" ? "brainstorm" : "planner";
  await tasks.updateOne({ jobId: job._id, key }, { $setOnInsert: {
    _id: new ObjectId(), jobId: job._id, ownerId: job.ownerId, prdId: job.prdId,
    key, stage: key as TaskStage, dependsOn: [], state: "queued", attempt: 0,
    nextRunAt: date, fence: 0, createdAt: date, updatedAt: date,
  } }, { upsert: true });
  return job;
}

export async function addTask(job: AiJob, key: string, stage: TaskStage, sectionId?: string, dependsOn: string[] = []) {
  const { tasks } = await collections();
  const date = now();
  await tasks.updateOne({ jobId: job._id, key }, { $setOnInsert: {
    _id: new ObjectId(), jobId: job._id, ownerId: job.ownerId, prdId: job.prdId,
    key, stage, sectionId, dependsOn, state: "queued", attempt: 0,
    nextRunAt: date, fence: 0, createdAt: date, updatedAt: date,
  } }, { upsert: true });
}

export async function listTasks(jobId: ObjectId) {
  const { tasks } = await collections();
  return tasks.find({ jobId }).toArray();
}

export async function claimTask(workerId: string, leaseMs: number): Promise<AiTask | null> {
  const { jobs, tasks } = await collections();
  const date = now();
  const candidates = await tasks.find({
    $or: [
      { state: { $in: ["queued", "retry_scheduled", "waiting_capacity"] }, nextRunAt: { $lte: date } },
      { state: "leased", leaseUntil: { $lte: date } },
    ],
  }).sort({ nextRunAt: 1, createdAt: 1 }).limit(1000).toArray();
  const ownerLast = new Map<string, number>();
  for (const candidate of candidates) {
    if (!ownerLast.has(candidate.ownerId)) {
      const last = await jobs.find({ ownerId: candidate.ownerId, lastClaimedAt: { $exists: true } })
        .sort({ lastClaimedAt: -1 }).limit(1).next();
      ownerLast.set(candidate.ownerId, last?.lastClaimedAt?.getTime() || 0);
    }
  }
  candidates.sort((a, b) =>
    (ownerLast.get(a.ownerId)! - ownerLast.get(b.ownerId)!) ||
    (a.createdAt.getTime() - b.createdAt.getTime()));
  for (const candidate of candidates) {
    const job = await jobs.findOne({ _id: candidate.jobId, state: { $nin: ["cancelled", "cancelling", "completed", "failed", "blocked", "waiting_user"] } });
    if (!job) continue;
    if (candidate.dependsOn.length) {
      const done = await tasks.countDocuments({ jobId: candidate.jobId, key: { $in: candidate.dependsOn }, state: "completed" });
      if (done !== candidate.dependsOn.length) continue;
    }
    const claimed = await tasks.findOneAndUpdate({ _id: candidate._id, fence: candidate.fence, state: candidate.state,
      ...(candidate.state === "leased" ? { leaseUntil: { $lte: date } } : { nextRunAt: { $lte: date } }),
    }, { $set: { state: "leased", leaseOwner: workerId, leaseUntil: new Date(date.getTime() + leaseMs), updatedAt: date },
      $inc: { fence: 1, attempt: 1 },
    }, { returnDocument: "after" });
    if (claimed) {
      await jobs.updateOne({ _id: claimed.jobId, state: { $nin: ["cancelled", "cancelling"] } },
        { $set: { state: "running", stage: claimed.stage, lastClaimedAt: date, updatedAt: date } });
      return claimed;
    }
  }
  return null;
}

export async function heartbeatTask(task: AiTask, workerId: string, leaseMs: number) {
  const { tasks } = await collections();
  const result = await tasks.updateOne({ _id: task._id, fence: task.fence, leaseOwner: workerId, state: "leased" },
    { $set: { leaseUntil: new Date(Date.now() + leaseMs), updatedAt: now() } });
  return result.matchedCount === 1;
}

export async function ownsTask(task: AiTask, workerId: string) {
  const { tasks, jobs } = await collections();
  const [current, job] = await Promise.all([
    tasks.findOne({ _id: task._id, fence: task.fence, leaseOwner: workerId, state: "leased", leaseUntil: { $gt: now() } }),
    jobs.findOne({ _id: task.jobId, state: { $nin: ["cancelled", "cancelling", "blocked", "failed"] } }),
  ]);
  return Boolean(current && job);
}

export async function finishTask(task: AiTask, workerId: string, state: "completed" | "failed" | "waiting_capacity" | "retry_scheduled", nextRunAt?: Date, error?: string) {
  const { tasks } = await collections();
  const result = await tasks.updateOne({ _id: task._id, fence: task.fence, leaseOwner: workerId, state: "leased" },
    { $set: { state, nextRunAt: nextRunAt || now(), lastError: error, updatedAt: now() }, $unset: { leaseOwner: "", leaseUntil: "" } });
  return result.matchedCount === 1;
}

export async function setJobState(jobId: ObjectId, state: AiJob["state"], reason?: string) {
  const { jobs } = await collections();
  const inactive = ["waiting_user", "blocked", "completed", "failed", "cancelled"].includes(state);
  await jobs.updateOne({ _id: jobId, state: { $nin: ["cancelled", "completed"] } },
    { $set: { state, reason, updatedAt: now(), ...(state === "completed" || state === "failed" || state === "cancelled" ? { completedAt: now() } : {}) },
      ...(inactive ? { $unset: { activeOwnerId: "" } } : {}) });
}

export async function cancelJob(prdId: string, ownerId: string) {
  if (!ObjectId.isValid(prdId)) return false;
  const { jobs, tasks } = await collections();
  const job = await jobs.findOneAndUpdate({ prdId: new ObjectId(prdId), ownerId, state: { $in: activeStates } },
    { $set: { state: "cancelling", updatedAt: now() } }, { sort: { createdAt: -1 }, returnDocument: "after" });
  if (!job) return false;
  await tasks.updateMany({ jobId: job._id, state: { $ne: "completed" } },
    { $set: { state: "cancelled", updatedAt: now() }, $inc: { fence: 1 }, $unset: { leaseOwner: "", leaseUntil: "" } });
  await setJobState(job._id, "cancelled");
  await appendEvent(job, "run.cancelled", {});
  return true;
}

/** Admin retry after provider repair; the owner's active-job slot remains unique. */
export async function retryBlockedJob(jobId: string) {
  if (!ObjectId.isValid(jobId)) return false;
  const { jobs, tasks } = await collections();
  const job = await jobs.findOne({ _id: new ObjectId(jobId), state: "blocked" });
  if (!job) return false;
  const limit = Math.max(1, Number(process.env.AI_MAX_ACTIVE_JOBS_PER_USER) || 1);
  if (await jobs.countDocuments({ ownerId: job.ownerId, state: { $in: activeStates } }) >= limit) return false;
  for (let slot = 0; slot < limit; slot++) {
    const session = (await getClient()).startSession();
    try {
      let changed = false;
      await session.withTransaction(async () => {
        const result = await jobs.updateOne({ _id: job._id, state: "blocked" },
          { $set: { state: "queued", reason: "Admin retry", activeOwnerId: `${job.ownerId}:${slot}`, updatedAt: now() } }, { session });
        if (!result.matchedCount) return;
        await tasks.updateMany({ jobId: job._id, state: { $in: ["failed", "waiting_capacity", "retry_scheduled"] } },
          { $set: { state: "queued", attempt: 0, nextRunAt: now(), updatedAt: now() }, $inc: { fence: 1 } }, { session });
        changed = true;
      });
      if (!changed) return false;
      await appendEvent(job, "run.requeued", {});
      return true;
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
    } finally {
      await session.endSession();
    }
  }
  return false;
}

export async function appendEvent(job: AiJob, type: string, data: Record<string, unknown>) {
  const { jobs, events } = await collections();
  const updated = await jobs.findOneAndUpdate({ _id: job._id },
    { $inc: { eventSeq: 1 }, $set: { updatedAt: now() } }, { returnDocument: "after" });
  if (!updated) return;
  await events.insertOne({ _id: new ObjectId(), jobId: job._id, ownerId: job.ownerId,
    prdId: job.prdId, seq: updated.eventSeq, type, data, createdAt: now() });
}

export async function getEvents(jobId: ObjectId, ownerId: string, after = 0) {
  const { events } = await collections();
  return events.find({ jobId, ownerId, seq: { $gt: after } }).sort({ seq: 1 }).limit(100).toArray();
}

/** Touching the task and PRD in one transaction makes a renewed fence conflict with stale commits. */
export async function commitCheckpoint(task: AiTask, workerId: string, write: (session: import("mongodb").ClientSession) => Promise<boolean>) {
  const client = await getClient();
  const { tasks } = await collections();
  const session = client.startSession();
  try {
    let committed = false;
    await session.withTransaction(async () => {
      const touched = await tasks.updateOne({ _id: task._id, fence: task.fence, leaseOwner: workerId,
        state: "leased", leaseUntil: { $gt: now() } }, { $set: { updatedAt: now() } }, { session });
      if (touched.matchedCount !== 1) throw new Error("STALE_FENCE");
      committed = await write(session);
      if (!committed) throw new Error("CHECKPOINT_CONFLICT");
      await tasks.updateOne({ _id: task._id, fence: task.fence, leaseOwner: workerId },
        { $set: { state: "completed", updatedAt: now() }, $unset: { leaseOwner: "", leaseUntil: "" } }, { session });
    });
    return committed;
  } catch (error: any) {
    if (error?.message === "STALE_FENCE" || error?.message === "CHECKPOINT_CONFLICT") return false;
    throw error;
  } finally {
    await session.endSession();
  }
}
