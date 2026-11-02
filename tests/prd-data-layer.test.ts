import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import {
  CreatePrdSchema,
  UpdatePrdTitleSchema,
  UpdateLayoutSchema,
  AddSectionSchema,
  UpdateSectionSchema,
  PrdDocumentSchema,
  generateChapterId,
  generateSectionId,
  generateEdgeId,
} from "../src/lib/schemas/prd";
import {
  ChangeSetActionSchema,
  PrdChangeSetSchema,
} from "../src/lib/schemas/agent";
import { getOwnerId } from "../src/lib/auth/owner";
import { toObjectId } from "../src/lib/db/prdRepository";
import type { PrdDocument, Section } from "../src/lib/schemas/prd";
import type { PrdChangeSet } from "../src/lib/schemas/agent";

test("Zod Schemas - CreatePrdSchema validates correctly", () => {
  const valid = CreatePrdSchema.safeParse({ idea: "Build an AI tool" });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.idea, "Build an AI tool");
    assert.equal(valid.data.lang, undefined);
  }

  const withLang = CreatePrdSchema.safeParse({
    idea: "Membangun aplikasi",
    lang: "id",
  });
  assert.equal(withLang.success, true);

  const empty = CreatePrdSchema.safeParse({ idea: "   " });
  assert.equal(empty.success, false);

  const missing = CreatePrdSchema.safeParse({});
  assert.equal(missing.success, false);
});

test("Zod Schemas - UpdatePrdTitleSchema validates correctly", () => {
  const valid = UpdatePrdTitleSchema.safeParse({ title: "New Title" });
  assert.equal(valid.success, true);

  const empty = UpdatePrdTitleSchema.safeParse({ title: "" });
  assert.equal(empty.success, false);

  const tooLong = UpdatePrdTitleSchema.safeParse({ title: "a".repeat(201) });
  assert.equal(tooLong.success, false);
});

test("Zod Schemas - UpdateLayoutSchema validates positions correctly", () => {
  const valid = UpdateLayoutSchema.safeParse({
    positions: [{ sectionId: "sec_123", x: 100, y: 200 }],
  });
  assert.equal(valid.success, true);

  const emptyList = UpdateLayoutSchema.safeParse({ positions: [] });
  assert.equal(emptyList.success, false);

  const invalidCoords = UpdateLayoutSchema.safeParse({
    positions: [{ sectionId: "sec_123", x: "invalid", y: 200 }],
  });
  assert.equal(invalidCoords.success, false);
});

test("Zod Schemas - AddSectionSchema validates section creation", () => {
  const valid = AddSectionSchema.safeParse({
    chapterId: "chap_123",
    title: "Executive Summary",
    type: "overview",
  });
  assert.equal(valid.success, true);

  const defaultType = AddSectionSchema.safeParse({
    chapterId: "chap_123",
    title: "Custom Section",
  });
  assert.equal(defaultType.success, true);
  if (defaultType.success) {
    assert.equal(defaultType.data.type, "custom");
  }

  const missingTitle = AddSectionSchema.safeParse({ chapterId: "chap_123" });
  assert.equal(missingTitle.success, false);
});

test("Zod Schemas - UpdateSectionSchema validates baseRev and updates", () => {
  const valid = UpdateSectionSchema.safeParse({
    baseRev: 2,
    content: "Updated section markdown content",
  });
  assert.equal(valid.success, true);

  const withDiagram = UpdateSectionSchema.safeParse({
    baseRev: 1,
    diagram: {
      kind: "mermaid",
      code: "graph TD; A-->B;",
      status: "unchecked",
    },
  });
  assert.equal(withDiagram.success, true);

  const missingBaseRev = UpdateSectionSchema.safeParse({
    content: "Updated content",
  });
  assert.equal(missingBaseRev.success, false);

  const negativeBaseRev = UpdateSectionSchema.safeParse({
    baseRev: -1,
  });
  assert.equal(negativeBaseRev.success, false);
});

test("Zod Schemas - ChangeSetActionSchema handles apply, reject, and revert", () => {
  const applyAction = ChangeSetActionSchema.safeParse({
    action: "apply",
    sectionIds: ["sec_1", "sec_2"],
  });
  assert.equal(applyAction.success, true);

  const rejectAction = ChangeSetActionSchema.safeParse({
    action: "reject",
  });
  assert.equal(rejectAction.success, true);

  const revertAction = ChangeSetActionSchema.safeParse({
    action: "revert",
  });
  assert.equal(revertAction.success, true);

  const invalidAction = ChangeSetActionSchema.safeParse({
    action: "unknown",
  });
  assert.equal(invalidAction.success, false);
});

