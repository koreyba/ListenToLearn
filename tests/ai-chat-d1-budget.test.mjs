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
import { createChatWithVocabularyOpening } from "../lib/ai-chat/chat-creation.ts";
import { createAiChatRepository } from "../lib/ai-chat/repository.ts";
import { prepareAiChatGeneration } from "../lib/ai-chat/service.ts";
import {
  createAiChatToolTraceRepository,
} from "../lib/ai-chat/tool-trace.ts";
import { createAiChatWriteProposalRepository } from "../lib/ai-chat/write-proposals.ts";
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
    this.throwAfterNextBatchRollback = false;
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
    const isMutationBatch = statements.some((statement) => (
      statement.sql.includes("INSERT INTO ai_chat_tool_mutation_receipts")
      || statement.sql.includes("ai_chat_vocabulary_write_proposals")
    ));
    this.database.exec("BEGIN IMMEDIATE");
    let results;
    try {
      // D1 Free counts every statement in a batch, not the batch call itself.
      results = statements.map((statement) => statement.execute());
      if (this.throwAfterNextBatchRollback && isMutationBatch) {
        this.throwAfterNextBatchRollback = false;
        throw new Error("Simulated rollback after all D1 batch statements.");
      }
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

async function runWorstCaseColdTurn({
  ambiguousCommit = false,
  ambiguousTerminal = false,
  bulkEntryCount = 2,
  scenario = "writes",
  secondProposal = true,
  terminal = "complete",
} = {}) {
  const fixture = await createFixture();
  if (scenario === "reads") {
    for (let index = 0; index < 10; index += 1) {
      fixture.sqlite.prepare(`
        INSERT INTO phrases (
          id, text, pattern, translation, context, source_type, owner_id, status,
          created_at, updated_at
        ) VALUES (?, ?, '', ?, '', 'custom', 'user-a', 'pick', ?, ?)
      `).run(
        `phrase-read-${index}`,
        `word ${index}`,
        `перевод ${index}`,
        `2026-08-29T10:00:${String(index).padStart(2, "0")}.000Z`,
        `2026-08-29T10:00:${String(index).padStart(2, "0")}.000Z`,
      );
      fixture.sqlite.prepare(`
        INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
        VALUES ('user-a', ?, 'to_learn', ?, ?)
      `).run(
        `phrase-read-${index}`,
        `2026-08-29T10:00:${String(index).padStart(2, "0")}.000Z`,
        `2026-08-29T10:00:${String(index).padStart(2, "0")}.000Z`,
      );
      fixture.sqlite.prepare(`
        INSERT INTO phrase_meanings (
          id, user_id, phrase_id, translation, normalized_translation, context,
          created_at, updated_at
        ) VALUES (?, 'user-a', ?, ?, ?, '', ?, ?)
      `).run(
        `meaning-read-${index}`,
        `phrase-read-${index}`,
        `значение ${index}`,
        `значение ${index}`,
        `2026-08-29T10:00:${String(index).padStart(2, "0")}.000Z`,
        `2026-08-29T10:00:${String(index).padStart(2, "0")}.000Z`,
      );
    }
  } else {
    fixture.sqlite.exec(`
      INSERT INTO phrases (
        id, text, pattern, translation, context, source_type, owner_id, status,
        created_at, updated_at
      ) VALUES (
        'phrase-legacy-budget', 'break even', '', 'окупаться',
        'the business breaks even', 'custom', 'user-a', 'pick',
        '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
      );
      INSERT INTO phrase_progress (
        user_id, phrase_id, status, created_at, updated_at
      ) VALUES (
        'user-a', 'phrase-legacy-budget', 'learning_now',
        '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
      );
    `);
  }
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
    message: {
      clientMessageId: "turn-budget",
      content: scenario === "reads"
        ? "Покажи последние десять слов."
        : ["legacyRollback", "legacyParallelRollback"].includes(scenario)
          ? "Исправь у break even перевод окупаться на выходить в ноль."
          : USER_COMMAND,
    },
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
    buildPrompt: () => ({
      id: "unmumble.vocabulary-practice",
      version: "3",
      system: "system",
      messages: [],
    }),
    createVocabularyTools(input) {
      vocabularyTools = createAiVocabularyTools(
        createAiVocabularyToolHandlers(input),
        input.executor,
      );
      return vocabularyTools;
    },
    recordOperationalEvent() {},
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
  if (scenario === "legacyParallelRollback") {
    fixture.database.throwAfterNextBatchRollback = true;
    const [firstWrite, secondWrite] = await Promise.all([
      vocabularyTools.propose_vocabulary_change_set.execute({ changes: [{
        action: "update_meaning",
        text: "break even",
        currentTranslation: "окупаться",
        translation: "выходить в ноль",
      }] }, toolOptions("update-legacy-first")),
      vocabularyTools.propose_vocabulary_change_set.execute({ changes: [{
        action: "update_meaning",
        text: "break even",
        currentTranslation: "окупаться",
        translation: "выходить в ноль",
      }] }, toolOptions("update-legacy-concurrent")),
    ]);
    assert.deepEqual(firstWrite, { ok: false, error: "operation_failed" });
    assert.deepEqual(secondWrite, { ok: false, error: "tool_budget_exceeded" });
  } else if (scenario === "legacyRollback") {
    fixture.database.throwAfterNextBatchRollback = true;
    assert.deepEqual(await vocabularyTools.propose_vocabulary_change_set.execute({ changes: [{
      action: "update_meaning",
      text: "break even",
      currentTranslation: "окупаться",
      translation: "выходить в ноль",
    }] }, toolOptions("update-legacy-first")), {
      ok: false,
      error: "operation_failed",
    });
    assert.equal(fixture.database.throwAfterNextBatchRollback, false);
    const countAfterFailure = fixture.database.statementCount;
    assert.deepEqual(await vocabularyTools.propose_vocabulary_change_set.execute({ changes: [{
      action: "update_meaning",
      text: "break even",
      currentTranslation: "окупаться",
      translation: "выходить в ноль",
    }] }, toolOptions("update-legacy-retry")), {
      ok: false,
      error: "tool_budget_exceeded",
    });
    assert.equal(fixture.database.statementCount, countAfterFailure);
  } else if (scenario === "writes" || scenario === "rollback") {
    if (ambiguousCommit && scenario !== "rollback") {
      fixture.database.throwAfterNextBatchCommit = true;
    }
    if (scenario === "rollback") fixture.database.throwAfterNextBatchRollback = true;
    const changes = Array.from({ length: bulkEntryCount }, (_, index) => ({
      action: "add_entry",
      text: `budget word ${index + 1}`,
      translation: `перевод ${index + 1}`,
    }));
    if (secondProposal) {
      changes.push({
        action: "update_meaning",
        text: "break even",
        currentTranslation: "окупаться",
        translation: "выходить в ноль",
      });
    }
    const firstWrite = await vocabularyTools.propose_vocabulary_change_set.execute({
      changes,
    }, toolOptions("add-uncanny"));
    if (scenario === "rollback") {
      assert.deepEqual(firstWrite, { ok: false, error: "operation_failed" });
    } else {
      assert.equal(firstWrite.ok, true);
      assert.equal(firstWrite.proposed, true);
      assert.equal(firstWrite.approvalRequired, true);
      assert.equal(typeof firstWrite.proposalId, "string");
    }
    if (scenario === "rollback") {
      assert.equal(fixture.database.throwAfterNextBatchRollback, false);
    }
    if (secondProposal) {
      const secondRead = await vocabularyTools.list_vocabulary.execute(
        { limit: 1 },
        toolOptions("read-after-change-set"),
      );
      if (scenario === "rollback") {
        assert.deepEqual(secondRead, { ok: false, error: "tool_budget_exceeded" });
      } else assert.equal(secondRead.ok, true);
    } else {
      const secondRead = await vocabularyTools.list_vocabulary.execute(
        { limit: 1 },
        toolOptions("read-after-proposal"),
      );
      assert.equal(secondRead.ok, true);
    }
  } else {
    for (const toolCallId of ["read-recent-1", "read-recent-2"]) {
      const result = await vocabularyTools.list_vocabulary.execute(
        { limit: 10 },
        toolOptions(toolCallId),
      );
      assert.equal(result.ok, true);
      assert.equal(result.entries.length, 10);
    }
  }

  const countBeforeRejectedCall = fixture.database.statementCount;
  assert.deepEqual(await vocabularyTools.list_vocabulary.execute(
    { limit: 10 },
    toolOptions("third-provider-call"),
  ), { ok: false, error: "tool_budget_exceeded" });
  assert.equal(fixture.database.statementCount, countBeforeRejectedCall);

  if (ambiguousTerminal) fixture.database.throwAfterNextBatchCommit = true;
  if (terminal === "failed") {
    await generationInput.repository.failPendingAssistant({
      assistantId: generationInput.pendingAssistant.id,
      errorCode: "provider_failed",
    });
  } else {
    await generationInput.repository.completePendingAssistant({
      assistantId: generationInput.pendingAssistant.id,
      text: "I prepared the requested vocabulary changes for your review.",
      provider: "openrouter",
      model: "test/model",
      usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
    });
  }

  assert.equal(AI_VOCABULARY_MAX_TOOL_CALLS_PER_TURN, 2);
  assert.equal(fixture.sqlite.prepare(
    "SELECT COUNT(*) AS count FROM ai_chat_tool_calls",
  ).get().count, ["legacyRollback", "legacyParallelRollback", "rollback"].includes(scenario) ? 1 : 2);
  if (scenario === "writes" || scenario === "rollback") {
    assert.deepEqual(fixture.sqlite.prepare(`
      SELECT text FROM phrases
      WHERE owner_id = 'user-a' AND text LIKE 'budget word %'
      ORDER BY text
    `).all().map((row) => row.text), []);
    assert.equal(fixture.sqlite.prepare(
      "SELECT COUNT(*) AS count FROM ai_chat_tool_mutation_receipts",
    ).get().count, 0);
  } else if (["legacyRollback", "legacyParallelRollback"].includes(scenario)) {
    assert.deepEqual({ ...fixture.sqlite.prepare(`
      SELECT translation, context FROM phrases
      WHERE id = 'phrase-legacy-budget'
    `).get() }, {
      translation: "окупаться",
      context: "the business breaks even",
    });
    assert.equal(fixture.sqlite.prepare(`
      SELECT COUNT(*) AS count FROM phrase_meanings
      WHERE user_id = 'user-a' AND phrase_id = 'phrase-legacy-budget'
    `).get().count, 0);
  }
  return fixture;
}

async function runStateChangeProposalTurn(entryCount) {
  const fixture = await createFixture();
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    const sourceType = index % 2 === 0 ? "custom" : "preset";
    const phraseId = `phrase-remove-${index}`;
    const text = `remove word ${index}`;
    fixture.sqlite.prepare(`
      INSERT INTO phrases (
        id, text, pattern, source_type, owner_id, status, created_at, updated_at
      ) VALUES (?, ?, '', ?, ?, 'pick', 'now', 'now')
    `).run(phraseId, text, sourceType, sourceType === "custom" ? USER.subject : null);
    fixture.sqlite.prepare(`
      INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
      VALUES (?, ?, 'to_learn', 'now', 'now')
    `).run(USER.subject, phraseId);
    entries.push({ text });
  }
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
    message: {
      clientMessageId: `remove-budget-${entryCount}`,
      content: `Remove ${entries.map(({ text }) => text).join(", ")} from Practice.`,
    },
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
    buildPrompt: () => ({
      id: "unmumble.vocabulary-practice",
      version: "3",
      system: "system",
      messages: [],
    }),
    createVocabularyTools(input) {
      vocabularyTools = createAiVocabularyTools(
        createAiVocabularyToolHandlers(input),
        input.executor,
      );
      return vocabularyTools;
    },
    recordOperationalEvent() {},
    startGeneration(input) {
      generationInput = input;
      return { kind: "test-stream" };
    },
  });
  assert.equal(generation.ok, true);
  const proposed = await vocabularyTools.propose_vocabulary_change_set.execute({
    changes: entries.map(({ text }) => ({
      action: "change_state",
      text,
      destination: "removed",
    })),
  }, {
    toolCallId: `remove-state-${entryCount}`,
    messages: [],
    abortSignal: new AbortController().signal,
  });
  assert.equal(proposed.ok, true);
  assert.equal(proposed.proposed, true);
  await generationInput.repository.completePendingAssistant({
    assistantId: generationInput.pendingAssistant.id,
    text: "I prepared the requested removal for review.",
    provider: "openrouter",
    model: "test/model",
    usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
  });
  assert.equal(fixture.sqlite.prepare(`
    SELECT COUNT(*) AS count FROM phrase_progress
    WHERE user_id = 'user-a' AND status = 'to_learn'
  `).get().count, entryCount);
  return { fixture, proposalId: proposed.proposalId };
}

