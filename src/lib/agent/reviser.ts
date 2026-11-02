import { z } from "zod";
import { generateJson } from "../ai/generateJson";
import { sanitizeSectionMarkdown } from "./sectionWriter";
import { cleanMermaidCode } from "./diagramGenerator";
import type { PrdDocument, Section } from "../schemas/prd";
import type { getAiClient } from "../ai/client";

export const ReviserRedirectSchema = z.object({
  sectionId: z.string().min(1),
  reason: z.string().min(1),
});
export type ReviserRedirect = z.infer<typeof ReviserRedirectSchema>;

export const ReviserOriginSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1),
  diagramCode: z.string().optional(),
});
export type ReviserOrigin = z.infer<typeof ReviserOriginSchema>;

export const KeyDecisionChangeSchema = z.object({
  before: z.string().optional(),
  after: z.string().min(1),
});
export type KeyDecisionChange = z.infer<typeof KeyDecisionChangeSchema>;

export const ReviserImpactedItemSchema = z.object({
  sectionId: z.string().min(1),
  reason: z.string().min(1),
});
export type ReviserImpactedItem = z.infer<typeof ReviserImpactedItemSchema>;

export const ReviserOutputSchema = z
  .object({
    scope: z.enum(["ok", "redirect"]),
    redirect: ReviserRedirectSchema.optional(),
    origin: ReviserOriginSchema.optional(),
    keyDecisionChanges: z.array(KeyDecisionChangeSchema).default([]),
    replacedTerms: z.array(z.string().min(1)).max(10).default([]),
    impacted: z.array(ReviserImpactedItemSchema).default([]),
    warnings: z.array(z.string()).default([]),
    rationale: z.string().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.scope === "redirect") {
      if (!data.redirect || !data.redirect.sectionId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "redirect with sectionId and reason is required when scope is 'redirect'",
          path: ["redirect"],
        });
      }
    } else {
      if (!data.origin || !data.origin.content) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "origin with content is required when scope is 'ok'",
          path: ["origin"],
        });
      }
    }
  });

export type ReviserOutput = z.infer<typeof ReviserOutputSchema>;

export function getReviserSystemPrompt(lang: "id" | "en" = "id"): string {
  if (lang === "en") {
    return `You are a Principal Product Architect and PRD Revision Engine.
Your task is to analyze a user's revision instruction targeted at a specific "origin" section within the context of the ENTIRE Product Requirement Document (PRD) and its key architectural decisions.

CRITICAL RULES:
1. Scope Analysis:
   - If the instruction clearly addresses a topic belonging to a DIFFERENT section (e.g. asking for authentication UI when origin is Tech Stack), return:
     {
       "scope": "redirect",
       "redirect": { "sectionId": "<matching_section_id>", "reason": "Explain why this instruction belongs to that section" }
     }
     and omit "origin".
   - Otherwise, set "scope": "ok".

2. Minimal & Targeted Origin Revision:
   - Revise the origin section content with MINIMAL changes. Keep parts of the section that are NOT related to the instruction strictly unchanged.
   - For broad requests (e.g. "I want to use Python"), choose standard, modern equivalents (e.g. FastAPI + Pydantic) and state your assumptions in "rationale".
   - If the origin section has a diagram and it requires updates, provide the updated diagramCode (without markdown code fences).

3. Key Decisions & Chained Impact Analysis:
   - "keyDecisionChanges": List any changes to the high-level keyDecisions ({ "before": "<old_decision>", "after": "<new_decision>" }).
   - "replacedTerms": List concrete terms, technologies, framework names, or entity names that are NO LONGER valid and must be replaced elsewhere in the document (maximum 10 terms, e.g. ["Node.js", "Express", "npm", "Mongoose"]).
   - "impacted": List all OTHER sections in the document that MUST be updated to stay consistent with this revision. Each entry MUST include "sectionId" (which must exist in the document) and a specific "reason". Do NOT include the origin section in "impacted".

4. Warnings & Rationale:
   - "warnings": List any potential contradictions, trade-offs, or risks with other parts of the document.
   - "rationale": Provide a clear summary explaining why these changes and choices were made.

5. Formatting:
   - Return ONLY a valid JSON object matching the schema. No conversational filler.
   - Content must be standard Markdown. No raw HTML.`;
  }

  return `Anda adalah Principal Product Architect dan Mesin Revisi PRD sistem bikinprd.
Tugas Anda adalah menganalisis instruksi revisi dari pengguna terhadap section "origin" tertentu, dengan mempertimbangkan SELURUH Dokumen Persyaratan Produk (PRD) dan keputusan arsitektur kunci (keyDecisions).

ATURAN UTAMA:
1. Analisis Cakupan (Scope):
   - Jika instruksi pengguna ternyata keliru sasaran dan lebih cocok untuk section lain (misal: meminta fitur login saat sedang di node Tech Stack), kembalikan:
     {
       "scope": "redirect",
       "redirect": { "sectionId": "<id_section_tujuan>", "reason": "Jelaskan mengapa instruksi lebih tepat diterapkan di section tersebut" }
     }
     dan kosongkan "origin".
   - Jika instruksi memang cocok untuk origin section, set "scope": "ok".

2. Revisi Origin Minimal & Presisi:
   - Ubah konten origin section seminimal mungkin. Bagian yang tidak berhubungan dengan instruksi wajib dipertahankan persis seperti semula.
   - Jika instruksi bersifat umum (misal: "aku mau pakai Python"), pilih padanan standar industri yang lazim (misal: FastAPI + Pydantic) dan jelaskan asumsi tersebut di dalam "rationale".
   - Jika origin memiliki diagram dan diagram tersebut perlu diperbarui, sertakan "diagramCode" Mermaid yang baru (tanpa code fence).

3. Perubahan Keputusan & Dampak Berantai (Chained Impact):
   - "keyDecisionChanges": Daftar perubahan pada keputusan kunci ({ "before": "<keputusan_lama>", "after": "<keputusan_baru>" }).
   - "replacedTerms": Daftar istilah konkret (nama teknologi, library, entitas) yang kini sudah usang / tidak berlaku lagi dan harus diganti di section lain (maksimal 10 istilah, contoh: ["Node.js", "Express", "npm", "Mongoose"]).
   - "impacted": Daftar section LAIN di dokumen yang benar-benar wajib berubah agar konsisten. Wajib menyertakan "sectionId" yang valid di dokumen dan "reason" yang spesifik. JANGAN masukkan origin section ke dalam daftar ini.

4. Peringatan & Alasan:
   - "warnings": Daftar potensi inkonsistensi, kompromi arsitektur, atau risiko teknis.
   - "rationale": Penjelasan ringkas mengenai alasan perubahan dan asumsi teknis yang dipilih.

5. Format:
   - Kembalikan HANYA JSON valid sesuai skema. Tanpa teks pengantar.
   - Konten Markdown standar, DILARANG menggunakan tag HTML mentah.`;
}