test("ID Generators - generate unique IDs with correct prefixes", () => {
  const chapId1 = generateChapterId();
  const chapId2 = generateChapterId();
  assert.match(chapId1, /^chap_[a-z0-9]{10}$/);
  assert.notEqual(chapId1, chapId2);

  const secId1 = generateSectionId();
  const secId2 = generateSectionId();
  assert.match(secId1, /^sec_[a-z0-9]{10}$/);
  assert.notEqual(secId1, secId2);

  const edgeId1 = generateEdgeId();
  const edgeId2 = generateEdgeId();
  assert.match(edgeId1, /^edge_[a-z0-9]{8}$/);
  assert.notEqual(edgeId1, edgeId2);
});

test("toObjectId helper - safely parses valid and rejects invalid ObjectIds", () => {
  const validHex = "507f1f77bcf86cd799439011";
  const oid = toObjectId(validHex);
  assert.ok(oid instanceof ObjectId);
  assert.equal(oid.toHexString(), validHex);

  const existingOid = new ObjectId();
  const parsedOid = toObjectId(existingOid);
  assert.equal(parsedOid, existingOid);

  assert.equal(toObjectId("invalid-id"), null);
  assert.equal(toObjectId("123"), null);
  assert.equal(toObjectId(""), null);
  assert.equal(toObjectId("507f1f77bcf86cd79943901g"), null); // non-hex char
});

test("getOwnerId - generates UUID or honors explicit ID", () => {
  const explicit = getOwnerId("user-fixed-123");
  assert.equal(explicit, "user-fixed-123");

  const generated = getOwnerId();
  assert.ok(typeof generated === "string");
  assert.match(
    generated,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  );
});

