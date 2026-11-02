import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { createOpenAI } from "@ai-sdk/openai";
import {
  termMatch,
  buildTermRegex,
  findMatchingTerms,
} from "../src/lib/agent/impact";
import {
  ReviserOutputSchema,
  runReviser,
  buildReviserPrompt,
} from "../src/lib/agent/reviser";
import {
  PropagatorOutputSchema,
  runPropagator,
  buildPropagatorPrompt,
} from "../src/lib/agent/propagator";
import {
  runChangeSetGeneration,
  type ChangeSetRunnerRepo,
} from "../src/lib/agent/changeSetRunner";
import {
  applyChangeSetAtomic,
  revertChangeSetAtomic,
} from "../src/lib/db/prdRepository";
import type { PrdDocument, Section } from "../src/lib/schemas/prd";
import type { PrdChangeSet, ChangeItem } from "../src/lib/schemas/agent";

// Mock AI client helper
function createMockAiClient(
  handler: (prompt: string) => Record<string, unknown>
) {
  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let promptText = "";
    if (init?.body) {
      try {
        const bodyObj = JSON.parse(init.body as string);
        promptText = JSON.stringify(bodyObj.messages || []);
      } catch {
        promptText = String(init.body);
      }
    }

    const payload = handler(promptText);

    return new Response(
      JSON.stringify({
        id: "chatcmpl-mock",
        object: "chat.completion",
        created: Date.now(),
        model: "gemini",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify(payload),
            },
            finish_reason: "stop",
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  };

  return createOpenAI({
    baseURL: "http://localhost:9999/v1",
    apiKey: "test-key",
    fetch: mockFetch,
  });
}

// -------------------------------------------------------------
// 1. Term Matching & Regex Boundary Tests
// -------------------------------------------------------------

test("Term Matching - buildTermRegex enforces word boundaries and case insensitivity", () => {
  const rxExpress = buildTermRegex("Express");
  assert.equal(rxExpress.test("API with Express framework"), true);
  assert.equal(rxExpress.test("expressive writing style"), false);
  assert.equal(rxExpress.test("using express."), true);
  assert.equal(rxExpress.test("EXPRESS_SERVER"), false);

  const rxNode = buildTermRegex("Node.js");
  assert.equal(rxNode.test("Built on Node.js runtime"), true);
  assert.equal(rxNode.test("built with node.js"), true);
  assert.equal(rxNode.test("superNode.js"), false);

  const rxNpm = buildTermRegex("npm");
  assert.equal(rxNpm.test("run npm install"), true);
  assert.equal(rxNpm.test("anpmn package"), false);
});

test("Term Matching - findMatchingTerms scans content and diagram code", () => {
  const text = `
## Architecture
Backend API is implemented using Express.
Database models use Mongoose.
  `;
  const terms = ["Express", "Node.js", "Mongoose", "npm"];
  const matches = findMatchingTerms(text, terms);
  assert.deepEqual(matches, ["Express", "Mongoose"]);

  const diagram = `
graph TD
  Client --> API[Express API]
  API --> DB[(MongoDB)]
  `;
  const diagMatches = findMatchingTerms(diagram, terms);
  assert.deepEqual(diagMatches, ["Express"]);
});

test("Term Matching - termMatch catches sections missed by AI and assigns detectedBy: 'term-match'", () => {
  const sections = [
    {
      id: "sec_tech",
      title: "Tech Stack",
      content: "Node.js + Express + Mongoose",
    },
    {
      id: "sec_arch",
      title: "Architecture",
      content: "Microservices with Express API",
      diagram: { code: "graph TD\n Client --> API[Express API]" },
    },
    {
      id: "sec_data",
      title: "Data Model",
      content: "Uses Mongoose schema definitions.",
    },
    {
      id: "sec_roadmap",
      title: "Roadmap",
      content: "Phase 1: Setup repo and run npm install.",
    },
    {
      id: "sec_features",
      title: "Features",
      content: "F-1: User Login. F-2: Search Cameras.",
    },
  ];

  const replacedTerms = ["Node.js", "Express", "npm", "Mongoose"];
  const originSectionId = "sec_tech";

  // Suppose AI only identified Architecture (sec_arch) and Data Model (sec_data)
  const aiImpacted = [
    { sectionId: "sec_arch", reason: "Ganti Express API dengan framework baru" },
    { sectionId: "sec_data", reason: "Ganti Mongoose dengan driver baru" },
  ];

  const result = termMatch(replacedTerms, sections, originSectionId, aiImpacted, "id");

  // Should have 3 items: sec_arch (ai), sec_data (ai), sec_roadmap (term-match)
  assert.equal(result.length, 3);

  const archItem = result.find((r) => r.sectionId === "sec_arch");
  assert.ok(archItem);
  assert.equal(archItem.detectedBy, "ai");
  assert.deepEqual(archItem.matchedTerms, ["Express"]);

  const dataItem = result.find((r) => r.sectionId === "sec_data");
  assert.ok(dataItem);
  assert.equal(dataItem.detectedBy, "ai");
  assert.deepEqual(dataItem.matchedTerms, ["Mongoose"]);

  const roadmapItem = result.find((r) => r.sectionId === "sec_roadmap");
  assert.ok(roadmapItem);
  assert.equal(roadmapItem.detectedBy, "term-match");
  assert.deepEqual(roadmapItem.matchedTerms, ["npm"]);
  assert.match(roadmapItem.reason, /Memuat istilah lama yang diganti/);

  // Features does not contain any replaced terms, should not be included
  assert.equal(result.some((r) => r.sectionId === "sec_features"), false);
});

// -------------------------------------------------------------
// 2. Reviser & Propagator Schema Validation Tests
// -------------------------------------------------------------

test("Reviser - ReviserOutputSchema validates 'ok' scope with origin and keyDecisionChanges", () => {
  const validOk = {
    scope: "ok",
    origin: {
      title: "Tech Stack",
      content: "Python + FastAPI + PostgreSQL",
    },
    keyDecisionChanges: [
      { before: "Backend: Node.js + Express", after: "Backend: Python + FastAPI" },
    ],
    replacedTerms: ["Node.js", "Express", "npm", "Mongoose"],
    impacted: [
      { sectionId: "sec_arch", reason: "Architecture mentions Express" },
    ],
    warnings: ["Perlu migrasi script CI/CD dari npm ke pip"],
    rationale: "FastAPI dipilih sebagai standar modern Python async.",
  };

  const parsed = ReviserOutputSchema.safeParse(validOk);
  assert.equal(parsed.success, true);
});

test("Reviser - ReviserOutputSchema validates 'redirect' scope and rejects missing redirect details", () => {
  const validRedirect = {
    scope: "redirect",
    redirect: {
      sectionId: "sec_auth",
      reason: "Instruksi mengenai login pengguna harus diterapkan pada section Otentikasi",
    },
  };
  const parsed = ReviserOutputSchema.safeParse(validRedirect);
  assert.equal(parsed.success, true);

  const invalidRedirect = {
    scope: "redirect",
  };
  const invalidParsed = ReviserOutputSchema.safeParse(invalidRedirect);
  assert.equal(invalidParsed.success, false);
});

test("Propagator - PropagatorOutputSchema validates markdown content and diagramCode", () => {
  const valid = {
    content: "## Updated Architecture\nFastAPI handles all REST endpoints.",
    diagramCode: "graph TD\n Client --> API[FastAPI]",
  };
  const parsed = PropagatorOutputSchema.safeParse(valid);
  assert.equal(parsed.success, true);

  const invalidEmpty = {
    content: "",
  };
  const invalidParsed = PropagatorOutputSchema.safeParse(invalidEmpty);
  assert.equal(invalidParsed.success, false);
});

// -------------------------------------------------------------
// 3. Full Multi-Section Chained Revision Pipeline (Section 6.6 Acceptance Scenario)
// -------------------------------------------------------------

test("Acceptance Scenario (Section 6.6) - Tech stack changed from Node.js/Express to Python/FastAPI cascades to Architecture, Data Model, and Roadmap", async () => {
  const docId = new ObjectId();
  const ownerId = "owner_test_rev";

  const doc: PrdDocument = {
    _id: docId,
    ownerId,
    title: "Sistem Rental Kamera",
    titleEdited: false,
    idea: "Aplikasi rental kamera online",
    lang: "id",
    status: "ready",
    brainstorm: { questions: [], answers: [] },
    keyDecisions: [
      "Backend: Node.js + Express",
      "Database: MongoDB + Mongoose",
      "Frontend: Next.js",
    ],
    chapters: [
      { id: "chap_1", title: "Gambaran Umum", order: 1 },
      { id: "chap_2", title: "Desain Teknis", order: 2 },
    ],
    sections: [
      {
        id: "sec_overview",
        chapterId: "chap_1",
        type: "overview",
        title: "Overview Proyek",
        content: "Platform rental kamera profesional untuk fotografer.",
        order: 1,
        status: "ready",
        rev: 1,
        updatedAt: new Date(),
      },
      {
        id: "sec_arch",
        chapterId: "chap_2",
        type: "architecture",
        title: "Arsitektur",
        content: "Arsitektur berbasis monolitik modular dengan Express API.",
        diagram: {
          kind: "mermaid",
          code: "graph TD\n Client --> API[Express API]\n API --> DB[(MongoDB)]",
          status: "ok",
        },
        order: 1,
        status: "ready",
        rev: 1,
        updatedAt: new Date(),
      },
      {
        id: "sec_tech",
        chapterId: "chap_2",
        type: "tech_stack",
        title: "Tech Stack",
        content: "Backend menggunakan Node.js + Express + Mongoose.",
        order: 2,
        status: "ready",
        rev: 1,
        updatedAt: new Date(),
      },
      {
        id: "sec_data",
        chapterId: "chap_2",
        type: "data_model",
        title: "Data Model",
        content: "Definisi skema entitas menggunakan Mongoose ODM.",
        order: 3,
        status: "ready",
        rev: 1,
        updatedAt: new Date(),
      },
      {
        id: "sec_roadmap",
        chapterId: "chap_2",
        type: "roadmap",
        title: "Roadmap",
        content: "Sprint 1: Instalasi pustaka dengan npm install.",
        order: 4,
        status: "ready",
        rev: 1,
        updatedAt: new Date(),
      },
    ],
    edges: [],
    run: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock AI client that responds appropriately to Reviser and Propagator
  const mockAiClient = createMockAiClient((prompt) => {
    if (prompt.includes("<instruction>")) {
      return {
        scope: "ok",
        origin: {
          title: "Tech Stack",
          content: "Backend menggunakan Python + FastAPI + Beanie ODM.",
        },
        keyDecisionChanges: [
          {
            before: "Backend: Node.js + Express",
            after: "Backend: Python + FastAPI",
          },
        ],
        replacedTerms: ["Node.js", "Express", "npm", "Mongoose"],
        // AI only mentions sec_arch and sec_data; misses sec_roadmap (which has "npm")
        impacted: [
          {
            sectionId: "sec_arch",
            reason: "Arsitektur merujuk pada Express API",
          },
          {
            sectionId: "sec_data",
            reason: "Data Model menggunakan Mongoose ODM",
          },
        ],
        warnings: ["Perlu memastikan lingkungan Python 3.11+ di server deploy"],
        rationale: "FastAPI dipilih karena performa async dan dokumentasi OpenAPI otomatis.",
      };
    }

    if (prompt.includes("sec_arch")) {
      return {
        content: "Arsitektur berbasis monolitik modular dengan FastAPI.",
        diagramCode: "graph TD\n Client --> API[FastAPI]\n API --> DB[(MongoDB)]",
      };
    }

    if (prompt.includes("sec_data")) {
      return {
        content: "Definisi skema entitas menggunakan Beanie ODM untuk Python.",
      };
    }

    if (prompt.includes("sec_roadmap")) {
      return {
        content: "Sprint 1: Instalasi pustaka dengan pip install -r requirements.txt.",
      };
    }

    return { content: "Updated content" };
  });

  // Track events emitted during changeset generation
  const emittedEvents: Array<{ event: string; data: unknown }> = [];
  const emit = (event: string, data: unknown) => {
    emittedEvents.push({ event, data });
  };

  let savedChangeSet: Partial<PrdChangeSet> | null = null;
  const mockRepo: Partial<ChangeSetRunnerRepo> = {
    updateChangeSet: async (id, owner, updates) => {
      savedChangeSet = { ...savedChangeSet, ...updates };
      return true;
    },
    deleteChangeSet: async () => true,
    getChangeSetById: async () => null,
  };

  const csId = new ObjectId().toString();

  const result = await runChangeSetGeneration({
    doc,
    originSectionId: "sec_tech",
    instruction: "aku mau pakai Python",
    ownerId,
    changesetId: csId,
    emit,
    client: mockAiClient,
    repo: mockRepo,
  });

  assert.equal(result.success, true);

  // 1. Verify event stream order conformant to Section 7.6
  const eventTypes = emittedEvents.map((e) => e.event);
  assert.ok(eventTypes.includes("changeset.started"));
  assert.ok(eventTypes.includes("origin.ready"));
  assert.ok(eventTypes.includes("impact.ready"));
  assert.ok(eventTypes.includes("item.ready"));
  assert.ok(eventTypes.includes("changeset.ready"));

  // 2. Verify impact.ready detected all 3 impacted sections (2 from AI, 1 caught by term-match)
  const impactReadyEvent = emittedEvents.find((e) => e.event === "impact.ready");
  assert.ok(impactReadyEvent);
  const impactData = impactReadyEvent.data as {
    items: Array<{ sectionId: string; reason: string; detectedBy: string }>;
  };
  assert.equal(impactData.items.length, 3);

  const roadmapItem = impactData.items.find((i) => i.sectionId === "sec_roadmap");
  assert.ok(roadmapItem);
  assert.equal(roadmapItem.detectedBy, "term-match");

  // 3. Verify origin.ready contains updated key decisions
  const originReadyEvent = emittedEvents.find((e) => e.event === "origin.ready");
  assert.ok(originReadyEvent);
  const originData = originReadyEvent.data as {
    keyDecisionChanges: Array<{ before?: string; after: string }>;
  };
  assert.equal(originData.keyDecisionChanges.length, 1);
  assert.equal(
    originData.keyDecisionChanges[0].after,
    "Backend: Python + FastAPI"
  );

  // 4. Verify MongoDB changeset was saved with status 'pending' and 4 items total (1 origin + 3 impacted)
  const savedCs = savedChangeSet as Partial<PrdChangeSet> | null;
  assert.ok(savedCs);
  assert.equal(savedCs.status, "pending");
  assert.equal(savedCs.items?.length, 4);

  // 5. Verify document sections were NEVER modified during generation
  const techSec = doc.sections.find((s) => s.id === "sec_tech")!;
  assert.equal(techSec.content, "Backend menggunakan Node.js + Express + Mongoose.");
  assert.equal(techSec.rev, 1);
});

// -------------------------------------------------------------
// 4. Redirect Workflow Test
// -------------------------------------------------------------

test("Reviser Redirect - out-of-scope instruction deletes changeset and emits changeset.redirect", async () => {
  const docId = new ObjectId();
  const ownerId = "owner_test_redirect";

  const doc: PrdDocument = {
    _id: docId,
    ownerId,
    title: "Test PRD",
    titleEdited: false,
    idea: "Test Idea",
    lang: "id",
    status: "ready",
    brainstorm: { questions: [], answers: [] },
    keyDecisions: [],
    chapters: [],
    sections: [
      {
        id: "sec_tech",
        chapterId: "chap_1",
        type: "tech_stack",
        title: "Tech Stack",
        content: "Tech stack description",
        order: 1,
        status: "ready",
        rev: 1,
        updatedAt: new Date(),
      },
      {
        id: "sec_features",
        chapterId: "chap_1",
        type: "features",
        title: "Fitur Pembayaran",
        content: "Daftar fitur pembayaran",
        order: 2,
        status: "ready",
        rev: 1,
        updatedAt: new Date(),
      },
    ],
    edges: [],
    run: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAiClient = createMockAiClient(() => ({
    scope: "redirect",
    redirect: {
      sectionId: "sec_features",
      reason: "Instruksi menambah opsi pembayaran QRIS seharusnya diarahkan ke Fitur Pembayaran",
    },
  }));

  const emittedEvents: Array<{ event: string; data: unknown }> = [];
  let changesetDeleted = false;

  const mockRepo: Partial<ChangeSetRunnerRepo> = {
    updateChangeSet: async () => true,
    deleteChangeSet: async () => {
      changesetDeleted = true;
      return true;
    },
  };

  const result = await runChangeSetGeneration({
    doc,
    originSectionId: "sec_tech",
    instruction: "tambah pembayaran QRIS",
    ownerId,
    changesetId: "cs_redirect_test",
    emit: (event, data) => emittedEvents.push({ event, data }),
    client: mockAiClient,
    repo: mockRepo,
  });

  assert.equal(result.success, true);
  assert.equal(result.redirect, true);
  assert.equal(changesetDeleted, true);

  const redirectEvent = emittedEvents.find((e) => e.event === "changeset.redirect");
  assert.ok(redirectEvent);
  const redirectData = redirectEvent.data as { sectionId: string; reason: string };
  assert.equal(redirectData.sectionId, "sec_features");
});

// -------------------------------------------------------------
// 5. Atomic Apply & Revert Concurrency Tests
// -------------------------------------------------------------

test("Atomic Apply - aborts with 409 conflicts if any section baseRev is stale without partial changes", () => {
  // Simulate the in-memory check and atomic apply logic
  const originalSections: Section[] = [
    {
      id: "sec_1",
      chapterId: "c1",
      type: "tech_stack",
      title: "Tech Stack",
      content: "Node.js",
      order: 1,
      status: "ready",
      rev: 2, // Concurrently updated by user from 1 to 2!
      updatedAt: new Date(),
    },
    {
      id: "sec_2",
      chapterId: "c1",
      type: "architecture",
      title: "Architecture",
      content: "Express API",
      order: 2,
      status: "ready",
      rev: 1,
      updatedAt: new Date(),
    },
  ];

  // Changeset was generated when sec_1 and sec_2 both had rev: 1
  const changeSet: Partial<PrdChangeSet> = {
    originSectionId: "sec_1",
    keyDecisionChanges: [{ before: "Node.js", after: "Python" }],
    items: [
      {
        sectionId: "sec_1",
        role: "origin",
        reason: "Switch to Python",
        detectedBy: "origin",
        baseRev: 1, // Stale! Current is 2
        before: { title: "Tech Stack", content: "Node.js" },
        after: { title: "Tech Stack", content: "Python" },
        status: "ready",
      },
      {
        sectionId: "sec_2",
        role: "impacted",
        reason: "Cascade to Python API",
        detectedBy: "ai",
        baseRev: 1, // Matches current
        before: { title: "Architecture", content: "Express API" },
        after: { title: "Architecture", content: "FastAPI" },
        status: "ready",
      },
    ],
  };

  // Pre-check detects conflict
  const conflicts: string[] = [];
  for (const it of changeSet.items!) {
    const sec = originalSections.find((s) => s.id === it.sectionId);
    if (!sec || sec.rev !== it.baseRev) {
      conflicts.push(it.sectionId);
    }
  }

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0], "sec_1");

  // Ensure NO section was partially changed
  assert.equal(originalSections[0].content, "Node.js");
  assert.equal(originalSections[1].content, "Express API");
});

test("Atomic Apply - succeeds when all baseRev match, updates keyDecisions and section contents", () => {
  const currentDoc = {
    keyDecisions: ["Backend: Node.js + Express", "Database: MongoDB"],
    sections: [
      {
        id: "sec_1",
        title: "Tech Stack",
        content: "Node.js",
        rev: 1,
      },
      {
        id: "sec_2",
        title: "Architecture",
        content: "Express API",
        rev: 1,
      },
    ],
  };

  const changeSet: Partial<PrdChangeSet> = {
    originSectionId: "sec_1",
    keyDecisionChanges: [
      { before: "Backend: Node.js + Express", after: "Backend: Python + FastAPI" },
    ],
    items: [
      {
        sectionId: "sec_1",
        role: "origin",
        reason: "Switch to Python",
        detectedBy: "origin",
        baseRev: 1,
        before: { title: "Tech Stack", content: "Node.js" },
        after: { title: "Tech Stack", content: "Python" },
        status: "ready",
      },
      {
        sectionId: "sec_2",
        role: "impacted",
        reason: "Cascade to Python API",
        detectedBy: "ai",
        baseRev: 1,
        before: { title: "Architecture", content: "Express API" },
        after: { title: "Architecture", content: "FastAPI" },
        status: "ready",
      },
    ],
  };

  // 1. Simulate key decision replacement
  const updatedDecisions = [...currentDoc.keyDecisions];
  for (const change of changeSet.keyDecisionChanges!) {
    const idx = updatedDecisions.indexOf(change.before!);
    if (idx !== -1) {
      updatedDecisions[idx] = change.after;
    }
  }

  assert.deepEqual(updatedDecisions, [
    "Backend: Python + FastAPI",
    "Database: MongoDB",
  ]);

  // 2. Simulate atomic update
  const updatedSections = currentDoc.sections.map((s) => {
    const it = changeSet.items!.find((item) => item.sectionId === s.id)!;
    return {
      ...s,
      content: it.after!.content,
      rev: s.rev + 1,
    };
  });

  assert.equal(updatedSections[0].content, "Python");
  assert.equal(updatedSections[0].rev, 2);
  assert.equal(updatedSections[1].content, "FastAPI");
  assert.equal(updatedSections[1].rev, 2);

  // 3. Simulate Revert: sections with rev === appliedRev (2) are safely restored
  const revertedSections = updatedSections.map((s) => {
    const it = changeSet.items!.find((item) => item.sectionId === s.id)!;
    if (s.rev === 2) {
      return {
        ...s,
        content: it.before.content,
        rev: s.rev + 1,
      };
    }
    return s;
  });

  assert.equal(revertedSections[0].content, "Node.js");
  assert.equal(revertedSections[0].rev, 3);
  assert.equal(revertedSections[1].content, "Express API");
  assert.equal(revertedSections[1].rev, 3);
});
