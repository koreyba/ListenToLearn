import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("library page has a local guest mode and an explicit Google entry point", async () => {
  const page = await readFile(
    new URL("../app/components/phrase-workspace.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /GUEST_LIBRARY_STORAGE_KEY/);
  assert.match(page, /addGuestPhrase/);
  assert.match(page, /setGuestPhraseStatus/);
  assert.match(page, /Sign in with Google/);
  assert.match(page, /Clear guest data/);
});

test("trainer derives account mode from the optional session and never sends guest mutations to user APIs", async () => {
  const trainer = await readFile(new URL("../public/trainer.html", import.meta.url), "utf8");

  assert.match(trainer, /GUEST_LIBRARY_STORAGE_KEY/);
  assert.match(trainer, /isAuthenticated/);
  assert.match(trainer, /toggleGuestSavedExample/);
  assert.match(trainer, /guestLibrary/);
  assert.match(trainer, /Sign in with Google/);
  assert.match(trainer, /localStorage/);
  assert.match(trainer, /video-progress-sync\.js/);
  assert.match(trainer, /accountVideoProgressSync/);

  assert.doesNotMatch(trainer, /listen-to-learn-authenticated-v1/);
  const sessionProbe = trainer.indexOf('fetch("/api/session"');
  const accountProbe = trainer.lastIndexOf("fetch(`/api/phrases${query}`");
  assert.ok(sessionProbe >= 0 && accountProbe > sessionProbe, "account data must follow verified session discovery");
  assert.match(trainer, /if \(!isAuthenticated\) \{[\s\S]*?toggleGuestSavedExample/);
});

test("React learning surfaces use optional session discovery instead of a local auth hint", async () => {
  const [workspace, videos] = await Promise.all([
    readFile(new URL("../app/components/phrase-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/videos/page.tsx", import.meta.url), "utf8"),
  ]);

  for (const source of [workspace, videos]) {
    assert.match(source, /accountSession/);
    assert.doesNotMatch(source, /listen-to-learn-authenticated-v1/);
    assert.doesNotMatch(source, />Log out</);
    assert.match(source, />Sign out</);
  }
});

test("every account surface routes sign out through the branded app flow", async () => {
  const sources = await Promise.all([
    readFile(new URL("../app/components/phrase-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/videos/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/integrations/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/trainer.html", import.meta.url), "utf8"),
  ]);

  for (const source of sources) assert.doesNotMatch(source, /href\s*=\s*["']\/cdn-cgi\/access\/logout/);
  assert.match(sources[2], /SIGN_OUT_HREF/);
  assert.match(sources[3], /loginLink\.href = "\/logout"/);
});

test("worker sanitizes identity headers before allowing a guest request", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const guestBranch = worker.indexOf("if (!identity)");
  const internalHeaderDeletion = worker.indexOf("headers.delete(AUTHENTICATED_USER_HEADER)");

  assert.ok(guestBranch >= 0);
  assert.ok(internalHeaderDeletion >= 0);
  assert.ok(internalHeaderDeletion < guestBranch);
});

test("worker resolves the optional session before generic public routing", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const sessionBranch = worker.indexOf('pathname === "/api/session"');
  const publicBranch = worker.indexOf("if (isPublicGuestRequest(request))");

  assert.ok(sessionBranch >= 0, "worker must expose the optional session endpoint");
  assert.ok(sessionBranch < publicBranch, "session must be resolved before generic public routing");
  assert.match(worker, /verifyAccessIdentity\(request, env, \{ allowCookie: true \}\)/);
  assert.match(worker, /optionalSessionResponse\(identity\)/);
});
