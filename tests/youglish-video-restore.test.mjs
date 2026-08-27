import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const helperPath = new URL("../public/youglish-video-restore.js", import.meta.url);

async function loadRestoreHelper() {
  const source = await readFile(helperPath, "utf8").catch(() => "");
  const dom = new JSDOM(`<script>${source}</script>`, { runScripts: "dangerously" });
  return {
    close: () => dom.window.close(),
    helper: dom.window.UnmumbleYouglishVideoRestore,
  };
}

test("provider-marked caption text becomes the immutable restore query", async t => {
  const loaded = await loadRestoreHelper();
  t.after(loaded.close);

  assert.ok(loaded.helper, "restore helper must be attached to the browser");
  assert.equal(
    loaded.helper.extractRestoreQuery("That [[[ actual   match ]]] is [[[here]]]."),
    "actual match here",
  );
  assert.equal(loaded.helper.extractRestoreQuery("No marked match"), "");
});

test("resume movement is bounded and requires both provider timestamps", async t => {
  const loaded = await loadRestoreHelper();
  t.after(loaded.close);

  assert.ok(loaded.helper, "restore helper must be attached to the browser");
  assert.equal(loaded.helper.resumeDelta(400, 100), 300);
  assert.equal(loaded.helper.resumeDelta(100.4, 100), null);
  assert.equal(loaded.helper.resumeDelta(400, undefined), null);
  assert.equal(loaded.helper.resumeDelta(604_801, 100), null);
});
