import test from "node:test";
import assert from "node:assert/strict";
import { buildOutline, buildSectionNumberMap, getOutlineStats } from "../src/lib/converter/outline";
import { docToFlow, sanitizeAndDeduplicateEdges } from "../src/lib/converter/docToFlow";
import { docToMarkdown } from "../src/lib/converter/docToMarkdown";
import type { Chapter, Section, Edge, PrdDocument } from "../src/lib/schemas/prd";

test("buildOutline - generates correct hierarchical numbering 1, 1.1, 1.2, 2, 2.1", () => {
  const chapters: Chapter[] = [
    { id: "chap_1", title: "Gambaran Umum", order: 1 },
    { id: "chap_2", title: "Arsitektur Teknis", order: 2 },
  ];

  const sections: Section[] = [
    {
      id: "sec_1",
      chapterId: "chap_1",
      title: "Latar Belakang",
      type: "overview",
      order: 1,
      status: "ready",
      content: "Latar belakang...",
      rev: 1,
      updatedAt: new Date(),
    },
    {
      id: "sec_2",
      chapterId: "chap_1",
      title: "Target Pengguna",
      type: "users",
      order: 2,
      status: "ready",
      content: "Target pengguna...",
      rev: 1,
      updatedAt: new Date(),
    },
    {
      id: "sec_3",
      chapterId: "chap_2",
      title: "Tech Stack",
      type: "tech_stack",
      order: 1,
      status: "pending",
      content: "",
      rev: 1,
      updatedAt: new Date(),
    },
  ];

  const outline = buildOutline({ chapters, sections });

  assert.equal(outline.length, 2);
  assert.equal(outline[0].number, "1");
  assert.equal(outline[0].chapter.title, "Gambaran Umum");
  assert.equal(outline[0].items.length, 2);
  assert.equal(outline[0].items[0].number, "1.1");
  assert.equal(outline[0].items[0].section.title, "Latar Belakang");
  assert.equal(outline[0].items[1].number, "1.2");
  assert.equal(outline[0].items[1].section.title, "Target Pengguna");

  assert.equal(outline[1].number, "2");
  assert.equal(outline[1].chapter.title, "Arsitektur Teknis");
  assert.equal(outline[1].items.length, 1);
  assert.equal(outline[1].items[0].number, "2.1");
  assert.equal(outline[1].items[0].section.title, "Tech Stack");

  // Number lookup map
  const map = buildSectionNumberMap({ chapters, sections });
  assert.equal(map.get("sec_1"), "1.1");
  assert.equal(map.get("sec_2"), "1.2");
  assert.equal(map.get("sec_3"), "2.1");

  // Stats
  const stats = getOutlineStats(outline);
  assert.equal(stats.totalChapters, 2);
  assert.equal(stats.totalSections, 3);
  assert.equal(stats.readySections, 2);
  assert.equal(stats.pendingSections, 1);
});

test("buildOutline - automatically recalculates numbers when adding or removing sections", () => {
  const chapters: Chapter[] = [
    { id: "chap_1", title: "Bab Satu", order: 1 },
  ];

  const initialSections: Section[] = [
    {
      id: "sec_a",
      chapterId: "chap_1",
      title: "Bagian A",
      type: "overview",
      order: 10,
      status: "ready",
      content: "",
      rev: 1,
      updatedAt: new Date(),
    },
    {
      id: "sec_b",
      chapterId: "chap_1",
      title: "Bagian B",
      type: "features",
      order: 20,
      status: "ready",
      content: "",
      rev: 1,
      updatedAt: new Date(),
    },
  ];

  let outline = buildOutline({ chapters, sections: initialSections });
  assert.equal(outline[0].items[0].number, "1.1");
  assert.equal(outline[0].items[1].number, "1.2");

  // Insert Section in between (order 15)
  const newSection: Section = {
    id: "sec_new",
    chapterId: "chap_1",
    title: "Bagian Sisipan",
    type: "problem",
    order: 15,
    status: "pending",
    content: "",
    rev: 1,
    updatedAt: new Date(),
  };

  outline = buildOutline({ chapters, sections: [...initialSections, newSection] });
  assert.equal(outline[0].items.length, 3);
  assert.equal(outline[0].items[0].section.id, "sec_a");
  assert.equal(outline[0].items[0].number, "1.1");
  assert.equal(outline[0].items[1].section.id, "sec_new");
  assert.equal(outline[0].items[1].number, "1.2");
  assert.equal(outline[0].items[2].section.id, "sec_b");
  assert.equal(outline[0].items[2].number, "1.3");

  // Remove first section (sec_a)
  outline = buildOutline({
    chapters,
    sections: outline[0].items.slice(1).map((i) => i.section),
  });
  assert.equal(outline[0].items.length, 2);
  assert.equal(outline[0].items[0].section.id, "sec_new");
  assert.equal(outline[0].items[0].number, "1.1");
  assert.equal(outline[0].items[1].section.id, "sec_b");
  assert.equal(outline[0].items[1].number, "1.2");
});

