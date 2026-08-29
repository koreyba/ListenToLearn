import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  APP_SESSION_COOKIE,
  hashAppSessionToken,
  resolveAppSession,
} from "../lib/app-session.ts";
import { createAiChatRepository } from "../lib/ai-chat/repository.ts";
import { prepareAiChatGeneration } from "../lib/ai-chat/service.ts";
import {
  createAiChatToolTraceRepository,
} from "../lib/ai-chat/tool-trace.ts";
import {
  AI_VOCABULARY_MAX_TOOL_CALLS_PER_TURN,
  createAiVocabularyToolHandlers,
  createAiVocabularyTools,
} from "../lib/ai-chat/vocabulary-tools.ts";
import { d1AppSessionStore } from "../lib/d1-app-sessions.ts";
import { createVocabularyMutationPlanner } from "../lib/vocabulary/mutations.ts";
import { createVocabularyRepository } from "../lib/vocabulary/repository.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SESSION_TOKEN = "a".repeat(43);
const USER = {
  subject: "user-a",
  email: "a@example.com",
  name: "A",
};
const USER_COMMAND = "Добавь слово uncanny — странный и фразу break even — окупаться в словарь.";

class CountingSQLiteD1Statement {
  constructor(database, sql, bindings = [], counter) {
    this.database = database;
    this.sql = sql;
    this.bindings = bindings;
    this.counter = counter;
  }

  bind(...bindings) {
    return new CountingSQLiteD1Statement(
      this.database,
      this.sql,
      bindings,
      this.counter,
    );
  }

  execute() {
    this.counter.count += 1;
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
    this.counter.count += 1;
    return this.database.prepare(this.sql).get(...this.bindings) || null;
  }

