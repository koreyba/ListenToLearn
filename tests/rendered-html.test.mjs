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
  assert.doesNotMatch(trainer, /state\.translationCache/);
  assert.doesNotMatch(trainer, /Google Cloud Translation API key/);
});

test("trainer can switch between Tatoeba and YouGlish", async () => {
  const trainer = await readFile(
    new URL("../public/trainer.html", import.meta.url),
    "utf8",
  );
  const tatoebaRoute = await readFile(
    new URL("../app/api/tatoeba/route.ts", import.meta.url),
    "utf8",
  );
  const audioRoute = await readFile(
    new URL("../app/api/tatoeba/audio/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(trainer, /id="sourceSwitch"/);
  assert.match(trainer, /data-source="tatoeba"/);
  assert.match(trainer, /data-source="youglish"/);
  assert.match(trainer, /id="tatoebaAudio"/);
  assert.match(trainer, /fetch\(`\/api\/tatoeba\?q=/);
  assert.match(tatoebaRoute, /https:\/\/api\.tatoeba\.org\/v1\/sentences/);
  assert.match(audioRoute, /https:\/\/api\.tatoeba\.org\/v1\/audios\/\$\{id\}\/file/);
});

test("DeepL credentials stay in the shared server helper", async () => {
  const helper = await readFile(
    new URL("../lib/deepl.ts", import.meta.url),
    "utf8",
  );

  assert.match(helper, /env as unknown as \{ DEEPL_API_KEY\?: string \}/);
  assert.match(helper, /Authorization: `DeepL-Auth-Key \$\{DEEPL_API_KEY\}`/);
  assert.match(helper, /target_lang: "RU"/);
});

test("learning phrases persist and render their translation", async () => {
  const route = await readFile(
    new URL("../app/api/phrases/route.ts", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(route, /translation TEXT NOT NULL DEFAULT ''/);
  assert.match(route, /translateEnglishToRussian/);
  assert.match(route, /status != 'pick' AND translation = ''/);
  assert.match(page, /className="phrase-translation"/);
});
