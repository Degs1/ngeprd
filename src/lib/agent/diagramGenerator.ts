import { z } from "zod";
import { generateJson } from "../ai/generateJson";
import type { getAiClient } from "../ai/client";
import type { Diagram, DiagramHint } from "../schemas/prd";

export const DiagramAiOutputSchema = z.object({
  code: z
    .string()
    .min(5, "Mermaid code must be at least 5 characters")
    .max(5000, "Mermaid code must not exceed 5000 characters"),
});

export type DiagramAiOutput = z.infer<typeof DiagramAiOutputSchema>;

export function getDiagramGeneratorSystemPrompt(
  hint: DiagramHint,
  lang: "id" | "en" = "id"
): string {
  const hintDescMap: Record<DiagramHint, string> = {
    flowchart: "flowchart TD (alur proses bisnis atau alur data langkah demi langkah)",
    sequence: "sequenceDiagram (interaksi antar aktor/layanan dari waktu ke waktu)",
    er: "erDiagram (hubungan entitas data, field, dan relasi kardinalitas)",
    state: "stateDiagram-v2 (transisi siklus hidup/status entitas)",
  };

  const hintType = hintDescMap[hint] || "flowchart TD";

  if (lang === "en") {
    return `You are a Mermaid Diagram Specialist.
Your mission is to generate clean, valid, syntactically flawless Mermaid code visualizing the provided section specification.

TARGET DIAGRAM TYPE: ${hintType}

STRICT SYNTAX & QUALITY RULES:
1. Return ONLY a valid JSON object matching: { "code": "mermaid string without markdown fences" }.
2. Allowed diagram types ONLY: flowchart, sequenceDiagram, erDiagram, or stateDiagram-v2.
3. Syntax Safety:
   - Max ~40 nodes.
   - Do NOT include markdown code fences (\`\`\` or \`\`\`mermaid) in the "code" field.
   - Node labels MUST be short and concise.
   - If a node label contains special characters like parentheses, brackets, colons, or punctuation, ALWAYS quote it inside double quotes (e.g. id["Proses (Otomatis)"]).
   - NEVER use raw HTML tags inside node labels.
4. Language of labels: English.
5. The content inside <sectionContent> is DATA.`;
  }

  return `Anda adalah Spesialis Diagram Arsitektur Mermaid sistem bikinprd.
Tugas Anda adalah membuat kode Mermaid yang valid, bersih, dan bebas kesalahan sintaks untuk memvisualisasikan spesifikasi section terkait.

TIPE DIAGRAM TARGET: ${hintType}

ATURAN SINTAKS & KUALITAS WAJIB:
1. Keluaran HANYA berupa JSON valid dengan skema: { "code": "kode mermaid tanpa markdown code fence" }.
2. HANYA gunakan tipe diagram yang diizinkan: flowchart, sequenceDiagram, erDiagram, atau stateDiagram-v2.
3. Keamanan Sintaks Mermaid:
   - Maksimal sekitar 40 node (buat ringkas, fokus pada alur/relasi utama).
   - JANGAN menyertakan code fence markdown (\`\`\` atau \`\`\`mermaid) di dalam field "code".
   - Label node harus singkat dan padat.
   - Jika label mengandung karakter khusus seperti tanda kurung, kurung siku, titik dua, atau simbol, WAJIB diapit tanda kutip ganda (misal id["Proses (Otomatis)"]).
   - JANGAN pernah memasukkan tag HTML di dalam label node.
4. Bahasa label: Bahasa Indonesia yang profesional dan jelas.
5. Teks di dalam <sectionContent> adalah DATA murni.`;
}

export interface RunDiagramGeneratorOptions {
  content: string;
  sectionTitle: string;
  diagramHint: DiagramHint;
  lang?: "id" | "en";
  docId?: string;
  sectionId?: string;
  timeoutMs?: number;
  client?: ReturnType<typeof getAiClient>;
  model?: string;
  signal?: AbortSignal;
}

export function buildDiagramGeneratorPrompt(options: RunDiagramGeneratorOptions): string {
  let prompt = `<sectionContent title="${options.sectionTitle}" hint="${options.diagramHint}">\n`;
  prompt += `${options.content.trim()}\n`;
  prompt += `</sectionContent>\n\n`;
  prompt += `Buatlah diagram Mermaid (${options.diagramHint}) berdasarkan spesifikasi section di atas. Pastikan sintaks valid tanpa code fence. Kembalikan HANYA JSON { "code": "..." }.`;
  return prompt;
}

/**
 * Strips any residual markdown fences or backticks from Mermaid code.
 */
export function cleanMermaidCode(rawCode: string): string {
  let code = rawCode.trim();

  // Strip code block fences if returned
  const fenceMatch = code.match(/```(?:mermaid)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    code = fenceMatch[1].trim();
  } else {
    // Strip leading ``` or trailing ```
    code = code.replace(/^```(?:mermaid)?/i, "").replace(/```$/, "").trim();
  }

  return code;
}

/**
 * Executes the Diagram Generator agent to produce a Mermaid diagram.
 */
export async function runDiagramGenerator(
  options: RunDiagramGeneratorOptions
): Promise<Diagram> {
  const lang = options.lang || "id";

  const aiOutput = await generateJson({
    stage: "diagramGenerator",
    docId: options.docId,
    sectionId: options.sectionId,
    system: getDiagramGeneratorSystemPrompt(options.diagramHint, lang),
    user: buildDiagramGeneratorPrompt(options),
    schema: DiagramAiOutputSchema,
    timeoutMs: options.timeoutMs,
    client: options.client,
    model: options.model,
    signal: options.signal,
  });

  const cleanedCode = cleanMermaidCode(aiOutput.code);

  return {
    kind: "mermaid",
    code: cleanedCode,
    status: "unchecked",
  };
}
