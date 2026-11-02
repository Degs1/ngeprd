import type { PrdDocument } from "@/lib/schemas/prd";
import { buildOutline } from "./outline";

/**
 * Pure function converting a PrdDocument into formatted Markdown text for export.
 * Chapters become ##, Sections become ###, using dynamic numbers from buildOutline.
 * (PRD.md Section 7.9).
 */
export function docToMarkdown(doc?: Partial<PrdDocument> | null): string {
  if (!doc) return "";

  const outline = buildOutline(doc);
  const parts: string[] = [];

  // Main Title
  parts.push(`# ${doc.title || "Spesifikasi Kebutuhan Produk (PRD)"}\n`);

  // Overview / Project Idea
  if (doc.idea) {
    parts.push(`> **Ide Proyek**: ${doc.idea}\n`);
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
    parts.push(`## ${chap.number}. ${chap.chapter.title}\n`);

    for (const item of chap.items) {
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

  return parts.join("\n");
}
