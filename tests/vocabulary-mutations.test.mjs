import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const mutationsModule = await import("../lib/vocabulary/mutations.ts").catch(() => ({}));
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

class CapturedStatement {
  constructor(sql, bindings = []) {
    this.sql = sql;
    this.bindings = bindings;
  }

  bind(...bindings) {
    return new CapturedStatement(this.sql, bindings);
  }

  async first() {
    return null;
  }
}

class CapturingDatabase {
  prepare(sql) {
    return new CapturedStatement(sql);
  }
}

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

function createSqliteFixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const migration of readdirSync(join(root, "drizzle"))
    .filter((name) => /^\d{4}_.+\.sql$/u.test(name))
    .sort()) {
    sqlite.exec(readFileSync(join(root, "drizzle", migration), "utf8"));
  }
  sqlite.exec(`
    CREATE TABLE mutation_receipts (
      id TEXT PRIMARY KEY NOT NULL,
      operation TEXT NOT NULL,
      target_key TEXT NOT NULL,
      result_json TEXT NOT NULL,
      args_hash TEXT NOT NULL CHECK(length(args_hash) = 64)
    );
    INSERT INTO users (id, email, display_name, created_at, updated_at) VALUES
      ('user-a', 'a@example.com', 'A', '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'),
      ('user-b', 'b@example.com', 'B', '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z');
  `);
  let id = 0;
  let milliseconds = Date.parse("2026-08-29T12:00:00.000Z");
  const database = new SQLiteD1Database(sqlite);
  const planner = mutationsModule.createVocabularyMutationPlanner(database, {
    createId: (kind) => `${kind}-${++id}`,
    now: () => new Date(milliseconds++).toISOString(),
  });
  return { database, planner, sqlite };
}

async function executePlan(database, plan, receiptId) {
  const receipt = database.prepare(`
    INSERT INTO mutation_receipts (id, operation, target_key, result_json, args_hash)
    SELECT ?, ?, ?, ?, CASE
      WHEN ${plan.receiptGuard.sql} THEN ?
      ELSE ''
    END
  `).bind(
    receiptId,
    plan.operation,
    plan.targetKey,
    JSON.stringify(plan.canonicalResult),
    ...plan.receiptGuard.bindings,
    "a".repeat(64),
  );
  const results = await database.batch([...plan.statements, receipt]);
  return results.at(-1).meta.changes;
}

test("add-entry plans expose stable receipt metadata and bound D1 statements", async () => {
  assert.equal(typeof mutationsModule.createVocabularyMutationPlanner, "function");
  const planner = mutationsModule.createVocabularyMutationPlanner(
    new CapturingDatabase(),
    {
      createId: (kind) => `${kind}-fixed`,
      now: () => "2026-08-29T12:00:00.000Z",
    },
  );

  const plan = await planner.planAddEntry("user-a", {
    text: "  Break   Even  ",
    translation: "  Окупаться  ",
    context: "A startup breaks even.",
  });

  assert.deepEqual({
    operation: plan.operation,
    targetKey: plan.targetKey,
    canonicalArgs: plan.canonicalArgs,
    canonicalResult: plan.canonicalResult,
    entityType: plan.entityType,
    entityId: plan.entityId,
  }, {
    operation: "vocabulary.add-entry/v1",
    targetKey: "break even",
    canonicalArgs: {
      text: "Break Even",
      translation: "Окупаться",
      context: "A startup breaks even.",
    },
    canonicalResult: {
      ok: true,
      saved: true,
      text: "Break Even",
    },
    entityType: "phrase",
    entityId: null,
  });
  assert.ok(plan.statements.length >= 2);
  assert.ok(plan.statements.every((statement) => statement instanceof CapturedStatement));
  assert.equal(typeof plan.receiptGuard?.sql, "string");
  assert.ok(Array.isArray(plan.receiptGuard?.bindings));

  const sql = [
    ...plan.statements.map((statement) => statement.sql),
    plan.receiptGuard.sql,
  ].join("\n");
  assert.doesNotMatch(sql, /Break\s+Even|Окупаться|startup/u);
});

