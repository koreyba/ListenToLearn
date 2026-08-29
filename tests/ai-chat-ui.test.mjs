import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL("../app/components/ai-practice-chat.tsx", import.meta.url);
const phraseWorkspaceUrl = new URL("../app/components/phrase-workspace.tsx", import.meta.url);
const stylesUrl = new URL("../app/globals.css", import.meta.url);

test("signed-in chat uses AI SDK useChat with the compact canonical transport", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /useChat<AiChatUiMessage>/);
  assert.match(source, /new DefaultChatTransport/);
  assert.match(source, /prepareSendMessagesRequest: prepareAiChatMessageRequest/);
  assert.match(source, /\/api\/ai\/chats\/\$\{chat\.id\}\/messages/);
  assert.match(source, /sendMessage\(/);
  assert.match(source, /Retry/);
  assert.match(source, /provider_rate_limited/);
  assert.match(source, /turn_in_progress/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
});

test("chat UI only exposes chat history, New Chat, messages, and the composer", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /aria-label="Practice chats"/);
  assert.match(source, />New Chat<\/button>/);
  assert.match(source, /className="ai-chat-messages"/);
  assert.match(source, /className="ai-chat-composer"/);
  assert.doesNotMatch(source, /ai-chat-target-panel/);
  assert.doesNotMatch(source, /ai-chat-target-adders/);
  assert.doesNotMatch(source, /ai-chat-selection/);
  assert.doesNotMatch(source, /ai-chat-suggestions/);
  assert.doesNotMatch(source, /InteractiveEnglishText/);
  assert.doesNotMatch(source, /Add saved target|Add word or phrase|Meaning scope|Request ideas/);
});

test("chat styles omit controls that are no longer rendered", async () => {
  const source = await readFile(stylesUrl, "utf8");
  assert.doesNotMatch(source, /\.ai-chat-target(?:-|\s|,)/);
  assert.doesNotMatch(source, /\.ai-chat-selection(?:-|\s|,)/);
  assert.doesNotMatch(source, /\.ai-chat-suggestions(?:\s|\{|,)/);
});

test("chat entry points do not preselect hidden practice targets", async () => {
  const [chatSource, phraseSource] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(phraseWorkspaceUrl, "utf8"),
  ]);
  assert.doesNotMatch(chatSource, /URLSearchParams|phraseId|AiChatTargetRequest/);
  assert.doesNotMatch(phraseSource, /Practice with AI|openAiPractice|\/chat\?/);
});