test("PrdDocumentSchema - validates complete PRD document data model", () => {
  const sampleDoc: PrdDocument = {
    _id: new ObjectId(),
    ownerId: "owner_123",
    title: "My SaaS PRD",
    titleEdited: false,
    idea: "A SaaS tool for automated PRDs",
    lang: "id",
    status: "brainstorming",
    brainstorm: {
      questions: [
        {
          id: "q1",
          text: "What is your target audience?",
          options: ["Developers", "Product Managers"],
          allowCustom: true,
        },
      ],
      answers: [
        {
          questionId: "q1",
          value: "Developers",
          isCustom: false,
        },
      ],
    },
    keyDecisions: ["Use PostgreSQL", "Target B2B"],
    chapters: [
      { id: "chap_intro", title: "Introduction", order: 1 },
      { id: "chap_tech", title: "Technical Architecture", order: 2 },
    ],
    sections: [
      {
        id: "sec_overview",
        chapterId: "chap_intro",
        type: "overview",
        title: "Product Overview",
        content: "# Overview\nThis product is...",
        order: 1,
        status: "ready",
        rev: 1,
        updatedAt: new Date(),
      },
    ],
    edges: [{ id: "edge_1", from: "sec_overview", to: "sec_tech" }],
    run: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const parsed = PrdDocumentSchema.safeParse(sampleDoc);
  assert.equal(parsed.success, true);
});

test("PrdChangeSetSchema - validates changeset with items and snapshot data", () => {
  const sampleChangeSet: PrdChangeSet = {
    _id: new ObjectId(),
    ownerId: "owner_123",
    docId: new ObjectId(),
    originSectionId: "sec_arch",
    instruction: "Switch database from MongoDB to PostgreSQL",
    status: "pending",
    rationale: "Relational data fits compliance requirements better",
    warnings: ["Schema migrations will be needed"],
    keyDecisionChanges: [
      { before: "MongoDB Atlas", after: "PostgreSQL on Supabase" },
    ],
    items: [
      {
        sectionId: "sec_arch",
        role: "origin",
        reason: "User requested switch to PostgreSQL",
        detectedBy: "origin",
        baseRev: 2,
        before: {
          title: "Database Architecture",
          content: "We use MongoDB.",
        },
        after: {
          title: "Database Architecture",
          content: "We use PostgreSQL.",
        },
        status: "ready",
      },
      {
        sectionId: "sec_data_model",
        role: "impacted",
        reason: "Data model needs relational foreign keys",
        detectedBy: "ai",
        baseRev: 1,
        before: {
          title: "Data Models",
          content: "Document collections...",
        },
        after: {
          title: "Data Models",
          content: "Relational tables with foreign keys...",
        },
        status: "ready",
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const parsed = PrdChangeSetSchema.safeParse(sampleChangeSet);
  assert.equal(parsed.success, true);
});

test("Optimistic Concurrency & Atomic Apply Simulation", () => {
  // Simulate document in memory
  const doc: {
    _id: ObjectId;
    ownerId: string;
    sections: Section[];
    keyDecisions: string[];
  } = {
    _id: new ObjectId(),
    ownerId: "owner_test",
    sections: [
      {
        id: "sec_1",
        chapterId: "chap_1",
        type: "overview",
        title: "Section 1",
        content: "Content 1",
        order: 1,
        status: "ready",
        rev: 2,
        updatedAt: new Date(),
      },
      {
        id: "sec_2",
        chapterId: "chap_1",
        type: "architecture",
        title: "Section 2",
        content: "Content 2",
        order: 2,
        status: "ready",
        rev: 1,
        updatedAt: new Date(),
      },
    ],
    keyDecisions: ["Decision A"],
  };

  // Test single section update with matching baseRev
  const updateMatch = (
    sectionId: string,
    baseRev: number,
    newContent: string
  ) => {
    const sec = doc.sections.find((s) => s.id === sectionId && s.rev === baseRev);
    if (!sec) {
      const current = doc.sections.find((s) => s.id === sectionId);
      return { success: false, conflict: true, currentRev: current?.rev };
    }
    sec.content = newContent;
    sec.rev += 1;
    return { success: true, rev: sec.rev };
  };

  // 1. Success update on sec_1 (baseRev: 2 -> new rev: 3)
  const res1 = updateMatch("sec_1", 2, "Updated Content 1");
  assert.equal(res1.success, true);
  assert.equal(res1.rev, 3);

  // 2. Stale update on sec_1 (trying to update with baseRev 2 again -> conflict 409)
  const res2 = updateMatch("sec_1", 2, "Concurrent Stale Content");
  assert.equal(res2.success, false);
  assert.equal(res2.conflict, true);
  assert.equal(res2.currentRev, 3);

  // 3. Concurrent PATCH to different sections do not conflict
  // sec_2 has baseRev: 1
  const res3 = updateMatch("sec_2", 1, "Updated Content 2");
  assert.equal(res3.success, true);
  assert.equal(res3.rev, 2);

  // 4. Atomic changeset apply: if one section has a conflict, reject the whole apply
  const atomicApply = (
    items: { sectionId: string; baseRev: number; newContent: string }[]
  ) => {
    // Check all baseRevs atomically
    const conflicts: string[] = [];
    for (const it of items) {
      const sec = doc.sections.find((s) => s.id === it.sectionId);
      if (!sec || sec.rev !== it.baseRev) {
        conflicts.push(it.sectionId);
      }
    }
    if (conflicts.length > 0) {
      return { success: false, conflicts };
    }
    // Apply all
    for (const it of items) {
      const sec = doc.sections.find((s) => s.id === it.sectionId)!;
      sec.content = it.newContent;
      sec.rev += 1;
    }
    return { success: true, appliedSectionIds: items.map((i) => i.sectionId) };
  };

  // Attempt atomic apply where sec_1 has wrong baseRev (2 instead of 3), sec_2 has correct baseRev (2)
  const failApply = atomicApply([
    { sectionId: "sec_1", baseRev: 2, newContent: "New from changeset 1" },
    { sectionId: "sec_2", baseRev: 2, newContent: "New from changeset 2" },
  ]);
  assert.equal(failApply.success, false);
  assert.deepEqual(failApply.conflicts, ["sec_1"]);
  // Verify sec_2 was NOT modified (all-or-nothing atomicity)
  const sec2 = doc.sections.find((s) => s.id === "sec_2")!;
  assert.equal(sec2.content, "Updated Content 2");
  assert.equal(sec2.rev, 2);

  // Successful atomic apply when all baseRevs match
  const successApply = atomicApply([
    { sectionId: "sec_1", baseRev: 3, newContent: "Atomically applied 1" },
    { sectionId: "sec_2", baseRev: 2, newContent: "Atomically applied 2" },
  ]);
  assert.equal(successApply.success, true);
  assert.equal(doc.sections.find((s) => s.id === "sec_1")?.rev, 4);
  assert.equal(doc.sections.find((s) => s.id === "sec_2")?.rev, 3);
});

test("Owner Isolation Simulation", () => {
  const documents = [
    { _id: "doc_1", ownerId: "owner_alice", title: "Alice PRD" },
    { _id: "doc_2", ownerId: "owner_bob", title: "Bob PRD" },
  ];

  const getDoc = (id: string, requesterOwnerId: string) => {
    const doc = documents.find(
      (d) => d._id === id && d.ownerId === requesterOwnerId
    );
    if (!doc) return { status: 404, error: "NOT_FOUND" };
    return { status: 200, doc };
  };

  // Alice can access Alice's document
  const aliceReadAlice = getDoc("doc_1", "owner_alice");
  assert.equal(aliceReadAlice.status, 200);

  // Bob cannot access Alice's document (returns 404 NOT_FOUND, no leakage)
  const bobReadAlice = getDoc("doc_1", "owner_bob");
  assert.equal(bobReadAlice.status, 404);
  assert.equal(bobReadAlice.error, "NOT_FOUND");
});
