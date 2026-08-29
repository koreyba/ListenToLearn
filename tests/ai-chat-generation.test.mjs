import assert from "node:assert/strict";
import test from "node:test";

const generationModule = await import("../lib/ai-chat/generation.ts").catch(() => ({}));

function createHarness() {
  const providerStream = new ReadableStream();
  const uiStream = new ReadableStream();
  const calls = {};
  const model = { provider: "openrouter", modelId: "configured/model" };
  const abortSignal = new AbortController().signal;
  const input = {
    prompt: {
      system: "server system",
      messages: [
        { role: "assistant", content: "Canonical history" },
        { role: "user", content: "Canonical current message" },
      ],
    },
    pendingAssistant: { id: "assistant-stable-id" },
    runtime: {
      model,
      provenance: { provider: "openrouter", model: "configured/model" },
      timeoutMs: 20_000,
      maxOutputTokens: 800,
    },
    abortSignal,
    repository: {
      completePendingAssistant: async (completion) => {
        calls.completions ||= [];
        calls.completions.push(completion);
      },
      failPendingAssistant: async (failure) => {
        calls.failures ||= [];
        calls.failures.push(failure);
      },
    },
  };
  const dependencies = {
    streamText(options) {
      calls.streamText = options;
      return { stream: providerStream };
    },
    toUIMessageStream(options) {
      calls.toUIMessageStream = options;
      return uiStream;
    },
  };
  return { calls, dependencies, input, model, providerStream, uiStream };
}

test("generation streams only canonical server prompt with a stable assistant id", () => {
  const harness = createHarness();

  const result = generationModule.startAiChatGeneration(
    harness.input,
    harness.dependencies,
  );

  assert.notEqual(result, harness.uiStream);
  assert.deepEqual(
    Object.keys(harness.calls.streamText).sort(),
    [
      "abortSignal",
      "maxOutputTokens",
      "maxRetries",
      "messages",
      "model",
      "onAbort",
      "onEnd",
      "onError",
      "system",
      "timeout",
    ],
  );
  assert.deepEqual(
    {
      model: harness.calls.streamText.model,
      system: harness.calls.streamText.system,
      messages: harness.calls.streamText.messages,
      maxOutputTokens: harness.calls.streamText.maxOutputTokens,
      timeout: harness.calls.streamText.timeout,
      maxRetries: harness.calls.streamText.maxRetries,
      abortSignal: harness.calls.streamText.abortSignal,
    },
    {
      model: harness.model,
      system: "server system",
      messages: harness.input.prompt.messages,
      maxOutputTokens: 800,
      timeout: 20_000,
      maxRetries: 0,
      abortSignal: harness.input.abortSignal,
    },
  );
  assert.equal(harness.calls.toUIMessageStream.stream, harness.providerStream);
  assert.equal(harness.calls.toUIMessageStream.generateMessageId(), "assistant-stable-id");
  assert.equal(
    harness.calls.toUIMessageStream.onError(new Error("secret upstream body")),
    "provider_failed",
  );
  assert.equal(
    harness.calls.toUIMessageStream.onError(
      new DOMException("private timeout detail", "TimeoutError"),
    ),
    "provider_timeout",
  );
  assert.equal(harness.calls.toUIMessageStream.sendReasoning, false);
  assert.equal(harness.calls.toUIMessageStream.sendSources, false);
});

test("consumer cancellation marks the pending assistant retryable", async () => {
  const harness = createHarness();
  const stream = generationModule.startAiChatGeneration(harness.input, harness.dependencies);

  await stream.cancel("browser disconnected");

  assert.deepEqual(harness.calls.failures, [
    { assistantId: "assistant-stable-id", errorCode: "provider_timeout" },
  ]);
});

test("onEnd persists normalized plain text, provenance, and only token counts", async () => {
  const harness = createHarness();
  generationModule.startAiChatGeneration(harness.input, harness.dependencies);

  await harness.calls.streamText.onEnd({
    text: "  First line\r\nSecond line  ",
    model: {
      provider: "openrouter.chat",
      modelId: "  response/model  ",
    },
    usage: {
      inputTokens: 12,
      outputTokens: 7,
      totalTokens: 19,
      raw: { secret: "upstream-private-usage" },
      inputTokenDetails: { cacheReadTokens: 2 },
      outputTokenDetails: { reasoningTokens: 3 },
    },
    providerMetadata: { openrouter: { private: "upstream-private-metadata" } },
  });

  assert.deepEqual(harness.calls.completions, [
    {
      assistantId: "assistant-stable-id",
      text: "First line\nSecond line",
      provider: "openrouter",
      model: "response/model",
      usage: {
        inputTokens: 12,
        outputTokens: 7,
        totalTokens: 19,
      },
    },
  ]);
  assert.equal(harness.calls.failures, undefined);
  assert.equal(JSON.stringify(harness.calls.completions).includes("upstream-private"), false);
});