test("add-entry receipt keys match SQLite NOCASE instead of folding Unicode", async () => {
  const planner = mutationsModule.createVocabularyMutationPlanner(
    new CapturingDatabase(),
    {
      createId: (kind) => `${kind}-fixed`,
      now: () => "2026-08-29T12:00:00.000Z",
    },
  );

  const plan = await planner.planAddEntry("user-a", { text: "ÄRGER" });

  assert.equal(plan.targetKey, "Ärger");

  const compatibility = await planner.planAddEntry("user-a", {
    text: "Ｐｏｌｉｓｈ",
  });
  assert.equal(compatibility.targetKey, "Ｐｏｌｉｓｈ");
  assert.equal(compatibility.canonicalArgs.text, "Ｐｏｌｉｓｈ");
});

test("add-entry domain statements create one custom entry and compose atomically with a receipt", async () => {
  const { database, planner, sqlite } = createSqliteFixture();
  const first = await planner.planAddEntry("user-a", {
    text: "  Break   Even ",
    translation: " окупаться ",
    context: "The company broke even.",
  });

  assert.equal(await executePlan(database, first, "receipt-1"), 1);
  assert.deepEqual({ ...sqlite.prepare(`
    SELECT phrases.text, phrases.translation, phrases.context, phrases.owner_id,
      progress.status
    FROM phrases
    JOIN phrase_progress AS progress ON progress.phrase_id = phrases.id
    WHERE progress.user_id = 'user-a' AND phrases.text = 'Break Even' COLLATE NOCASE
  `).get() }, {
    text: "Break Even",
    translation: "",
    context: "",
    owner_id: "user-a",
    status: "to_learn",
  });
  assert.deepEqual({ ...sqlite.prepare(`
    SELECT translation, normalized_translation, context
    FROM phrase_meanings WHERE user_id = 'user-a'
  `).get() }, {
    translation: "окупаться",
    normalized_translation: "окупаться",
    context: "The company broke even.",
  });

  const retry = await planner.planAddEntry("user-a", {
    text: "break even",
    translation: "ОКУПАТЬСЯ",
  });
  assert.equal(await executePlan(database, retry, "receipt-2"), 1);
  assert.equal(sqlite.prepare(`
    SELECT count(*) AS count
    FROM phrases
    WHERE owner_id = 'user-a' AND text = 'break even' COLLATE NOCASE
  `).get().count, 1);
  assert.equal(sqlite.prepare(`
    SELECT context FROM phrase_meanings
    WHERE user_id = 'user-a' AND normalized_translation = 'окупаться'
  `).get().context, "The company broke even.");
});

test("add-meaning plans a normalized idempotent upsert that preserves omitted context", async () => {
  const { database, planner, sqlite } = createSqliteFixture();
  sqlite.exec(`
    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status,
      created_at, updated_at
    ) VALUES (
      'phrase-run', 'run', '', 'бежать', 'run daily', 'preset', NULL, 'pick',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
    VALUES (
      'user-a', 'phrase-run', 'learning_now',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
  `);

  const first = await planner.planAddMeaning("user-a", {
    phraseId: " phrase-run ",
    translation: "  Управлять  ",
    context: "run a company",
  });
  assert.deepEqual({
    operation: first.operation,
    targetKey: first.targetKey,
    canonicalArgs: first.canonicalArgs,
    canonicalResult: first.canonicalResult,
    entityType: first.entityType,
    entityId: first.entityId,
  }, {
    operation: "vocabulary.add-meaning/v1",
    targetKey: "phrase-run:управлять",
    canonicalArgs: {
      phraseId: "phrase-run",
      translation: "Управлять",
      context: "run a company",
    },
    canonicalResult: {
      ok: true,
      saved: true,
      phraseId: "phrase-run",
      translation: "Управлять",
    },
    entityType: "meaning",
    entityId: null,
  });
  assert.equal(await executePlan(database, first, "receipt-meaning-1"), 1);

  const retry = await planner.planAddMeaning("user-a", {
    phraseId: "phrase-run",
    translation: "управлять",
  });
  assert.equal(await executePlan(database, retry, "receipt-meaning-2"), 1);
  assert.deepEqual({ ...sqlite.prepare(`
    SELECT translation, normalized_translation, context
    FROM phrase_meanings
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-run'
  `).get() }, {
    translation: "управлять",
    normalized_translation: "управлять",
    context: "run a company",
  });
  assert.equal(sqlite.prepare(`
    SELECT count(*) AS count FROM phrase_meanings
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-run'
  `).get().count, 1);
});

