import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { canonicalTraceJson, sha256Hex } from "../lib/ai-chat/tool-trace.ts";
import { createVocabularyMutationPlanner } from "../lib/vocabulary/mutations.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const proposalModule = await import("../lib/ai-chat/write-proposals.ts").catch(() => ({}));

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
    this.throwBeforeNextBatch = false;
    this.throwAfterNextBatchCommit = false;
  }

  prepare(sql) {
    return new SQLiteD1Statement(this.database, sql);
  }

  async batch(statements) {
    if (this.throwBeforeNextBatch) {
      this.throwBeforeNextBatch = false;
      throw new Error("simulated pre-execution failure");
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
      throw new Error("simulated ambiguous post-commit failure");
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
  assert.equal(
    typeof proposalModule.createAiChatWriteProposalRepository,
    "function",
    "createAiChatWriteProposalRepository must be exported",
  );
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  applyMigrations(sqlite);
  sqlite.exec(`
    INSERT INTO users (id, email, display_name, created_at, updated_at) VALUES
      ('user-a', '', '', '2026-08-30T10:00:00Z', '2026-08-30T10:00:00Z'),
      ('user-b', '', '', '2026-08-30T10:00:00Z', '2026-08-30T10:00:00Z');
    INSERT INTO ai_chats (id, user_id, title, explanation_language, created_at, updated_at)
    VALUES ('chat-a', 'user-a', '', 'ru', '2026-08-30T10:00:00Z', '2026-08-30T10:00:00Z');
    INSERT INTO ai_chat_messages (
      id, chat_id, role, sequence, content, status, practice_context_json,
      client_message_id, created_at, updated_at
    ) VALUES
      ('user-message', 'chat-a', 'user', 1, 'add them', 'complete', '[]', 'client-a',
       '2026-08-30T10:00:00Z', '2026-08-30T10:00:00Z'),
      ('assistant-message', 'chat-a', 'assistant', 2, 'I prepared this change.', 'complete', '[]', 'client-a',
       '2026-08-30T10:00:00Z', '2026-08-30T10:00:00Z');
    INSERT INTO ai_chat_assistant_attempts (
      id, user_id, chat_id, user_message_id, assistant_message_id, attempt_number,
      status, lease_expires_at, created_at, updated_at, completed_at
    ) VALUES (
      'attempt-1', 'user-a', 'chat-a', 'user-message', 'assistant-message', 1,
      'complete', '2026-08-30T10:01:00Z', '2026-08-30T10:00:00Z',
      '2026-08-30T10:00:01Z', '2026-08-30T10:00:01Z'
    );
    INSERT INTO ai_chat_tool_calls (
      id, user_id, chat_id, user_message_id, assistant_attempt_id,
      provider_tool_call_id, tool_name, args_json, args_sha256, status,
      result_json, created_at, completed_at
    ) VALUES (
      'tool-call-1', 'user-a', 'chat-a', 'user-message', 'attempt-1',
      'provider-call-1', 'propose_vocabulary_entries', '{}', '${"a".repeat(64)}',
      'succeeded', '{"ok":true}', '2026-08-30T10:00:00Z', '2026-08-30T10:00:01Z'
    );
  `);
  const database = new SQLiteD1Database(sqlite);
  let id = 0;
  const options = {
    createId: (kind) => `${kind}-${++id}`,
    now: () => `2026-08-30T10:00:${String(10 + id).padStart(2, "0")}Z`,
  };
  const planner = createVocabularyMutationPlanner(database, options);
  const repository = proposalModule.createAiChatWriteProposalRepository(
    database,
    planner,
    options,
  );
  return { database, planner, repository, sqlite };
}

async function insertProposal(fixture, {
  id = "proposal-1",
  operation = "vocabulary.add-entries/v1",
  targetKey = "entries",
  args = { entries: [{ text: "uncanny", translation: "странный" }] },
  result = {
    ok: true,
    saved: true,
    entries: [{ text: "uncanny", state: "added" }],
  },
  publicPayload = {
    operation: "add_vocabulary_entries",
    items: [{ id: "entry-1", text: "uncanny", translation: "странный" }],
  },
} = {}) {
  const mutationInputJson = canonicalTraceJson({ args, result });
  const mutationInputSha256 = await sha256Hex(mutationInputJson);
  fixture.sqlite.prepare(`
    INSERT INTO ai_chat_vocabulary_write_proposals (
      id, user_id, chat_id, user_message_id, assistant_message_id,
      origin_attempt_id, origin_tool_call_id, operation, target_key,
      mutation_input_json, mutation_input_sha256, public_json, status,
      created_at, updated_at
    ) VALUES (
      ?, 'user-a', 'chat-a', 'user-message', 'assistant-message',
      'attempt-1', 'tool-call-1', ?, ?, ?, ?, ?, 'pending',
      '2026-08-30T10:00:01Z', '2026-08-30T10:00:01Z'
    )
  `).run(
    id,
    operation,
    targetKey,
    mutationInputJson,
    mutationInputSha256,
    canonicalTraceJson(publicPayload),
  );
}

test("confirm atomically commits a bulk proposal and replays the canonical result", async () => {
  const fixture = createFixture();
  await insertProposal(fixture, {
    args: { entries: [
      { text: "uncanny", translation: "странный" },
      { text: "break even", translation: "окупаться" },
    ] },
    result: {
      ok: true,
      saved: true,
      entries: [
        { text: "uncanny", state: "added" },
        { text: "break even", state: "added" },
      ],
    },
    publicPayload: {
      operation: "add_vocabulary_entries",
      items: [
        { id: "entry-1", text: "uncanny", translation: "странный" },
        { id: "entry-2", text: "break even", translation: "окупаться" },
      ],
    },
  });

  const first = await fixture.repository.decide(
    "user-a",
    "chat-a",
    "proposal-1",
    "confirm",
  );
  const replay = await fixture.repository.decide(
    "user-a",
    "chat-a",
    "proposal-1",
    "confirm",
  );

  assert.equal(first.status, "confirmed");
  assert.deepEqual(first.result.entries, [
    { state: "added", text: "uncanny" },
    { state: "added", text: "break even" },
  ]);
  assert.deepEqual(replay, first);
  assert.equal(fixture.sqlite.prepare(`
    SELECT count(*) AS count FROM phrases
    WHERE owner_id = 'user-a' AND text IN ('uncanny', 'break even')
  `).get().count, 2);
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_mutation_receipts",
  ).get().count, 1);
  assert.deepEqual({ ...fixture.sqlite.prepare(`
    SELECT status, error_code, decided_at IS NOT NULL AS decided
    FROM ai_chat_vocabulary_write_proposals WHERE id = 'proposal-1'
  `).get() }, { status: "committed", error_code: null, decided: 1 });
});

