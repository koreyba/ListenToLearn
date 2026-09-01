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
  const message = (status, updatedAt = "2026-08-31T21:00:01.000Z") => ({
    id: "assistant-row",
    role: "assistant",
    status,
    clientMessageId: "client-turn",
    errorCode: status === "failed" ? "provider_timeout" : null,
    terminal: null,
    updatedAt,
  });

  assert.equal(clientModule.shouldSettleAiChatStreamFromCanonical({
    streamBusy: true,
    activeClientMessageId: "client-turn",
    canonicalMessages: [message("failed")],
  }), true);
  assert.equal(clientModule.shouldSettleAiChatStreamFromCanonical({
    streamBusy: true,
    activeClientMessageId: "client-turn",
    canonicalMessages: [message("failed", "2026-08-31T21:00:00.000Z")],
    terminalBaselineUpdatedAt: "2026-08-31T21:00:00.000Z",
  }), false);
  assert.equal(clientModule.shouldSettleAiChatStreamFromCanonical({
    streamBusy: true,
    activeClientMessageId: "client-turn",
    canonicalMessages: [message("failed", "2026-08-31T21:00:01.000Z")],
    terminalBaselineUpdatedAt: "2026-08-31T21:00:00.000Z",
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

test("stream recovery keeps polling after the fast probes until the canonical turn is terminal", async () => {
  const pending = {
    id: "chat-1",
    messages: [{ role: "assistant", status: "pending", clientMessageId: "turn-1" }],
  };
  const terminal = {
    id: "chat-1",
    messages: [{
      role: "assistant",
      status: "complete",
      clientMessageId: "turn-1",
      content: "Recovered after the transport returned",
    }],
  };
  const snapshots = [pending, pending, terminal];
  let reads = 0;
  let elapsed = 0;
  const waits = [];

  const result = await clientModule.recoverAiChatCanonicalTurn({
    clientMessageId: "turn-1",
    delaysMs: [0],
    recoveryWindowMs: 10,
    pollIntervalMs: 2,
    maxPollIntervalMs: 4,
    now: () => elapsed,
    refresh: async () => snapshots[reads++],
    wait: async (delayMs) => {
      waits.push(delayMs);
      elapsed += delayMs;
    },
  });

  assert.equal(reads, 3);
  assert.deepEqual(waits, [0, 2, 4]);
  assert.equal(result.state, "terminal");
  assert.equal(result.detail.messages[0].content, "Recovered after the transport returned");
});

test("stream recovery also survives temporary canonical-read failures", async () => {
  const terminal = {
    id: "chat-1",
    messages: [{
      role: "assistant",
      status: "failed",
      clientMessageId: "turn-1",
      errorCode: "generation_interrupted",
    }],
  };
  let reads = 0;
  let elapsed = 0;

  const result = await clientModule.recoverAiChatCanonicalTurn({
    clientMessageId: "turn-1",
    delaysMs: [0],
    recoveryWindowMs: 10,
    pollIntervalMs: 2,
    now: () => elapsed,
    refresh: async () => {
      reads += 1;
      if (reads < 3) throw new Error("Temporary canonical read failure.");
      return terminal;
    },
    wait: async (delayMs) => {
      elapsed += delayMs;
    },
  });

  assert.equal(reads, 3);
  assert.equal(result.state, "terminal");
  assert.equal(result.detail, terminal);
});

test("stream recovery abandons a hung canonical read and continues with a fresh probe", async () => {
  const terminal = {
    id: "chat-1",
    messages: [{
      role: "assistant",
      status: "complete",
      clientMessageId: "turn-1",
      content: "Recovered after a hung read",
    }],
  };
  const observedSignals = [];
  let reads = 0;

  const recovery = clientModule.recoverAiChatCanonicalTurn({
    clientMessageId: "turn-1",
    delaysMs: [0, 0],
    probeTimeoutMs: 5,
    refresh: async (signal) => {
      observedSignals.push(signal);
      reads += 1;
      if (reads === 1) return new Promise(() => {});
      return terminal;
    },
    wait: async () => {},
  });

  const result = await Promise.race([
    recovery,
    new Promise((_, reject) => setTimeout(
      () => reject(new Error("recovery remained stuck on the first canonical read")),
      100,
    )),
  ]);

  assert.equal(reads, 2);
  assert.equal(observedSignals[0].aborted, true);
  assert.notEqual(observedSignals[0], observedSignals[1]);
  assert.equal(result.state, "terminal");
  assert.equal(result.detail, terminal);
});

test("stream recovery propagates chat-change cancellation into the active probe", async () => {
  const controller = new AbortController();
  let observedSignal;
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const recovery = clientModule.recoverAiChatCanonicalTurn({
    clientMessageId: "turn-1",
    delaysMs: [0],
    probeTimeoutMs: 1_000,
    signal: controller.signal,
    refresh: async (signal) => {
      observedSignal = signal;
      markStarted();
      return new Promise(() => {});
    },
    wait: async () => {},
  });
  const reason = new DOMException("Chat changed", "AbortError");
  await started;
  controller.abort(reason);

  await assert.rejects(recovery, (error) => error === reason);
  assert.equal(observedSignal.aborted, true);
  assert.equal(observedSignal.reason, reason);
});

test("retry recovery ignores the terminal snapshot that predates the new attempt", async () => {
  const stale = {
    id: "chat-1",
    messages: [{
      role: "assistant",
      status: "failed",
      clientMessageId: "turn-1",
      errorCode: "generation_cancelled",
      updatedAt: "2026-08-31T21:00:00.000Z",
    }],
  };

  const result = await clientModule.recoverAiChatCanonicalTurn({
    clientMessageId: "turn-1",
    terminalBaselineUpdatedAt: "2026-08-31T21:00:00.000Z",
    delaysMs: [0, 0],
    refresh: async () => stale,
    wait: async () => {},
  });

  assert.equal(result.state, "unavailable");
  assert.equal(result.detail, stale);
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
