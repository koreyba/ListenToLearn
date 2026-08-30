import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  canonicalTraceJson,
  createAiChatToolExecutor,
  createAiChatToolTraceRepository,
  sha256Hex,
} from "../lib/ai-chat/tool-trace.ts";
import { createVocabularyMutationPlanner } from "../lib/vocabulary/mutations.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

class SQLiteD1Statement {
  constructor(database, sql, bindings = [], hooks = null) {
    this.database = database;
    this.sql = sql;
    this.bindings = bindings;
    this.hooks = hooks;
  }

  bind(...bindings) {
    return new SQLiteD1Statement(this.database, this.sql, bindings, this.hooks);
  }

  execute() {
    const statement = this.database.prepare(this.sql);
    if (statement.columns().length > 0) {
      return { results: statement.all(...this.bindings), success: true, meta: {} };
    }
    const result = statement.run(...this.bindings);
    return {
      results: [],
      success: true,
      meta: { changes: Number(result.changes) },
    };
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
    const result = this.execute();
    if (this.hooks?.throwAfterNextRunCommit) {
      this.hooks.throwAfterNextRunCommit = false;
      throw new Error("Simulated ambiguous response after D1 statement commit.");
    }
    return result;
  }
}

class SQLiteD1Database {
  constructor(database) {
    this.database = database;
    this.throwBeforeNextBatch = false;
    this.throwAfterNextBatchCommit = false;
    this.throwAfterNextRunCommit = false;
  }

  prepare(sql) {
    return new SQLiteD1Statement(this.database, sql, [], this);
  }

  async batch(statements) {
    if (this.throwBeforeNextBatch) {
      this.throwBeforeNextBatch = false;
      throw new Error("Simulated transient D1 failure before execution.");
    }
    this.database.exec("BEGIN IMMEDIATE");
    let results;
    try {
      results = statements.map((statement) => statement.execute());
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    if (this.throwAfterNextBatchCommit) {
      this.throwAfterNextBatchCommit = false;
      throw new Error("Simulated ambiguous response after D1 commit.");
    }
    return results;
  }
}

function applyMigrations(sqlite) {
  for (const migration of readdirSync(join(root, "drizzle"))
    .filter((name) => /^\d{4}_.+\.sql$/u.test(name))
    .sort()) {
    sqlite.exec(readFileSync(join(root, "drizzle", migration), "utf8"));
  }
}

function createFixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  applyMigrations(sqlite);
  sqlite.exec(`
    INSERT INTO users (id, email, display_name, created_at, updated_at) VALUES
      ('user-a', 'a@example.com', 'A', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'),
      ('user-b', 'b@example.com', 'B', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z');
    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status,
      created_at, updated_at
    ) VALUES (
      'phrase-run', 'run', '', 'бежать', 'run every day', 'preset', NULL, 'pick',
      '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'
    );
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
    VALUES ('user-a', 'phrase-run', 'learning_now',
      '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z');
    INSERT INTO ai_chats (id, user_id, title, explanation_language, created_at, updated_at)
    VALUES ('chat-a', 'user-a', '', 'ru', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z');
    INSERT INTO ai_chat_messages (
      id, chat_id, role, sequence, content, status, practice_context_json,
      client_message_id, created_at, updated_at
    ) VALUES
      ('user-message', 'chat-a', 'user', 1,
       'Добавь слово uncanny — странный.', 'complete', '[]', 'client-a',
       '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'),
      ('assistant-message', 'chat-a', 'assistant', 2, '', 'pending', '[]', 'client-a',
       '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z');
    INSERT INTO ai_chat_assistant_attempts (
      id, user_id, chat_id, user_message_id, assistant_message_id,
      attempt_number, status, lease_expires_at, created_at, updated_at
    ) VALUES (
      'attempt-1', 'user-a', 'chat-a', 'user-message', 'assistant-message',
      1, 'pending', '2026-08-29T10:05:00Z',
      '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'
    );
  `);
  const database = new SQLiteD1Database(sqlite);
  let id = 0;
  const options = {
    createId: (kind) => `${kind}-${++id}`,
    now: () => `2026-08-29T10:00:${String(id).padStart(2, "0")}Z`,
  };
  const trace = createAiChatToolTraceRepository(database, options);
  const planner = createVocabularyMutationPlanner(database, options);
  const context = {
    userId: "user-a",
    chatId: "chat-a",
    userMessageId: "user-message",
    assistantMessageId: "assistant-message",
    attemptId: "attempt-1",
  };
  return {
    context,
    database,
    executor: createAiChatToolExecutor(trace, context),
    planner,
    sqlite,
    trace,
  };
}

