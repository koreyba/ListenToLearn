import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().default(""),
  displayName: text("display_name").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const phrases = sqliteTable("phrases", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  pattern: text("pattern").notNull(),
  ipa: text("ipa").notNull().default(""),
  translation: text("translation").notNull().default(""),
  context: text("context").notNull().default(""),
  sourceType: text("source_type").notNull(),
  catalogOrder: integer("catalog_order"),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pick"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_phrases_source_catalog").on(table.sourceType, table.catalogOrder),
  index("idx_phrases_owner_updated").on(table.ownerId, table.updatedAt),
  index("idx_phrases_text_nocase").on(sql`${table.text} COLLATE NOCASE`),
]);

export const phraseProgress = sqliteTable("phrase_progress", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phraseId: text("phrase_id").notNull().references(() => phrases.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pick"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.phraseId] }),
  index("idx_phrase_progress_phrase_user").on(table.phraseId, table.userId),
]);

export const phraseExamples = sqliteTable("phrase_examples", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phraseId: text("phrase_id").notNull().references(() => phrases.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  query: text("query").notNull(),
  caption: text("caption").notNull().default(""),
  accent: text("accent").notNull().default(""),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("idx_phrase_examples_phrase_provider_external")
    .on(table.userId, table.phraseId, table.provider, table.externalId),
  index("idx_phrase_examples_user_phrase_created")
    .on(table.userId, table.phraseId, table.createdAt),
]);

export const integrationSecrets = sqliteTable("integration_secrets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  encryptionVersion: integer("encryption_version").notNull().default(2),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_integration_secrets_user_provider")
    .on(table.userId, table.provider),
]);
