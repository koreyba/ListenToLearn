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
  for (const migration of migrationNames().filter((name) => !name.startsWith("0016_"))) {
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