test("update-meaning plans an owned active update while preserving omitted context", async () => {
  const { database, planner, sqlite } = createSqliteFixture();
  sqlite.exec(`
    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status,
      created_at, updated_at
    ) VALUES (
      'phrase-run', 'run', '', 'бежать', 'run daily', 'preset', NULL, 'pick',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
    VALUES (
      'user-a', 'phrase-run', 'learnt',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
    INSERT INTO phrase_meanings (
      id, user_id, phrase_id, translation, normalized_translation, context,
      created_at, updated_at
    ) VALUES (
      'meaning-run', 'user-a', 'phrase-run', 'управлять', 'управлять',
      'run a company', '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
  `);

  const plan = await planner.planUpdateMeaning("user-a", {
    meaningId: " meaning-run ",
    phraseId: "phrase-run",
    expectedTranslation: "управлять",
    expectedContext: "run a company",
    translation: "  Руководить  ",
  });
  assert.deepEqual({
    operation: plan.operation,
    targetKey: plan.targetKey,
    canonicalArgs: plan.canonicalArgs,
    canonicalResult: plan.canonicalResult,
    entityType: plan.entityType,
    entityId: plan.entityId,
  }, {
    operation: "vocabulary.update-meaning/v1",
    targetKey: "meaning-run",
    canonicalArgs: {
      meaningId: "meaning-run",
      phraseId: "phrase-run",
      expectedTranslation: "управлять",
      expectedContext: "run a company",
      translation: "Руководить",
    },
    canonicalResult: {
      ok: true,
      updated: true,
      meaningId: "meaning-run",
      translation: "Руководить",
    },
    entityType: "meaning",
    entityId: "meaning-run",
  });
  assert.equal(await executePlan(database, plan, "receipt-update-1"), 1);
  assert.deepEqual({ ...sqlite.prepare(`
    SELECT translation, normalized_translation, context
    FROM phrase_meanings WHERE id = 'meaning-run'
  `).get() }, {
    translation: "Руководить",
    normalized_translation: "руководить",
    context: "run a company",
  });
});

test("explicit add activates only pick while preserving every active status", async () => {
  const { database, planner, sqlite } = createSqliteFixture();
  const statuses = ["pick", "to_learn", "learning_now", "learnt", "learned"];
  for (const [index, status] of statuses.entries()) {
    sqlite.prepare(`
      INSERT INTO phrases (
        id, text, pattern, translation, context, source_type, owner_id, status,
        created_at, updated_at
      ) VALUES (?, ?, '', '', '', 'preset', NULL, 'pick', ?, ?)
    `).run(
      `phrase-${status}`,
      `entry ${status}`,
      "2026-08-29T10:00:00.000Z",
      "2026-08-29T10:00:00.000Z",
    );
    sqlite.prepare(`
      INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
      VALUES ('user-a', ?, ?, ?, ?)
    `).run(
      `phrase-${status}`,
      status,
      "2026-08-29T10:00:00.000Z",
      "2026-08-29T10:00:00.000Z",
    );
    const plan = await planner.planAddEntry("user-a", { text: `entry ${status}` });
    assert.equal(await executePlan(database, plan, `receipt-status-${index}`), 1);
  }

  assert.deepEqual(sqlite.prepare(`
    SELECT phrase_id, status
    FROM phrase_progress
    WHERE user_id = 'user-a' AND phrase_id LIKE 'phrase-%'
    ORDER BY phrase_id
  `).all().map((row) => ({ ...row })), [
    { phrase_id: "phrase-learned", status: "learned" },
    { phrase_id: "phrase-learning_now", status: "learning_now" },
    { phrase_id: "phrase-learnt", status: "learnt" },
    { phrase_id: "phrase-pick", status: "to_learn" },
    { phrase_id: "phrase-to_learn", status: "to_learn" },
  ]);
});