test("sanitizeAndDeduplicateEdges - drops orphaned edges and self loops", () => {
  const validIds = new Set(["sec_1", "sec_2", "sec_3"]);
  const rawEdges = [
    { id: "e1", from: "sec_1", to: "sec_2" },
    { id: "e_orphan_from", from: "sec_ghost", to: "sec_2" },
    { id: "e_orphan_to", from: "sec_1", to: "sec_unknown" },
    { id: "e_self", from: "sec_1", to: "sec_1" },
    { id: "e2", from: "sec_2", to: "sec_3" },
  ];

  const sanitized = sanitizeAndDeduplicateEdges(rawEdges, validIds);

  assert.equal(sanitized.length, 2);
  assert.equal(sanitized[0].id, "e1");
  assert.equal(sanitized[1].id, "e2");
});

test("sanitizeAndDeduplicateEdges - detects and breaks cycles", () => {
  const validIds = new Set(["sec_1", "sec_2", "sec_3"]);
  // Cycle: 1 -> 2 -> 3 -> 1
  const rawEdges = [
    { id: "e1", from: "sec_1", to: "sec_2" },
    { id: "e2", from: "sec_2", to: "sec_3" },
    { id: "e3_cycle", from: "sec_3", to: "sec_1" },
  ];

  const sanitized = sanitizeAndDeduplicateEdges(rawEdges, validIds);

  assert.equal(sanitized.length, 2);
  assert.equal(sanitized.some((e) => e.id === "e3_cycle"), false);
  assert.equal(sanitized[0].id, "e1");
  assert.equal(sanitized[1].id, "e2");
});

test("docToFlow - creates virtual idea node and connects to in-degree 0 sections", () => {
  const chapters: Chapter[] = [{ id: "chap_1", title: "Bab 1", order: 1 }];
  const sections: Section[] = [
    {
      id: "sec_root_1",
      chapterId: "chap_1",
      title: "Root 1",
      type: "overview",
      order: 1,
      status: "ready",
      content: "Intro content",
      rev: 1,
      updatedAt: new Date(),
    },
    {
      id: "sec_root_2",
      chapterId: "chap_1",
      title: "Root 2",
      type: "goals",
      order: 2,
      status: "writing",
      content: "",
      rev: 1,
      updatedAt: new Date(),
    },
    {
      id: "sec_child",
      chapterId: "chap_1",
      title: "Child",
      type: "features",
      order: 3,
      status: "pending",
      content: "",
      rev: 1,
      updatedAt: new Date(),
    },
  ];

  // sec_root_1 -> sec_child
  const edges: Edge[] = [
    { id: "e_1_child", from: "sec_root_1", to: "sec_child" },
  ];

  const flow = docToFlow({
    title: "Test App",
    idea: "A revolutionary platform",
    chapters,
    sections,
    edges,
  });

  // Nodes: 1 idea + 3 sections = 4
  assert.equal(flow.nodes.length, 4);
  const ideaNode = flow.nodes.find((n) => n.id === "idea");
  assert.ok(ideaNode);
  assert.equal(ideaNode.type, "ideaNode");
  assert.equal(ideaNode.data.title, "Test App");

  // Edges:
  // e-idea-sec_root_1 (in-degree 0)
  // e-idea-sec_root_2 (in-degree 0)
  // e_1_child (sec_root_1 -> sec_child)
  // sec_child has incoming edge, so no edge from idea to sec_child!
  assert.equal(flow.edges.length, 3);
  const ideaEdges = flow.edges.filter((e) => e.source === "idea");
  assert.equal(ideaEdges.length, 2);
  assert.ok(ideaEdges.some((e) => e.target === "sec_root_1"));
  assert.ok(ideaEdges.some((e) => e.target === "sec_root_2"));
  assert.ok(!ideaEdges.some((e) => e.target === "sec_child"));

  // Edge to sec_root_2 should be animated because its status is "writing"
  const edgeToRoot2 = ideaEdges.find((e) => e.target === "sec_root_2");
  assert.equal(edgeToRoot2?.animated, true);
});

