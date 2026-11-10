import { MongoClient, Db, Collection } from "mongodb";
import { getServerEnv } from "../env";
import type { PrdDocument } from "../schemas/prd";
import type { PrdChangeSet } from "../schemas/agent";

export const COLLECTIONS = {
  PRD_DOCUMENTS: "prd_documents",
  PRD_CHANGESETS: "prd_changesets",
  USER_USAGE: "user_daily_usage",
  AI_JOBS: "ai_jobs",
  AI_TASKS: "ai_tasks",
  AI_EVENTS: "ai_events",
  AI_PROVIDERS: "ai_providers",
  AI_ACCOUNTS: "ai_accounts",
  AI_RESERVATIONS: "ai_reservations",
  AI_USAGE: "ai_usage",
  AI_RATE_BUCKETS: "ai_rate_buckets",
} as const;

export interface UserDailyUsageDoc {
  ownerId: string;
  dateKey: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

export function getMongoClientPromise(): Promise<MongoClient> {
  if (typeof window !== "undefined") {
    throw new Error("MongoDB client can only be accessed on the server.");
  }

  const { MONGODB_URI } = getServerEnv();

  const options = {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 8000,
  };

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(MONGODB_URI, options);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  } else {
    if (!clientPromise) {
      const client = new MongoClient(MONGODB_URI, options);
      clientPromise = client.connect();
    }
    return clientPromise;
  }
}

export async function getClient(): Promise<MongoClient> {
  return getMongoClientPromise();
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  const { MONGODB_DB } = getServerEnv();
  return client.db(MONGODB_DB);
}

export async function getPrdCollection(): Promise<Collection<PrdDocument>> {
  const db = await getDb();
  return db.collection<PrdDocument>(COLLECTIONS.PRD_DOCUMENTS);
}

export async function getChangeSetCollection(): Promise<Collection<PrdChangeSet>> {
  const db = await getDb();
  return db.collection<PrdChangeSet>(COLLECTIONS.PRD_CHANGESETS);
}

export async function getUserUsageCollection(): Promise<Collection<UserDailyUsageDoc>> {
  const db = await getDb();
  return db.collection<UserDailyUsageDoc>(COLLECTIONS.USER_USAGE);
}

export async function closeMongo(): Promise<void> {
  if (global._mongoClientPromise) {
    const client = await global._mongoClientPromise;
    await client.close();
    delete global._mongoClientPromise;
  }
  if (clientPromise) {
    const client = await clientPromise;
    await client.close();
    clientPromise = undefined as unknown as Promise<MongoClient>;
  }
}