function replaceAttempt(fixture, ordinal) {
  fixture.sqlite.prepare(`
    UPDATE ai_chat_assistant_attempts
    SET status = 'expired', completed_at = '2026-08-29T10:01:00Z'
    WHERE status = 'pending'
  `).run();
  const id = `attempt-${ordinal}`;
  fixture.sqlite.prepare(`
    INSERT INTO ai_chat_assistant_attempts (
      id, user_id, chat_id, user_message_id, assistant_message_id,
      attempt_number, status, lease_expires_at, created_at, updated_at
    ) VALUES (?, 'user-a', 'chat-a', 'user-message', 'assistant-message', ?,
      'pending', '2026-08-29T10:05:00Z',
      '2026-08-29T10:01:00Z', '2026-08-29T10:01:00Z')
  `).run(id, ordinal);
  const context = { ...fixture.context, attemptId: id };
  return {
    context,
    executor: createAiChatToolExecutor(fixture.trace, context),
  };
}

test("canonical trace JSON is stable across object insertion order", () => {
  assert.equal(
    canonicalTraceJson({ zebra: 1, alpha: { two: 2, one: 1 } }),
    canonicalTraceJson({ alpha: { one: 1, two: 2 }, zebra: 1 }),
  );
  assert.equal(
    canonicalTraceJson({ zebra: 1, alpha: { two: 2, one: 1 } }),
    '{"alpha":{"one":1,"two":2},"zebra":1}',
  );
});

async function executeAdd(executor, planner, providerToolCallId, input) {
  return executor.execute({
    providerToolCallId,
    toolName: "add_vocabulary_entry",
    args: input,
    run: async (scope) => scope.commitMutation(
      await planner.planAddEntry("user-a", input),
    ),
  });
}

async function proposeEntries(executor, planner, providerToolCallId, entries) {
  return executor.execute({
    providerToolCallId,
    toolName: "propose_vocabulary_entries",
    args: { entries },
    run: async (scope) => {
      const plan = await planner.planAddEntries("user-a", { entries });
      return scope.proposeMutation(plan, {
        operation: "add_vocabulary_entries",
        items: plan.canonicalArgs.entries.map((entry, index) => ({
          id: `entry-${index + 1}`,
          ...entry,
        })),
      });
    },
  });
}

test("a proposal tool stores approval input without mutating vocabulary", async () => {
  const fixture = createFixture();
  const result = await proposeEntries(
    fixture.executor,
    fixture.planner,
    "proposal-1",
    [
      { text: "uncanny", translation: "странный" },
      { text: "break even", translation: "окупаться" },
    ],
  );

  assert.deepEqual(result, {
    ok: true,
    proposed: true,
    approvalRequired: true,
    proposalId: "proposal-6",
  });
  assert.equal(fixture.sqlite.prepare(`
    SELECT count(*) AS count FROM phrases
    WHERE text IN ('uncanny', 'break even') COLLATE NOCASE
  `).get().count, 0);
  assert.deepEqual({ ...fixture.sqlite.prepare(`
    SELECT operation, target_key, status, mutation_input_json, public_json
    FROM ai_chat_vocabulary_write_proposals
  `).get() }, {
    operation: "vocabulary.add-entries/v1",
    target_key: "entries",
    status: "pending",
    mutation_input_json: JSON.stringify({
      args: { entries: [
        { text: "uncanny", translation: "странный" },
        { text: "break even", translation: "окупаться" },
      ] },
      result: {
        entries: [
          { state: "added", text: "uncanny" },
          { state: "added", text: "break even" },
        ],
        ok: true,
        saved: true,
      },
    }),
    public_json: JSON.stringify({
      items: [
        { id: "entry-1", text: "uncanny", translation: "странный" },
        { id: "entry-2", text: "break even", translation: "окупаться" },
      ],
      operation: "add_vocabulary_entries",
    }),
  });
  assert.deepEqual({ ...fixture.sqlite.prepare(`
    SELECT status, receipt_id FROM ai_chat_tool_calls
    WHERE provider_tool_call_id = 'proposal-1'
  `).get() }, { status: "succeeded", receipt_id: null });
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_mutation_receipts",
  ).get().count, 0);
});

