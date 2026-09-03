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
