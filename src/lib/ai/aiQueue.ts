import { AiError } from "./aiError";

export interface QueueTask<T = unknown> {
  id: string;
  docId: string;
  stage?: string;
  signal?: AbortSignal;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
  enqueuedAt: number;
}

export interface EnqueueOptions {
  docId?: string;
  stage?: string;
  signal?: AbortSignal;
  priority?: "high" | "normal";
}

export interface QueueStats {
  activeCount: number;
  queuedCount: number;
  pausedUntil: number;
  isPaused: boolean;
  maxConcurrency: number;
  maxRpm: number;
  documentsInQueue: number;
}

export class AiRequestQueue {
  private activeCount = 0;
  private maxConcurrency: number;
  private maxRpm: number;
  private pausedUntil = 0;
  private pauseTimer: NodeJS.Timeout | null = null;
  private rpmWindowTimer: NodeJS.Timeout | null = null;

  // Timestamps of requests executed in the last 60 seconds (for RPM tracking)
  private requestTimestamps: number[] = [];

  // Grouped queues by docId for fair round-robin scheduling
  private docQueues: Map<string, QueueTask[]> = new Map();
  private activeDocOrder: string[] = [];
  private lastServedDocId: string | null = null;

  constructor(options?: { maxConcurrency?: number; maxRpm?: number }) {
    this.maxConcurrency =
      options?.maxConcurrency !== undefined
        ? options.maxConcurrency
        : Number(process.env.AI_MAX_CONCURRENCY) || 4;
    this.maxRpm =
      options?.maxRpm !== undefined
        ? options.maxRpm
        : Number(process.env.AI_MAX_RPM) || 60;
  }

  /**
   * Enqueues an AI task to be executed according to concurrency and rate limit rules.
   */
  public enqueue<T>(task: () => Promise<T>, options?: EnqueueOptions): Promise<T> {
    const docId = options?.docId || "__global__";
    const signal = options?.signal;

    if (signal?.aborted) {
      return Promise.reject(
        new AiError("AI_TIMEOUT", "Operasi AI dibatalkan oleh pengguna", {
          stage: options?.stage,
          docId: options?.docId,
        })
      );
    }

    return new Promise<T>((resolve, reject) => {
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      let onAbort: (() => void) | null = null;

      const queueTask: QueueTask<T> = {
        id: taskId,
        docId,
        stage: options?.stage,
        signal,
        execute: task,
        resolve: (val) => {
          if (signal && onAbort) {
            signal.removeEventListener("abort", onAbort);
          }
          resolve(val);
        },
        reject: (err) => {
          if (signal && onAbort) {
            signal.removeEventListener("abort", onAbort);
          }
          reject(err);
        },
        enqueuedAt: Date.now(),
      };

      // Handle abort while waiting in queue
      if (signal) {
        onAbort = () => {
          this.removeFromQueue(docId, taskId);
          signal.removeEventListener("abort", onAbort!);
          reject(
            new AiError("AI_TIMEOUT", "Operasi AI dibatalkan sebelum dijalankan", {
              stage: options?.stage,
              docId: options?.docId,
            })
          );
        };
        signal.addEventListener("abort", onAbort, { once: true });
      }

      // Add task to docQueue
      let queue = this.docQueues.get(docId);
      if (!queue) {
        queue = [];
        this.docQueues.set(docId, queue);
        this.activeDocOrder.push(docId);
      }

      if (options?.priority === "high") {
        queue.unshift(queueTask as QueueTask);
      } else {
        queue.push(queueTask as QueueTask);
      }

      this.processNext();
    });
  }

  /**
   * Notifies the queue that a rate limit (429) was encountered.
   * Temporarily pauses dispatching new requests until the cooldown window expires.
   */
  public notifyRateLimit(cooldownMs: number): void {
    const targetTime = Date.now() + cooldownMs;
    if (targetTime > this.pausedUntil) {
      this.pausedUntil = targetTime;
      if (this.pauseTimer) {
        clearTimeout(this.pauseTimer);
      }
      this.pauseTimer = setTimeout(() => {
        this.pauseTimer = null;
        this.processNext();
      }, cooldownMs);
    }
  }

  /**
   * Updates configuration dynamically (e.g. for testing).
   */
  public configure(options: { maxConcurrency?: number; maxRpm?: number }): void {
    if (options.maxConcurrency !== undefined) {
      this.maxConcurrency = options.maxConcurrency;
    }
    if (options.maxRpm !== undefined) {
      this.maxRpm = options.maxRpm;
    }
    this.processNext();
  }

