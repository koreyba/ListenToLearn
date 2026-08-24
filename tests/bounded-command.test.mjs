import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runner = new URL("../scripts/run-bounded.mjs", import.meta.url);

test("bounded command runner works without GNU timeout", async () => {
  const successful = spawnSync(
    process.execPath,
    [
      runner.pathname,
      "--timeout", "1s",
      "--kill-after", "100ms",
      "--",
      process.execPath,
      "-e", "process.stdout.write('bounded-ok')",
    ],
    { encoding: "utf8" },
  );

  assert.equal(successful.status, 0, successful.stderr);
  assert.equal(successful.stdout, "bounded-ok");

  const startedAt = Date.now();
  const timedOut = spawnSync(
    process.execPath,
    [
      runner.pathname,
      "--timeout", "50ms",
      "--kill-after", "50ms",
      "--",
      process.execPath,
      "-e", "setInterval(() => {}, 1000)",
    ],
    { encoding: "utf8", timeout: 2_000 },
  );

  assert.equal(timedOut.status, 124, timedOut.stderr);
  assert.ok(Date.now() - startedAt < 2_000, "timed command did not stop promptly");

  const buildScript = await readFile(
    new URL("../scripts/build-verified.sh", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(buildScript, /requires GNU timeout|command -v timeout/);
  assert.match(buildScript, /run-bounded\.mjs/);
});
