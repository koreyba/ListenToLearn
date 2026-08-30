import assert from "node:assert/strict";
import test from "node:test";

const intentModule = await import("../lib/ai-chat/proposal-intent.ts").catch(() => ({}));

test("clear English and Russian save commands route to the bulk entry proposal", () => {
  assert.equal(typeof intentModule.routeAiChatProposalIntent, "function");
  for (const message of [
    "Добавь эти пять слов в словарь.",
    "Да, добавь их.",
    "Давай сохраним эти фразы.",
    "Одним действием добавь эти десять фраз.",
    "Добавь также silver fern, lucid badger и patient otter.",
    "Please add uncanny and serendipity to my vocabulary.",
    "Save these phrases.",
  ]) {
    assert.equal(
      intentModule.routeAiChatProposalIntent(message),
      "propose_vocabulary_entries",
      message,
    );
  }
});

test("clear English and Russian remove or move commands route to the state proposal", () => {
  for (const message of [
    "Удали слова uncanny и serendipity из Practice.",
    "Да, убери их.",
    "Перемести эти слова в Learning.",
    "Подготовь удаление patient otter из Practice.",
    "Remove run from Practice.",
    "Move run to Learned.",
    "Mark run as learned.",
  ]) {
    assert.equal(
      intentModule.routeAiChatProposalIntent(message),
      "propose_vocabulary_state_change",
      message,
    );
  }
});

test("negated, explanatory, and practice-content requests do not force a mutation tool", () => {
  for (const message of [
    "Не добавляй это слово.",
    "Добавь слово run — нет, передумал.",
    "Don't remove run from Practice.",
    "How do I remove run from Practice?",
    "Как добавить слово в словарь?",
    "Объясни фразу «добавь слово run».",
    "Добавь ещё один пример с run.",
    "Add another sentence with the word run.",
    "Let's practise the phrase break even.",
  ]) {
    assert.equal(intentModule.routeAiChatProposalIntent(message), null, message);
  }
});

test("clear state commands have a conservative deterministic proposal fallback", () => {
  for (const [message, expected] of [
    [
      "Перемести quiet comet в категорию Learning.",
      {
        toolName: "propose_vocabulary_state_change",
        input: { entries: [{ text: "quiet comet" }], destination: "learning" },
      },
    ],
    [
      "Удали luminous kestrel из моей Practice. Library не трогай.",
      {
        toolName: "propose_vocabulary_state_change",
        input: { entries: [{ text: "luminous kestrel" }], destination: "removed" },
      },
    ],
    [
      "Подготовь удаление patient otter из Practice.",
      {
        toolName: "propose_vocabulary_state_change",
        input: { entries: [{ text: "patient otter" }], destination: "removed" },
      },
    ],
    [
      "Удали из Practice ровно пять фраз: amber trail, brisk meadow, copper moon, gentle ridge и hidden brook.",
      {
        toolName: "propose_vocabulary_state_change",
        input: {
          entries: ["amber trail", "brisk meadow", "copper moon", "gentle ridge", "hidden brook"]
            .map((text) => ({ text })),
          destination: "removed",
        },
      },
    ],
  ]) {
    assert.deepEqual(intentModule.parseAiChatProposalFallback(message), expected, message);
  }
});

test("clear add commands have a conservative bulk proposal fallback", () => {
  for (const [message, expectedEntries] of [
    [
      "Добавь фразу silver fern в мой словарь.",
      [{ text: "silver fern" }],
    ],
    [
      "Добавь также silver fern — серебряный папоротник и calm harbor — спокойная гавань.",
      [
        { text: "silver fern", translation: "серебряный папоротник" },
        { text: "calm harbor", translation: "спокойная гавань" },
      ],
    ],
    [
      "Одним действием добавь эти десять английских фраз: amber trail, brisk meadow, copper moon, gentle ridge, hidden brook, lucid dawn, mellow pine, nimble cloud, open valley, vivid shore.",
      ["amber trail", "brisk meadow", "copper moon", "gentle ridge", "hidden brook", "lucid dawn", "mellow pine", "nimble cloud", "open valley", "vivid shore"]
        .map((text) => ({ text })),
    ],
    [
      "Добавь смешанную фразу focus фокус в мой словарь как есть, не разделяя языки.",
      [{ text: "focus фокус" }],
    ],
  ]) {
    assert.deepEqual(intentModule.parseAiChatProposalFallback(message), {
      toolName: "propose_vocabulary_entries",
      input: { entries: expectedEntries },
    }, message);
  }
});

test("fallback refuses references, negation, and commands without explicit values", () => {
  for (const message of [
    "Добавь их в словарь.",
    "Не добавляй silver fern.",
    "Перемести эти слова в Learning.",
    "Добавь эти пять слов в словарь.",
  ]) {
    assert.equal(intentModule.parseAiChatProposalFallback(message), null, message);
  }
});