test("cancel is durable, idempotent, and never executes the proposal", async () => {
  const fixture = createFixture();
  await insertProposal(fixture);

  const cancelled = await fixture.repository.decide(
    "user-a",
    "chat-a",
    "proposal-1",
    "cancel",
  );
  const replay = await fixture.repository.decide(
    "user-a",
    "chat-a",
    "proposal-1",
    "cancel",
  );

  assert.equal(cancelled.status, "cancelled");
  assert.deepEqual(replay, cancelled);
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM phrases WHERE text = 'uncanny' COLLATE NOCASE",
  ).get().count, 0);
  await assert.rejects(
    fixture.repository.decide("user-a", "chat-a", "proposal-1", "confirm"),
    (error) => error?.code === "conflict",
  );
});

test("stale compare-and-swap becomes a terminal conflict without overwriting progress", async () => {
  const fixture = createFixture();
  fixture.sqlite.exec(`
    INSERT INTO phrases (
      id, text, pattern, source_type, owner_id, status, created_at, updated_at
    ) VALUES ('phrase-run', 'run', '', 'preset', NULL, 'pick', 'now', 'now');
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
    VALUES ('user-a', 'phrase-run', 'learning_now', 'now', 'now');
  `);
  await insertProposal(fixture, {
    operation: "vocabulary.set-category/v1",
    targetKey: "phrase-run",
    args: {
      phraseId: "phrase-run",
      expectedStoredStatus: "learning_now",
      category: "learned",
    },
    result: { ok: true, updated: true, phraseId: "phrase-run", category: "learned" },
    publicPayload: {
      operation: "set_vocabulary_category",
      items: [{ id: "entry-1", text: "run", fromCategory: "learning", toCategory: "learned" }],
    },
  });
  fixture.sqlite.prepare(`
    UPDATE phrase_progress SET status = 'to_learn'
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-run'
  `).run();

  const result = await fixture.repository.decide(
    "user-a",
    "chat-a",
    "proposal-1",
    "confirm",
  );
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "mutation_conflict");
  assert.equal(fixture.sqlite.prepare(`
    SELECT status FROM phrase_progress
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-run'
  `).get().status, "to_learn");
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_mutation_receipts",
  ).get().count, 0);
});

