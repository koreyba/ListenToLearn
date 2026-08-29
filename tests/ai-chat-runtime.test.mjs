import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
  ]) {
    assert.deepEqual(runtimeModule.createAiChatRuntime(config, dependencies), {
      ok: false,
      error: { code: "not_configured", status: 503 },
    });
  }
  assert.equal(providerConstructions, 0);
});

test("configured runtime constructs the exact server-selected OpenRouter model", () => {
  const languageModel = { provider: "openrouter.chat", modelId: "dynamic/model" };
  const calls = [];
  const result = runtimeModule.createAiChatRuntime(
    { apiKey: "  server-secret  ", model: "  dynamic/model  " },
    {
      createOpenRouter(options) {
        calls.push({ type: "provider", options });
        return (model) => {
          calls.push({ type: "model", model });
          return languageModel;
        };
      },
    },
  );

  assert.deepEqual(calls, [
    { type: "provider", options: { apiKey: "server-secret" } },
    { type: "model", model: "dynamic/model" },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.value.model, languageModel);
  assert.deepEqual(result.value.provenance, {
    provider: "openrouter",
    model: "dynamic/model",
  });
  assert.equal(JSON.stringify(result).includes("server-secret"), false);
});

test("configured runtime exposes the bounded generation settings", () => {
  const result = runtimeModule.createAiChatRuntime(
    { apiKey: "secret", model: "dynamic/model" },
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

test("runtime failures map timeout and provider errors without leaking details", () => {
  const timeout = runtimeModule.mapAiChatRuntimeFailure(
    new Error("upstream body with server-secret"),
    { timedOut: true },
  );
  const sdkTimeout = runtimeModule.mapAiChatRuntimeFailure(
    new DOMException("20s timeout included private details", "TimeoutError"),
  );
  const provider = runtimeModule.mapAiChatRuntimeFailure(
    Object.assign(new Error("Authorization: Bearer server-secret"), {
      responseBody: "private upstream response",
      statusCode: 429,
    }),
  );

  assert.deepEqual(timeout, { code: "provider_timeout", status: 504 });
  assert.deepEqual(sdkTimeout, { code: "provider_timeout", status: 504 });
  assert.deepEqual(provider, { code: "provider_failed", status: 502 });
  assert.equal(JSON.stringify({ timeout, sdkTimeout, provider }).includes("server-secret"), false);
  assert.equal(JSON.stringify({ timeout, sdkTimeout, provider }).includes("private"), false);
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
