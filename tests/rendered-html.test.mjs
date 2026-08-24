import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

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
  assert.match(trainer, /const translationCache = new Map\(\)/);
  assert.match(trainer, /translationAbortController/);
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
  assert.match(trainer, /<script src="\/caption-navigation\.js"><\/script>/);
  assert.match(trainer, /signal: controller\.signal/);
  assert.match(tatoebaRoute, /https:\/\/api\.tatoeba\.org\/v1\/sentences/);
  assert.match(tatoebaRoute, /cacheTtl: 300/);
  assert.match(audioRoute, /https:\/\/api\.tatoeba\.org\/v1\/audios\/\$\{id\}\/file/);
});

test("caption navigation is ready before the first YouGlish caption callback", async () => {
  const trainer = await readFile(
    new URL("../public/trainer.html", import.meta.url),
    "utf8",
  );
  const helperTag = '<script src="/caption-navigation.js"></script>';
  const inlineController = '<script>\n    "use strict";';
  const helperIndex = trainer.indexOf(helperTag);
  const controllerIndex = trainer.indexOf(inlineController);

  assert.ok(helperIndex >= 0, "the caption helper must be loaded");
  assert.ok(controllerIndex > helperIndex, "the helper must load before the trainer controller");
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
  assert.match(trainer, /tatoebaTracks = orderProviderItems/);
  assert.match(trainer, /exampleOrder === "random"/);
  assert.doesNotMatch(examplesRoute, /CREATE TABLE IF NOT EXISTS phrase_examples/);
  assert.match(examplesRoute, /LEFT JOIN phrase_examples/);
  assert.match(examplesRoute, /example: publicExample/);
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

  assert.match(helper, /getAuthenticatedUser/);
  assert.match(helper, /Authorization: `DeepL-Auth-Key \$\{apiKey\}`/);
  assert.match(helper, /target_lang: "RU"/);
  assert.match(helper, /AbortController/);
  assert.match(helper, /DEEPL_TIMEOUT_MS/);
  assert.match(helper, /readIntegrationSecret\(user\.subject, "deepl"\)/);
  assert.doesNotMatch(helper, /hasIntegrationSession/);
  assert.match(helper, /request\?: Request/);
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
  assert.match(route, /translation = CASE WHEN translation = '' THEN/);
  assert.match(route, /translateEnglishToRussian/);
  assert.match(route, /optionalTranslationForPhrase/);
  assert.match(route, /translationPending/);
  assert.match(route, /COALESCE\(progress\.status, 'pick'\) != 'pick'/);
  assert.match(route, /p\.translation = ''/);
  assert.match(route, /phrase_progress/);
  assert.match(page, /className="phrase-translation"/);
});