test("a cold mixed change-set turn stays within D1 Free's statement limit", async () => {
  const fixture = await runWorstCaseColdTurn();
  assert.equal(fixture.database.statementCount, 36);
  assert.ok(fixture.database.statementCount <= 50);
  fixture.sqlite.close();
});

test("one ambiguous proposal commit still leaves D1 Free headroom", async () => {
  const fixture = await runWorstCaseColdTurn({ ambiguousCommit: true });
  assert.equal(fixture.database.statementCount, 38);
  assert.ok(fixture.database.statementCount <= 50);
  fixture.sqlite.close();
});

test("a rolled-back proposal stays within D1 Free's statement limit", async () => {
  const fixture = await runWorstCaseColdTurn({ scenario: "rollback" });
  assert.equal(fixture.database.statementCount, 32);
  assert.ok(fixture.database.statementCount <= 50);
  fixture.sqlite.close();
});

test("two maximum recent-vocabulary reads leave room for terminal persistence", async () => {
  const fixture = await runWorstCaseColdTurn({ scenario: "reads" });
  assert.equal(fixture.database.statementCount, 35);
  assert.ok(fixture.database.statementCount <= 50);
  fixture.sqlite.close();
});

test("a rolled-back proposal opens the circuit before another D1 call", async () => {
  const fixture = await runWorstCaseColdTurn({ scenario: "rollback" });
  assert.equal(fixture.database.statementCount, 32);
  assert.ok(fixture.database.statementCount <= 50);
  assert.deepEqual(fixture.sqlite.prepare(`
    SELECT provider_tool_call_id, status, error_code
    FROM ai_chat_tool_calls ORDER BY created_at, id
  `).all().map((row) => ({ ...row })), [{
    provider_tool_call_id: "add-uncanny",
    status: "failed",
    error_code: "operation_failed",
  }]);
  assert.equal(fixture.sqlite.prepare(
    "SELECT COUNT(*) AS count FROM ai_chat_tool_mutation_receipts",
  ).get().count, 0);
  fixture.sqlite.close();
});