test("already-pending legacy category proposals remain confirmable", async () => {
  const fixture = createFixture();
  fixture.sqlite.exec(`
    INSERT INTO phrases (
      id, text, pattern, source_type, owner_id, status, created_at, updated_at
    ) VALUES ('phrase-run', 'run', '', 'preset', NULL, 'pick', 'now', 'now');
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
    VALUES ('user-a', 'phrase-run', 'learning_now', 'now', 'now');
  `);
  await insertProposal(fixture, {
    operation: "vocabulary.set-category/v1",
    targetKey: "phrase-run",
    args: {
      phraseId: "phrase-run",
      expectedStoredStatus: "learning_now",
      category: "learned",
    },
    result: { ok: true, updated: true, phraseId: "phrase-run", category: "learned" },
    publicPayload: {
      operation: "set_vocabulary_category",
      items: [{ id: "entry-1", text: "run", fromCategory: "learning", toCategory: "learned" }],
    },
  });

  const result = await fixture.repository.decide(
    "user-a", "chat-a", "proposal-1", "confirm",
  );
  assert.equal(result.status, "confirmed");
  assert.equal(fixture.sqlite.prepare(`
    SELECT status FROM phrase_progress
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-run'
  `).get().status, "learnt");
  fixture.sqlite.close();
});

test("confirmed mixed removal is owner-safe, atomic, and replayable", async () => {
  const fixture = createFixture();
  fixture.sqlite.exec(`
    INSERT INTO phrases (
      id, text, pattern, source_type, owner_id, status, created_at, updated_at
    ) VALUES
      ('phrase-shared', 'shared word', '', 'preset', NULL, 'pick', 'now', 'now'),
      ('phrase-owned', 'owned word', '', 'custom', 'user-a', 'pick', 'now', 'now');
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at) VALUES
      ('user-a', 'phrase-shared', 'learning_now', 'now', 'now'),
      ('user-b', 'phrase-shared', 'learnt', 'now', 'now'),
      ('user-a', 'phrase-owned', 'to_learn', 'now', 'now');
  `);
  await insertProposal(fixture, {
    operation: "vocabulary.change-state/v1",
    targetKey: "entries",
    args: {
      destination: "removed",
      entries: [
        {
          phraseId: "phrase-shared",
          text: "shared word",
          sourceType: "preset",
          expectedStoredStatus: "learning_now",
        },
        {
          phraseId: "phrase-owned",
          text: "owned word",
          sourceType: "custom",
          expectedStoredStatus: "to_learn",
        },
      ],
    },
    result: {
      ok: true,
      updated: true,
      entries: [
        { phraseId: "phrase-shared", text: "shared word", state: "removed" },
        { phraseId: "phrase-owned", text: "owned word", state: "removed" },
      ],
    },
    publicPayload: {
      operation: "change_vocabulary_state",
      items: [
        {
          id: "phrase-shared",
          text: "shared word",
          fromCategory: "learning",
          toCategory: "removed",
        },
        {
          id: "phrase-owned",
          text: "owned word",
          fromCategory: "to_learn",
          toCategory: "removed",
        },
      ],
    },
  });

  const first = await fixture.repository.decide(
    "user-a", "chat-a", "proposal-1", "confirm",
  );
  const replay = await fixture.repository.decide(
    "user-a", "chat-a", "proposal-1", "confirm",
  );

  assert.equal(first.status, "confirmed");
  assert.deepEqual(replay, first);
  assert.equal(fixture.sqlite.prepare(`
    SELECT status FROM phrase_progress
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-shared'
  `).get().status, "pick");
  assert.equal(fixture.sqlite.prepare(`
    SELECT status FROM phrase_progress
    WHERE user_id = 'user-b' AND phrase_id = 'phrase-shared'
  `).get().status, "learnt");
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM phrases WHERE id = 'phrase-shared'",
  ).get().count, 1);
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM phrases WHERE id = 'phrase-owned'",
  ).get().count, 0);
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_mutation_receipts",
  ).get().count, 1);
  fixture.sqlite.close();
});

test("stale removal becomes a terminal conflict with no partial removal", async () => {
  const fixture = createFixture();
  fixture.sqlite.exec(`
    INSERT INTO phrases (
      id, text, pattern, source_type, owner_id, status, created_at, updated_at
    ) VALUES
      ('phrase-shared', 'shared word', '', 'preset', NULL, 'pick', 'now', 'now'),
      ('phrase-owned', 'owned word', '', 'custom', 'user-a', 'pick', 'now', 'now');
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at) VALUES
      ('user-a', 'phrase-shared', 'learning_now', 'now', 'now'),
      ('user-a', 'phrase-owned', 'to_learn', 'now', 'now');
  `);
  const args = {
    destination: "removed",
    entries: [
      {
        phraseId: "phrase-shared",
        text: "shared word",
        sourceType: "preset",
        expectedStoredStatus: "learning_now",
      },
      {
        phraseId: "phrase-owned",
        text: "owned word",
        sourceType: "custom",
        expectedStoredStatus: "to_learn",
      },
    ],
  };
  await insertProposal(fixture, {
    operation: "vocabulary.change-state/v1",
    targetKey: "entries",
    args,
    result: {
      ok: true,
      updated: true,
      entries: args.entries.map(({ phraseId, text }) => ({
        phraseId,
        text,
        state: "removed",
      })),
    },
    publicPayload: {
      operation: "change_vocabulary_state",
      items: args.entries.map(({ phraseId, text }) => ({
        id: phraseId,
        text,
        fromCategory: "to_learn",
        toCategory: "removed",
      })),
    },
  });
  fixture.sqlite.exec("DELETE FROM phrases WHERE id = 'phrase-owned'");

  const result = await fixture.repository.decide(
    "user-a", "chat-a", "proposal-1", "confirm",
  );
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "mutation_conflict");
  assert.equal(fixture.sqlite.prepare(`
    SELECT status FROM phrase_progress
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-shared'
  `).get().status, "learning_now");
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM ai_chat_tool_mutation_receipts",
  ).get().count, 0);
  fixture.sqlite.close();
});

