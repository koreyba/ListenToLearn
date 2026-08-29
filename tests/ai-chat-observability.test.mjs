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
