import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PRACTICE_VIRTUALIZATION_THRESHOLD,
  filterPracticePhrases,
  practiceVirtualRow,
  practiceVirtualRowCount,
  shouldVirtualizePracticeList,
} from "../lib/practice-list.ts";

function fakePhrases(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `phrase-${index}`,
    text: `Practice phrase ${index}`,
    translation: index === count - 1 ? "последняя иголка" : `перевод ${index}`,
    context: `Context ${index}`,
    pattern: `[practice phrase ${index}]`,
    ipa: `ipa-${index}`,
  }));
}

test("instant Practice search filters the complete collection before virtualization", () => {
  const phrases = fakePhrases(200);

  assert.deepEqual(
    filterPracticePhrases(phrases, "  ПОСЛЕДНЯЯ ИГОЛКА ").map((phrase) => phrase.id),
    ["phrase-199"],
  );
  assert.equal(filterPracticePhrases(phrases, "").length, 200);
});

test("Practice virtualizes only lists larger than the 50-card fast path", () => {
  assert.equal(PRACTICE_VIRTUALIZATION_THRESHOLD, 50);
  assert.equal(shouldVirtualizePracticeList(0), false);
  assert.equal(shouldVirtualizePracticeList(50), false);
  assert.equal(shouldVirtualizePracticeList(51), true);
});

test("the final virtual row handles an odd last item and stops safely at the end", () => {
  const phrases = fakePhrases(51);

  assert.equal(practiceVirtualRowCount(phrases.length), 26);
  assert.deepEqual(practiceVirtualRow(phrases, 25).map((phrase) => phrase.id), ["phrase-50"]);
  assert.deepEqual(practiceVirtualRow(phrases, 26), []);
  assert.deepEqual(practiceVirtualRow(phrases, -1), []);
});

test("Practice exposes synchronous search over the filtered phrase collection", async () => {
  const workspace = await readFile(
    new URL("../app/components/phrase-workspace.tsx", import.meta.url),
    "utf8",
  );

  assert.match(workspace, /const \[practiceSearch, setPracticeSearch\] = useState\(""\)/);
  assert.match(workspace, /filterPracticePhrases\(sortedForSurface, practiceSearch\)/);
  assert.match(workspace, />Search your phrases</);
  assert.match(workspace, /onChange=\{\(event\) => setPracticeSearch\(event\.target\.value\)\}/);
});

test("only Practice routes large phrase collections through the virtual grid", async () => {
  const workspace = await readFile(
    new URL("../app/components/phrase-workspace.tsx", import.meta.url),
    "utf8",
  );

  assert.match(workspace, /import \{ PracticePhraseGrid \} from "@\/app\/components\/practice-phrase-grid"/);
  assert.match(workspace, /surface === "practice" \? \(\s*<PracticePhraseGrid/);
  assert.match(workspace, /<div className="phrase-grid">/);
});
