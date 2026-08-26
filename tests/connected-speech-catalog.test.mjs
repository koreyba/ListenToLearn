import assert from "node:assert/strict";
import test from "node:test";

import {
  CONNECTED_SPEECH_CATALOG_VALIDATION,
  CONNECTED_SPEECH_CARDS,
  CONNECTED_SPEECH_MECHANISMS,
  LEGACY_PRESET_PHRASES,
  PRACTICE_FORMATS,
  REUSED_PRESET_IDS,
  validateConnectedSpeechCatalog,
} from "../lib/catalog/connected-speech-catalog.ts";

test("typed catalog exposes the accepted 140-card learning structure", () => {
  const counts = Object.groupBy(CONNECTED_SPEECH_CARDS, (card) => card.kind);

  assert.equal(CONNECTED_SPEECH_CARDS.length, 140);
  assert.equal(counts.atom?.length, 18);
  assert.equal(counts.lexicon?.length, 22);
  assert.equal(counts.stack?.length, 100);
  assert.equal(Object.keys(CONNECTED_SPEECH_MECHANISMS).length, 6);
  assert.deepEqual(Object.keys(PRACTICE_FORMATS), ["atom", "lexicon", "stack"]);
});

test("catalog validation reports the accepted active and compatibility sets", () => {
  const summary = validateConnectedSpeechCatalog({
    cards: CONNECTED_SPEECH_CARDS,
    mechanisms: CONNECTED_SPEECH_MECHANISMS,
    formats: PRACTICE_FORMATS,
    reusedPresetIds: REUSED_PRESET_IDS,
    legacyPhrases: LEGACY_PRESET_PHRASES,
  });

  assert.deepEqual(summary, {
    cards: 140,
    byKind: { atom: 18, lexicon: 22, stack: 100 },
    mechanisms: 6,
    reusedPresetIds: 36,
    legacyPhrases: 14,
  });
  assert.deepEqual(CONNECTED_SPEECH_CATALOG_VALIDATION, summary);
});

test("catalog validation rejects an unknown practice format", () => {
  const cards = [
    { ...CONNECTED_SPEECH_CARDS[0], kind: "unknown" },
    ...CONNECTED_SPEECH_CARDS.slice(1),
  ];

  assert.throws(
    () => validateConnectedSpeechCatalog({
      cards,
      mechanisms: CONNECTED_SPEECH_MECHANISMS,
      formats: PRACTICE_FORMATS,
      reusedPresetIds: REUSED_PRESET_IDS,
      legacyPhrases: LEGACY_PRESET_PHRASES,
    }),
    /Catalog card a01 has unknown practice format: unknown/,
  );
});

test("catalog validation rejects an incomplete accepted catalog", () => {
  assert.throws(
    () => validateConnectedSpeechCatalog({
      cards: CONNECTED_SPEECH_CARDS.slice(0, -1),
      mechanisms: CONNECTED_SPEECH_MECHANISMS,
      formats: PRACTICE_FORMATS,
      reusedPresetIds: REUSED_PRESET_IDS,
      legacyPhrases: LEGACY_PRESET_PHRASES,
    }),
    /Connected-speech catalog must contain 140 cards; received 139/,
  );
});

test("catalog validation rejects duplicate stable ids", () => {
  const duplicate = [CONNECTED_SPEECH_CARDS[0], CONNECTED_SPEECH_CARDS[0]];

  assert.throws(
    () => validateConnectedSpeechCatalog({
      cards: duplicate,
      mechanisms: CONNECTED_SPEECH_MECHANISMS,
      formats: PRACTICE_FORMATS,
      reusedPresetIds: {},
      legacyPhrases: [],
    }),
    new RegExp(`Duplicate catalog id: ${CONNECTED_SPEECH_CARDS[0].id}`),
  );
});

