import assert from "node:assert/strict";
import test from "node:test";
import { toUIMessageStream } from "ai";

const generationModule = await import("../lib/ai-chat/generation.ts").catch(() => ({}));
const runtimeModule = await import("../lib/ai-chat/runtime.ts").catch(() => ({}));

function createHarness() {
  const providerStream = new ReadableStream();
  const uiStream = new ReadableStream();
  const calls = {};
  const model = { provider: "openrouter", modelId: "configured/model" };
  const abortSignal = new AbortController().signal;
  const input = {
    prompt: {
      id: "unmumble.vocabulary-practice",
      version: "1",
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
      timeout: {
        totalMs: 45_000,
        stepMs: 25_000,
        firstChunkMs: 20_000,
        chunkMs: 20_000,
        toolMs: 5_000,
      },
      maxOutputTokens: 2_400,
      normalizeTelemetry: () => ({
        routedProviders: [],
        cost: null,
        upstreamInferenceCost: null,
      }),
      mapFailure: (error) => {
        if (error?.name === "TimeoutError") {
          return { code: "provider_timeout", status: 504 };
        }
        if (error?.statusCode === 429) {
          return { code: "provider_rate_limited", status: 429 };
        }
        return { code: "provider_failed", status: 502 };
      },
    },
    tools: {
      list_vocabulary: { description: "read vocabulary" },
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
    now: () => calls.now ?? 1_000,
    wrapLanguageModel(options) {
      calls.wrapLanguageModel = options;
      calls.wrappedModel = { provider: "wrapped", modelId: "wrapped/model" };
      return calls.wrappedModel;
    },
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
      "prepareStep",
      "stopWhen",
      "system",
      "timeout",
      "tools",
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
      tools: harness.calls.streamText.tools,
    },
    {
      model: harness.model,
      system: "server system",
      messages: harness.input.prompt.messages,
      maxOutputTokens: 2_400,
      timeout: {
        totalMs: 45_000,
        stepMs: 25_000,
        firstChunkMs: 20_000,
        chunkMs: 20_000,
        toolMs: 5_000,
      },
      maxRetries: 0,
      abortSignal: harness.input.abortSignal,
      tools: harness.input.tools,
    },
  );
  assert.equal(typeof harness.calls.streamText.stopWhen, "function");
  assert.deepEqual(harness.calls.streamText.prepareStep({
    stepNumber: 2,
    steps: [{ toolCalls: [{}] }],
  }), undefined);
  assert.deepEqual(harness.calls.streamText.prepareStep({
    stepNumber: 2,
    steps: [{ toolCalls: [{}, {}] }],
  }), {
    activeTools: [],
    toolChoice: "none",
  });
  assert.deepEqual(harness.calls.streamText.prepareStep({ stepNumber: 3, steps: [] }), undefined);
  assert.deepEqual(harness.calls.streamText.prepareStep({ stepNumber: 4 }), {
    activeTools: [],
    toolChoice: "none",
  });
  assert.notEqual(harness.calls.toUIMessageStream.stream, harness.providerStream);
  assert.equal(harness.calls.toUIMessageStream.stream instanceof ReadableStream, true);
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
  assert.equal(
    harness.calls.toUIMessageStream.onError(
      Object.assign(new Error("private quota detail"), { statusCode: 429 }),
    ),
    "provider_rate_limited",
  );
  assert.equal(harness.calls.toUIMessageStream.sendReasoning, false);
  assert.equal(harness.calls.toUIMessageStream.sendSources, false);
});

test("generation forces a routed proposal tool only on the first model step", () => {
  for (const [message, toolName] of [
    ["Добавь их в словарь.", "propose_vocabulary_entries"],
    ["Remove run from Practice.", "propose_vocabulary_state_change"],
  ]) {
    const harness = createHarness();
    harness.input.prompt.messages.at(-1).content = message;

    generationModule.startAiChatGeneration(harness.input, harness.dependencies);

    assert.equal(harness.calls.wrapLanguageModel.model, harness.model);
    assert.equal(typeof harness.calls.wrapLanguageModel.middleware.wrapStream, "function");
    assert.equal(harness.calls.streamText.model, harness.calls.wrappedModel);

    assert.deepEqual(
      harness.calls.streamText.prepareStep({ stepNumber: 0, steps: [] }),
      {
        activeTools: [toolName],
        toolChoice: "required",
      },
      message,
    );
    assert.equal(
      harness.calls.streamText.prepareStep({
        stepNumber: 1,
        steps: [{ toolCalls: [{}] }],
      }),
      undefined,
    );
    assert.deepEqual(
      harness.calls.streamText.prepareStep({
        stepNumber: 2,
        steps: [{ toolCalls: [{}, {}] }],
      }),
      { activeTools: [], toolChoice: "none" },
    );
  }
});

