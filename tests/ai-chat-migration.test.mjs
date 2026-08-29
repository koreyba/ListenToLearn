import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "drizzle");

function migrationNames() {
  return readdirSync(migrationsDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

function aiChatMigrationName() {
  const matches = migrationNames().filter((name) => name.startsWith("0016_"));
  assert.equal(matches.length, 1, "exactly one append-only 0016 migration is required");
  return matches[0];
}

function vocabularyUniquenessMigrationName() {
  const matches = migrationNames().filter((name) => name.startsWith("0017_"));
  assert.equal(matches.length, 1, "exactly one append-only 0017 migration is required");
  return matches[0];
}

function chatSingleFlightMigrationName() {
  const matches = migrationNames().filter((name) => name.startsWith("0019_"));
  assert.equal(matches.length, 1, "exactly one append-only 0019 migration is required");
  return matches[0];
}

function applyMigration(db, name) {
  db.exec(readFileSync(join(migrationsDir, name), "utf8"));
}

function tableNames(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name);
}

function indexColumns(db, tableName) {
  return new Map(db.prepare(`PRAGMA index_list('${tableName}')`).all().map((entry) => [
    entry.name,
    {
      columns: db.prepare(`PRAGMA index_info('${entry.name}')`).all().map((column) => column.name),
      unique: entry.unique === 1,
    },
  ]));
}

test("0016 is append-only and applies on a fresh database", () => {
  const name = aiChatMigrationName();
  const sql = readFileSync(join(migrationsDir, name), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
    assert.match(statement, /^CREATE (?:TABLE|(?:UNIQUE )?INDEX)\b/i);
  }

  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrationNames()) applyMigration(db, migration);

  for (const table of ["phrase_meanings", "ai_chats", "ai_chat_practice_items", "ai_chat_messages"]) {
    assert.ok(tableNames(db).includes(table), `${basename(name)} must create ${table}`);
  }

  assert.deepEqual(indexColumns(db, "phrase_meanings").get("idx_phrase_meanings_user_phrase_normalized"), {
    columns: ["user_id", "phrase_id", "normalized_translation"],
    unique: true,
  });
  assert.deepEqual(indexColumns(db, "ai_chat_messages").get("idx_ai_chat_messages_chat_sequence_unique"), {
    columns: ["chat_id", "sequence"],
    unique: true,
  });
  assert.deepEqual(indexColumns(db, "ai_chat_messages").get("idx_ai_chat_messages_chat_client_role"), {
    columns: ["chat_id", "client_message_id", "role"],
    unique: true,
  });
});

test("0016 preserves existing vocabulary, progress, examples, and videos", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrationNames().filter((migration) => migration < aiChatMigrationName())) {
    applyMigration(db, migration);
  }

  db.exec(`
    INSERT INTO users (id, email, display_name, created_at, updated_at)
    VALUES ('user-1', 'learner@example.com', 'Learner', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z');
    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status, created_at, updated_at
    ) VALUES (
      'phrase-1', 'figure out', '', 'разобраться', 'I need to figure it out.', 'custom', 'user-1', 'learning',
      '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'
    );
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
    VALUES ('user-1', 'phrase-1', 'learning', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z');
    INSERT INTO phrase_examples (
      id, user_id, phrase_id, provider, external_id, query, caption, accent, metadata, created_at
    ) VALUES (
      'example-1', 'user-1', 'phrase-1', 'youtube', 'video-1:10', 'figure out',
      'I need to figure it out.', 'american', '{}', '2026-08-29T10:00:00Z'
    );
    INSERT INTO saved_videos (
      id, user_id, youtube_video_id, origin_phrase_id, created_at, updated_at
    ) VALUES (
      'saved-1', 'user-1', 'video-1', 'phrase-1', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'
    );
  `);

  applyMigration(db, aiChatMigrationName());

  assert.deepEqual({ ...db.prepare("SELECT text, translation, status FROM phrases WHERE id = 'phrase-1'").get() }, {
    text: "figure out",
    translation: "разобраться",
    status: "learning",
  });
  assert.equal(db.prepare("SELECT count(*) AS count FROM phrase_progress").get().count, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM phrase_examples").get().count, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM saved_videos").get().count, 1);
});

