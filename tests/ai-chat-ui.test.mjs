import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL("../app/components/ai-practice-chat.tsx", import.meta.url);
const phraseWorkspaceUrl = new URL("../app/components/phrase-workspace.tsx", import.meta.url);

test("signed-in chat uses AI SDK useChat with the compact canonical transport", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /useChat<AiChatUiMessage>/);
  assert.match(source, /new DefaultChatTransport/);
  assert.match(source, /prepareSendMessagesRequest: prepareAiChatMessageRequest/);
  assert.match(source, /\/api\/ai\/chats\/\$\{chat\.id\}\/messages/);
  assert.match(source, /sendMessage\(/);
  assert.match(source, /Retry/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
});

test("chat UI manages multiple chats and multiple saved or ad-hoc targets", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /New chat/);
  assert.match(source, /Add saved target/);
  assert.match(source, /Add word or phrase/);
  assert.match(source, /all_saved/);
  assert.match(source, /selected/);
  assert.match(source, /explore/);
  assert.match(source, /replaceTargets/);
  assert.match(source, /targets\.map/);
});

test("assistant text exposes contextual translate, add-to-Practice, add-meaning, and manual status actions", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /InteractiveEnglishText/);
  assert.match(source, /\/api\/translate/);
  assert.match(source, /\/api\/ai\/translate/);
  assert.match(source, /\/api\/phrases/);
  assert.match(source, /\/api\/ai\/meanings/);
  assert.match(source, /Add to Learn/);
  assert.match(source, /Add meaning/);
  assert.match(source, /Learning Now/);
  assert.match(source, /Learned/);
});

test("Library and Practice can launch focused AI practice with the chosen phrase", async () => {
  const source = await readFile(phraseWorkspaceUrl, "utf8");
  assert.match(source, /Practice with AI/);
  assert.match(source, /\/chat\?\$\{query\.toString\(\)\}/);
  assert.match(source, /phraseId/);
});
