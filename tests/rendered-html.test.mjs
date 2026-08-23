import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("build includes development preview metadata", async () => {
  const bundle = await readFile(
    new URL("../dist/server/index.js", import.meta.url),
    "utf8",
  );

  assert.match(bundle, /["']codex-preview["']\s*:\s*["']development["']/i);
});