export function buildReviserPrompt(
  doc: PrdDocument,
  originSectionId: string,
  instruction: string
): string {
  const origin = doc.sections.find((s) => s.id === originSectionId);

  let prompt = `<instruction>\n${instruction.trim()}\n</instruction>\n\n`;

  prompt += `<keyDecisions>\n`;
  if (doc.keyDecisions && doc.keyDecisions.length > 0) {
    doc.keyDecisions.forEach((kd, idx) => {
      prompt += `${idx + 1}. ${kd}\n`;
    });
  } else {
    prompt += `(Belum ada keputusan kunci tercatat)\n`;
  }
  prompt += `</keyDecisions>\n\n`;

  if (origin) {
    prompt += `<origin_section id="${origin.id}" type="${origin.type}">\n`;
    prompt += `Title: ${origin.title}\n`;
    prompt += `Content:\n${origin.content}\n`;
    if (origin.diagram?.code) {
      prompt += `Mermaid Diagram Code:\n${origin.diagram.code}\n`;
    }
    prompt += `</origin_section>\n\n`;
  }

  // Calculate length of other sections to decide if truncation is needed (>30k chars)
  const otherSections = doc.sections.filter((s) => s.id !== originSectionId);
  const totalOtherLength = otherSections.reduce((sum, s) => sum + s.content.length, 0);
  const shouldTruncate = totalOtherLength > 30000;

  prompt += `<document_sections>\n`;
  otherSections.forEach((sec, idx) => {
    prompt += `<section id="${sec.id}" type="${sec.type}">\n`;
    prompt += `Title: ${sec.title}\n`;
    if (shouldTruncate && sec.content.length > 400) {
      prompt += `Content (Summary):\n${sec.content.slice(0, 400)}...\n`;
    } else {
      prompt += `Content:\n${sec.content}\n`;
    }
    if (sec.diagram?.code) {
      prompt += `Mermaid Diagram Code:\n${sec.diagram.code}\n`;
    }
    prompt += `</section>\n\n`;
  });
  prompt += `</document_sections>\n`;

  return prompt;
}

export interface RunReviserOptions {
  doc: PrdDocument;
  originSectionId: string;
  instruction: string;
  lang?: "id" | "en";
  timeoutMs?: number;
  client?: ReturnType<typeof getAiClient>;
  model?: string;
  signal?: AbortSignal;
}

export async function runReviser(options: RunReviserOptions): Promise<ReviserOutput> {
  const lang = options.lang || options.doc.lang || "id";
  const system = getReviserSystemPrompt(lang);
  const user = buildReviserPrompt(
    options.doc,
    options.originSectionId,
    options.instruction
  );

  const result = await generateJson({
    stage: "reviser",
    system,
    user,
    schema: ReviserOutputSchema,
    timeoutMs: options.timeoutMs,
    client: options.client,
    model: options.model,
    signal: options.signal,
    docId: options.doc._id?.toString(),
    sectionId: options.originSectionId,
  });

  if (result.scope === "ok" && result.origin) {
    result.origin.content = sanitizeSectionMarkdown(result.origin.content);
    if (result.origin.diagramCode) {
      result.origin.diagramCode = cleanMermaidCode(result.origin.diagramCode);
    }
  }

  return result;
}
