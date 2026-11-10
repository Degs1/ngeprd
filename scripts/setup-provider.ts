import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import readline from "node:readline";

// 1. Auto-load environment
if (typeof process.loadEnvFile === "function") {
  for (const file of [".env.local", ".env.worker", ".env"]) {
    const fullPath = resolve(process.cwd(), file);
    if (existsSync(fullPath)) {
      try { process.loadEnvFile(fullPath); } catch {}
    }
  }
}

import { getDb, closeMongo, COLLECTIONS } from "../src/lib/db/mongo";
import { encryptCredential } from "../src/lib/providers/registry";

function updateEnvFile(filePath: string, key: string, value: string) {
  const fullPath = resolve(process.cwd(), filePath);
  let content = existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content = content ? `${content.trim()}\n${key}=${value}\n` : `${key}=${value}\n`;
  }
  writeFileSync(fullPath, content, "utf8");
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("=== ngePRD AI Provider & Worker Setup ===");

  // 1. Check and Sync MONGODB_DB
  const localDb = process.env.MONGODB_DB || "bikinprd";
  console.log(`\n1. Memeriksa konfigurasi database: MONGODB_DB=${localDb}`);
  updateEnvFile(".env.local", "MONGODB_DB", localDb);
  updateEnvFile(".env.worker", "MONGODB_DB", localDb);
  process.env.MONGODB_DB = localDb;

  // 2. Check and Sync AI_CREDENTIAL_ENCRYPTION_KEY
  let encKey = process.env.AI_CREDENTIAL_ENCRYPTION_KEY || "";
  if (!encKey || encKey.includes("REPLACE_WITH") || encKey.length !== 64) {
    encKey = randomBytes(32).toString("hex");
    console.log(`2. Membuat kunci enkripsi kredensial baru (AES-256): ${encKey.slice(0, 8)}... (64 hex chars)`);
    updateEnvFile(".env.local", "AI_CREDENTIAL_ENCRYPTION_KEY", encKey);
    updateEnvFile(".env.worker", "AI_CREDENTIAL_ENCRYPTION_KEY", encKey);
    process.env.AI_CREDENTIAL_ENCRYPTION_KEY = encKey;
  } else {
    console.log(`2. Kunci enkripsi kredensial valid.`);
    updateEnvFile(".env.local", "AI_CREDENTIAL_ENCRYPTION_KEY", encKey);
    updateEnvFile(".env.worker", "AI_CREDENTIAL_ENCRYPTION_KEY", encKey);
  }

  // 2b. Allow local endpoints (localhost / 127.0.0.1) and ensure host allowlist
  for (const envFile of [".env.local", ".env.worker"]) {
    const fullPath = resolve(process.cwd(), envFile);
    if (existsSync(fullPath)) {
      updateEnvFile(envFile, "AI_ALLOW_INSECURE_LOCAL_ENDPOINTS", "true");
      let content = readFileSync(fullPath, "utf8");
      const m = content.match(/^AI_PROVIDER_HOST_ALLOWLIST=(.*)$/m);
      let hosts = (m ? m[1] : "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      for (const h of ["localhost", "127.0.0.1", "api.openai.com", "openrouter.ai"]) {
        if (!hosts.includes(h)) hosts.push(h);
      }
      updateEnvFile(envFile, "AI_PROVIDER_HOST_ALLOWLIST", hosts.join(","));
    }
  }
  process.env.AI_ALLOW_INSECURE_LOCAL_ENDPOINTS = "true";
  process.env.AI_PROVIDER_HOST_ALLOWLIST = [
    ...(process.env.AI_PROVIDER_HOST_ALLOWLIST || "").split(","),
    "localhost",
    "127.0.0.1",
    "api.openai.com",
    "openrouter.ai",
  ].map((s) => s.trim().toLowerCase()).filter(Boolean).join(",");

  const db = await getDb();

  // 3. Clear stuck jobs causing ACTIVE_JOB_LIMIT or blocked status
  const activeStates = ["queued", "running", "waiting_capacity", "retry_scheduled", "cancelling", "blocked"];
  const stuckJobs = await db.collection(COLLECTIONS.AI_JOBS).find({ state: { $in: activeStates } }).toArray();
  if (stuckJobs.length > 0) {
    console.log(`\n3. Ditemukan ${stuckJobs.length} job menggantung/blocked.`);
    await db.collection(COLLECTIONS.AI_JOBS).updateMany(
      { state: { $in: activeStates } },
      { $set: { state: "cancelled", reason: "Cleared by setup script", updatedAt: new Date() } }
    );
    await db.collection(COLLECTIONS.AI_TASKS).updateMany(
      { state: { $in: ["queued", "leased", "waiting_capacity", "retry_scheduled", "failed"] } },
      { $set: { state: "cancelled", updatedAt: new Date() }, $unset: { leaseOwner: "", leaseUntil: "" } }
    );
    console.log(`   -> Berhasil membatalkan ${stuckJobs.length} job. Antrean kini bersih!`);
  } else {
    console.log(`\n3. Tidak ada job menggantung (antrean bersih).`);
  }

  // Re-enable any disabled accounts so they can be re-tried
  await db.collection(COLLECTIONS.AI_ACCOUNTS).updateMany(
    {},
    { $set: { enabled: true, failureCount: 0 }, $unset: { cooldownUntil: "" } }
  );

  // 4. List existing providers
  const existingProviders = await db.collection(COLLECTIONS.AI_PROVIDERS).find().toArray();
  const existingAccounts = await db.collection(COLLECTIONS.AI_ACCOUNTS).find().toArray();
  console.log(`\n4. Status Provider Saat Ini: ${existingProviders.length} provider, ${existingAccounts.length} akun API.`);
  for (const p of existingProviders) {
    const accs = existingAccounts.filter((a) => a.providerId.toString() === p._id.toString());
    console.log(`   - [${p.name}] Model: ${p.model} | BaseURL: ${p.baseURL} | Enabled: ${p.enabled} | Akun: ${accs.length}`);
  }

  // Parse CLI arguments if provided
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const prefix = `--${name}=`;
    const found = args.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : null;
  };

  const providerType = getArg("provider") || (args.includes("--clear-only") ? "skip" : null);

  if (providerType === "skip") {
    console.log("\nSetup selesai. Antrean telah dibersihkan.");
    await closeMongo();
    return;
  }

  let selectedPreset = providerType;
  if (!selectedPreset) {
    console.log("\nPilihan Preset Provider AI:");
    console.log("  1) OpenRouter (Rekomendasi - mendukung banyak model seperti Gemini, Claude, Llama, DeepSeek)");
    console.log("  2) OpenAI Resmi (api.openai.com, gpt-4o, gpt-4o-mini)");
    console.log("  3) Google Gemini via OpenAI-compat (generativelanguage.googleapis.com)");
    console.log("  4) Custom HTTPS BaseURL");
    console.log("  5) Lewati penambahan provider (hanya bersihkan antrean)");

    const choice = await prompt("\nPilih preset (1-5): ");
    if (choice === "1") selectedPreset = "openrouter";
    else if (choice === "2") selectedPreset = "openai";
    else if (choice === "3") selectedPreset = "gemini";
    else if (choice === "4") selectedPreset = "custom";
    else {
      console.log("Selesai tanpa menambah provider baru.");
      await closeMongo();
      return;
    }
  }

  let name = "";
  let baseURL = "";
  let model = "";
  let host = "";

  if (selectedPreset === "openrouter") {
    name = "OpenRouter";
    baseURL = "https://openrouter.ai/api/v1";
    host = "openrouter.ai";
    model = getArg("model") || (await prompt("Model (default: google/gemini-2.5-flash): ")) || "google/gemini-2.5-flash";
  } else if (selectedPreset === "openai") {
    name = "OpenAI";
    baseURL = "https://api.openai.com/v1";
    host = "api.openai.com";
    model = getArg("model") || (await prompt("Model (default: gpt-4o-mini): ")) || "gpt-4o-mini";
  } else if (selectedPreset === "gemini") {
    name = "Google Gemini";
    baseURL = "https://generativelanguage.googleapis.com/v1beta/openai";
    host = "generativelanguage.googleapis.com";
    model = getArg("model") || (await prompt("Model (default: gemini-2.0-flash): ")) || "gemini-2.0-flash";
  } else if (selectedPreset === "custom") {
    name = getArg("name") || (await prompt("Nama provider: ")) || "Custom Provider";
    baseURL = getArg("url") || (await prompt("Base URL HTTP/HTTPS (contoh: https://openrouter.ai/api/v1 atau http://localhost:20128/v1): "));
    const parsed = new URL(baseURL);
    host = parsed.hostname;
    model = getArg("model") || (await prompt("Nama model: "));
    if (parsed.protocol === "http:" && (host === "localhost" || host === "127.0.0.1")) {
      updateEnvFile(".env.local", "AI_ALLOW_INSECURE_LOCAL_ENDPOINTS", "true");
      updateEnvFile(".env.worker", "AI_ALLOW_INSECURE_LOCAL_ENDPOINTS", "true");
      process.env.AI_ALLOW_INSECURE_LOCAL_ENDPOINTS = "true";
      console.log("Mengaktifkan AI_ALLOW_INSECURE_LOCAL_ENDPOINTS=true untuk target local proxy.");
    }
  }

  let apiKey = getArg("apiKey") || "";
  if (!apiKey) {
    apiKey = await prompt(`Masukkan API Key untuk ${name}: `);
  }

  if (!apiKey) {
    console.log("API Key kosong, pembatalan pendaftaran provider.");
    await closeMongo();
    return;
  }

  // Ensure host is allowlisted in .env.local and .env.worker
  const currentAllowlist = (process.env.AI_PROVIDER_HOST_ALLOWLIST || "api.openai.com")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  if (!currentAllowlist.includes(host.toLowerCase())) {
    currentAllowlist.push(host.toLowerCase());
    const newAllowlist = currentAllowlist.join(",");
    updateEnvFile(".env.local", "AI_PROVIDER_HOST_ALLOWLIST", newAllowlist);
    updateEnvFile(".env.worker", "AI_PROVIDER_HOST_ALLOWLIST", newAllowlist);
    process.env.AI_PROVIDER_HOST_ALLOWLIST = newAllowlist;
    console.log(`Menambahkan "${host}" ke AI_PROVIDER_HOST_ALLOWLIST.`);
  }

  // Insert Provider
  const providerId = new ObjectId();
  await db.collection(COLLECTIONS.AI_PROVIDERS).insertOne({
    _id: providerId,
    name,
    baseURL,
    model,
    capabilities: ["json", "mermaid"],
    priority: 100,
    enabled: true,
    allowCrossModelFallback: true,
    concurrency: 2,
    rpm: 0,
    tpm: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Insert Account with encrypted API Key
  const accountId = new ObjectId();
  await db.collection(COLLECTIONS.AI_ACCOUNTS).insertOne({
    _id: accountId,
    providerId,
    label: `${name} Key`,
    encryptedKey: encryptCredential(apiKey),
    quotaGroupId: `${name.toLowerCase().replace(/\s+/g, "-")}-group`,
    enabled: true,
    concurrency: 2,
    rpm: 0,
    tpm: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`\n Provider "${name}" dengan model "${model}" dan akun API berhasil didaftarkan ke MongoDB!`);
  console.log("Siap! Sekarang jalankan worker Anda dengan:\n   npm run worker:start");

  await closeMongo();
}

void main().catch((err) => {
  console.error("Gagal menjalankan setup:", err);
  process.exit(1);
});

