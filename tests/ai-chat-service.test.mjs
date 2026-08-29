import assert from "node:assert/strict";
import test from "node:test";

const serviceModule = await import("../lib/ai-chat/service.ts").catch(() => ({}));

function createHarness(overrides = {}) {
  const calls = {};
  const stream = new ReadableStream();
  const currentTargets = overrides.currentTargets || [{
    text: "run",
    meaningMode: "all_saved",
    selectedMeaning: null,
    knownMeanings: [{ translation: "бежать", context: "run every day" }],
  }];
  const repository = {
    async getChatSummary(userId, chatId) {
      calls.summary = { userId, chatId };
      return overrides.summary === undefined
        ? {
            id: chatId,
            title: "run",
            explanationLanguage: "ru",
            targetCount: currentTargets.length,
            messageCount: 0,
            createdAt: "now",
            updatedAt: "now",
          }
        : overrides.summary;
    },
    async getCurrentPracticeItems(userId, chatId) {
      calls.currentTargets = { userId, chatId };
      return currentTargets;
    },
    async beginTurn(userId, chatId, input) {
      calls.begin = { userId, chatId, input };
      return overrides.turn || {
        state: "created",
        user: {
          id: "user-row",
          role: "user",
          sequence: 3,
          content: input.content,
          clientMessageId: input.clientMessageId,
          practiceContext: input.practiceContext,
        },
        assistant: {
          id: "assistant-row",
          role: "assistant",
          status: "pending",
          clientMessageId: input.clientMessageId,
          updatedAt: "2026-08-29T11:00:00.000Z",
        },
      };
    },
    async getCanonicalHistory(userId, chatId, options) {
      calls.history = { userId, chatId, options };
      return [{ role: "assistant", content: "Canonical earlier answer" }];
    },
    async finishTurn(userId, chatId, clientMessageId, completion) {
      calls.finish = { userId, chatId, clientMessageId, completion };
    },
    async failTurn(userId, chatId, clientMessageId, errorCode, attemptUpdatedAt) {
      calls.fail = { userId, chatId, clientMessageId, errorCode, attemptUpdatedAt };
    },
  };
  const runtime = {
    model: {},
    provenance: { provider: "openrouter", model: "configured/model" },
    timeoutMs: 20_000,
    maxOutputTokens: 800,
  };
  const dependencies = {
    createRuntime(config) {
      calls.runtimeConfig = config;
      return overrides.runtimeResult || { ok: true, value: runtime };
    },
    buildPrompt(input) {
      calls.promptInput = input;
      return { system: "system", messages: [{ role: "user", content: input.currentUserMessage }] };
    },
    startGeneration(input) {
      calls.generation = input;
      return stream;
    },
  };
  return { calls, dependencies, repository, runtime, stream };
}

const request = {
  userId: "user-a",
  chatId: "chat-a",
  message: { clientMessageId: "turn-a", content: "Give me one sentence." },
  serverConfig: { apiKey: "server-only", model: "configured/model" },
  abortSignal: new AbortController().signal,
};

test("turn preparation uses stored targets and canonical history only", async () => {
  const harness = createHarness();
  const result = await serviceModule.prepareAiChatGeneration(
    { ...request, repository: harness.repository },
    harness.dependencies,
  );

  assert.equal(result.ok, true);
  assert.equal(result.stream, harness.stream);
  assert.deepEqual(harness.calls.begin.input.practiceContext, [{
    text: "run",
    meaningMode: "all_saved",
    knownMeanings: [{ translation: "бежать", context: "run every day" }],
  }]);
  assert.deepEqual(harness.calls.history.options, { beforeSequence: 3 });
  assert.deepEqual(harness.calls.promptInput, {
    explanationLanguage: "ru",
    targets: harness.calls.begin.input.practiceContext,
    history: [{ role: "assistant", content: "Canonical earlier answer" }],
    currentUserMessage: "Give me one sentence.",
  });
  assert.deepEqual(harness.calls.runtimeConfig, request.serverConfig);
  assert.equal(harness.calls.generation.pendingAssistant.id, "assistant-row");
  assert.equal(harness.calls.generation.abortSignal, request.abortSignal);

  await harness.calls.generation.repository.completePendingAssistant({
    assistantId: "assistant-row",
    text: "I run every morning.",
    provider: "openrouter",
    model: "configured/model",
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  });
  assert.deepEqual(harness.calls.finish, {
    userId: "user-a",
    chatId: "chat-a",
    clientMessageId: "turn-a",
    completion: {
      attemptUpdatedAt: "2026-08-29T11:00:00.000Z",
      content: "I run every morning.",
      provider: "openrouter",
      model: "configured/model",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    },
  });
});