test("proposal retries reuse equal canonical input and reject changed input", async () => {
  const fixture = createFixture();
  const first = await proposeEntries(
    fixture.executor,
    fixture.planner,
    "proposal-first",
    [{ text: "uncanny", translation: "странный" }],
  );
  const same = await proposeEntries(
    fixture.executor,
    fixture.planner,
    "proposal-same",
    [{ text: "uncanny", translation: "странный" }],
  );
  const changed = await proposeEntries(
    fixture.executor,
    fixture.planner,
    "proposal-changed",
    [{ text: "uncanny", translation: "зловещий" }],
  );

  assert.deepEqual(same, first);
  assert.deepEqual(changed, { ok: false, error: "mutation_conflict" });
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_vocabulary_write_proposals",
  ).get().count, 1);
  assert.deepEqual(fixture.sqlite.prepare(`
    SELECT provider_tool_call_id, status, error_code
    FROM ai_chat_tool_calls
    WHERE provider_tool_call_id LIKE 'proposal-%'
    ORDER BY provider_tool_call_id
  `).all().map((row) => ({ ...row })), [
    { provider_tool_call_id: "proposal-changed", status: "rejected", error_code: "mutation_conflict" },
    { provider_tool_call_id: "proposal-first", status: "succeeded", error_code: null },
    { provider_tool_call_id: "proposal-same", status: "succeeded", error_code: null },
  ]);
});

test("every read and policy rejection leaves a bounded invocation record", async () => {
  const fixture = createFixture();
  assert.deepEqual(await fixture.executor.execute({
    providerToolCallId: "read-1",
    toolName: "list_vocabulary",
    args: { limit: 5 },
    run: async () => ({ ok: true, entries: [{ text: "run" }] }),
  }), { ok: true, entries: [{ text: "run" }] });
  assert.deepEqual(await fixture.executor.execute({
    providerToolCallId: "write-denied-1",
    toolName: "add_vocabulary_entry",
    args: { text: "uncanny" },
    run: async () => ({ ok: false, error: "explicit_user_command_required" }),
  }), { ok: false, error: "explicit_user_command_required" });

  assert.deepEqual(fixture.sqlite.prepare(`
    SELECT provider_tool_call_id, status, error_code
    FROM ai_chat_tool_calls ORDER BY created_at, provider_tool_call_id
  `).all().map((row) => ({ ...row })), [{
    provider_tool_call_id: "read-1",
    status: "succeeded",
    error_code: null,
  }, {
    provider_tool_call_id: "write-denied-1",
    status: "rejected",
    error_code: "explicit_user_command_required",
  }]);
});

