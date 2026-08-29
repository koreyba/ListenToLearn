import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const httpModule = await import("../lib/ai-chat/http.ts").catch(() => ({}));

const routeUrls = {
  chats: new URL("../app/api/ai/chats/route.ts", import.meta.url),
  detail: new URL("../app/api/ai/chats/[chatId]/route.ts", import.meta.url),
  targets: new URL("../app/api/ai/chats/[chatId]/targets/route.ts", import.meta.url),
  messages: new URL("../app/api/ai/chats/[chatId]/messages/route.ts", import.meta.url),
  meanings: new URL("../app/api/ai/meanings/route.ts", import.meta.url),
};
const httpUrl = new URL("../lib/ai-chat/http.ts", import.meta.url);
const clientUrl = new URL("../lib/ai-chat/client.ts", import.meta.url);
const serverConfigUrl = new URL("../lib/ai-chat/server-config.ts", import.meta.url);

async function sources() {
  return Object.fromEntries(await Promise.all(
    Object.entries(routeUrls).map(async ([name, url]) => [name, await readFile(url, "utf8")]),
  ));
}

test("every AI route stays dynamic, authenticated, owner-scoped, and uncached", async () => {
  const routeSources = await sources();
  for (const [name, source] of Object.entries(routeSources)) {
    assert.match(source, /export const dynamic = "force-dynamic"/, name);
    assert.match(source, /getCurrentUser\(request\)/, name);
    assert.match(source, /unauthorizedResponse\(\)/, name);
    assert.match(
      source,
      /create(?:AiChat|Vocabulary)Repository\((?:getD1\(\)|db)\)/,
      name,
    );
    assert.match(source, /noStoreJson|aiChatErrorResponse|createUIMessageStreamResponse/, name);
    assert.doesNotMatch(source, /request\.json\(\)/, name);
    assert.doesNotMatch(source, /process\.env|OPENROUTER_API_KEY\s*[:=]\s*["']sk-/, name);
  }
  assert.match(routeSources.messages, /createAiChatRepository\(db\)/);
  assert.match(routeSources.messages, /createVocabularyRepository\(db\)/);
  assert.match(routeSources.messages, /createVocabularyMutationPlanner\(db\)/);
  assert.match(routeSources.messages, /createAiChatToolTraceRepository\(db\)/);
  assert.match(routeSources.meanings, /createVocabularyRepository\(getD1\(\)\)/);
});

test("AI mutations share the exact-origin bounded body boundary", async () => {
  const routeSources = await sources();
  for (const name of ["chats", "targets", "messages", "meanings"]) {
    assert.match(routeSources[name], /readAiMutationPayload\(/, name);
  }
  assert.match(routeSources.chats, /readCreateChatPayload/);
  assert.match(routeSources.targets, /readReplaceTargetsPayload/);
  assert.match(routeSources.messages, /readGenerateMessagePayload/);
  assert.match(routeSources.meanings, /readCreateMeaningPayload/);
});

test("message streaming delegates canonical state and configuration to the service", async () => {
  const routeSources = await sources();
  assert.match(routeSources.messages, /enforceAiChatGenerationRateLimit\(/);
  assert.match(routeSources.messages, /getAiChatRateLimitBindings\(\)/);
  assert.match(routeSources.messages, /recordAiChatOperationalEvent\(/);
  assert.ok(
    routeSources.messages.indexOf("enforceAiChatGenerationRateLimit(")
      < routeSources.messages.indexOf("getD1()"),
    "the availability gate must run before starting a D1/provider turn",
  );
  assert.match(routeSources.messages, /prepareAiChatGeneration\(/);
  assert.match(routeSources.messages, /getAiChatServerConfig\(\)/);
  assert.match(routeSources.messages, /createUIMessageStreamResponse\(/);
  assert.match(routeSources.messages, /abortSignal:\s*request\.signal/);
  assert.match(routeSources.messages, /aiChatRouteErrorResponse\(error\)/);
  assert.doesNotMatch(routeSources.messages, /messages\s*:/);
  assert.doesNotMatch(routeSources.messages, /model\s*:\s*payload/);
});

test("chat configuration status delegates to the runtime model allowlist", async () => {
  const source = await readFile(serverConfigUrl, "utf8");
  assert.match(source, /isAiChatRuntimeConfigured/);
  assert.match(
    source,
    /return isAiChatRuntimeConfigured\(getAiChatServerConfig\(\)\)/,
  );
  assert.doesNotMatch(source, /config\.model\?\.trim\(\)/);
});

test("chat, target, and meaning routes expose the complete first-slice persistence API", async () => {
  const routeSources = await sources();
  assert.match(routeSources.chats, /export async function GET/);
  assert.match(routeSources.chats, /export async function POST/);
  assert.match(routeSources.detail, /export async function GET/);
  assert.match(routeSources.targets, /export async function PATCH/);
  assert.match(routeSources.meanings, /export async function GET/);
  assert.match(routeSources.meanings, /export async function POST/);
  assert.match(routeSources.chats, /generationConfigured/);
  assert.match(routeSources.chats, /createChatWithVocabularyOpening\(/);
  assert.doesNotMatch(routeSources.chats, /repository\.createChat\(/);
});

test("chat routes expose a whitelisted public message contract", async () => {
  assert.equal(typeof httpModule.toPublicAiChatDetail, "function");
  const chat = httpModule.toPublicAiChatDetail({
    id: "chat-1",
    title: "Practice",
    explanationLanguage: "ru",
    targetCount: 0,
    messageCount: 1,
    createdAt: "2026-08-29T10:00:00.000Z",
    updatedAt: "2026-08-29T10:00:01.000Z",
    targets: [],
    messages: [{
      id: "message-1",
      role: "assistant",
      sequence: 1,
      content: "Hello",
      status: "complete",
      practiceContext: [],
      clientMessageId: "opening:chat-1",
      provider: "openrouter",
      model: "private/model-routing-id",
      usage: { inputTokens: 123, outputTokens: 45 },
      errorCode: null,
      createdAt: "2026-08-29T10:00:00.000Z",
      updatedAt: "2026-08-29T10:00:01.000Z",
    }],
  });

  assert.deepEqual(chat.messages, [{
    id: "message-1",
    role: "assistant",
    sequence: 1,
    content: "Hello",
    status: "complete",
    clientMessageId: "opening:chat-1",
    errorCode: null,
    createdAt: "2026-08-29T10:00:00.000Z",
    updatedAt: "2026-08-29T10:00:01.000Z",
  }]);
  assert.equal("provider" in chat.messages[0], false);
  assert.equal("model" in chat.messages[0], false);
  assert.equal("usage" in chat.messages[0], false);
  assert.equal("practiceContext" in chat.messages[0], false);

  const routeSources = await sources();
  assert.match(routeSources.chats, /toPublicAiChatDetail\(chat\)/);
  assert.match(routeSources.detail, /toPublicAiChatDetail\(chat\)/);
});

test("server and browser share explicit allowlisted chat DTOs", async () => {
  const [httpSource, clientSource] = await Promise.all([
    readFile(httpUrl, "utf8"),
    readFile(clientUrl, "utf8"),
  ]);
  assert.match(httpSource, /from "\.\/public-contracts\.ts"/u);
  assert.match(clientSource, /from "\.\/public-contracts\.ts"/u);
  assert.doesNotMatch(httpSource, /\bOmit</u);
  assert.doesNotMatch(clientSource, /export type AiChatClientMessage = \{/u);
});