test("onEnd marks an empty assistant response failed", async () => {
  const harness = createHarness();
  generationModule.startAiChatGeneration(harness.input, harness.dependencies);

  await harness.calls.streamText.onEnd({
    text: " \r\n ",
    model: { provider: "openrouter", modelId: "configured/model" },
    usage: {},
  });

  assert.equal(harness.calls.completions, undefined);
  assert.deepEqual(harness.calls.failures, [
    {
      assistantId: "assistant-stable-id",
      errorCode: "empty_response",
    },
  ]);
});

test("onError and onAbort persist only stable failure codes", async () => {
  const providerHarness = createHarness();
  generationModule.startAiChatGeneration(
    providerHarness.input,
    providerHarness.dependencies,
  );
  await providerHarness.calls.streamText.onError({
    error: Object.assign(new Error("Bearer server-secret"), {
      responseBody: "private upstream body",
    }),
  });

  const timeoutHarness = createHarness();
  generationModule.startAiChatGeneration(
    timeoutHarness.input,
    timeoutHarness.dependencies,
  );
  await timeoutHarness.calls.streamText.onError({
    error: new DOMException("private timeout detail", "TimeoutError"),
  });

  const abortHarness = createHarness();
  generationModule.startAiChatGeneration(abortHarness.input, abortHarness.dependencies);
  await abortHarness.calls.streamText.onAbort({ steps: [] });

  assert.deepEqual(providerHarness.calls.failures, [
    { assistantId: "assistant-stable-id", errorCode: "provider_failed" },
  ]);
  assert.deepEqual(timeoutHarness.calls.failures, [
    { assistantId: "assistant-stable-id", errorCode: "provider_timeout" },
  ]);
  assert.deepEqual(abortHarness.calls.failures, [
    { assistantId: "assistant-stable-id", errorCode: "provider_timeout" },
  ]);
  assert.equal(
    JSON.stringify([
      providerHarness.calls.failures,
      timeoutHarness.calls.failures,
      abortHarness.calls.failures,
    ]).includes("private"),
    false,
  );
  assert.equal(JSON.stringify(providerHarness.calls.failures).includes("server-secret"), false);
});

test("terminal generation callbacks are idempotent", async () => {
  const failureHarness = createHarness();
  generationModule.startAiChatGeneration(
    failureHarness.input,
    failureHarness.dependencies,
  );
  await Promise.all([
    failureHarness.calls.streamText.onError({ error: new Error("provider failed") }),
    failureHarness.calls.streamText.onAbort({ steps: [] }),
    failureHarness.calls.streamText.onEnd({
      text: "",
      model: { provider: "openrouter", modelId: "configured/model" },
      usage: {},
    }),
  ]);

  const completionHarness = createHarness();
  generationModule.startAiChatGeneration(
    completionHarness.input,
    completionHarness.dependencies,
  );
  const successfulEnd = {
    text: "Completed once",
    model: { provider: "openrouter", modelId: "configured/model" },
    usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
  };
  await Promise.all([
    completionHarness.calls.streamText.onEnd(successfulEnd),
    completionHarness.calls.streamText.onEnd(successfulEnd),
    completionHarness.calls.streamText.onError({ error: new Error("late failure") }),
  ]);

  assert.deepEqual(failureHarness.calls.failures, [
    { assistantId: "assistant-stable-id", errorCode: "provider_failed" },
  ]);
  assert.equal(failureHarness.calls.completions, undefined);
  assert.equal(completionHarness.calls.completions.length, 1);
  assert.equal(completionHarness.calls.failures, undefined);
});

test("a failed terminal persistence attempt does not permanently latch the turn", async () => {
  const harness = createHarness();
  let attempts = 0;
  harness.input.repository.completePendingAssistant = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary D1 failure");
  };
  generationModule.startAiChatGeneration(harness.input, harness.dependencies);
  const completion = {
    text: "Completed after persistence recovered",
    model: { provider: "openrouter", modelId: "configured/model" },
    usage: {},
  };

  await assert.rejects(harness.calls.streamText.onEnd(completion));
  await harness.calls.streamText.onEnd(completion);
  assert.equal(attempts, 2);
});