test("an ambiguous begin-call commit is recovered and the terminal result replays", async () => {
  const fixture = createFixture();
  fixture.database.throwAfterNextRunCommit = true;
  let runs = 0;
  const invocation = {
    providerToolCallId: "read-ambiguous-begin",
    toolName: "list_vocabulary",
    args: { limit: 5 },
    run: async () => {
      runs += 1;
      return { ok: true, entries: [{ text: "run" }] };
    },
  };

  const first = await fixture.executor.execute(invocation);
  const replay = await fixture.executor.execute(invocation);

  assert.deepEqual(first, { ok: true, entries: [{ text: "run" }] });
  assert.deepEqual(replay, first);
  assert.equal(runs, 1);
  assert.deepEqual({ ...fixture.sqlite.prepare(`
    SELECT status, error_code
    FROM ai_chat_tool_calls
    WHERE provider_tool_call_id = 'read-ambiguous-begin'
  `).get() }, { status: "succeeded", error_code: null });
});

test("ambiguous begin-call recovery never adopts a generated-id collision", async () => {
  const fixture = createFixture();
  const args = { limit: 5 };
  const argsJson = canonicalTraceJson(args);
  const argsSha256 = await sha256Hex(argsJson);
  fixture.sqlite.prepare(`
    INSERT INTO ai_chat_tool_calls (
      id, user_id, chat_id, user_message_id, assistant_attempt_id,
      provider_tool_call_id, tool_name, args_json, args_sha256, status, created_at
    ) VALUES (
      'tool-call-1', 'user-a', 'chat-a', 'user-message', 'attempt-1',
      'different-provider-call', 'list_vocabulary', ?, ?, 'received',
      '2026-08-29T10:00:00Z'
    )
  `).run(argsJson, argsSha256);
  fixture.database.throwAfterNextRunCommit = true;
  let runs = 0;

  const result = await fixture.executor.execute({
    providerToolCallId: "intended-provider-call",
    toolName: "list_vocabulary",
    args,
    run: async () => {
      runs += 1;
      return { ok: true, entries: [] };
    },
  });

  assert.deepEqual(result, { ok: false, error: "tool_call_conflict" });
  assert.equal(runs, 0);
  assert.deepEqual({ ...fixture.sqlite.prepare(`
    SELECT provider_tool_call_id, status
    FROM ai_chat_tool_calls WHERE id = 'tool-call-1'
  `).get() }, {
    provider_tool_call_id: "different-provider-call",
    status: "received",
  });
});

test("a vocabulary mutation, receipt, and terminal call status commit atomically", async () => {
  const fixture = createFixture();
  const result = await executeAdd(
    fixture.executor,
    fixture.planner,
    "write-1",
    { text: "uncanny", translation: "странный" },
  );
  assert.deepEqual(result, { ok: true, saved: true, text: "uncanny" });
  assert.deepEqual({ ...fixture.sqlite.prepare(`
    SELECT phrases.text, phrases.translation, progress.status
    FROM phrases
    JOIN phrase_progress AS progress ON progress.phrase_id = phrases.id
    WHERE phrases.owner_id = 'user-a' AND progress.user_id = 'user-a'
      AND phrases.text = 'uncanny'
  `).get() }, {
    text: "uncanny",
    translation: "",
    status: "to_learn",
  });
  assert.deepEqual({ ...fixture.sqlite.prepare(`
    SELECT translation, normalized_translation, context
    FROM phrase_meanings
    WHERE user_id = 'user-a'
      AND phrase_id = (SELECT id FROM phrases WHERE owner_id = 'user-a' AND text = 'uncanny')
  `).get() }, {
    translation: "странный",
    normalized_translation: "странный",
    context: "",
  });
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_mutation_receipts",
  ).get().count, 1);
  const call = fixture.sqlite.prepare(`
    SELECT status, receipt_id, error_code FROM ai_chat_tool_calls
    WHERE provider_tool_call_id = 'write-1'
  `).get();
  assert.equal(call.status, "committed");
  assert.equal(call.error_code, null);
  assert.match(call.receipt_id, /^receipt-/u);
});

