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

test("an active cancellation keeps the turn blocked after the local stream stops", () => {
  assert.equal(clientModule.isAiChatTurnBlocked({
    streamBusy: false,
    canonicalPendingClientMessageId: null,
    activeClientMessageId: null,
    cancelling: true,
  }), true);
  assert.equal(clientModule.isAiChatTurnBlocked({
    streamBusy: false,
    canonicalPendingClientMessageId: null,
    activeClientMessageId: null,
    cancelling: false,
  }), false);
});

test("an unaccepted outbound turn restores its text without overwriting a newer draft", () => {
  const outbound = { clientMessageId: "client-turn", text: "Please add resilient." };

  assert.deepEqual(clientModule.reconcileAiChatOutboundTurn({
    outbound,
    canonicalMessages: [],
    currentDraft: "",
  }), {
    accepted: false,
    draft: "Please add resilient.",
    recoverable: null,
  });

  assert.deepEqual(clientModule.reconcileAiChatOutboundTurn({
    outbound,
    canonicalMessages: [],
    currentDraft: "A newer draft",
  }), {
    accepted: false,
    draft: "A newer draft",
    recoverable: outbound,
  });
});

test("canonical acknowledgement clears outbound recovery without changing the draft", () => {
  const outbound = { clientMessageId: "client-turn", text: "Please add resilient." };

  assert.deepEqual(clientModule.reconcileAiChatOutboundTurn({
    outbound,
    canonicalMessages: [{
      id: "user-row",
      role: "user",
      content: outbound.text,
      status: "complete",
      clientMessageId: outbound.clientMessageId,
      errorCode: null,
    }],
    currentDraft: "Next request",
  }), {
    accepted: true,
    draft: "Next request",
    recoverable: null,
  });
});

test("unverified delivery stays retryable with the same idempotency key", () => {
  const outbound = { clientMessageId: "client-turn", text: "Please add resilient." };

  assert.deepEqual(clientModule.preserveUnverifiedAiChatOutboundTurn({
    outbound,
    currentDraft: "",
  }), {
    draft: "",
    recoverable: outbound,
  });
  assert.deepEqual(clientModule.preserveUnverifiedAiChatOutboundTurn({
    outbound,
    currentDraft: "A newer draft",
  }), {
    draft: "A newer draft",
    recoverable: outbound,
  });
});

test("cancel recovery has a hard deadline that aborts a hung request", async () => {
  let observedSignal;
  await assert.rejects(
    clientModule.withAiChatCancelDeadline((signal) => {
      observedSignal = signal;
      return new Promise(() => {});
    }, 5),
    (error) => error?.name === "TimeoutError",
  );
  assert.equal(observedSignal.aborted, true);
});

test("a quiet or interrupted stream is cancelled while a terminal stream is refreshed", () => {
  for (const input of [
    { isAbort: false, isDisconnect: false, isError: false, finishReason: undefined },
    { isAbort: true, isDisconnect: false, isError: false, finishReason: undefined },
    { isAbort: false, isDisconnect: true, isError: false, finishReason: undefined },
    { isAbort: false, isDisconnect: false, isError: true, finishReason: undefined },
  ]) {
    assert.equal(clientModule.shouldCancelAiChatFinishedStream(input), true);
  }
  assert.equal(clientModule.shouldCancelAiChatFinishedStream({
    isAbort: false,
    isDisconnect: false,
    isError: false,
    finishReason: "stop",
  }), false);
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
