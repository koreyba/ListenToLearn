import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const phrases = sqliteTable("phrases", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  pattern: text("pattern").notNull(),
  ipa: text("ipa").notNull().default(""),
  translation: text("translation").notNull().default(""),
  sourceType: text("source_type").notNull(),
  catalogOrder: integer("catalog_order"),
  status: text("status").notNull().default("pick"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const phraseExamples = sqliteTable("phrase_examples", {
  id: text("id").primaryKey(),
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
    .on(table.phraseId, table.provider, table.externalId),
]);
