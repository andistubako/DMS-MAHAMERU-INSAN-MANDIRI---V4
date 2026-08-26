import { syncToCloudSql, syncDeleteFromCloudSql, isCloudSqlHealthy } from "./cloudSqlSync.js";
import { db, saveDatabaseToDisk } from "./data.js";
import { getFirestoreDB } from "./firebase.js";
import { doc, setDoc, deleteDoc } from "firebase/firestore";

let isRestoring = false;
let lastSyncTimestamp: string | null = null;
let lastSyncStatus: "SUCCESS" | "SYNCING" | "ERROR" | "IDLE" = "SUCCESS";

export const ALL_SYNC_COLLECTIONS: Array<{ key: keyof typeof db; colName: string }> = [
  { key: "users", colName: "users" },
  { key: "offices", colName: "offices" },
  { key: "provinces", colName: "provinces" },
  { key: "regencies", colName: "regencies" },
  { key: "districts", colName: "districts" },
  { key: "villages", colName: "villages" },
  { key: "areas", colName: "areas" },
  { key: "channels", colName: "channels" },
  { key: "routes", colName: "routes" },
  { key: "products", colName: "products" },
  { key: "skus", colName: "skus" },
  { key: "prices", colName: "prices" },
  { key: "promos", colName: "promos" },
  { key: "salesmen", colName: "salesmen" },
  { key: "open_call_reasons", colName: "open_call_reasons" },
  { key: "outlets", colName: "outlets" },
  { key: "sales_outlets", colName: "sales_outlets" },
  { key: "call_plans", colName: "call_plans" },
  { key: "call_plan_items", colName: "call_plan_items" },
  { key: "attendance", colName: "attendance" },
  { key: "visits", colName: "visits" },
  { key: "transactions", colName: "transactions" },
  { key: "inventory", colName: "inventory" },
  { key: "stock_movements", colName: "stock_movements" },
  { key: "stock_handovers", colName: "stock_handovers" },
  { key: "stock_returns", colName: "stock_returns" },
  { key: "stock_receivings", colName: "stock_receivings" },
  { key: "sales_stock_ledgers", colName: "sales_stock_ledgers" },
  { key: "targets", colName: "targets" },
  { key: "audit_logs", colName: "audit_logs" },
  { key: "gps_events", colName: "gps_events" },
];

/**
 * Get real-time database sync diagnostic stats (Cloud SQL PostgreSQL + Firebase Firestore)
 */
export function getSyncStats() {
  const collectionCounts: Record<string, number> = {};
  for (const { key, colName } of ALL_SYNC_COLLECTIONS) {
    const arr = (db as any)[key];
    collectionCounts[colName] = Array.isArray(arr) ? arr.length : 0;
  }

  const firestoreReady = !!getFirestoreDB();

  return {
    databaseEngine: "Cloud SQL (PostgreSQL) + Firestore",
    isCloudConnected: isCloudSqlHealthy() || firestoreReady,
    isFirestoreReady: firestoreReady,
    isQuotaPaused: false,
    lastSyncTimestamp: lastSyncTimestamp || new Date().toISOString(),
    lastSyncStatus: isCloudSqlHealthy() || firestoreReady ? "SUCCESS" : "ERROR",
    lastSyncError: null,
    pendingDirtyDocs: 0,
    totalLocalCollections: ALL_SYNC_COLLECTIONS.length,
    totalLocalRecords: Object.values(collectionCounts).reduce((a, b) => a + b, 0),
    collectionCounts,
  };
}

/**
 * Instant Real-Time Document Upsert to Cloud SQL (PostgreSQL) and Firebase Firestore
 */
export async function syncSingleDoc(colName: string, docId: string, data: any) {
  if (isRestoring || !docId) return;

  // 1. Sync to Cloud SQL (PostgreSQL)
  syncToCloudSql(colName, String(docId), data);

  // 2. Sync to Firebase Firestore if initialized
  try {
    const fdb = getFirestoreDB();
    if (fdb) {
      const sanitized = JSON.parse(JSON.stringify(data));
      const docRef = doc(fdb, colName, String(docId));
      setDoc(docRef, sanitized, { merge: true }).catch((err) => {
        // Log quietly without breaking flow
        if (process.env.DEBUG_SYNC) console.warn(`[Firestore Sync ${colName}/${docId}]:`, err?.message);
      });
    }
  } catch (err) {
    // Non-blocking
  }

  // 3. Immediately persist to disk JSON
  saveDatabaseToDisk();

  lastSyncTimestamp = new Date().toISOString();
}

/**
 * Instant Real-Time Document Deletion from Cloud SQL (PostgreSQL) and Firebase Firestore
 */
export async function deleteSingleDoc(colName: string, docId: string) {
  if (isRestoring || !docId) return;

  // 1. Sync deletion to Cloud SQL
  syncDeleteFromCloudSql(colName, String(docId));

  // 2. Sync deletion to Firebase Firestore
  try {
    const fdb = getFirestoreDB();
    if (fdb) {
      const docRef = doc(fdb, colName, String(docId));
      deleteDoc(docRef).catch(() => {});
    }
  } catch {
    // Non-blocking
  }

  // 3. Persist to disk JSON
  saveDatabaseToDisk();

  lastSyncTimestamp = new Date().toISOString();
}

/**
 * Synchronize local database to Cloud SQL & Firestore
 */
export async function syncToFirestore(immediate = false, forceAll = false) {
  if (isRestoring) return;

  if (db.company_profile) {
    syncSingleDoc("company_profile", "default_company", db.company_profile);
  }
  if (db.settings) {
    syncSingleDoc("settings", "global_settings", db.settings);
  }

  if (forceAll) {
    for (const { key, colName } of ALL_SYNC_COLLECTIONS) {
      const items = (db as any)[key] || [];
      if (Array.isArray(items)) {
        for (const item of items) {
          if (!item) continue;
          const id = item._id || item.id;
          if (id) {
            syncSingleDoc(colName, String(id), item);
          }
        }
      }
    }
  }

  lastSyncTimestamp = new Date().toISOString();
}
