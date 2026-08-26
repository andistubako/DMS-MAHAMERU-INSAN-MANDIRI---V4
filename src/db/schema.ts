import { pgTable, text, timestamp, jsonb, primaryKey } from 'drizzle-orm/pg-core';

export const appDocuments = pgTable('app_documents', {
  collection: text('collection').notNull(),
  id: text('id').notNull(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.collection, table.id] }),
]);
