import type { Section } from "../schemas/prd";

export interface ImpactedItemResult {
  sectionId: string;
  reason: string;
  detectedBy: "origin" | "ai" | "term-match";
  matchedTerms?: string[];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a regex with boundary protection for a term.
 * If the term starts with an alphanumeric/word char, uses negative lookbehind for [a-zA-Z0-9_].
 * If the term ends with an alphanumeric/word char, uses negative lookahead for [a-zA-Z0-9_].
 * If it starts/ends with special punctuation, uses non-whitespace boundaries.
 */
export function buildTermRegex(term: string): RegExp {
  const trimmed = term.trim();
  const escaped = escapeRegex(trimmed);
  const prefix = /^\w/.test(trimmed) ? "(?<![a-zA-Z0-9_])" : "(?<!\\S)";
  const suffix = /\w$/.test(trimmed) ? "(?![a-zA-Z0-9_])" : "(?!\\S)";
  return new RegExp(`${prefix}${escaped}${suffix}`, "i");
}

/**
 * Scans a target text (content or diagram) for any occurrences of the replaced terms.
 * Returns array of matched terms in their original casing from replacedTerms.
 */
export function findMatchingTerms(text: string, terms: string[]): string[] {
  if (!text || terms.length === 0) return [];
  const matched: string[] = [];

  for (const term of terms) {
    const trimmed = term.trim();
    if (!trimmed || trimmed.length < 2) continue;

    try {
      const rx = buildTermRegex(trimmed);
      if (rx.test(text)) {
        matched.push(trimmed);
      }
    } catch {
      // Fallback simple word search if regex compilation fails
      if (text.toLowerCase().includes(trimmed.toLowerCase())) {
        matched.push(trimmed);
      }
    }
  }

  return matched;
}

/**
 * Deterministic term matching safety net:
 * Scans all sections other than originSectionId for replacedTerms.
 * Sections containing any of the terms that were missed by AI are added
 * with detectedBy: "term-match".
 */
export function termMatch(
  replacedTerms: string[],
  sections: Array<Pick<Section, "id"> & { title?: string; content: string; diagram?: { code: string } }>,
  originSectionId: string,
  aiImpacted: Array<{ sectionId: string; reason: string }> = [],
  lang: "id" | "en" = "id"
): ImpactedItemResult[] {
  // Clean and filter replaced terms
  const validTerms = Array.from(
    new Set(
      (replacedTerms || [])
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
    )
  );

  const aiMap = new Map<string, { sectionId: string; reason: string }>();
  aiImpacted.forEach((it) => {
    aiMap.set(it.sectionId, it);
  });

  const otherSections = sections.filter((s) => s.id !== originSectionId);
  const results: ImpactedItemResult[] = [];
  const processedSectionIds = new Set<string>();

  // 1. Process AI impacted items first, checking if any matched terms also appear
  for (const aiItem of aiImpacted) {
    if (aiItem.sectionId === originSectionId) continue;
    const sec = otherSections.find((s) => s.id === aiItem.sectionId);
    let matched: string[] = [];
    if (sec && validTerms.length > 0) {
      const contentMatches = findMatchingTerms(sec.content || "", validTerms);
      const diagramMatches = findMatchingTerms(sec.diagram?.code || "", validTerms);
      matched = Array.from(new Set([...contentMatches, ...diagramMatches]));
    }

    results.push({
      sectionId: aiItem.sectionId,
      reason: aiItem.reason,
      detectedBy: "ai",
      matchedTerms: matched.length > 0 ? matched : undefined,
    });
    processedSectionIds.add(aiItem.sectionId);
  }

  // 2. Scan remaining sections for replaced terms
  if (validTerms.length > 0) {
    for (const sec of otherSections) {
      if (processedSectionIds.has(sec.id)) continue;

      const contentMatches = findMatchingTerms(sec.content || "", validTerms);
      const diagramMatches = findMatchingTerms(sec.diagram?.code || "", validTerms);
      const matched = Array.from(new Set([...contentMatches, ...diagramMatches]));

      if (matched.length > 0) {
        const termList = matched.map((t) => `"${t}"`).join(", ");
        const reason =
          lang === "en"
            ? `Contains replaced terms: ${termList}`
            : `Memuat istilah lama yang diganti: ${termList}`;

        results.push({
          sectionId: sec.id,
          reason,
          detectedBy: "term-match",
          matchedTerms: matched,
        });
        processedSectionIds.add(sec.id);
      }
    }
  }

  return results;
}
