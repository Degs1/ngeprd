const originalFetch = globalThis.fetch;

const plan = {
  title: "PRD Process Restart Test",
  keyDecisions: ["Next.js", "MongoDB", "Process Restart"],
  chapters: [
    {
      key: "ch_1",
      title: "Produk",
      sections: [
        { key: "s_0", type: "overview", title: "Ringkasan", brief: "Brief 0", dependsOn: [] },
        { key: "s_1", type: "problem", title: "Masalah", brief: "Brief 1", dependsOn: ["s_0"] },
        { key: "s_2", type: "users", title: "Pengguna", brief: "Brief 2", dependsOn: ["s_1"] },
        { key: "s_3", type: "features", title: "Fitur", brief: "Brief 3", dependsOn: ["s_2"] },
      ],
    },
    {
      key: "ch_2",
      title: "Arsitektur",
      sections: [
        { key: "s_4", type: "flow", title: "Alur", brief: "Brief 4", diagramHint: "flowchart", dependsOn: ["s_3"] },
        { key: "s_5", type: "data_model", title: "Model Data", brief: "Brief 5", dependsOn: ["s_4"] },
        { key: "s_6", type: "tech_stack", title: "Tech Stack", brief: "Brief 6", dependsOn: ["s_5"] },
        { key: "s_7", type: "api", title: "API", brief: "Brief 7", dependsOn: ["s_6"] },
      ],
    },
    {
      key: "ch_3",
      title: "Operasi",
      sections: [
        { key: "s_8", type: "security", title: "Keamanan", brief: "Brief 8", dependsOn: ["s_7"] },
        { key: "s_9", type: "nfr", title: "NFR", brief: "Brief 9", dependsOn: ["s_8"] },
        { key: "s_10", type: "roadmap", title: "Roadmap", brief: "Brief 10", dependsOn: ["s_9"] },
      ],
    },
  ],
};

function answer(payload) {
  return new Response(JSON.stringify({
    id: "chatcmpl-mock-preload",
    object: "chat.completion",
    created: Date.now(),
    model: "test-model",
    choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(payload) }, finish_reason: "stop" }],
    usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input?.url || String(input) || "");
  if (!url.includes("api.openai.com")) {
    return originalFetch(input, init);
  }
  let body = {};
  try {
    const raw = typeof init?.body === "string" ? init.body : (input?.body ? await input.clone().text() : "{}");
    body = JSON.parse(raw || "{}");
  } catch {}
  const system = String((body.messages || []).find((m) => m?.role === "system")?.content || "");
  if (system.includes("Brainstormer")) {
    return answer({
      lang: "id",
      questions: Array.from({ length: 4 }, (_, i) => ({
        text: `Pertanyaan kebutuhan ${i + 1}?`,
        why: "Ruang lingkup",
        options: ["Pilihan A", "Pilihan B", "Pilihan C"],
      })),
    });
  }
  if (system.includes("Principal Product Architect")) {
    return answer(plan);
  }
  if (system.includes("Spesialis Diagram Arsitektur Mermaid") || system.includes("Mermaid Diagram Specialist")) {
    return answer({ code: "flowchart TD\n  Start[Mulai] --> End[Selesai]" });
  }
  return answer({ content: "## Konten Bagian\nSpesifikasi lengkap berhasil dibuat oleh worker proses mandiri." });
};
