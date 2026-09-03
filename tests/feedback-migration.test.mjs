import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "drizzle");

function migrationNames() {
  return readdirSync(migrationsDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

test("an append-only migration creates durable feedback storage", () => {
  const names = migrationNames();
  const matches = names.filter((name) => name.startsWith("0025_"));
  assert.equal(matches.length, 1, "exactly one append-only 0025 feedback migration is required");

  const sql = readFileSync(join(migrationsDir, matches[0]), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
    assert.match(statement, /^CREATE (?:TABLE|INDEX)\b/i);
  }

  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const name of names) db.exec(readFileSync(join(migrationsDir, name), "utf8"));

  const columns = db.prepare("PRAGMA table_info('feedback_submissions')").all();
  assert.deepEqual(columns.map((column) => column.name), [
    "id",
    "category",
    "message",
    "page_url",
    "user_agent",
    "telegram_status",
    "created_at",
    "telegram_delivered_at",
  ]);
  assert.deepEqual(
    db.prepare("PRAGMA index_info('idx_feedback_created')").all().map((column) => column.name),
    ["created_at"],
  );
});
