import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
