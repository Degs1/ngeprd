/**
 * Server-side Job Registry for PRD Generation
 * 
 * Manages headless background generation runs in the Node.js runtime:
 * 1. Decouples long-running Agent Runtime generation from ephemeral HTTP request signals (req.signal).
 * 2. Allows multiple PRD generation jobs to run concurrently across different documents.
 * 3. Supports SSE listener multiplexing (reconnecting clients can attach to active runs).
 * 4. Enables explicit cancellation via POST /api/prds/[id]/cancel.
 */

export interface ActiveJob {
  docId: string;
  runId: string;
  ownerId: string;
  abortController: AbortController;
  listeners: Set<(event: string, data: unknown) => void>;
  startedAt: Date;
  status: "running" | "completed" | "failed" | "cancelled";
}

declare global {
  // eslint-disable-next-line no-var
  var __bikinprd_active_jobs__: Map<string, ActiveJob> | undefined;
}

const activeJobs: Map<string, ActiveJob> =
  globalThis.__bikinprd_active_jobs__ || new Map<string, ActiveJob>();

if (process.env.NODE_ENV !== "production") {
  globalThis.__bikinprd_active_jobs__ = activeJobs;
}

/**
 * Registers an active generation job for a PRD document.
 */
export function registerJob(
  docId: string,
  runId: string,
  ownerId: string,
  abortController: AbortController
): ActiveJob {
  // If an existing job is running for this doc, abort it before registering new one
  const existing = activeJobs.get(docId);
  if (existing && existing.status === "running") {
    existing.abortController.abort("Replaced by new generation run");
    existing.status = "cancelled";
  }

  const job: ActiveJob = {
    docId,
    runId,
    ownerId,
    abortController,
    listeners: new Set(),
    startedAt: new Date(),
    status: "running",
  };

  activeJobs.set(docId, job);
  return job;
}

/**
 * Retrieves the active job for a PRD document if it exists.
 */
export function getJob(docId: string): ActiveJob | undefined {
  return activeJobs.get(docId);
}

/**
 * Checks if a generation job is currently running for a PRD document.
 */
export function isJobActive(docId: string): boolean {
  const job = activeJobs.get(docId);
  return !!job && job.status === "running";
}

/**
 * Attaches an SSE event listener to an active job.
 * Returns an unsubscribe callback function, or null if no job is active.
 */
export function addJobListener(
  docId: string,
  listener: (event: string, data: unknown) => void
): (() => void) | null {
  const job = activeJobs.get(docId);
  if (!job || job.status !== "running") {
    return null;
  }

  job.listeners.add(listener);

  return () => {
    job.listeners.delete(listener);
  };
}

/**
 * Broadcasts an SSE event to all connected listeners of a job.
 */
export function emitToJob(docId: string, event: string, data: unknown): void {
  const job = activeJobs.get(docId);
  if (!job) return;

  job.listeners.forEach((listener) => {
    try {
      listener(event, data);
    } catch {
      // Ignore individual listener dispatch errors
    }
  });
}

/**
 * Explicitly cancels an active generation job.
 * Returns true if an active job was cancelled, or false if not found / already ended.
 */
export function cancelJob(docId: string, reason: string = "Dibatalkan oleh pengguna"): boolean {
  const job = activeJobs.get(docId);
  if (!job || job.status !== "running") {
    return false;
  }

  job.status = "cancelled";
  job.abortController.abort(reason);

  // Notify connected listeners
  emitToJob(docId, "run.failed", {
    code: "ABORTED",
    message: reason,
  });

  activeJobs.delete(docId);
  return true;
}

/**
 * Marks a job as completed or failed and unregisters it from active jobs.
 */
export function finishJob(
  docId: string,
  runId: string,
  status: "completed" | "failed" = "completed"
): void {
  const job = activeJobs.get(docId);
  if (job && job.runId === runId) {
    job.status = status;
    activeJobs.delete(docId);
  }
}

/**
 * Lists metadata for all currently running jobs.
 */
export function listActiveJobs(): {
  docId: string;
  runId: string;
  ownerId: string;
  startedAt: Date;
  listenersCount: number;
}[] {
  const list: {
    docId: string;
    runId: string;
    ownerId: string;
    startedAt: Date;
    listenersCount: number;
  }[] = [];

  activeJobs.forEach((job) => {
    if (job.status === "running") {
      list.push({
        docId: job.docId,
        runId: job.runId,
        ownerId: job.ownerId,
        startedAt: job.startedAt,
        listenersCount: job.listeners.size,
      });
    }
  });

  return list;
}
