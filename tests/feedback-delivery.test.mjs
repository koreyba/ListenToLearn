import assert from "node:assert/strict";
import test from "node:test";

const submission = {
  id: "feedback-1",
  category: "idea",
  message: "Add keyboard shortcuts.",
  pageUrl: "/practice",
  userAgent: "Test Browser/1.0",
  createdAt: "2026-09-03T12:00:00.000Z",
};

test("delivery marks stored feedback as sent only after Telegram accepts it", async () => {
  const delivery = await import("../lib/feedback/delivery.ts").catch(() => null);
  assert.equal(typeof delivery?.deliverFeedbackToTelegram, "function", "feedback delivery service is required");

  const events = [];
  await delivery.deliverFeedbackToTelegram({
    submission,
    config: { botToken: "test-token", chatId: "test-chat" },
    send: async () => events.push("sent"),
    mark: async (_id, status) => events.push(status),
    logError: () => assert.fail("successful delivery must not log an error"),
  });

  assert.deepEqual(events, ["sent", "sent"]);
});

test("delivery forwards an ephemeral image without passing it to persistence", async () => {
  const { deliverFeedbackToTelegram } = await import("../lib/feedback/delivery.ts");
  const image = new File([
    new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
  ], "screen.jpg", { type: "image/jpeg" });
  const calls = [];

  await deliverFeedbackToTelegram({
    submission,
    image,
    config: { botToken: "test-token", chatId: "test-chat" },
    send: async (...args) => calls.push(args),
    mark: async () => {},
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][3], image);
});

test("delivery records not_configured without attempting Telegram when secrets are absent", async () => {
  const { deliverFeedbackToTelegram } = await import("../lib/feedback/delivery.ts");
  const marks = [];

  await deliverFeedbackToTelegram({
    submission,
    config: null,
    send: async () => assert.fail("Telegram must not be called without configuration"),
    mark: async (_id, status) => marks.push(status),
  });

  assert.deepEqual(marks, ["not_configured"]);
});

test("delivery keeps the stored report and records a failed Telegram attempt", async () => {
  const { deliverFeedbackToTelegram } = await import("../lib/feedback/delivery.ts");
  const marks = [];
  const errors = [];

  await deliverFeedbackToTelegram({
    submission,
    config: { botToken: "test-token", chatId: "test-chat" },
    send: async () => { throw new Error("Telegram unavailable"); },
    mark: async (_id, status) => marks.push(status),
    logError: (event) => errors.push(event),
  });

  assert.deepEqual(marks, ["failed"]);
  assert.deepEqual(errors, [{
    message: "feedback.telegram_delivery_failed",
    submissionId: "feedback-1",
    error: "Telegram delivery failed.",
  }]);
});
