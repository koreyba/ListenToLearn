import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, jsonSchema, tool } from "ai";

const runtimeModule = await import("../lib/ai-chat/runtime.ts").catch(() => ({}));

test("missing server key or model fails before OpenRouter model construction", () => {
  let providerConstructions = 0;
  const dependencies = {
    createOpenRouter() {
      providerConstructions += 1;
      return () => ({ provider: "unexpected", modelId: "unexpected" });
    },
  };

  for (const config of [
    { apiKey: "", model: "openai/example" },
    { apiKey: "secret", model: "   " },
    { apiKey: "secret", model: "model with spaces" },
    { apiKey: "secret", model: "model\nprivate-header" },
    { apiKey: "secret", model: "unknown" },
    { apiKey: "secret", model: `vendor/${"x".repeat(241)}` },
  ]) {
    assert.deepEqual(runtimeModule.createAiChatRuntime(config, dependencies), {
      ok: false,
      error: { code: "not_configured", status: 503 },
    });
  }
  assert.equal(providerConstructions, 0);
});

test("configured provenance accepts only the code-owned model allowlist", () => {
  assert.deepEqual(runtimeModule.describeAiChatConfiguredProvenance({
    model: "  deepseek/deepseek-v4-flash-0731  ",
  }), {
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash-0731",
  });
  for (const model of [
    "@preset/free-unmubme-test",
    "dynamic/model",
    "model with spaces",
  ]) {
    assert.deepEqual(runtimeModule.describeAiChatConfiguredProvenance({ model }), {
      provider: "openrouter",
      model: "unknown",
    });
  }
});

test("configured predicate uses the same key and model allowlist as runtime", () => {
  assert.equal(runtimeModule.isAiChatRuntimeConfigured({
    apiKey: "secret",
    model: "deepseek/deepseek-v4-flash-0731",
  }), true);
  for (const config of [
    { apiKey: "", model: "deepseek/deepseek-v4-flash-0731" },
    { apiKey: "secret", model: "@preset/free-unmubme-test" },
    { apiKey: "secret", model: "dynamic/model" },
  ]) {
    assert.equal(runtimeModule.isAiChatRuntimeConfigured(config), false);
  }
});