test("provider failure after an ambiguous proposal stays within D1 Free", async () => {
  const fixture = await runWorstCaseColdTurn({
    scenario: "writes",
    ambiguousCommit: true,
    terminal: "failed",
  });
  assert.equal(fixture.database.statementCount, 38);
  assert.ok(fixture.database.statementCount <= 50);
  fixture.sqlite.close();
});

test("ambiguous failure persistence after a rolled-back proposal stays within D1 Free", async () => {
  const fixture = await runWorstCaseColdTurn({
    scenario: "rollback",
    ambiguousTerminal: true,
    terminal: "failed",
  });
  assert.equal(fixture.database.statementCount, 34);
  assert.ok(fixture.database.statementCount <= 50);
  fixture.sqlite.close();
});

test("meaning-update proposal rollback plus ambiguous failure stays within D1 Free", async () => {
  const fixture = await runWorstCaseColdTurn({
    scenario: "legacyRollback",
    ambiguousTerminal: true,
    terminal: "failed",
  });
  assert.equal(fixture.database.statementCount, 34);
  assert.ok(fixture.database.statementCount <= 50);
  fixture.sqlite.close();
});

test("parallel provider proposals are serialized before the D1 failure circuit", async () => {
  const fixture = await runWorstCaseColdTurn({
    scenario: "legacyParallelRollback",
    ambiguousTerminal: true,
    terminal: "failed",
  });
  assert.equal(fixture.database.statementCount, 34);
  assert.ok(fixture.database.statementCount <= 50);
  fixture.sqlite.close();
});