test("MVP UX persists phrase context and exposes global library sorting", async () => {
  const route = await readFile(
    new URL("../app/api/phrases/route.ts", import.meta.url),
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
  const migration = await readFile(
    new URL("../drizzle/0005_special_ogun.sql", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(route, /CREATE TABLE IF NOT EXISTS|ALTER TABLE.*context/);
  assert.match(route, /payload\.context/);
  assert.match(route, /payload\.translation/);
  assert.match(route, /p\.id, p\.text, p\.pattern, p\.ipa, p\.translation, p\.context/);
  assert.match(schema, /context: text\("context"\)/);
  assert.match(migration, /ALTER TABLE [`]phrases[`] ADD [`]context[`]/);
  assert.match(page, /phrase-sort/);
  assert.match(page, /added_desc/);
  assert.match(page, /localStorage/);
  assert.match(page, /created_at/);
});

test("MVP UX keeps example settings global and separates caption/video navigation", async () => {
  const trainer = await readFile(
    new URL("../public/trainer.html", import.meta.url),
    "utf8",
  );

  assert.match(trainer, /id="prevCaptionBtn"/);
  assert.match(trainer, /id="nextCaptionBtn"/);
  assert.match(trainer, /<script src="\/caption-navigation\.js"><\/script>/);
  assert.match(trainer, /id="prevVideoBtn"/);
  assert.match(trainer, /id="nextVideoBtn"/);
  assert.match(trainer, /data-example-order="random"/);
  assert.match(trainer, /data-example-order="ordered"/);
  assert.match(trainer, /exampleOrder/);
  assert.match(trainer, /captionHistory/);
  assert.match(trainer, /current_time/);
  assert.match(trainer, /onCaptionConsumed/);
  assert.match(trainer, /repeatCaptionBtn/);
  assert.doesNotMatch(trainer, /captionNavigationMethod/);
  assert.doesNotMatch(trainer, /move\(-5\)/);
  assert.match(trainer, /class="learning-workspace"/);
  assert.match(trainer, /class="media-panel"/);
  assert.match(trainer, /id="translationAddBtn"/);
});

test("trainer exposes one accessible expanded media layout for both providers", async () => {
  const trainer = await readFile(
    new URL("../public/trainer.html", import.meta.url),
    "utf8",
  );

  assert.match(trainer, /id="expandMediaBtn"/);
  assert.match(trainer, /aria-label="Expand player"/);
  assert.match(trainer, /classList\.toggle\("media-expanded", isExpanded\)/);
  assert.match(trainer, /setAttribute\("aria-expanded", isExpanded \? "true" : "false"\)/);
  assert.match(trainer, /grid-template-columns: minmax\(0, 1\.15fr\) minmax\(380px, \.85fr\)/);
  assert.match(trainer, /grid-template-areas: "workspace" "media"/);
  assert.doesNotMatch(trainer, /id="mediaOverlay"/);
});

test("trainer interface labels are consistently English", async () => {
  const trainer = await readFile(
    new URL("../public/trainer.html", import.meta.url),
    "utf8",
  );

  assert.match(trainer, /aria-label="Example source"/);
  assert.match(trainer, /class="button-label">Previous<\/span>/);
  assert.match(trainer, />Expand<\/span>/);
  assert.doesNotMatch(trainer, /[\u0400-\u04FF]/);
});

test("trainer primary controls expose familiar icons with accessible labels", async () => {
  const trainer = await readFile(
    new URL("../public/trainer.html", import.meta.url),
    "utf8",
  );

  assert.ok((trainer.match(/class="button-icon"/g) || []).length >= 8);
  assert.match(trainer, /class="button-label">Previous<\/span>/);
  assert.match(trainer, /aria-label="Pause playback"/);
  assert.match(trainer, /aria-label="Save current example"/);
  assert.match(trainer, /\.player-controls \.button-label \{ display: none; \}/);
});

test("trainer keeps primary controls compact across desktop and mobile", async () => {
  const trainer = await readFile(
    new URL("../public/trainer.html", import.meta.url),
    "utf8",
  );

  assert.match(trainer, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(trainer, /class="caption-navigation-status"/);
  assert.doesNotMatch(trainer, /id="captionNavigationHint" class="control-group-hint"/);
  assert.match(trainer, /@media \(max-width: 560px\)[\s\S]*?\.player-controls \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(trainer, /\.example-tools \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;/);
});

test("caption controls are visible only for YouGlish", async () => {
  const trainer = await readFile(
    new URL("../public/trainer.html", import.meta.url),
    "utf8",
  );

  assert.match(trainer, /id="captionNavigation" class="control-group caption-navigation"/);
  assert.match(trainer, /id="captionNavigationHint" class="caption-navigation-status"/);
  assert.match(trainer, /const captionsAvailable = state\.source === "youglish";/);
  assert.match(trainer, /el\.captionNavigation\.hidden = !captionsAvailable;/);
  assert.match(trainer, /el\.captionNavigationHint\.hidden = !captionsAvailable;/);
  assert.match(trainer, /el\.repeatCaptionBtn\.hidden = !captionsAvailable;/);
});

test("icon-only example settings retain accessible names and touch targets", async () => {
  const trainer = await readFile(
    new URL("../public/trainer.html", import.meta.url),
    "utf8",
  );

  assert.match(trainer, /data-example-mode="all" aria-label="All examples" title="All examples"/);
  assert.match(trainer, /data-example-mode="saved" aria-label="Saved examples" title="Saved examples"/);
  assert.match(trainer, /data-example-order="random" aria-label="Random order" title="Random order"/);
  assert.match(trainer, /data-example-order="ordered" aria-label="Ordered" title="Ordered"/);
  assert.match(trainer, /\.player-controls button \{[\s\S]*?min-height: 44px;/);
  assert.match(trainer, /#sourceSwitch button,\s*\.example-settings \.segmented button \{\s*min-height: 44px;/);
  assert.match(trainer, /\.media-expand-btn \{\s*min-width: 44px;\s*min-height: 44px;/);
});

test("library and integration surfaces use English UI labels", async () => {
  const surfaces = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/integrations/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  for (const surface of surfaces) assert.doesNotMatch(surface, /[\u0400-\u04FF]/);
  assert.match(surfaces[0], /Listen to real speech\./);
  assert.match(surfaces[1], /Translate English phrases into Russian\./);
  assert.match(surfaces[2], /<html lang="en">/);
});

test("phrase controls use timing-aware caption events and expose repeat state", async () => {
  const trainer = await readFile(
    new URL("../public/trainer.html", import.meta.url),
    "utf8",
  );

  assert.match(trainer, /id="repeatCaptionBtn"/);
  assert.match(trainer, /aria-pressed/);
  assert.match(trainer, /onCaptionConsumed/);
  assert.match(trainer, /onPlayerStateChange/);
  assert.match(trainer, /event\.current_time/);
  assert.match(trainer, /lastKnownTime/);
  assert.match(trainer, /captionNavigationBusy/);
  assert.match(trainer, /captionNavigation\.neighbors/);
  assert.doesNotMatch(trainer, /seekByCaptionSteps/);
  assert.doesNotMatch(trainer, /captionNavigationMethod/);
  assert.doesNotMatch(trainer, /move\(-5\)/);
});

test("Tatoeba hides timed caption controls but keeps whole-track navigation", async () => {
  const trainer = await readFile(
    new URL("../public/trainer.html", import.meta.url),
    "utf8",
  );

  assert.match(trainer, /id="captionNavigation"[^>]*hidden/);
  assert.match(trainer, /id="repeatCaptionBtn"[^>]*hidden/);
  assert.match(trainer, /const captionsAvailable = state\.source === "youglish"/);
  assert.match(trainer, /el\.captionNavigation\.hidden = !captionsAvailable/);
  assert.match(trainer, /el\.repeatCaptionBtn\.hidden = !captionsAvailable/);
  assert.match(trainer, /id="prevVideoBtn"/);
  assert.match(trainer, /id="nextVideoBtn"/);
});

test("caption timeline keeps opaque IDs ordered by timing and computes relative seeks", async () => {
  const source = await readFile(
    new URL("../public/caption-navigation.js", import.meta.url),
    "utf8",
  );
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  const navigation = sandbox.window.ListenToLearnCaptionNavigation;
  assert.ok(navigation);

  const first = navigation.upsert([], {
    videoId: "video-1",
    id: "opaque-b",
    raw: "second",
    text: "second",
    startTime: 12,
  }, 0, 10);
  const second = navigation.upsert(first.history, {
    videoId: "video-1",
    id: "opaque-a",
    raw: "first",
    text: "first",
    startTime: 10,
  }, first.nextSequence, 20);
  const duplicate = navigation.upsert(second.history, {
    videoId: "video-1",
    id: "opaque-b",
    raw: "second updated",
    text: "second updated",
    startTime: 12,
  }, second.nextSequence, 30);

  assert.deepEqual(duplicate.history.map(item => item.id), ["opaque-a", "opaque-b"]);
  assert.equal(duplicate.history.length, 2);
  assert.equal(duplicate.history[duplicate.index].text, "second updated");
  assert.equal(navigation.adjacent(duplicate.history, duplicate.index, -1, "video-1").id, "opaque-a");
  assert.equal(navigation.adjacent(duplicate.history, duplicate.index, 1, "video-1"), null);
  assert.equal(navigation.relativeSeekDelta(12, 13.5), 1.5);
  const moved = navigation.upsert(duplicate.history, {
    videoId: "video-1",
    id: "opaque-a",
    raw: "first moved",
    text: "first moved",
    startTime: 14,
  }, duplicate.nextSequence, 40);
  assert.deepEqual(moved.history.map(item => item.id), ["opaque-b", "opaque-a"]);
  assert.equal(moved.index, 1);
  assert.equal(navigation.adjacent(moved.history, moved.index, -1, "video-1").id, "opaque-b");
  assert.equal(navigation.adjacent(moved.history, moved.index, -1, "video-2"), null);
  assert.equal(navigation.finiteTime("not-a-time"), null);
  assert.equal(navigation.repeatSeekDelta(10, 12, 13), -3);
  assert.equal(navigation.repeatSeekDelta(10, 12, null), -2);
  assert.equal(navigation.repeatSeekDelta(10, null, 10.2), -0.5);
});

test("phrase navigation uses cached neighbors without waiting for a new caption event", async () => {
  const trainer = await readFile(
    new URL("../public/trainer.html", import.meta.url),
    "utf8",
  );
  const source = await readFile(
    new URL("../public/caption-navigation.js", import.meta.url),
    "utf8",
  );
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  const navigation = sandbox.window.ListenToLearnCaptionNavigation;
  const first = navigation.upsert([], {
    videoId: "video-1",
    id: "opaque-a",
    raw: "first",
    text: "first",
    startTime: 10,
  }, 0, 10);
  const second = navigation.upsert(first.history, {
    videoId: "video-1",
    id: "opaque-b",
    raw: "second",
    text: "second",
    startTime: 12,
  }, first.nextSequence, 20);
  const neighbors = navigation.neighbors(second.history, second.index, "video-1");

  assert.equal(neighbors.previous.id, "opaque-a");
  assert.equal(neighbors.next, null);
  assert.match(trainer, /captionNavigation\.neighbors\(captionHistory, captionHistoryIndex, currentYouglishVideoId\)/);
  assert.match(trainer, /Boolean\(previousTarget\)/);
  assert.match(trainer, /Boolean\(nextTarget\)/);
  const knownSeek = trainer.match(/function seekToKnownCaption\([\s\S]*?\n    function navigateCaption/)?.[0];
  assert.ok(knownSeek);
  assert.doesNotMatch(knownSeek, /waitForCaption/);
  assert.match(knownSeek, /renderCaption\(targetEntry\.raw\)/);
});

test("integrations keep provider keys server-side and expose only status", async () => {
  const page = await readFile(
    new URL("../app/integrations/page.tsx", import.meta.url),
    "utf8",
  );
  const route = await readFile(
    new URL("../app/api/integrations/route.ts", import.meta.url),
    "utf8",
  );
  const crypto = await readFile(
    new URL("../lib/integration-secrets.ts", import.meta.url),
    "utf8",
  );
  const schema = await readFile(
    new URL("../db/schema.ts", import.meta.url),
    "utf8",
  );

  assert.match(page, /type="password"/);
  assert.match(page, /fetch\("\/api\/integrations"/);
  assert.match(route, /configured/);
  assert.doesNotMatch(route, /return Response\.json\([^\n]*key/);
  assert.match(crypto, /INTEGRATIONS_ENCRYPTION_KEY/);
  assert.match(crypto, /AES-GCM/);
  assert.match(crypto, /crypto\.subtle\.encrypt/);
  assert.match(crypto, /crypto\.subtle\.decrypt/);
  assert.match(schema, /export const integrationSecrets/);
  assert.match(crypto, /user_id/);
  assert.match(crypto, /encryption_version/);
  assert.match(crypto, /v2:/);
  assert.doesNotMatch(crypto, /createIntegrationSession/);
  assert.match(route, /getCurrentUser/);
  assert.match(route, /unauthorizedResponse/);
  assert.match(schema, /export const users/);
  assert.match(schema, /export const phraseProgress/);
  assert.match(schema, /userId: text\("user_id"\)/);
});

test("Worker authenticates through Cloudflare Access and strips client identity headers", async () => {
  const worker = await readFile(
    new URL("../worker/index.ts", import.meta.url),
    "utf8",
  );
  const context = await readFile(
    new URL("../lib/user-context.ts", import.meta.url),
    "utf8",
  );

  assert.match(worker, /jwtVerify/);
  assert.match(worker, /Cf-Access-Jwt-Assertion/);
  assert.match(worker, /ACCESS_TEAM_DOMAIN/);
  assert.match(worker, /ACCESS_AUD/);
  assert.match(worker, /headers\.delete\(AUTHENTICATED_USER_HEADER\)/);
  assert.match(worker, /encodeUserContext/);
  assert.match(worker, /return unauthorizedResponse\(\)/);
  assert.match(context, /decodeUserContext/);
  assert.match(context, /AUTHENTICATED_USER_HEADER/);
});
