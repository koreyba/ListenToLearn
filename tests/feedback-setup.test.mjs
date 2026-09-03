import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("README documents the minimal D1 and Telegram setup without embedding secrets", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /## Beta feedback/);
  assert.match(readme, /wrangler d1 migrations apply DB --local --config wrangler\.jsonc/);
  assert.match(readme, /wrangler secret put TELEGRAM_BOT_TOKEN/);
  assert.match(readme, /wrangler secret put TELEGRAM_CHAT_ID/);
  assert.match(readme, /Telegram is optional/);
  assert.match(readme, /JPEG, PNG, or WebP images up to 5 MB/);
  assert.match(readme, /Images are not stored in D1/);
  assert.doesNotMatch(readme, /\d{6,}:[A-Za-z0-9_-]{20,}/);
});