test("0017 prevents case-insensitive custom duplicates per owner only", () => {
  const name = vocabularyUniquenessMigrationName();
  const sql = readFileSync(join(migrationsDir, name), "utf8");
  assert.match(sql, /CREATE UNIQUE INDEX `idx_phrases_custom_owner_text_nocase`/i);
  assert.match(sql, /WHERE .*source_type.*custom.*owner_id.*IS NOT NULL/i);

  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrationNames()) applyMigration(db, migration);
  db.exec(`
    INSERT INTO users (id, email, display_name, created_at, updated_at) VALUES
      ('user-1', '', '', 'now', 'now'),
      ('user-2', '', '', 'now', 'now');
    INSERT INTO phrases (
      id, text, pattern, source_type, owner_id, status, created_at, updated_at
    ) VALUES
      ('uniqueness-custom-1', 'Serendipity', '', 'custom', 'user-1', 'pick', 'now', 'now'),
      ('uniqueness-custom-2', 'serendipity', '', 'custom', 'user-2', 'pick', 'now', 'now'),
      ('uniqueness-preset-1', 'SERENDIPITY', '', 'preset', NULL, 'pick', 'now', 'now');
  `);
  assert.throws(() => db.exec(`
    INSERT INTO phrases (
      id, text, pattern, source_type, owner_id, status, created_at, updated_at
    ) VALUES ('uniqueness-custom-duplicate', 'SERENDIPITY', '', 'custom', 'user-1', 'pick', 'now', 'now');
  `), /UNIQUE constraint failed/);
});

