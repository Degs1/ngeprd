import * as defaultChangeSetRepo from "../db/changeSetRepository";
import { runReviser } from "./reviser";
import { termMatch } from "./impact";
import { runPropagator } from "./propagator";
import type { PrdDocument, Section } from "../schemas/prd";
import type { ChangeItem, PrdChangeSet } from "../schemas/agent";
import type { getAiClient } from "../ai/client";

export type SseEmitter = (event: string, data: unknown) => void;

export interface ChangeSetRunnerRepo {
  updateChangeSet: typeof defaultChangeSetRepo.updateChangeSet;
  deleteChangeSet: typeof defaultChangeSetRepo.deleteChangeSet;
  getChangeSetById: typeof defaultChangeSetRepo.getChangeSetById;
}

export interface RunChangeSetOptions {
  doc: PrdDocument;
  originSectionId: string;
  instruction: string;
  ownerId: string;
  changesetId: string;
  concurrency?: number;
  signal?: AbortSignal;
  client?: ReturnType<typeof getAiClient>;
  emit: SseEmitter;
  repo?: Partial<ChangeSetRunnerRepo>;
}

export interface RunChangeSetResult {
  success: boolean;
  changesetId: string;
  redirect?: boolean;
  code?: string;
  message?: string;
}

/**
 * Concurrency worker pool executing tasks up to concurrencyLimit in parallel.
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
 * Orchestrates multi-section chained AI revisions:
 * 1. Emits changeset.started and starts 15s heartbeat interval.
 * 2. Runs Reviser with full PRD context.
 * 3. Handles redirect (deletes changeset and emits changeset.redirect).
 * 4. Merges AI impact with deterministic regex term-matching (termMatch).
 * 5. Runs Propagator pool across all impacted sections.
 * 6. Emits individual item.ready / item.failed and completes with changeset.ready.
 * 7. Persists changeset to MongoDB (prd_changesets).
 *
 * IMPORTANT: Document sections are NEVER touched or modified until the user explicitly accepts/applies.
 */
