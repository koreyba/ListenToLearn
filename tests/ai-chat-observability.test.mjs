import assert from "node:assert/strict";
import test from "node:test";

const observability = await import("../lib/ai-chat/observability.ts").catch(() => ({}));

test("AI operational events emit an exact metadata allowlist", () => {
  const records = [];
  const emitted = observability.recordAiChatOperationalEvent({
    event: "ai_chat_generation_started",
    attemptId: "attempt-1",
    provider: "openrouter",
    configuredModel: "@preset/free-test",
    promptId: "unmumble.vocabulary-practice",
    promptVersion: "1",
    prompt: "private learner message",
    apiKey: "private-provider-key",
  }, (record) => records.push(record));

  assert.equal(emitted, true);
  assert.deepEqual(records, [{
    event: "ai_chat_generation_started",
    attemptId: "attempt-1",
    provider: "openrouter",
    configuredModel: "@preset/free-test",
    promptId: "unmumble.vocabulary-practice",
    promptVersion: "1",
  }]);
  assert.equal(JSON.stringify(records).includes("private"), false);
});

test("AI operational logger rejects unknown events and swallows sink failures", () => {
  assert.equal(observability.recordAiChatOperationalEvent({
    event: "prompt_dump",
    prompt: "private",
  }, () => {
    throw new Error("must not be called");
  }), false);

  assert.equal(observability.recordAiChatOperationalEvent({
    event: "ai_chat_generation_failed",
    attemptId: "attempt-1",
    errorCode: "provider_failed",
  }, () => {
    throw new Error("logging backend unavailable");
  }), false);
});

test("terminal generation events keep useful bounded telemetry and no raw content", () => {
  const records = [];
  observability.recordAiChatOperationalEvent({
    event: "ai_chat_generation_failed",
    attemptId: "attempt-1",
    errorCode: "response_incomplete",
    promptId: "unmumble.vocabulary-practice",
    promptVersion: "1",
    elapsedMs: 45_001,
    finishReason: "length",
    stepCount: 3,
    toolCallCount: 2,
    outputCharacters: 8_200,
    termination: "transport_disconnected",
    removedRetryMetric: 2,
    text: "PRIVATE_PARTIAL_RESPONSE",
    rawFinishReason: "PRIVATE_PROVIDER_REASON",
  }, (record) => records.push(record));
  observability.recordAiChatOperationalEvent({
    event: "ai_chat_generation_completed",
    attemptId: "attempt-2",
    provider: "openrouter",
    model: "routed/model",
    promptId: "unmumble.vocabulary-practice",
    promptVersion: "1",
    elapsedMs: 4_321,
    finishReason: "stop",
    stepCount: 2,
    toolCallCount: 1,
    outputCharacters: 240,
    removedFallbackMetric: 1,
    text: "PRIVATE_COMPLETE_RESPONSE",
  }, (record) => records.push(record));

  assert.deepEqual(records, [
    {
      event: "ai_chat_generation_failed",
      attemptId: "attempt-1",
      errorCode: "response_incomplete",
      promptId: "unmumble.vocabulary-practice",
      promptVersion: "1",
      elapsedMs: 45_001,
      finishReason: "length",
      stepCount: 3,
      toolCallCount: 2,
      outputCharacters: 8_200,
      termination: "transport_disconnected",
    },
    {
      event: "ai_chat_generation_completed",
      attemptId: "attempt-2",
      provider: "openrouter",
      model: "routed/model",
      promptId: "unmumble.vocabulary-practice",
      promptVersion: "1",
      elapsedMs: 4_321,
      finishReason: "stop",
      stepCount: 2,
      toolCallCount: 1,
      outputCharacters: 240,
    },
  ]);
  assert.doesNotMatch(JSON.stringify(records), /PRIVATE/u);
});

test("explicit Stop emits one content-free event for the durable attempt", () => {
  const records = [];
  observability.recordAiChatOperationalEvent({
    event: "ai_chat_turn_cancelled",
    attemptId: "attempt-3",
    clientMessageId: "must-not-leak",
    text: "PRIVATE_USER_MESSAGE",
  }, (record) => records.push(record));

  assert.deepEqual(records, [{
    event: "ai_chat_turn_cancelled",
    attemptId: "attempt-3",
  }]);
  assert.doesNotMatch(JSON.stringify(records), /PRIVATE|must-not-leak/u);
});
