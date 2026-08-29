import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const translationModule = await import("../lib/ai-chat/translation.ts").catch(() => ({}));
const routeUrl = new URL("../app/api/ai/translate/route.ts", import.meta.url);

test("AI selection translation is bounded and uses only the server runtime", async () => {
  const calls = [];
  const result = await translationModule.translateSelectionWithAi(
    { text: "bank", context: "We sat on the bank of the river." },
    { apiKey: "server-key", model: "configured/model" },
    {
      createRuntime() {
        return {
          ok: true,
          value: {
            model: { provider: "openrouter", modelId: "configured/model" },
            provenance: { provider: "openrouter", model: "configured/model" },
            timeoutMs: 20_000,
            maxOutputTokens: 800,
          },
        };
      },
      async generateText(options) {
        calls.push(options);
        return { text: "  берег  " };
      },
    },
  );

  assert.deepEqual(result, { ok: true, value: { translation: "берег" } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].maxRetries, 0);
  assert.equal(calls[0].timeout, 20_000);
  assert.equal(calls[0].maxOutputTokens, 800);
  assert.match(calls[0].system, /Russian/u);
  assert.match(calls[0].prompt, /river/u);
  assert.equal(JSON.stringify(calls).includes("server-key"), false);
});

test("AI selection translation returns stable configuration and provider failures", async () => {
  const notConfigured = await translationModule.translateSelectionWithAi(
    { text: "bank", context: "" },
    {},
    {
      createRuntime: () => ({ ok: false, error: { code: "not_configured", status: 503 } }),
      generateText: async () => { throw new Error("must not run"); },
    },
  );
  assert.deepEqual(notConfigured, { ok: false, error: { code: "not_configured", status: 503 } });

  const failed = await translationModule.translateSelectionWithAi(
    { text: "bank", context: "" },
    { apiKey: "server-key", model: "configured/model" },
    {
      createRuntime: () => ({
        ok: true,
        value: {
          model: {},
          provenance: { provider: "openrouter", model: "configured/model" },
          timeoutMs: 20_000,
          maxOutputTokens: 800,
        },
      }),
      generateText: async () => { throw new Error("private upstream body"); },
    },
  );
  assert.deepEqual(failed, { ok: false, error: { code: "provider_failed", status: 502 } });
  assert.equal(JSON.stringify(failed).includes("private"), false);
});

test("AI translation route is authenticated, bounded, same-origin, and uncached", async () => {
  const source = await readFile(routeUrl, "utf8");
  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.match(source, /getCurrentUser\(request\)/);
  assert.match(source, /readAiMutationPayload\(request, readAiTranslatePayload\)/);
  assert.match(source, /getAiChatServerConfig\(\)/);
  assert.match(source, /translateSelectionWithAi\(/);
  assert.match(source, /noStoreJson|aiChatErrorResponse/);
  assert.doesNotMatch(source, /request\.json\(\)/);
});
