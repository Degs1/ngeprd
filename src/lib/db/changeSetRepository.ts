import { ObjectId } from "mongodb";
import { getChangeSetCollection } from "./mongo";
import type { PrdChangeSet, CreateChangeSetInput } from "../schemas/agent";
import { toObjectId } from "./prdRepository";

export const MAX_CHANGESETS_PER_DOC = 30;

/**
 * Creates a new changeset for a PRD document.
 * Automatically enforces the 30-changeset retention policy per doc,
 * removing oldest completed changesets when the limit is exceeded.
 */
export async function createChangeSet(
  docId: string | ObjectId,
  ownerId: string,
  input: CreateChangeSetInput
): Promise<PrdChangeSet | null> {
  const oid = toObjectId(docId);
  if (!oid) return null;

  const col = await getChangeSetCollection();
  const now = new Date();

  // Enforce retention policy: keep at most MAX_CHANGESETS_PER_DOC
  const count = await col.countDocuments({ docId: oid, ownerId });
  if (count >= MAX_CHANGESETS_PER_DOC) {
    const excess = count - MAX_CHANGESETS_PER_DOC + 1;
    // Find oldest completed changesets
    const oldestCompleted = await col
      .find({
        docId: oid,
        ownerId,
        status: { $in: ["applied", "rejected", "reverted", "failed"] },
      })
      .sort({ createdAt: 1 })
      .limit(excess)
      .project({ _id: 1 })
      .toArray();

    if (oldestCompleted.length > 0) {
      await col.deleteMany({
        _id: { $in: oldestCompleted.map((c) => c._id) },
      });
    }
  }

  const newCs: Omit<PrdChangeSet, "_id"> = {
    ownerId,
    docId: oid,
    originSectionId: input.originSectionId,
    instruction: input.instruction.trim(),
    status: "generating",
    rationale: "",
    warnings: [],
    keyDecisionChanges: [],
    items: [],
    createdAt: now,
    updatedAt: now,
  };

  const result = await col.insertOne(newCs as unknown as PrdChangeSet);
  return {
    ...newCs,
    _id: result.insertedId,
  };
}

/**
 * Finds an active (in-progress) changeset for a document, if any.
 * A changeset is active if its status is 'generating' or 'pending'.
 */
export async function getActiveChangeSet(
  docId: string | ObjectId,
  ownerId: string
): Promise<PrdChangeSet | null> {
  const oid = toObjectId(docId);
  if (!oid) return null;

  const col = await getChangeSetCollection();
  return col.findOne({
    docId: oid,
    ownerId,
    status: { $in: ["generating", "pending"] },
  });
}

/**
 * Retrieves changesets for a document, optionally filtered by sectionId or status.
 */
export async function getChangeSets(
  docId: string | ObjectId,
  ownerId: string,
  filter?: {
    sectionId?: string;
    status?: string;
  }
): Promise<PrdChangeSet[]> {
  const oid = toObjectId(docId);
  if (!oid) return [];

  const col = await getChangeSetCollection();
  const query: Record<string, unknown> = {
    docId: oid,
    ownerId,
  };

  if (filter?.status) {
    query.status = filter.status;
  }

  if (filter?.sectionId) {
    query.$or = [
      { originSectionId: filter.sectionId },
      { "items.sectionId": filter.sectionId },
    ];
  }

  const docs = await col.find(query).sort({ createdAt: -1 }).toArray();
  return docs as unknown as PrdChangeSet[];
}

/**
 * Retrieves a single changeset by ID, scoped by ownerId.
 */
export async function getChangeSetById(
  id: string | ObjectId,
  ownerId: string
): Promise<PrdChangeSet | null> {
  const oid = toObjectId(id);
  if (!oid) return null;

  const col = await getChangeSetCollection();
  return col.findOne({ _id: oid, ownerId });
}

/**
 * Updates a changeset document with retry support.
 */
export async function updateChangeSet(
  id: string | ObjectId,
  ownerId: string,
  updates: Partial<PrdChangeSet>
): Promise<boolean> {
  const oid = toObjectId(id);
  if (!oid) return false;

  const col = await getChangeSetCollection();
  const now = new Date();

  const updateFields: Record<string, unknown> = {
    ...updates,
    updatedAt: now,
  };
  delete updateFields._id;
  delete updateFields.docId;
  delete updateFields.ownerId;

  const result = await col.updateOne(
    { _id: oid, ownerId },
    { $set: updateFields }
  );

  return result.matchedCount > 0;
}

/**
 * Deletes all changesets belonging to a document.
 */
export async function deleteChangeSetsByDocId(
  docId: string | ObjectId,
  ownerId: string
): Promise<number> {
  const oid = toObjectId(docId);
  if (!oid) return 0;

  const col = await getChangeSetCollection();
  const result = await col.deleteMany({ docId: oid, ownerId });
  return result.deletedCount;
}
