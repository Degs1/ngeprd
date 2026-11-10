import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { aiQueue } from "./aiQueue";
import {
  QuestionsResponseSchema,
  QuestionItemSchema,
  getQuestionsSystemPrompt,
  buildQuestionsPrompt,
  type QuestionItem,
} from "./prompts";
import { getFallbackQuestions } from "./fallback";
import {
  getPrdSystemPrompt,
  buildPrdPrompt,
} from "./prdPrompt";

/**
 * Strips markdown code block wrappers (e.g. ```json ... ```) and leading/trailing whitespace.
 */
export function extractJsonFromText(raw: string): string {
  let text = raw.trim();

  // If text is wrapped in ```json ... ``` or ``` ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    text = codeBlockMatch[1].trim();
  }

  // If text starts with non-json characters, find the first '{' or '[' and matching end
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
 * Strips outer markdown code block wrapper if the LLM wrapped the whole document in ```markdown ... ```.
 */
export function extractMarkdownFromText(raw: string): string {
  let text = raw.trim();
  const mdMatch = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (mdMatch && mdMatch[1]) {
    text = mdMatch[1].trim();
  }
  return text;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(val: unknown): val is string {
  return typeof val === "string" && UUID_REGEX.test(val);
}

/**
 * Custom fetch wrapper for AI Gateway / 9router:
 * - Injects 'Idempotency-Key' header (RFC 4122 UUID) on every request if not already present or invalid.
 * - Ensures stream=false is sent on calls where stream is undefined (like generateText)
 *   while preserving stream=true for streaming calls (like streamText).
 */
export const customFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const headersObj: Record<string, string> = {};
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((val, key) => {
        headersObj[key] = val;
      });
    } else if (Array.isArray(init.headers)) {
      for (const [key, val] of init.headers) {
        headersObj[key] = val;
      }
    } else {
      Object.assign(headersObj, init.headers);
    }
  } else if (typeof input === "object" && "headers" in input && input.headers) {
    if (input.headers instanceof Headers) {
      input.headers.forEach((val, key) => {
        headersObj[key] = val;
      });
    }
  }

  // Ensure 'Idempotency-Key' header is present and is a valid RFC 4122 UUID
  const existingKey = Object.keys(headersObj).find(
    (k) => k.toLowerCase() === "idempotency-key"
  );
  if (!existingKey || !isValidUuid(headersObj[existingKey])) {
    if (existingKey) {
      delete headersObj[existingKey];
    }
    headersObj["Idempotency-Key"] = crypto.randomUUID();
  }

  let body = init?.body;
  if (body && typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      if (parsed.stream === undefined) {
        parsed.stream = false;
        body = JSON.stringify(parsed);
      }
    } catch {
      // Body is not JSON, leave untouched
    }
  }

  return fetch(input, {
    ...init,
    headers: headersObj,
    body,
  });
};

/**
 * Creates OpenAI compatible AI SDK client pointing to 9router proxy.
 */
export function getAiClient() {
  const baseURL =
    process.env.AI_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "";

  const apiKey =
    process.env.AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";

  if (!baseURL || !apiKey) throw new Error("Legacy AI client is not configured");

  return createOpenAI({
    baseURL,
    apiKey,
    fetch: customFetch,
  });
}

/**
 * Generates structured questions for a given project idea.
 * Validates output with Zod schema and falls back to mock questions if the AI proxy is unreachable.
 * Concurrency & rate-limits are managed through aiQueue.
 */
export async function generateQuestions(idea: string): Promise<QuestionItem[]> {
  const fallback = getFallbackQuestions(idea);

  try {
    const openai = getAiClient();
    const modelName = process.env.AI_MODEL || "gemini";

    const { text } = await aiQueue.enqueue(
      () =>
        generateText({
          model: openai.chat(modelName),
          system: getQuestionsSystemPrompt(),
          prompt: buildQuestionsPrompt(idea),
          temperature: 0.3,
          abortSignal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS) || 45000),
        }),
      { stage: "questions" }
    );

    const cleanedJson = extractJsonFromText(text);
    const parsed = JSON.parse(cleanedJson);

    // Validate if response is an object with questions array
    const objectValidation = QuestionsResponseSchema.safeParse(parsed);
    if (objectValidation.success && objectValidation.data.questions.length > 0) {
      return objectValidation.data.questions;
    }

    // Validate if response is a root array
    if (Array.isArray(parsed)) {
      const questions: QuestionItem[] = [];
      for (const item of parsed) {
        const itemResult = QuestionItemSchema.safeParse(item);
        if (itemResult.success) {
          questions.push(itemResult.data);
        }
      }
      if (questions.length >= 2) {
        return questions;
      }
    }

    console.warn(
      "[AI questions] Response did not match schema, falling back to mock data:",
      text.slice(0, 100)
    );
    return fallback;
  } catch (err) {
    console.warn(
      "[AI questions] Proxy unreachable or failed, using fallback mock data:",
      err instanceof Error ? err.message : String(err)
    );
    return fallback;
  }
}

/**
 * Generates a complete Markdown PRD document with task breakdown.
 * Falls back to high-quality template synthesis if upstream AI fails.
 * Concurrency & rate-limits are managed through aiQueue.
 */
export async function generatePrd(
  idea: string,
  answersInput?: unknown
): Promise<string> {
  const openai = getAiClient();
  const modelName = process.env.AI_MODEL || "gemini";

  const { text } = await aiQueue.enqueue(
    () =>
      generateText({
        model: openai.chat(modelName),
        system: getPrdSystemPrompt(),
        prompt: buildPrdPrompt(idea, answersInput),
        temperature: 0.4,
        abortSignal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS) || 45000),
      }),
    { stage: "legacy-prd" }
  );

  const cleanedMarkdown = extractMarkdownFromText(text);

  if (
    cleanedMarkdown.includes("#") &&
    (cleanedMarkdown.includes("Ringkasan") || cleanedMarkdown.includes("Summary") || cleanedMarkdown.includes("Task"))
  ) {
    return cleanedMarkdown;
  }

  throw new Error("AI did not produce valid PRD format");
}

/**
 * Initiates a streaming text generation for PRD synthesis.
 */
export async function streamPrd(idea: string, answersInput?: unknown) {
  const openai = getAiClient();
  const modelName = process.env.AI_MODEL || "gemini";

  return streamText({
    model: openai.chat(modelName),
    system: getPrdSystemPrompt(),
    prompt: buildPrdPrompt(idea, answersInput),
    temperature: 0.4,
  });
}
