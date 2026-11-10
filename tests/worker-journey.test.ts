import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";

const answer = (payload: unknown) => new Response(JSON.stringify({
  id: "chatcmpl-worker-test", object: "chat.completion", created: Date.now(), model: "test-model",
  choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(payload) }, finish_reason: "stop" }],
  usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 },
}), { status: 200, headers: { "content-type": "application/json" } });

const sectionTypes = ["overview", "problem", "users", "features", "flow", "data_model", "tech_stack", "api", "security", "nfr", "roadmap"];
const plan = {
  title: "PRD Uji Worker", keyDecisions: ["Web", "MongoDB", "Login"],
  chapters: [
    { key: "ch_1", title: "Produk", sections: sectionTypes.slice(0, 4).map((type, i) => ({
      key: `s_${i}`, type, title: `Bagian ${i}`, brief: `Spesifikasi bagian ${i}`,
      dependsOn: i ? [`s_${i - 1}`] : [],
    })) },
    { key: "ch_2", title: "Alur", sections: sectionTypes.slice(4, 8).map((type, index) => {
      const i = index + 4;
      return { key: `s_${i}`, type, title: `Bagian ${i}`, brief: `Spesifikasi bagian ${i}`,
        ...(type === "flow" ? { diagramHint: "flowchart" } : {}), dependsOn: [`s_${i - 1}`] };
    }) },
    { key: "ch_3", title: "Operasi", sections: sectionTypes.slice(8).map((type, index) => {
      const i = index + 8;
      return { key: `s_${i}`, type, title: `Bagian ${i}`, brief: `Spesifikasi bagian ${i}`,
        dependsOn: [`s_${i - 1}`] };
    }) },
  ],
};

