import assert from "node:assert/strict";
import test from "node:test";

const clientModule = await import("../lib/ai-chat/client.ts").catch(() => ({}));

test("persisted messages become plain AI SDK UI messages with retry metadata", () => {
  const messages = clientModule.toAiChatUiMessages([
    {
      id: "db-user",
      role: "user",
      content: "Give me one example.",
      status: "complete",
      clientMessageId: "client-turn",
      errorCode: null,
    },
    {
      id: "db-assistant",
      role: "assistant",
      content: "",
      status: "failed",
      clientMessageId: "client-turn",
      errorCode: "provider_timeout",
    },
  ]);

  assert.deepEqual(messages, [
    {
      id: "client-turn",
      role: "user",
      parts: [{ type: "text", text: "Give me one example." }],
      metadata: { status: "complete", clientMessageId: "client-turn", errorCode: null },
    },
    {
      id: "db-assistant",
      role: "assistant",
      parts: [],
      metadata: {
        status: "failed",
        clientMessageId: "client-turn",
        errorCode: "provider_timeout",
      },
    },
  ]);
});

test("chat transport body contains only the last user id and plain text", () => {
  const request = clientModule.prepareAiChatMessageRequest({
    messages: [
      { id: "old", role: "assistant", parts: [{ type: "text", text: "Old answer" }] },
      {
        id: "current",
        role: "user",
        parts: [{ type: "text", text: "Try " }, { type: "text", text: "again" }],
        metadata: { model: "client-choice", targets: ["untrusted"] },
      },
    ],
  });

  assert.deepEqual(request, {
    body: { clientMessageId: "current", content: "Try again" },
  });
  assert.deepEqual(Object.keys(request.body).sort(), ["clientMessageId", "content"]);
});

test("current targets serialize back to explicit saved or ad-hoc mutation inputs", () => {
  assert.deepEqual(clientModule.toAiChatTargetInput({
    id: "target-1",
    phraseId: "phrase-1",
    text: "run",
    meaningMode: "selected",
    selectedMeaning: { id: "legacy", translation: "бежать", context: "run every day" },
    knownMeanings: [],
  }), {
    phraseId: "phrase-1",
    meaningMode: "selected",
    selectedMeaningId: "legacy",
  });
  assert.deepEqual(clientModule.toAiChatTargetInput({
    id: "target-2",
    phraseId: null,
    text: "break even",
    meaningMode: "explore",
    selectedMeaning: null,
    knownMeanings: [],
  }), { text: "break even", meaningMode: "explore" });
});
