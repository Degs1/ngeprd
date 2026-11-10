import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ObjectId } from "mongodb";

if (typeof process.loadEnvFile === "function") {
  for (const file of [".env.worker", ".env.local", ".env"]) {
    const fullPath = resolve(process.cwd(), file);
    if (existsSync(fullPath)) {
      try { process.loadEnvFile(fullPath); } catch {}
    }
  }
}

import { getDb, closeMongo, COLLECTIONS } from "../src/lib/db/mongo";
import type { PrdDocument, Chapter, Section, Edge } from "../src/lib/schemas/prd";
import type { AiJob, AiTask } from "../src/lib/jobs/contracts";

async function main() {
  const db = await getDb();
  console.log("Terhubung ke database MongoDB:", db.databaseName);

  const ownerId = "admin@example.com";
  const prdId = new ObjectId();
  const date = new Date();

  const chapters: Chapter[] = [
    { id: "chap_1", title: "Bab 1: Pendahuluan & Konteks", order: 1 },
    { id: "chap_2", title: "Bab 2: Spesifikasi Fungsional & Arsitektur", order: 2 },
    { id: "chap_3", title: "Bab 3: Keamanan & Roadmap", order: 3 },
  ];

  const sections: Section[] = [
    {
      id: "sec_overview",
      chapterId: "chap_1",
      type: "overview",
      title: "Ringkasan Eksekutif",
      brief: "Ringkasan visi dan proposisi nilai sistem",
      content: "## Ringkasan Eksekutif\n\nPlatform PRD otomatis ini mempercepat perumusan dokumen teknis dari ide awal menjadi spesifikasi lengkap berbasis kanvas interaktif dan worker background mandiri.",
      status: "ready",
      order: 1,
      position: { x: 50, y: 100 },
      rev: 1,
      updatedAt: date,
    },
    {
      id: "sec_problem",
      chapterId: "chap_1",
      type: "problem",
      title: "Latar Belakang & Masalah",
      brief: "Tantangan dalam pembuatan PRD manual",
      content: "## Latar Belakang & Masalah\n\n1. Pembuatan PRD manual memakan waktu berhari-hari.\n2. Kolaborasi lintas tim sering menimbulkan ketidaksinkronan arsitektur teknis.",
      status: "ready",
      order: 2,
      position: { x: 500, y: 100 },
      rev: 1,
      updatedAt: date,
    },
    {
      id: "sec_goals",
      chapterId: "chap_1",
      type: "goals",
      title: "Tujuan & Metrik Sukses",
      brief: "Target dan KPI pencapaian",
      content: "## Tujuan & Metrik Sukses\n\n- Mempercepat draft PRD hingga 80%.\n- Memastikan konsistensi schema dan diagram Mermaid.",
      status: "ready",
      order: 3,
      position: { x: 950, y: 100 },
      rev: 1,
      updatedAt: date,
    },
    {
      id: "sec_users",
      chapterId: "chap_1",
      type: "users",
      title: "Persona Pengguna",
      brief: "Target audiens produk",
      content: "## Persona Pengguna\n\n- **Product Manager**: Menyusun requirement dengan cepat.\n- **Software Engineer**: Membaca diagram dan spesifikasi API yang akurat.",
      status: "ready",
      order: 4,
      position: { x: 50, y: 480 },
      rev: 1,
      updatedAt: date,
    },
    {
      id: "sec_features",
      chapterId: "chap_2",
      type: "features",
      title: "Fitur Utama & Batasan",
      brief: "Daftar fungsionalitas utama",
      content: "## Fitur Utama\n\n1. Brainstorming interaktif berbasis AI.\n2. Visualisasi kanvas tanpa batas.\n3. Retry modular per node.",
      status: "ready",
      order: 5,
      position: { x: 500, y: 480 },
      rev: 1,
      updatedAt: date,
    },
    {
      id: "sec_flow",
      chapterId: "chap_2",
      type: "flow",
      title: "Alur Kerja Sistem",
      brief: "Flow interaksi pengguna dan worker",
      content: "## Alur Kerja Sistem\n\nBerikut diagram alur pemrosesan ide hingga kanvas siap digunakan.",
      diagramHint: "flowchart",
      diagram: {
        kind: "mermaid",
        code: "graph TD\n  A[Submit Ide] --> B[Brainstorming]\n  B --> C[Worker Scheduler]\n  C --> D[11 Sections]\n  D --> E[Kanvas Siap]",
        status: "ok",
      },
      status: "ready",
      order: 6,
      position: { x: 950, y: 480 },
      rev: 1,
      updatedAt: date,
    },
    {
      id: "sec_architecture",
      chapterId: "chap_2",
      type: "architecture",
      title: "Arsitektur Sistem",
      brief: "Desain sistem Next.js, Worker, dan MongoDB",
      content: "## Arsitektur Sistem\n\nSistem memisahkan runtime Vercel Next.js dari AI worker mandiri yang berjalan secara background dengan leases di MongoDB.",
      status: "ready",
      order: 7,
      position: { x: 1400, y: 480 },
      rev: 1,
      updatedAt: date,
    },
    {
      id: "sec_data_model",
      chapterId: "chap_2",
      type: "data_model",
      title: "Model Data & Skema Database",
      brief: "Struktur entitas PRD dan status node",
      content: "",
      status: "failed", // INI NODE YANG DIBUAT ERROR
      error: {
        code: "AI_TIMEOUT",
        message: "Gagal memproses bagian ini: Model AI timeout saat menulis skema database.",
      },
      order: 8,
      position: { x: 50, y: 860 },
      rev: 1,
      updatedAt: date,
    },
    {
      id: "sec_security",
      chapterId: "chap_3",
      type: "security",
      title: "Keamanan & Autorisasi",
      brief: "Enkripsi dan isolasi multi-tenant",
      content: "## Keamanan\n\nSemua API key provider dienkripsi AES-256-GCM. Akses dokumen PRD diproteksi berdasarkan kepemilikan ownerId.",
      status: "ready",
      order: 9,
      position: { x: 500, y: 860 },
      rev: 1,
      updatedAt: date,
    },
    {
      id: "sec_nfr",
      chapterId: "chap_3",
      type: "nfr",
      title: "Persyaratan Non-Fungsional",
      brief: "Performa, ketersediaan, dan skalabilitas",
      content: "## Persyaratan Non-Fungsional\n\n- Latensi UI < 100ms untuk navigasi kanvas.\n- Worker tahan crash dan auto-resume.",
      status: "ready",
      order: 10,
      position: { x: 950, y: 860 },
      rev: 1,
      updatedAt: date,
    },
    {
      id: "sec_roadmap",
      chapterId: "chap_3",
      type: "roadmap",
      title: "Rencana Rilis & Roadmap",
      brief: "Milestone peluncuran",
      content: "## Roadmap\n\n- Q1: AI Worker Migration & Granular Retry.\n- Q2: Real-time Multi-user Canvas Collaboration.",
      status: "ready",
      order: 11,
      position: { x: 1400, y: 860 },
      rev: 1,
      updatedAt: date,
    },
  ];

  const edges: Edge[] = [
    { id: "e1", from: "sec_overview", to: "sec_problem" },
    { id: "e2", from: "sec_problem", to: "sec_goals" },
    { id: "e3", from: "sec_overview", to: "sec_users" },
    { id: "e4", from: "sec_users", to: "sec_features" },
    { id: "e5", from: "sec_features", to: "sec_flow" },
    { id: "e6", from: "sec_flow", to: "sec_architecture" },
    { id: "e7", from: "sec_features", to: "sec_data_model" },
    { id: "e8", from: "sec_data_model", to: "sec_security" },
    { id: "e9", from: "sec_security", to: "sec_nfr" },
    { id: "e10", from: "sec_nfr", to: "sec_roadmap" },
  ];

  const questions = [
    { id: "q1", text: "Siapa target pengguna utama?", options: ["Product Manager", "Software Engineer"], allowCustom: true },
    { id: "q2", text: "Bagaimana integrasi LLM dilakukan?", options: ["Proxy Lokal (9router)", "OpenAI Direct"], allowCustom: true },
    { id: "q3", text: "Database apa yang dipakai?", options: ["MongoDB Atlas", "PostgreSQL"], allowCustom: true },
    { id: "q4", text: "Apa strategi penanganan error?", options: ["Granular Retry Per Node & Batch Retry", "Manual Edit Only"], allowCustom: true },
  ];

  const answers = [
    { questionId: "q1", value: "Product Manager dan Software Engineer", isCustom: false },
    { questionId: "q2", value: "Proxy Lokal (9router)", isCustom: false },
    { questionId: "q3", value: "MongoDB Atlas", isCustom: false },
    { questionId: "q4", value: "Granular Retry Per Node & Batch Retry", isCustom: false },
  ];

  const prdDoc: PrdDocument = {
    _id: prdId,
    ownerId,
    title: "Platform NgePRD Enterprise (Uji Error Node)",
    titleEdited: false,
    titleRev: 1,
    idea: "Platform perancangan PRD otomatis dengan worker mandiri, visualisasi graph DAG, dan fitur retry modular",
    lang: "id",
    status: "failed",
    lastError: {
      code: "WORKER_TASK_FAILED",
      message: "Generasi gagal pada bagian Model Data & Skema: AI_TIMEOUT",
      stage: "section",
      at: date,
    },
    brainstorm: {
      questions,
      answers,
    },
    keyDecisions: [
      "Menggunakan worker background terpisah dengan leases dan atomic locking",
      "Penyimpanan di MongoDB Atlas dengan index multi-field",
      "Fallback retry modular per-node dan batch retry",
    ],
    chapters,
    sections,
    edges,
    createdAt: date,
    updatedAt: date,
  };

  await db.collection(COLLECTIONS.PRD_DOCUMENTS).insertOne(prdDoc as any);

  // Buat juga Job & Task record agar status job sinkron di sistem
  const jobId = new ObjectId();
  const job: AiJob = {
    _id: jobId,
    ownerId,
    prdId,
    kind: "generation",
    submissionId: `test_sub_${Date.now()}`,
    state: "failed",
    stage: "section",
    reason: "Generasi gagal pada bagian Model Data & Skema: Model AI timeout saat menulis skema database.",
    progress: { total: 11, ready: 10, failed: 1, diagrams: 1 },
    eventSeq: 1,
    createdAt: date,
    updatedAt: date,
  };
  await db.collection(COLLECTIONS.AI_JOBS).insertOne(job as any);

  const task: AiTask = {
    _id: new ObjectId(),
    jobId,
    ownerId,
    prdId,
    key: "section:sec_data_model",
    stage: "section",
    sectionId: "sec_data_model",
    dependsOn: ["section:sec_features"],
    state: "failed",
    attempt: 3,
    lastError: "Gagal memproses bagian ini: Model AI timeout saat menulis skema database.",
    nextRunAt: date,
    fence: 1,
    createdAt: date,
    updatedAt: date,
  };
  await db.collection(COLLECTIONS.AI_TASKS).insertOne(task as any);

  console.log("\n=======================================================");
  console.log("PRD Uji Berhasil Dibuat di Database!");
  console.log("ID PRD       :", prdId.toString());
  console.log("Owner Email  :", ownerId);
  console.log("Node Error   : sec_data_model (Model Data & Skema)");
  console.log("Status Node  : failed (AI_TIMEOUT)");
  console.log("URL Kanvas   : /prd/" + prdId.toString());
  console.log("=======================================================\n");

  await closeMongo();
}

main().catch((err) => {
  console.error("Gagal membuat PRD uji:", err);
  process.exit(1);
});

