import { z } from "zod";
import { generateText, type CoreMessage } from "ai";
import { getAiClient } from "./client";
import { AiError, type AiErrorCode } from "./aiError";
import { aiQueue } from "./aiQueue";

export { AiError, type AiErrorCode };

export interface GenerateJsonOptions<T extends z.ZodTypeAny> {
  stage: string;
  system: string;
  user: string;
  schema: T;
  timeoutMs?: number;
  docId?: string;
  sectionId?: string;
  client?: ReturnType<typeof getAiClient>;
  model?: string;
  signal?: AbortSignal;
  bypassQueue?: boolean;
}

/**
 * Strips markdown code block wrappers (```json ... ```) and extracts
 * the first JSON object or array from the given text.
 */
export function extractJsonFromText(raw: string): string {
  let text = raw.trim();

  // If text is wrapped in ```json ... ``` or ``` ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    text = codeBlockMatch[1].trim();
  }

  // Find outermost object { ... } or array [ ... ]
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");

  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = text.lastIndexOf("}");
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = text.lastIndexOf("]");
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    text = text.slice(startIdx, endIdx + 1).trim();
  }

  return text;
}

/**
 * Parses HTTP Retry-After headers or error messages to find recommended delay in milliseconds.
 */
export function parseRetryAfterHeader(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;

  const target = (err as { lastError?: unknown })?.lastError || (err as { cause?: unknown })?.cause || err;

  const headers =
    (target as { responseHeaders?: Headers | Record<string, string> })?.responseHeaders ||
    (target as { headers?: Headers | Record<string, string> })?.headers ||
    (target as { response?: { headers?: Headers | Record<string, string> } })?.response?.headers ||
    (err as { responseHeaders?: Headers | Record<string, string> })?.responseHeaders ||
    (err as { headers?: Headers | Record<string, string> })?.headers;

  let rawHeader: string | null = null;
  let rawMsHeader: string | null = null;

  if (headers) {
    if (typeof (headers as Headers).get === "function") {
      rawHeader = (headers as Headers).get("retry-after");
      rawMsHeader =
        (headers as Headers).get("retry-after-ms") ||
        (headers as Headers).get("x-ratelimit-reset-after-ms");
    } else if (typeof headers === "object") {
      const h = headers as Record<string, string>;
      for (const [key, value] of Object.entries(h)) {
        const lower = key.toLowerCase();
        if (lower === "retry-after") rawHeader = String(value);
        if (lower === "retry-after-ms" || lower === "x-ratelimit-reset-after-ms") {
          rawMsHeader = String(value);
        }
      }
    }
  }

  if (rawMsHeader) {
    const ms = Number(rawMsHeader);
    if (!isNaN(ms) && ms > 0) return ms;
  }

  if (rawHeader) {
    const sec = Number(rawHeader);
    if (!isNaN(sec) && sec >= 0) {
      return Math.round(sec * 1000);
    }
    const parsedDate = Date.parse(rawHeader);
    if (!isNaN(parsedDate)) {
      const diff = parsedDate - Date.now();
      return diff > 0 ? diff : 1000;
    }
  }

  // Parse error message text for clues like "retry after 5 seconds" or "try again in 2000ms"
  const msg = err instanceof Error ? err.message : String(err);
  const regexSec = /(?:retry after|try again in|resets in)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:s|sec|seconds)/i;
  const matchSec = msg.match(regexSec);
  if (matchSec && matchSec[1]) {
    const sec = parseFloat(matchSec[1]);
    if (!isNaN(sec) && sec > 0) return Math.round(sec * 1000);
  }

  const regexMs = /(?:retry after|try again in|resets in)\s*([0-9]+)\s*ms/i;
  const matchMs = msg.match(regexMs);
  if (matchMs && matchMs[1]) {
    const ms = parseInt(matchMs[1], 10);
    if (!isNaN(ms) && ms > 0) return ms;
  }

  return null;
}

/**
 * Calculates backoff delay in milliseconds for rate limit retries with full jitter.
 */
