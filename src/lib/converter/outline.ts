import type { Chapter, Section, PrdDocument } from "@/lib/schemas/prd";

export interface OutlineSectionItem {
  section: Section;
  number: string; // e.g. "1.1", "1.2"
}

export interface OutlineChapterItem {
  chapter: Chapter;
  number: string; // e.g. "1", "2"
  items: OutlineSectionItem[];
}

export type OutlineTree = OutlineChapterItem[];

export interface OutlineStats {
  totalChapters: number;
  totalSections: number;
  readySections: number;
  failedSections: number;
  writingSections: number;
  pendingSections: number;
}

/**
 * Pure function that computes a hierarchically numbered outline on the fly
 * from chapters and sections (PRD.md Section 6.4a, Section 7.9).
 *
 * Section numbers (e.g. "1.1") are NEVER stored in the database.
 * They are dynamically derived from chapter order and section order,
 * ensuring they remain accurate whenever sections are added, removed, or reordered.
 */
export function buildOutline(
  doc?: Partial<Pick<PrdDocument, "chapters" | "sections">> | null
): OutlineTree {
  if (!doc) {
    return [];
  }

  const rawChapters = Array.isArray(doc.chapters) ? [...doc.chapters] : [];
  const rawSections = Array.isArray(doc.sections) ? [...doc.sections] : [];

  // Sort chapters ascending by order, tie-breaking by id
  const sortedChapters = rawChapters.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.id.localeCompare(b.id);
  });

  const knownChapterIds = new Set(sortedChapters.map((c) => c.id));
  const chapterMap = new Map<string, Section[]>();
  const orphanedSections: Section[] = [];

  for (const c of sortedChapters) {
    chapterMap.set(c.id, []);
  }

  for (const sec of rawSections) {
    if (knownChapterIds.has(sec.chapterId)) {
      chapterMap.get(sec.chapterId)!.push(sec);
    } else {
      orphanedSections.push(sec);
    }
  }

  const result: OutlineTree = [];

  // Process standard chapters
  sortedChapters.forEach((chapter, chapterIndex) => {
    const chapterNumber = String(chapterIndex + 1);
    const sectionsInChapter = chapterMap.get(chapter.id) || [];

    // Sort sections ascending by order, tie-breaking by id
    const sortedSections = [...sectionsInChapter].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.id.localeCompare(b.id);
    });

    const items: OutlineSectionItem[] = sortedSections.map((sec, secIndex) => ({
      section: sec,
      number: `${chapterNumber}.${secIndex + 1}`,
    }));

    result.push({
      chapter,
      number: chapterNumber,
      items,
    });
  });

  // Handle any sections whose chapterId doesn't exist (graceful fallback)
  if (orphanedSections.length > 0) {
    const fallbackChapterIndex = result.length + 1;
    const fallbackChapterNumber = String(fallbackChapterIndex);

    const sortedOrphans = [...orphanedSections].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.id.localeCompare(b.id);
    });

    const fallbackChapter: Chapter = {
      id: "chap_fallback_unassigned",
      title: "Lainnya",
      order: 9999,
    };

    const items: OutlineSectionItem[] = sortedOrphans.map((sec, secIndex) => ({
      section: sec,
      number: `${fallbackChapterNumber}.${secIndex + 1}`,
    }));

    result.push({
      chapter: fallbackChapter,
      number: fallbackChapterNumber,
      items,
    });
  }

  return result;
}

/**
 * Builds a fast lookup Map of sectionId -> calculated section number (e.g. "1.1").
 */
export function buildSectionNumberMap(
  doc?: Partial<Pick<PrdDocument, "chapters" | "sections">> | null
): Map<string, string> {
  const outline = buildOutline(doc);
  const map = new Map<string, string>();

  for (const chap of outline) {
    for (const item of chap.items) {
      map.set(item.section.id, item.number);
    }
  }

  return map;
}

/**
 * Calculates summary metrics across all sections in the outline.
 */
export function getOutlineStats(outline: OutlineTree): OutlineStats {
  let totalSections = 0;
  let readySections = 0;
  let failedSections = 0;
  let writingSections = 0;
  let pendingSections = 0;

  for (const chap of outline) {
    for (const item of chap.items) {
      totalSections++;
      const status = item.section.status;
      if (status === "ready") readySections++;
      else if (status === "failed") failedSections++;
      else if (status === "writing") writingSections++;
      else pendingSections++;
    }
  }

  return {
    totalChapters: outline.length,
    totalSections,
    readySections,
    failedSections,
    writingSections,
    pendingSections,
  };
}