export async function runChangeSetGeneration(
  options: RunChangeSetOptions
): Promise<RunChangeSetResult> {
  const repo: ChangeSetRunnerRepo = {
    updateChangeSet: defaultChangeSetRepo.updateChangeSet,
    deleteChangeSet: defaultChangeSetRepo.deleteChangeSet,
    getChangeSetById: defaultChangeSetRepo.getChangeSetById,
    ...options.repo,
  };

  const {
    doc,
    originSectionId,
    instruction,
    ownerId,
    changesetId,
    emit,
    signal,
    client,
  } = options;

  const concurrency =
    options.concurrency ||
    Number(process.env.AGENT_CONCURRENCY) ||
    3;

  // 1. Emit changeset.started
  emit("changeset.started", { changesetId });

  // Start 15s heartbeat interval
  const heartbeatInterval = setInterval(async () => {
    try {
      await repo.updateChangeSet(changesetId, ownerId, { updatedAt: new Date() });
      emit("heartbeat", {});
    } catch {
      // Ignore background heartbeat ping errors
    }
  }, 15000);

  try {
    const originSection = doc.sections.find((s) => s.id === originSectionId);
    if (!originSection) {
      throw new Error(`Origin section "${originSectionId}" not found in document`);
    }

    // 2. Run Reviser
    const reviserResult = await runReviser({
      doc,
      originSectionId,
      instruction,
      lang: doc.lang,
      client,
      signal,
    });

    if (signal?.aborted) {
      throw new Error("Revision process aborted by client");
    }

    // 3. Handle redirect
    if (reviserResult.scope === "redirect") {
      clearInterval(heartbeatInterval);
      await repo.deleteChangeSet(changesetId, ownerId);
      emit("changeset.redirect", {
        sectionId: reviserResult.redirect?.sectionId,
        reason: reviserResult.redirect?.reason,
      });
      return {
        success: true,
        changesetId,
        redirect: true,
      };
    }

    // 4. Build origin item
    const originItem: ChangeItem = {
      sectionId: originSectionId,
      role: "origin",
      reason: instruction,
      detectedBy: "origin",
      baseRev: originSection.rev,
      before: {
        title: originSection.title,
        content: originSection.content,
        diagramCode: originSection.diagram?.code,
      },
      after: {
        title: reviserResult.origin?.title || originSection.title,
        content: reviserResult.origin!.content,
        diagramCode:
          reviserResult.origin?.diagramCode ?? originSection.diagram?.code,
      },
      status: "ready",
    };

    emit("origin.ready", {
      sectionId: originSectionId,
      after: originItem.after,
      rationale: reviserResult.rationale,
      warnings: reviserResult.warnings,
      keyDecisionChanges: reviserResult.keyDecisionChanges,
    });

    // 5. Term-match safety net
    const impactResults = termMatch(
      reviserResult.replacedTerms,
      doc.sections,
      originSectionId,
      reviserResult.impacted,
      doc.lang
    );

    emit("impact.ready", {
      items: impactResults.map((r) => ({
        sectionId: r.sectionId,
        reason: r.reason,
        detectedBy: r.detectedBy,
      })),
    });

    // Build initial impacted change items
    const impactedItems: ChangeItem[] = [];
    for (const r of impactResults) {
      const sec = doc.sections.find((s) => s.id === r.sectionId);
      if (!sec) continue;

      impactedItems.push({
        sectionId: r.sectionId,
        role: "impacted",
        reason: r.reason,
        detectedBy: r.detectedBy,
        baseRev: sec.rev,
        before: {
          title: sec.title,
          content: sec.content,
          diagramCode: sec.diagram?.code,
        },
        after: null,
        status: "pending",
      });
    }

    // 6. Propagator pool across impacted items
    const originSummary = {
      title: originItem.after?.title || originSection.title,
      contentSummary: originItem.after?.content.slice(0, 400) || "",
    };

    await pool(
      impactedItems,
      concurrency,
      async (item) => {
        const sec = doc.sections.find((s) => s.id === item.sectionId);
        if (!sec) {
          item.status = "failed";
          item.error = { code: "NOT_FOUND", message: "Section not found" };
          emit("item.failed", {
            sectionId: item.sectionId,
            code: "NOT_FOUND",
            message: "Section not found",
          });
          return;
        }

        try {
          const propResult = await runPropagator({
            section: sec,
            keyDecisionChanges: reviserResult.keyDecisionChanges,
            originSummary,
            reason: item.reason,
            lang: doc.lang,
            docId: doc._id?.toString(),
            client,
            signal,
          });

          item.after = {
            title: sec.title,
            content: propResult.content,
            diagramCode: propResult.diagramCode ?? sec.diagram?.code,
          };
          item.status = "ready";

          emit("item.ready", {
            sectionId: item.sectionId,
            after: item.after,
          });
        } catch (err: unknown) {
          const e = err as { code?: string; message?: string };
          item.status = "failed";
          const code = e?.code || "AI_FAILED";
          const message = e?.message || "Gagal memperbarui section terkait";
          item.error = { code, message };

          emit("item.failed", {
            sectionId: item.sectionId,
            code,
            message,
          });
        }
      },
      signal
    );

    if (signal?.aborted) {
      throw new Error("Revision process aborted by client");
    }

    // 7. Persist completed changeset to MongoDB with status 'pending'
    const allItems: ChangeItem[] = [originItem, ...impactedItems];
    await repo.updateChangeSet(changesetId, ownerId, {
      status: "pending",
      rationale: reviserResult.rationale,
      warnings: reviserResult.warnings,
      keyDecisionChanges: reviserResult.keyDecisionChanges,
      items: allItems,
      updatedAt: new Date(),
    });

    emit("changeset.ready", { changesetId });

    return {
      success: true,
      changesetId,
    };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    const code = e?.code || "AI_FAILED";
    const message = e?.message || "Gagal menjalankan revisi AI";

    try {
      await repo.updateChangeSet(changesetId, ownerId, {
        status: "failed",
        error: { code, message },
        updatedAt: new Date(),
      });
    } catch {
      // Ignore DB error during failure persistence
    }

    emit("changeset.failed", { code, message });

    return {
      success: false,
      changesetId,
      code,
      message,
    };
  } finally {
    clearInterval(heartbeatInterval);
  }
}