test("cancelled removal never changes vocabulary", async () => {
  const fixture = createFixture();
  fixture.sqlite.exec(`
    INSERT INTO phrases (
      id, text, pattern, source_type, owner_id, status, created_at, updated_at
    ) VALUES ('phrase-owned', 'owned word', '', 'custom', 'user-a', 'pick', 'now', 'now');
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
    VALUES ('user-a', 'phrase-owned', 'to_learn', 'now', 'now');
  `);
  await insertProposal(fixture, {
    operation: "vocabulary.change-state/v1",
    targetKey: "entries",
    args: {
      destination: "removed",
      entries: [{
        phraseId: "phrase-owned",
        text: "owned word",
        sourceType: "custom",
        expectedStoredStatus: "to_learn",
      }],
    },
    result: {
      ok: true,
      updated: true,
      entries: [{ phraseId: "phrase-owned", text: "owned word", state: "removed" }],
    },
    publicPayload: {
      operation: "change_vocabulary_state",
      items: [{
        id: "phrase-owned",
        text: "owned word",
        fromCategory: "to_learn",
        toCategory: "removed",
      }],
    },
  });

  const result = await fixture.repository.decide(
    "user-a", "chat-a", "proposal-1", "cancel",
  );
  assert.equal(result.status, "cancelled");
  assert.equal(fixture.sqlite.prepare(
    "SELECT count(*) AS count FROM phrases WHERE id = 'phrase-owned'",
  ).get().count, 1);
  assert.equal(fixture.sqlite.prepare(`
    SELECT status FROM phrase_progress
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-owned'
  `).get().status, "to_learn");
  fixture.sqlite.close();
});

test("owner scope and ambiguous D1 outcomes fail or recover safely", async () => {
  const foreign = createFixture();
  await insertProposal(foreign);
  await assert.rejects(
    foreign.repository.decide("user-b", "chat-a", "proposal-1", "confirm"),
    (error) => error?.code === "not_found",
  );

  const ambiguous = createFixture();
  await insertProposal(ambiguous);
  ambiguous.database.throwAfterNextBatchCommit = true;
  const recovered = await ambiguous.repository.decide(
    "user-a",
    "chat-a",
    "proposal-1",
    "confirm",
  );
  assert.equal(recovered.status, "confirmed");

  const transient = createFixture();
  await insertProposal(transient);
  transient.database.throwBeforeNextBatch = true;
  await assert.rejects(
    transient.repository.decide("user-a", "chat-a", "proposal-1", "confirm"),
    (error) => error?.code === "operation_failed",
  );
  assert.equal(transient.sqlite.prepare(`
    SELECT status FROM ai_chat_vocabulary_write_proposals WHERE id = 'proposal-1'
  `).get().status, "pending");
});

test("public listing exposes only complete-assistant display state", async () => {
  const fixture = createFixture();
  await insertProposal(fixture);
  const proposals = await fixture.repository.listForChat("user-a", "chat-a");
  assert.equal(proposals.length, 1);
  assert.deepEqual(proposals[0], {
    id: "proposal-1",
    assistantMessageId: "assistant-message",
    operation: "add_vocabulary_entries",
    items: [{ id: "entry-1", text: "uncanny", translation: "странный" }],
    status: "pending",
    result: null,
    errorCode: null,
    createdAt: "2026-08-30T10:00:01Z",
    decidedAt: null,
  });
  assert.equal("targetKey" in proposals[0], false);
  assert.equal("mutationInput" in proposals[0], false);
  fixture.sqlite.prepare(`
    UPDATE ai_chat_messages SET status = 'pending' WHERE id = 'assistant-message'
  `).run();
  assert.deepEqual(await fixture.repository.listForChat("user-a", "chat-a"), []);
});
