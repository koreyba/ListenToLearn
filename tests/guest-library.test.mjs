import assert from "node:assert/strict";
import test from "node:test";
import {
  addGuestPhrase,
  createGuestLibrary,
  normalizeGuestLibrary,
  removeGuestPhrase,
  removeGuestSavedExample,
  removeGuestSavedVideo,
  saveGuestVideo,
  setGuestPhraseStatus,
  toggleGuestSavedExample,
} from "../lib/guest-library.ts";

test("malformed guest storage normalizes to an empty safe library", () => {
  const state = normalizeGuestLibrary({
    version: 99,
    statuses: { "preset-0": "not-a-status", "preset-1": "to_learn" },
    customPhrases: [{ text: "  hello  " }, null],
    savedExamples: [{ secret: "must disappear" }],
  });

  assert.deepEqual(state, {
    version: 2,
    statuses: { "preset-1": "to_learn" },
    customPhrases: [],
    savedExamples: [],
    savedVideos: [],
  });
});

test("version-one guest storage gains an empty saved-video library without losing data", () => {
  const state = normalizeGuestLibrary({
    version: 1,
    statuses: { "preset-0": "learning_now" },
    customPhrases: [],
    savedExamples: [],
  });

  assert.equal(state.version, 2);
  assert.equal(state.statuses["preset-0"], "learning_now");
  assert.deepEqual(state.savedVideos, []);
});

test("guest saved-video normalization keeps only bounded valid YouTube records", () => {
  const state = normalizeGuestLibrary({
    savedVideos: [
      {
        id: "guest-video-1",
        videoId: "M7lc1UVf-VE",
        originPhraseId: " preset-0 ",
        originQuery: "  courage  ",
        restoreQuery: "  have courage  ",
        originCaption: "  have courage  ",
        language: " English ",
        accent: " us ",
        createdAt: "2026-08-25T09:00:00.000Z",
        updatedAt: "2026-08-25T10:00:00.000Z",
      },
      { id: "bad", videoId: "not a video id" },
    ],
  });

  assert.deepEqual(state.savedVideos, [{
    id: "guest-video-1",
    videoId: "M7lc1UVf-VE",
    originPhraseId: "preset-0",
    originQuery: "courage",
    restoreQuery: "have courage",
    originCaption: "have courage",
    language: "english",
    accent: "us",
    createdAt: "2026-08-25T09:00:00.000Z",
    updatedAt: "2026-08-25T10:00:00.000Z",
  }]);
});

test("guest video save deduplicates by video id and refreshes origin context", () => {
  const first = saveGuestVideo(createGuestLibrary(), {
    videoId: "M7lc1UVf-VE",
    originPhraseId: "preset-0",
    originQuery: "courage",
    restoreQuery: "courage",
    originCaption: "have courage",
    language: "english",
    accent: "us",
  }, "2026-08-25T09:00:00.000Z");
  const second = saveGuestVideo(first.state, {
    videoId: "M7lc1UVf-VE",
    originPhraseId: "preset-1",
    originQuery: "real courage",
    restoreQuery: "real courage",
    originCaption: "that takes real courage",
    language: "english",
    accent: "uk",
  }, "2026-08-25T10:00:00.000Z");

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.state.savedVideos.length, 1);
  assert.equal(second.video.id, first.video.id);
  assert.equal(second.video.createdAt, "2026-08-25T09:00:00.000Z");
  assert.equal(second.video.updatedAt, "2026-08-25T10:00:00.000Z");
  assert.equal(second.video.originPhraseId, "preset-1");
  assert.equal(second.video.restoreQuery, "real courage");
  assert.equal(second.video.originCaption, "that takes real courage");
  assert.equal(second.video.language, "english");
  assert.equal(second.video.accent, "uk");
});

test("new guest video saves require display and restore queries and normalize supported locale metadata", () => {
  const missingRestoreQuery = saveGuestVideo(createGuestLibrary(), {
    videoId: "M7lc1UVf-VE",
    originQuery: "courage",
    language: "english",
  });
  const saved = saveGuestVideo(createGuestLibrary(), {
    videoId: "M7lc1UVf-VE",
    originQuery: "courage",
    restoreQuery: "have courage",
    language: "ENGLISH",
    accent: "invalid",
  }, "2026-08-25T09:00:00.000Z");

  assert.equal(missingRestoreQuery.created, false);
  assert.equal(missingRestoreQuery.video, null);
  assert.equal(saved.video.language, "english");
  assert.equal(saved.video.accent, "");
});

