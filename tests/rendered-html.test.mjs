import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("build includes development preview metadata", async () => {
  const bundle = await readFile(
    new URL("../dist/server/index.js", import.meta.url),
    "utf8",
  );

  assert.match(bundle, /["']codex-preview["']\s*:\s*["']development["']/i);
});

test("trainer exposes word and selected-phrase actions", async () => {
  const trainer = await readFile(
    new URL("../public/trainer.html", import.meta.url),
    "utf8",
  );

  assert.match(trainer, /id="translateSelectionBtn"/);
  assert.match(trainer, /id="listenSelectionBtn"/);
  assert.match(trainer, /id="addSelectionBtn"/);
  assert.match(trainer, /fetch\("\/api\/translate"/);
  assert.doesNotMatch(trainer, /Google Cloud Translation API key/);
});

test("DeepL credentials stay in the server route", async () => {
  const route = await readFile(
    new URL("../app/api/translate/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /env as unknown as \{ DEEPL_API_KEY\?: string \}/);
  assert.match(route, /Authorization: `DeepL-Auth-Key \$\{DEEPL_API_KEY\}`/);
  assert.match(route, /target_lang: "RU"/);
});
