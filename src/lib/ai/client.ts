import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import {
  QuestionsResponseSchema,
  QuestionItemSchema,
  getQuestionsSystemPrompt,
  buildQuestionsPrompt,
  type QuestionItem,
} from "./prompts";
import { getFallbackQuestions } from "./fallback";

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
 * Custom fetch wrapper for 9router:
 * Ensures stream=false is sent to prevent raw SSE chunk streams on non-streaming calls.
 */
const customFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  if (init && init.body && typeof init.body === "string") {
    try {
      const parsed = JSON.parse(init.body);
      if (parsed.stream === undefined || parsed.stream === true) {
        parsed.stream = false;
        init = {
          ...init,
          body: JSON.stringify(parsed),
        };
      }
    } catch {
      // Body is not JSON, leave untouched
    }
  }
  return fetch(input, init);
};

/**
 * Creates OpenAI compatible AI SDK client pointing to 9router proxy.
 */
export function getAiClient() {
  const baseURL =
    process.env.AI_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "http://127.0.0.1:20128/v1";

  const apiKey =
    process.env.AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "sk-035aa783d373c298-t4mmyi-35d0e9a7";

  return createOpenAI({
    baseURL,
    apiKey,
    fetch: customFetch,
  });
}

/**
 * Generates structured questions for a given project idea.
 * Validates output with Zod schema and falls back to mock questions if the AI proxy is unreachable.
 */
export async function generateQuestions(idea: string): Promise<QuestionItem[]> {
  const fallback = getFallbackQuestions(idea);

  try {
    const openai = getAiClient();
    const modelName = process.env.AI_MODEL || "gemini";

    const { text } = await generateText({
      model: openai.chat(modelName),
      system: getQuestionsSystemPrompt(),
      prompt: buildQuestionsPrompt(idea),
      temperature: 0.3,
    });

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
