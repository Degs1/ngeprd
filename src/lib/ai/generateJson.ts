import { z } from "zod";
import { generateText, type CoreMessage } from "ai";
import { getAiClient } from "./client";

export type AiErrorCode =
  | "AI_TIMEOUT"
  | "AI_UNREACHABLE"
  | "AI_INVALID_OUTPUT"
  | "AI_AUTH_ERROR"
  | "AI_SERVER_ERROR"
  | "AI_RATE_LIMIT";

export class AiError extends Error {
  code: AiErrorCode;
  stage?: string;
  docId?: string;
  sectionId?: string;

  constructor(
    code: AiErrorCode,
    message: string,
    options?: { stage?: string; docId?: string; sectionId?: string }
  ) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.stage = options?.stage;
    this.docId = options?.docId;
    this.sectionId = options?.sectionId;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        stage: this.stage,
      },
    };
  }
}

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

function classifyError(err: unknown): {
  code: AiErrorCode;
  retryable: boolean;
  isAuth: boolean;
  isTimeout: boolean;
} {
  const msg = err instanceof Error ? err.message : String(err);
  const status =
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
 * - Handles retries:
 *   - Up to 2 retries for AI_INVALID_OUTPUT (schema mismatch or malformed JSON).
 *   - 1 retry for timeout / 5xx / unreachable network errors with 1s delay.
 *   - 0 retries for 4xx authentication errors.
 *   - Max 3 total attempts.
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
  let attempt = 0;
  let networkRetryCount = 0;

  const messages: CoreMessage[] = [
    {
      role: "user",
      content: options.user,
    },
  ];

  while (attempt < MAX_TOTAL_ATTEMPTS) {
    attempt++;
    const startTime = Date.now();

    try {
      const response = await generateText({
        model: client.chat(modelName),
        system: options.system,
        messages,
        temperature: 0.3,
        abortSignal: AbortSignal.timeout(timeoutMs),
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
        await new Promise((resolve) => setTimeout(resolve, 1000));
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
