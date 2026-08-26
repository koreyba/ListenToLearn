import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("D1 models catalog analysis as optional data beside the base phrase", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");

  assert.match(schema, /export const catalogPhraseAnalysis = sqliteTable\("catalog_phrase_analysis"/);
  assert.match(schema, /phraseId: text\("phrase_id"\)\.primaryKey\(\)\.references\(\(\) => phrases\.id/);
  assert.match(schema, /kind: text\("kind"\)\.notNull\(\)/);
  assert.match(schema, /rank: integer\("rank"\)\.notNull\(\)/);
  assert.match(schema, /searchQuery: text\("search_query"\)\.notNull\(\)/);
  assert.match(schema, /active: integer\("active"\)[\s\S]*?\.notNull\(\)\.default\(1\)/);
});

test("D1 stores zero or more ordered mechanisms for a phrase", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");

  assert.match(schema, /export const phraseMechanisms = sqliteTable\("phrase_mechanisms"/);
  assert.match(schema, /mechanism: text\("mechanism"\)\.notNull\(\)/);
  assert.match(schema, /displayOrder: integer\("display_order"\)\.notNull\(\)/);
  assert.match(schema, /primaryKey\(\{ columns: \[table\.phraseId, table\.mechanism\] \}\)/);
});

test("append-only migrations create optional catalog analysis tables", async () => {
  const names = (await readdir(new URL("../drizzle/", import.meta.url)))
    .filter((name) => name.endsWith(".sql"));
  const migrations = (await Promise.all(names.map((name) => (
    readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8")
  )))).join("\n");

  assert.match(migrations, /CREATE TABLE `catalog_phrase_analysis`/);
  assert.match(migrations, /CREATE TABLE `phrase_mechanisms`/);
  assert.match(migrations, /FOREIGN KEY \(`phrase_id`\) REFERENCES `phrases`\(`id`\) ON UPDATE no action ON DELETE cascade/);
});
