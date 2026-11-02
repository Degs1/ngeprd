import { MongoClient, Db, Collection } from "mongodb";
import { getServerEnv } from "../env";
import type { PrdDocument } from "../schemas/prd";
import type { PrdChangeSet } from "../schemas/agent";

export const COLLECTIONS = {
  PRD_DOCUMENTS: "prd_documents",
  PRD_CHANGESETS: "prd_changesets",
} as const;

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
