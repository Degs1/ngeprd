import { createOpenAI } from "@ai-sdk/openai";
import { COLLECTIONS, getDb } from "../db/mongo";
import { customFetch } from "../ai/client";
import { parseRetryAfterHeader } from "../ai/generateJson";
import type { AiTask } from "../jobs/contracts";
import { reserveCapacity, releaseCapacity, refreshCapacity } from "./capacity";
import { decryptCredential, getEligibleAccounts, listAccounts, listProviders, recordProviderFailure, validateProviderURL } from "./registry";

export class CapacityError extends Error {
  constructor(public permanent: boolean, message: string, public retryAt?: Date) { super(message); }
}

export async function invokeWithPool<T>(task: AiTask, call: (input: {
  client: ReturnType<typeof createOpenAI>; model: string;
  onUsage: (usage: { inputTokens?: number; outputTokens?: number; durationMs: number; attempt: number }) => Promise<void>;
  signal: AbortSignal;
}) => Promise<T>, parentSignal?: AbortSignal): Promise<T> {
  const db = await getDb();
  const previous = await db.collection(COLLECTIONS.AI_USAGE).findOne({ prdId: task.prdId }, { sort: { createdAt: 1 } });
  const preferredModel = typeof previous?.model === "string" ? previous.model : undefined;
  const eligible = await getEligibleAccounts(task.stage, preferredModel);
  if (!eligible.length) {
    const [providers, accounts] = await Promise.all([listProviders(), listAccounts()]);
    const capability = task.stage === "diagram" ? "mermaid" : "json";
    const configured = providers.some((p) => p.enabled && p.capabilities.includes(capability) && (!preferredModel || p.model === preferredModel || p.allowCrossModelFallback) && accounts.some((a) => a.providerId.equals(p._id) && a.enabled));
    throw new CapacityError(!configured, configured ? "No provider account currently available" : "No compatible enabled provider account configured", new Date(Date.now() + 60000));
  }
  let nextRetry = new Date(Date.now() + 60000);
  let lastOutputError: unknown = null;
  for (const { provider, account } of eligible) {
    const reservation = await reserveCapacity(provider, account);
    if (!reservation) continue;
    const controller = new AbortController();
    const abort = () => controller.abort();
    parentSignal?.addEventListener("abort", abort, { once: true });
    if (parentSignal?.aborted) controller.abort();
    const reservationLeaseMs = Math.max(30000, Number(process.env.AI_PROVIDER_RESERVATION_LEASE_MS) || 120000);
    const refresh = setInterval(() => {
      void refreshCapacity(reservation, reservationLeaseMs).then((ok) => { if (!ok) controller.abort(); })
        .catch(() => controller.abort());
    }, Math.floor(reservationLeaseMs / 3));
    let usageId: import("mongodb").ObjectId | undefined;
    try {
      await validateProviderURL(provider.baseURL);
      const client = createOpenAI({ baseURL: provider.baseURL, apiKey: decryptCredential(account.encryptedKey), fetch: customFetch });
      const result = await call({ client, model: provider.model, signal: controller.signal, onUsage: async (usage) => {
        const db = await getDb();
        const recorded = await db.collection(COLLECTIONS.AI_USAGE).insertOne({
          jobId: task.jobId, prdId: task.prdId, taskId: task._id, stage: task.stage,
          providerId: provider._id, accountId: account._id, model: provider.model,
          inputTokens: usage.inputTokens ?? null, outputTokens: usage.outputTokens ?? null,
          durationMs: usage.durationMs, attempt: usage.attempt,
          queueWaitMs: Math.max(0, task.updatedAt.getTime() - task.createdAt.getTime()),
          ...(usage.inputTokens !== undefined && usage.outputTokens !== undefined &&
            provider.inputUsdPerMillion !== undefined && provider.outputUsdPerMillion !== undefined
            ? { costUsd: (usage.inputTokens * provider.inputUsdPerMillion + usage.outputTokens * provider.outputUsdPerMillion) / 1000000 }
            : {}),
          createdAt: new Date(),
        });
        usageId = recorded.insertedId;
      } });
      return result;
    } catch (error: any) {
      if (controller.signal.aborted) throw error;
      if (error instanceof TypeError || error instanceof ReferenceError) {
        throw error;
      }
      const errorCode = String(error?.code || error?.status || "UNKNOWN");
      const status = error?.status || error?.statusCode || error?.cause?.status;
      console.warn(JSON.stringify({
        event: "provider.call_error",
        provider: provider.name,
        model: provider.model,
        error: String(error?.message || error),
        code: errorCode,
        status,
      }));
      if (usageId) await db.collection(COLLECTIONS.AI_USAGE).updateOne({ _id: usageId }, { $set: { outcome: "error", errorCode } });
      else await db.collection(COLLECTIONS.AI_USAGE).insertOne({ jobId: task.jobId, prdId: task.prdId,
        taskId: task._id, stage: task.stage, providerId: provider._id, accountId: account._id,
        model: provider.model, inputTokens: null, outputTokens: null,
        outcome: "error", errorCode, createdAt: new Date() });
      const retryMs = parseRetryAfterHeader(error) || 30000;
      if (status === 401 || status === 403 || error?.code === "AI_AUTH_ERROR") {
        await recordProviderFailure(provider, account, "auth");
      } else if (status === 429 || error?.code === "AI_RATE_LIMIT") {
        const quota = /quota|billing|insufficient/i.test(String(error?.message || ""));
        await recordProviderFailure(provider, account, quota ? "quota" : "temporary", retryMs);
        nextRetry = new Date(Math.max(nextRetry.getTime(), Date.now() + retryMs));
      } else if (status >= 500 || ["AI_TIMEOUT", "AI_SERVER_ERROR", "AI_UNREACHABLE"].includes(error?.code) || /timeout|fetch|network|ECONN/i.test(String(error?.message || ""))) {
        await recordProviderFailure(provider, account, "temporary", retryMs);
      } else if (error?.code === "AI_INVALID_OUTPUT" || error?.code === "AI_SCHEMA_ERROR" || /json|parse|syntax|schema/i.test(String(error?.message || ""))) {
        lastOutputError = error;
      } else if (status === 400 || error?.code === "AI_INCOMPATIBLE_MODEL") {
        await recordProviderFailure(provider, account, "invalid");
      } else {
        await recordProviderFailure(provider, account, "temporary", retryMs);
      }
    } finally {
      clearInterval(refresh);
      parentSignal?.removeEventListener("abort", abort);
      await releaseCapacity(reservation);
    }
  }
  if (lastOutputError) {
    throw lastOutputError;
  }
  const stillConfigured = (await getEligibleAccounts(task.stage, preferredModel)).length > 0;
  if (!stillConfigured) {
    const accounts = await listAccounts();
    const providers = await listProviders();
    const capability = task.stage === "diagram" ? "mermaid" : "json";
    const possible = providers.some((p) => p.enabled && p.capabilities.includes(capability) &&
      (!preferredModel || p.model === preferredModel || p.allowCrossModelFallback) &&
      accounts.some((a) => a.providerId.equals(p._id) && a.enabled));
    if (!possible) throw new CapacityError(true, "No enabled compatible provider account remains");
  }
  throw new CapacityError(false, "All compatible provider accounts are temporarily unavailable", nextRetry);
}
