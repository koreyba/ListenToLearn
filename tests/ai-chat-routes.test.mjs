import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrls = {
  chats: new URL("../app/api/ai/chats/route.ts", import.meta.url),
  detail: new URL("../app/api/ai/chats/[chatId]/route.ts", import.meta.url),
  targets: new URL("../app/api/ai/chats/[chatId]/targets/route.ts", import.meta.url),
  messages: new URL("../app/api/ai/chats/[chatId]/messages/route.ts", import.meta.url),
  meanings: new URL("../app/api/ai/meanings/route.ts", import.meta.url),
};

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
    assert.match(source, /createAiChatRepository\(getD1\(\)\)/, name);
    assert.match(source, /noStoreJson|aiChatErrorResponse|createUIMessageStreamResponse/, name);
    assert.doesNotMatch(source, /request\.json\(\)/, name);
    assert.doesNotMatch(source, /process\.env|OPENROUTER_API_KEY\s*[:=]\s*["']sk-/, name);
  }
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
  assert.match(routeSources.messages, /prepareAiChatGeneration\(/);
  assert.match(routeSources.messages, /getAiChatServerConfig\(\)/);
  assert.match(routeSources.messages, /createUIMessageStreamResponse\(/);
  assert.match(routeSources.messages, /abortSignal:\s*request\.signal/);
  assert.match(routeSources.messages, /aiChatRouteErrorResponse\(error\)/);
  assert.doesNotMatch(routeSources.messages, /messages\s*:/);
  assert.doesNotMatch(routeSources.messages, /model\s*:\s*payload/);
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
});
