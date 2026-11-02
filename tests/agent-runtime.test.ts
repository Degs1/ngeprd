import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { createOpenAI } from "@ai-sdk/openai";
import {
  encodeSseEvent,
  SSE_HEADERS,
} from "../src/lib/sse/encode";
import {
  parseSseBlock,
  parseSseText,
  createSseStreamParser,
} from "../src/lib/sse/parse";
import {
  PlannerAiOutputSchema,
  runPlanner,
} from "../src/lib/agent/planner";
import {
  runSectionWriter,
  sanitizeSectionMarkdown,
} from "../src/lib/agent/sectionWriter";
import {
  runDiagramGenerator,
  cleanMermaidCode,
} from "../src/lib/agent/diagramGenerator";
import {
  runGeneration,
  type RunnerRepo,
} from "../src/lib/agent/runner";
import { isRunActive } from "../src/lib/db/prdRepository";
import type {
  PrdDocument,
  Section,
  Chapter,
  Edge,
} from "../src/lib/schemas/prd";

// Helper to create an in-memory mock OpenAI client
function createMockAiClient(responses: Record<string, unknown> | ((prompt: string) => Record<string, unknown>)) {
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

    let payload: Record<string, unknown>;
    if (typeof responses === "function") {
      payload = responses(promptText);
    } else {
      payload = responses;
    }

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
// 1. SSE Utilities Tests
// -------------------------------------------------------------

test("SSE Utilities - encodeSseEvent formats events and handles multiline data", () => {
  const singleLine = encodeSseEvent("run.started", { runId: "run_123", total: 10 });
  assert.equal(
    singleLine,
    'event: run.started\ndata: {"runId":"run_123","total":10}\n\n'
  );

  const withId = encodeSseEvent("section.started", { sectionId: "sec_1" }, "msg_1");
  assert.equal(
    withId,
    'id: msg_1\nevent: section.started\ndata: {"sectionId":"sec_1"}\n\n'
  );

  const multiline = encodeSseEvent("message", "line1\nline2");
  assert.equal(multiline, "event: message\ndata: line1\ndata: line2\n\n");
});

test("SSE Utilities - parseSseBlock and parseSseText parse events and ignore comments", () => {
  const raw = `: keepalive comment\nevent: plan.ready\ndata: {"title":"Test PRD","chapters":[]}\n\n`;
  const parsed = parseSseBlock(raw);
  assert.ok(parsed);
  assert.equal(parsed.event, "plan.ready");
  assert.deepEqual(parsed.data, { title: "Test PRD", chapters: [] });

  const multiText = [
    `: comment 1`,
    `event: run.started`,
    `data: {"total":5}`,
    ``,
    `event: section.started`,
    `data: {"sectionId":"sec_01"}`,
    ``,
  ].join("\n");

  const events = parseSseText(multiText);
  assert.equal(events.length, 2);
  assert.equal(events[0].event, "run.started");
  assert.equal(events[1].event, "section.started");

  // Verify indentation preservation for code blocks / mermaid
  const indentedBlock = [
    ": comment",
    "event: code.snippet",
    "data:   function test() {",
    "data:     return 42;",
    "data:   }",
  ].join("\n");
  const parsedIndented = parseSseBlock(indentedBlock);
  assert.ok(parsedIndented);
  assert.equal(parsedIndented.raw, "  function test() {\n    return 42;\n  }");
});

test("SSE Utilities - createSseStreamParser handles chunk boundaries", () => {
  const events: Array<{ event: string; data: unknown }> = [];
  const parser = createSseStreamParser((e) => events.push(e));

  // Chunk 1: Incomplete block
  parser.feed("event: run.start");
  assert.equal(events.length, 0);

  // Chunk 2: Completion of first event + start of second event
  parser.feed('ed\ndata: {"runId":"r1"}\n\nevent: heartbeat\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].event, "run.started");

  // Chunk 3: End of second event
  parser.feed("data: {}\n\n");
  assert.equal(events.length, 2);
  assert.equal(events[1].event, "heartbeat");
});

// -------------------------------------------------------------
// 2. Planner Tests
// -------------------------------------------------------------

test("PlannerAiOutputSchema - validates 3-5 chapters, 8-14 sections, and required section types", () => {
  const validPlannerOutput = {
    title: "Sistem Rental Kamera",
    keyDecisions: [
      "Platform Web Responsif Next.js",
      "Backend Node.js dengan MongoDB",
      "Verifikasi identitas via KTP dan deposit",
    ],
    chapters: [
      {
        key: "chap_intro",
        title: "Pendahuluan",
        sections: [
          {
            key: "sec_overview",
            type: "overview",
            title: "Gambaran Proyek",
            brief: "Ringkasan platform rental kamera",
            dependsOn: [],
          },
          {
            key: "sec_problem",
            type: "problem",
            title: "Permasalahan & Solusi",
            brief: "Masalah sulitnya sewa kamera aman",
            dependsOn: ["sec_overview"],
          },
          {
            key: "sec_users",
            type: "users",
            title: "Pengguna & Persona",
            brief: "Fotografer lepas dan pemilik rental",
            dependsOn: ["sec_overview"],
          },
        ],
      },
      {
        key: "chap_features",
        title: "Fitur & Fungsionalitas",
        sections: [
          {
            key: "sec_features",
            type: "features",
            title: "Fitur Utama",
            brief: "Katalog, booking, dan pembayaran",
            dependsOn: ["sec_users"],
          },
          {
            key: "sec_flow",
            type: "flow",
            title: "Alur Peminjaman",
            diagramHint: "flowchart",
            dependsOn: ["sec_features"],
          },
          {
            key: "sec_data",
            type: "data_model",
            title: "Model Data",
            diagramHint: "er",
            dependsOn: ["sec_features"],
          },
        ],
      },
      {
        key: "chap_tech",
        title: "Teknis & Arsitektur",
        sections: [
          {
            key: "sec_tech",
            type: "tech_stack",
            title: "Tech Stack & Infrastruktur",
            brief: "Next.js, Tailwind, MongoDB Atlas",
            dependsOn: ["sec_overview"],
          },
          {
            key: "sec_arch",
            type: "architecture",
            title: "Arsitektur Sistem",
            diagramHint: "flowchart",
            dependsOn: ["sec_tech"],
          },
        ],
      },
    ],
  };

  const parsed = PlannerAiOutputSchema.safeParse(validPlannerOutput);
  assert.equal(parsed.success, true);

  // Rejects less than 8 sections
  const tooFewSections = {
    ...validPlannerOutput,
    chapters: [
      {
        ...validPlannerOutput.chapters[0],
        sections: validPlannerOutput.chapters[0].sections.slice(0, 1),
      },
      validPlannerOutput.chapters[1],
      validPlannerOutput.chapters[2],
    ],
  };
  const tooFew = PlannerAiOutputSchema.safeParse(tooFewSections);
  assert.equal(tooFew.success, false);

  // Rejects if first section is not overview
  const notOverviewFirst = {
    ...validPlannerOutput,
    chapters: [
      {
        ...validPlannerOutput.chapters[0],
        sections: [
          {
            ...validPlannerOutput.chapters[0].sections[0],
            type: "problem",
          },
          ...validPlannerOutput.chapters[0].sections.slice(1),
        ],
      },
      validPlannerOutput.chapters[1],
      validPlannerOutput.chapters[2],
    ],
  };
  const invalidFirst = PlannerAiOutputSchema.safeParse(notOverviewFirst);
  assert.equal(invalidFirst.success, false);
});

test("runPlanner - maps dynamic keys to server entities and breaks dependency cycles", async () => {
  const mockPlanOutput = {
    title: "Platform Logistik Cerdas",
    keyDecisions: [
      "Mobile-first PWA untuk kurir",
      "PostgreSQL dengan PostGIS untuk geospasial",
      "Event-driven architecture dengan Redis",
    ],
    chapters: [
      {
        key: "ch_1",
        title: "Ringkasan Eksekutif",
        sections: [
          {
            key: "s_overview",
            type: "overview",
            title: "Overview Sistem",
            brief: "Platform pelacakan logistik armada",
            dependsOn: [],
          },
          {
            key: "s_problem",
            type: "problem",
            title: "Masalah Armada",
            brief: "Visibilitas armada rendah",
            dependsOn: ["s_overview"],
          },
          {
            key: "s_users",
            type: "users",
            title: "Target Pengguna",
            brief: "Dispatcher, manajer armada, kurir",
            dependsOn: ["s_overview"],
          },
        ],
      },
      {
        key: "ch_2",
        title: "Spesifikasi Fungsional",
        sections: [
          {
            key: "s_features",
            type: "features",
            title: "Daftar Fitur Inti",
            brief: "Pelacakan rute real-time",
            dependsOn: ["s_users"],
          },
          {
            key: "s_flow",
            type: "flow",
            title: "Alur Pengiriman",
            diagramHint: "flowchart",
            dependsOn: ["s_features"],
          },
          {
            key: "s_data",
            type: "data_model",
            title: "Skema Entitas",
            diagramHint: "er",
            // Deliberate cycle attempt: s_data -> s_features and s_features -> s_data
            dependsOn: ["s_features"],
          },
        ],
      },
      {
        key: "ch_3",
        title: "Infrastruktur",
        sections: [
          {
            key: "s_tech",
            type: "tech_stack",
            title: "Arsitektur Teknologi",
            brief: "Node.js microservices",
            dependsOn: ["s_overview"],
          },
          {
            key: "s_sec",
            type: "security",
            title: "Keamanan & Kepatuhan",
            brief: "Enkripsi data lokasi",
            dependsOn: ["s_tech"],
          },
        ],
      },
    ],
  };

  const client = createMockAiClient(mockPlanOutput);

  const plan = await runPlanner({
    idea: "Aplikasi pelacakan logistik real-time",
    answers: [],
    client,
  });

  assert.equal(plan.title, "Platform Logistik Cerdas");
  assert.equal(plan.chapters.length, 3);
  assert.equal(plan.sections.length, 8);
  assert.ok(plan.sections.every((s) => s.id.startsWith("sec_")));
  assert.ok(plan.chapters.every((c) => c.id.startsWith("chap_")));
  assert.ok(plan.edges.length > 0);
  assert.ok(plan.edges.every((e) => e.id.startsWith("edge_")));
});

// -------------------------------------------------------------
// 3. SectionWriter and DiagramGenerator Tests
// -------------------------------------------------------------

test("SectionWriter - sanitizes raw HTML and unwanted markdown fences", () => {
  const dirty = `<div><p>Berikut spesifikasi fitur utama:</p></div>
\`\`\`mermaid
flowchart TD
A --> B
\`\`\`
- **F-1**: Autentikasi Pengguna
- **F-2**: Pembayaran Midtrans`;

  const cleaned = sanitizeSectionMarkdown(dirty);
  assert.ok(!cleaned.includes("<div>"));
  assert.ok(!cleaned.includes("flowchart TD"));
  assert.ok(cleaned.includes("**F-1**: Autentikasi Pengguna"));
});

test("DiagramGenerator - strips backtick fences from Mermaid code", () => {
  const rawWithFences = "```mermaid\nflowchart TD\n  User --> App\n  App --> DB\n```";
  const cleaned = cleanMermaidCode(rawWithFences);
  assert.equal(cleaned, "flowchart TD\n  User --> App\n  App --> DB");
});

// -------------------------------------------------------------
// 4. Execution Lock & Concurrency Tests
// -------------------------------------------------------------

test("Execution Lock - detects active vs stale lock", () => {
  const activeDoc = {
    _id: new ObjectId(),
    ownerId: "owner_1",
    title: "Test",
    titleEdited: false,
    idea: "Idea",
    lang: "id",
    status: "generating",
    brainstorm: { questions: [], answers: [] },
    keyDecisions: [],
    chapters: [],
    sections: [],
    edges: [],
    run: {
      id: "run_active",
      startedAt: new Date(),
      heartbeatAt: new Date(), // Just now
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as PrdDocument;

  assert.equal(isRunActive(activeDoc), true);

  const staleDoc = {
    ...activeDoc,
    run: {
      id: "run_stale",
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
      heartbeatAt: new Date(Date.now() - 4 * 60 * 1000), // > 3 mins ago
    },
  } as PrdDocument;

  assert.equal(isRunActive(staleDoc), false);

  const idleDoc = {
    ...activeDoc,
    run: null,
  } as PrdDocument;

  assert.equal(isRunActive(idleDoc), false);
});

// -------------------------------------------------------------
// 5. Runner Pipeline Simulation (Full Flow, Resilience, Resume, Abort)
// -------------------------------------------------------------

function createMockRepo(initialDoc: PrdDocument): {
  repo: RunnerRepo;
  savedSections: Map<string, { content: string; status: string; rev: number }>;
  lockedRunId: string | null;
} {
  let doc = JSON.parse(JSON.stringify(initialDoc)) as PrdDocument;
  const savedSections = new Map<string, { content: string; status: string; rev: number }>();

  doc.sections.forEach((s) => {
    savedSections.set(s.id, { content: s.content, status: s.status, rev: s.rev });
  });

  let lockedRunId: string | null = doc.run?.id || null;

  const repo: RunnerRepo = {
    acquireExecutionLock: async (id, ownerId, runId) => {
      if (lockedRunId && lockedRunId !== runId) {
        return { acquired: false, doc, reason: "RUN_IN_PROGRESS" };
      }
      lockedRunId = runId;
      doc.run = {
        id: runId,
        startedAt: new Date(),
        heartbeatAt: new Date(),
      };
      doc.status = "generating";
      return { acquired: true, doc };
    },
    updateExecutionHeartbeat: async (_id, runId) => {
      if (lockedRunId === runId && doc.run) {
        doc.run.heartbeatAt = new Date();
        return true;
      }
      return false;
    },
    releaseExecutionLock: async (_id, runId, finalStatus, lastError) => {
      if (lockedRunId === runId) {
        lockedRunId = null;
        doc.run = null;
        doc.status = finalStatus;
        if (lastError) doc.lastError = lastError;
        return true;
      }
      return false;
    },
    resetWritingSectionsToPending: async () => {
      lockedRunId = null;
      doc.run = null;
      const readyCount = doc.sections.filter((s) => s.status === "ready").length;
      doc.status = readyCount >= 1 ? "ready" : "brainstorming";
      doc.sections.forEach((s) => {
        if (s.status === "writing") {
          s.status = "pending";
          savedSections.set(s.id, { content: s.content, status: "pending", rev: s.rev });
        }
      });
      return true;
    },
    savePlanToPrdDocument: async (_id, _ownerId, plan) => {
      doc.chapters = plan.chapters;
      doc.sections = plan.sections;
      doc.edges = plan.edges;
      doc.keyDecisions = plan.keyDecisions;
      if (!doc.titleEdited && plan.title) {
        doc.title = plan.title;
      }
      plan.sections.forEach((s) => {
        savedSections.set(s.id, { content: "", status: "pending", rev: 1 });
      });
      return doc;
    },
    markSectionWriting: async (_id, _ownerId, sectionId) => {
      const sec = doc.sections.find((s) => s.id === sectionId);
      if (sec) {
        sec.status = "writing";
        savedSections.set(sec.id, { content: sec.content, status: "writing", rev: sec.rev });
        return true;
      }
      return false;
    },
    saveSectionCompleted: async (_id, _ownerId, sectionId, content, diagram) => {
      const sec = doc.sections.find((s) => s.id === sectionId);
      if (sec) {
        sec.content = content;
        sec.diagram = diagram;
        sec.status = "ready";
        sec.rev += 1;
        savedSections.set(sec.id, { content, status: "ready", rev: sec.rev });
        return { success: true, rev: sec.rev };
      }
      return { success: false, rev: 0 };
    },
    saveSectionFailed: async (_id, _ownerId, sectionId, error) => {
      const sec = doc.sections.find((s) => s.id === sectionId);
      if (sec) {
        sec.status = "failed";
        sec.error = error;
        savedSections.set(sec.id, { content: sec.content, status: "failed", rev: sec.rev });
        return true;
      }
      return false;
    },
    getPrdById: async () => doc,
  };

  return {
    repo,
    savedSections,
    get lockedRunId() {
      return lockedRunId;
    },
  };
}

test("runner - executes full multi-stage pipeline, persists each section immediately, and emits Section 7.6 events", async () => {
  const initialDoc: PrdDocument = {
    _id: new ObjectId(),
    ownerId: "owner_test",
    title: "KameraHub",
    titleEdited: false,
    idea: "Platform rental peralatan fotografi",
    lang: "id",
    status: "brainstorming",
    brainstorm: {
      questions: [
        {
          id: "q_1",
          text: "Siapa target pengguna?",
          options: ["Fotografer hobi", "Komersial studio", "Event organizer"],
          allowCustom: true,
        },
      ],
      answers: [
        {
          questionId: "q_1",
          value: "Fotografer hobi dan videografer independen",
          isCustom: false,
        },
      ],
    },
    keyDecisions: [],
    chapters: [],
    sections: [],
    edges: [],
    run: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const { repo, savedSections } = createMockRepo(initialDoc);

  const mockAiClient = createMockAiClient((prompt) => {
    if (prompt.includes("Principal Product Architect") || prompt.includes("struktur PRD dinamis")) {
      return {
        title: "KameraHub Marketplace",
        keyDecisions: [
          "Responsive Web dengan Next.js 14",
          "MongoDB dengan Atlas Search",
          "Integrasi Midtrans Payment Gateway",
        ],
        chapters: [
          {
            key: "ch_intro",
            title: "Pendahuluan",
            sections: [
              {
                key: "s_overview",
                type: "overview",
                title: "Gambaran Platform",
                brief: "Ringkasan sewa kamera",
                dependsOn: [],
              },
              {
                key: "s_prob",
                type: "problem",
                title: "Problem Statement",
                brief: "Biaya beli kamera tinggi",
                dependsOn: ["s_overview"],
              },
              {
                key: "s_user",
                type: "users",
                title: "Persona Pengguna",
                brief: "Kreator konten",
                dependsOn: ["s_overview"],
              },
            ],
          },
          {
            key: "ch_feat",
            title: "Fitur Produk",
            sections: [
              {
                key: "s_feat",
                type: "features",
                title: "Fitur Utama",
                brief: "Katalog dan deposit",
                dependsOn: ["s_user"],
              },
              {
                key: "s_flow",
                type: "flow",
                title: "Alur Rental",
                diagramHint: "flowchart",
                dependsOn: ["s_feat"],
              },
              {
                key: "s_data",
                type: "data_model",
                title: "Model Data",
                diagramHint: "er",
                dependsOn: ["s_feat"],
              },
            ],
          },
          {
            key: "ch_tech",
            title: "Arsitektur",
            sections: [
              {
                key: "s_tech",
                type: "tech_stack",
                title: "Tech Stack",
                brief: "Next.js, Tailwind, MongoDB",
                dependsOn: ["s_overview"],
              },
              {
                key: "s_arch",
                type: "architecture",
                title: "Arsitektur Server",
                diagramHint: "flowchart",
                dependsOn: ["s_tech"],
              },
            ],
          },
        ],
      };
    }

    if (prompt.includes("<sectionContent") || prompt.includes("Spesialis Diagram Arsitektur Mermaid")) {
      return {
        code: "flowchart TD\n  User --> RentApp\n  RentApp --> Pay",
      };
    }

    if (prompt.includes("Technical Product Specification Writer") || prompt.includes("<section>")) {
      return {
        content: "### Spesifikasi Detail\n- F-1: Pencarian kamera berdasarkan lokasi\n- F-2: Pembayaran dan verifikasi deposit",
      };
    }

    return {};
  });

  const emittedEvents: Array<{ event: string; data: unknown }> = [];

  const result = await runGeneration(initialDoc, {
    ownerId: "owner_test",
    client: mockAiClient,
    repo,
    emit: (event, data) => emittedEvents.push({ event, data }),
  });

  assert.equal(result.success, true);
  assert.equal(result.ready, 8);
  assert.equal(result.failed, 0);

  // Check event stream order
  const eventNames = emittedEvents.map((e) => e.event);
  assert.equal(eventNames[0], "run.started");
  assert.equal(eventNames[1], "plan.ready");
  assert.ok(eventNames.includes("section.started"));
  assert.ok(eventNames.includes("section.completed"));
  assert.equal(eventNames[eventNames.length - 1], "run.completed");

  // Verify all 8 sections were saved to the repository
  assert.equal(savedSections.size, 8);
  savedSections.forEach((s) => {
    assert.equal(s.status, "ready");
    assert.ok(s.content.length > 0);
  });
});

test("runner resilience - failure of one section does not stop others, document remains ready", async () => {
  const initialDoc: PrdDocument = {
    _id: new ObjectId(),
    ownerId: "owner_test",
    title: "Test PRD",
    titleEdited: true,
    idea: "Test Idea",
    lang: "id",
    status: "generating",
    brainstorm: { questions: [], answers: [] },
    keyDecisions: ["Next.js", "MongoDB"],
    chapters: [{ id: "chap_1", title: "Bab 1", order: 1 }],
    sections: [
      {
        id: "sec_ok_1",
        chapterId: "chap_1",
        type: "overview",
        title: "Overview",
        content: "",
        order: 1,
        status: "pending",
        rev: 1,
        updatedAt: new Date(),
      },
      {
        id: "sec_fail",
        chapterId: "chap_1",
        type: "features",
        title: "Failing Section",
        content: "",
        order: 2,
        status: "pending",
        rev: 1,
        updatedAt: new Date(),
      },
      {
        id: "sec_ok_2",
        chapterId: "chap_1",
        type: "tech_stack",
        title: "Tech Stack",
        content: "",
        order: 3,
        status: "pending",
        rev: 1,
        updatedAt: new Date(),
      },
    ],
    edges: [],
    run: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const { repo, savedSections } = createMockRepo(initialDoc);

  const mockAiClient = createMockAiClient((prompt) => {
    if (prompt.includes("Judul: Failing Section") || prompt.includes("ID: sec_fail")) {
      // Return invalid JSON to trigger retry and ultimate error
      throw new Error("Simulated upstream model error");
    }
    return {
      content: "Content successfully generated",
    };
  });

  const emittedEvents: Array<{ event: string; data: unknown }> = [];

  const result = await runGeneration(initialDoc, {
    ownerId: "owner_test",
    client: mockAiClient,
    repo,
    emit: (event, data) => emittedEvents.push({ event, data }),
  });

  assert.equal(result.success, true);
  assert.equal(result.ready, 2);
  assert.equal(result.failed, 1);

  // Failed section was recorded as failed in DB
  const failedSec = savedSections.get("sec_fail");
  assert.ok(failedSec);
  assert.equal(failedSec.status, "failed");

  // Succeeded sections were recorded as ready
  const ok1 = savedSections.get("sec_ok_1");
  const ok2 = savedSections.get("sec_ok_2");
  assert.equal(ok1?.status, "ready");
  assert.equal(ok2?.status, "ready");

  // Emitted section.failed for failing section
  const failedEvent = emittedEvents.find((e) => e.event === "section.failed");
  assert.ok(failedEvent);
  assert.equal((failedEvent.data as { sectionId: string }).sectionId, "sec_fail");

  // Emitted run.completed with ready: 2, failed: 1
  const completedEvent = emittedEvents.find((e) => e.event === "run.completed");
  assert.deepEqual(completedEvent?.data, { ready: 2, failed: 1 });
});

test("runner resume - resumes only pending and failed sections, skips ready sections", async () => {
  const initialDoc: PrdDocument = {
    _id: new ObjectId(),
    ownerId: "owner_test",
    title: "Resume Test",
    titleEdited: true,
    idea: "Resume Idea",
    lang: "id",
    status: "generating",
    brainstorm: { questions: [], answers: [] },
    keyDecisions: ["Next.js"],
    chapters: [{ id: "chap_1", title: "Bab 1", order: 1 }],
    sections: [
      {
        id: "sec_already_done",
        chapterId: "chap_1",
        type: "overview",
        title: "Overview",
        content: "Original ready content",
        order: 1,
        status: "ready", // ALREADY READY
        rev: 2,
        updatedAt: new Date(),
      },
      {
        id: "sec_needs_retry",
        chapterId: "chap_1",
        type: "features",
        title: "Retry Section",
        content: "",
        order: 2,
        status: "failed", // FAILED - NEEDS RETRY
        rev: 1,
        updatedAt: new Date(),
      },
    ],
    edges: [],
    run: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const { repo, savedSections } = createMockRepo(initialDoc);

  let processedSections: string[] = [];
  const mockAiClient = createMockAiClient((prompt) => {
    if (prompt.includes("Retry Section")) {
      processedSections.push("sec_needs_retry");
      return { content: "New regenerated content" };
    }
    if (prompt.includes("Overview")) {
      processedSections.push("sec_already_done");
      return { content: "Overwritten content" };
    }
    return {};
  });

  const emittedEvents: Array<{ event: string; data: unknown }> = [];

  const result = await runGeneration(initialDoc, {
    ownerId: "owner_test",
    client: mockAiClient,
    repo,
    emit: (event, data) => emittedEvents.push({ event, data }),
  });

  assert.equal(result.success, true);
  // sec_already_done was NOT touched by SectionWriter
  assert.ok(!processedSections.includes("sec_already_done"));
  assert.ok(processedSections.includes("sec_needs_retry"));

  // The ready section kept its original content and rev
  const readySec = savedSections.get("sec_already_done");
  assert.equal(readySec?.content, "Original ready content");
  assert.equal(readySec?.rev, 2);

  // The failed section is now ready
  const retriedSec = savedSections.get("sec_needs_retry");
  assert.equal(retriedSec?.status, "ready");
  assert.equal(retriedSec?.content, "New regenerated content");
});

test("runner abort - client cancellation ceases new tasks and resets writing sections to pending", async () => {
  const initialDoc: PrdDocument = {
    _id: new ObjectId(),
    ownerId: "owner_test",
    title: "Abort Test",
    titleEdited: true,
    idea: "Abort Idea",
    lang: "id",
    status: "generating",
    brainstorm: { questions: [], answers: [] },
    keyDecisions: ["Next.js"],
    chapters: [{ id: "chap_1", title: "Bab 1", order: 1 }],
    sections: [
      {
        id: "sec_1",
        chapterId: "chap_1",
        type: "overview",
        title: "Overview",
        content: "",
        order: 1,
        status: "pending",
        rev: 1,
        updatedAt: new Date(),
      },
      {
        id: "sec_2",
        chapterId: "chap_1",
        type: "features",
        title: "Features",
        content: "",
        order: 2,
        status: "pending",
        rev: 1,
        updatedAt: new Date(),
      },
    ],
    edges: [],
    run: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const { repo, savedSections } = createMockRepo(initialDoc);

  const abortController = new AbortController();
  // Abort immediately
  abortController.abort();

  const mockAiClient = createMockAiClient({});

  const result = await runGeneration(initialDoc, {
    ownerId: "owner_test",
    client: mockAiClient,
    repo,
    signal: abortController.signal,
    emit: () => {},
  });

  assert.equal(result.success, false);
  assert.equal(result.code, "ABORTED");

  // Sections remain pending
  savedSections.forEach((s) => {
    assert.equal(s.status, "pending");
  });
});

test("runner abort - resets doc status from generating to ready/brainstorming", async () => {
  const initialDoc: PrdDocument = {
    _id: new ObjectId(),
    ownerId: "owner_test",
    title: "Abort Status Test",
    titleEdited: true,
    idea: "Abort Idea",
    lang: "id",
    status: "generating",
    brainstorm: { questions: [], answers: [] },
    keyDecisions: ["Next.js"],
    chapters: [{ id: "chap_1", title: "Bab 1", order: 1 }],
    sections: [
      {
        id: "sec_1",
        chapterId: "chap_1",
        type: "overview",
        title: "Overview",
        content: "Existing ready content",
        order: 1,
        status: "ready", // 1 ready section
        rev: 2,
        updatedAt: new Date(),
      },
      {
        id: "sec_2",
        chapterId: "chap_1",
        type: "features",
        title: "Features",
        content: "",
        order: 2,
        status: "writing",
        rev: 1,
        updatedAt: new Date(),
      },
    ],
    edges: [],
    run: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const { repo } = createMockRepo(initialDoc);
  const abortController = new AbortController();
  abortController.abort();

  const result = await runGeneration(initialDoc, {
    ownerId: "owner_test",
    signal: abortController.signal,
    emit: () => {},
    repo,
  });

  assert.equal(result.success, false);
  const prd = await repo.getPrdById(initialDoc._id, "owner_test");
  assert.equal(prd?.status, "ready"); // Since sec_1 was ready
  assert.equal(prd?.run, null);
});

test("runner - handles persistence failure by failing section and continuing others", async () => {
  const initialDoc: PrdDocument = {
    _id: new ObjectId(),
    ownerId: "owner_test",
    title: "Save Failure Test",
    titleEdited: true,
    idea: "Test Idea",
    lang: "id",
    status: "generating",
    brainstorm: { questions: [], answers: [] },
    keyDecisions: ["Next.js"],
    chapters: [{ id: "chap_1", title: "Bab 1", order: 1 }],
    sections: [
      {
        id: "sec_persist_fail",
        chapterId: "chap_1",
        type: "overview",
        title: "Overview",
        content: "",
        order: 1,
        status: "pending",
        rev: 1,
        updatedAt: new Date(),
      },
      {
        id: "sec_persist_ok",
        chapterId: "chap_1",
        type: "features",
        title: "Features",
        content: "",
        order: 2,
        status: "pending",
        rev: 1,
        updatedAt: new Date(),
      },
    ],
    edges: [],
    run: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const { repo } = createMockRepo(initialDoc);

  // Override saveSectionCompleted so sec_persist_fail fails to persist
  const originalSaveCompleted = repo.saveSectionCompleted;
  repo.saveSectionCompleted = async (id, ownerId, sectionId, content, diagram) => {
    if (sectionId === "sec_persist_fail") {
      return { success: false, rev: 0 };
    }
    return originalSaveCompleted(id, ownerId, sectionId, content, diagram);
  };

  const emittedEvents: Array<{ event: string; data: unknown }> = [];
  const mockAiClient = createMockAiClient({ content: "Valid generated content" });

  const result = await runGeneration(initialDoc, {
    ownerId: "owner_test",
    client: mockAiClient,
    repo,
    emit: (event, data) => emittedEvents.push({ event, data }),
  });

  assert.equal(result.success, true);
  assert.equal(result.ready, 1);
  assert.equal(result.failed, 1);

  const failEvent = emittedEvents.find(
    (e) => e.event === "section.failed" && (e.data as any).sectionId === "sec_persist_fail"
  );
  assert.ok(failEvent);

  const okEvent = emittedEvents.find(
    (e) => e.event === "section.completed" && (e.data as any).sectionId === "sec_persist_ok"
  );
  assert.ok(okEvent);
});
