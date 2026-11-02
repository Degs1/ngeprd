import { ObjectId } from "mongodb";
import * as defaultPrdRepo from "../db/prdRepository";
import { runPlanner, type PlanResult } from "./planner";
import { runSectionWriter } from "./sectionWriter";
import { runDiagramGenerator } from "./diagramGenerator";
import { AiError } from "../ai/generateJson";
import type {
  PrdDocument,
  Section,
  PrdStatus,
  Diagram,
} from "../schemas/prd";
import type { getAiClient } from "../ai/client";

export type SseEmitter = (event: string, data: unknown) => void;

export interface RunnerRepo {
  acquireExecutionLock: typeof defaultPrdRepo.acquireExecutionLock;
  updateExecutionHeartbeat: typeof defaultPrdRepo.updateExecutionHeartbeat;
  releaseExecutionLock: typeof defaultPrdRepo.releaseExecutionLock;
  resetWritingSectionsToPending: typeof defaultPrdRepo.resetWritingSectionsToPending;
  savePlanToPrdDocument: typeof defaultPrdRepo.savePlanToPrdDocument;
  markSectionWriting: typeof defaultPrdRepo.markSectionWriting;
  saveSectionCompleted: typeof defaultPrdRepo.saveSectionCompleted;
  saveSectionFailed: typeof defaultPrdRepo.saveSectionFailed;
  getPrdById: typeof defaultPrdRepo.getPrdById;
}

export interface RunGenerationOptions {
  ownerId: string;
  sectionIds?: string[];
  concurrency?: number;
  signal?: AbortSignal;
  client?: ReturnType<typeof getAiClient>;
  emit: SseEmitter;
  repo?: Partial<RunnerRepo>;
  runId?: string;
  preAcquiredLock?: boolean;
}

export interface RunGenerationResult {
  success: boolean;
  runId: string;
  ready: number;
  failed: number;
  code?: string;
  message?: string;
}

/**
 * Concurrency pool helper that executes tasks up to `concurrencyLimit` in parallel.
 * Respects AbortSignal to cease starting new items if aborted.
 */
async function pool<T>(
  items: T[],
  concurrencyLimit: number,
  taskFn: (item: T) => Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  if (items.length === 0) return;

  const limit = Math.max(1, Math.min(concurrencyLimit, items.length));
  let cursor = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      if (signal?.aborted) {
        break;
      }
      const itemIndex = cursor++;
      const item = items[itemIndex];
      await taskFn(item);
    }
  });

  await Promise.all(workers);
}

/**
 * Orchestrates the full Agent Runtime pipeline per PRD v2.1 specifications:
 * 1. Lock acquisition with stale takeover (> 3 minutes).
 * 2. 15-second heartbeat interval (SSE event + MongoDB update).
 * 3. Planner execution (if doc has 0 sections) generating dynamic chapters & 8-14 sections.
 * 4. Parallel SectionWriter pool (default AGENT_CONCURRENCY=3) with atomic MongoDB saves per section.
 * 5. DiagramGenerator execution for sections with diagramHint.
 * 6. Resilience: single section failures do not abort others.
 * 7. Cancellation / AbortController cleanup.
 */