export function calculateRateLimitDelayMs(
  retryCount: number,
  err?: unknown,
  baseDelayMs = 2000,
  maxDelayMs = 30000
): number {
  const explicit = parseRetryAfterHeader(err);
  if (explicit !== null) {
    const jitter = Math.floor(Math.random() * Math.min(explicit, 300)) + 10;
    return Math.min(Math.max(explicit + jitter, 10), maxDelayMs);
  }

  // Exponential backoff: baseDelay * 2^retryCount + jitter
  const expDelay = baseDelayMs * Math.pow(2, retryCount);
  const jitter = Math.floor(Math.random() * 1000);
  return Math.min(expDelay + jitter, maxDelayMs);
}

/**
 * Sleeps for the given duration, aborting early if the AbortSignal triggers.
 */
export function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(
        new AiError("AI_TIMEOUT", "Operasi AI dibatalkan oleh pengguna", {})
      );
    }
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(
        new AiError("AI_TIMEOUT", "Operasi AI dibatalkan oleh pengguna", {})
      );
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function classifyError(err: unknown): {
  code: AiErrorCode;
  retryable: boolean;
  isAuth: boolean;
  isTimeout: boolean;
} {
  const target = (err as { lastError?: unknown })?.lastError || (err as { cause?: unknown })?.cause || err;
  const msg = err instanceof Error ? err.message : String(err);
  const status =
    (target as { status?: number; statusCode?: number })?.status ||
    (target as { status?: number; statusCode?: number })?.statusCode ||
    (err as { status?: number; statusCode?: number })?.status ||
    (err as { status?: number; statusCode?: number })?.statusCode;

  if (
    (err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError")) ||
    msg.toLowerCase().includes("timeout") ||
    msg.toLowerCase().includes("aborted")
  ) {
    return { code: "AI_TIMEOUT", retryable: true, isAuth: false, isTimeout: true };
  }

  if (
    status === 401 ||
    status === 403 ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.toLowerCase().includes("unauthorized") ||
    msg.toLowerCase().includes("forbidden") ||
    msg.toLowerCase().includes("invalid api key")
  ) {
    return { code: "AI_AUTH_ERROR", retryable: false, isAuth: true, isTimeout: false };
  }

  if (
    status === 429 ||
    msg.includes("429") ||
    msg.toLowerCase().includes("rate limit") ||
    msg.toLowerCase().includes("too many requests")
  ) {
    return { code: "AI_RATE_LIMIT", retryable: true, isAuth: false, isTimeout: false };
  }

  if (status && status >= 500) {
    return { code: "AI_SERVER_ERROR", retryable: true, isAuth: false, isTimeout: false };
  }

  if (
    msg.includes("ECONNREFUSED") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("fetch failed") ||
    msg.includes("Failed to fetch")
  ) {
    return { code: "AI_UNREACHABLE", retryable: true, isAuth: false, isTimeout: false };
  }

  return { code: "AI_UNREACHABLE", retryable: true, isAuth: false, isTimeout: false };
}

/**
 * Universal structured AI caller:
 * - Extracts JSON, strips markdown fences, validates with Zod.
 * - Managed via global concurrency limiter & document-aware fair queue.
 * - Handles retries:
 *   - Up to 2 retries for AI_INVALID_OUTPUT (schema mismatch or malformed JSON).
 *   - Up to 3 retries for AI_RATE_LIMIT (429) with exponential backoff, jitter, and circuit-breaker pause.
 *   - 1 retry for timeout / 5xx / unreachable network errors with 1s delay.
 *   - 0 retries for 4xx authentication errors.
 *   - Max 3 total attempts for model prompt corrections.
 * - Logs structured metrics without leaking user prompt content.
 */
export async function generateJson<T extends z.ZodTypeAny>(
  options: GenerateJsonOptions<T>
): Promise<z.infer<T>> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const timeoutMs = options.timeoutMs || Number(process.env.AI_TIMEOUT_MS) || 45000;
  const client = options.client || getAiClient();
  const modelName = options.model || process.env.AI_MODEL || "gemini";

  const MAX_TOTAL_ATTEMPTS = 3;
  const MAX_RATE_LIMIT_RETRIES = Number(process.env.AI_MAX_RATE_LIMIT_RETRIES) || 3;

  let attempt = 0;
  let networkRetryCount = 0;
  let rateLimitRetryCount = 0;

  const messages: CoreMessage[] = [
    {
      role: "user",
      content: options.user,
    },
  ];

  while (attempt < MAX_TOTAL_ATTEMPTS) {
    if (options.signal?.aborted) {
      throw new AiError("AI_TIMEOUT", "Operasi AI dibatalkan oleh pengguna", {
        stage: options.stage,
        docId: options.docId,
        sectionId: options.sectionId,
      });
    }
    attempt++;
    const startTime = Date.now();

    try {
      const callAi = () =>
        generateText({
          model: client.chat(modelName),
          system: options.system,
          messages,
          temperature: 0.3,
          maxRetries: 0,
          abortSignal: options.signal
            ? AbortSignal.any([AbortSignal.timeout(timeoutMs), options.signal])
            : AbortSignal.timeout(timeoutMs),
        });

      // Route via global queue unless bypassQueue is specified
      const response = options.bypassQueue
        ? await callAi()
        : await aiQueue.enqueue(callAi, {
            docId: options.docId,
            stage: options.stage,
            signal: options.signal,
          });

      const rawText = response.text;
      const durationMs = Date.now() - startTime;

      // Extract JSON and parse
      let parsed: unknown;
      try {
        const cleaned = extractJsonFromText(rawText);
        parsed = JSON.parse(cleaned);
      } catch (parseErr: unknown) {
        const parseMsg =
          parseErr instanceof Error ? parseErr.message : String(parseErr);

        if (attempt < MAX_TOTAL_ATTEMPTS) {
          console.info(
            JSON.stringify({
              requestId,
              docId: options.docId,
              stage: options.stage,
              sectionId: options.sectionId,
              attempt,
              durationMs,
              outcome: "retry",
              reason: "json_parse_failed",
            })
          );

          messages.push({ role: "assistant", content: rawText });
          messages.push({
            role: "user",
            content: `Output sebelumnya tidak dapat di-parse sebagai JSON (${parseMsg}). Harap perbaiki dan kembalikan JSON saja tanpa teks pembuka atau code fence.`,
          });
          continue;
        } else {
          console.error(
            JSON.stringify({
              requestId,
              docId: options.docId,
              stage: options.stage,
              sectionId: options.sectionId,
              attempt,
              durationMs,
              outcome: "failure",
              reason: "json_parse_exhausted",
            })
          );
          throw new AiError(
            "AI_INVALID_OUTPUT",
            `Gagal membaca respons JSON dari model: ${parseMsg}`,
            {
              stage: options.stage,
              docId: options.docId,
              sectionId: options.sectionId,
            }
          );
        }
      }

      // Validate against Zod schema
      const validation = options.schema.safeParse(parsed);
      if (!validation.success) {
        const errorSummary = validation.error.issues
          .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
          .join(", ");

        if (attempt < MAX_TOTAL_ATTEMPTS) {
          console.info(
            JSON.stringify({
              requestId,
              docId: options.docId,
              stage: options.stage,
              sectionId: options.sectionId,
              attempt,
              durationMs,
              outcome: "retry",
              reason: "schema_validation_failed",
            })
          );

          messages.push({ role: "assistant", content: rawText });
          messages.push({
            role: "user",
            content: `Output JSON tidak sesuai dengan skema yang diharapkan (${errorSummary}). Kembalikan JSON saja yang mematuhi skema secara ketat.`,
          });
          continue;
        } else {
          console.error(
            JSON.stringify({
              requestId,
              docId: options.docId,
              stage: options.stage,
              sectionId: options.sectionId,
              attempt,
              durationMs,
              outcome: "failure",
              reason: "schema_validation_exhausted",
            })
          );
          throw new AiError(
            "AI_INVALID_OUTPUT",
            `Validasi skema AI gagal setelah ${attempt} percobaan: ${errorSummary}`,
            {
              stage: options.stage,
              docId: options.docId,
              sectionId: options.sectionId,
            }
          );
        }
      }

      // Successful result
      console.info(
        JSON.stringify({
          requestId,
          docId: options.docId,
          stage: options.stage,
          sectionId: options.sectionId,
          attempt,
          durationMs,
          outcome: "success",
        })
      );

      return validation.data;
    } catch (err: unknown) {
      if (options.signal?.aborted) {
        throw new AiError("AI_TIMEOUT", "Operasi AI dibatalkan oleh pengguna", {
          stage: options.stage,
          docId: options.docId,
          sectionId: options.sectionId,
        });
      }
      if (err instanceof AiError) {
        throw err;
      }

      const durationMs = Date.now() - startTime;
      const classification = classifyError(err);
      const errMsg = err instanceof Error ? err.message : String(err);

      // Auth errors fail immediately with no retry
      if (classification.isAuth) {
        console.error(
          JSON.stringify({
            requestId,
            docId: options.docId,
            stage: options.stage,
            sectionId: options.sectionId,
            attempt,
            durationMs,
            outcome: "failure",
            reason: "auth_error",
          })
        );
        throw new AiError(
          "AI_AUTH_ERROR",
          `Autentikasi AI gagal: ${errMsg}`,
          {
            stage: options.stage,
            docId: options.docId,
            sectionId: options.sectionId,
          }
        );
      }

      // Specialized handling for Rate Limit (429) with exponential backoff & jitter
      if (classification.code === "AI_RATE_LIMIT") {
        if (rateLimitRetryCount < MAX_RATE_LIMIT_RETRIES) {
          const delayMs = calculateRateLimitDelayMs(rateLimitRetryCount, err);
          rateLimitRetryCount++;

          console.warn(
            JSON.stringify({
              requestId,
              docId: options.docId,
              stage: options.stage,
              sectionId: options.sectionId,
              attempt,
              rateLimitRetryCount,
              delayMs,
              outcome: "retry",
              reason: "AI_RATE_LIMIT",
            })
          );

          // Inform global queue to pause outgoing requests for the duration
          aiQueue.notifyRateLimit(delayMs);

          // Decrement attempt counter so rate limit wait doesn't burn prompt attempts
          attempt--;

          await sleepWithSignal(delayMs, options.signal);
          continue;
        } else {
          console.error(
            JSON.stringify({
              requestId,
              docId: options.docId,
              stage: options.stage,
              sectionId: options.sectionId,
              attempt,
              rateLimitRetryCount,
              durationMs,
              outcome: "failure",
              reason: "AI_RATE_LIMIT_EXHAUSTED",
            })
          );

          throw new AiError(
            "AI_RATE_LIMIT",
            "Batas permintaan AI (Rate Limit / RPM) terlampaui. Gateway sedang sibuk, silakan coba beberapa saat lagi.",
            {
              stage: options.stage,
              docId: options.docId,
              sectionId: options.sectionId,
            }
          );
        }
      }

      // Check if we can do network/timeout retry (at most 1 retry with 1s delay)
      if (
        classification.retryable &&
        networkRetryCount < 1 &&
        attempt < MAX_TOTAL_ATTEMPTS
      ) {
        networkRetryCount++;
        console.warn(
          JSON.stringify({
            requestId,
            docId: options.docId,
            stage: options.stage,
            sectionId: options.sectionId,
            attempt,
            durationMs,
            outcome: "retry",
            reason: classification.code,
          })
        );

        // 1 second delay before network retry
        await sleepWithSignal(1000, options.signal);
        continue;
      }

      // Retries exhausted or non-retryable
      console.error(
        JSON.stringify({
          requestId,
          docId: options.docId,
          stage: options.stage,
          sectionId: options.sectionId,
          attempt,
          durationMs,
          outcome: "failure",
          reason: classification.code,
        })
      );

      const userFriendlyMessage =
        classification.code === "AI_TIMEOUT"
          ? "Permintaan ke AI mengalami batas waktu (timeout). Silakan coba lagi."
          : `Gagal menghubungi layanan AI: ${errMsg}`;

      throw new AiError(classification.code, userFriendlyMessage, {
        stage: options.stage,
        docId: options.docId,
        sectionId: options.sectionId,
      });
    }
  }

  throw new AiError(
    "AI_UNREACHABLE",
    "Percobaan AI telah mencapai batas maksimal.",
    {
      stage: options.stage,
      docId: options.docId,
      sectionId: options.sectionId,
    }
  );
}
