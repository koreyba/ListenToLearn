import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";

import * as schema from "../db/schema.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "drizzle");
const toolTraceModule = await import("../lib/ai-chat/tool-trace.ts").catch(() => ({}));

class SQLiteD1Statement {
  constructor(database, sql, bindings = []) {
    this.database = database;
    this.sql = sql;
    this.bindings = bindings;
  }

  bind(...bindings) {
    return new SQLiteD1Statement(this.database, this.sql, bindings);
  }

  execute() {
    const statement = this.database.prepare(this.sql);
    if (statement.columns().length > 0) {
      return { results: statement.all(...this.bindings), success: true, meta: {} };
    }
    const result = statement.run(...this.bindings);
    return { results: [], success: true, meta: { changes: Number(result.changes) } };
  }

  async first() {
    return this.database.prepare(this.sql).get(...this.bindings) || null;
  }

  async all() {
    return {
      results: this.database.prepare(this.sql).all(...this.bindings),
      success: true,
      meta: {},
    };
  }

  async run() {
    return this.execute();
  }
}

class SQLiteD1Database {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new SQLiteD1Statement(this.database, sql);
  }

  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => statement.execute());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

function migrationNames() {
  return readdirSync(migrationsDir)
    .filter((name) => /^\d{4}_.+\.sql$/u.test(name))
    .sort();
}

function traceMigrationName() {
  const matches = migrationNames().filter((name) => name.startsWith("0018_"));
  assert.equal(matches.length, 1, "exactly one append-only 0018 migration is required");
  return matches[0];
}

function applyMigrations(database) {
  for (const name of migrationNames()) {
    database.exec(readFileSync(join(migrationsDir, name), "utf8"));
  }
}

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
      column: reference.columns[0].name,
      foreignTable: getTableName(reference.foreignTable),
      onDelete: foreignKey.onDelete,
    };
  }).sort((left, right) => left.column.localeCompare(right.column));
}

function assertRequiredColumns(config, names) {
  const columns = columnMap(config);
  for (const name of names) {
    assert.ok(columns.has(name), `${config.name} must contain ${name}`);
    assert.equal(columns.get(name).notNull, true, `${config.name}.${name} must be required`);
  }
}

function createTraceFixture() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  applyMigrations(database);
  database.exec(`
    INSERT INTO users (id, email, display_name, created_at, updated_at)
    VALUES ('user-1', '', '', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z');
    INSERT INTO ai_chats (id, user_id, title, explanation_language, created_at, updated_at)
    VALUES ('chat-1', 'user-1', '', 'ru', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z');
    INSERT INTO ai_chat_messages (
      id, chat_id, role, sequence, content, status, practice_context_json,
      client_message_id, created_at, updated_at
    ) VALUES
      ('user-message-1', 'chat-1', 'user', 1, 'Добавь слово run.', 'complete', '[]',
       'client-1', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'),
      ('assistant-message-1', 'chat-1', 'assistant', 2, '', 'pending', '[]',
       'client-1', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z');
  `);
  return database;
}

function createTraceRepositoryFixture() {
  const sqlite = createTraceFixture();
  insertAttempt(sqlite);
  const database = new SQLiteD1Database(sqlite);
  let currentTime = "2026-08-29T10:00:30Z";
  let id = 0;
  const trace = toolTraceModule.createAiChatToolTraceRepository(database, {
    createId: (kind) => `${kind}-runtime-${++id}`,
    now: () => currentTime,
  });
  const context = {
    userId: "user-1",
    chatId: "chat-1",
    userMessageId: "user-message-1",
    assistantMessageId: "assistant-message-1",
    attemptId: "attempt-1",
  };
  return {
    context,
    database,
    setNow(value) { currentTime = value; },
    sqlite,
    trace,
  };
}

function insertAttempt(database, {
  id = "attempt-1",
  attemptNumber = 1,
  status = "pending",
  usageJson = null,
} = {}) {
  database.prepare(`
    INSERT INTO ai_chat_assistant_attempts (
      id, user_id, chat_id, user_message_id, assistant_message_id, attempt_number,
      status, lease_expires_at, provider, model, usage_json, error_code,
      created_at, updated_at, completed_at
    ) VALUES (?, 'user-1', 'chat-1', 'user-message-1', 'assistant-message-1', ?, ?,
      '2026-08-29T10:01:00Z', NULL, NULL, ?, NULL,
      '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z', NULL)
  `).run(id, attemptNumber, status, usageJson);
}

