import assert from "node:assert/strict";
import test from "node:test";

const creationModule = await import("../lib/ai-chat/chat-creation.ts").catch(() => ({}));

test("new chat persists a deterministic opening from the owner's latest five entries", async () => {
  const calls = [];
  const recent = [{
    phraseId: "phrase-run",
    text: "run",
    status: "learning_now",
    sourceType: "preset",
    addedAt: "2026-08-29T10:00:00.000Z",
    updatedAt: "2026-08-29T10:00:00.000Z",
    meanings: [{
      id: "legacy",
      source: "legacy",
      translation: "бежать",
      context: "run every morning",
    }],
    meaningCount: 1,
  }];
  const vocabularyRepository = {
    async listRecent(userId, limit) {
      calls.push({ method: "recent", userId, limit });
      return recent;
    },
  };
  const chatRepository = {
    async createChat(userId, input) {
      calls.push({ method: "create", userId, input });
      return { id: "chat-a", messages: [{ content: input.openingMessage }] };
    },
  };

  assert.equal(typeof creationModule.createChatWithVocabularyOpening, "function");
  const chat = await creationModule.createChatWithVocabularyOpening({
    chatRepository,
    vocabularyRepository,
    userId: "user-a",
    targets: [],
  });

  assert.equal(chat.id, "chat-a");
  assert.deepEqual(calls[0], { method: "recent", userId: "user-a", limit: 5 });
  assert.equal(calls[1].method, "create");
  assert.equal(calls[1].userId, "user-a");
  assert.deepEqual(calls[1].input.targets, []);
  assert.match(calls[1].input.openingMessage, /run — бежать/u);
  assert.match(calls[1].input.openingMessage, /Хочешь потренировать/u);
});
