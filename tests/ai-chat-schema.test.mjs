import assert from "node:assert/strict";
import test from "node:test";

import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";

import * as schema from "../db/schema.ts";

function tableConfig(exportName, tableName) {
  const table = schema[exportName];
  assert.ok(table, `db/schema.ts must export ${exportName}`);
  assert.equal(getTableName(table), tableName);
  return getTableConfig(table);
}

function columnMap(config) {
  return new Map(config.columns.map((column) => [column.name, column]));
}

function indexMap(config) {
  return new Map(config.indexes.map((entry) => [entry.config.name, {
    columns: entry.config.columns.map((column) => column.name),
    unique: entry.config.unique,
  }]));
}

function foreignKeys(config) {
  return config.foreignKeys.map((foreignKey) => {
    const reference = foreignKey.reference();
    return {
      columns: reference.columns.map((column) => column.name),
      foreignColumns: reference.foreignColumns.map((column) => column.name),
      foreignTable: getTableName(reference.foreignTable),
      onDelete: foreignKey.onDelete,
    };
  });
}

function assertRequiredColumns(config, names) {
  const columns = columnMap(config);
  for (const name of names) {
    assert.ok(columns.has(name), `${config.name} must contain ${name}`);
    assert.equal(columns.get(name).notNull, true, `${config.name}.${name} must be required`);
  }
}

test("phrase meanings are user-owned and deduplicated per phrase", () => {
  const config = tableConfig("phraseMeanings", "phrase_meanings");
  const columns = columnMap(config);
  const indexes = indexMap(config);

  assertRequiredColumns(config, [
    "id",
    "user_id",
    "phrase_id",
    "translation",
    "normalized_translation",
    "created_at",
    "updated_at",
  ]);
  assert.equal(columns.get("id").primary, true);
  assert.ok(columns.has("context"));
  assert.deepEqual(indexes.get("idx_phrase_meanings_user_phrase_updated"), {
    columns: ["user_id", "phrase_id", "updated_at"],
    unique: false,
  });
  assert.deepEqual(indexes.get("idx_phrase_meanings_user_phrase_normalized"), {
    columns: ["user_id", "phrase_id", "normalized_translation"],
    unique: true,
  });
  assert.deepEqual(foreignKeys(config), [
    {
      columns: ["user_id"],
      foreignColumns: ["id"],
      foreignTable: "users",
      onDelete: "cascade",
    },
    {
      columns: ["phrase_id"],
      foreignColumns: ["id"],
      foreignTable: "phrases",
      onDelete: "cascade",
    },
  ]);
});

test("AI chats are directly owned by a user and ordered by recent activity", () => {
  const config = tableConfig("aiChats", "ai_chats");
  const columns = columnMap(config);
  const indexes = indexMap(config);

  assertRequiredColumns(config, [
    "id",
    "user_id",
    "title",
    "explanation_language",
    "created_at",
    "updated_at",
  ]);
  assert.equal(columns.get("id").primary, true);
  assert.equal(columns.get("explanation_language").default, "ru");
  assert.deepEqual(indexes.get("idx_ai_chats_user_updated"), {
    columns: ["user_id", "updated_at"],
    unique: false,
  });
  assert.deepEqual(foreignKeys(config), [{
    columns: ["user_id"],
    foreignColumns: ["id"],
    foreignTable: "users",
    onDelete: "cascade",
  }]);
});

test("practice items preserve text and selected-meaning snapshots", () => {
  const config = tableConfig("aiChatPracticeItems", "ai_chat_practice_items");
  const columns = columnMap(config);
  const indexes = indexMap(config);

  assertRequiredColumns(config, [
    "id",
    "chat_id",
    "text_snapshot",
    "meaning_mode",
    "selected_meaning_snapshot",
    "created_at",
    "updated_at",
  ]);
  assert.equal(columns.get("id").primary, true);
  assert.equal(columns.get("phrase_id").notNull, false);
  assert.equal(columns.get("selected_meaning_id").notNull, false);
  assert.deepEqual(indexes.get("idx_ai_chat_practice_items_chat_created"), {
    columns: ["chat_id", "created_at"],
    unique: false,
  });
  assert.deepEqual(foreignKeys(config), [
    {
      columns: ["chat_id"],
      foreignColumns: ["id"],
      foreignTable: "ai_chats",
      onDelete: "cascade",
    },
    {
      columns: ["phrase_id"],
      foreignColumns: ["id"],
      foreignTable: "phrases",
      onDelete: "set null",
    },
    {
      columns: ["selected_meaning_id"],
      foreignColumns: ["id"],
      foreignTable: "phrase_meanings",
      onDelete: "set null",
    },
  ]);
  assert.ok(config.checks.some((entry) => entry.name === "ai_chat_practice_items_meaning_mode_check"));
});

test("AI messages enforce sequence ordering and request idempotency", () => {
  const config = tableConfig("aiChatMessages", "ai_chat_messages");
  const columns = columnMap(config);
  const indexes = indexMap(config);

  assertRequiredColumns(config, [
    "id",
    "chat_id",
    "role",
    "sequence",
    "content",
    "status",
    "practice_context_json",
    "client_message_id",
    "created_at",
    "updated_at",
  ]);
  for (const optionalName of ["provider", "model", "usage_json", "error_code"]) {
    assert.equal(columns.get(optionalName).notNull, false, `${optionalName} must support pending messages`);
  }
  assert.deepEqual(indexes.get("idx_ai_chat_messages_chat_sequence"), {
    columns: ["chat_id", "sequence"],
    unique: false,
  });
  assert.deepEqual(indexes.get("idx_ai_chat_messages_chat_sequence_unique"), {
    columns: ["chat_id", "sequence"],
    unique: true,
  });
  assert.deepEqual(indexes.get("idx_ai_chat_messages_chat_client_role"), {
    columns: ["chat_id", "client_message_id", "role"],
    unique: true,
  });
  assert.deepEqual(foreignKeys(config), [{
    columns: ["chat_id"],
    foreignColumns: ["id"],
    foreignTable: "ai_chats",
    onDelete: "cascade",
  }]);
  assert.ok(config.checks.some((entry) => entry.name === "ai_chat_messages_role_check"));
  assert.ok(config.checks.some((entry) => entry.name === "ai_chat_messages_status_check"));
});