test("generation reports privacy-safe required-tool retry counts", async () => {
  const harness = createHarness();
  harness.input.prompt.messages.at(-1).content = "Добавь их в словарь.";
  generationModule.startAiChatGeneration(harness.input, harness.dependencies);
  const ignored = new ReadableStream({
    start(controller) {
      controller.enqueue({ type: "text-delta", delta: "invented proposal" });
      controller.close();
    },
  });
  const called = new ReadableStream({
    start(controller) {
      controller.enqueue({ type: "tool-call", toolName: "propose_vocabulary_entries" });
      controller.close();
    },
  });
  const attempts = [{ stream: ignored }, { stream: called }];
  const retried = await harness.calls.wrapLanguageModel.middleware.wrapStream({
    doStream: async () => attempts.shift(),
    params: { toolChoice: { type: "required" } },
    model: harness.model,
  });
  const drained = [];
  for await (const chunk of retried.stream) drained.push(chunk);
  assert.equal(drained.length, 1);

  await harness.calls.streamText.onEnd({
    text: "Proposal ready for review.",
    finishReason: "stop",
    usage: {},
    steps: [{ toolCalls: [{}] }],
    finalStep: { response: { modelId: "configured/model" } },
  });

  assert.equal(harness.calls.completions[0].terminal.requiredToolRetries, 1);
});

test("generation wires a conservative fallback and reports its aggregate count", async () => {
  const harness = createHarness();
  harness.input.prompt.messages.at(-1).content = "Перемести quiet comet в категорию Learning.";
  generationModule.startAiChatGeneration(harness.input, harness.dependencies);
  let attempts = 0;
  const retried = await harness.calls.wrapLanguageModel.middleware.wrapStream({
    doStream: async () => {
      attempts += 1;
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            controller.enqueue({ type: "text-delta", delta: `ignored-${attempts}` });
            controller.enqueue({
              type: "finish",
              usage: {},
              finishReason: { unified: "stop", raw: "stop" },
            });
            controller.close();
          },
        }),
      };
    },
    params: { toolChoice: { type: "required" } },
    model: harness.model,
  });
  const chunks = [];
  for await (const chunk of retried.stream) chunks.push(chunk);
  const fallback = chunks.find((chunk) => chunk.type === "tool-call");
  assert.equal(attempts, 3);
  assert.equal(fallback.toolName, "propose_vocabulary_state_change");
  assert.deepEqual(JSON.parse(fallback.input), {
    entries: [{ text: "quiet comet" }],
    destination: "learning",
  });

  await harness.calls.streamText.onEnd({
    text: "Proposal ready for review.",
    finishReason: "stop",
    usage: {},
    steps: [{ toolCalls: [{}] }],
    finalStep: { response: { modelId: "configured/model" } },
  });
  assert.deepEqual(
    {
      retries: harness.calls.completions[0].terminal.requiredToolRetries,
      fallbacks: harness.calls.completions[0].terminal.requiredToolFallbacks,
    },
    { retries: 2, fallbacks: 1 },
  );
});