test("preset add keeps legacy fields immutable and stores the user translation personally", async () => {
  const { database, planner, sqlite } = createSqliteFixture();
  sqlite.exec(`
    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status,
      created_at, updated_at
    ) VALUES (
      'phrase-run', 'run', '', 'бежать', 'run daily', 'preset', NULL, 'pick',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
    VALUES (
      'user-a', 'phrase-run', 'learned',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
  `);

  const first = await planner.planAddEntry("user-a", {
    text: "run",
    translation: "управлять",
    context: "run a company",
  });
  assert.equal(await executePlan(database, first, "receipt-preset-1"), 1);
  const retry = await planner.planAddEntry("user-a", {
    text: "RUN",
    translation: "УПРАВЛЯТЬ",
  });
  assert.equal(await executePlan(database, retry, "receipt-preset-2"), 1);

  assert.deepEqual({ ...sqlite.prepare(`
    SELECT translation, context, updated_at
    FROM phrases WHERE id = 'phrase-run'
  `).get() }, {
    translation: "бежать",
    context: "run daily",
    updated_at: "2026-08-29T10:00:00.000Z",
  });
  assert.deepEqual({ ...sqlite.prepare(`
    SELECT translation, normalized_translation, context
    FROM phrase_meanings
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-run'
  `).get() }, {
    translation: "УПРАВЛЯТЬ",
    normalized_translation: "управлять",
    context: "run a company",
  });
  assert.equal(sqlite.prepare(`
    SELECT status FROM phrase_progress
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-run'
  `).get().status, "learned");
});

test("preset add records an explicitly supplied equivalent translation as personal", async () => {
  const { database, planner, sqlite } = createSqliteFixture();
  sqlite.exec(`
    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status,
      created_at, updated_at
    ) VALUES (
      'phrase-run', 'run', '', 'Бежать', 'run daily', 'preset', NULL, 'pick',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
    VALUES (
      'user-a', 'phrase-run', 'to_learn',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
  `);

  const plan = await planner.planAddEntry("user-a", {
    text: "run",
    translation: "бежать",
    context: "a newly proposed context",
  });
  assert.equal(await executePlan(database, plan, "receipt-preset-equivalent"), 1);
  assert.equal(sqlite.prepare(`
    SELECT count(*) AS count
    FROM phrase_meanings
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-run'
  `).get().count, 1);
  assert.deepEqual({ ...sqlite.prepare(`
    SELECT translation, context FROM phrase_meanings
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-run'
  `).get() }, {
    translation: "бежать",
    context: "a newly proposed context",
  });
  assert.deepEqual({ ...sqlite.prepare(`
    SELECT translation, context FROM phrases WHERE id = 'phrase-run'
  `).get() }, {
    translation: "Бежать",
    context: "run daily",
  });
});

test("concurrent custom adds retain the losing translation as a personal meaning", async () => {
  const { database, planner, sqlite } = createSqliteFixture();
  const first = await planner.planAddEntry("user-a", {
    text: "break even",
    translation: "окупаться",
    context: "cover the costs",
  });
  const concurrent = await planner.planAddEntry("user-a", {
    text: "BREAK EVEN",
    translation: "выйти в ноль",
    context: "reach zero profit",
  });

  assert.equal(await executePlan(database, first, "receipt-race-1"), 1);
  assert.equal(await executePlan(database, concurrent, "receipt-race-2"), 1);
  assert.equal(sqlite.prepare(`
    SELECT count(*) AS count
    FROM phrases
    WHERE owner_id = 'user-a' AND text = 'break even' COLLATE NOCASE
  `).get().count, 1);
  assert.deepEqual({ ...sqlite.prepare(`
    SELECT translation, context
    FROM phrases
    WHERE owner_id = 'user-a' AND text = 'break even' COLLATE NOCASE
  `).get() }, {
    translation: "",
    context: "",
  });
  assert.deepEqual(sqlite.prepare(`
    SELECT translation, normalized_translation, context
    FROM phrase_meanings
    WHERE user_id = 'user-a'
    ORDER BY normalized_translation
  `).all().map((row) => ({ ...row })), [{
    translation: "выйти в ноль",
    normalized_translation: "выйти в ноль",
    context: "reach zero profit",
  }, {
    translation: "окупаться",
    normalized_translation: "окупаться",
    context: "cover the costs",
  }]);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM mutation_receipts").get().count, 2);
});