test("a new assistant attempt replays the durable receipt without another mutation", async () => {
  const fixture = createFixture();
  const input = { text: "uncanny", translation: "странный" };
  assert.equal((await executeAdd(fixture.executor, fixture.planner, "write-1", input)).ok, true);
  const retry = replaceAttempt(fixture, 2);
  const replay = await executeAdd(retry.executor, fixture.planner, "write-2", input);
  assert.deepEqual(replay, { ok: true, saved: true, text: "uncanny" });
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_mutation_receipts",
  ).get().count, 1);
  assert.equal(fixture.sqlite.prepare(`
    SELECT status FROM ai_chat_tool_calls WHERE provider_tool_call_id = 'write-2'
  `).get().status, "replayed");
  assert.equal(fixture.sqlite.prepare(`
    SELECT count(*) AS count FROM phrases
    WHERE owner_id = 'user-a' AND text = 'uncanny' COLLATE NOCASE
  `).get().count, 1);
});

test("the same logical mutation scope rejects different canonical arguments", async () => {
  const fixture = createFixture();
  await executeAdd(
    fixture.executor,
    fixture.planner,
    "write-1",
    { text: "uncanny", translation: "странный" },
  );
  const conflicting = await executeAdd(
    fixture.executor,
    fixture.planner,
    "write-2",
    { text: "uncanny", translation: "зловещий" },
  );
  assert.deepEqual(conflicting, { ok: false, error: "mutation_conflict" });
  assert.equal(fixture.sqlite.prepare(`
    SELECT status FROM ai_chat_tool_calls WHERE provider_tool_call_id = 'write-2'
  `).get().status, "rejected");
});

test("parallel equivalent calls converge on one mutation and one receipt", async () => {
  const fixture = createFixture();
  const input = { text: "serendipity", translation: "счастливая случайность" };
  const [firstPlan, secondPlan] = await Promise.all([
    fixture.planner.planAddEntry("user-a", input),
    fixture.planner.planAddEntry("user-a", input),
  ]);
  const execute = (providerToolCallId, plan) => fixture.executor.execute({
    providerToolCallId,
    toolName: "add_vocabulary_entry",
    args: input,
    run: (scope) => scope.commitMutation(plan),
  });
  const results = await Promise.all([
    execute("parallel-1", firstPlan),
    execute("parallel-2", secondPlan),
  ]);
  assert.deepEqual(results, [
    { ok: true, saved: true, text: "serendipity" },
    { ok: true, saved: true, text: "serendipity" },
  ]);
  assert.equal(fixture.sqlite.prepare(`
    SELECT count(*) AS count FROM phrases
    WHERE owner_id = 'user-a' AND text = 'serendipity' COLLATE NOCASE
  `).get().count, 1);
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_mutation_receipts",
  ).get().count, 1);
  assert.deepEqual(fixture.sqlite.prepare(`
    SELECT status FROM ai_chat_tool_calls
    WHERE provider_tool_call_id IN ('parallel-1', 'parallel-2')
    ORDER BY status
  `).all().map(({ status }) => status), ["committed", "replayed"]);
});

test("a false postcondition rolls back domain statements and rejects the call", async () => {
  const fixture = createFixture();
  const plan = await fixture.planner.planAddEntry("user-a", {
    text: "rollback me",
    translation: "откатить",
  });
  const result = await fixture.executor.execute({
    providerToolCallId: "write-rollback",
    toolName: "add_vocabulary_entry",
    args: plan.canonicalArgs,
    run: (scope) => scope.commitMutation({
      ...plan,
      receiptGuard: { sql: "0 = 1", bindings: [] },
    }),
  });
  assert.deepEqual(result, { ok: false, error: "operation_failed" });
  assert.equal(fixture.sqlite.prepare(`
    SELECT count(*) AS count FROM phrases WHERE text = 'rollback me'
  `).get().count, 0);
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_mutation_receipts",
  ).get().count, 0);
});

