import { z } from "zod";

/**
 * Schema for an individual structured question.
 */
export const QuestionItemSchema = z.object({
  id: z.string().describe("Unique identifier for question, e.g. q-platform, q-tech-stack"),
  category: z.string().describe("Category of the planning decision, e.g. Tech Stack, Target Platform, MVP Scope"),
  question: z.string().describe("Clear, concise decision question for the solo developer"),
  suggestions: z
    .array(z.string())
    .min(2)
    .describe("List of 2 to 4 concrete multiple-choice options or recommendations"),
});

export type QuestionItem = z.infer<typeof QuestionItemSchema>;

/**
 * Structured response schema containing a list of questions.
 */
export const QuestionsResponseSchema = z.object({
  questions: z.array(QuestionItemSchema).min(3).max(5).describe("List of 3 to 5 structured questions"),
});

export const QuestionsArraySchema = z.array(QuestionItemSchema).min(3).max(5);

export type QuestionsResponse = z.infer<typeof QuestionsResponseSchema>;

/**
 * Returns system instructions for the AI questions generator.
 */
export function getQuestionsSystemPrompt(): string {
  return `Kamu adalah Senior Product Architect & Engineering Lead di platform visual planning "ngePRD".
Tugasmu adalah membedah ide produk digital dari solo developer atau vibe coder dan merumuskan 3 sampai 5 pertanyaan terstruktur pilihan ganda yang paling krusial untuk menentukan spesifikasi produk (PRD) dan arsitektur teknis MVP.

Panduan:
1. Pertanyaan harus berfokus pada keputusan arsitektur teknis, platform target, ruang lingkup MVP, atau alur transaksi/data utama.
2. Setiap pertanyaan wajib memiliki 2 sampai 4 opsi pilihan (suggestions) yang konkret, realistis, dan relevan dengan ide proyek.
3. Gunakan Bahasa Indonesia yang jelas, ringkas, dan profesional.
4. Format output HARUS merupakan JSON valid tanpa penjelasan teks lain di luar JSON.

Format JSON yang diwajibkan:
{
  "questions": [
    {
      "id": "q-unique-identifier",
      "category": "Tech Stack / Platform / MVP Scope / Monetisasi",
      "question": "Pertanyaan keputusan yang jelas?",
      "suggestions": ["Opsi 1", "Opsi 2", "Opsi 3"]
    }
  ]
}`;
}

/**
 * Builds user prompt for question generation.
 */
export function buildQuestionsPrompt(idea: string): string {
  return `Ide produk: "${idea}".
Buatlah 3-5 pertanyaan keputusan arsitektur dan ruang lingkup MVP yang paling esensial dalam format JSON yang telah ditentukan.`;
}
