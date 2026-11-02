import { ObjectId } from "mongodb";
import { getPrdCollection } from "./mongo";
import type {
  PrdDocument,
  PrdListItem,
  Section,
  SectionType,
  CreatePrdInput,
} from "../schemas/prd";
import { generateSectionId } from "../schemas/prd";
import type { PrdChangeSet, ChangeItem } from "../schemas/agent";

/**
 * Safely converts string or ObjectId to ObjectId.
 * Returns null if the string is not a valid 24-character hexadecimal ObjectId.
 */
export function toObjectId(id: string | ObjectId): ObjectId | null {
  if (id instanceof ObjectId) return id;
  if (typeof id === "string" && ObjectId.isValid(id)) {
    try {
      const oid = new ObjectId(id);
      if (oid.toHexString() === id.toLowerCase()) {
        return oid;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Creates a new PRD document in 'brainstorming' status.
 * Initial title is set to first 60 characters of the idea.
 */
export async function createPrd(
  ownerId: string,
  input: CreatePrdInput
): Promise<PrdDocument> {
  const col = await getPrdCollection();
  const trimmedIdea = input.idea.trim();
  const defaultTitle = trimmedIdea.slice(0, 60).trim() || "Untitled PRD";
  const now = new Date();

  const newDoc: Omit<PrdDocument, "_id"> = {
    ownerId,
    title: defaultTitle,
    titleEdited: false,
    idea: trimmedIdea,
    lang: input.lang || "id",
    status: "brainstorming",
    brainstorm: {
      questions: [],
      answers: [],
    },
    keyDecisions: [],
    chapters: [],
    sections: [],
    edges: [],
    run: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await col.insertOne(newDoc as unknown as PrdDocument);
  return {
    ...newDoc,
    _id: result.insertedId,
  };
}

/**
 * Retrieves a lightweight listing of PRDs for the sidebar.
 * Projects only _id, title, status, and updatedAt.
 */
export async function getPrds(ownerId: string): Promise<PrdListItem[]> {
  const col = await getPrdCollection();
  const docs = await col
    .find(
      { ownerId },
      {
        projection: {
          _id: 1,
          title: 1,
          status: 1,
          updatedAt: 1,
        },
      }
    )
    .sort({ updatedAt: -1 })
    .toArray();

  return docs as unknown as PrdListItem[];
}

/**
 * Retrieves a full PRD document scoped by ownerId.
 * Returns null if not found or if id is invalid.
 */
export async function getPrdById(
  id: string | ObjectId,
  ownerId: string
): Promise<PrdDocument | null> {
  const oid = toObjectId(id);
  if (!oid) return null;

  const col = await getPrdCollection();
  return col.findOne({ _id: oid, ownerId });
}

/**
 * Updates PRD title and sets titleEdited to true.
 */
export async function updatePrdTitle(
  id: string | ObjectId,
  ownerId: string,
  title: string
): Promise<PrdDocument | null> {
  const oid = toObjectId(id);
  if (!oid) return null;

  const col = await getPrdCollection();
  const result = await col.findOneAndUpdate(
    { _id: oid, ownerId },
    {
      $set: {
        title: title.trim(),
        titleEdited: true,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return result || null;
}

/**
 * Deletes a PRD document and its associated changesets.
 */
export async function deletePrd(
  id: string | ObjectId,
  ownerId: string
): Promise<boolean> {
  const oid = toObjectId(id);
  if (!oid) return false;

  const col = await getPrdCollection();
  const result = await col.deleteOne({ _id: oid, ownerId });

  if (result.deletedCount > 0) {
    // Delete associated changesets
    const { deleteChangeSetsByDocId } = await import("./changeSetRepository");
    await deleteChangeSetsByDocId(oid, ownerId);
    return true;
  }

  return false;
}

/**
 * Updates section positions without incrementing rev.
 */
export async function updatePrdLayout(
  id: string | ObjectId,
  ownerId: string,
  positions: { sectionId: string; x: number; y: number }[]
): Promise<boolean> {
  const oid = toObjectId(id);
  if (!oid || positions.length === 0) return false;

  const col = await getPrdCollection();
  const now = new Date();

  const setOps: Record<string, unknown> = { updatedAt: now };
  const arrayFilters: Record<string, unknown>[] = [];

  positions.forEach((pos, idx) => {
    const key = `pos${idx}`;
    setOps[`sections.$[${key}].position`] = { x: pos.x, y: pos.y };
    arrayFilters.push({ [`${key}.id`]: pos.sectionId });
  });

  const result = await col.updateOne(
    { _id: oid, ownerId },
    { $set: setOps },
    { arrayFilters }
  );

  return result.matchedCount > 0;
}

/**
 * Adds a new manual section to a chapter in the PRD document.
 */
export async function addSection(
  id: string | ObjectId,
  ownerId: string,
  data: { chapterId: string; title: string; type?: SectionType }
): Promise<Section | null> {
  const oid = toObjectId(id);
  if (!oid) return null;

  const col = await getPrdCollection();
  const doc = await col.findOne({ _id: oid, ownerId });
  if (!doc) return null;

  if (doc.chapters.length > 0 && !doc.chapters.some((c) => c.id === data.chapterId)) {
    return null;
  }

  const chapterSections = doc.sections.filter((s) => s.chapterId === data.chapterId);
  const maxOrder =
    chapterSections.length > 0
      ? Math.max(...chapterSections.map((s) => s.order))
      : 0;

  const now = new Date();
  const newSection: Section = {
    id: generateSectionId(),
    chapterId: data.chapterId,
    type: data.type || "custom",
    title: data.title.trim(),
    content: "",
    order: maxOrder + 1,
    status: "ready",
    rev: 1,
    updatedAt: now,
  };

  const updateResult = await col.updateOne(
    { _id: oid, ownerId },
    {
      $push: { sections: newSection },
      $set: { updatedAt: now },
    }
  );

  if (updateResult.matchedCount === 0) return null;
  return newSection;
}

export interface UpdateSectionResult {
  success: boolean;
  notFound?: boolean;
  conflict?: boolean;
  rev?: number;
  currentRev?: number;
}

/**
 * Updates a section using atomic $elemMatch query filtering on baseRev.
 * Returns { conflict: true } if baseRev does not match.
 */
export async function updateSection(
  id: string | ObjectId,
  ownerId: string,
  sectionId: string,
  baseRev: number,
  updates: {
    title?: string;
    content?: string;
    diagram?: Section["diagram"];
  }
): Promise<UpdateSectionResult> {
  const oid = toObjectId(id);
  if (!oid) return { success: false, notFound: true };

  const col = await getPrdCollection();
  const now = new Date();

  const setOps: Record<string, unknown> = {
    updatedAt: now,
    "sections.$[s].updatedAt": now,
  };

  if (updates.title !== undefined) {
    setOps["sections.$[s].title"] = updates.title.trim();
  }
  if (updates.content !== undefined) {
    setOps["sections.$[s].content"] = updates.content;
  }
  if (updates.diagram !== undefined) {
    setOps["sections.$[s].diagram"] = updates.diagram;
  }

  const result = await col.updateOne(
    {
      _id: oid,
      ownerId,
      sections: { $elemMatch: { id: sectionId, rev: baseRev } },
    },
    {
      $set: setOps,
      $inc: { "sections.$[s].rev": 1 },
    },
    {
      arrayFilters: [{ "s.id": sectionId }],
    }
  );

  if (result.matchedCount === 0) {
    // Determine whether document does not exist, section does not exist, or rev conflict occurred
    const doc = await col.findOne({ _id: oid, ownerId });
    if (!doc) {
      return { success: false, notFound: true };
    }

    const currentSection = doc.sections.find((s) => s.id === sectionId);
    if (!currentSection) {
      return { success: false, notFound: true };
    }

    return {
      success: false,
      conflict: true,
      currentRev: currentSection.rev,
    };
  }

  return {
    success: true,
    rev: baseRev + 1,
  };
}

/**
 * Deletes a section and removes any connected edges (where from or to equals sectionId).
 */
export async function deleteSection(
  id: string | ObjectId,
  ownerId: string,
  sectionId: string
): Promise<boolean> {
  const oid = toObjectId(id);
  if (!oid) return false;

  const col = await getPrdCollection();
  const now = new Date();

  // First verify document exists
  const doc = await col.findOne({ _id: oid, ownerId });
  if (!doc) return false;

  const hasSection = doc.sections.some((s) => s.id === sectionId);
  if (!hasSection) return false;

  const result = await col.updateOne(
    { _id: oid, ownerId },
    {
      $pull: {
        sections: { id: sectionId },
        edges: {
          $or: [{ from: sectionId }, { to: sectionId }],
        } as unknown as Record<string, unknown>,
      },
      $set: { updatedAt: now },
    }
  );

  return result.matchedCount > 0;
}

export interface ApplyChangeSetResult {
  success: boolean;
  conflicts?: string[];
  appliedSectionIds?: string[];
  message?: string;
}

/**
 * Atomically applies a changeset to a PRD document.
 * Verifies baseRev for all items via $elemMatch.
 * If any section conflicts, the entire update fails cleanly with 409 conflict list.
 */
export async function applyChangeSetAtomic(
  docId: string | ObjectId,
  ownerId: string,
  changeSet: PrdChangeSet,
  sectionIdsToApply?: string[]
): Promise<ApplyChangeSetResult> {
  const oid = toObjectId(docId);
  if (!oid) return { success: false, message: "Invalid document ID" };

  const col = await getPrdCollection();
  const now = new Date();

  // Determine items to apply
  let itemsToApply: ChangeItem[] = changeSet.items.filter(
    (it) => it.after !== null && it.status !== "failed"
  );

  if (sectionIdsToApply && sectionIdsToApply.length > 0) {
    const requestedSet = new Set(sectionIdsToApply);
    itemsToApply = itemsToApply.filter((it) => requestedSet.has(it.sectionId));
  }

  if (itemsToApply.length === 0) {
    return { success: false, message: "No valid items to apply" };
  }

  // Fetch current doc to compute new key decisions
  const currentDoc = await col.findOne({ _id: oid, ownerId });
  if (!currentDoc) {
    return { success: false, message: "Document not found" };
  }

  // Pre-check for any obvious missing sections or rev conflicts
  const currentSectionMap = new Map(currentDoc.sections.map((s) => [s.id, s]));
  const preCheckConflicts: string[] = [];

  for (const it of itemsToApply) {
    const sec = currentSectionMap.get(it.sectionId);
    if (!sec || sec.rev !== it.baseRev) {
      preCheckConflicts.push(it.sectionId);
    }
  }

  if (preCheckConflicts.length > 0) {
    return { success: false, conflicts: preCheckConflicts };
  }

  // Calculate updated key decisions
  const updatedDecisions = [...(currentDoc.keyDecisions || [])];
  for (const change of changeSet.keyDecisionChanges || []) {
    if (change.before) {
      const idx = updatedDecisions.indexOf(change.before);
      if (idx !== -1) {
        updatedDecisions[idx] = change.after;
      } else if (!updatedDecisions.includes(change.after)) {
        updatedDecisions.push(change.after);
      }
    } else {
      if (!updatedDecisions.includes(change.after)) {
        updatedDecisions.push(change.after);
      }
    }
  }

  // Build atomic update operations
  const setOps: Record<string, unknown> = {
    updatedAt: now,
    keyDecisions: updatedDecisions,
  };
  const incOps: Record<string, number> = {};
  const arrayFilters: Record<string, unknown>[] = [];

  itemsToApply.forEach((it, i) => {
    const k = `s${i}`;
    if (it.after) {
      setOps[`sections.$[${k}].title`] = it.after.title;
      setOps[`sections.$[${k}].content`] = it.after.content;
      if (it.after.diagramCode !== undefined) {
        setOps[`sections.$[${k}].diagram`] = {
          kind: "mermaid",
          code: it.after.diagramCode,
          status: "unchecked",
        };
      }
    }
    setOps[`sections.$[${k}].updatedAt`] = now;
    incOps[`sections.$[${k}].rev`] = 1;
    arrayFilters.push({ [`${k}.id`]: it.sectionId });
  });

  const updateResult = await col.updateOne(
    {
      _id: oid,
      ownerId,
      $and: itemsToApply.map((it) => ({
        sections: { $elemMatch: { id: it.sectionId, rev: it.baseRev } },
      })),
    },
    {
      $set: setOps,
      $inc: incOps,
    },
    { arrayFilters }
  );

  if (updateResult.matchedCount === 0) {
    // Conflict occurred concurrently between check and update
    const reloadedDoc = await col.findOne({ _id: oid, ownerId });
    const conflicts: string[] = [];
    if (reloadedDoc) {
      for (const it of itemsToApply) {
        const sec = reloadedDoc.sections.find((s) => s.id === it.sectionId);
        if (!sec || sec.rev !== it.baseRev) {
          conflicts.push(it.sectionId);
        }
      }
    }
    return {
      success: false,
      conflicts: conflicts.length > 0 ? conflicts : itemsToApply.map((it) => it.sectionId),
    };
  }

  const appliedSectionIds = itemsToApply.map((it) => it.sectionId);
  return {
    success: true,
    appliedSectionIds,
  };
}

export interface RevertChangeSetResult {
  success: boolean;
  revertedSectionIds: string[];
  skipped: string[];
  message?: string;
}

/**
 * Reverts changes from an applied changeset.
 * Only reverts items whose rev still matches appliedRev.
 * Skipped items are reported.
 */
export async function revertChangeSetAtomic(
  docId: string | ObjectId,
  ownerId: string,
  changeSet: PrdChangeSet
): Promise<RevertChangeSetResult> {
  const oid = toObjectId(docId);
  if (!oid) return { success: false, revertedSectionIds: [], skipped: [], message: "Invalid document ID" };

  const col = await getPrdCollection();
  const currentDoc = await col.findOne({ _id: oid, ownerId });
  if (!currentDoc) {
    return { success: false, revertedSectionIds: [], skipped: [], message: "Document not found" };
  }

  const now = new Date();
  const currentSectionMap = new Map(currentDoc.sections.map((s) => [s.id, s]));

  const itemsToRevert: ChangeItem[] = [];
  const skipped: string[] = [];

  for (const it of changeSet.items) {
    if (!it.appliedRev) continue;
    const currentSec = currentSectionMap.get(it.sectionId);
    if (currentSec && currentSec.rev === it.appliedRev) {
      itemsToRevert.push(it);
    } else {
      skipped.push(it.sectionId);
    }
  }

  if (itemsToRevert.length === 0) {
    return {
      success: true,
      revertedSectionIds: [],
      skipped,
    };
  }

  // Restore key decisions
  const updatedDecisions = [...(currentDoc.keyDecisions || [])];
  for (const change of changeSet.keyDecisionChanges || []) {
    const afterIdx = updatedDecisions.indexOf(change.after);
    if (afterIdx !== -1) {
      if (change.before) {
        updatedDecisions[afterIdx] = change.before;
      } else {
        updatedDecisions.splice(afterIdx, 1);
      }
    }
  }

  const setOps: Record<string, unknown> = {
    updatedAt: now,
    keyDecisions: updatedDecisions,
  };
  const incOps: Record<string, number> = {};
  const arrayFilters: Record<string, unknown>[] = [];

  itemsToRevert.forEach((it, i) => {
    const k = `r${i}`;
    setOps[`sections.$[${k}].title`] = it.before.title;
    setOps[`sections.$[${k}].content`] = it.before.content;
    if (it.before.diagramCode !== undefined) {
      setOps[`sections.$[${k}].diagram`] = {
        kind: "mermaid",
        code: it.before.diagramCode,
        status: "unchecked",
      };
    }
    setOps[`sections.$[${k}].updatedAt`] = now;
    incOps[`sections.$[${k}].rev`] = 1;
    arrayFilters.push({ [`${k}.id`]: it.sectionId });
  });

  const updateResult = await col.updateOne(
    {
      _id: oid,
      ownerId,
      $and: itemsToRevert.map((it) => ({
        sections: { $elemMatch: { id: it.sectionId, rev: it.appliedRev } },
      })),
    },
    {
      $set: setOps,
      $inc: incOps,
    },
    { arrayFilters }
  );

  if (updateResult.matchedCount === 0) {
    return {
      success: false,
      revertedSectionIds: [],
      skipped: itemsToRevert.map((it) => it.sectionId).concat(skipped),
      message: "Concurrent modification detected during revert",
    };
  }

  return {
    success: true,
    revertedSectionIds: itemsToRevert.map((it) => it.sectionId),
    skipped,
  };
}
