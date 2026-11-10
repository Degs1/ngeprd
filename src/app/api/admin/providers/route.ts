import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getAuthContext } from "@/lib/auth/owner";
import { COLLECTIONS, getDb } from "@/lib/db/mongo";
import { encryptCredential, listAccounts, listProviders, validateProviderURL } from "@/lib/providers/registry";

export const runtime = "nodejs";
const ProviderInput = z.object({ name: z.string().min(1).max(100), baseURL: z.string().url(), model: z.string().min(1),
  capabilities: z.array(z.string()).default(["json", "mermaid"]), priority: z.number().int().default(100),
  enabled: z.boolean().default(true), allowCrossModelFallback: z.boolean().default(false),
  rpm: z.number().int().nonnegative().default(0), tpm: z.number().int().nonnegative().default(0),
  concurrency: z.number().int().positive().default(2),
  inputUsdPerMillion: z.number().nonnegative().optional(), outputUsdPerMillion: z.number().nonnegative().optional() });
const AccountInput = z.object({ providerId: z.string(), label: z.string().min(1), apiKey: z.string().min(1),
  quotaGroupId: z.string().min(1), enabled: z.boolean().default(true), concurrency: z.number().int().positive().default(1),
  rpm: z.number().int().nonnegative().default(0), tpm: z.number().int().nonnegative().default(0) });

async function admin() { const auth = await getAuthContext(); return auth.isAuthenticated && auth.isAdmin; }
export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  const [providers, accounts] = await Promise.all([listProviders(), listAccounts()]);
  return NextResponse.json({ providers, accounts: accounts.map(({ encryptedKey, ...account }) => account) });
}
export async function POST(req: NextRequest) {
  if (!(await admin())) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  const body = await req.json().catch(() => null);
  const db = await getDb();
  if (body?.kind === "provider") {
    const parsed = ProviderInput.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR" } }, { status: 400 });
    try {
      const baseURL = await validateProviderURL(parsed.data.baseURL);
      const result = await db.collection(COLLECTIONS.AI_PROVIDERS).insertOne({ ...parsed.data, baseURL });
      return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 });
    } catch (error: any) { return NextResponse.json({ error: { code: "INVALID_ENDPOINT", message: error.message } }, { status: 400 }); }
  }
  if (body?.kind === "account") {
    const parsed = AccountInput.safeParse(body);
    if (!parsed.success || !ObjectId.isValid(parsed.data.providerId)) return NextResponse.json({ error: { code: "VALIDATION_ERROR" } }, { status: 400 });
    const { providerId, apiKey, ...rest } = parsed.data;
    const provider = await db.collection(COLLECTIONS.AI_PROVIDERS).findOne({ _id: new ObjectId(providerId) });
    if (!provider) return NextResponse.json({ error: { code: "PROVIDER_NOT_FOUND" } }, { status: 404 });
    const result = await db.collection(COLLECTIONS.AI_ACCOUNTS).insertOne({ ...rest, providerId: new ObjectId(providerId), encryptedKey: encryptCredential(apiKey) });
    return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 });
  }
  return NextResponse.json({ error: { code: "INVALID_KIND" } }, { status: 400 });
}

const PatchInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("provider"), id: z.string(), enabled: z.boolean().optional(), priority: z.number().int().optional(),
    baseURL: z.string().url().optional(), rpm: z.number().int().nonnegative().optional(), tpm: z.number().int().nonnegative().optional(),
    concurrency: z.number().int().positive().optional(), inputUsdPerMillion: z.number().nonnegative().optional(),
    outputUsdPerMillion: z.number().nonnegative().optional() }),
  z.object({ kind: z.literal("account"), id: z.string(), enabled: z.boolean().optional(), apiKey: z.string().min(1).optional(),
    quotaGroupId: z.string().min(1).optional(), rpm: z.number().int().nonnegative().optional(), tpm: z.number().int().nonnegative().optional(),
    concurrency: z.number().int().positive().optional() }),
]);
export async function PATCH(req: NextRequest) {
  if (!(await admin())) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  const parsed = PatchInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !ObjectId.isValid(parsed.data.id)) return NextResponse.json({ error: { code: "VALIDATION_ERROR" } }, { status: 400 });
  const { kind, id, ...updates } = parsed.data;
  const db = await getDb();
  if (kind === "provider" && "baseURL" in updates && updates.baseURL) {
    try { updates.baseURL = await validateProviderURL(updates.baseURL); }
    catch { return NextResponse.json({ error: { code: "INVALID_ENDPOINT" } }, { status: 400 }); }
  }
  if (kind === "account" && "apiKey" in updates && updates.apiKey) {
    (updates as Record<string, unknown>).encryptedKey = encryptCredential(updates.apiKey);
    delete updates.apiKey;
  }
  const result = await db.collection(kind === "provider" ? COLLECTIONS.AI_PROVIDERS : COLLECTIONS.AI_ACCOUNTS)
    .updateOne({ _id: new ObjectId(id) }, { $set: updates });
  return NextResponse.json({ updated: result.matchedCount === 1 });
}
