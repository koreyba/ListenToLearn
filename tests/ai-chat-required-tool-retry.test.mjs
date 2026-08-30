import assert from "node:assert/strict";
import test from "node:test";

const retryModule = await import("../lib/ai-chat/required-tool-retry.ts").catch(() => ({}));

function streamOf(...chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function read(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

test("required-tool retry hides an ignored text response and replays the tool response", async () => {
  assert.equal(typeof retryModule.createRequiredToolRetryMiddleware, "function");
  const attempts = [
    { stream: streamOf({ type: "text-delta", delta: "invented proposal" }) },
    { stream: streamOf({ type: "tool-call", toolName: "propose_vocabulary_entries" }) },
  ];
  let calls = 0;
  const retries = [];
  const middleware = retryModule.createRequiredToolRetryMiddleware({
    maxAttempts: 3,
    onRetry: (attempt) => retries.push(attempt),
  });

  const result = await middleware.wrapStream({
    doStream: async () => attempts[calls++],
    params: { toolChoice: { type: "required" } },
    model: {},
  });

  assert.deepEqual(await read(result.stream), [
    { type: "tool-call", toolName: "propose_vocabulary_entries" },
  ]);
  assert.equal(calls, 2);
  assert.deepEqual(retries, [1]);
});

test("required-tool retry emits an error instead of ungrounded text when attempts are exhausted", async () => {
  let calls = 0;
  const middleware = retryModule.createRequiredToolRetryMiddleware({ maxAttempts: 3 });
  const result = await middleware.wrapStream({
    doStream: async () => {
      calls += 1;
      return { stream: streamOf({ type: "text-delta", delta: `ignored-${calls}` }) };
    },
    params: { toolChoice: { type: "required" } },
    model: {},
  });

  const chunks = await read(result.stream);
  assert.equal(calls, 3);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].type, "error");
  assert.equal(chunks[0].error?.name, "RequiredToolNotCalledError");
});

test("required-tool retry can emit a conservative server fallback tool call", async () => {
  let calls = 0;
  let fallbacks = 0;
  const finish = {
    type: "finish",
    usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
    finishReason: { unified: "stop", raw: "stop" },
  };
  const middleware = retryModule.createRequiredToolRetryMiddleware({
    maxAttempts: 2,
    fallbackToolCall: () => ({
      toolName: "propose_vocabulary_state_change",
      input: { entries: [{ text: "quiet comet" }], destination: "learning" },
    }),
    onFallback: () => {
      fallbacks += 1;
    },
  });
  const result = await middleware.wrapStream({
    doStream: async () => {
      calls += 1;
      return {
        stream: streamOf(
          { type: "stream-start", warnings: [] },
          { type: "text-delta", delta: `ignored-${calls}` },
          finish,
        ),
      };
    },
    params: { toolChoice: { type: "required" } },
    model: {},
  });

  const chunks = await read(result.stream);
  assert.equal(calls, 2);
  assert.equal(fallbacks, 1);
  assert.deepEqual(chunks.map((chunk) => chunk.type), [
    "stream-start",
    "tool-call",
    "finish",
  ]);
  assert.equal(chunks[1].toolName, "propose_vocabulary_state_change");
  assert.deepEqual(JSON.parse(chunks[1].input), {
    entries: [{ text: "quiet comet" }],
    destination: "learning",
  });
  assert.match(chunks[1].toolCallId, /^server-fallback-/u);
  assert.deepEqual(chunks[2].finishReason, { unified: "tool-calls", raw: undefined });
});

test("ordinary auto-tool streams are never buffered or retried", async () => {
  const original = { stream: streamOf({ type: "text-delta", delta: "hello" }) };
  let calls = 0;
  const middleware = retryModule.createRequiredToolRetryMiddleware({ maxAttempts: 3 });
  const result = await middleware.wrapStream({
    doStream: async () => {
      calls += 1;
      return original;
    },
    params: { toolChoice: { type: "auto" } },
    model: {},
  });

  assert.equal(result, original);
  assert.equal(calls, 1);
  assert.deepEqual(await read(result.stream), [{ type: "text-delta", delta: "hello" }]);
});