test("worker journey: idea, questions, answers, 11 sections, diagram, manual edit, export", { skip: !process.env.MONGODB_TEST_URI }, async () => {
  process.env.MONGODB_URI = process.env.MONGODB_TEST_URI;
  process.env.MONGODB_DB = `worker_test_${Date.now()}${Math.floor(Math.random() * 1000000)}`;
  process.env.AI_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  process.env.AI_PROVIDER_HOST_ALLOWLIST = "api.openai.com";
  const { getDb, closeMongo, COLLECTIONS } = await import("../src/lib/db/mongo");
  const { ensureIndexes } = await import("../scripts/ensure-indexes");
  const { createPrd, getPrdById, updateSection } = await import("../src/lib/db/prdRepository");
  const { encryptCredential } = await import("../src/lib/providers/registry");
  const { claimTask, getLatestJob, listTasks } = await import("../src/lib/jobs/repository");
  const { processTask, reconcileJobs, workerId } = await import("../worker/index");
  const originalFetch = globalThis.fetch;
  const calls = { brainstorm: 0, planner: 0, section: 0, diagram: 0 };
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    const system = String((body.messages || []).find((message: { role: string }) => message.role === "system")?.content || "");
    if (system.includes("Brainstormer")) {
      calls.brainstorm++;
      return answer({ lang: "id", questions: Array.from({ length: 4 }, (_, i) => ({
        text: `Bagaimana kebutuhan fitur produk untuk pengguna ${i + 1}?`,
        why: "Menentukan ruang lingkup", options: ["Pilihan A", "Pilihan B", "Pilihan C"],
      })) });
    }
    if (system.includes("Principal Product Architect")) { calls.planner++; return answer(plan); }
    if (system.includes("Spesialis Diagram Arsitektur Mermaid") || system.includes("Mermaid Diagram Specialist")) {
      calls.diagram++; return answer({ code: "flowchart TD\n A[Mulai] --> B[Selesai]" });
    }
    calls.section++;
    return answer({ content: "## Kebutuhan utama\nSistem menyimpan keputusan produk dan menyediakan alur kerja yang dapat diuji." });
  };
  try {
    const db = await getDb();
    assert.match(db.databaseName, /^worker_test_\d+$/);
    assert.equal(process.env.MONGODB_URI, process.env.MONGODB_TEST_URI);
    await ensureIndexes();
    const providerId = new ObjectId();
    await db.collection(COLLECTIONS.AI_PROVIDERS).insertOne({ _id: providerId, name: "mock",
      baseURL: "https://api.openai.com/v1", model: "test-model", capabilities: ["json", "mermaid"],
      priority: 1, enabled: true, allowCrossModelFallback: false, concurrency: 2, rpm: 0, tpm: 0 });
    await db.collection(COLLECTIONS.AI_ACCOUNTS).insertOne({ _id: new ObjectId(), providerId,
      label: "mock", encryptedKey: encryptCredential("test-key"), quotaGroupId: "mock-group",
      enabled: true, concurrency: 1, rpm: 0, tpm: 0 });
    const ownerId = "journey-owner";
    const prd = await createPrd(ownerId, { idea: "Aplikasi pencatatan inventaris untuk toko kecil" });
    const { POST: brainstormPost } = await import("../src/app/api/prds/[id]/brainstorm/route");
    const route = `http://localhost/api/prds/${prd._id}`;
    const submit = await brainstormPost(new NextRequest(`${route}/brainstorm`, { method: "POST", headers: { "x-owner-id": ownerId } }),
      { params: { id: prd._id.toString() } });
    assert.equal(submit.status, 202);
    const firstTask = await claimTask(workerId, 120000);
    assert.ok(firstTask);
    await processTask(firstTask!);
    const questioned = await getPrdById(prd._id, ownerId);
    assert.equal(questioned?.brainstorm.questions.length, 4);
    assert.equal((await getLatestJob(prd._id.toString(), ownerId, "brainstorm"))?.state, "waiting_user");
    const { PUT: answerPut } = await import("../src/app/api/prds/[id]/brainstorm/answers/route");
    for (const question of questioned!.brainstorm.questions) {
      const response = await answerPut(new NextRequest(`${route}/brainstorm/answers`, { method: "PUT",
        headers: { "x-owner-id": ownerId, "content-type": "application/json" },
        body: JSON.stringify({ questionId: question.id, value: "Pilihan A", isCustom: false }) }),
      { params: { id: prd._id.toString() } });
      assert.equal(response.status, 200);
    }
    const { POST: generatePost } = await import("../src/app/api/prds/[id]/generate/route");
    const generation = await generatePost(new NextRequest(`${route}/generate`, { method: "POST",
      headers: { "x-owner-id": ownerId, "content-type": "application/json" }, body: "{}" }),
    { params: { id: prd._id.toString() } });
    assert.equal(generation.status, 202);
    const generationJob = await getLatestJob(prd._id.toString(), ownerId, "generation");
    assert.ok(generationJob);
    let processed = 0;
    let activeWorkerId = workerId;
    while (processed < 30) {
      const task = await claimTask(activeWorkerId, 120000);
      if (!task) { await reconcileJobs(); continue; }
      await processTask(task);
      processed++;
      if (processed === 5) {
        const checkpoint = await getPrdById(prd._id, ownerId);
        assert.ok(checkpoint!.sections.some((section) => section.status === "ready"));
        activeWorkerId = "restarted-worker";
        await reconcileJobs();
      }
      const current = await getLatestJob(prd._id.toString(), ownerId, "generation");
      if (current?.state === "completed") break;
    }
    const completed = await getPrdById(prd._id, ownerId);
    assert.equal(completed?.status, "ready");
    assert.equal(completed?.sections.length, 11);
    assert.ok(completed?.sections.every((section) => section.status === "ready"));
    assert.ok(completed?.sections.some((section) => section.diagram?.code));
    assert.deepEqual(calls, { brainstorm: 1, planner: 1, section: 11, diagram: 1 });
    assert.equal((await listTasks(generationJob!._id)).filter((task) => task.state === "completed").length, 14);
    const beforeEdit = { ...calls };
    const target = completed!.sections[0];
    const manual = await updateSection(prd._id, ownerId, target.id, target.rev,
      { title: "Judul Manual", content: "Konten manual yang tersimpan dan tampil pada ekspor." });
    assert.equal(manual.success, true);
    assert.deepEqual(calls, beforeEdit, "manual edit must not call AI");
    const { GET: exportGet } = await import("../src/app/api/prds/[id]/export/route");
    const exported = await exportGet(new NextRequest(`${route}/export?format=md`,
      { headers: { "x-owner-id": ownerId } }), { params: { id: prd._id.toString() } });
    assert.equal(exported.status, 200);
    const markdown = await exported.text();
    assert.match(markdown, /Konten manual yang tersimpan/);
    assert.match(markdown, /```mermaid/);
    assert.deepEqual(calls, beforeEdit);
  } finally {
    globalThis.fetch = originalFetch;
    try {
      const db = await getDb();
      if (/^worker_test_\d+$/.test(db.databaseName) && process.env.MONGODB_URI === process.env.MONGODB_TEST_URI &&
        process.env.MONGODB_TEST_KEEP_DB !== "true") {
        try { await db.dropDatabase(); }
        catch (error: any) {
          if (error?.code === 8000 || /not allowed.*dropDatabase/i.test(String(error?.message))) {
            const cols = await db.listCollections().toArray();
            for (const c of cols) {
              await db.collection(c.name).drop().catch(() => {});
            }
          } else {
            throw error;
          }
        }
      }
    } finally {
      await closeMongo();
    }
  }
});