function insertReceipt(database, {
  id = "receipt-1",
  attemptId = "attempt-1",
  targetKey = "run",
  argsJson = '{"text":"run"}',
  argsSha256 = "a".repeat(64),
  resultJson = '{"ok":true,"phraseId":"phrase-1"}',
} = {}) {
  database.prepare(`
    INSERT INTO ai_chat_tool_mutation_receipts (
      id, user_id, chat_id, user_message_id, committed_by_attempt_id,
      provider_tool_call_id, tool_name, operation, target_key,
      args_json, args_sha256, status, result_json, error_code,
      entity_type, entity_id, created_at, completed_at
    ) VALUES (?, 'user-1', 'chat-1', 'user-message-1', ?,
      'provider-call-1', 'add_vocabulary_entry', 'vocabulary.entry.add.v1', ?,
      ?, ?, 'committed', ?, NULL, 'phrase', 'phrase-1',
      '2026-08-29T10:00:00Z', '2026-08-29T10:00:01Z')
  `).run(id, attemptId, targetKey, argsJson, argsSha256, resultJson);
}

function insertToolCall(database, {
  id = "tool-call-1",
  attemptId = "attempt-1",
  providerToolCallId = "provider-call-1",
  receiptId = "receipt-1",
  argsJson = '{"text":"run"}',
  argsSha256 = "a".repeat(64),
  status = "committed",
  resultJson = '{"ok":true,"phraseId":"phrase-1"}',
} = {}) {
  database.prepare(`
    INSERT INTO ai_chat_tool_calls (
      id, user_id, chat_id, user_message_id, assistant_attempt_id,
      provider_tool_call_id, tool_name, args_json, args_sha256, status,
      result_json, error_code, receipt_id, created_at, completed_at
    ) VALUES (?, 'user-1', 'chat-1', 'user-message-1', ?, ?,
      'add_vocabulary_entry', ?, ?, ?, ?, NULL, ?,
      '2026-08-29T10:00:00Z', '2026-08-29T10:00:01Z')
  `).run(
    id,
    attemptId,
    providerToolCallId,
    argsJson,
    argsSha256,
    status,
    resultJson,
    receiptId,
  );
}

test("trace schema models attempts, invocations, and mutation receipts separately", () => {
  const attempts = tableConfig("aiChatAssistantAttempts", "ai_chat_assistant_attempts");
  const receipts = tableConfig(
    "aiChatToolMutationReceipts",
    "ai_chat_tool_mutation_receipts",
  );
  const calls = tableConfig("aiChatToolCalls", "ai_chat_tool_calls");

  assertRequiredColumns(attempts, [
    "id", "user_id", "chat_id", "user_message_id", "assistant_message_id",
    "attempt_number", "status", "lease_expires_at", "created_at", "updated_at",
  ]);
  assertRequiredColumns(receipts, [
    "id", "user_id", "chat_id", "user_message_id", "committed_by_attempt_id",
    "provider_tool_call_id", "tool_name", "operation", "target_key", "args_json",
    "args_sha256", "status", "result_json", "created_at", "completed_at",
  ]);
  assertRequiredColumns(calls, [
    "id", "user_id", "chat_id", "user_message_id", "assistant_attempt_id",
    "provider_tool_call_id", "tool_name", "args_json", "args_sha256", "status",
    "created_at",
  ]);

  assert.deepEqual(indexMap(attempts).get("idx_ai_chat_assistant_attempts_message_number"), {
    columns: ["assistant_message_id", "attempt_number"],
    unique: true,
  });
  assert.deepEqual(indexMap(attempts).get("idx_ai_chat_assistant_attempts_one_pending"), {
    columns: ["assistant_message_id"],
    unique: true,
  });
  assert.deepEqual(indexMap(receipts).get("idx_ai_chat_tool_receipts_message_operation_target"), {
    columns: ["user_message_id", "operation", "target_key"],
    unique: true,
  });
  assert.deepEqual(indexMap(calls).get("idx_ai_chat_tool_calls_attempt_provider_call"), {
    columns: ["assistant_attempt_id", "provider_tool_call_id"],
    unique: true,
  });

  assert.deepEqual(foreignKeys(attempts), [
    { column: "assistant_message_id", foreignTable: "ai_chat_messages", onDelete: "cascade" },
    { column: "chat_id", foreignTable: "ai_chats", onDelete: "cascade" },
    { column: "user_id", foreignTable: "users", onDelete: "cascade" },
    { column: "user_message_id", foreignTable: "ai_chat_messages", onDelete: "cascade" },
  ]);
  assert.equal(foreignKeys(receipts).every((foreignKey) => foreignKey.onDelete === "cascade"), true);
  assert.equal(foreignKeys(calls).every((foreignKey) => foreignKey.onDelete === "cascade"), true);

  for (const [config, checkNames] of [
    [attempts, [
      "ai_chat_assistant_attempts_number_check",
      "ai_chat_assistant_attempts_status_check",
      "ai_chat_assistant_attempts_usage_json_check",
    ]],
    [receipts, [
      "ai_chat_tool_receipts_status_check",
      "ai_chat_tool_receipts_args_json_check",
      "ai_chat_tool_receipts_result_json_check",
      "ai_chat_tool_receipts_args_hash_check",
    ]],
    [calls, [
      "ai_chat_tool_calls_status_check",
      "ai_chat_tool_calls_args_json_check",
      "ai_chat_tool_calls_result_json_check",
      "ai_chat_tool_calls_args_hash_check",
    ]],
  ]) {
    const names = new Set(config.checks.map((entry) => entry.name));
    for (const name of checkNames) assert.ok(names.has(name), `${config.name} must enforce ${name}`);
  }
});

