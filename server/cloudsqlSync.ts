import { pool, sqlDb } from "../src/db/index.js";
import { db } from "./data.js";
import { ALL_SYNC_COLLECTIONS } from "./firestoreSync.js";

let isCloudSqlConnected = false;
let lastCloudSqlSyncTimestamp: string | null = null;
let lastCloudSqlSyncStatus: "SUCCESS" | "SYNCING" | "ERROR" | "IDLE" = "IDLE";
let lastCloudSqlError: string | null = null;

// Initialize PostgreSQL tables automatically
export async function initializeCloudSqlTables(): Promise<boolean> {
  if (!process.env.SQL_HOST || !process.env.SQL_USER) {
    console.log("[Cloud SQL] Missing SQL_HOST/SQL_USER credentials.");
    return false;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          role TEXT NOT NULL,
          status TEXT DEFAULT 'ACTIVE',
          phone TEXT,
          password_hash TEXT,
          avatar_url TEXT,
          office_id TEXT,
          area_id TEXT,
          last_login TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS company_profile (
          id TEXT PRIMARY KEY,
          company_name TEXT NOT NULL,
          company_legal_name TEXT,
          company_code TEXT,
          address TEXT,
          phone TEXT,
          email TEXT,
          website TEXT,
          description TEXT,
          logo_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_by TEXT,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS system_settings (
          id TEXT PRIMARY KEY,
          settings_data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_by TEXT
        );

        CREATE TABLE IF NOT EXISTS offices (
          id TEXT PRIMARY KEY,
          office_name TEXT NOT NULL,
          office_code TEXT,
          address TEXT,
          phone TEXT,
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          radius_meters INTEGER DEFAULT 100,
          status TEXT DEFAULT 'ACTIVE',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS provinces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          code TEXT,
          status TEXT DEFAULT 'ACTIVE',
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS regencies (
          id TEXT PRIMARY KEY,
          province_id TEXT,
          name TEXT NOT NULL,
          code TEXT,
          status TEXT DEFAULT 'ACTIVE',
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS districts (
          id TEXT PRIMARY KEY,
          regency_id TEXT,
          name TEXT NOT NULL,
          code TEXT,
          status TEXT DEFAULT 'ACTIVE',
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS villages (
          id TEXT PRIMARY KEY,
          district_id TEXT,
          name TEXT NOT NULL,
          code TEXT,
          status TEXT DEFAULT 'ACTIVE',
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS areas (
          id TEXT PRIMARY KEY,
          area_name TEXT NOT NULL,
          area_code TEXT,
          office_id TEXT,
          regency_id TEXT,
          status TEXT DEFAULT 'ACTIVE',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS channels (
          id TEXT PRIMARY KEY,
          channel_name TEXT NOT NULL,
          channel_code TEXT,
          status TEXT DEFAULT 'ACTIVE',
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS routes (
          id TEXT PRIMARY KEY,
          route_name TEXT NOT NULL,
          route_code TEXT,
          area_id TEXT,
          status TEXT DEFAULT 'ACTIVE',
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          product_name TEXT NOT NULL,
          product_code TEXT,
          category TEXT,
          brand TEXT,
          status TEXT DEFAULT 'ACTIVE',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS skus (
          id TEXT PRIMARY KEY,
          product_id TEXT,
          sku_code TEXT NOT NULL,
          sku_name TEXT NOT NULL,
          barcode TEXT,
          uom TEXT DEFAULT 'PCS',
          pack_size INTEGER DEFAULT 1,
          base_price DOUBLE PRECISION DEFAULT 0,
          status TEXT DEFAULT 'ACTIVE',
          image_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS prices (
          id TEXT PRIMARY KEY,
          sku_id TEXT NOT NULL,
          price_type TEXT DEFAULT 'DEFAULT',
          price_value DOUBLE PRECISION NOT NULL,
          min_qty INTEGER DEFAULT 1,
          channel_id TEXT,
          area_id TEXT,
          status TEXT DEFAULT 'ACTIVE',
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS promos (
          id TEXT PRIMARY KEY,
          promo_name TEXT NOT NULL,
          promo_code TEXT,
          promo_type TEXT,
          discount_percent DOUBLE PRECISION,
          discount_amount DOUBLE PRECISION,
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          status TEXT DEFAULT 'ACTIVE',
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS salesmen (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          salesman_code TEXT,
          sales_type TEXT DEFAULT 'CANVASSER',
          office_id TEXT,
          area_id TEXT,
          supervisor_id TEXT,
          status TEXT DEFAULT 'ACTIVE',
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS open_call_reasons (
          id TEXT PRIMARY KEY,
          reason_code TEXT,
          reason_name TEXT NOT NULL,
          category TEXT,
          status TEXT DEFAULT 'ACTIVE',
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS outlets (
          id TEXT PRIMARY KEY,
          outlet_name TEXT NOT NULL,
          outlet_code TEXT,
          owner_name TEXT,
          phone TEXT,
          address TEXT,
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          area_id TEXT,
          channel_id TEXT,
          credit_limit DOUBLE PRECISION DEFAULT 0,
          payment_term_days INTEGER DEFAULT 0,
          status TEXT DEFAULT 'ACTIVE',
          photo_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS sales_outlets (
          id TEXT PRIMARY KEY,
          salesman_id TEXT NOT NULL,
          outlet_id TEXT NOT NULL,
          visit_day TEXT,
          visit_frequency TEXT DEFAULT 'WEEKLY',
          status TEXT DEFAULT 'ACTIVE',
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS call_plans (
          id TEXT PRIMARY KEY,
          salesman_id TEXT NOT NULL,
          plan_date TEXT NOT NULL,
          status TEXT DEFAULT 'ACTIVE',
          total_outlets INTEGER DEFAULT 0,
          visited_outlets INTEGER DEFAULT 0,
          effective_calls INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS call_plan_items (
          id TEXT PRIMARY KEY,
          call_plan_id TEXT NOT NULL,
          outlet_id TEXT NOT NULL,
          sequence INTEGER DEFAULT 1,
          status TEXT DEFAULT 'PLANNED',
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS attendance (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          date TEXT NOT NULL,
          check_in_time TIMESTAMP,
          check_in_lat DOUBLE PRECISION,
          check_in_lng DOUBLE PRECISION,
          check_in_photo TEXT,
          check_in_distance DOUBLE PRECISION,
          check_out_time TIMESTAMP,
          check_out_lat DOUBLE PRECISION,
          check_out_lng DOUBLE PRECISION,
          check_out_photo TEXT,
          status TEXT DEFAULT 'PRESENT',
          notes TEXT,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS gps_events (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          latitude DOUBLE PRECISION NOT NULL,
          longitude DOUBLE PRECISION NOT NULL,
          accuracy DOUBLE PRECISION,
          battery_level INTEGER,
          event_type TEXT DEFAULT 'HEARTBEAT',
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS visits (
          id TEXT PRIMARY KEY,
          salesman_id TEXT NOT NULL,
          outlet_id TEXT NOT NULL,
          call_plan_id TEXT,
          check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          check_in_lat DOUBLE PRECISION,
          check_in_lng DOUBLE PRECISION,
          check_in_distance DOUBLE PRECISION,
          check_in_photo TEXT,
          check_out_time TIMESTAMP,
          visit_duration_seconds INTEGER,
          is_effective_call BOOLEAN DEFAULT FALSE,
          non_productive_reason_id TEXT,
          notes TEXT,
          status TEXT DEFAULT 'COMPLETED',
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          invoice_number TEXT NOT NULL UNIQUE,
          salesman_id TEXT NOT NULL,
          outlet_id TEXT NOT NULL,
          visit_id TEXT,
          office_id TEXT,
          transaction_type TEXT DEFAULT 'CASH',
          subtotal DOUBLE PRECISION DEFAULT 0,
          discount_amount DOUBLE PRECISION DEFAULT 0,
          tax_amount DOUBLE PRECISION DEFAULT 0,
          total_amount DOUBLE PRECISION DEFAULT 0,
          paid_amount DOUBLE PRECISION DEFAULT 0,
          payment_status TEXT DEFAULT 'UNPAID',
          delivery_status TEXT DEFAULT 'DELIVERED',
          items JSONB NOT NULL,
          invoice_pdf_url TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS inventory (
          id TEXT PRIMARY KEY,
          location_type TEXT NOT NULL,
          location_id TEXT NOT NULL,
          sku_id TEXT NOT NULL,
          stock_on_hand INTEGER DEFAULT 0,
          allocated_stock INTEGER DEFAULT 0,
          available_stock INTEGER DEFAULT 0,
          reorder_level INTEGER DEFAULT 10,
          status TEXT DEFAULT 'ACTIVE',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS stock_movements (
          id TEXT PRIMARY KEY,
          movement_type TEXT NOT NULL,
          source_location_type TEXT,
          source_location_id TEXT,
          dest_location_type TEXT,
          dest_location_id TEXT,
          sku_id TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          reference_id TEXT,
          performed_by TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS stock_handovers (
          id TEXT PRIMARY KEY,
          handover_number TEXT NOT NULL,
          salesman_id TEXT NOT NULL,
          office_id TEXT,
          handover_date TEXT NOT NULL,
          status TEXT DEFAULT 'PENDING',
          items JSONB NOT NULL,
          approved_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS stock_returns (
          id TEXT PRIMARY KEY,
          return_number TEXT NOT NULL,
          salesman_id TEXT NOT NULL,
          office_id TEXT,
          return_date TEXT NOT NULL,
          status TEXT DEFAULT 'PENDING',
          items JSONB NOT NULL,
          approved_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS stock_receivings (
          id TEXT PRIMARY KEY,
          receiving_number TEXT NOT NULL,
          office_id TEXT NOT NULL,
          supplier_name TEXT,
          received_date TEXT NOT NULL,
          items JSONB NOT NULL,
          received_by TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS sales_stock_ledgers (
          id TEXT PRIMARY KEY,
          salesman_id TEXT NOT NULL,
          date TEXT NOT NULL,
          sku_id TEXT NOT NULL,
          initial_stock INTEGER DEFAULT 0,
          loaded_stock INTEGER DEFAULT 0,
          sold_stock INTEGER DEFAULT 0,
          returned_stock INTEGER DEFAULT 0,
          final_stock INTEGER DEFAULT 0,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS targets (
          id TEXT PRIMARY KEY,
          salesman_id TEXT NOT NULL,
          period_month TEXT NOT NULL,
          target_revenue DOUBLE PRECISION DEFAULT 0,
          target_calls INTEGER DEFAULT 0,
          target_effective_calls INTEGER DEFAULT 0,
          target_new_outlets INTEGER DEFAULT 0,
          achieved_revenue DOUBLE PRECISION DEFAULT 0,
          metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          action TEXT NOT NULL,
          module TEXT NOT NULL,
          target_id TEXT,
          details JSONB,
          ip_address TEXT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS dms_document_store (
          collection_name TEXT NOT NULL,
          doc_id TEXT NOT NULL,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (collection_name, doc_id)
        );
      `);
      isCloudSqlConnected = true;
      console.log("[Cloud SQL] PostgreSQL tables successfully verified and initialized.");
      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("[Cloud SQL] Failed to initialize tables:", err?.message || err);
    lastCloudSqlError = err?.message || String(err);
    return false;
  }
}

/**
 * Sync / Migrate all memory data into Cloud SQL PostgreSQL
 */
export async function migrateAllToCloudSql(): Promise<{ success: boolean; totalRecords: number; collectionCounts: Record<string, number>; message: string }> {
  lastCloudSqlSyncStatus = "SYNCING";
  let totalMigrated = 0;
  const counts: Record<string, number> = {};

  try {
    await initializeCloudSqlTables();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const { key, colName } of ALL_SYNC_COLLECTIONS) {
        const records = (db as any)[key];
        if (Array.isArray(records)) {
          counts[colName] = records.length;
          for (const item of records) {
            const docId = String(item._id || item.id || `doc-${Math.random().toString(36).substring(2, 9)}`);
            await client.query(
              `INSERT INTO dms_document_store (collection_name, doc_id, data, updated_at)
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (collection_name, doc_id)
               DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
              [colName, docId, JSON.stringify(item)]
            );
            totalMigrated++;
          }
        }
      }

      // Sync settings & company_profile
      if (db.settings) {
        await client.query(
          `INSERT INTO dms_document_store (collection_name, doc_id, data, updated_at)
           VALUES ('system_settings', 'global', $1, NOW())
           ON CONFLICT (collection_name, doc_id)
           DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
          [JSON.stringify(db.settings)]
        );
      }
      if (db.company_profile) {
        await client.query(
          `INSERT INTO dms_document_store (collection_name, doc_id, data, updated_at)
           VALUES ('company_profile', 'main', $1, NOW())
           ON CONFLICT (collection_name, doc_id)
           DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
          [JSON.stringify(db.company_profile)]
        );
      }

      await client.query("COMMIT");
      lastCloudSqlSyncStatus = "SUCCESS";
      lastCloudSqlSyncTimestamp = new Date().toISOString();
      lastCloudSqlError = null;
      isCloudSqlConnected = true;

      console.log(`[Cloud SQL] Successfully migrated ${totalMigrated} records to Cloud SQL PostgreSQL.`);
      return {
        success: true,
        totalRecords: totalMigrated,
        collectionCounts: counts,
        message: `Migrasi ke Google Cloud SQL (PostgreSQL) berhasil. Total ${totalMigrated} data tersimpan.`,
      };
    } catch (err: any) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    lastCloudSqlSyncStatus = "ERROR";
    lastCloudSqlError = err?.message || String(err);
    console.error("[Cloud SQL] Migration failed:", err);
    return {
      success: false,
      totalRecords: 0,
      collectionCounts: {},
      message: `Gagal migrasi ke Cloud SQL: ${err?.message || err}`,
    };
  }
}

/**
 * Get Cloud SQL Health & Diagnostic Status
 */
export async function getCloudSqlStats() {
  let tableCount = 0;
  let docStoreCount = 0;
  let connected = false;

  try {
    if (process.env.SQL_HOST && process.env.SQL_USER) {
      const res = await pool.query(
        "SELECT count(*) as count FROM information_schema.tables WHERE table_schema = 'public'"
      );
      tableCount = parseInt(res.rows[0]?.count || "0", 10);
      connected = true;

      const docRes = await pool.query("SELECT count(*) as count FROM dms_document_store");
      docStoreCount = parseInt(docRes.rows[0]?.count || "0", 10);
    }
  } catch (e: any) {
    connected = false;
  }

  return {
    databaseEngine: "Google Cloud SQL (PostgreSQL)",
    instanceName: "ai-studio-10b64a83",
    region: "asia-southeast1",
    isConnected: connected,
    tableCount,
    persistedRecords: docStoreCount,
    lastSyncTimestamp: lastCloudSqlSyncTimestamp,
    lastSyncStatus: lastCloudSqlSyncStatus,
    lastSyncError: lastCloudSqlError,
  };
}
