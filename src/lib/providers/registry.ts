import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ObjectId } from "mongodb";
import { COLLECTIONS, getDb } from "../db/mongo";

export interface Provider {
  _id: ObjectId;
  name: string;
  baseURL: string;
  model: string;
  capabilities: string[];
  priority: number;
  enabled: boolean;
  allowCrossModelFallback: boolean;
  rpm: number;
  tpm: number;
  concurrency: number;
  inputUsdPerMillion?: number;
  outputUsdPerMillion?: number;
  cooldownUntil?: Date;
  failureCount?: number;
}
export interface Account {
  _id: ObjectId;
  providerId: ObjectId;
  label: string;
  encryptedKey: string;
  quotaGroupId: string;
  enabled: boolean;
  concurrency: number;
  rpm: number;
  tpm: number;
  cooldownUntil?: Date;
  failureCount?: number;
}

function encryptionKey() {
  const raw = process.env.AI_CREDENTIAL_ENCRYPTION_KEY || "";
  if (!/^[0-9a-f]{64}$/i.test(raw)) throw new Error("AI_CREDENTIAL_ENCRYPTION_KEY must be 32 bytes of hex");
  return Buffer.from(raw, "hex");
}
export function encryptCredential(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}
export function decryptCredential(value: string) {
  const [iv, tag, ciphertext] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function isPublicAddress(address: string) {
  const v = address.toLowerCase();
  if (isIP(v) === 4) {
    const [a, b] = v.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127));
  }
  if (isIP(v) === 6) return !(v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("::ffff:"));
  return false;
}
export async function validateProviderURL(raw: string) {
  const url = new URL(raw);
  const allowLocal = process.env.AI_ALLOW_INSECURE_LOCAL_ENDPOINTS === "true";
  if (!allowLocal && url.protocol !== "https:") {
    throw new Error("Provider URL must be HTTPS without credentials, query, or fragment");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Provider URL must be HTTP or HTTPS without credentials, query, or fragment");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Provider URL must be without credentials, query, or fragment");
  }
  const allowed = (process.env.AI_PROVIDER_HOST_ALLOWLIST || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(url.hostname.toLowerCase())) throw new Error("Provider host is not allowlisted");
  if (!allowLocal) {
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address))) throw new Error("Provider DNS resolved to a private address");
  }
  return url.toString().replace(/\/$/, "");
}

export async function listProviders() {
  const db = await getDb();
  return db.collection<Provider>(COLLECTIONS.AI_PROVIDERS).find({}).sort({ priority: 1 }).toArray();
}
export async function listAccounts(providerId?: ObjectId) {
  const db = await getDb();
  return db.collection<Account>(COLLECTIONS.AI_ACCOUNTS).find(providerId ? { providerId } : {}).toArray();
}
export async function getEligibleAccounts(stage: "brainstorm" | "planner" | "section" | "diagram" | "finalize", preferredModel?: string) {
  const date = new Date();
  const capability = stage === "diagram" ? "mermaid" : "json";
  const providers = (await listProviders()).filter((p) => p.enabled && p.capabilities.includes(capability) && (!p.cooldownUntil || p.cooldownUntil <= date));
  const ordered = providers.sort((a, b) => {
    const aa = preferredModel && a.model === preferredModel ? -1 : 0;
    const bb = preferredModel && b.model === preferredModel ? -1 : 0;
    return aa - bb || a.priority - b.priority;
  });
  const accounts = await listAccounts();
  return ordered.flatMap((provider) => {
    if (preferredModel && provider.model !== preferredModel && (!provider.allowCrossModelFallback || !provider.capabilities.includes(capability))) return [];
    return accounts.filter((a) => a.providerId.equals(provider._id) && a.enabled && (!a.cooldownUntil || a.cooldownUntil <= date))
      .map((account) => ({ provider, account }));
  });
}

export async function recordProviderFailure(provider: Provider, account: Account, kind: "temporary" | "quota" | "auth" | "invalid", retryAfterMs = 0) {
  const db = await getDb();
  const until = new Date(Date.now() + Math.max(retryAfterMs, kind === "temporary" ? 30000 : 300000));
  await db.collection<Account>(COLLECTIONS.AI_ACCOUNTS).updateOne({ _id: account._id },
    { $inc: { failureCount: 1 }, $set: { cooldownUntil: until, ...(kind === "auth" || kind === "invalid" ? { enabled: false } : {}) } });
  if (kind === "invalid") await db.collection<Provider>(COLLECTIONS.AI_PROVIDERS).updateOne({ _id: provider._id }, { $inc: { failureCount: 1 } });
}
