import assert from "node:assert/strict";
import test from "node:test";

const contextModule = await import("../lib/ai-chat/practice-context.ts").catch(() => ({}));

const items = [
  {
    id: "target-1",
    phraseId: "phrase-1",
    text: "run",
    meaningMode: "all_saved",
    selectedMeaning: null,
    knownMeanings: [
      { id: null, source: "legacy", translation: "бежать", context: "run every day" },
      { id: "meaning-1", source: "personal", translation: "управлять", context: "run a company" },
    ],
  },
  {
    id: "target-2",
    phraseId: null,
    text: "break even",
    meaningMode: "explore",
    selectedMeaning: null,
    knownMeanings: [],
  },
  {
    id: "target-3",
    phraseId: "phrase-1",
    text: "run",
    meaningMode: "selected",
    selectedMeaning: {
      id: "meaning-1",
      source: "personal",
      translation: "управлять",
      context: "run a company",
    },
    knownMeanings: [],
  },
];

test("practice context snapshots only provider-relevant target and meaning data", () => {
  assert.deepEqual(contextModule.createAiChatPracticeContext(items), [
    {
      text: "run",
      meaningMode: "all_saved",
      knownMeanings: [
        { translation: "бежать", context: "run every day" },
        { translation: "управлять", context: "run a company" },
      ],
    },
    { text: "break even", meaningMode: "explore", knownMeanings: [] },
    {
      text: "run",
      meaningMode: "selected",
      selectedMeaning: { translation: "управлять", context: "run a company" },
    },
  ]);
});

test("stored practice context restores as validated prompt targets", () => {
  const snapshot = contextModule.createAiChatPracticeContext(items);
  assert.deepEqual(contextModule.readAiChatPracticeContext(JSON.parse(JSON.stringify(snapshot))), snapshot);
  for (const corrupt of [
    null,
    [{ text: "run", meaningMode: "selected" }],
    [{ text: "run", meaningMode: "other", knownMeanings: [] }],
    [{ text: "run", meaningMode: "all_saved", knownMeanings: "бежать" }],
    Array.from({ length: 13 }, () => ({ text: "run", meaningMode: "explore", knownMeanings: [] })),
  ]) {
    assert.equal(contextModule.readAiChatPracticeContext(corrupt), null);
  }
});

test("new practice snapshots stay within the provider target-data budget", () => {
  const maximumItems = Array.from({ length: 12 }, (_, targetIndex) => ({
    text: `${targetIndex}-${"w".repeat(300)}`,
    meaningMode: "all_saved",
    selectedMeaning: null,
    knownMeanings: Array.from({ length: 12 }, (_, meaningIndex) => ({
      translation: `${meaningIndex}-${"т".repeat(1_000)}`,
      context: "c".repeat(1_000),
    })),
  }));

  const snapshot = contextModule.createAiChatPracticeContext(maximumItems);
  assert.ok(JSON.stringify({ targets: snapshot }, null, 2).length <= 48_000);
  assert.ok([...snapshot[0].knownMeanings[0].translation].length <= 100);
  assert.ok([...snapshot[0].knownMeanings[0].context].length <= 160);
});