test("browser stream exposes only assistant text and stable public failures", async () => {
  const harness = createHarness();
  const privateChunks = [
    { type: "start" },
    {
      type: "start-step",
      request: { body: "PRIVATE_PROVIDER_REQUEST" },
      warnings: [{ type: "other", message: "PRIVATE_WARNING" }],
    },
    {
      type: "error",
      error: new Error("PRIVATE_PROVIDER_ERROR_BODY"),
    },
    {
      type: "tool-call",
      toolCallId: "PRIVATE_TOOL_CALL_ID",
      toolName: "find_vocabulary",
      input: { query: "PRIVATE_VOCABULARY_QUERY" },
    },
    {
      type: "tool-result",
      toolCallId: "PRIVATE_TOOL_CALL_ID",
      toolName: "find_vocabulary",
      input: { query: "PRIVATE_VOCABULARY_QUERY" },
      output: { entries: [{ text: "PRIVATE_VOCABULARY_RESULT" }] },
    },
    {
      type: "text-start",
      id: "text-1",
      providerMetadata: { openrouter: { trace: "PRIVATE_PROVIDER_METADATA" } },
    },
    {
      type: "text-delta",
      id: "text-1",
      text: "Safe answer",
      providerMetadata: { openrouter: { trace: "PRIVATE_PROVIDER_METADATA" } },
    },
    {
      type: "text-end",
      id: "text-1",
      providerMetadata: { openrouter: { trace: "PRIVATE_PROVIDER_METADATA" } },
    },
    {
      type: "finish-step",
      response: { id: "PRIVATE_RESPONSE_ID", modelId: "private/model", timestamp: new Date(0) },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      performance: {},
      finishReason: "stop",
      rawFinishReason: "PRIVATE_FINISH_REASON",
      providerMetadata: { openrouter: { trace: "PRIVATE_PROVIDER_METADATA" } },
    },
    {
      type: "finish",
      finishReason: "stop",
      rawFinishReason: "PRIVATE_FINISH_REASON",
      totalUsage: {
        inputTokens: 1,
        inputTokenDetails: {
          noCacheTokens: 1,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        outputTokens: 1,
        outputTokenDetails: { textTokens: 1, reasoningTokens: 0 },
        totalTokens: 2,
        raw: { private: "PRIVATE_RAW_USAGE" },
      },
    },
  ];
  const dependencies = {
    streamText(options) {
      harness.calls.streamText = options;
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const chunk of privateChunks) controller.enqueue(chunk);
            controller.close();
          },
        }),
      };
    },
    toUIMessageStream,
  };

  const stream = generationModule.startAiChatGeneration(harness.input, dependencies);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);

  const serialized = JSON.stringify(chunks);
  assert.match(serialized, /Safe answer/u);
  for (const privateValue of [
    "PRIVATE_PROVIDER_REQUEST",
    "PRIVATE_WARNING",
    "PRIVATE_PROVIDER_ERROR_BODY",
    "PRIVATE_TOOL_CALL_ID",
    "PRIVATE_VOCABULARY_QUERY",
    "PRIVATE_VOCABULARY_RESULT",
    "PRIVATE_PROVIDER_METADATA",
    "PRIVATE_RESPONSE_ID",
    "PRIVATE_FINISH_REASON",
    "PRIVATE_RAW_USAGE",
    "providerMetadata",
    "tool-input-available",
    "tool-output-available",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(privateValue, "u"));
  }
});

test("consumer cancellation marks the pending assistant retryable", async () => {
  const harness = createHarness();
  const stream = generationModule.startAiChatGeneration(harness.input, harness.dependencies);

  await stream.cancel("browser disconnected");

  assert.deepEqual(harness.calls.failures, [
    {
      assistantId: "assistant-stable-id",
      errorCode: "generation_cancelled",
      terminal: { elapsedMs: 0 },
    },
  ]);
});

test("consumer cancellation wins when source cancellation immediately aborts generation", async () => {
  const harness = createHarness();
  harness.dependencies.toUIMessageStream = () => new ReadableStream({
    cancel() {
      return harness.calls.streamText.onAbort({ steps: [] });
    },
  });
  const stream = generationModule.startAiChatGeneration(harness.input, harness.dependencies);

  await stream.cancel("browser disconnected");

  assert.deepEqual(harness.calls.failures, [{
    assistantId: "assistant-stable-id",
    errorCode: "generation_cancelled",
    terminal: { elapsedMs: 0 },
  }]);
});

