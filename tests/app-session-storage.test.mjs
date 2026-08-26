import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("D1 schema and migration store only hashed revocable application sessions", async () => {
  const [schema, migration, store] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0012_app_sessions.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/d1-app-sessions.ts", import.meta.url), "utf8"),
  ]);

  for (const source of [schema, migration]) {
    assert.match(source, /app_sessions/);
    assert.match(source, /token_hash/);
    assert.match(source, /user_id/);
    assert.match(source, /expires_at/);
    assert.doesNotMatch(source, /raw_token|session_token/);
  }
  assert.match(migration, /ON DELETE CASCADE/i);
  assert.match(migration, /idx_app_sessions_user/);
  assert.match(migration, /idx_app_sessions_expires/);

  assert.match(store, /INSERT INTO app_sessions/);
  assert.match(store, /DELETE FROM app_sessions WHERE expires_at <= \?/);
  assert.match(store, /DELETE FROM app_sessions WHERE token_hash = \?/);
  assert.match(store, /JOIN users/);
  assert.match(store, /WHERE sessions\.token_hash = \?/);
});
