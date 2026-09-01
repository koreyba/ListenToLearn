import assert from "node:assert/strict";
import test from "node:test";

const telemetryModule = await import("../lib/ai-chat/terminal-telemetry.ts").catch(() => ({}));

test("terminal telemetry serialization keeps only bounded aggregate fields", () => {
  assert.equal(typeof telemetryModule.serializeAiChatTerminalTelemetry, "function");
  const serialized = telemetryModule.serializeAiChatTerminalTelemetry({
    elapsedMs: 20_234.9,
    finishReason: "length",
    stepCount: 3,
    toolCallCount: 2,
    outputCharacters: 9_000,
    removedRetryMetric: 1,
    removedFallbackMetric: 1,
    termination: "transport_disconnected",
    rawError: "secret provider response",
    toolArgs: { entries: ["secret"] },
  });

  assert.deepEqual(JSON.parse(serialized), {
    elapsedMs: 20_234,
    finishReason: "length",
    stepCount: 3,
    toolCallCount: 2,
    outputCharacters: 9_000,
    termination: "transport_disconnected",
  });
  assert.ok(new TextEncoder().encode(serialized).byteLength <= 2_048);
  assert.equal(serialized.includes("secret"), false);
});

test("terminal telemetry parsing rejects malformed and non-public fields", () => {
  assert.equal(telemetryModule.parseAiChatTerminalTelemetry(null), null);
  assert.equal(telemetryModule.parseAiChatTerminalTelemetry("not json"), null);
  assert.deepEqual(
    telemetryModule.parseAiChatTerminalTelemetry(JSON.stringify({
      elapsedMs: -1,
      finishReason: "provider-private-reason",
      stepCount: 2,
      termination: "unknown-private-cause",
    })),
    { stepCount: 2 },
  );
});
