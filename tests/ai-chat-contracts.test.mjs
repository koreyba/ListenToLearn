import assert from "node:assert/strict";
import test from "node:test";

const contracts = await import("../lib/ai-chat/contracts.ts").catch(() => ({}));

test("AI chat exposes conservative paid-request safety limits", () => {
  assert.deepEqual(contracts.AI_CHAT_GENERATION_TIMEOUT, {
    totalMs: 45_000,
    stepMs: 25_000,
    firstChunkMs: 20_000,
    chunkMs: 20_000,
    toolMs: 5_000,
  });
  assert.deepEqual(contracts.AI_CHAT_LIMITS, {
    bodyBytes: 16_384,
    targetCount: 12,
    targetTextCharacters: 240,
    meaningsPerTarget: 12,
    meaningCharacters: 1_000,
    contextCharacters: 1_000,
    promptMeaningCharacters: 100,
    promptContextCharacters: 160,
    targetPromptCharacters: 48_000,
    messageCharacters: 4_000,
    historyMessages: 40,
    historyCharacters: 32_000,
    outputTokens: 2_400,
    upstreamTimeoutMs: 45_000,
  });
});

test("AI chat accepts only the three explicit meaning modes", () => {
  assert.equal(contracts.isMeaningMode("all_saved"), true);
  assert.equal(contracts.isMeaningMode("selected"), true);
  assert.equal(contracts.isMeaningMode("explore"), true);
  assert.equal(contracts.isMeaningMode("all"), false);
  assert.equal(contracts.isMeaningMode(null), false);
});

test("meaning dedupe normalizes Unicode, case, and internal whitespace", () => {
  assert.equal(contracts.normalizeMeaning("  ＧЕТ\t  ВЕРНО  "), "gет верно");
  assert.equal(contracts.normalizeMeaning(42), "");
});

test("bounded text validation cleans valid input and rejects empty or oversized fields", () => {
  assert.deepEqual(
    contracts.readBoundedText("  a\n  target  ", 20, { singleLine: true }),
    { ok: true, value: "a target" },
  );
  assert.deepEqual(
    contracts.readBoundedText(" \n ", 20),
    { ok: false, error: { code: "invalid_field", status: 400 } },
  );
  assert.deepEqual(
    contracts.readBoundedText("🙂🙂", 1),
    { ok: false, error: { code: "field_too_long", status: 400 } },
  );
});

test("mutation origin validation requires the exact request origin", () => {
  const sameOrigin = new Request("https://unmumble.example/api/ai/chats", {
    method: "POST",
    headers: { Origin: "https://unmumble.example" },
  });
  const crossOrigin = new Request("https://unmumble.example/api/ai/chats", {
    method: "POST",
    headers: { Origin: "https://evil.example" },
  });
  assert.equal(contracts.hasSameOrigin(sameOrigin), true);
  assert.equal(contracts.hasSameOrigin(crossOrigin), false);
  assert.equal(
    contracts.hasSameOrigin(new Request("https://unmumble.example/api/ai/chats", { method: "POST" })),
    false,
  );
});

test("bounded JSON parsing accepts one object and rejects malformed, array, or oversized bodies", async () => {
  const valid = new Request("https://unmumble.example/api/ai/chats", {
    method: "POST",
    body: JSON.stringify({ content: "hello" }),
  });
  assert.deepEqual(
    await contracts.readBoundedJsonObject(valid, 100),
    { ok: true, value: { content: "hello" } },
  );

  for (const body of ["{", "[]"]) {
    const request = new Request("https://unmumble.example/api/ai/chats", { method: "POST", body });
    assert.deepEqual(
      await contracts.readBoundedJsonObject(request, 100),
      { ok: false, error: { code: "invalid_json", status: 400 } },
    );
  }

  const oversized = new Request("https://unmumble.example/api/ai/chats", {
    method: "POST",
    body: JSON.stringify({ content: "🙂🙂" }),
  });
  assert.deepEqual(
    await contracts.readBoundedJsonObject(oversized, 20),
    { ok: false, error: { code: "request_too_large", status: 413 } },
  );
});

test("target parsing distinguishes saved and ad-hoc targets with explicit meaning scope", () => {
  assert.deepEqual(
    contracts.readAiChatTarget({
      phraseId: " phrase-1 ",
      meaningMode: "selected",
      selectedMeaningId: " meaning-1 ",
    }),
    {
      ok: true,
      value: {
        source: "saved",
        phraseId: "phrase-1",
        meaningMode: "selected",
        selectedMeaningId: "meaning-1",
      },
    },
  );
  assert.deepEqual(
    contracts.readAiChatTarget({ text: "  get\taway  " }),
    {
      ok: true,
      value: { source: "ad_hoc", text: "get away", meaningMode: "all_saved" },
    },
  );
  for (const value of [
    { phraseId: "phrase-1", text: "get away" },
    { text: "get away", meaningMode: "selected", selectedMeaningId: "meaning-1" },
    { phraseId: "phrase-1", meaningMode: "selected" },
  ]) {
    assert.deepEqual(
      contracts.readAiChatTarget(value),
      { ok: false, error: { code: "invalid_target", status: 400 } },
    );
  }
});

test("chat failures use a stable public error-code vocabulary", () => {
  assert.deepEqual(contracts.AI_CHAT_ERROR_CODES, {
    invalidOrigin: "invalid_origin",
    invalidJson: "invalid_json",
    requestTooLarge: "request_too_large",
    invalidRequest: "invalid_request",
    invalidField: "invalid_field",
    fieldTooLong: "field_too_long",
    invalidTarget: "invalid_target",
    targetLimit: "target_limit",
    notFound: "not_found",
    conflict: "conflict",
    turnInProgress: "turn_in_progress",
    notConfigured: "not_configured",
    providerTimeout: "provider_timeout",
    providerRateLimited: "provider_rate_limited",
    providerFailed: "provider_failed",
    responseIncomplete: "response_incomplete",
    generationCancelled: "generation_cancelled",
    emptyResponse: "empty_response",
    internalError: "internal_error",
  });
});
