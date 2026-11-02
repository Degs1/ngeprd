import type { PrdDocument } from "@/lib/schemas/prd";
import { buildOutline } from "./outline";

/**
 * Generates a URL and filename-safe slug from document title.
 */
export function generateSlug(title?: string | null): string {
  if (!title) return "prd";
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "prd";
}

/**
 * Pure function converting a PrdDocument into formatted Markdown text for export.
 * Chapters become ##, Sections become ###, using dynamic numbers from buildOutline.
 * Non-ready (pending/failed/writing) sections are filtered out per FR-EXP-03.
 * Brainstorming Q&A is appended at the end per FR-EXP-04.
 * (PRD.md Section 6.7, Section 7.9).
 */
export function docToMarkdown(doc?: Partial<PrdDocument> | null): string {
  if (!doc) return "";

  const outline = buildOutline(doc);
  const parts: string[] = [];

  // Main Title
  parts.push(`# ${doc.title || "Spesifikasi Kebutuhan Produk (PRD)"}\n`);

  // Overview / Project Idea
  if (doc.idea) {
    parts.push(`> Ide: ${doc.idea}\n`);
  }

  // Key Decisions
  if (doc.keyDecisions && doc.keyDecisions.length > 0) {
    parts.push(`## Keputusan Kunci\n`);
    for (const decision of doc.keyDecisions) {
      parts.push(`- ${decision}`);
    }
    parts.push("");
  }

  // Chapters & Sections
  for (const chap of outline) {
    // FR-EXP-03: Filter out non-ready sections (pending, writing, failed)
    const validItems = chap.items.filter(
      (item) => !item.section.status || item.section.status === "ready"
    );

    if (validItems.length === 0) continue;

    parts.push(`## ${chap.number}. ${chap.chapter.title}\n`);

    for (const item of validItems) {
      parts.push(`### ${item.number} ${item.section.title}\n`);

      if (item.section.brief && !item.section.content) {
        parts.push(`*${item.section.brief}*\n`);
      }

      if (item.section.content) {
        parts.push(`${item.section.content.trim()}\n`);
      }

      if (item.section.diagram?.code) {
        parts.push("```mermaid");
        parts.push(item.section.diagram.code.trim());
        parts.push("```\n");
      }
    }
  }

  // Brainstorming Appendix (FR-EXP-04)
  if (doc.brainstorm?.questions && doc.brainstorm.questions.length > 0) {
    const answerMap = new Map(
      (doc.brainstorm.answers || []).map((a) => [a.questionId, a.value])
    );
    const answeredQuestions = doc.brainstorm.questions.filter((q) =>
      answerMap.has(q.id)
    );

    if (answeredQuestions.length > 0) {
      parts.push(`## Lampiran: Hasil Brainstorm\n`);
      for (const q of answeredQuestions) {
        parts.push(`- **${q.text}**: ${answerMap.get(q.id)}`);
      }
      parts.push("");
    }
  }

  return parts.join("\n");
}