test("0018 is append-only and creates the durable trace ledger", () => {
  const name = traceMigrationName();
  const sql = readFileSync(join(migrationsDir, name), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
    assert.match(statement, /^CREATE (?:TABLE|(?:UNIQUE )?INDEX)\b/iu);
  }
  assert.match(sql, /idx_ai_chat_assistant_attempts_one_pending[\s\S]+WHERE[\s\S]+status[^;]+pending/iu);

  const database = createTraceFixture();
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all().map((row) => row.name);
  for (const table of [
    "ai_chat_assistant_attempts",
    "ai_chat_tool_calls",
    "ai_chat_tool_mutation_receipts",
  ]) {
    assert.ok(tables.includes(table), `${name} must create ${table}`);
  }
});

test("assistant retries create distinct immutable attempt identities with only one pending lease", () => {
  const database = createTraceFixture();
  insertAttempt(database);

  assert.throws(
    () => insertAttempt(database, { id: "attempt-2", attemptNumber: 2 }),
    /UNIQUE constraint failed/u,
  );
  database.exec(`
    UPDATE ai_chat_assistant_attempts
    SET status = 'expired', updated_at = '2026-08-29T10:01:01Z', completed_at = '2026-08-29T10:01:01Z'
    WHERE id = 'attempt-1';
  `);
  insertAttempt(database, { id: "attempt-2", attemptNumber: 2 });
  assert.deepEqual(
    database.prepare(`
      SELECT id, attempt_number AS attemptNumber
      FROM ai_chat_assistant_attempts
      ORDER BY attempt_number
    `).all().map((row) => ({ ...row })),
    [
      { id: "attempt-1", attemptNumber: 1 },
      { id: "attempt-2", attemptNumber: 2 },
    ],
  );
  assert.throws(
    () => insertAttempt(database, { id: "attempt-duplicate-number", attemptNumber: 2, status: "failed" }),
    /UNIQUE constraint failed/u,
  );
  assert.throws(
    () => insertAttempt(database, { id: "attempt-invalid", attemptNumber: 3, status: "unknown" }),
    /CHECK constraint failed/u,
  );
  assert.throws(
    () => insertAttempt(database, { id: "attempt-json", attemptNumber: 3, status: "failed", usageJson: "not-json" }),
    /CHECK constraint failed/u,
  );
  assert.throws(
    () => insertAttempt(database, {
      id: "attempt-large-json",
      attemptNumber: 3,
      status: "failed",
      usageJson: JSON.stringify({ detail: "x".repeat(4_100) }),
    }),
    /CHECK constraint failed/u,
  );
});