test("a stale compare-and-swap is traced as a mutation conflict", async () => {
  const fixture = createFixture();
  fixture.sqlite.exec(`
    INSERT INTO phrase_meanings (
      id, user_id, phrase_id, translation, normalized_translation, context,
      created_at, updated_at
    ) VALUES (
      'meaning-run', 'user-a', 'phrase-run', 'управлять', 'управлять',
      'run a company', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'
    );
  `);
  const plan = await fixture.planner.planUpdateMeaning("user-a", {
    meaningId: "meaning-run",
    phraseId: "phrase-run",
    expectedTranslation: "управлять",
    expectedContext: "run a company",
    translation: "руководить",
  });
  fixture.sqlite.exec(`
    UPDATE phrase_meanings
    SET translation = 'вести', normalized_translation = 'вести'
    WHERE id = 'meaning-run'
  `);

  const result = await fixture.executor.execute({
    providerToolCallId: "write-stale-cas",
    toolName: "update_vocabulary_meaning",
    args: plan.canonicalArgs,
    run: (scope) => scope.commitMutation(plan),
  });

  assert.deepEqual(result, { ok: false, error: "mutation_conflict" });
  assert.deepEqual({ ...fixture.sqlite.prepare(`
    SELECT status, error_code
    FROM ai_chat_tool_calls
    WHERE provider_tool_call_id = 'write-stale-cas'
  `).get() }, {
    status: "rejected",
    error_code: "mutation_conflict",
  });
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_mutation_receipts",
  ).get().count, 0);
});

test("an ambiguous post-commit D1 error resolves from the durable receipt", async () => {
  const fixture = createFixture();
  fixture.database.throwAfterNextBatchCommit = true;
  const result = await executeAdd(
    fixture.executor,
    fixture.planner,
    "write-ambiguous",
    { text: "break even", translation: "окупаться" },
  );
  assert.deepEqual(result, { ok: true, saved: true, text: "break even" });
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_mutation_receipts",
  ).get().count, 1);
  assert.equal(fixture.sqlite.prepare(`
    SELECT status FROM ai_chat_tool_calls
    WHERE provider_tool_call_id = 'write-ambiguous'
  `).get().status, "committed");
});

test("a transient pre-execution D1 failure fails closed for a fresh turn retry", async () => {
  const fixture = createFixture();
  fixture.database.throwBeforeNextBatch = true;
  const result = await executeAdd(
    fixture.executor,
    fixture.planner,
    "write-transient",
    { text: "make ends meet", translation: "сводить концы с концами" },
  );
  assert.deepEqual(result, { ok: false, error: "operation_failed" });
  assert.equal(fixture.sqlite.prepare(`
    SELECT count(*) AS count FROM phrases WHERE text = 'make ends meet'
  `).get().count, 0);
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_mutation_receipts",
  ).get().count, 0);
  assert.deepEqual({ ...fixture.sqlite.prepare(`
    SELECT status, error_code FROM ai_chat_tool_calls
    WHERE provider_tool_call_id = 'write-transient'
  `).get() }, {
    status: "failed",
    error_code: "operation_failed",
  });
});

test("a stale or foreign attempt cannot create a call or mutate vocabulary", async () => {
  const fixture = createFixture();
  fixture.sqlite.prepare(`
    UPDATE ai_chat_assistant_attempts SET status = 'expired' WHERE id = 'attempt-1'
  `).run();
  assert.deepEqual(await executeAdd(
    fixture.executor,
    fixture.planner,
    "write-stale",
    { text: "forbidden", translation: "запрещённый" },
  ), { ok: false, error: "stale_attempt" });

  const foreignContext = { ...fixture.context, userId: "user-b" };
  const foreignExecutor = createAiChatToolExecutor(fixture.trace, foreignContext);
  assert.deepEqual(await executeAdd(
    foreignExecutor,
    fixture.planner,
    "write-foreign",
    { text: "foreign", translation: "чужой" },
  ), { ok: false, error: "stale_attempt" });
  assert.equal(fixture.sqlite.prepare(`
    SELECT count(*) AS count FROM phrases
    WHERE text IN ('forbidden', 'foreign')
  `).get().count, 0);
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_calls",
  ).get().count, 0);
});