  async all() {
    this.counter.count += 1;
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

class CountingSQLiteD1Database {
  constructor(database) {
    this.database = database;
    this.counter = { count: 0 };
    this.throwAfterNextBatchCommit = false;
  }

  get statementCount() {
    return this.counter.count;
  }

  resetStatementCount() {
    this.counter.count = 0;
  }

  prepare(sql) {
    return new CountingSQLiteD1Statement(this.database, sql, [], this.counter);
  }

  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    let results;
    try {
      // D1 Free counts every statement in a batch, not the batch call itself.
      results = statements.map((statement) => statement.execute());
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    if (this.throwAfterNextBatchCommit) {
      this.throwAfterNextBatchCommit = false;
      throw new Error("Simulated ambiguous response after D1 batch commit.");
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

async function createFixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  applyMigrations(sqlite);
  sqlite.exec(`
    INSERT INTO users (id, email, display_name, created_at, updated_at)
    VALUES ('user-a', 'a@example.com', 'A',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z');
    INSERT INTO ai_chats (id, user_id, title, explanation_language, created_at, updated_at)
    VALUES ('chat-a', 'user-a', '', 'ru',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z');
  `);
  sqlite.prepare(`
    INSERT INTO app_sessions (token_hash, user_id, created_at, expires_at)
    VALUES (?, 'user-a', '2026-08-29T10:00:00.000Z', '2030-08-29T10:00:00.000Z')
  `).run(await hashAppSessionToken(SESSION_TOKEN));

  const database = new CountingSQLiteD1Database(sqlite);
  let id = 0;
  let timestamp = Date.parse("2026-08-29T10:00:01.000Z");
  const options = {
    createId: (kind) => `${kind}-budget-${++id}`,
    now: () => new Date(timestamp++).toISOString(),
  };
  return {
    chatRepository: createAiChatRepository(database, options),
    database,
    mutationPlanner: createVocabularyMutationPlanner(database, options),
    sqlite,
    toolTraceRepository: createAiChatToolTraceRepository(database, options),
    vocabularyRepository: createVocabularyRepository(database, options),
  };
}

async function ensureUserOnColdPath(database) {
  const now = "2026-08-29T10:00:00.000Z";
  await database.prepare(`
    INSERT INTO users (id, email, display_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name,
      updated_at = excluded.updated_at
    WHERE users.email <> excluded.email OR users.display_name <> excluded.display_name
  `).bind(USER.subject, USER.email, USER.name, now, now).run();
}

async function runWorstCaseColdTurn({ ambiguousCommit = false } = {}) {
  const fixture = await createFixture();
  fixture.database.resetStatementCount();

  const resolved = await resolveAppSession(new Request("https://unmumble.online/", {
    headers: { Cookie: `${APP_SESSION_COOKIE}=${SESSION_TOKEN}` },
  }), d1AppSessionStore(fixture.database), {
    now: new Date("2026-08-29T10:00:00.000Z"),
  });
  assert.deepEqual(resolved, USER);
  await ensureUserOnColdPath(fixture.database);

  let generationInput;
  let vocabularyTools;
  const generation = await prepareAiChatGeneration({
    userId: USER.subject,
    chatId: "chat-a",
    message: { clientMessageId: "turn-budget", content: USER_COMMAND },
    serverConfig: { apiKey: "test", model: "test/model" },
    chatRepository: fixture.chatRepository,
    vocabularyRepository: fixture.vocabularyRepository,
    vocabularyMutationPlanner: fixture.mutationPlanner,
    toolTraceRepository: fixture.toolTraceRepository,
  }, {
    createRuntime: () => ({
      ok: true,
      value: {
        model: {},
        provenance: { provider: "openrouter", model: "test/model" },
        timeoutMs: 20_000,
        maxOutputTokens: 800,
      },
    }),
    buildPrompt: () => ({ system: "system", messages: [] }),
    createVocabularyTools(input) {
      vocabularyTools = createAiVocabularyTools(
        createAiVocabularyToolHandlers(input),
        input.executor,
      );
      return vocabularyTools;
    },
    startGeneration(input) {
      generationInput = input;
      return { kind: "test-stream" };
    },
  });
  assert.equal(generation.ok, true);
  assert.ok(vocabularyTools);
  assert.ok(generationInput);

  const toolOptions = (toolCallId) => ({
    toolCallId,
    messages: [],
    abortSignal: new AbortController().signal,
  });
  if (ambiguousCommit) fixture.database.throwAfterNextBatchCommit = true;
  assert.deepEqual(await vocabularyTools.add_vocabulary_entry.execute({
    text: "uncanny",
    translation: "странный",
  }, toolOptions("add-uncanny")), {
    ok: true,
    saved: true,
    text: "uncanny",
  });
  assert.deepEqual(await vocabularyTools.add_vocabulary_entry.execute({
    text: "break even",
    translation: "окупаться",
  }, toolOptions("add-break-even")), {
    ok: true,
    saved: true,
    text: "break even",
  });

  const countBeforeRejectedCall = fixture.database.statementCount;
  assert.deepEqual(await vocabularyTools.get_recent_vocabulary.execute(
    { limit: 10 },
    toolOptions("third-provider-call"),
  ), { ok: false, error: "tool_budget_exceeded" });
  assert.equal(fixture.database.statementCount, countBeforeRejectedCall);

  await generationInput.repository.completePendingAssistant({
    assistantId: generationInput.pendingAssistant.id,
    text: "Saved both entries.",
    provider: "openrouter",
    model: "test/model",
    usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
  });

  assert.equal(AI_VOCABULARY_MAX_TOOL_CALLS_PER_TURN, 2);
  assert.equal(fixture.sqlite.prepare(
    "SELECT COUNT(*) AS count FROM ai_chat_tool_calls",
  ).get().count, 2);
  assert.equal(fixture.sqlite.prepare(`
    SELECT COUNT(*) AS count FROM phrases
    WHERE owner_id = 'user-a' AND text IN ('uncanny', 'break even')
  `).get().count, 2);
  return fixture;
}

test("a cold worst-case two-write turn stays within D1 Free's statement limit", async () => {
  const fixture = await runWorstCaseColdTurn();
  assert.equal(fixture.database.statementCount, 45);
  assert.ok(fixture.database.statementCount <= 50);
  fixture.sqlite.close();
});

test("one ambiguous committed write still leaves D1 Free headroom", async () => {
  const fixture = await runWorstCaseColdTurn({ ambiguousCommit: true });
  assert.equal(fixture.database.statementCount, 47);
  assert.ok(fixture.database.statementCount <= 50);
  fixture.sqlite.close();
});
