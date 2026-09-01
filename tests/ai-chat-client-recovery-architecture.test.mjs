import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("client recovery stays a pure transport state machine behind the stable client facade", async () => {
  const [client, recovery] = await Promise.all([
    readFile(new URL("../lib/ai-chat/client.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/ai-chat/client-recovery.ts", import.meta.url), "utf8"),
  ]);

  assert.match(client, /from "\.\/client-recovery\.ts"/);
  assert.match(recovery, /recoverAiChatCanonicalTurn/);
  assert.match(recovery, /AI_CHAT_CANONICAL_RECOVERY_PROBE_TIMEOUT_MS/);
  assert.doesNotMatch(recovery, /from "react"|useState|useEffect|requestAiChatJson|fetch\(/);
});
