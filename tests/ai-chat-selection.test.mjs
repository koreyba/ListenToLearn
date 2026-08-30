import assert from "node:assert/strict";
import test from "node:test";

const selectionModule = await import("../lib/ai-chat/selection.ts").catch(() => ({}));

const mixedSelection = {
  messageId: "assistant-7",
  text: "get away — уйти",
  context: "You can say get away — уйти when someone should leave.",
  anchor: { left: 120, top: 220, right: 280, bottom: 246 },
};

test("selection payloads preserve exact mixed-language text and bounded context", () => {
  assert.deepEqual(selectionModule.chatTranslationPayload(mixedSelection), {
    text: mixedSelection.text,
    context: mixedSelection.context,
  });
  assert.deepEqual(selectionModule.chatPhrasePayload(mixedSelection), {
    text: mixedSelection.text,
    context: mixedSelection.context,
  });
  assert.deepEqual(selectionModule.chatPhrasePayload(mixedSelection, "уйти"), {
    text: mixedSelection.text,
    context: mixedSelection.context,
    translation: "уйти",
  });
});

test("translation and vocabulary limits remain distinct without truncation", () => {
  const selection240 = { ...mixedSelection, text: "a".repeat(240) };
  const selection241 = { ...mixedSelection, text: "a".repeat(241) };
  const selection500 = { ...mixedSelection, text: "a".repeat(500) };
  const selection501 = { ...mixedSelection, text: "a".repeat(501) };

  assert.equal(selectionModule.canAddChatSelection(selection240), true);
  assert.equal(selectionModule.canAddChatSelection(selection241), false);
  assert.equal(selectionModule.canTranslateChatSelection(selection500), true);
  assert.equal(selectionModule.canTranslateChatSelection(selection501), false);
  assert.equal(selectionModule.chatPhrasePayload(selection241).text.length, 241);
});

test("async results are scoped to message, text, and context", () => {
  assert.equal(selectionModule.isSameChatSelection(mixedSelection, { ...mixedSelection }), true);
  assert.equal(selectionModule.isSameChatSelection(
    mixedSelection,
    { ...mixedSelection, messageId: "assistant-8" },
  ), false);
  assert.equal(selectionModule.isSameChatSelection(
    mixedSelection,
    { ...mixedSelection, context: "A different occurrence." },
  ), false);
});

test("saved status labels stay honest for new and existing entries", () => {
  assert.equal(selectionModule.chatVocabularyStatusLabel("to_learn"), "To Learn");
  assert.equal(selectionModule.chatVocabularyStatusLabel("learning_now"), "Learning");
  assert.equal(selectionModule.chatVocabularyStatusLabel("learnt"), "Learned");
  assert.equal(selectionModule.chatVocabularyStatusLabel("learned"), "Learned");
});
