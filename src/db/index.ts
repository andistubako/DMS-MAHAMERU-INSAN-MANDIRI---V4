import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

// Cloud SQL configuration via Unix socket or TCP
const pool = new Pool({
  user: process.env.SQL_USER || 'ai_studio_app_user',
  password: process.env.SQL_PASSWORD || '',
  database: process.env.SQL_DB_NAME || 'cloud_sql_development_database',
  host: process.env.SQL_HOST || '/app/cloudsql/grounded-pixel-zdtd0:asia-southeast1:ai-studio-10b64a83',
  port: Number(process.env.SQL_PORT) || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[Cloud SQL Pool Error]:', err);
});

export const db = drizzle(pool, { schema });
export { pool };
