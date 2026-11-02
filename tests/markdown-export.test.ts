import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { docToMarkdown, generateSlug } from "../src/lib/converter/docToMarkdown";
import { handleExportPrd } from "../src/lib/export/exportHandler";
import type { PrdDocument, Chapter, Section } from "../src/lib/schemas/prd";

test("generateSlug - creates safe filename slugs from document titles", () => {
  assert.equal(generateSlug("ngePRD Spec"), "ngeprd-spec");
  assert.equal(
    generateSlug("Platform Sewa Kamera & Lensa Foto (B2B)!"),
    "platform-sewa-kamera-lensa-foto-b2b"
  );
  assert.equal(
    generateSlug("   Aplikasi  Keuangan  Warung UMKM   "),
    "aplikasi-keuangan-warung-umkm"
  );
  assert.equal(generateSlug(""), "prd");
  assert.equal(generateSlug(null), "prd");
  assert.equal(generateSlug(undefined), "prd");
  assert.equal(generateSlug("---Special---Chars---"), "special-chars");
});

test("docToMarkdown - serializes PRD document adhering to Section 6.7 and filters non-ready sections", () => {
  const chapters: Chapter[] = [
    { id: "chap_1", title: "Ringkasan Produk", order: 1 },
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
      content: "Platform sewa kamera untuk fotografer profesional.",
      rev: 1,
      updatedAt: new Date(),
    },
    {
      id: "sec_2",
      chapterId: "chap_1",
      title: "Fitur yang Dibatalkan",
      type: "features",
      order: 2,
      status: "failed", // Should be filtered out per FR-EXP-03
      content: "Fitur ini gagal dibuat.",
      rev: 1,
      updatedAt: new Date(),
    },
    {
      id: "sec_3",
      chapterId: "chap_1",
      title: "Fitur yang Tertunda",
      type: "features",
      order: 3,
      status: "pending", // Should be filtered out per FR-EXP-03
      content: "Fitur ini belum selesai.",
      rev: 1,
      updatedAt: new Date(),
    },
    {
      id: "sec_4",
      chapterId: "chap_2",
      title: "Diagram Alur",
      type: "architecture",
      order: 1,
      status: "ready",
      content: "Alur autentikasi dan booking.",
      diagram: {
        kind: "mermaid",
        code: "sequenceDiagram\n  User->>API: Login",
        status: "ok",
      },
      rev: 1,
      updatedAt: new Date(),
    },
  ];

  const doc: Partial<PrdDocument> = {
    title: "Marketplace Sewa Kamera",
    idea: "Platform sewa kamera dan lensa foto terdekat berbasis lokasi",
    keyDecisions: [
      "Next.js App Router dengan TypeScript",
      "MongoDB Atlas untuk penyimpanan data",
    ],
    chapters,
    sections,
    brainstorm: {
      questions: [
        {
          id: "q_1",
          text: "Siapa target pengguna utama?",
          options: ["Fotografer pemula", "Rental kamera"],
          allowCustom: true,
        },
      ],
      answers: [
        {
          questionId: "q_1",
          value: "Fotografer profesional dan pemilik rental kamera",
          isCustom: true,
        },
      ],
    },
  };

  const md = docToMarkdown(doc);

  // 1. Heading and Idea
  assert.ok(md.includes("# Marketplace Sewa Kamera"));
  assert.ok(
    md.includes("> Ide: Platform sewa kamera dan lensa foto terdekat berbasis lokasi")
  );

  // 2. Key Decisions
  assert.ok(md.includes("## Keputusan Kunci"));
  assert.ok(md.includes("- Next.js App Router dengan TypeScript"));
  assert.ok(md.includes("- MongoDB Atlas untuk penyimpanan data"));

  // 3. Chapters & Numbered Sections
  assert.ok(md.includes("## 1. Ringkasan Produk"));
  assert.ok(md.includes("### 1.1 Latar Belakang"));
  assert.ok(md.includes("Platform sewa kamera untuk fotografer profesional."));

  // 4. Verify non-ready sections were filtered out (FR-EXP-03)
  assert.ok(!md.includes("Fitur yang Dibatalkan"));
  assert.ok(!md.includes("Fitur ini gagal dibuat"));
  assert.ok(!md.includes("Fitur yang Tertunda"));

  // 5. Mermaid block
  assert.ok(md.includes("## 2. Arsitektur Teknis"));
  assert.ok(md.includes("### 2.1 Diagram Alur"));
  assert.ok(md.includes("```mermaid\nsequenceDiagram\n  User->>API: Login\n```"));

  // 6. Brainstorming Appendix (FR-EXP-04)
  assert.ok(md.includes("## Lampiran: Hasil Brainstorm"));
  assert.ok(
    md.includes(
      "- **Siapa target pengguna utama?**: Fotografer profesional dan pemilik rental kamera"
    )
  );
});

