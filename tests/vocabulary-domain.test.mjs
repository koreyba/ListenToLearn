import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repositoryModule = await import("../lib/vocabulary/repository.ts").catch(() => ({}));
const contractsModule = await import("../lib/vocabulary/contracts.ts").catch(() => ({}));
const practiceReaderModule = await import("../lib/vocabulary/practice-reader.ts").catch(() => ({}));

test("vocabulary persistence is a reusable domain boundary, not an AI-chat repository concern", async () => {
  assert.equal(typeof repositoryModule.createVocabularyRepository, "function");
  assert.equal(typeof repositoryModule.VocabularyRepositoryError, "function");

  const source = await readFile(
    new URL("../lib/vocabulary/repository.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /lib\/ai-chat|\.\.\/ai-chat|\.\.\/ai-chat/);
  assert.doesNotMatch(source, /ai_chats|ai_chat_messages|OpenRouter|streamText/);
});

test("vocabulary target keys match SQLite NOCASE instead of overclaiming Unicode folding", () => {
  assert.equal(typeof contractsModule.normalizeVocabularyTarget, "function");
  assert.equal(contractsModule.normalizeVocabularyTarget("  Break   Even  "), "break even");
  assert.equal(contractsModule.normalizeVocabularyTarget("Ｐｏｌｉｓｈ"), "Ｐｏｌｉｓｈ");
  assert.notEqual(
    contractsModule.normalizeVocabularyTarget("Ｐｏｌｉｓｈ"),
    contractsModule.normalizeVocabularyTarget("Polish"),
  );
  assert.equal(contractsModule.normalizeVocabularyTarget("СЛОВО"), "СЛОВО");
  assert.equal(contractsModule.normalizeVocabularyTarget("слово"), "слово");
  assert.notEqual(
    contractsModule.normalizeVocabularyTarget("СЛОВО"),
    contractsModule.normalizeVocabularyTarget("слово"),
  );
});

test("AI chat delegates saved-target resolution and practice projection to a read-only vocabulary boundary", async () => {
  assert.equal(typeof practiceReaderModule.createVocabularyPracticeReader, "function");
  assert.equal(typeof practiceReaderModule.VocabularyPracticeReaderError, "function");

  const chatRepositorySource = await readFile(
    new URL("../lib/ai-chat/repository.ts", import.meta.url),
    "utf8",
  );
  assert.match(chatRepositorySource, /\.\.\/vocabulary\/practice-reader\.ts/u);
  assert.doesNotMatch(chatRepositorySource, /\b(?:FROM|JOIN)\s+(?:phrases|phrase_meanings)\b/iu);

  const practiceReaderSource = await readFile(
    new URL("../lib/vocabulary/practice-reader.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(practiceReaderSource, /\b(?:INSERT|UPDATE|DELETE)\b/iu);
});
