import { db } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import { sql, eq } from "drizzle-orm";

let syncQueue: Array<{
  action: "SET" | "DELETE";
  collection: string;
  id: string;
  data?: any;
}> = [];

let isProcessingQueue = false;
let syncTimeout: NodeJS.Timeout | null = null;
let isCloudSqlConnected = false;

// Check Cloud SQL connection status
export async function testCloudSqlConnection(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    isCloudSqlConnected = true;
    return true;
  } catch (err) {
    console.warn("[Cloud SQL Sync] Connection check failed:", (err as Error).message);
    isCloudSqlConnected = false;
    return false;
  }
}

// Queue document update or insert into Cloud SQL
export function syncToCloudSql(
  collectionName: string,
  docId: string,
  data: any
) {
  if (!collectionName || !docId) return;

  // Deduplicate in queue
  syncQueue = syncQueue.filter(
    (item) => !(item.collection === collectionName && item.id === docId)
  );

  syncQueue.push({
    action: "SET",
    collection: collectionName,
    id: docId,
    data: JSON.parse(JSON.stringify(data)),
  });

  triggerQueueProcessing();
}

// Queue document deletion from Cloud SQL
export function syncDeleteFromCloudSql(
  collectionName: string,
  docId: string
) {
  if (!collectionName || !docId) return;

  syncQueue = syncQueue.filter(
    (item) => !(item.collection === collectionName && item.id === docId)
  );

  syncQueue.push({
    action: "DELETE",
    collection: collectionName,
    id: docId,
  });

  triggerQueueProcessing();
}

function triggerQueueProcessing() {
  if (syncTimeout) return;
  syncTimeout = setTimeout(() => {
    syncTimeout = null;
    processSyncQueue();
  }, 100);
}

async function processSyncQueue() {
  if (isProcessingQueue || syncQueue.length === 0) return;
  isProcessingQueue = true;

  const batch = syncQueue.splice(0, 50);

  try {
    for (const item of batch) {
      if (item.action === "SET") {
        await db
          .insert(schema.appDocuments)
          .values({
            collection: item.collection,
            id: item.id,
            data: item.data,
            createdAt: item.data?.created_at ? new Date(item.data.created_at) : new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [schema.appDocuments.collection, schema.appDocuments.id],
            set: {
              data: item.data,
              updatedAt: new Date(),
            },
          });
      } else if (item.action === "DELETE") {
        await db
          .delete(schema.appDocuments)
          .where(
            sql`${schema.appDocuments.collection} = ${item.collection} AND ${schema.appDocuments.id} = ${item.id}`
          );
      }
    }
    isCloudSqlConnected = true;
  } catch (err) {
    console.error("[Cloud SQL Sync Error]:", (err as Error).message);
    // Put failed batch back to retry
    syncQueue.unshift(...batch);
    isCloudSqlConnected = false;
  } finally {
    isProcessingQueue = false;
    if (syncQueue.length > 0) {
      triggerQueueProcessing();
    }
  }
}

// Load all collections from Cloud SQL into local in-memory DB on server startup
export async function loadAllFromCloudSql(inMemoryDb: any): Promise<boolean> {
  try {
    console.log("[Cloud SQL] Loading persistent documents from PostgreSQL database...");
    const rows = await db.select().from(schema.appDocuments);

    if (!rows || rows.length === 0) {
      console.log("[Cloud SQL] No documents in database yet. Ready for inserts.");
      return false;
    }

    const grouped: Record<string, any[]> = {};
    let singletonProfile: any = null;
    let singletonSettings: any = null;

    for (const row of rows) {
      const col = row.collection;
      const data = row.data;

      if (col === "company_profile") {
        singletonProfile = data;
      } else if (col === "settings") {
        singletonSettings = data;
      } else {
        if (!grouped[col]) grouped[col] = [];
        grouped[col].push(data);
      }
    }

    // Merge into in-memory DB
    for (const [col, items] of Object.entries(grouped)) {
      if (Array.isArray(inMemoryDb[col])) {
        inMemoryDb[col] = items;
      }
    }

    if (singletonProfile) inMemoryDb.company_profile = singletonProfile;
    if (singletonSettings) inMemoryDb.settings = singletonSettings;

    console.log(`[Cloud SQL] Successfully loaded ${rows.length} documents across ${Object.keys(grouped).length} collections from PostgreSQL!`);
    isCloudSqlConnected = true;
    return true;
  } catch (err) {
    console.error("[Cloud SQL Startup Load Error]:", (err as Error).message);
    return false;
  }
}

export function isCloudSqlHealthy(): boolean {
  return isCloudSqlConnected;
}
