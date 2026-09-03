import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("feedback API route wires D1 persistence to background Telegram delivery", async () => {
  const source = await readFile(
    new URL("../app/api/feedback/route.ts", import.meta.url),
    "utf8",
  ).catch(() => "");

  assert.match(source, /export async function POST\(request: Request\)/);
  assert.match(source, /createFeedbackRepository\(env\.DB\)/);
  assert.match(source, /readFeedbackTelegramConfig\(env\)/);
  assert.match(source, /enforceFeedbackRateLimit\(/);
  assert.match(source, /readFeedbackRateLimitBindings\(env\)/);
  assert.match(source, /waitUntil\(promise\)/);
  assert.doesNotMatch(source, /TELEGRAM_(?:BOT_TOKEN|CHAT_ID)\s*[:=]\s*["'][^"']+["']/);
});
