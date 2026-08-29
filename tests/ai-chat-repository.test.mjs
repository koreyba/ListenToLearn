import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryModule = await import("../lib/ai-chat/repository.ts").catch(() => ({}));
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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
    if (/^\s*(?:SELECT|WITH|PRAGMA)\b/iu.test(this.sql)) {
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

function createFixture() {
  assert.equal(
    typeof repositoryModule.createAiChatRepository,
    "function",
    "lib/ai-chat/repository.ts must export createAiChatRepository",
  );
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const migrations = readdirSync(join(root, "drizzle"))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  for (const migration of migrations) {
    sqlite.exec(readFileSync(join(root, "drizzle", migration), "utf8"));
  }
  sqlite.exec(`
    INSERT INTO users (id, email, display_name, created_at, updated_at) VALUES
      ('user-a', 'a@example.com', 'A', '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'),
      ('user-b', 'b@example.com', 'B', '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z');
    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status, created_at, updated_at
    ) VALUES
      ('phrase-shared', 'run', '', 'бежать', 'run every morning', 'preset', NULL, 'pick',
        '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'),
      ('phrase-a', 'figure out', '', 'разобраться', 'figure out a problem', 'custom', 'user-a', 'pick',
        '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'),
      ('phrase-b', 'get away', '', 'сбежать', 'get away safely', 'custom', 'user-b', 'pick',
        '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z');
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at) VALUES
      ('user-a', 'phrase-shared', 'learned', '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'),
      ('user-b', 'phrase-shared', 'to_learn', '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z');
  `);

  let id = 0;
  let milliseconds = Date.parse("2026-08-29T11:00:00.000Z");
  const repository = repositoryModule.createAiChatRepository(
    new SQLiteD1Database(sqlite),
    {
      createId: (kind) => `${kind}-${++id}`,
      now: () => new Date(milliseconds++).toISOString(),
    },
  );
  return { repository, sqlite };
}

function hasCode(code) {
  return (error) => error && typeof error === "object" && error.code === code;
}

test("meaning fallback and personal meanings stay owner-scoped and status-neutral", async () => {
  const { repository, sqlite } = createFixture();

  assert.deepEqual(await repository.listMeanings("user-a", "phrase-shared"), {
    phraseId: "phrase-shared",
    text: "run",
    meanings: [{
      id: "legacy",
      source: "legacy",
      translation: "бежать",
      context: "run every morning",
    }],
  });

  const created = await repository.addMeaning("user-a", {
    phraseId: "phrase-shared",
    translation: "управлять",
    context: "run a company",
  });
  const deduped = await repository.addMeaning("user-a", {
    phraseId: "phrase-shared",
    translation: "  УПРАВЛЯТЬ  ",
    context: "run an organization",
  });
  assert.equal(deduped.id, created.id);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM phrase_meanings").get().count, 1);
  assert.equal(
    sqlite.prepare("SELECT status FROM phrase_progress WHERE user_id = 'user-a' AND phrase_id = 'phrase-shared'").get().status,
    "learned",
  );

  const owned = await repository.listMeanings("user-a", "phrase-shared");
  assert.deepEqual(owned.meanings.map(({ source, translation, context }) => ({ source, translation, context })), [
    { source: "legacy", translation: "бежать", context: "run every morning" },
    { source: "personal", translation: "УПРАВЛЯТЬ", context: "run an organization" },
  ]);
  assert.equal((await repository.listMeanings("user-b", "phrase-shared")).meanings.length, 1);
  await assert.rejects(
    repository.addMeaning("user-a", {
      phraseId: "phrase-b",
      translation: "уйти",
      context: "",
    }),
    hasCode("not_found"),
  );
  assert.equal(await repository.listMeanings("user-a", "phrase-b"), null);
});

test("create, list, and get expose only owned chats with empty or multiple targets", async () => {
  const { repository } = createFixture();
  const empty = await repository.createChat("user-a");
  const initialized = await repository.createChat("user-a", {
    targets: [
      { source: "saved", phraseId: "phrase-shared", meaningMode: "all_saved" },
      { source: "ad_hoc", text: "make it up", meaningMode: "explore" },
    ],
  });
  const foreign = await repository.createChat("user-b", {
    targets: [{ source: "saved", phraseId: "phrase-b", meaningMode: "all_saved" }],
  });

  assert.equal(empty.targets.length, 0);
  assert.deepEqual(initialized.targets.map(({ text, meaningMode }) => ({ text, meaningMode })), [
    { text: "run", meaningMode: "all_saved" },
    { text: "make it up", meaningMode: "explore" },
  ]);
  assert.match(initialized.title, /run/i);
  assert.deepEqual((await repository.listChats("user-a")).map((chat) => chat.id), [initialized.id, empty.id]);
  assert.deepEqual(await repository.getChatSummary("user-a", initialized.id), {
    id: initialized.id,
    title: initialized.title,
    explanationLanguage: "ru",
    targetCount: 2,
    messageCount: 0,
    createdAt: initialized.createdAt,
    updatedAt: initialized.updatedAt,
  });
  assert.equal(await repository.getChatSummary("user-b", initialized.id), null);
  assert.equal(await repository.getChat("user-a", foreign.id), null);
  assert.equal(await repository.getChat("user-b", initialized.id), null);
  assert.equal((await repository.getChat("user-a", initialized.id)).messages.length, 0);
});

test("replacing current targets validates visibility, ownership, limits, and snapshots before mutation", async () => {
  const { repository, sqlite } = createFixture();
  const selected = await repository.addMeaning("user-a", {
    phraseId: "phrase-shared",
    translation: "управлять",
    context: "run a company",
  });
  const foreignMeaning = await repository.addMeaning("user-b", {
    phraseId: "phrase-shared",
    translation: "работать",
    context: "a machine runs",
  });
  const chat = await repository.createChat("user-a", {
    targets: [{ source: "saved", phraseId: "phrase-shared", meaningMode: "all_saved" }],
  });
  assert.deepEqual(chat.targets[0].knownMeanings.map((meaning) => meaning.translation), [
    "бежать",
    "управлять",
  ]);

  const current = await repository.replacePracticeItems("user-a", chat.id, [
    {
      source: "saved",
      phraseId: "phrase-shared",
      meaningMode: "selected",
      selectedMeaningId: selected.id,
    },
    { source: "ad_hoc", text: "break even", meaningMode: "explore" },
  ]);
  assert.deepEqual(current.map((target) => ({
    text: target.text,
    meaningMode: target.meaningMode,
    selected: target.selectedMeaning?.translation || null,
  })), [
    { text: "run", meaningMode: "selected", selected: "управлять" },
    { text: "break even", meaningMode: "explore", selected: null },
  ]);

  sqlite.prepare("UPDATE phrase_meanings SET translation = 'руководить' WHERE id = ?").run(selected.id);
  let restored = await repository.getCurrentPracticeItems("user-a", chat.id);
  assert.equal(restored[0].selectedMeaning.translation, "управлять");
  sqlite.prepare("DELETE FROM phrase_meanings WHERE id = ?").run(selected.id);
  restored = await repository.getCurrentPracticeItems("user-a", chat.id);
  assert.equal(restored[0].selectedMeaningId, null);
  assert.equal(restored[0].selectedMeaning.translation, "управлять");
  assert.equal(restored[0].selectedMeaning.source, "personal");

  for (const invalidTargets of [
    [{ source: "saved", phraseId: "phrase-b", meaningMode: "all_saved" }],
    [{
      source: "saved",
      phraseId: "phrase-shared",
      meaningMode: "selected",
      selectedMeaningId: foreignMeaning.id,
    }],
  ]) {
    await assert.rejects(
      repository.replacePracticeItems("user-a", chat.id, invalidTargets),
      hasCode("invalid_target"),
    );
    assert.deepEqual(
      (await repository.getCurrentPracticeItems("user-a", chat.id)).map((target) => target.text),
      ["run", "break even"],
    );
  }

  await assert.rejects(
    repository.replacePracticeItems(
      "user-a",
      chat.id,
      Array.from({ length: 13 }, (_, index) => ({
        source: "ad_hoc",
        text: `target ${index}`,
        meaningMode: "all_saved",
      })),
    ),
    hasCode("target_limit"),
  );
  await assert.rejects(
    repository.replacePracticeItems("user-b", chat.id, []),
    hasCode("not_found"),
  );
});

test("selected meaning accepts the explicit legacy sentinel without creating a personal row", async () => {
  const { repository, sqlite } = createFixture();
  assert.equal(repositoryModule.AI_CHAT_LEGACY_MEANING_ID, "legacy");

  const chat = await repository.createChat("user-a", {
    targets: [{
      source: "saved",
      phraseId: "phrase-shared",
      meaningMode: "selected",
      selectedMeaningId: "legacy",
    }],
  });
  assert.equal(chat.targets[0].selectedMeaningId, null);
  assert.equal(chat.targets[0].selectedMeaningSnapshot, "бежать");
  assert.deepEqual(chat.targets[0].selectedMeaning, {
    id: "legacy",
    source: "legacy",
    translation: "бежать",
    context: "run every morning",
  });
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM phrase_meanings").get().count, 0);

  sqlite.exec(`
    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status, created_at, updated_at
    ) VALUES (
      'phrase-empty', 'set aside', '', '', '', 'custom', 'user-a', 'pick',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
  `);
  await assert.rejects(
    repository.replacePracticeItems("user-a", chat.id, [{
      source: "saved",
      phraseId: "phrase-empty",
      meaningMode: "selected",
      selectedMeaningId: "legacy",
    }]),
    hasCode("invalid_target"),
  );
  assert.equal((await repository.getCurrentPracticeItems("user-a", chat.id))[0].selectedMeaningSnapshot, "бежать");
});

test("canonical history is ordered, bounded, and excludes unfinished assistant rows", async () => {
  const { repository, sqlite } = createFixture();
  const chat = await repository.createChat("user-a");

  const firstTurn = await repository.beginTurn("user-a", chat.id, {
    clientMessageId: "turn-1",
    content: "Give me an example.",
    practiceContext: [{ text: "run", meaningMode: "all_saved" }],
  });
  await repository.finishTurn("user-a", chat.id, "turn-1", {
    attemptUpdatedAt: firstTurn.assistant.updatedAt,
    content: "I run every morning.",
    provider: "openrouter",
    model: "test/model",
    usage: { inputTokens: 10, outputTokens: 6 },
  });
  const secondTurn = await repository.beginTurn("user-a", chat.id, {
    clientMessageId: "turn-2",
    content: "Another one.",
    practiceContext: [],
  });
  await repository.failTurn(
    "user-a",
    chat.id,
    "turn-2",
    "provider_timeout",
    secondTurn.assistant.updatedAt,
  );
  await repository.beginTurn("user-a", chat.id, {
    clientMessageId: "turn-3",
    content: "Explain the first sentence.",
    practiceContext: [],
  });

  assert.deepEqual((await repository.getCanonicalHistory("user-a", chat.id)).map(({ role, content }) => ({ role, content })), [
    { role: "user", content: "Give me an example." },
    { role: "assistant", content: "I run every morning." },
    { role: "user", content: "Another one." },
    { role: "user", content: "Explain the first sentence." },
  ]);
  assert.deepEqual(
    (await repository.getCanonicalHistory("user-a", chat.id, { excludeClientMessageId: "turn-2" }))
      .map(({ content }) => content),
    ["Give me an example.", "I run every morning.", "Explain the first sentence."],
  );
  assert.deepEqual(
    (await repository.getCanonicalHistory("user-a", chat.id, { beforeSequence: 5 }))
      .map(({ content }) => content),
    ["Give me an example.", "I run every morning.", "Another one."],
  );
  await assert.rejects(
    repository.getCanonicalHistory("user-b", chat.id),
    hasCode("not_found"),
  );

  const boundedChat = await repository.createChat("user-a");
  const insert = sqlite.prepare(`
    INSERT INTO ai_chat_messages (
      id, chat_id, role, sequence, content, status, practice_context_json,
      client_message_id, created_at, updated_at
    ) VALUES (?, ?, 'user', ?, ?, 'complete', '[]', ?,
      '2026-08-29T12:00:00.000Z', '2026-08-29T12:00:00.000Z')
  `);
  for (let index = 1; index <= 45; index += 1) {
    insert.run(`bounded-${index}`, boundedChat.id, index, `bulk ${index}`, `bounded-${index}`);
  }
  const bounded = await repository.getCanonicalHistory("user-a", boundedChat.id);
  assert.equal(bounded.length, 40);
  assert.equal(bounded[0].content, "bulk 6");
  assert.equal(bounded.at(-1).content, "bulk 45");
});

test("beginTurn atomically creates one ordered pair and reuses a client id", async () => {
  const { repository, sqlite } = createFixture();
  const chat = await repository.createChat("user-a");
  const input = {
    clientMessageId: "client-1",
    content: "Practice run.",
    practiceContext: [{ text: "run", meanings: ["бежать"] }],
  };

  const created = await repository.beginTurn("user-a", chat.id, input);
  assert.equal(created.state, "created");
  assert.deepEqual([created.user.sequence, created.assistant.sequence], [1, 2]);
  assert.equal(created.assistant.status, "pending");
  const duplicate = await repository.beginTurn("user-a", chat.id, input);
  assert.equal(duplicate.state, "existing");
  assert.equal(duplicate.user.id, created.user.id);
  assert.equal(duplicate.assistant.id, created.assistant.id);
  assert.equal(
    sqlite.prepare("SELECT count(*) AS count FROM ai_chat_messages WHERE chat_id = ?").get(chat.id).count,
    2,
  );
  await assert.rejects(
    repository.beginTurn("user-a", chat.id, { ...input, content: "Different content." }),
    hasCode("conflict"),
  );

  const second = await repository.beginTurn("user-a", chat.id, {
    clientMessageId: "client-2",
    content: "One more.",
    practiceContext: [],
  });
  assert.deepEqual([second.user.sequence, second.assistant.sequence], [3, 4]);
  await assert.rejects(
    repository.beginTurn("user-b", chat.id, {
      clientMessageId: "foreign",
      content: "Leak the chat.",
      practiceContext: [],
    }),
    hasCode("not_found"),
  );
});

test("failed turns retain the user row and retry the same assistant to completion", async () => {
  const { repository, sqlite } = createFixture();
  const chat = await repository.createChat("user-a");
  const input = {
    clientMessageId: "retry-me",
    content: "Give me a sentence.",
    practiceContext: [{ text: "figure out", meaningMode: "all_saved" }],
  };
  const started = await repository.beginTurn("user-a", chat.id, input);

  const failed = await repository.failTurn(
    "user-a",
    chat.id,
    "retry-me",
    "provider_timeout",
    started.assistant.updatedAt,
  );
  assert.equal(failed.assistant.status, "failed");
  assert.equal(failed.assistant.errorCode, "provider_timeout");
  assert.equal(failed.user.content, input.content);
  const failedAgain = await repository.failTurn(
    "user-a",
    chat.id,
    "retry-me",
    "provider_timeout",
    failed.assistant.updatedAt,
  );
  assert.equal(failedAgain.assistant.id, started.assistant.id);

  const retry = await repository.beginTurn("user-a", chat.id, input);
  assert.equal(retry.state, "retrying");
  assert.equal(retry.assistant.id, started.assistant.id);
  assert.equal(retry.assistant.status, "pending");
  assert.equal(retry.assistant.errorCode, null);

  const completed = await repository.finishTurn("user-a", chat.id, "retry-me", {
    attemptUpdatedAt: retry.assistant.updatedAt,
    content: "I figured out the answer.",
    provider: "openrouter",
    model: "test/model",
    usage: { inputTokens: 12, outputTokens: 7 },
  });
  assert.equal(completed.assistant.status, "complete");
  assert.equal(completed.assistant.content, "I figured out the answer.");
  assert.deepEqual(completed.assistant.usage, { inputTokens: 12, outputTokens: 7 });

  const duplicateFinish = await repository.finishTurn("user-a", chat.id, "retry-me", {
    attemptUpdatedAt: completed.assistant.updatedAt,
    content: "A late competing result.",
    provider: "other",
    model: "other/model",
    usage: null,
  });
  assert.equal(duplicateFinish.assistant.content, "I figured out the answer.");
  const lateFailure = await repository.failTurn(
    "user-a",
    chat.id,
    "retry-me",
    "provider_failed",
    completed.assistant.updatedAt,
  );
  assert.equal(lateFailure.assistant.status, "complete");
  assert.equal(
    sqlite.prepare("SELECT count(*) AS count FROM ai_chat_messages WHERE chat_id = ?").get(chat.id).count,
    2,
  );

  for (const action of [
    () => repository.finishTurn("user-b", chat.id, "retry-me", {
      attemptUpdatedAt: completed.assistant.updatedAt,
      content: "No.", provider: "openrouter", model: "test/model", usage: null,
    }),
    () => repository.failTurn(
      "user-b",
      chat.id,
      "retry-me",
      "provider_failed",
      completed.assistant.updatedAt,
    ),
  ]) {
    await assert.rejects(action(), hasCode("not_found"));
  }
});

test("stale pending turns recover for retry while fresh pending turns stay single-flight", async () => {
  const { repository, sqlite } = createFixture();
  const chat = await repository.createChat("user-a");
  const input = {
    clientMessageId: "recover-me",
    content: "Give me a sentence.",
    practiceContext: [{ text: "run", meaningMode: "all_saved" }],
  };
  const started = await repository.beginTurn("user-a", chat.id, input);
  assert.equal((await repository.beginTurn("user-a", chat.id, input)).state, "existing");

  sqlite.prepare(`
    UPDATE ai_chat_messages
    SET updated_at = '2026-08-29T10:00:00.000Z'
    WHERE id = ?
  `).run(started.assistant.id);
  const recovered = await repository.beginTurn("user-a", chat.id, input);
  assert.equal(recovered.state, "retrying");
  assert.equal(recovered.assistant.id, started.assistant.id);
  assert.equal(recovered.assistant.status, "pending");
});

test("stale retry ignores terminal callbacks from the previous generation attempt", async () => {
  const { repository, sqlite } = createFixture();
  const chat = await repository.createChat("user-a");
  const input = {
    clientMessageId: "fenced-retry",
    content: "Give me a sentence.",
    practiceContext: [{ text: "run", meaningMode: "all_saved" }],
  };
  const started = await repository.beginTurn("user-a", chat.id, input);
  const staleAttempt = "2026-08-29T10:00:00.000Z";
  sqlite.prepare("UPDATE ai_chat_messages SET updated_at = ? WHERE id = ?")
    .run(staleAttempt, started.assistant.id);
  const recovered = await repository.beginTurn("user-a", chat.id, input);

  const lateCompletion = await repository.finishTurn("user-a", chat.id, "fenced-retry", {
    attemptUpdatedAt: staleAttempt,
    content: "Late answer from the stale attempt.",
    provider: "openrouter",
    model: "stale/model",
    usage: null,
  });
  assert.equal(lateCompletion.assistant.status, "pending");

  const lateFailure = await repository.failTurn(
    "user-a",
    chat.id,
    "fenced-retry",
    "provider_timeout",
    staleAttempt,
  );
  assert.equal(lateFailure.assistant.status, "pending");

  const completed = await repository.finishTurn("user-a", chat.id, "fenced-retry", {
    attemptUpdatedAt: recovered.assistant.updatedAt,
    content: "Answer from the current attempt.",
    provider: "openrouter",
    model: "current/model",
    usage: null,
  });
  assert.equal(completed.assistant.status, "complete");
  assert.equal(completed.assistant.content, "Answer from the current attempt.");
});

test("opening a chat marks an abandoned pending assistant retryable", async () => {
  const { repository, sqlite } = createFixture();
  const chat = await repository.createChat("user-a");
  const started = await repository.beginTurn("user-a", chat.id, {
    clientMessageId: "abandoned",
    content: "One example.",
    practiceContext: [],
  });
  sqlite.prepare(`
    UPDATE ai_chat_messages
    SET updated_at = '2026-08-29T10:00:00.000Z'
    WHERE id = ?
  `).run(started.assistant.id);

  const reopened = await repository.getChat("user-a", chat.id);
  const assistant = reopened.messages.find((message) => message.role === "assistant");
  assert.equal(assistant.status, "failed");
  assert.equal(assistant.errorCode, "provider_timeout");
});