test("confirming one, ten, or thirty additions has the same bounded D1 statement cost", async () => {
  const observed = [];
  for (const entryCount of [1, 10, 30]) {
    const fixture = await runWorstCaseColdTurn({
      bulkEntryCount: entryCount,
      secondProposal: false,
    });
    const proposal = fixture.sqlite.prepare(`
      SELECT id FROM ai_chat_vocabulary_write_proposals
      WHERE operation = 'vocabulary.change-set/v1'
    `).get();
    assert.ok(proposal?.id);
    fixture.database.resetStatementCount();

    const resolved = await resolveAppSession(new Request("https://unmumble.online/", {
      headers: { Cookie: `${APP_SESSION_COOKIE}=${SESSION_TOKEN}` },
    }), d1AppSessionStore(fixture.database), {
      now: new Date("2026-08-29T10:00:00.000Z"),
    });
    assert.deepEqual(resolved, USER);
    await ensureUserOnColdPath(fixture.database);
    const result = await createAiChatWriteProposalRepository(
      fixture.database,
      fixture.mutationPlanner,
    ).decide(USER.subject, "chat-a", proposal.id, "confirm");

    assert.equal(result.status, "confirmed");
    assert.equal(result.result.count, entryCount);
    assert.equal(fixture.sqlite.prepare(`
      SELECT COUNT(*) AS count FROM phrases
      WHERE owner_id = 'user-a' AND text LIKE 'budget word %'
    `).get().count, entryCount);
    observed.push(fixture.database.statementCount);
    fixture.sqlite.close();
  }

  assert.deepEqual(observed, [15, 15, 15]);
  assert.ok(observed.every((count) => count <= 50));
});

