import assert from "node:assert/strict";
import test from "node:test";

import { CONNECTED_SPEECH_CARDS } from "../lib/catalog/connected-speech-catalog.ts";
import {
  generateConnectedSpeechCatalogSql,
  replaceGeneratedCatalogSql,
  sqlLiteral,
} from "../scripts/generate-connected-speech-migration.mjs";

test("catalog migration generation is deterministic and projects every active card", () => {
  const first = generateConnectedSpeechCatalogSql(CONNECTED_SPEECH_CARDS);
  const second = generateConnectedSpeechCatalogSql(CONNECTED_SPEECH_CARDS);

  assert.equal(first, second);
  assert.equal((first.match(/INSERT INTO phrases /g) || []).length, 140);
  assert.equal((first.match(/INSERT INTO catalog_phrase_analysis /g) || []).length, 140);
  assert.equal((first.match(/INSERT INTO phrase_mechanisms /g) || []).length, 230);
});

test("rewriting a migration is idempotent and keeps one generated-section boundary", () => {
  const initial = `CREATE TABLE example (id text);\n--> statement-breakpoint\n-- generated connected-speech catalog; edit the TypeScript catalog, not this SQL\nold generated data\n`;
  const once = replaceGeneratedCatalogSql(initial, CONNECTED_SPEECH_CARDS);
  const twice = replaceGeneratedCatalogSql(once, CONNECTED_SPEECH_CARDS);

  assert.equal(twice, once);
  assert.match(once, /CREATE TABLE example \(id text\);\n--> statement-breakpoint\n-- generated connected-speech catalog/);
  assert.doesNotMatch(once, /(?:--> statement-breakpoint\n){2,}-- generated connected-speech catalog/);
});

test("catalog migration uses stable upserts without deleting progress or references", () => {
  const sql = generateConnectedSpeechCatalogSql(CONNECTED_SPEECH_CARDS);

  assert.match(sql, /ON CONFLICT\(id\) DO UPDATE SET/);
  assert.match(sql, /ON CONFLICT\(phrase_id\) DO UPDATE SET/);
  assert.match(sql, /ON CONFLICT\(phrase_id, mechanism\) DO UPDATE SET/);
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+(?:phrases|phrase_progress|phrase_examples|saved_videos)/i);
  assert.doesNotMatch(sql, /UPDATE phrases[\s\S]*?status\s*=/i);
  assert.doesNotMatch(sql, /ON CONFLICT\(id\) DO UPDATE SET[\s\S]*?updated_at\s*=\s*excluded\.updated_at/);
});

test("catalog migration escapes apostrophes while preserving IPA text", () => {
  assert.equal(sqlLiteral("that's /ɾ/"), "'that''s /ɾ/'");

  const sql = generateConnectedSpeechCatalogSql([{
    id: "quote-card",
    text: "that's it",
    pattern: "[that's it]",
    ipa: "ðætsɪt",
    kind: "stack",
    mechanisms: ["linking"],
    rank: 1,
  }]);

  assert.match(sql, /'that''s it'/);
  assert.match(sql, /'ðætsɪt'/);
});
