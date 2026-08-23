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

test("YouGlish videos and Tatoeba tracks can be randomized and saved per phrase", async () => {
  const trainer = await readFile(
    new URL("../public/trainer.html", import.meta.url),
    "utf8",
  );
  const examplesRoute = await readFile(
    new URL("../app/api/examples/route.ts", import.meta.url),
    "utf8",
  );
  const schema = await readFile(
    new URL("../db/schema.ts", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(trainer, /id="exampleMode"/);
  assert.match(trainer, /id="saveExampleBtn"/);
  assert.match(trainer, /`\$\{query\} :r`/);
  assert.match(trainer, /`\$\{query\} #\$\{example\.external_id\}`/);
  assert.match(trainer, /event && event\.video/);
  assert.match(trainer, /provider: state\.source/);
  assert.match(trainer, /audioId: Number\(example\.external_id\)/);
  assert.match(trainer, /tatoebaTracks = shuffled/);
  assert.match(examplesRoute, /CREATE TABLE IF NOT EXISTS phrase_examples/);
  assert.match(examplesRoute, /provider === "tatoeba"/);
  assert.match(examplesRoute, /metadata: parseMetadata/);
  assert.match(schema, /export const phraseExamples/);
  assert.match(schema, /metadata: text\("metadata"\)/);
  assert.match(page, /phraseId: phrase\.id/);
  const inlineScript = trainer.match(/<script>([\s\S]+)<\/script>/)?.[1];
  assert.ok(inlineScript);
  assert.doesNotThrow(() => new Function(inlineScript));
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
  assert.match(route, /optionalTranslationForPhrase/);
  assert.match(route, /translationPending/);
  assert.match(route, /status != 'pick' AND translation = ''/);
  assert.match(page, /className="phrase-translation"/);
});
