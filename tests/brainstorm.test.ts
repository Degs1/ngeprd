import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import {
  generateJson,
  extractJsonFromText,
  AiError,
} from "../src/lib/ai/generateJson";
import {
  BrainstormAiOutputSchema,
  runBrainstormer,
} from "../src/lib/agent/brainstormer";
import {
  BrainstormQuestionSchema,
  BrainstormAnswerSchema,
  type BrainstormQuestion,
  type BrainstormAnswer,
} from "../src/lib/schemas/prd";

test("extractJsonFromText - extracts JSON across various formats", () => {
  // Plain JSON
  assert.equal(extractJsonFromText('{"key": "value"}'), '{"key": "value"}');

  // Markdown code fence with json identifier
  assert.equal(
    extractJsonFromText('```json\n{"key": "value"}\n```'),
    '{"key": "value"}'
  );

  // Markdown code fence without identifier
  assert.equal(
    extractJsonFromText('```\n{"key": "value"}\n```'),
    '{"key": "value"}'
  );

  // Conversational text with leading and trailing text
  assert.equal(
    extractJsonFromText('Tentu! Berikut adalah JSON:\n{"key": "value"}\nSemoga membantu!'),
    '{"key": "value"}'
  );

  // Array JSON
  assert.equal(extractJsonFromText('[{"id": 1}, {"id": 2}]'), '[{"id": 1}, {"id": 2}]');
});

test("BrainstormAiOutputSchema - validates question quantity and option constraints", () => {
  const validPayload = {
    lang: "id",
    questions: [
      {
        text: "Siapa target pengguna utama aplikasi ini?",
        why: "Menentukan alur autentikasi dan otorisasi peran.",
        options: ["Pengguna individu", "Perusahaan kecil", "Enterprise"],
      },
      {
        text: "Platform mana yang menjadi prioritas peluncuran pertama?",
        why: "Menentukan arsitektur antarmuka dan API responsif.",
        options: ["Responsive Web PWA", "Mobile App iOS/Android", "Desktop Electron"],
      },
      {
        text: "Bagaimana mekanisme verifikasi identitas pengguna?",
        why: "Menentukan kepatuhan keamanan dan integrasi vendor KYC.",
        options: ["Verifikasi KTP manual", "Verifikasi otomatis e-KYC", "Tanpa verifikasi identitas"],
      },
      {
        text: "Apa batasan anggaran infrastruktur server di awal?",
        why: "Menentukan pemilihan managed DB vs self-hosted.",
        options: ["Di bawah Rp 1 juta/bulan", "Rp 1 - 5 juta/bulan", "Budget fleksibel sesuai skala"],
      },
    ],
  };

  const valid = BrainstormAiOutputSchema.safeParse(validPayload);
  assert.equal(valid.success, true);

  // Rejects less than 4 questions
  const tooFew = BrainstormAiOutputSchema.safeParse({
    ...validPayload,
    questions: validPayload.questions.slice(0, 3),
  });
  assert.equal(tooFew.success, false);

  // Rejects more than 6 questions
  const tooMany = BrainstormAiOutputSchema.safeParse({
    ...validPayload,
    questions: [
      ...validPayload.questions,
      validPayload.questions[0],
      validPayload.questions[1],
      validPayload.questions[2],
    ],
  });
  assert.equal(tooMany.success, false);

  // Rejects question with less than 3 options
  const tooFewOptions = BrainstormAiOutputSchema.safeParse({
    ...validPayload,
    questions: [
      {
        text: "Valid question text here?",
        options: ["Hanya 1", "Hanya 2"],
      },
      ...validPayload.questions.slice(1),
    ],
  });
  assert.equal(tooFewOptions.success, false);

  // Rejects invalid lang
  const invalidLang = BrainstormAiOutputSchema.safeParse({
    ...validPayload,
    lang: "fr",
  });
  assert.equal(invalidLang.success, false);
});

