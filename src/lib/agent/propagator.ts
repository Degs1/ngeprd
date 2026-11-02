import { z } from "zod";
import { generateJson } from "../ai/generateJson";
import { sanitizeSectionMarkdown } from "./sectionWriter";
import { cleanMermaidCode } from "./diagramGenerator";
import type { Section } from "../schemas/prd";
import type { KeyDecisionChange } from "./reviser";
import type { getAiClient } from "../ai/client";

export const PropagatorOutputSchema = z.object({
  content: z
    .string()
    .min(10, "Content must be at least 10 characters")
    .max(8000, "Content must not exceed 8000 characters"),
  diagramCode: z.string().optional(),
});
export type PropagatorOutput = z.infer<typeof PropagatorOutputSchema>;

export function getPropagatorSystemPrompt(lang: "id" | "en" = "id"): string {
  if (lang === "en") {
    return `You are a PRD Section Propagator and Consistency Engine.
Your task is to revise a single impacted section so that it remains strictly consistent with the changes applied to the origin section and the updated key architectural decisions.

CRITICAL RULES:
1. Minimal and Targeted Updates:
   - ONLY modify the sentences, technology names, framework references, database drivers, or commands directly affected by the changes.
   - Preserve all other sentences, structure, formatting, and details EXACTLY as they are.
2. Diagrams:
   - If the section contains an existing Mermaid diagram and the diagram references technologies/names that changed, provide the updated diagramCode (without markdown code fences).
   - If no diagram updates are needed or the section had no diagram, omit diagramCode.
3. Quality & Formatting:
   - Return ONLY a valid JSON object: { "content": "markdown...", "diagramCode": "..." }.
   - Standard Markdown only, NO raw HTML.`;
  }

  return `Anda adalah PRD Section Propagator dan Mesin Konsistensi sistem bikinprd.
Tugas Anda adalah merevisi SATU section terdampak agar isinya sepenuhnya selaras dan konsisten dengan revisi pada origin section serta keputusan kunci terbaru.

ATURAN UTAMA:
1. Perubahan Minimal dan Terarah:
   - HANYA ubah kalimat, istilah teknologi, nama framework, pustaka, atau perintah yang secara langsung terdampak oleh revisi.
   - Bagian lain, struktur section, penomoran fitur, dan rincian yang tidak berhubungan WAJIB dipertahankan persis seperti aslinya.
2. Diagram Mermaid:
   - Jika section memiliki diagram Mermaid dan label/alur di dalamnya menyebutkan teknologi atau nama yang diganti, sediakan "diagramCode" baru yang telah diperbarui (tanpa code fence).
   - Jika diagram tidak perlu berubah atau section memang tidak memiliki diagram, jangan isi "diagramCode".
3. Kualitas dan Format:
   - Kembalikan HANYA JSON valid sesuai skema: { "content": "markdown...", "diagramCode": "..." }.
   - Markdown standar, DILARANG menggunakan tag HTML mentah.`;
}

export interface OriginSummary {
  title: string;
  contentSummary: string;
}

export function buildPropagatorPrompt(
  section: Pick<Section, "id" | "title" | "type" | "content" | "diagram">,
  keyDecisionChanges: KeyDecisionChange[],
  originSummary: OriginSummary,
  reason: string
): string {
  let prompt = `<impact_reason>\n${reason.trim()}\n</impact_reason>\n\n`;

  prompt += `<origin_revision_summary>\n`;
  prompt += `Title: ${originSummary.title}\n`;
  prompt += `Summary of Changes:\n${originSummary.contentSummary.trim()}\n`;
  prompt += `</origin_revision_summary>\n\n`;

  prompt += `<key_decision_changes>\n`;
  if (keyDecisionChanges && keyDecisionChanges.length > 0) {
    keyDecisionChanges.forEach((kdc, idx) => {
      prompt += `${idx + 1}. [Before] ${kdc.before || "(New)"} -> [After] ${kdc.after}\n`;
    });
  } else {
    prompt += `(No explicit key decision changes)\n`;
  }
  prompt += `</key_decision_changes>\n\n`;

  prompt += `<section id="${section.id}" type="${section.type}">\n`;
  prompt += `Title: ${section.title}\n`;
  prompt += `Current Content:\n${section.content}\n`;
  if (section.diagram?.code) {
    prompt += `Current Mermaid Diagram Code:\n${section.diagram.code}\n`;
  }
  prompt += `</section>\n`;

  return prompt;
}

export interface RunPropagatorOptions {
  section: Pick<Section, "id" | "title" | "type" | "content" | "diagram">;
  keyDecisionChanges: KeyDecisionChange[];
  originSummary: OriginSummary;
  reason: string;
  lang?: "id" | "en";
  docId?: string;
  timeoutMs?: number;
  client?: ReturnType<typeof getAiClient>;
  model?: string;
  signal?: AbortSignal;
}

export async function runPropagator(
  options: RunPropagatorOptions
): Promise<PropagatorOutput> {
  const lang = options.lang || "id";
  const system = getPropagatorSystemPrompt(lang);
  const user = buildPropagatorPrompt(
    options.section,
    options.keyDecisionChanges,
    options.originSummary,
    options.reason
  );

  const result = await generateJson({
    stage: "propagator",
    system,
    user,
    schema: PropagatorOutputSchema,
    timeoutMs: options.timeoutMs,
    client: options.client,
    model: options.model,
    signal: options.signal,
    docId: options.docId,
    sectionId: options.section.id,
  });

  result.content = sanitizeSectionMarkdown(result.content);
  if (result.diagramCode) {
    result.diagramCode = cleanMermaidCode(result.diagramCode);
  }

  return result;
}