test("a duplicate pending or complete turn never starts another paid generation", async () => {
  for (const status of ["pending", "complete"]) {
    const harness = createHarness({
      turn: {
        state: "existing",
        user: { content: request.message.content, practiceContext: [] },
        assistant: { id: "assistant-row", status },
      },
    });
    const result = await serviceModule.prepareAiChatGeneration(
      { ...request, repository: harness.repository },
      harness.dependencies,
    );
    assert.deepEqual(result, { ok: false, error: { code: "conflict", status: 409 } });
    assert.equal(harness.calls.runtimeConfig, undefined);
    assert.equal(harness.calls.generation, undefined);
  }
});

test("missing provider configuration retains the user turn as retryable failure", async () => {
  const harness = createHarness({
    runtimeResult: { ok: false, error: { code: "not_configured", status: 503 } },
  });
  const result = await serviceModule.prepareAiChatGeneration(
    { ...request, repository: harness.repository },
    harness.dependencies,
  );

  assert.deepEqual(result, { ok: false, error: { code: "not_configured", status: 503 } });
  assert.deepEqual(harness.calls.fail, {
    userId: "user-a",
    chatId: "chat-a",
    clientMessageId: "turn-a",
    errorCode: "not_configured",
    attemptUpdatedAt: "2026-08-29T11:00:00.000Z",
  });
  assert.equal(harness.calls.generation, undefined);
});

test("retry uses the original stored practice snapshot, not changed current targets", async () => {
  const storedContext = [{
    text: "run",
    meaningMode: "selected",
    selectedMeaning: { translation: "управлять", context: "run a company" },
  }];
  const harness = createHarness({
    currentTargets: [{
      text: "get away",
      meaningMode: "explore",
      selectedMeaning: null,
      knownMeanings: [],
    }],
    turn: {
      state: "retrying",
      user: { content: request.message.content, practiceContext: storedContext },
      assistant: {
        id: "assistant-row",
        status: "pending",
        updatedAt: "2026-08-29T11:00:00.000Z",
      },
    },
  });
  const result = await serviceModule.prepareAiChatGeneration(
    { ...request, repository: harness.repository },
    harness.dependencies,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(harness.calls.promptInput.targets, storedContext);
});

test("retrying an older turn builds context only from messages before that turn", async () => {
  const harness = createHarness({
    turn: {
      state: "retrying",
      user: {
        sequence: 7,
        content: request.message.content,
        practiceContext: [],
      },
      assistant: {
        id: "assistant-row",
        sequence: 8,
        status: "pending",
        updatedAt: "2026-08-29T11:00:00.000Z",
      },
    },
  });

  const result = await serviceModule.prepareAiChatGeneration(
    { ...request, repository: harness.repository },
    harness.dependencies,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(harness.calls.history.options, { beforeSequence: 7 });
});

test("missing or foreign chat fails before a turn or provider is created", async () => {
  const harness = createHarness({ summary: null });
  const result = await serviceModule.prepareAiChatGeneration(
    { ...request, repository: harness.repository },
    harness.dependencies,
  );

  assert.deepEqual(result, { ok: false, error: { code: "not_found", status: 404 } });
  assert.equal(harness.calls.begin, undefined);
  assert.equal(harness.calls.runtimeConfig, undefined);
});
