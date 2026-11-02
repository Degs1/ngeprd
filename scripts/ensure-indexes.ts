import { getDb, closeMongo, COLLECTIONS } from "../src/lib/db/mongo";

export async function ensureIndexes(): Promise<void> {
  console.log("Setting up MongoDB indexes for bikinprd...");
  const db = await getDb();

  const prdCol = db.collection(COLLECTIONS.PRD_DOCUMENTS);
  const prdIndexName = await prdCol.createIndex(
    { ownerId: 1, updatedAt: -1 },
    { name: "owner_updated_idx" }
  );
  console.log(`Created index on ${COLLECTIONS.PRD_DOCUMENTS}: ${prdIndexName}`);

  const csCol = db.collection(COLLECTIONS.PRD_CHANGESETS);
  const csIndexName = await csCol.createIndex(
    { ownerId: 1, docId: 1, createdAt: -1 },
    { name: "owner_doc_created_idx" }
  );
  console.log(`Created index on ${COLLECTIONS.PRD_CHANGESETS}: ${csIndexName}`);

  console.log("MongoDB indexes verified successfully.");
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith("ensure-indexes.ts") ||
    process.argv[1].endsWith("ensure-indexes.js"))
) {
  ensureIndexes()
    .then(async () => {
      await closeMongo();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Failed to ensure indexes:", err);
      await closeMongo();
      process.exit(1);
    });
}