test("tool calls and mutation receipts reject duplicate logical executions and malformed payloads", () => {
  const database = createTraceFixture();
  insertAttempt(database);
  insertReceipt(database);
  insertToolCall(database);

  assert.throws(
    () => insertReceipt(database, { id: "receipt-duplicate", targetKey: "run" }),
    /UNIQUE constraint failed/u,
  );
  assert.throws(
    () => insertToolCall(database, { id: "tool-call-duplicate" }),
    /UNIQUE constraint failed/u,
  );
  assert.throws(
    () => insertToolCall(database, {
      id: "tool-call-invalid-json",
      providerToolCallId: "provider-call-invalid-json",
      receiptId: null,
      argsJson: "not-json",
      status: "received",
      resultJson: null,
    }),
    /CHECK constraint failed/u,
  );
  assert.throws(
    () => insertToolCall(database, {
      id: "tool-call-large-json",
      providerToolCallId: "provider-call-large-json",
      receiptId: null,
      argsJson: JSON.stringify({ text: "x".repeat(4_100) }),
      status: "received",
      resultJson: null,
    }),
    /CHECK constraint failed/u,
  );
  assert.throws(
    () => insertReceipt(database, {
      id: "receipt-bad-hash",
      targetKey: "different",
      argsSha256: "not-a-sha256",
    }),
    /CHECK constraint failed/u,
  );
  assert.throws(
    () => insertReceipt(database, {
      id: "receipt-invalid-result",
      targetKey: "invalid-result",
      resultJson: "not-json",
    }),
    /CHECK constraint failed/u,
  );
  assert.throws(
    () => insertToolCall(database, {
      id: "tool-call-large-result",
      providerToolCallId: "provider-call-large-result",
      receiptId: null,
      status: "failed",
      resultJson: JSON.stringify({ detail: "x".repeat(8_200) }),
    }),
    /CHECK constraint failed/u,
  );
});

test("a committed mutation receipt survives an assistant retry and can be replayed", () => {
  const database = createTraceFixture();
  insertAttempt(database);
  insertReceipt(database);
  insertToolCall(database);

  database.exec(`
    UPDATE ai_chat_assistant_attempts
    SET status = 'expired', updated_at = '2026-08-29T10:01:01Z', completed_at = '2026-08-29T10:01:01Z'
    WHERE id = 'attempt-1';
  `);
  insertAttempt(database, { id: "attempt-2", attemptNumber: 2 });

  assert.throws(
    () => insertReceipt(database, {
      id: "receipt-retry",
      attemptId: "attempt-2",
    }),
    /UNIQUE constraint failed/u,
  );
  insertToolCall(database, {
    id: "tool-call-replayed",
    attemptId: "attempt-2",
    status: "replayed",
  });

  assert.equal(
    database.prepare("SELECT count(*) AS count FROM ai_chat_tool_mutation_receipts").get().count,
    1,
  );
  assert.deepEqual(
    database.prepare(`
      SELECT status, receipt_id AS receiptId
      FROM ai_chat_tool_calls
      ORDER BY created_at, id
    `).all().map((row) => ({ ...row })),
    [
      { status: "committed", receiptId: "receipt-1" },
      { status: "replayed", receiptId: "receipt-1" },
    ],
  );
});

test("deleting a chat cascades its attempts, calls, and receipts", () => {
  const database = createTraceFixture();
  insertAttempt(database);
  insertReceipt(database);
  insertToolCall(database);

  database.exec("DELETE FROM ai_chats WHERE id = 'chat-1'");
  for (const table of [
    "ai_chat_assistant_attempts",
    "ai_chat_tool_calls",
    "ai_chat_tool_mutation_receipts",
  ]) {
    assert.equal(database.prepare(`SELECT count(*) AS count FROM ${table}`).get().count, 0);
  }
});

test("tool trace executor exposes durable attempt, invocation, and receipt operations", () => {
  assert.equal(
    typeof toolTraceModule.createAiChatToolTraceRepository,
    "function",
    "lib/ai-chat/tool-trace.ts must export createAiChatToolTraceRepository",
  );
});

test("an expired pending lease cannot begin a tool invocation", async () => {
  const fixture = createTraceRepositoryFixture();
  fixture.setNow("2026-08-29T10:01:00Z");
  const executor = toolTraceModule.createAiChatToolExecutor(
    fixture.trace,
    fixture.context,
  );

  const result = await executor.execute({
    providerToolCallId: "expired-before-call",
    toolName: "get_recent_vocabulary",
    args: { limit: 5 },
    run: async () => ({ ok: true, entries: [] }),
  });

  assert.deepEqual(result, { ok: false, error: "stale_attempt" });
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_calls",
  ).get().count, 0);
});