test("catalog validation rejects a broken rank sequence within a practice format", () => {
  const cards = CONNECTED_SPEECH_CARDS.map((card) => card.kind === "atom" && card.rank === 2
    ? { ...card, rank: 3 }
    : card);

  assert.throws(
    () => validateConnectedSpeechCatalog({
      cards,
      mechanisms: CONNECTED_SPEECH_MECHANISMS,
      formats: PRACTICE_FORMATS,
      reusedPresetIds: REUSED_PRESET_IDS,
      legacyPhrases: LEGACY_PRESET_PHRASES,
    }),
    /Invalid atom ranks: expected 1 through 18/,
  );
});

test("catalog validation rejects analyzed cards without a known mechanism", () => {
  const cards = [
    { ...CONNECTED_SPEECH_CARDS[0], mechanisms: [] },
    ...CONNECTED_SPEECH_CARDS.slice(1),
  ];

  assert.throws(
    () => validateConnectedSpeechCatalog({
      cards,
      mechanisms: CONNECTED_SPEECH_MECHANISMS,
      formats: PRACTICE_FORMATS,
      reusedPresetIds: REUSED_PRESET_IDS,
      legacyPhrases: LEGACY_PRESET_PHRASES,
    }),
    /Catalog card a01 needs at least one known mechanism/,
  );
});

test("catalog validation rejects incomplete analyzed cards", () => {
  const cards = [
    { ...CONNECTED_SPEECH_CARDS[0], ipa: "" },
    ...CONNECTED_SPEECH_CARDS.slice(1),
  ];

  assert.throws(
    () => validateConnectedSpeechCatalog({
      cards,
      mechanisms: CONNECTED_SPEECH_MECHANISMS,
      formats: PRACTICE_FORMATS,
      reusedPresetIds: REUSED_PRESET_IDS,
      legacyPhrases: LEGACY_PRESET_PHRASES,
    }),
    /Catalog card a01 requires text, pattern, and IPA/,
  );
});

test("catalog validation rejects malformed sound-block brackets", () => {
  const cards = [
    { ...CONNECTED_SPEECH_CARDS[0], pattern: "[tell him" },
    ...CONNECTED_SPEECH_CARDS.slice(1),
  ];

  assert.throws(
    () => validateConnectedSpeechCatalog({
      cards,
      mechanisms: CONNECTED_SPEECH_MECHANISMS,
      formats: PRACTICE_FORMATS,
      reusedPresetIds: REUSED_PRESET_IDS,
      legacyPhrases: LEGACY_PRESET_PHRASES,
    }),
    /Catalog card a01 has malformed sound-block brackets/,
  );
});

test("catalog validation keeps atom cards focused on one mechanism", () => {
  const cards = [
    { ...CONNECTED_SPEECH_CARDS[0], mechanisms: ["elision", "reduction"] },
    ...CONNECTED_SPEECH_CARDS.slice(1),
  ];

  assert.throws(
    () => validateConnectedSpeechCatalog({
      cards,
      mechanisms: CONNECTED_SPEECH_MECHANISMS,
      formats: PRACTICE_FORMATS,
      reusedPresetIds: REUSED_PRESET_IDS,
      legacyPhrases: LEGACY_PRESET_PHRASES,
    }),
    /Atom card a01 must have exactly one mechanism/,
  );
});

test("catalog validation keeps three atom examples for every mechanism", () => {
  const cards = CONNECTED_SPEECH_CARDS.map((card) => card.id === "a01"
    ? { ...card, mechanisms: ["reduction"] }
    : card);

  assert.throws(
    () => validateConnectedSpeechCatalog({
      cards,
      mechanisms: CONNECTED_SPEECH_MECHANISMS,
      formats: PRACTICE_FORMATS,
      reusedPresetIds: REUSED_PRESET_IDS,
      legacyPhrases: LEGACY_PRESET_PHRASES,
    }),
    /Atom mechanism elision must have exactly 3 examples/,
  );
});