test("onEnd persists the routed model and only privacy-safe aggregate telemetry", async () => {
  const harness = createHarness();
  harness.input.runtime.provenance.model = "@preset/free-unmubme-test";
  harness.input.runtime.normalizeTelemetry = runtimeModule.extractAiChatOpenRouterTelemetry;
  generationModule.startAiChatGeneration(harness.input, harness.dependencies);

  await harness.calls.streamText.onEnd({
    text: "  First line\r\nSecond line  ",
    finishReason: "stop",
    model: {
      provider: "openrouter.chat",
      modelId: "configured/model",
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
    steps: [
      {
        providerMetadata: {
          openrouter: {
            provider: "Google",
            usage: {
              cost: 0.001,
              costDetails: { upstreamInferenceCost: 0.0005 },
              private: "upstream-private-step-usage",
            },
            reasoning_details: [{ text: "upstream-private-reasoning" }],
          },
        },
        toolCalls: [{ input: "upstream-private-tool-argument" }],
      },
      {
        providerMetadata: {
          openrouter: {
            provider: "Fireworks AI",
            usage: {
              cost: 0.003,
              costDetails: { upstreamInferenceCost: 0.002 },
            },
          },
        },
      },
    ],
    finalStep: {
      response: {
        modelId: "  actual/routed-model  ",
        body: "upstream-private-response-body",
      },
    },
  });

  assert.deepEqual(harness.calls.completions, [
    {
      assistantId: "assistant-stable-id",
      text: "First line\nSecond line",
      provider: "openrouter",
      model: "actual/routed-model",
      usage: {
        inputTokens: 12,
        outputTokens: 7,
        totalTokens: 19,
        configuredModel: "@preset/free-unmubme-test",
        promptId: "unmumble.vocabulary-practice",
        promptVersion: "1",
        routedProviders: ["Google", "Fireworks AI"],
        cost: 0.004,
        upstreamInferenceCost: 0.0025,
      },
      terminal: {
        elapsedMs: 0,
        finishReason: "stop",
        stepCount: 2,
        toolCallCount: 1,
        outputCharacters: 22,
      },
    },
  ]);
  assert.equal(harness.calls.failures, undefined);
  assert.equal(JSON.stringify(harness.calls.completions).includes("upstream-private"), false);
});

test("generation delegates telemetry and failure mapping to the configured provider adapter", async () => {
  const harness = createHarness();
  const adapterCalls = [];
  harness.input.runtime.normalizeTelemetry = (steps) => {
    adapterCalls.push({ type: "telemetry", steps });
    return {
      routedProviders: ["Adapter route"],
      cost: 0.012,
      upstreamInferenceCost: 0.01,
    };
  };
  harness.input.runtime.mapFailure = (error) => {
    adapterCalls.push({ type: "failure", error });
    return { code: "provider_rate_limited", status: 429 };
  };
  generationModule.startAiChatGeneration(harness.input, harness.dependencies);
  const steps = [{ providerMetadata: { vendor: { opaque: true } } }];

  await harness.calls.streamText.onEnd({
    text: "Provider-neutral answer",
    finishReason: "stop",
    usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
    steps,
    finalStep: { response: { modelId: "adapter/routed-model" } },
  });
  await harness.calls.streamText.onError({ error: new Error("opaque provider failure") });

  assert.equal(adapterCalls[0].type, "telemetry");
  assert.equal(adapterCalls[0].steps, steps);
  assert.equal(adapterCalls[1].type, "failure");
  assert.deepEqual(harness.calls.completions[0].usage, {
    inputTokens: 2,
    outputTokens: 3,
    totalTokens: 5,
    configuredModel: "configured/model",
    promptId: "unmumble.vocabulary-practice",
    promptVersion: "1",
    routedProviders: ["Adapter route"],
    cost: 0.012,
    upstreamInferenceCost: 0.01,
  });
});

test("onEnd marks an empty assistant response failed", async () => {
  const harness = createHarness();
  generationModule.startAiChatGeneration(harness.input, harness.dependencies);

  await harness.calls.streamText.onEnd({
    text: " \r\n ",
    finishReason: "stop",
    model: { provider: "openrouter", modelId: "configured/model" },
    usage: {},
  });

  assert.equal(harness.calls.completions, undefined);
  assert.deepEqual(harness.calls.failures, [
    {
      assistantId: "assistant-stable-id",
      errorCode: "empty_response",
      terminal: {
        elapsedMs: 0,
        finishReason: "stop",
        stepCount: 0,
        toolCallCount: 0,
        outputCharacters: 0,
      },
    },
  ]);
});

test("non-stop terminal reasons keep partial responses retryable", async () => {
  for (const finishReason of [
    "length",
    "content-filter",
    "tool-calls",
    "error",
    "other",
    "unknown",
  ]) {
    const harness = createHarness();
    generationModule.startAiChatGeneration(harness.input, harness.dependencies);

    await harness.calls.streamText.onEnd({
      text: "Partial answer",
      finishReason,
      usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
      steps: [{ toolCalls: [{ toolCallId: "private-call" }] }],
      finalStep: { response: { modelId: "configured/model" } },
    });

    assert.equal(harness.calls.completions, undefined);
    assert.deepEqual(harness.calls.failures, [{
      assistantId: "assistant-stable-id",
      errorCode: "response_incomplete",
      terminal: {
        elapsedMs: 0,
        finishReason,
        stepCount: 1,
        toolCallCount: 1,
        outputCharacters: 14,
      },
    }]);
    assert.equal(JSON.stringify(harness.calls.failures).includes("private-call"), false);
  }
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

  const rateLimitHarness = createHarness();
  generationModule.startAiChatGeneration(
    rateLimitHarness.input,
    rateLimitHarness.dependencies,
  );
  await rateLimitHarness.calls.streamText.onError({
    error: Object.assign(new Error("private quota detail"), { statusCode: 429 }),
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

  const cancelledHarness = createHarness();
  cancelledHarness.input.abortSignal = AbortSignal.abort("browser stopped");
  generationModule.startAiChatGeneration(cancelledHarness.input, cancelledHarness.dependencies);
  await cancelledHarness.calls.streamText.onAbort({ steps: [] });

  assert.deepEqual(providerHarness.calls.failures, [
    {
      assistantId: "assistant-stable-id",
      errorCode: "provider_failed",
      terminal: { elapsedMs: 0 },
    },
  ]);
  assert.deepEqual(rateLimitHarness.calls.failures, [
    {
      assistantId: "assistant-stable-id",
      errorCode: "provider_rate_limited",
      terminal: { elapsedMs: 0 },
    },
  ]);
  assert.deepEqual(timeoutHarness.calls.failures, [
    {
      assistantId: "assistant-stable-id",
      errorCode: "provider_timeout",
      terminal: { elapsedMs: 0 },
    },
  ]);
  assert.deepEqual(abortHarness.calls.failures, [
    {
      assistantId: "assistant-stable-id",
      errorCode: "provider_timeout",
      terminal: { elapsedMs: 0, stepCount: 0, toolCallCount: 0 },
    },
  ]);
  assert.deepEqual(cancelledHarness.calls.failures, [
    {
      assistantId: "assistant-stable-id",
      errorCode: "generation_cancelled",
      terminal: { elapsedMs: 0, stepCount: 0, toolCallCount: 0 },
    },
  ]);
  assert.equal(
    JSON.stringify([
      providerHarness.calls.failures,
      rateLimitHarness.calls.failures,
      timeoutHarness.calls.failures,
      abortHarness.calls.failures,
      cancelledHarness.calls.failures,
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
      finishReason: "stop",
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
    finishReason: "stop",
    model: { provider: "openrouter", modelId: "configured/model" },
    usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
  };
  await Promise.all([
    completionHarness.calls.streamText.onEnd(successfulEnd),
    completionHarness.calls.streamText.onEnd(successfulEnd),
    completionHarness.calls.streamText.onError({ error: new Error("late failure") }),
  ]);

  assert.deepEqual(failureHarness.calls.failures, [
    {
      assistantId: "assistant-stable-id",
      errorCode: "provider_failed",
      terminal: { elapsedMs: 0 },
    },
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
    finishReason: "stop",
    model: { provider: "openrouter", modelId: "configured/model" },
    usage: {},
  };

  await assert.rejects(harness.calls.streamText.onEnd(completion));
  await harness.calls.streamText.onEnd(completion);
  assert.equal(attempts, 2);
});
