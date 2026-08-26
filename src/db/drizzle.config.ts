import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    user: process.env.SQL_USER || 'ai_studio_app_user',
    password: process.env.SQL_PASSWORD || '',
    database: process.env.SQL_DB_NAME || 'cloud_sql_development_database',
    host: process.env.SQL_HOST || '/app/cloudsql/grounded-pixel-zdtd0:asia-southeast1:ai-studio-10b64a83',
    port: Number(process.env.SQL_PORT) || 5432,
    ssl: false,
  },
});
