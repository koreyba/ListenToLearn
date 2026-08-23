import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("library page has a local guest mode and an explicit Google entry point", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /GUEST_LIBRARY_STORAGE_KEY/);
  assert.match(page, /addGuestPhrase/);
  assert.match(page, /setGuestPhraseStatus/);
  assert.match(page, /Войти через Google/);
  assert.match(page, /Очистить пробу/);
});

test("trainer has an intentional guest branch and never sends guest mutations to user APIs", async () => {
  const trainer = await readFile(new URL("../public/trainer.html", import.meta.url), "utf8");

  assert.match(trainer, /GUEST_LIBRARY_STORAGE_KEY/);
  assert.match(trainer, /isAuthenticated/);
  assert.match(trainer, /toggleGuestSavedExample/);
  assert.match(trainer, /guestLibrary/);
  assert.match(trainer, /Войти через Google/);
  assert.match(trainer, /localStorage/);

  const authHint = trainer.indexOf('localStorage.getItem("listen-to-learn-authenticated-v1")');
  const accountProbe = trainer.indexOf('fetch("/api/me"');
  assert.ok(authHint >= 0 && accountProbe > authHint, "account probing must be gated by the local auth hint");
  assert.match(trainer, /if \(!isAuthenticated\) \{[\s\S]*?toggleGuestSavedExample/);
});

test("worker sanitizes identity headers before allowing a guest request", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const guestBranch = worker.indexOf("if (!identity)");
  const internalHeaderDeletion = worker.indexOf("headers.delete(AUTHENTICATED_USER_HEADER)");

  assert.ok(guestBranch >= 0);
  assert.ok(internalHeaderDeletion >= 0);
  assert.ok(internalHeaderDeletion < guestBranch);
});
