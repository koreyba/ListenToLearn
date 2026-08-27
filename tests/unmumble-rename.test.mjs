import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as guestLibrary from "../lib/guest-library.ts";
import * as youtubeProgress from "../lib/youtube-progress.ts";

function memoryStorage(entries = []) {
  const values = new Map(entries);
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    values,
  };
}

test("active product surfaces present the Unmumble brand", async () => {
  const [layout, navigation, workspace, integrations, trainer, packageConfig, readme] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/site-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/phrase-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/integrations/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/trainer.html", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  assert.equal(packageConfig.name, "unmumble");
  assert.equal(packageConfig.displayName, "Unmumble");
  assert.match(layout, /title: "Unmumble"/);
  assert.match(navigation, /aria-label="Unmumble"/);
  assert.match(navigation, /className="site-brand-logo"/);
  assert.doesNotMatch(workspace, /Connected speech trainer/i);
  assert.doesNotMatch(integrations, /Connected speech trainer/i);
  assert.match(trainer, /<title>Unmumble<\/title>/);
  assert.match(trainer, /aria-label="Unmumble"/);
  assert.match(trainer, /class="site-brand-logo"/);
  assert.doesNotMatch(trainer, /Connected Speech Trainer/i);
  assert.match(readme, /^# Unmumble$/m);
  assert.match(readme, /unmumble\.online/);
});

test("Unmumble storage copies legacy values and keeps the rollback copy", () => {
  assert.equal(guestLibrary.GUEST_LIBRARY_STORAGE_KEY, "unmumble-guest-library-v1");
  assert.equal(youtubeProgress.YOUTUBE_PROGRESS_STORAGE_KEY, "unmumble-youtube-progress-v1");
  assert.equal(typeof guestLibrary.readMigratedStorage, "function");
  assert.equal(typeof guestLibrary.writeMigratedStorage, "function");
  assert.equal(typeof guestLibrary.removeMigratedStorage, "function");

  const storage = memoryStorage([
    ["listen-to-learn-guest-library-v1", '{"version":2}'],
  ]);
  const value = guestLibrary.readMigratedStorage(
    storage,
    guestLibrary.GUEST_LIBRARY_STORAGE_KEY,
    ["listen-to-learn-guest-library-v1"],
  );

  assert.equal(value, '{"version":2}');
  assert.equal(storage.values.get("unmumble-guest-library-v1"), '{"version":2}');
  assert.equal(storage.values.get("listen-to-learn-guest-library-v1"), '{"version":2}');

  guestLibrary.writeMigratedStorage(
    storage,
    guestLibrary.GUEST_LIBRARY_STORAGE_KEY,
    ["listen-to-learn-guest-library-v1"],
    '{"version":2,"savedVideos":[]}',
  );
  assert.equal(
    storage.values.get("unmumble-guest-library-v1"),
    storage.values.get("listen-to-learn-guest-library-v1"),
  );

  guestLibrary.removeMigratedStorage(
    storage,
    guestLibrary.GUEST_LIBRARY_STORAGE_KEY,
    ["listen-to-learn-guest-library-v1"],
  );
  assert.equal(storage.values.has("unmumble-guest-library-v1"), false);
  assert.equal(storage.values.has("listen-to-learn-guest-library-v1"), false);
});

test("the rename preserves integration-secret authenticated data", async () => {
  const cryptoSource = await readFile(
    new URL("../lib/integration-secrets.ts", import.meta.url),
    "utf8",
  );

  assert.match(cryptoSource, /listen-to-learn:integration:v1:/);
  assert.match(cryptoSource, /listen-to-learn:integration:v2:/);
  assert.doesNotMatch(cryptoSource, /unmumble:integration:/);
});