export async function runGeneration(
  initialDoc: PrdDocument,
  options: RunGenerationOptions
): Promise<RunGenerationResult> {
  const repo: RunnerRepo = {
    ...defaultPrdRepo,
    ...options.repo,
  };

  const ownerId = options.ownerId;
  const docId = initialDoc._id;
  const emit = options.emit;
  const signal = options.signal;
  const runId =
    options.runId ||
    `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const concurrency =
    options.concurrency ||
    Number(process.env.AGENT_CONCURRENCY) ||
    3;

  let doc = initialDoc;

  // 1. Acquire execution lock (unless pre-acquired by caller)
  if (!options.preAcquiredLock) {
    const lockResult = await repo.acquireExecutionLock(docId, ownerId, runId);
    if (!lockResult.acquired) {
      const code =
        lockResult.reason === "NOT_FOUND" ? "NOT_FOUND" : "RUN_IN_PROGRESS";
      const message =
        lockResult.reason === "NOT_FOUND"
          ? "Dokumen PRD tidak ditemukan"
          : "Proses generate sedang berjalan untuk dokumen ini";

      emit("run.failed", { code, message });
      return { success: false, runId, ready: 0, failed: 0, code, message };
    }
    doc = lockResult.doc || initialDoc;
  }

  // 2. Start heartbeat timer (every 15s)
  const heartbeatInterval = setInterval(async () => {
    try {
      await repo.updateExecutionHeartbeat(docId, runId);
      emit("heartbeat", {});
    } catch {
      // Ignore background heartbeat ping errors
    }
  }, 15000);

  try {
    let targetSections: Section[] = [];

    // Emit run.started event
    // If sections already exist, total is target count; otherwise 0 until plan.ready
    const preExistingTargetCount = doc.sections.length > 0
      ? (options.sectionIds && options.sectionIds.length > 0
          ? doc.sections.filter((s) => options.sectionIds!.includes(s.id)).length
          : doc.sections.filter(
              (s) =>
                s.status === "pending" ||
                s.status === "failed" ||
                s.status === "writing"
            ).length)
      : 0;

    emit("run.started", {
      runId,
      total: preExistingTargetCount,
    });

    // 3. Planning Stage (if doc has 0 sections)
    if (!doc.sections || doc.sections.length === 0) {
      if (signal?.aborted) {
        throw new Error("Generation was cancelled before planning started");
      }

      let plan: PlanResult;
      try {
        plan = await runPlanner({
          idea: doc.idea,
          answers: doc.brainstorm?.answers || [],
          questions: doc.brainstorm?.questions || [],
          lang: doc.lang || "id",
          docId: docId.toString(),
          client: options.client,
          signal,
        });
      } catch (planErr: unknown) {
        const code =
          planErr instanceof AiError ? planErr.code : "AI_SERVER_ERROR";
        const message =
          planErr instanceof Error ? planErr.message : String(planErr);

        emit("run.failed", { code, message });
        await repo.releaseExecutionLock(docId, runId, "failed", {
          code,
          message,
          stage: "planner",
          at: new Date(),
        });
        return { success: false, runId, ready: 0, failed: 0, code, message };
      }

      // Persist generated chapters, sections (pending), edges, keyDecisions
      const updatedDoc = await repo.savePlanToPrdDocument(docId, ownerId, {
        title: plan.title,
        keyDecisions: plan.keyDecisions,
        chapters: plan.chapters,
        sections: plan.sections,
        edges: plan.edges,
      });

      if (updatedDoc) {
        doc = updatedDoc;
      } else {
        doc = {
          ...doc,
          chapters: plan.chapters,
          sections: plan.sections,
          edges: plan.edges,
          keyDecisions: plan.keyDecisions,
          title: doc.titleEdited ? doc.title : plan.title,
        };
      }

      // Emit plan.ready event
      emit("plan.ready", {
        title: doc.title,
        keyDecisions: doc.keyDecisions,
        chapters: doc.chapters.map((c) => ({
          id: c.id,
          title: c.title,
          order: c.order,
        })),
        sections: doc.sections.map((s) => ({
          id: s.id,
          chapterId: s.chapterId,
          type: s.type,
          title: s.title,
          order: s.order,
          status: s.status,
        })),
        edges: doc.edges.map((e) => ({
          id: e.id,
          from: e.from,
          to: e.to,
        })),
      });

      targetSections = [...doc.sections];
    } else {
      // Resume / Selective generation
      if (options.sectionIds && options.sectionIds.length > 0) {
        const set = new Set(options.sectionIds);
        targetSections = doc.sections.filter((s) => set.has(s.id));
      } else {
        targetSections = doc.sections.filter(
          (s) =>
            s.status === "pending" ||
            s.status === "failed" ||
            s.status === "writing"
        );
      }
    }

    if (targetSections.length === 0) {
      // Nothing left to write (all already ready)
      const readyTotal = doc.sections.filter((s) => s.status === "ready").length;
      const failedTotal = doc.sections.filter((s) => s.status === "failed").length;
      const finalStatus: PrdStatus = readyTotal >= 1 ? "ready" : "failed";

      emit("run.completed", {
        ready: readyTotal,
        failed: failedTotal,
      });

      await repo.releaseExecutionLock(docId, runId, finalStatus);
      return {
        success: readyTotal >= 1,
        runId,
        ready: readyTotal,
        failed: failedTotal,
      };
    }

    // 4. Section Writer Parallel Pool
    const outline = doc.sections.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      brief: s.brief,
    }));

    // Build question lookup for section context
    const qMap = new Map((doc.brainstorm?.questions || []).map((q) => [q.id, q.text]));
    const qaPairs = (doc.brainstorm?.answers || []).map((a) => ({
      questionText: qMap.get(a.questionId) || a.questionId,
      answerText: a.value,
    }));

    const sectionTask = async (sec: Section) => {
      if (signal?.aborted) return;

      // 4a. Mark writing and emit section.started
      await repo.markSectionWriting(docId, ownerId, sec.id);
      emit("section.started", { sectionId: sec.id });

      try {
        if (signal?.aborted) return;

        // 4b. Write content
        const content = await runSectionWriter({
          idea: doc.idea,
          answers: qaPairs,
          keyDecisions: doc.keyDecisions,
          outline,
          section: {
            id: sec.id,
            title: sec.title,
            type: sec.type,
            brief: sec.brief,
          },
          lang: doc.lang || "id",
          docId: docId.toString(),
          client: options.client,
          signal,
        });

        if (signal?.aborted) return;

        // 4c. Generate diagram if section has diagramHint
        let diagram: Diagram | undefined;
        if (sec.diagramHint) {
          try {
            diagram = await runDiagramGenerator({
              content,
              sectionTitle: sec.title,
              diagramHint: sec.diagramHint,
              lang: doc.lang || "id",
              docId: docId.toString(),
              sectionId: sec.id,
              client: options.client,
              signal,
            });
          } catch (diagErr) {
            console.warn(
              `Diagram generator failed for section ${sec.id}:`,
              diagErr
            );
            diagram = {
              kind: "mermaid",
              code: "",
              status: "invalid",
              error:
                diagErr instanceof Error ? diagErr.message : String(diagErr),
            };
          }
        }

        // 4d. Persist completed section to MongoDB before emitting SSE
        const saveResult = await repo.saveSectionCompleted(
          docId,
          ownerId,
          sec.id,
          content,
          diagram
        );

        if (!saveResult.success) {
          throw new Error(
            `Failed to persist completed section ${sec.id} to database`
          );
        }

        // Update local section copy
        sec.content = content;
        sec.diagram = diagram;
        sec.status = "ready";
        sec.rev = saveResult.rev;

        // 4e. Emit section.completed
        emit("section.completed", {
          sectionId: sec.id,
          rev: saveResult.rev,
          content,
          diagram,
        });
      } catch (sectionErr: unknown) {
        const code =
          sectionErr instanceof AiError ? sectionErr.code : "AI_SERVER_ERROR";
        const message =
          sectionErr instanceof Error ? sectionErr.message : String(sectionErr);

        console.error(`Section ${sec.id} failed:`, message);

        // Save failure state to DB
        await repo.saveSectionFailed(docId, ownerId, sec.id, { code, message });
        sec.status = "failed";
        sec.error = { code, message };

        // Emit section.failed
        emit("section.failed", {
          sectionId: sec.id,
          code,
          message,
        });
      }
    };

    await pool(targetSections, concurrency, sectionTask, signal);

    // 5. Finalization
    if (signal?.aborted) {
      await repo.resetWritingSectionsToPending(docId, ownerId);
      return {
        success: false,
        runId,
        ready: 0,
        failed: 0,
        code: "ABORTED",
        message: "Run cancelled by client",
      };
    }

    // Refresh document state from database if available, or compute from local
    const freshDoc = await repo.getPrdById(docId, ownerId);
    const finalSections = freshDoc?.sections || doc.sections;

    const readyCount = finalSections.filter((s) => s.status === "ready").length;
    const failedCount = finalSections.filter((s) => s.status === "failed").length;

    const finalStatus: PrdStatus = readyCount >= 1 ? "ready" : "failed";

    await repo.releaseExecutionLock(docId, runId, finalStatus);

    emit("run.completed", {
      ready: readyCount,
      failed: failedCount,
    });

    return {
      success: true,
      runId,
      ready: readyCount,
      failed: failedCount,
    };
  } catch (err: unknown) {
    const code = err instanceof AiError ? err.code : "INTERNAL";
    const message = err instanceof Error ? err.message : String(err);

    emit("run.failed", { code, message });
    await repo.releaseExecutionLock(docId, runId, "failed", {
      code,
      message,
      stage: "runner",
      at: new Date(),
    });

    return {
      success: false,
      runId,
      ready: 0,
      failed: 0,
      code,
      message,
    };
  } finally {
    clearInterval(heartbeatInterval);
  }
}
