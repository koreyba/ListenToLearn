import assert from "node:assert/strict";
import test from "node:test";

test("Telegram notifier sends one plain-text message through the official Bot API", async () => {
  const telegram = await import("../lib/feedback/telegram.ts").catch(() => null);
  assert.equal(typeof telegram?.sendFeedbackToTelegram, "function", "Telegram notifier is required");

  const calls = [];
  await telegram.sendFeedbackToTelegram({
    id: "feedback-1",
    category: "bug",
    message: "Replay stopped after the second click.",
    pageUrl: "/trainer?phrase=get+it",
    userAgent: "Test Browser/1.0",
    createdAt: "2026-09-03T12:00:00.000Z",
  }, {
    botToken: "123456:test-token",
    chatId: "987654",
  }, async (...args) => {
    calls.push(args);
    return Response.json({ ok: true, result: { message_id: 42 } });
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "https://api.telegram.org/bot123456:test-token/sendMessage");
  assert.equal(calls[0][1].method, "POST");
  assert.equal(calls[0][1].headers["Content-Type"], "application/json");
  const body = JSON.parse(calls[0][1].body);
  assert.equal(body.chat_id, "987654");
  assert.match(body.text, /New beta feedback/);
  assert.match(body.text, /Type: Bug/);
  assert.match(body.text, /Replay stopped after the second click\./);
  assert.match(body.text, /Page: \/trainer\?phrase=get\+it/);
  assert.doesNotMatch(JSON.stringify(calls), /parse_mode/);
});

test("Telegram notifier sends an attached image as a photo with the feedback in its caption", async () => {
  const { sendFeedbackToTelegram } = await import("../lib/feedback/telegram.ts");
  const calls = [];
  const image = new File([
    new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
  ], "screen.jpg", { type: "image/jpeg" });

  await sendFeedbackToTelegram({
    id: "feedback-photo",
    category: "bug",
    message: "The controls overlap.",
    pageUrl: "/practice",
    userAgent: "Test Browser/1.0",
    createdAt: "2026-09-03T12:00:00.000Z",
  }, {
    botToken: "123456:test-token",
    chatId: "987654",
  }, async (...args) => {
    calls.push(args);
    return Response.json({ ok: true, result: { message_id: 43 } });
  }, image);

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "https://api.telegram.org/bot123456:test-token/sendPhoto");
  assert.equal(calls[0][1].method, "POST");
  assert.equal(calls[0][1].headers, undefined);
  assert.ok(calls[0][1].body instanceof FormData);
  assert.equal(calls[0][1].body.get("chat_id"), "987654");
  assert.match(calls[0][1].body.get("caption"), /The controls overlap\./);
  assert.equal(calls[0][1].body.get("photo").name, "screen.jpg");
});

test("Telegram notifier falls back to the stored text when a photo is rejected", async () => {
  const { sendFeedbackToTelegram } = await import("../lib/feedback/telegram.ts");
  const calls = [];
  const image = new File([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ], "screen.png", { type: "image/png" });

  await sendFeedbackToTelegram({
    id: "feedback-photo-fallback",
    category: "bug",
    message: "The screenshot is optional, but keep this report.",
    pageUrl: "/practice",
    userAgent: "Test Browser/1.0",
    createdAt: "2026-09-03T12:00:00.000Z",
  }, {
    botToken: "123456:test-token",
    chatId: "987654",
  }, async (url, init) => {
    calls.push([url, init]);
    if (url.endsWith("/sendPhoto")) {
      return Response.json({ ok: false, description: "PHOTO_INVALID_DIMENSIONS" }, { status: 400 });
    }
    return Response.json({ ok: true, result: { message_id: 44 } });
  }, image);

  assert.deepEqual(calls.map(([url]) => url.split("/").at(-1)), ["sendPhoto", "sendMessage"]);
  assert.match(JSON.parse(calls[1][1].body).text, /keep this report/);
});

test("Telegram notifier rejects an HTTP success that the Bot API marks as failed", async () => {
  const { sendFeedbackToTelegram } = await import("../lib/feedback/telegram.ts");

  await assert.rejects(
    sendFeedbackToTelegram({
      id: "feedback-2",
      category: "other",
      message: "Test",
      pageUrl: "/",
      userAgent: "Test Browser/1.0",
      createdAt: "2026-09-03T12:00:00.000Z",
    }, {
      botToken: "123456:test-token",
      chatId: "987654",
    }, async () => Response.json({ ok: false, description: "chat not found" })),
    /Telegram Bot API rejected the message\./,
  );
});
