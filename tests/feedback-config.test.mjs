import assert from "node:assert/strict";
import test from "node:test";

test("Telegram feedback config requires both server-side secrets", async () => {
  const config = await import("../lib/feedback/server-config.ts").catch(() => null);
  assert.equal(typeof config?.readFeedbackTelegramConfig, "function", "feedback Telegram config reader is required");

  assert.deepEqual(config.readFeedbackTelegramConfig({
    TELEGRAM_BOT_TOKEN: "  123456:test-token  ",
    TELEGRAM_CHAT_ID: " 987654 ",
  }), {
    botToken: "123456:test-token",
    chatId: "987654",
  });
  assert.equal(config.readFeedbackTelegramConfig({ TELEGRAM_BOT_TOKEN: "token" }), null);
  assert.equal(config.readFeedbackTelegramConfig({ TELEGRAM_CHAT_ID: "chat" }), null);
});

test("feedback rate-limit config keeps its bindings separate from Telegram secrets", async () => {
  const { readFeedbackRateLimitBindings } = await import("../lib/feedback/server-config.ts");
  const clientLimiter = { limit: async () => ({ success: true }) };
  const edgeAggregateLimiter = { limit: async () => ({ success: true }) };

  assert.deepEqual(readFeedbackRateLimitBindings({
    FEEDBACK_CLIENT_RATE_LIMITER: clientLimiter,
    FEEDBACK_EDGE_AGGREGATE_RATE_LIMITER: edgeAggregateLimiter,
  }), { clientLimiter, edgeAggregateLimiter });
  assert.deepEqual(readFeedbackRateLimitBindings(null), {});
});