test("meaning guards reject foreign or inactive entries and roll back the whole batch", async () => {
  const { database, planner, sqlite } = createSqliteFixture();
  sqlite.exec(`
    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status,
      created_at, updated_at
    ) VALUES (
      'phrase-a', 'owned phrase', '', '', '', 'custom', 'user-a', 'pick',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
    VALUES (
      'user-a', 'phrase-a', 'pick',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
    INSERT INTO phrase_meanings (
      id, user_id, phrase_id, translation, normalized_translation, context,
      created_at, updated_at
    ) VALUES (
      'meaning-a', 'user-a', 'phrase-a', 'старый', 'старый', 'old context',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
  `);

  const inactiveAdd = await planner.planAddMeaning("user-a", {
    phraseId: "phrase-a",
    translation: "новый",
  });
  await assert.rejects(
    executePlan(database, inactiveAdd, "receipt-inactive-add"),
    /CHECK constraint failed/u,
  );

  const foreignAdd = await planner.planAddMeaning("user-b", {
    phraseId: "phrase-a",
    translation: "чужой",
  });
  await assert.rejects(
    executePlan(database, foreignAdd, "receipt-foreign-add"),
    /CHECK constraint failed/u,
  );

  const inactiveUpdate = await planner.planUpdateMeaning("user-a", {
    meaningId: "meaning-a",
    phraseId: "phrase-a",
    expectedTranslation: "старый",
    expectedContext: "old context",
    translation: "обновлённый",
  });
  await assert.rejects(
    executePlan(database, inactiveUpdate, "receipt-inactive-update"),
    /CHECK constraint failed/u,
  );

  const foreignUpdate = await planner.planUpdateMeaning("user-b", {
    meaningId: "meaning-a",
    phraseId: "phrase-a",
    expectedTranslation: "старый",
    expectedContext: "old context",
    translation: "чужой",
  });
  await assert.rejects(
    executePlan(database, foreignUpdate, "receipt-foreign-update"),
    /CHECK constraint failed/u,
  );

  assert.deepEqual(sqlite.prepare(`
    SELECT user_id, translation, context
    FROM phrase_meanings ORDER BY id
  `).all().map((row) => ({ ...row })), [{
    user_id: "user-a",
    translation: "старый",
    context: "old context",
  }]);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM mutation_receipts").get().count, 0);
});

test("explicit context replaces or clears it while omission preserves it", async () => {
  const { database, planner, sqlite } = createSqliteFixture();
  sqlite.exec(`
    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status,
      created_at, updated_at
    ) VALUES (
      'phrase-run', 'run', '', '', '', 'preset', NULL, 'pick',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
    VALUES (
      'user-a', 'phrase-run', 'to_learn',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
  `);

  const initial = await planner.planAddMeaning("user-a", {
    phraseId: "phrase-run",
    translation: "управлять",
    context: "run a team",
  });
  assert.equal(await executePlan(database, initial, "receipt-context-1"), 1);
  const omitted = await planner.planAddMeaning("user-a", {
    phraseId: "phrase-run",
    translation: "управлять",
  });
  assert.equal(await executePlan(database, omitted, "receipt-context-2"), 1);
  const cleared = await planner.planAddMeaning("user-a", {
    phraseId: "phrase-run",
    translation: "управлять",
    context: "",
  });
  assert.equal(Object.hasOwn(cleared.canonicalArgs, "context"), true);
  assert.equal(await executePlan(database, cleared, "receipt-context-3"), 1);
  const meaningId = sqlite.prepare(`
    SELECT id FROM phrase_meanings
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-run'
  `).get().id;
  assert.equal(sqlite.prepare("SELECT context FROM phrase_meanings WHERE id = ?").get(meaningId).context, "");

  const replaced = await planner.planUpdateMeaning("user-a", {
    meaningId,
    phraseId: "phrase-run",
    expectedTranslation: "управлять",
    expectedContext: "",
    translation: "руководить",
    context: "run the department",
  });
  assert.equal(await executePlan(database, replaced, "receipt-context-4"), 1);
  assert.deepEqual({ ...sqlite.prepare(`
    SELECT translation, context FROM phrase_meanings WHERE id = ?
  `).get(meaningId) }, {
    translation: "руководить",
    context: "run the department",
  });
});

