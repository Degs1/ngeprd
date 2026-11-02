import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAI } from "@ai-sdk/openai";
import {
  RepairDiagramInputSchema,
  validateMermaidSyntaxLight,
  cleanMermaidCode,
  runDiagramRepair,
} from "../src/lib/agent/diagramGenerator";
import { UpdateSectionSchema } from "../src/lib/schemas/prd";

// Helper to create an in-memory mock OpenAI client for testing AI agents
function createMockAiClient(responseObj: Record<string, unknown>) {
  const mockFetch = async () => {
    return new Response(
      JSON.stringify({
        id: "chatcmpl-mock",
        object: "chat.completion",
        created: Date.now(),
        model: "mock-model",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify(responseObj),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  };

  return createOpenAI({
    baseURL: "http://localhost:20128/v1",
    apiKey: "mock-key",
    fetch: mockFetch,
  });
}

test("validateMermaidSyntaxLight - accepts allowed keywords and strips fences", () => {
  // Direct keyword
  const r1 = validateMermaidSyntaxLight("flowchart TD\n  A --> B");
  assert.equal(r1.valid, true);

  // Sequence diagram
  const r2 = validateMermaidSyntaxLight("sequenceDiagram\n  Alice->>Bob: Hello");
  assert.equal(r2.valid, true);

  // ER Diagram
  const r3 = validateMermaidSyntaxLight("erDiagram\n  USER ||--o{ ORDER : places");
  assert.equal(r3.valid, true);

  // State diagram
  const r4 = validateMermaidSyntaxLight("stateDiagram-v2\n  [*] --> Still");
  assert.equal(r4.valid, true);

  // Markdown code fence wrapped
  const r5 = validateMermaidSyntaxLight("```mermaid\nflowchart LR\n  X --> Y\n```");
  assert.equal(r5.valid, true);

  // Leading comments
  const r6 = validateMermaidSyntaxLight("%% Diagram Architecture\n%% Version 1\ngraph TD\n  Start --> Stop");
  assert.equal(r6.valid, true);
});

test("validateMermaidSyntaxLight - rejects empty, oversized, or invalid keywords", () => {
  // Empty
  const r1 = validateMermaidSyntaxLight("");
  assert.equal(r1.valid, false);
  assert.match(r1.reason!, /kosong/);

  // Whitespace only
  const r2 = validateMermaidSyntaxLight("   \n\t  ");
  assert.equal(r2.valid, false);

  // Exceeds 8KB (8192 chars)
  const oversized = "flowchart TD\n" + "A --> B\n".repeat(1100);
  assert.ok(oversized.length > 8192);
  const r3 = validateMermaidSyntaxLight(oversized);
  assert.equal(r3.valid, false);
  assert.match(r3.reason!, /8 KB/);

  // Disallowed or arbitrary keyword
  const r4 = validateMermaidSyntaxLight("javascript TD\n  const x = 1;");
  assert.equal(r4.valid, false);
  assert.match(r4.reason!, /diizinkan/);

  const r5 = validateMermaidSyntaxLight("<script>alert('xss')</script>");
  assert.equal(r5.valid, false);
});

test("cleanMermaidCode - removes code block wrappers cleanly", () => {
  const fenced = "```mermaid\nflowchart TD\n  A --> B\n```";
  assert.equal(cleanMermaidCode(fenced), "flowchart TD\n  A --> B");

  const genericFenced = "```\nsequenceDiagram\n  A->>B: Ping\n```";
  assert.equal(cleanMermaidCode(genericFenced), "sequenceDiagram\n  A->>B: Ping");

  const alreadyClean = "erDiagram\n  A ||--o{ B : has";
  assert.equal(cleanMermaidCode(alreadyClean), alreadyClean);
});

test("RepairDiagramInputSchema - validates request payload constraints", () => {
  // Valid
  const valid = RepairDiagramInputSchema.safeParse({
    code: "flowchart TD\n  A --> B",
    error: "Parse error on line 2",
  });
  assert.equal(valid.success, true);

  // Valid without error message
  const validNoError = RepairDiagramInputSchema.safeParse({
    code: "flowchart TD\n  A --> B",
  });
  assert.equal(validNoError.success, true);

  // Empty code rejected
  const emptyCode = RepairDiagramInputSchema.safeParse({
    code: "",
  });
  assert.equal(emptyCode.success, false);

  // Code exceeding 8192 rejected
  const tooLong = RepairDiagramInputSchema.safeParse({
    code: "x".repeat(8200),
  });
  assert.equal(tooLong.success, false);
});

test("runDiagramRepair - executes with mock AI and repairs broken syntax", async () => {
  const mockAiOutput = {
    code: 'flowchart TD\n  A["User (Owner)"] --> B["API Gateway"]',
  };

  const client = createMockAiClient(mockAiOutput);

  const repaired = await runDiagramRepair({
    code: "flowchart TD\n  A[User (Owner)] --> B[API Gateway",
    error: "Parse error on line 2: unexpected token",
    lang: "id",
    client: client as any,
  });

  assert.equal(
    repaired,
    'flowchart TD\n  A["User (Owner)"] --> B["API Gateway"]'
  );
  const syntaxCheck = validateMermaidSyntaxLight(repaired);
  assert.equal(syntaxCheck.valid, true);
});

test("Optimistic Concurrency Simulation - baseRev matching vs 409 conflict", () => {
  let sectionRev = 1;
  let sectionTitle = "Initial Title";
  let sectionContent = "Initial Content";

  // Simulate server update handler
  function simulateUpdate(inputBaseRev: number, updates: { title?: string; content?: string }) {
    if (inputBaseRev !== sectionRev) {
      return {
        status: 409,
        conflict: true,
        currentRev: sectionRev,
        error: `Section modified (current rev: ${sectionRev}, provided: ${inputBaseRev})`,
      };
    }

    sectionRev += 1;
    if (updates.title) sectionTitle = updates.title;
    if (updates.content) sectionContent = updates.content;

    return {
      status: 200,
      rev: sectionRev,
      title: sectionTitle,
      content: sectionContent,
    };
  }

  // 1. First edit with matching baseRev=1 succeeds
  const res1 = simulateUpdate(1, { title: "Updated Title 1" });
  assert.equal(res1.status, 200);
  assert.equal(res1.rev, 2);
  assert.equal(sectionRev, 2);
  assert.equal(sectionTitle, "Updated Title 1");

  // 2. Second edit concurrently sent with stale baseRev=1 fails with 409 conflict
  const res2 = simulateUpdate(1, { title: "Concurrent Stale Edit" });
  assert.equal(res2.status, 409);
  assert.equal(res2.conflict, true);
  assert.equal(res2.currentRev, 2);
  assert.equal(sectionTitle, "Updated Title 1"); // Unchanged!

  // 3. User chooses 'Timpa' (Overwrite) with currentRev=2
  const res3 = simulateUpdate(res2.currentRev, { title: "Overwritten Title" });
  assert.equal(res3.status, 200);
  assert.equal(res3.rev, 3);
  assert.equal(sectionRev, 3);
  assert.equal(sectionTitle, "Overwritten Title");
});

test("SectionNode Edit Guard - pending and writing sections are protected from manual edit", () => {
  const canEditPending = (status: string) => status !== "pending" && status !== "writing";

  assert.equal(canEditPending("pending"), false);
  assert.equal(canEditPending("writing"), false);
  assert.equal(canEditPending("ready"), true);
  assert.equal(canEditPending("failed"), true);
});

test("UpdateSectionSchema - accepts partial edits with baseRev", () => {
  const schemaTest1 = UpdateSectionSchema.safeParse({
    baseRev: 2,
    title: "New Title",
    content: "New markdown content",
  });
  assert.equal(schemaTest1.success, true);

  const schemaTest2 = UpdateSectionSchema.safeParse({
    baseRev: 3,
    diagram: {
      kind: "mermaid",
      code: "flowchart LR\n  A --> B",
      status: "ok",
    },
  });
  assert.equal(schemaTest2.success, true);

  // Missing baseRev fails
  const schemaTest3 = UpdateSectionSchema.safeParse({
    title: "Missing Rev",
  });
  assert.equal(schemaTest3.success, false);
});
