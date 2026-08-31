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
      metadata: {
        status: "complete",
        clientMessageId: "client-turn",
        errorCode: null,
        terminal: null,
      },
    },
    {
      id: "db-assistant",
      role: "assistant",
      parts: [],
      metadata: {
        status: "failed",
        clientMessageId: "client-turn",
        errorCode: "provider_timeout",
        terminal: null,
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

test("a canonical terminal assistant releases a stale local stream without cancelling the turn", () => {
  const message = (status) => ({
    id: "assistant-row",
    role: "assistant",
    content: "",
    status,
    clientMessageId: "client-turn",
    errorCode: status === "failed" ? "provider_timeout" : null,
  });

  assert.equal(clientModule.shouldSettleAiChatStreamFromCanonical({
    streamBusy: true,
    activeClientMessageId: "client-turn",
    canonicalMessages: [message("failed")],
  }), true);
  assert.equal(clientModule.shouldSettleAiChatStreamFromCanonical({
    streamBusy: true,
    activeClientMessageId: "client-turn",
    canonicalMessages: [message("complete")],
  }), true);
  assert.equal(clientModule.shouldSettleAiChatStreamFromCanonical({
    streamBusy: true,
    activeClientMessageId: "client-turn",
    canonicalMessages: [message("pending")],
  }), false);
  assert.equal(clientModule.shouldSettleAiChatStreamFromCanonical({
    streamBusy: false,
    activeClientMessageId: "client-turn",
    canonicalMessages: [message("failed")],
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

test("a quiet or interrupted stream is reconciled without pretending the user pressed Stop", () => {
  for (const input of [
    { isAbort: false, isDisconnect: false, isError: false, finishReason: undefined },
    { isAbort: true, isDisconnect: false, isError: false, finishReason: undefined },
    { isAbort: false, isDisconnect: true, isError: false, finishReason: undefined },
    { isAbort: false, isDisconnect: false, isError: true, finishReason: undefined },
  ]) {
    assert.equal(clientModule.shouldRecoverAiChatFinishedStream(input), true);
  }
  assert.equal(clientModule.shouldRecoverAiChatFinishedStream({
    isAbort: false,
    isDisconnect: false,
    isError: false,
    finishReason: "stop",
  }), false);
  assert.equal(clientModule.shouldCancelAiChatFinishedStream, undefined);
});

test("stream recovery polls canonical history until the saved turn becomes terminal", async () => {
  const snapshots = [
    {
      id: "chat-1",
      messages: [{ role: "assistant", status: "pending", clientMessageId: "turn-1" }],
    },
    null,
    {
      id: "chat-1",
      messages: [{
        role: "assistant",
        status: "complete",
        clientMessageId: "turn-1",
        content: "Canonical answer",
      }],
    },
  ];
  let reads = 0;

  const result = await clientModule.recoverAiChatCanonicalTurn({
    clientMessageId: "turn-1",
    delaysMs: [0, 0, 0],
    refresh: async () => snapshots[reads++],
    wait: async () => {},
  });

  assert.equal(reads, 3);
  assert.equal(result.state, "terminal");
  assert.equal(result.detail.messages[0].content, "Canonical answer");
});

test("stream recovery reports a still-running canonical turn without cancelling it", async () => {
  const pending = {
    id: "chat-1",
    messages: [{ role: "assistant", status: "pending", clientMessageId: "turn-1" }],
  };

  const result = await clientModule.recoverAiChatCanonicalTurn({
    clientMessageId: "turn-1",
    delaysMs: [0, 0],
    refresh: async () => pending,
    wait: async () => {},
  });

  assert.equal(result.state, "pending");
  assert.equal(result.detail, pending);
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
