import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repositoryModule = await import("../lib/vocabulary/repository.ts").catch(() => ({}));
const contractsModule = await import("../lib/vocabulary/contracts.ts").catch(() => ({}));

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
  assert.equal(contractsModule.normalizeVocabularyTarget("СЛОВО"), "СЛОВО");
  assert.equal(contractsModule.normalizeVocabularyTarget("слово"), "слово");
  assert.notEqual(
    contractsModule.normalizeVocabularyTarget("СЛОВО"),
    contractsModule.normalizeVocabularyTarget("слово"),
  );
});