  /**
   * Returns current queue statistics for observability and monitoring.
   */
  public getStats(): QueueStats {
    let queuedCount = 0;
    this.docQueues.forEach((q) => {
      queuedCount += q.length;
    });
    const isPaused = Date.now() < this.pausedUntil;

    return {
      activeCount: this.activeCount,
      queuedCount,
      pausedUntil: this.pausedUntil,
      isPaused,
      maxConcurrency: this.maxConcurrency,
      maxRpm: this.maxRpm,
      documentsInQueue: this.docQueues.size,
    };
  }

  /**
   * Resets queue state (clears pending tasks and active counts).
   */
  public reset(): void {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    if (this.rpmWindowTimer) {
      clearTimeout(this.rpmWindowTimer);
      this.rpmWindowTimer = null;
    }
    this.activeCount = 0;
    this.pausedUntil = 0;
    this.requestTimestamps = [];
    this.docQueues.clear();
    this.activeDocOrder = [];
    this.lastServedDocId = null;
  }

  /**
   * Dispatches pending tasks up to maxConcurrency and rate limits.
   */
  private processNext(): void {
    // 1. Check if paused due to 429 rate limit
    const now = Date.now();
    if (now < this.pausedUntil) {
      if (!this.pauseTimer) {
        this.pauseTimer = setTimeout(() => {
          this.pauseTimer = null;
          this.processNext();
        }, Math.max(1, this.pausedUntil - now));
      }
      return;
    }

    // 2. Check concurrency
    if (this.activeCount >= this.maxConcurrency) {
      return;
    }

    // 3. Clean RPM window and check rate limit
    this.pruneRpmWindow(now);
    if (this.maxRpm > 0 && this.requestTimestamps.length >= this.maxRpm) {
      // Must wait until oldest request falls out of 60s window
      const oldest = this.requestTimestamps[0];
      const waitMs = Math.max(0, oldest + 60000 - now);
      if (!this.rpmWindowTimer) {
        this.rpmWindowTimer = setTimeout(() => {
          this.rpmWindowTimer = null;
          this.processNext();
        }, waitMs + 20);
      }
      return;
    }

    // 4. Fetch next task via round-robin across documents
    const task = this.dequeueNextTask();
    if (!task) {
      return;
    }

    // 5. Execute task
    this.activeCount++;
    this.requestTimestamps.push(Date.now());

    (async () => {
      try {
        const result = await task.execute();
        task.resolve(result);
      } catch (err) {
        task.reject(err);
      } finally {
        this.activeCount--;
        // Immediately try to dispatch the next task
        this.processNext();
      }
    })();

    // Loop to fill remaining available concurrency slots
    if (this.activeCount < this.maxConcurrency) {
      this.processNext();
    }
  }

  private dequeueNextTask(): QueueTask | null {
    // 1. Clean up empty doc queues first
    this.activeDocOrder = this.activeDocOrder.filter((docId) => {
      const q = this.docQueues.get(docId);
      return q && q.length > 0;
    });

    if (this.activeDocOrder.length === 0) {
      this.lastServedDocId = null;
      return null;
    }

    // 2. Find next doc in round-robin order after lastServedDocId
    let nextIndex = 0;
    if (this.lastServedDocId !== null) {
      const prevIndex = this.activeDocOrder.indexOf(this.lastServedDocId);
      if (prevIndex !== -1) {
        nextIndex = (prevIndex + 1) % this.activeDocOrder.length;
      }
    }

    const docId = this.activeDocOrder[nextIndex];
    const q = this.docQueues.get(docId);
    const task = q ? q.shift() : null;

    if (task) {
      this.lastServedDocId = docId;
    }

    // If this doc's queue is now empty, clean it up
    if (q && q.length === 0) {
      this.docQueues.delete(docId);
      this.activeDocOrder = this.activeDocOrder.filter((id) => id !== docId);
    }

    return task || null;
  }

  private removeFromQueue(docId: string, taskId: string): void {
    const q = this.docQueues.get(docId);
    if (!q) return;

    const idx = q.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      q.splice(idx, 1);
    }

    if (q.length === 0) {
      this.docQueues.delete(docId);
      this.activeDocOrder = this.activeDocOrder.filter((id) => id !== docId);
    }
  }

  private pruneRpmWindow(now: number): void {
    const windowStart = now - 60000;
    while (
      this.requestTimestamps.length > 0 &&
      this.requestTimestamps[0] < windowStart
    ) {
      this.requestTimestamps.shift();
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __bikinprd_ai_queue__: AiRequestQueue | undefined;
}

export const aiQueue: AiRequestQueue =
  globalThis.__bikinprd_ai_queue__ || new AiRequestQueue();

if (process.env.NODE_ENV !== "production") {
  globalThis.__bikinprd_ai_queue__ = aiQueue;
}