test("generateJson - parses valid JSON wrapped in markdown code fence", async () => {
  const mockFetch = async () => {
    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: Date.now(),
        model: "gemini",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "```json\n{\"lang\":\"id\",\"count\":42}\n```",
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

  const mockClient = createOpenAI({
    baseURL: "http://localhost:9999/v1",
    apiKey: "test-key",
    fetch: mockFetch,
  });

  const schema = z.object({
    lang: z.string(),
    count: z.number(),
  });

  const result = await generateJson({
    stage: "test",
    system: "You are a test helper",
    user: "Generate test JSON",
    schema,
    client: mockClient,
  });

  assert.equal(result.lang, "id");
  assert.equal(result.count, 42);
});

test("generateJson - retries when output is invalid JSON and succeeds on retry", async () => {
  let callCount = 0;

  const mockFetch = async () => {
    callCount++;
    if (callCount === 1) {
      // First attempt returns malformed JSON
      return new Response(
        JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion",
          created: Date.now(),
          model: "gemini",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Bukan JSON valid { corrupted: true ",
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
    }

    // Second attempt returns valid JSON
    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: Date.now(),
        model: "gemini",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: '{"success": true, "attempt": 2}',
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

  const mockClient = createOpenAI({
    baseURL: "http://localhost:9999/v1",
    apiKey: "test-key",
    fetch: mockFetch,
  });

  const schema = z.object({
    success: z.boolean(),
    attempt: z.number(),
  });

  const result = await generateJson({
    stage: "test-retry",
    system: "Test system",
    user: "Test retry",
    schema,
    client: mockClient,
  });

  assert.equal(callCount, 2);
  assert.equal(result.success, true);
  assert.equal(result.attempt, 2);
});

test("generateJson - throws AiError with AI_AUTH_ERROR on 401 without retry", async () => {
  let callCount = 0;

  const mockFetch = async () => {
    callCount++;
    return new Response(
      JSON.stringify({ error: { message: "Unauthorized", type: "invalid_request_error" } }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  };

  const mockClient = createOpenAI({
    baseURL: "http://localhost:9999/v1",
    apiKey: "bad-key",
    fetch: mockFetch,
  });

  const schema = z.object({ test: z.string() });

  await assert.rejects(
    async () => {
      await generateJson({
        stage: "test-auth",
        system: "Test system",
        user: "Test auth",
        schema,
        client: mockClient,
      });
    },
    (err: unknown) => {
      assert.equal(err instanceof AiError, true);
      if (err instanceof AiError) {
        assert.equal(err.code, "AI_AUTH_ERROR");
      }
      return true;
    }
  );

  // Exactly 1 call, no retries on auth error
  assert.equal(callCount, 1);
});

test("runBrainstormer - transforms AI output into server questions with q_ ids and allowCustom", async () => {
  const mockFetch = async () => {
    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: Date.now(),
        model: "gemini",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify({
                lang: "id",
                questions: [
                  {
                    text: "Siapa target pengguna jasa sewa kamera?",
                    why: "Menentukan fitur verifikasi akun dan profil.",
                    options: ["Fotografer hobi", "Studio profesional", "Event organizer"],
                  },
                  {
                    text: "Apakah memerlukan sistem deposit jaminan fisik/uang?",
                    why: "Menentukan alur pembayaran dan escrow.",
                    options: ["Deposit KTP & KK", "Uang jaminan 50%", "Asuransi aset tanpa deposit"],
                  },
                  {
                    text: "Bagaimana proses penyerahan dan pengembalian alat?",
                    why: "Menentukan fitur tracking lokasi dan kurir.",
                    options: ["Ambil di outlet", "Kurir internal toko", "Jasa ekspedisi instan"],
                  },
                  {
                    text: "Platform awal apa yang diinginkan untuk MVP?",
                    why: "Menentukan arsitektur frontend.",
                    options: ["Web portal responsif", "Aplikasi Android/iOS", "PWA mobile-first"],
                  },
                ],
              }),
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

  const mockClient = createOpenAI({
    baseURL: "http://localhost:9999/v1",
    apiKey: "test-key",
    fetch: mockFetch,
  });

  const res = await runBrainstormer({
    idea: "Platform marketplace sewa kamera dan lensa foto terdekat",
    client: mockClient,
  });

  assert.equal(res.lang, "id");
  assert.equal(res.questions.length, 4);
  assert.equal(res.questions[0].id, "q_1");
  assert.equal(res.questions[1].id, "q_2");
  assert.equal(res.questions[2].id, "q_3");
  assert.equal(res.questions[3].id, "q_4");
  assert.equal(res.questions[0].allowCustom, true);
  assert.equal(res.questions[0].text, "Siapa target pengguna jasa sewa kamera?");
  assert.equal(res.questions[0].options.length, 3);
});

test("BrainstormAnswerSchema - validates standard, custom, and delegated answers", () => {
  // Option selection
  const standardAnswer = BrainstormAnswerSchema.safeParse({
    questionId: "q_1",
    value: "Fotografer hobi",
    isCustom: false,
  });
  assert.equal(standardAnswer.success, true);
  if (standardAnswer.success) {
    assert.equal(standardAnswer.data.isCustom, false);
    assert.equal(standardAnswer.data.delegated, undefined);
  }

  // Custom text input
  const customAnswer = BrainstormAnswerSchema.safeParse({
    questionId: "q_2",
    value: "Deposit berupa uang jaminan 20% ditambah penahanan kartu identitas",
    isCustom: true,
  });
  assert.equal(customAnswer.success, true);
  if (customAnswer.success) {
    assert.equal(customAnswer.data.isCustom, true);
  }

  // Delegated to AI
  const delegatedAnswer = BrainstormAnswerSchema.safeParse({
    questionId: "q_3",
    value: "Serahkan ke AI (rekomendasi otomatis)",
    isCustom: false,
    delegated: true,
  });
  assert.equal(delegatedAnswer.success, true);
  if (delegatedAnswer.success) {
    assert.equal(delegatedAnswer.data.delegated, true);
  }
});

test("Brainstorm DB Repository Simulation - saveBrainstormQuestions and upsertBrainstormAnswer", () => {
  const doc: {
    questions: BrainstormQuestion[];
    answers: BrainstormAnswer[];
    lang: "id" | "en";
    updatedAt: Date;
  } = {
    questions: [],
    answers: [],
    lang: "id",
    updatedAt: new Date(),
  };

  // 1. Simulate saveBrainstormQuestions
  const newQuestions: BrainstormQuestion[] = [
    {
      id: "q_1",
      text: "Target pengguna?",
      options: ["A", "B", "C"],
      allowCustom: true,
    },
    {
      id: "q_2",
      text: "Platform?",
      options: ["Web", "Mobile", "Desktop"],
      allowCustom: true,
    },
    {
      id: "q_3",
      text: "Budget?",
      options: ["Low", "Mid", "High"],
      allowCustom: true,
    },
  ];

  doc.questions = newQuestions;
  doc.lang = "en";
  doc.updatedAt = new Date();

  assert.equal(doc.questions.length, 3);
  assert.equal(doc.lang, "en");

  // 2. Simulate upsertBrainstormAnswer - inserting new answer
  const upsert = (ans: BrainstormAnswer) => {
    const existingIdx = doc.answers.findIndex((a) => a.questionId === ans.questionId);
    if (existingIdx >= 0) {
      doc.answers[existingIdx] = ans;
    } else {
      doc.answers.push(ans);
    }
    doc.updatedAt = new Date();
  };

  upsert({ questionId: "q_1", value: "Option A", isCustom: false });
  assert.equal(doc.answers.length, 1);
  assert.equal(doc.answers[0].value, "Option A");

  upsert({ questionId: "q_2", value: "Option Mobile", isCustom: false });
  assert.equal(doc.answers.length, 2);

  // 3. Simulate updating existing answer for q_1
  upsert({
    questionId: "q_1",
    value: "Custom user answer",
    isCustom: true,
  });
  assert.equal(doc.answers.length, 2); // Count does not increase
  assert.equal(doc.answers[0].value, "Custom user answer");
  assert.equal(doc.answers[0].isCustom, true);

  // 4. Simulate delegating to AI for q_3
  upsert({
    questionId: "q_3",
    value: "Serahkan ke AI",
    isCustom: false,
    delegated: true,
  });
  assert.equal(doc.answers.length, 3);
  assert.equal(doc.answers[2].delegated, true);
});

test("BrainstormWizard - resume step calculation", () => {
  const computeResumeStep = (
    qs: BrainstormQuestion[],
    ans: BrainstormAnswer[]
  ): number => {
    if (!qs || qs.length === 0) return 0;
    const answerMap = new Map(ans.map((a) => [a.questionId, a]));
    const firstUnansweredIndex = qs.findIndex((q) => {
      const item = answerMap.get(q.id);
      return !item || !item.value || item.value.trim().length === 0;
    });
    if (firstUnansweredIndex === -1) {
      return qs.length; // All answered, resume at summary
    }
    return firstUnansweredIndex;
  };

  const sampleQuestions: BrainstormQuestion[] = [
    { id: "q_1", text: "Q1", options: ["A", "B", "C"], allowCustom: true },
    { id: "q_2", text: "Q2", options: ["A", "B", "C"], allowCustom: true },
    { id: "q_3", text: "Q3", options: ["A", "B", "C"], allowCustom: true },
    { id: "q_4", text: "Q4", options: ["A", "B", "C"], allowCustom: true },
  ];

  // Case 1: No answers yet -> Step 0 (Q1)
  assert.equal(computeResumeStep(sampleQuestions, []), 0);

  // Case 2: Q1 answered -> Step 1 (Q2)
  assert.equal(
    computeResumeStep(sampleQuestions, [
      { questionId: "q_1", value: "A", isCustom: false },
    ]),
    1
  );

  // Case 3: Q1 and Q2 answered -> Step 2 (Q3)
  assert.equal(
    computeResumeStep(sampleQuestions, [
      { questionId: "q_1", value: "A", isCustom: false },
      { questionId: "q_2", value: "B", isCustom: false },
    ]),
    2
  );

  // Case 4: All questions answered -> Step 4 (Summary view)
  assert.equal(
    computeResumeStep(sampleQuestions, [
      { questionId: "q_1", value: "A", isCustom: false },
      { questionId: "q_2", value: "B", isCustom: false },
      { questionId: "q_3", value: "C", isCustom: false },
      { questionId: "q_4", value: "Custom text", isCustom: true },
    ]),
    4
  );
});