test("legacy guest videos without a restore query are intentionally dropped", () => {
  const state = normalizeGuestLibrary({
    savedVideos: [{
      id: "legacy-video",
      videoId: "M7lc1UVf-VE",
      originQuery: "courage",
      createdAt: "2026-08-25T09:00:00.000Z",
      updatedAt: "2026-08-25T09:00:00.000Z",
    }],
  });

  assert.deepEqual(state.savedVideos, []);
});

test("guest video removal does not affect phrase examples", () => {
  const example = toggleGuestSavedExample(createGuestLibrary(), {
    phraseId: "preset-0",
    provider: "youglish",
    externalId: "M7lc1UVf-VE",
    query: "courage",
  }, "2026-08-25T09:00:00.000Z");
  const saved = saveGuestVideo(example.state, {
    videoId: "M7lc1UVf-VE",
    originPhraseId: "preset-0",
    originQuery: "courage",
    restoreQuery: "courage",
  }, "2026-08-25T09:00:00.000Z");
  const removed = removeGuestSavedVideo(saved.state, saved.video.id);

  assert.equal(removed.savedVideos.length, 0);
  assert.equal(removed.savedExamples.length, 1);
});

test("guest video saves keep only the 200 newest records", () => {
  let state = createGuestLibrary();
  for (let index = 0; index < 201; index += 1) {
    state = saveGuestVideo(state, {
      videoId: `v${String(index).padStart(10, "0")}`,
      originQuery: `query ${index}`,
      restoreQuery: `restore ${index}`,
    }, new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString()).state;
  }

  assert.equal(state.savedVideos.length, 200);
  assert.equal(state.savedVideos[0].videoId, "v0000000200");
  assert.equal(state.savedVideos.some((video) => video.videoId === "v0000000000"), false);
});

test("guest phrase status changes stay in the local state", () => {
  const initial = createGuestLibrary();
  const next = setGuestPhraseStatus(initial, "preset-0", "to_learn", "2026-08-23T20:00:00.000Z");

  assert.equal(initial.statuses["preset-0"], undefined);
  assert.equal(next.statuses["preset-0"], "to_learn");
});

test("custom guest phrase creation is normalized and idempotent by text", () => {
  const first = addGuestPhrase(createGuestLibrary(), {
    text: "  I am gonna  ",
    context: "  example  ",
    translation: "  я собираюсь  ",
  }, "2026-08-23T20:00:00.000Z");
  const second = addGuestPhrase(first.state, { text: "i am gonna" }, "2026-08-23T20:01:00.000Z");

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.state.customPhrases.length, 1);
  assert.equal(second.state.customPhrases[0].status, "to_learn");
  assert.equal(second.state.customPhrases[0].context, "example");
  assert.equal(second.state.customPhrases[0].translation, "я собираюсь");
});

test("guest saved examples toggle by phrase, provider and external id", () => {
  const input = {
    phraseId: "preset-0",
    provider: "tatoeba",
    externalId: "123",
    query: "I don't know if it's",
    caption: "I don't know if it's working",
    accent: "",
    metadata: { sentenceId: "123" },
  };
  const saved = toggleGuestSavedExample(createGuestLibrary(), input, "2026-08-23T20:00:00.000Z");
  const removed = toggleGuestSavedExample(saved.state, input, "2026-08-23T20:01:00.000Z");

  assert.equal(saved.saved, true);
  assert.equal(saved.state.savedExamples.length, 1);
  assert.equal(removed.saved, false);
  assert.equal(removed.state.savedExamples.length, 0);
});

test("guest saved examples can be removed without affecting other examples", () => {
  const first = toggleGuestSavedExample(createGuestLibrary(), {
    phraseId: "preset-0",
    provider: "youglish",
    externalId: "video-1",
    query: "hello",
  }, "2026-08-23T20:00:00.000Z");
  const second = toggleGuestSavedExample(first.state, {
    phraseId: "preset-0",
    provider: "youglish",
    externalId: "video-2",
    query: "hello",
  }, "2026-08-23T20:01:00.000Z");
  const removed = removeGuestSavedExample(second.state, second.state.savedExamples[1].id);

  assert.equal(removed.savedExamples.length, 1);
  assert.equal(removed.savedExamples[0].externalId, "video-2");
});

test("removing a guest phrase resets a preset and deletes a custom phrase", () => {
  const added = addGuestPhrase(createGuestLibrary(), { text: "custom phrase" }, "2026-08-23T20:00:00.000Z");
  const withStatus = setGuestPhraseStatus(added.state, "preset-0", "learning_now");
  const afterPreset = removeGuestPhrase(withStatus, "preset-0");
  const afterCustom = removeGuestPhrase(afterPreset, added.phrase.id);

  assert.equal(afterPreset.statuses["preset-0"], undefined);
  assert.equal(afterCustom.customPhrases.length, 0);
});