test("a tool result cannot finish after its attempt lease expires", async () => {
  const fixture = createTraceRepositoryFixture();
  const executor = toolTraceModule.createAiChatToolExecutor(
    fixture.trace,
    fixture.context,
  );

  const result = await executor.execute({
    providerToolCallId: "expired-before-finish",
    toolName: "get_recent_vocabulary",
    args: { limit: 5 },
    run: async () => {
      fixture.setNow("2026-08-29T10:01:00Z");
      return { ok: true, entries: [] };
    },
  });

  assert.deepEqual(result, { ok: false, error: "stale_attempt" });
  assert.deepEqual({ ...fixture.sqlite.prepare(`
    SELECT status, error_code FROM ai_chat_tool_calls
    WHERE provider_tool_call_id = 'expired-before-finish'
  `).get() }, { status: "rejected", error_code: "stale_attempt" });
});

test("an expired attempt cannot commit a tool mutation receipt", async () => {
  const fixture = createTraceRepositoryFixture();
  const begun = await fixture.trace.beginCall(fixture.context, {
    providerToolCallId: "expired-before-commit",
    toolName: "test_mutation",
    args: { title: "must-not-commit" },
  });
  fixture.setNow("2026-08-29T10:01:00Z");

  const result = await fixture.trace.commitMutation(fixture.context, begun.call, {
    operation: "test.chat.rename.v1",
    targetKey: "chat-1",
    canonicalArgs: { title: "must-not-commit" },
    canonicalResult: { ok: true },
    entityType: "chat",
    entityId: "chat-1",
    statements: [fixture.database.prepare(`
      UPDATE ai_chats SET title = 'must-not-commit' WHERE id = 'chat-1'
    `)],
    receiptGuard: {
      sql: "EXISTS (SELECT 1 FROM ai_chats WHERE id = ? AND title = ?)",
      bindings: ["chat-1", "must-not-commit"],
    },
  });

  assert.deepEqual(result, { ok: false, error: "stale_attempt" });
  assert.equal(fixture.sqlite.prepare(
    "SELECT title FROM ai_chats WHERE id = 'chat-1'",
  ).get().title, "");
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_mutation_receipts",
  ).get().count, 0);
});

test("receipt replay is fenced when the retry attempt lease has expired", async () => {
  const fixture = createTraceRepositoryFixture();
  const plan = {
    operation: "test.chat.rename.v1",
    targetKey: "chat-1",
    canonicalArgs: { title: "committed-once" },
    canonicalResult: { ok: true },
    entityType: "chat",
    entityId: "chat-1",
    statements: [fixture.database.prepare(`
      UPDATE ai_chats SET title = 'committed-once' WHERE id = 'chat-1'
    `)],
    receiptGuard: {
      sql: "EXISTS (SELECT 1 FROM ai_chats WHERE id = ? AND title = ?)",
      bindings: ["chat-1", "committed-once"],
    },
  };
  const first = await fixture.trace.beginCall(fixture.context, {
    providerToolCallId: "receipt-first",
    toolName: "test_mutation",
    args: plan.canonicalArgs,
  });
  assert.deepEqual(
    await fixture.trace.commitMutation(fixture.context, first.call, plan),
    { ok: true },
  );
  fixture.sqlite.exec(`
    UPDATE ai_chat_assistant_attempts
    SET status = 'expired', completed_at = '2026-08-29T10:01:00Z'
    WHERE id = 'attempt-1';
  `);
  insertAttempt(fixture.sqlite, { id: "attempt-2", attemptNumber: 2 });
  fixture.sqlite.prepare(`
    UPDATE ai_chat_assistant_attempts
    SET lease_expires_at = '2026-08-29T10:02:00Z'
    WHERE id = 'attempt-2'
  `).run();
  const retryContext = { ...fixture.context, attemptId: "attempt-2" };
  fixture.setNow("2026-08-29T10:01:30Z");
  const retry = await fixture.trace.beginCall(retryContext, {
    providerToolCallId: "receipt-retry",
    toolName: "test_mutation",
    args: plan.canonicalArgs,
  });
  fixture.setNow("2026-08-29T10:02:00Z");

  const replay = await fixture.trace.commitMutation(retryContext, retry.call, plan);

  assert.deepEqual(replay, { ok: false, error: "stale_attempt" });
  assert.deepEqual({ ...fixture.sqlite.prepare(`
    SELECT status, error_code FROM ai_chat_tool_calls
    WHERE provider_tool_call_id = 'receipt-retry'
  `).get() }, { status: "rejected", error_code: "stale_attempt" });
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_mutation_receipts",
  ).get().count, 1);
});
