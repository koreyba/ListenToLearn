import assert from "node:assert/strict";
import test from "node:test";
import {
  addGuestPhrase,
  createGuestLibrary,
  normalizeGuestLibrary,
  removeGuestPhrase,
  removeGuestSavedExample,
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
    version: 1,
    statuses: { "preset-1": "to_learn" },
    customPhrases: [],
    savedExamples: [],
  });
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
