import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PRACTICE_DEMO_ID_PREFIX,
  createPracticeDemoData,
  createPracticeDemoResetSql,
  createPracticeDemoSeedSql,
} from "../scripts/practice-demo-data.mjs";

test("local demo data deterministically creates 200 searchable Practice phrases", () => {
  const demo = createPracticeDemoData(200);

  assert.equal(demo.cards.length, 200);
  assert.equal(new Set(demo.cards.map((card) => card.id)).size, 200);
  assert.ok(demo.cards.every((card) => card.id.startsWith(PRACTICE_DEMO_ID_PREFIX)));
  assert.equal(demo.cards.at(-1).text, "Needle at the end 200");
  assert.equal(Object.keys(demo.guestState.statuses).length, 200);
  assert.ok(Object.values(demo.guestState.statuses).every((status) => status === "learning_now"));
});

test("demo SQL is local-seedable and reset only targets the namespaced fixture", () => {
  const seedSql = createPracticeDemoSeedSql(3);
  const resetSql = createPracticeDemoResetSql();

  assert.match(seedSql, /INSERT INTO phrases/);
  assert.match(seedSql, /INSERT INTO catalog_phrase_analysis/);
  assert.match(seedSql, /INSERT INTO phrase_mechanisms/);
  assert.match(seedSql, /demo-virtual-0003/);
  assert.equal(seedSql.match(/INSERT INTO/g)?.length, 3);
  assert.doesNotMatch(seedSql, /--remote/);
  assert.match(resetSql, /WHERE phrase_id LIKE 'demo-virtual-%'/);
  assert.match(resetSql, /WHERE id LIKE 'demo-virtual-%'/);
});

test("the repeatable demo commands are permanently restricted to local D1", async () => {
  const [packageJson, script] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../scripts/practice-demo-data.mjs", import.meta.url), "utf8"),
  ]);

  assert.equal(packageJson.scripts["demo:seed-practice"], "node scripts/practice-demo-data.mjs seed");
  assert.equal(packageJson.scripts["demo:reset-practice"], "node scripts/practice-demo-data.mjs reset");
  assert.match(script, /"--local"/);
  assert.doesNotMatch(script, /"--remote"/);
  assert.match(script, /stdio: \["ignore", "pipe", "pipe"\]/);
});