test("proposing and confirming removal stay set-based through thirty entries", async () => {
  const proposalCounts = [];
  const confirmCounts = [];
  for (const entryCount of [1, 10, 30]) {
    const { fixture, proposalId } = await runStateChangeProposalTurn(entryCount);
    proposalCounts.push(fixture.database.statementCount);
    fixture.database.resetStatementCount();

    const resolved = await resolveAppSession(new Request("https://unmumble.online/", {
      headers: { Cookie: `${APP_SESSION_COOKIE}=${SESSION_TOKEN}` },
    }), d1AppSessionStore(fixture.database), {
      now: new Date("2026-08-29T10:00:00.000Z"),
    });
    assert.deepEqual(resolved, USER);
    await ensureUserOnColdPath(fixture.database);
    const result = await createAiChatWriteProposalRepository(
      fixture.database,
      fixture.mutationPlanner,
    ).decide(USER.subject, "chat-a", proposalId, "confirm");

    assert.equal(result.status, "confirmed");
    assert.equal(result.result.count, entryCount);
    confirmCounts.push(fixture.database.statementCount);
    fixture.sqlite.close();
  }

  assert.deepEqual(proposalCounts, [30, 30, 30]);
  assert.deepEqual(confirmCounts, [15, 15, 15]);
  assert.ok([...proposalCounts, ...confirmCounts].every((count) => count <= 50));
});

test("turn cancellation is a separate five-statement repository invocation", async () => {
  const fixture = await createFixture();
  const started = await fixture.chatRepository.beginTurn("user-a", "chat-a", {
    clientMessageId: "budget-cancel",
    content: "Stop this response.",
    practiceContext: [],
  });
  assert.equal(started.assistant.status, "pending");
  fixture.database.resetStatementCount();

  const cancelled = await fixture.chatRepository.cancelTurn(
    "user-a",
    "chat-a",
    "budget-cancel",
  );

  assert.equal(cancelled.assistant.errorCode, "generation_cancelled");
  assert.equal(cancelled.attempt.errorCode, "generation_cancelled");
  assert.equal(fixture.database.statementCount, 5);
  assert.ok(fixture.database.statementCount <= 50);
  fixture.sqlite.close();
});

test("ambiguous max-target chat creation recovers within D1 Free's statement limit", async () => {
  const fixture = await createFixture();
  const targets = [];
  for (let index = 0; index < 12; index += 1) {
    const phraseId = `create-phrase-${index}`;
    const meaningId = `create-meaning-${index}`;
    const timestamp = `2026-08-29T09:00:${String(index).padStart(2, "0")}.000Z`;
    fixture.sqlite.prepare(`
      INSERT INTO phrases (
        id, text, pattern, translation, context, source_type, owner_id, status,
        created_at, updated_at
      ) VALUES (?, ?, '', '', '', 'custom', 'user-a', 'pick', ?, ?)
    `).run(phraseId, `selected target ${index}`, timestamp, timestamp);
    fixture.sqlite.prepare(`
      INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
      VALUES ('user-a', ?, 'to_learn', ?, ?)
    `).run(phraseId, timestamp, timestamp);
    fixture.sqlite.prepare(`
      INSERT INTO phrase_meanings (
        id, user_id, phrase_id, translation, normalized_translation, context,
        created_at, updated_at
      ) VALUES (?, 'user-a', ?, ?, ?, '', ?, ?)
    `).run(meaningId, phraseId, `meaning ${index}`, `meaning ${index}`, timestamp, timestamp);
    targets.push({
      source: "saved",
      phraseId,
      meaningMode: "selected",
      selectedMeaningId: meaningId,
    });
  }
  fixture.database.resetStatementCount();

  const resolved = await resolveAppSession(new Request("https://unmumble.online/", {
    headers: { Cookie: `${APP_SESSION_COOKIE}=${SESSION_TOKEN}` },
  }), d1AppSessionStore(fixture.database), {
    now: new Date("2026-08-29T10:00:00.000Z"),
  });
  assert.deepEqual(resolved, USER);
  await ensureUserOnColdPath(fixture.database);
  fixture.database.throwAfterNextBatchCommit = true;

  const chat = await createChatWithVocabularyOpening({
    chatRepository: fixture.chatRepository,
    vocabularyRepository: fixture.vocabularyRepository,
    userId: USER.subject,
    targets,
  });

  assert.equal(chat.targets.length, 12);
  assert.equal(chat.messages.length, 1);
  assert.equal(fixture.database.statementCount, 49);
  assert.ok(fixture.database.statementCount <= 50);
  assert.equal(fixture.sqlite.prepare(
    "SELECT COUNT(*) AS count FROM ai_chats WHERE user_id = 'user-a'",
  ).get().count, 2);
  fixture.sqlite.close();
});
