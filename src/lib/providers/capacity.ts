import { randomUUID } from "node:crypto";
import type { ClientSession } from "mongodb";
import { COLLECTIONS, getClient, getDb } from "../db/mongo";
import type { Account, Provider } from "./registry";

interface Slot { _id: string; reservationId: string; expiresAt: Date; }
interface Budget { _id: string; rpm: number; tpm: number; expiresAt: Date; }
export interface Reservation { id: string; slots: string[]; expiresAt: Date; }

const globalLimit = () => Math.max(1, Number(process.env.AI_GLOBAL_CONCURRENCY) || 2);
const maxAccount = () => Math.max(1, Number(process.env.AI_DEFAULT_ACCOUNT_CONCURRENCY) || 1);

async function takeSlot(scope: string, limit: number, id: string, expiresAt: Date, session: ClientSession) {
  const db = await getDb();
  const slots = db.collection<Slot>(COLLECTIONS.AI_RESERVATIONS);
  for (let index = 0; index < Math.max(1, limit); index++) {
    const key = `${scope}:${index}`;
    const current = await slots.findOne({ _id: key }, { session });
    if (current && current.expiresAt > new Date() && current.reservationId !== id) continue;
    if (current) {
      const result = await slots.updateOne({ _id: key, expiresAt: { $lte: new Date() } },
        { $set: { reservationId: id, expiresAt } }, { session });
      if (result.matchedCount) return key;
    } else {
      await slots.insertOne({ _id: key, reservationId: id, expiresAt }, { session });
      return key;
    }
  }
  throw new Error("CAPACITY_EXHAUSTED");
}

async function takeBudget(scope: string, rpmLimit: number, tpmLimit: number, estimatedTokens: number, session: ClientSession) {
  const db = await getDb();
  const buckets = db.collection<Budget>(COLLECTIONS.AI_RATE_BUCKETS);
  const minute = Math.floor(Date.now() / 60000);
  const key = `${scope}:${minute}`;
  const expiresAt = new Date((minute + 2) * 60000);
  const current = await buckets.findOne({ _id: key }, { session });
  if (!current) {
    if ((rpmLimit > 0 && rpmLimit < 1) || (tpmLimit > 0 && estimatedTokens > tpmLimit)) throw new Error("CAPACITY_EXHAUSTED");
    await buckets.insertOne({ _id: key, rpm: 1, tpm: estimatedTokens, expiresAt }, { session });
  } else {
    const result = await buckets.updateOne({ _id: key,
      ...(rpmLimit > 0 ? { rpm: { $lt: rpmLimit } } : {}),
      ...(tpmLimit > 0 ? { tpm: { $lte: Math.max(0, tpmLimit - estimatedTokens) } } : {}),
    }, { $inc: { rpm: 1, tpm: estimatedTokens } }, { session });
    if (!result.matchedCount) throw new Error("CAPACITY_EXHAUSTED");
  }
}

export async function reserveCapacity(provider: Provider, account: Account, estimatedTokens = 4000, leaseMs = 120000): Promise<Reservation | null> {
  const client = await getClient();
  const db = await getDb();
  const groupAccounts = await db.collection<Account>(COLLECTIONS.AI_ACCOUNTS).find({ quotaGroupId: account.quotaGroupId, enabled: true }).toArray();
  const groupProviders = await db.collection<Provider>(COLLECTIONS.AI_PROVIDERS).find({ _id: { $in: groupAccounts.map((a) => a.providerId) }, enabled: true }).toArray();
  const positiveMin = (values: number[], fallback: number) => Math.min(...values.filter((x) => x > 0).concat(fallback));
  const groupConcurrency = positiveMin(groupProviders.map((p) => p.concurrency), globalLimit());
  const groupRpm = positiveMin(groupProviders.map((p) => p.rpm), Number.MAX_SAFE_INTEGER);
  const groupTpm = positiveMin(groupProviders.map((p) => p.tpm), Number.MAX_SAFE_INTEGER);
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + leaseMs);
  const slots: string[] = [];
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      slots.push(await takeSlot("global", globalLimit(), id, expiresAt, session));
      slots.push(await takeSlot(`provider:${provider._id}`, provider.concurrency || globalLimit(), id, expiresAt, session));
      slots.push(await takeSlot(`account:${account._id}`, account.concurrency || maxAccount(), id, expiresAt, session));
      slots.push(await takeSlot(`group:${account.quotaGroupId}`, groupConcurrency, id, expiresAt, session));
      await takeBudget(`provider:${provider._id}`, provider.rpm, provider.tpm, estimatedTokens, session);
      await takeBudget(`account:${account._id}`, account.rpm, account.tpm, estimatedTokens, session);
      await takeBudget(`group:${account.quotaGroupId}`, groupRpm, groupTpm, estimatedTokens, session);
    });
    return { id, slots, expiresAt };
  } catch (error: any) {
    if (error?.message === "CAPACITY_EXHAUSTED" || error?.code === 11000 || error?.hasErrorLabel?.("TransientTransactionError")) return null;
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function releaseCapacity(reservation: Reservation) {
  const db = await getDb();
  await db.collection<Slot>(COLLECTIONS.AI_RESERVATIONS).deleteMany({ _id: { $in: reservation.slots }, reservationId: reservation.id });
}

export async function refreshCapacity(reservation: Reservation, leaseMs: number) {
  const db = await getDb();
  const expiresAt = new Date(Date.now() + leaseMs);
  const result = await db.collection<Slot>(COLLECTIONS.AI_RESERVATIONS).updateMany({ _id: { $in: reservation.slots }, reservationId: reservation.id },
    { $set: { expiresAt } });
  return result.matchedCount === reservation.slots.length;
}