test("docToFlow - preserves saved section positions when present", () => {
  const chapters: Chapter[] = [{ id: "chap_1", title: "Bab 1", order: 1 }];
  const sections: Section[] = [
    {
      id: "sec_1",
      chapterId: "chap_1",
      title: "Section 1",
      type: "overview",
      order: 1,
      position: { x: 500, y: 300 },
      status: "ready",
      content: "Hello",
      rev: 1,
      updatedAt: new Date(),
    },
  ];

  const flow = docToFlow({
    title: "App",
    idea: "Idea",
    chapters,
    sections,
    edges: [],
  });

  const secNode = flow.nodes.find((n) => n.id === "sec_1");
  assert.ok(secNode);
  assert.equal(secNode.position.x, 500);
  assert.equal(secNode.position.y, 300);
});

test("docToFlow - auto-layouts unpositioned nodes using Dagre LR without overlapping", () => {
  const chapters: Chapter[] = [{ id: "chap_1", title: "Bab 1", order: 1 }];
  const sections: Section[] = [
    {
      id: "sec_1",
      chapterId: "chap_1",
      title: "Section 1",
      type: "overview",
      order: 1,
      status: "ready",
      content: "Short intro",
      rev: 1,
      updatedAt: new Date(),
    },
    {
      id: "sec_2",
      chapterId: "chap_1",
      title: "Section 2",
      type: "features",
      order: 2,
      status: "ready",
      content: "Feature list...",
      rev: 1,
      updatedAt: new Date(),
    },
  ];

  const edges: Edge[] = [
    { id: "e1", from: "sec_1", to: "sec_2" },
  ];

  const flow = docToFlow({
    title: "App",
    idea: "Idea",
    chapters,
    sections,
    edges,
  });

  const ideaNode = flow.nodes.find((n) => n.id === "idea")!;
  const sec1 = flow.nodes.find((n) => n.id === "sec_1")!;
  const sec2 = flow.nodes.find((n) => n.id === "sec_2")!;

  // Dagre LR: idea.x < sec1.x < sec2.x
  assert.ok(ideaNode.position.x < sec1.position.x, "idea should be to the left of sec1");
  assert.ok(sec1.position.x < sec2.position.x, "sec1 should be to the left of sec2");
});

test("docToMarkdown - formats markdown with chapters as ## and sections as ###", () => {
  const chapters: Chapter[] = [
    { id: "chap_1", title: "Gambaran Produk", order: 1 },
  ];
  const sections: Section[] = [
    {
      id: "sec_1",
      chapterId: "chap_1",
      title: "Latar Belakang",
      type: "overview",
      order: 1,
      status: "ready",
      content: "Aplikasi ini mempermudah pembuatan PRD.",
      diagram: {
        kind: "mermaid",
        code: "graph TD\n  A --> B",
        status: "ok",
      },
      rev: 1,
      updatedAt: new Date(),
    },
  ];

  const md = docToMarkdown({
    title: "ngePRD Spec",
    idea: "AI agent PRD builder",
    keyDecisions: ["Next.js App Router", "MongoDB 7.0"],
    chapters,
    sections,
  });

  assert.ok(md.includes("# ngePRD Spec"));
  assert.ok(md.includes("## Keputusan Kunci"));
  assert.ok(md.includes("- Next.js App Router"));
  assert.ok(md.includes("## 1. Gambaran Produk"));
  assert.ok(md.includes("### 1.1 Latar Belakang"));
  assert.ok(md.includes("Aplikasi ini mempermudah pembuatan PRD."));
  assert.ok(md.includes("```mermaid\ngraph TD\n  A --> B\n```"));
});