test("0017 merges historical duplicates without losing learner-owned references", () => {
  const name = vocabularyUniquenessMigrationName();
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrationNames().filter((migration) => migration !== name)) {
    applyMigration(db, migration);
  }
  db.exec(`
    INSERT INTO users (id, email, display_name, created_at, updated_at)
    VALUES ('user-1', '', '', 'now', 'now');
    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status, created_at, updated_at
    ) VALUES
      ('historical-1', 'Run', '', '', '', 'custom', 'user-1', 'pick',
       '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'),
      ('historical-2', 'run', '', 'бежать', 'run daily', 'custom', 'user-1', 'pick',
       '2026-08-29T10:01:00Z', '2026-08-29T10:03:00Z');
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at) VALUES
      ('user-1', 'historical-1', 'to_learn', '2026-08-29T10:00:00Z', '2026-08-29T10:01:00Z'),
      ('user-1', 'historical-2', 'learning_now', '2026-08-29T10:01:00Z', '2026-08-29T10:02:00Z');
    INSERT INTO phrase_examples (
      id, user_id, phrase_id, provider, external_id, query, caption, accent, metadata, created_at
    ) VALUES (
      'example-duplicate', 'user-1', 'historical-2', 'youtube', 'video:1', 'run',
      'I run daily.', '', '{}', '2026-08-29T10:01:00Z'
    );
    INSERT INTO saved_videos (
      id, user_id, youtube_video_id, origin_phrase_id, created_at, updated_at
    ) VALUES (
      'saved-duplicate', 'user-1', 'video', 'historical-2',
      '2026-08-29T10:01:00Z', '2026-08-29T10:01:00Z'
    );
    INSERT INTO phrase_meanings (
      id, user_id, phrase_id, translation, normalized_translation, context, created_at, updated_at
    ) VALUES
      ('meaning-canonical', 'user-1', 'historical-1', 'бежать', 'бежать', '',
       '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'),
      ('meaning-duplicate', 'user-1', 'historical-2', 'Бежать', 'бежать', 'run daily',
       '2026-08-29T10:01:00Z', '2026-08-29T10:01:00Z'),
      ('meaning-unique', 'user-1', 'historical-2', 'управлять', 'управлять', 'run a company',
       '2026-08-29T10:02:00Z', '2026-08-29T10:02:00Z');
    INSERT INTO ai_chats (id, user_id, title, explanation_language, created_at, updated_at)
    VALUES ('chat-duplicate', 'user-1', '', 'ru', 'now', 'now');
    INSERT INTO ai_chat_practice_items (
      id, chat_id, phrase_id, text_snapshot, meaning_mode, selected_meaning_id,
      selected_meaning_snapshot, created_at, updated_at
    ) VALUES (
      'item-duplicate', 'chat-duplicate', 'historical-2', 'run', 'selected',
      'meaning-duplicate', 'Бежать', 'now', 'now'
    );
  `);

  applyMigration(db, name);

  assert.deepEqual({ ...db.prepare(`
    SELECT id, text, translation, context
    FROM phrases WHERE owner_id = 'user-1'
  `).get() }, {
    id: "historical-1",
    text: "Run",
    translation: "бежать",
    context: "run daily",
  });
  assert.deepEqual({ ...db.prepare(`
    SELECT phrase_id, status, created_at, updated_at
    FROM phrase_progress WHERE user_id = 'user-1'
  `).get() }, {
    phrase_id: "historical-1",
    status: "learning_now",
    created_at: "2026-08-29T10:00:00Z",
    updated_at: "2026-08-29T10:02:00Z",
  });
  assert.equal(
    db.prepare("SELECT phrase_id FROM phrase_examples WHERE id = 'example-duplicate'").get().phrase_id,
    "historical-1",
  );
  assert.equal(
    db.prepare("SELECT origin_phrase_id FROM saved_videos WHERE id = 'saved-duplicate'").get().origin_phrase_id,
    "historical-1",
  );
  assert.deepEqual(db.prepare(`
    SELECT id, phrase_id, translation, context, updated_at
    FROM phrase_meanings ORDER BY id
  `).all().map((row) => ({ ...row })), [{
    id: "meaning-canonical",
    phrase_id: "historical-1",
    translation: "бежать",
    context: "run daily",
    updated_at: "2026-08-29T10:01:00Z",
  }, {
    id: "meaning-unique",
    phrase_id: "historical-1",
    translation: "управлять",
    context: "run a company",
    updated_at: "2026-08-29T10:02:00Z",
  }]);
  assert.deepEqual({ ...db.prepare(`
    SELECT phrase_id, selected_meaning_id, selected_meaning_snapshot
    FROM ai_chat_practice_items WHERE id = 'item-duplicate'
  `).get() }, {
    phrase_id: "historical-1",
    selected_meaning_id: "meaning-canonical",
    selected_meaning_snapshot: "Бежать",
  });
  assert.equal(
    db.prepare(`
      SELECT count(*) AS count
      FROM sqlite_master
      WHERE type = 'index' AND name = 'idx_phrases_custom_owner_text_nocase'
    `).get().count,
    1,
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("0019 repairs duplicate pending chat attempts before enforcing single-flight", () => {
  const name = chatSingleFlightMigrationName();
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrationNames().filter((migration) => migration < name)) {
    applyMigration(db, migration);
  }
  db.exec(`
    INSERT INTO users (id, email, display_name, created_at, updated_at)
    VALUES ('user-1', '', '', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z');
    INSERT INTO ai_chats (id, user_id, title, explanation_language, created_at, updated_at)
    VALUES ('chat-1', 'user-1', '', 'ru', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z');
    INSERT INTO ai_chat_messages (
      id, chat_id, role, sequence, content, status, practice_context_json,
      client_message_id, created_at, updated_at
    ) VALUES
      ('user-old', 'chat-1', 'user', 1, 'Old', 'complete', '[]', 'old', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'),
      ('assistant-old', 'chat-1', 'assistant', 2, '', 'pending', '[]', 'old', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'),
      ('user-new', 'chat-1', 'user', 3, 'New', 'complete', '[]', 'new', '2026-08-29T10:01:00Z', '2026-08-29T10:01:00Z'),
      ('assistant-new', 'chat-1', 'assistant', 4, '', 'pending', '[]', 'new', '2026-08-29T10:01:00Z', '2026-08-29T10:01:00Z');
    INSERT INTO ai_chat_assistant_attempts (
      id, user_id, chat_id, user_message_id, assistant_message_id,
      attempt_number, status, lease_expires_at, created_at, updated_at
    ) VALUES
      ('attempt-old', 'user-1', 'chat-1', 'user-old', 'assistant-old', 1, 'pending',
       '2026-08-29T10:02:00Z', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'),
      ('attempt-new', 'user-1', 'chat-1', 'user-new', 'assistant-new', 1, 'pending',
       '2026-08-29T10:03:00Z', '2026-08-29T10:01:00Z', '2026-08-29T10:01:00Z');
  `);

  applyMigration(db, name);

  assert.deepEqual(db.prepare(`
    SELECT id, status FROM ai_chat_assistant_attempts ORDER BY id
  `).all().map((row) => ({ ...row })), [
    { id: "attempt-new", status: "pending" },
    { id: "attempt-old", status: "expired" },
  ]);
  assert.deepEqual(db.prepare(`
    SELECT id, status, error_code FROM ai_chat_messages
    WHERE role = 'assistant' ORDER BY id
  `).all().map((row) => ({ ...row })), [
    { id: "assistant-new", status: "pending", error_code: null },
    { id: "assistant-old", status: "failed", error_code: "provider_timeout" },
  ]);
  assert.deepEqual(indexColumns(db, "ai_chat_assistant_attempts")
    .get("idx_ai_chat_assistant_attempts_one_pending_chat"), {
    columns: ["chat_id"],
    unique: true,
  });
});

test("0016 foreign keys cascade owned chat data and retain practice snapshots", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrationNames()) applyMigration(db, migration);

  db.exec(`
    INSERT INTO users (id, email, display_name, created_at, updated_at)
    VALUES ('user-1', '', '', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z');
    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status, created_at, updated_at
    ) VALUES (
      'phrase-1', 'figure out', '', 'разобраться', '', 'custom', 'user-1', 'learning',
      '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'
    );
    INSERT INTO phrase_meanings (
      id, user_id, phrase_id, translation, normalized_translation, context, created_at, updated_at
    ) VALUES (
      'meaning-1', 'user-1', 'phrase-1', 'разобраться', 'разобраться', '',
      '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'
    );
    INSERT INTO ai_chats (id, user_id, title, explanation_language, created_at, updated_at)
    VALUES ('chat-1', 'user-1', 'Practice figure out', 'ru', '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z');
    INSERT INTO ai_chat_practice_items (
      id, chat_id, phrase_id, text_snapshot, meaning_mode, selected_meaning_id,
      selected_meaning_snapshot, created_at, updated_at
    ) VALUES (
      'item-1', 'chat-1', 'phrase-1', 'figure out', 'selected', 'meaning-1', 'разобраться',
      '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'
    );
    INSERT INTO ai_chat_messages (
      id, chat_id, role, sequence, content, status, practice_context_json, client_message_id,
      created_at, updated_at
    ) VALUES (
      'message-1', 'chat-1', 'user', 1, 'Give me an example.', 'complete', '[]', 'request-1',
      '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'
    );
  `);

  assert.throws(() => db.exec(`
    INSERT INTO phrase_meanings (
      id, user_id, phrase_id, translation, normalized_translation, context, created_at, updated_at
    ) VALUES (
      'meaning-duplicate', 'user-1', 'phrase-1', ' Разобраться ', 'разобраться', '',
      '2026-08-29T10:00:00Z', '2026-08-29T10:00:00Z'
    );
  `), /UNIQUE constraint failed/);

  db.exec("DELETE FROM phrases WHERE id = 'phrase-1'");
  assert.deepEqual({ ...db.prepare(`
    SELECT phrase_id, selected_meaning_id, text_snapshot, selected_meaning_snapshot
    FROM ai_chat_practice_items WHERE id = 'item-1'
  `).get() }, {
    phrase_id: null,
    selected_meaning_id: null,
    text_snapshot: "figure out",
    selected_meaning_snapshot: "разобраться",
  });

  db.exec("DELETE FROM users WHERE id = 'user-1'");
  assert.equal(db.prepare("SELECT count(*) AS count FROM ai_chats").get().count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM ai_chat_practice_items").get().count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM ai_chat_messages").get().count, 0);
});