test("update-meaning compare-and-swap rejects a stale or wrong selected meaning", async () => {
  const { database, planner, sqlite } = createSqliteFixture();
  sqlite.exec(`
    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status,
      created_at, updated_at
    ) VALUES (
      'phrase-run', 'run', '', '', '', 'custom', 'user-a', 'pick',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
    VALUES (
      'user-a', 'phrase-run', 'learning_now',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
    INSERT INTO phrase_meanings (
      id, user_id, phrase_id, translation, normalized_translation, context,
      created_at, updated_at
    ) VALUES (
      'meaning-run', 'user-a', 'phrase-run', 'управлять', 'управлять',
      'run a company', '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
  `);

  const stale = await planner.planUpdateMeaning("user-a", {
    meaningId: "meaning-run",
    phraseId: "phrase-run",
    expectedTranslation: "управлять",
    expectedContext: "run a company",
    translation: "руководить",
  });
  sqlite.exec(`
    UPDATE phrase_meanings
    SET translation = 'вести', normalized_translation = 'вести', context = 'lead a team'
    WHERE id = 'meaning-run'
  `);
  await assert.rejects(
    executePlan(database, stale, "receipt-stale-update"),
    /CHECK constraint failed/u,
  );
  assert.deepEqual({ ...sqlite.prepare(`
    SELECT translation, context FROM phrase_meanings WHERE id = 'meaning-run'
  `).get() }, { translation: "вести", context: "lead a team" });

  const wrongEntry = await planner.planUpdateMeaning("user-a", {
    meaningId: "meaning-run",
    phraseId: "phrase-other",
    expectedTranslation: "вести",
    expectedContext: "lead a team",
    translation: "руководить",
  });
  await assert.rejects(
    executePlan(database, wrongEntry, "receipt-wrong-entry"),
    /CHECK constraint failed/u,
  );
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM mutation_receipts").get().count, 0);
});

test("owner-scoped legacy meaning is atomically promoted to a personal meaning", async () => {
  const { database, planner, sqlite } = createSqliteFixture();
  sqlite.exec(`
    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status,
      created_at, updated_at
    ) VALUES (
      'phrase-legacy', 'break even', '', 'окупаться', 'the business breaks even',
      'custom', 'user-a', 'pick',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
    VALUES (
      'user-a', 'phrase-legacy', 'learning_now',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
    );
  `);

  const promoted = await planner.planUpdateMeaning("user-a", {
    meaningId: "legacy:phrase-legacy",
    phraseId: "phrase-legacy",
    expectedTranslation: "окупаться",
    expectedContext: "the business breaks even",
    translation: "выходить в ноль",
    context: "the startup broke even",
  });
  assert.match(promoted.canonicalResult.meaningId, /^meaning-/u);
  assert.equal(promoted.entityId, promoted.canonicalResult.meaningId);
  assert.equal(await executePlan(database, promoted, "receipt-promote-legacy"), 1);

  assert.deepEqual({ ...sqlite.prepare(`
    SELECT translation, context FROM phrases WHERE id = 'phrase-legacy'
  `).get() }, { translation: "", context: "" });
  assert.deepEqual({ ...sqlite.prepare(`
    SELECT id, translation, normalized_translation, context
    FROM phrase_meanings
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-legacy'
  `).get() }, {
    id: promoted.canonicalResult.meaningId,
    translation: "выходить в ноль",
    normalized_translation: "выходить в ноль",
    context: "the startup broke even",
  });
  assert.equal(sqlite.prepare(`
    SELECT status FROM phrase_progress
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-legacy'
  `).get().status, "learning_now");

  const directlyUpdated = await planner.planUpdateMeaning("user-a", {
    meaningId: promoted.canonicalResult.meaningId,
    phraseId: "phrase-legacy",
    expectedTranslation: "выходить в ноль",
    expectedContext: "the startup broke even",
    translation: "достигать безубыточности",
  });
  assert.equal(await executePlan(database, directlyUpdated, "receipt-update-promoted"), 1);
  assert.equal(sqlite.prepare(`
    SELECT translation FROM phrase_meanings WHERE id = ?
  `).get(promoted.canonicalResult.meaningId).translation, "достигать безубыточности");
});

test("scoped legacy promotion rejects stale, mismatched, and foreign targets", async () => {
  for (const attempted of [
    {
      userId: "user-a",
      meaningId: "legacy:phrase-legacy",
      phraseId: "phrase-legacy",
      expectedTranslation: "устаревший перевод",
    },
    {
      userId: "user-a",
      meaningId: "legacy:phrase-other",
      phraseId: "phrase-legacy",
      expectedTranslation: "окупаться",
    },
    {
      userId: "user-b",
      meaningId: "legacy:phrase-legacy",
      phraseId: "phrase-legacy",
      expectedTranslation: "окупаться",
    },
  ]) {
    const { database, planner, sqlite } = createSqliteFixture();
    sqlite.exec(`
      INSERT INTO phrases (
        id, text, pattern, translation, context, source_type, owner_id, status,
        created_at, updated_at
      ) VALUES (
        'phrase-legacy', 'break even', '', 'окупаться', 'the business breaks even',
        'custom', 'user-a', 'pick',
        '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
      );
      INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
      VALUES (
        'user-a', 'phrase-legacy', 'learning_now',
        '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'
      );
    `);
    const plan = await planner.planUpdateMeaning(attempted.userId, {
      meaningId: attempted.meaningId,
      phraseId: attempted.phraseId,
      expectedTranslation: attempted.expectedTranslation,
      expectedContext: "the business breaks even",
      translation: "выходить в ноль",
    });
    await assert.rejects(
      executePlan(database, plan, `receipt-${attempted.userId}-${attempted.meaningId}`),
      /CHECK constraint failed/u,
    );
    assert.deepEqual({ ...sqlite.prepare(`
      SELECT translation, context FROM phrases WHERE id = 'phrase-legacy'
    `).get() }, {
      translation: "окупаться",
      context: "the business breaks even",
    });
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM phrase_meanings").get().count, 0);
    sqlite.close();
  }
});