test("GET /api/prds/[id]/export - validates format, ready status, and returns downloadable markdown", async () => {
  const dummyDocId = new ObjectId();
  const dummyOwnerId = "test-owner-123";

  let mockDoc: PrdDocument | null = null;
  const mockDeps = {
    getOwnerId: () => dummyOwnerId,
    getPrdById: async (id: string, ownerId: string) => {
      if (mockDoc && id === dummyDocId.toString() && ownerId === dummyOwnerId) {
        return mockDoc;
      }
      return null;
    },
  };

  // Test 1: Unsupported format (must return 400 UNSUPPORTED_FORMAT)
  {
    const req = new NextRequest(
      `http://localhost:3000/api/prds/${dummyDocId.toString()}/export?format=pdf`
    );
    const res = await handleExportPrd(req, { id: dummyDocId.toString() }, mockDeps);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error.code, "UNSUPPORTED_FORMAT");
  }

  // Test 2: PRD not found (must return 404 NOT_FOUND)
  {
    mockDoc = null;
    const req = new NextRequest(
      `http://localhost:3000/api/prds/${dummyDocId.toString()}/export?format=md`
    );
    const res = await handleExportPrd(req, { id: dummyDocId.toString() }, mockDeps);
    assert.equal(res.status, 404);
    const json = await res.json();
    assert.equal(json.error.code, "NOT_FOUND");
  }

  // Test 3: PRD status is NOT 'ready' (e.g. 'brainstorming' or 'generating')
  // User Requirement 1: "harus status ready dulu"
  {
    mockDoc = {
      _id: dummyDocId,
      ownerId: dummyOwnerId,
      title: "Aplikasi Bengkel Motor",
      titleEdited: false,
      idea: "Pemesanan jadwal servis bengkel motor",
      lang: "id",
      status: "generating", // Not ready!
      brainstorm: { questions: [], answers: [] },
      keyDecisions: [],
      chapters: [],
      sections: [],
      edges: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const req = new NextRequest(
      `http://localhost:3000/api/prds/${dummyDocId.toString()}/export?format=md`
    );
    const res = await handleExportPrd(req, { id: dummyDocId.toString() }, mockDeps);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error.code, "PRD_NOT_READY");
    assert.equal(json.error.message, "PRD harus berstatus ready untuk diekspor");
  }

  // Test 4: PRD status IS 'ready'
  // User Requirement 2: "slug dari judul"
  {
    mockDoc = {
      _id: dummyDocId,
      ownerId: dummyOwnerId,
      title: "Aplikasi Bengkel Motor",
      titleEdited: true,
      idea: "Pemesanan jadwal servis bengkel motor",
      lang: "id",
      status: "ready", // Ready!
      brainstorm: { questions: [], answers: [] },
      keyDecisions: ["Next.js", "PostgreSQL"],
      chapters: [
        { id: "chap_1", title: "Ringkasan", order: 1 },
      ],
      sections: [
        {
          id: "sec_1",
          chapterId: "chap_1",
          type: "overview",
          title: "Latar Belakang",
          content: "Sistem antrean servis motor modern.",
          order: 1,
          status: "ready",
          rev: 1,
          updatedAt: new Date(),
        },
      ],
      edges: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const req = new NextRequest(
      `http://localhost:3000/api/prds/${dummyDocId.toString()}/export?format=md`
    );
    const res = await handleExportPrd(req, { id: dummyDocId.toString() }, mockDeps);

    assert.equal(res.status, 200);
    assert.equal(
      res.headers.get("Content-Type"),
      "text/markdown; charset=utf-8"
    );

    // Verify slug in Content-Disposition header
    const disposition = res.headers.get("Content-Disposition");
    assert.ok(disposition?.includes('filename="aplikasi-bengkel-motor.md"'));

    const text = await res.text();
    assert.ok(text.includes("# Aplikasi Bengkel Motor"));
    assert.ok(text.includes("> Ide: Pemesanan jadwal servis bengkel motor"));
    assert.ok(text.includes("## 1. Ringkasan"));
    assert.ok(text.includes("### 1.1 Latar Belakang"));
    assert.ok(text.includes("Sistem antrean servis motor modern."));
  }
});
