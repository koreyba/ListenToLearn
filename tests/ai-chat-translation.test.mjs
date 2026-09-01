import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("../app/api/ai/translate/route.ts", import.meta.url);
const moduleUrl = new URL("../lib/ai-chat/translation.ts", import.meta.url);

test("chat-only backend has no untraced standalone AI translation surface", async () => {
  await assert.rejects(access(routeUrl), { code: "ENOENT" });
  await assert.rejects(access(moduleUrl), { code: "ENOENT" });
  const contracts = await readFile(
    new URL("../lib/ai-chat/api-contracts.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(contracts, /readAiTranslatePayload/u);
});