test("set-category plans canonicalize Learned and enforce owner-scoped compare-and-set", async () => {
  const { database, planner, sqlite } = createSqliteFixture();
  sqlite.exec(`
    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status,
      created_at, updated_at
    ) VALUES
      ('phrase-run', 'run', '', '', '', 'preset', NULL, 'pick',
       '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'),
      ('phrase-private', 'private', '', '', '', 'custom', 'user-b', 'pick',
       '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z');
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at) VALUES
      ('user-a', 'phrase-run', 'learned',
       '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z'),
      ('user-a', 'phrase-private', 'to_learn',
       '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z');
  `);

  const selfHeal = await planner.planSetCategory("user-a", {
    phraseId: "phrase-run",
    expectedStoredStatus: "learned",
    category: "learned",
  });
  assert.deepEqual({
    operation: selfHeal.operation,
    targetKey: selfHeal.targetKey,
    canonicalArgs: selfHeal.canonicalArgs,
    canonicalResult: selfHeal.canonicalResult,
    entityType: selfHeal.entityType,
    entityId: selfHeal.entityId,
  }, {
    operation: "vocabulary.set-category/v1",
    targetKey: "phrase-run",
    canonicalArgs: { phraseId: "phrase-run", category: "learned" },
    canonicalResult: {
      ok: true,
      updated: true,
      phraseId: "phrase-run",
      category: "learned",
    },
    entityType: "phrase",
    entityId: "phrase-run",
  });
  assert.equal(await executePlan(database, selfHeal, "receipt-category-self-heal"), 1);
  assert.deepEqual({ ...sqlite.prepare(`
    SELECT status, updated_at FROM phrase_progress
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-run'
  `).get() }, {
    status: "learnt",
    updated_at: "2026-08-29T12:00:00.000Z",
  });

  const noOp = await planner.planSetCategory("user-a", {
    phraseId: "phrase-run",
    expectedStoredStatus: "learnt",
    category: "learned",
  });
  assert.equal(await executePlan(database, noOp, "receipt-category-noop"), 1);
  assert.equal(sqlite.prepare(`
    SELECT updated_at FROM phrase_progress
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-run'
  `).get().updated_at, "2026-08-29T12:00:00.000Z");

  const stale = await planner.planSetCategory("user-a", {
    phraseId: "phrase-run",
    expectedStoredStatus: "learnt",
    category: "to_learn",
  });
  sqlite.exec(`
    UPDATE phrase_progress SET status = 'learning_now'
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-run';
  `);
  await assert.rejects(
    executePlan(database, stale, "receipt-category-stale"),
    /CHECK constraint failed/u,
  );
  assert.equal(sqlite.prepare(`
    SELECT status FROM phrase_progress
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-run'
  `).get().status, "learning_now");

  const foreign = await planner.planSetCategory("user-a", {
    phraseId: "phrase-private",
    expectedStoredStatus: "to_learn",
    category: "learning",
  });
  await assert.rejects(
    executePlan(database, foreign, "receipt-category-foreign"),
    /CHECK constraint failed/u,
  );
  assert.equal(sqlite.prepare(`
    SELECT status FROM phrase_progress
    WHERE user_id = 'user-a' AND phrase_id = 'phrase-private'
  `).get().status, "to_learn");

  await assert.rejects(
    planner.planSetCategory("user-a", {
      phraseId: "phrase-run",
      expectedStoredStatus: "learning_now",
      category: "pick",
    }),
    /category is invalid/iu,
  );
  sqlite.close();
});