test("configured runtime constructs the exact server-selected OpenRouter model", () => {
  assert.deepEqual(runtimeModule.AI_CHAT_OPENROUTER_MODELS, [
    "deepseek/deepseek-v4-flash-0731",
  ]);
  const languageModel = { provider: "openrouter.chat", modelId: "dynamic/model" };
  const calls = [];
  const result = runtimeModule.createAiChatRuntime(
    {
      apiKey: "  server-secret  ",
      model: "  deepseek/deepseek-v4-flash-0731  ",
    },
    {
      createOpenRouter(options) {
        calls.push({ type: "provider", options });
        return (model, settings) => {
          calls.push({ type: "model", model, settings });
          return languageModel;
        };
      },
    },
  );

  assert.deepEqual(calls, [
    { type: "provider", options: { apiKey: "server-secret" } },
    {
      type: "model",
      model: "deepseek/deepseek-v4-flash-0731",
      settings: {
        plugins: [],
        provider: {
          data_collection: "deny",
          zdr: true,
          require_parameters: true,
        },
      },
    },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.value.model, languageModel);
  assert.deepEqual(result.value.provenance, {
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash-0731",
  });
  assert.equal(typeof result.value.normalizeTelemetry, "function");
  assert.equal(typeof result.value.mapFailure, "function");
  assert.equal(JSON.stringify(result).includes("server-secret"), false);
});

test("configured runtime exposes the bounded generation settings", () => {
  const result = runtimeModule.createAiChatRuntime(
    { apiKey: "secret", model: "deepseek/deepseek-v4-flash-0731" },
    { createOpenRouter: () => () => ({}) },
  );

  assert.deepEqual(
    {
      timeoutMs: result.value.timeoutMs,
      maxOutputTokens: result.value.maxOutputTokens,
    },
    { timeoutMs: 20_000, maxOutputTokens: 800 },
  );
});

test("outbound OpenRouter request uses the tool-capable concrete model and only local AI SDK tools", async () => {
  let outboundBody;
  const result = runtimeModule.createAiChatRuntime(
    { apiKey: "test-secret", model: "deepseek/deepseek-v4-flash-0731" },
    {
      createOpenRouter(options) {
        return createOpenRouter({
          ...options,
          fetch: async (_url, init) => {
            outboundBody = JSON.parse(init.body);
            return new Response(JSON.stringify({
              id: "test-response",
              object: "chat.completion",
              created: 1,
              model: "deepseek/deepseek-v4-flash-0731",
              choices: [{
                index: 0,
                message: { role: "assistant", content: "ok" },
                finish_reason: "stop",
              }],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          },
        });
      },
    },
  );

  assert.equal(result.ok, true);
  const generated = await generateText({
    model: result.value.model,
    prompt: "practice",
    maxRetries: 0,
    tools: {
      local_read: tool({
        description: "Local traced vocabulary read",
        inputSchema: jsonSchema({
          type: "object",
          properties: {},
          additionalProperties: false,
        }),
        execute: async () => ({ ok: true }),
      }),
    },
  });

  assert.equal(generated.text, "ok");
  assert.equal(outboundBody.model, "deepseek/deepseek-v4-flash-0731");
  assert.equal(Object.hasOwn(outboundBody, "preset"), false);
  assert.equal(Object.hasOwn(outboundBody, "models"), false);
  assert.deepEqual(outboundBody.plugins, []);
  assert.deepEqual(outboundBody.provider, {
    data_collection: "deny",
    zdr: true,
    require_parameters: true,
  });
  assert.deepEqual(outboundBody.tools.map((entry) => entry.function.name), [
    "local_read",
  ]);
  assert.equal(outboundBody.tool_choice, "auto");
});

test("OpenRouter telemetry keeps only safe provider names and finite nonnegative cost totals", () => {
  assert.equal(typeof runtimeModule.extractAiChatOpenRouterTelemetry, "function");
  const telemetry = runtimeModule.extractAiChatOpenRouterTelemetry([
    {
      providerMetadata: {
        openrouter: {
          provider: "  Google  ",
          usage: {
            cost: 0.001,
            costDetails: { upstreamInferenceCost: 0.0005 },
            privateUsage: "PRIVATE_USAGE_DETAIL",
          },
          reasoning_details: [{ text: "PRIVATE_REASONING" }],
        },
      },
    },
    {
      providerMetadata: {
        openrouter: {
          provider: "Evil\nAuthorization: Bearer PRIVATE_SECRET",
          usage: {
            cost: -1,
            costDetails: { upstreamInferenceCost: Number.NaN },
          },
        },
      },
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
        anotherProvider: { raw: "PRIVATE_OTHER_METADATA" },
      },
    },
    {
      providerMetadata: {
        openrouter: {
          provider: "Google",
          usage: { cost: Number.POSITIVE_INFINITY },
        },
      },
    },
  ]);

  assert.deepEqual(telemetry, {
    routedProviders: ["Google", "Fireworks AI"],
    cost: 0.004,
    upstreamInferenceCost: 0.0025,
  });
  const serialized = JSON.stringify(telemetry);
  for (const privateValue of [
    "PRIVATE_USAGE_DETAIL",
    "PRIVATE_REASONING",
    "PRIVATE_SECRET",
    "PRIVATE_OTHER_METADATA",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(privateValue, "u"));
  }
});

test("runtime failures map timeout and provider errors without leaking details", () => {
  const timeout = runtimeModule.mapAiChatRuntimeFailure(
    new Error("upstream body with server-secret"),
    { timedOut: true },
  );
  const sdkTimeout = runtimeModule.mapAiChatRuntimeFailure(
    new DOMException("20s timeout included private details", "TimeoutError"),
  );
  const rateLimited = runtimeModule.mapAiChatRuntimeFailure(
    Object.assign(new Error("Authorization: Bearer server-secret"), {
      responseBody: "private upstream response",
      statusCode: 429,
    }),
  );
  const provider = runtimeModule.mapAiChatRuntimeFailure(
    Object.assign(new Error("private upstream failure"), { statusCode: 503 }),
  );

  assert.deepEqual(timeout, { code: "provider_timeout", status: 504 });
  assert.deepEqual(sdkTimeout, { code: "provider_timeout", status: 504 });
  assert.deepEqual(rateLimited, { code: "provider_rate_limited", status: 429 });
  assert.deepEqual(provider, { code: "provider_failed", status: 502 });
  assert.equal(
    JSON.stringify({ timeout, sdkTimeout, rateLimited, provider }).includes("server-secret"),
    false,
  );
  assert.equal(
    JSON.stringify({ timeout, sdkTimeout, rateLimited, provider }).includes("private"),
    false,
  );
});

test("assistant text normalization rejects an empty provider response", () => {
  assert.deepEqual(runtimeModule.normalizeAiChatAssistantText(" \r\n\t "), {
    ok: false,
    error: { code: "empty_response", status: 502 },
  });
  assert.deepEqual(runtimeModule.normalizeAiChatAssistantText("  First\r\nSecond  "), {
    ok: true,
    value: "First\nSecond",
  });
});

test("local Cloudflare secret files are ignored", () => {
  const gitignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");

  assert.match(gitignore, /^\.dev\.vars\*$/mu);
});
