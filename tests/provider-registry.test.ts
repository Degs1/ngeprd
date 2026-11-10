import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptCredential, encryptCredential, validateProviderURL } from "../src/lib/providers/registry";

test("provider credentials are encrypted and URLs reject local targets", async () => {
  const priorKey = process.env.AI_CREDENTIAL_ENCRYPTION_KEY;
  const priorAllowlist = process.env.AI_PROVIDER_HOST_ALLOWLIST;
  try {
    process.env.AI_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    process.env.AI_PROVIDER_HOST_ALLOWLIST = "localhost,127.0.0.1";
    const encrypted = encryptCredential("secret-token");
    assert.ok(!encrypted.includes("secret-token"));
    assert.equal(decryptCredential(encrypted), "secret-token");
    await assert.rejects(validateProviderURL("http://localhost/v1"));
    await assert.rejects(validateProviderURL("https://127.0.0.1/v1"));
    await assert.rejects(validateProviderURL("https://localhost/v1"));

    // When AI_ALLOW_INSECURE_LOCAL_ENDPOINTS=true, allowlisted local endpoints are accepted
    process.env.AI_ALLOW_INSECURE_LOCAL_ENDPOINTS = "true";
    const validated = await validateProviderURL("http://localhost:20128/v1");
    assert.equal(validated, "http://localhost:20128/v1");
  } finally {
    delete process.env.AI_ALLOW_INSECURE_LOCAL_ENDPOINTS;
    if (priorKey === undefined) delete process.env.AI_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.AI_CREDENTIAL_ENCRYPTION_KEY = priorKey;
    if (priorAllowlist === undefined) delete process.env.AI_PROVIDER_HOST_ALLOWLIST;
    else process.env.AI_PROVIDER_HOST_ALLOWLIST = priorAllowlist;
  }
});

test("tryParseOrRepairJson repairs relaxed JSON and handles raw markdown for sectionWriter", async () => {
  const { tryParseOrRepairJson } = await import("../src/lib/ai/generateJson");

  // Single-quoted keys
  assert.deepEqual(tryParseOrRepairJson("{'content': 'test'}", "sectionWriter"), { content: "test" });

  // Unquoted keys
  assert.deepEqual(tryParseOrRepairJson("{content: 'hello'}", "sectionWriter"), { content: "hello" });

  // Trailing commas
  assert.deepEqual(tryParseOrRepairJson('{"content": "hello", }', "sectionWriter"), { content: "hello" });

  // Pure markdown text returned directly without JSON wrapper
  const rawMarkdown = "# 4. User Authentication\n\nDetailed specifications for JWT auth.";
  assert.deepEqual(tryParseOrRepairJson(rawMarkdown, "sectionWriter", rawMarkdown), { content: rawMarkdown });
});

test("invokeWithPool does not disable provider account on AI_INVALID_OUTPUT", { skip: !process.env.MONGODB_TEST_URI }, async () => {
  process.env.MONGODB_URI = process.env.MONGODB_TEST_URI;
  const testDbName = `worker_test_${Date.now()}${Math.floor(Math.random() * 1000000)}`;
  process.env.MONGODB_DB = testDbName;
  process.env.AI_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");

  const { invokeWithPool } = await import("../src/lib/providers/invoke");
  const { getDb, closeMongo, COLLECTIONS } = await import("../src/lib/db/mongo");
  const { ObjectId } = await import("mongodb");
  const db = await getDb();

  const providerId = new ObjectId();
  const accountId = new ObjectId();
  await db.collection(COLLECTIONS.AI_PROVIDERS).insertOne({
    _id: providerId,
    name: "test-invalid-output-p",
    model: "test-model-output",
    baseURL: "http://localhost:20128/v1",
    capabilities: ["json"],
    enabled: true,
    priority: 1,
    concurrency: 1,
    rpm: 0,
    tpm: 0,
  });
  await db.collection(COLLECTIONS.AI_ACCOUNTS).insertOne({
    _id: accountId,
    providerId,
    label: "test-account-output",
    encryptedKey: encryptCredential("sk-test"),
    enabled: true,
    failureCount: 0,
    concurrency: 1,
    rpm: 0,
    tpm: 0,
  });

  const dummyTask: any = {
    _id: new ObjectId(),
    jobId: new ObjectId(),
    prdId: new ObjectId(),
    ownerId: "test-owner",
    stage: "section",
    key: "test-key",
    state: "leased",
    attempt: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    process.env.AI_ALLOW_INSECURE_LOCAL_ENDPOINTS = "true";
    process.env.AI_PROVIDER_HOST_ALLOWLIST = "localhost";

    // Simulate AI_INVALID_OUTPUT error thrown from model
    await assert.rejects(
      invokeWithPool(dummyTask, async () => {
        const err = Object.assign(new Error("Gagal membaca respons JSON dari model"), {
          code: "AI_INVALID_OUTPUT",
        });
        throw err;
      }),
      (err: any) => err.code === "AI_INVALID_OUTPUT"
    );

    // CRITICAL: Account must STILL BE ENABLED!
    const account = await db.collection(COLLECTIONS.AI_ACCOUNTS).findOne({ _id: accountId });
    assert.equal(account?.enabled, true, "Account must remain enabled despite AI_INVALID_OUTPUT");
  } finally {
    try {
      const collections = await db.listCollections().toArray();
      for (const coll of collections) {
        await db.collection(coll.name).drop().catch(() => {});
      }
    } catch {}
    await closeMongo().catch(() => {});
  }
});
