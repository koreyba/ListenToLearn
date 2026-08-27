import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().default(""),
  displayName: text("display_name").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const appSessions = sqliteTable("app_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => [
  index("idx_app_sessions_user").on(table.userId),
  index("idx_app_sessions_expires").on(table.expiresAt),
]);

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

export const catalogPhraseAnalysis = sqliteTable("catalog_phrase_analysis", {
  phraseId: text("phrase_id").primaryKey().references(() => phrases.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  rank: integer("rank").notNull(),
  pattern: text("pattern").notNull(),
  ipa: text("ipa").notNull(),
  searchQuery: text("search_query").notNull(),
  alternateQuery: text("alternate_query"),
  active: integer("active").notNull().default(1),
}, (table) => [
  index("idx_catalog_analysis_active_kind_rank").on(table.active, table.kind, table.rank),
]);

export const phraseMechanisms = sqliteTable("phrase_mechanisms", {
  phraseId: text("phrase_id").notNull().references(() => phrases.id, { onDelete: "cascade" }),
  mechanism: text("mechanism").notNull(),
  displayOrder: integer("display_order").notNull(),
}, (table) => [
  primaryKey({ columns: [table.phraseId, table.mechanism] }),
  index("idx_phrase_mechanisms_mechanism_phrase").on(table.mechanism, table.phraseId),
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

export const savedVideos = sqliteTable("saved_videos", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  youtubeVideoId: text("youtube_video_id").notNull(),
  originPhraseId: text("origin_phrase_id").references(() => phrases.id, { onDelete: "set null" }),
  originQuery: text("origin_query").notNull().default(""),
  restoreQuery: text("restore_query").notNull().default(""),
  restoreAnchorSeconds: real("restore_anchor_seconds").notNull().default(-1),
  originCaption: text("origin_caption").notNull().default(""),
  language: text("language").notNull().default("english"),
  accent: text("accent").notNull().default(""),
  resumeSeconds: real("resume_seconds").notNull().default(0),
  resumeCaptionId: text("resume_caption_id").notNull().default(""),
  resumeCaptionText: text("resume_caption_text").notNull().default(""),
  progressUpdatedAt: text("progress_updated_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_saved_videos_user_youtube")
    .on(table.userId, table.youtubeVideoId),
  index("idx_saved_videos_user_updated")
    .on(table.userId, table.updatedAt),
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
