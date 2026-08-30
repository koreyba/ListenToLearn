import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const reporterPath = join(projectRoot, "scripts", "github-actions-test-reporter.mjs");
const fixturesRoot = join(projectRoot, "tests", "fixtures");

async function runFixture(fixtureName) {
  const outputDirectory = await mkdtemp(join(tmpdir(), "unmumble-test-summary-"));
  const summaryPath = join(outputDirectory, "summary.md");
  const childEnvironment = { ...process.env };
  delete childEnvironment.NODE_TEST_CONTEXT;

  try {
    const result = await new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        [
          "--test",
          "--test-reporter=spec",
          `--test-reporter=${reporterPath}`,
          "--test-reporter-destination=stdout",
          "--test-reporter-destination=stdout",
          join(fixturesRoot, fixtureName),
        ],
        {
          cwd: projectRoot,
          env: {
            ...childEnvironment,
            FORCE_COLOR: "0",
            GITHUB_STEP_SUMMARY: summaryPath,
            NO_COLOR: "1",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("close", (code, signal) => {
        resolve({ code, signal, stderr, stdout });
      });
    });

    return {
      ...result,
      summary: await readFile(summaryPath, "utf8"),
    };
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
}

test("GitHub summary reports passing, skipped, and todo tests from a real run", async () => {
  const result = await runFixture("test-summary-success.test.mjs");

  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.equal(result.signal, null);
  assert.match(result.stdout, /TEST_SUMMARY total=3 passed=1 failed=0 skipped=1 todo=1 cancelled=0/);
  assert.match(result.summary, /^## 🧪 Test results$/m);
  assert.match(result.summary, /✅ Test run completed without failures/);
  assert.match(result.summary, /\| 3 \| 1 \| 0 \| 1 \| 1 \| 0 \|/);
  assert.match(result.summary, /### ⏭️ Skipped tests \(1\)/);
  assert.match(result.summary, /skipped fixture test.*requires an unavailable fixture/);
  assert.match(result.summary, /### 📝 Todo tests \(1\)/);
  assert.match(result.summary, /todo fixture test.*waiting for the sample implementation/);
});

test("GitHub summary keeps every failure visible when the test process exits nonzero", async () => {
  const result = await runFixture("test-summary-failure.test.mjs");

  assert.equal(result.code, 1, result.stderr || result.stdout);
  assert.equal(result.signal, null);
  assert.match(result.stdout, /TEST_SUMMARY total=5 passed=1 failed=2 skipped=1 todo=1 cancelled=0/);
  assert.match(result.summary, /❌ Test run failed/);
  assert.match(result.summary, /\| 5 \| 1 \| 2 \| 1 \| 1 \| 0 \|/);
  assert.match(result.summary, /### ❌ Failed tests \(2\)/);
  assert.match(result.summary, /first failing fixture test/);
  assert.match(result.summary, /second failing fixture test/);
  assert.match(result.summary, /intentional fixture failure/);
  assert.match(result.summary, /tests\/fixtures\/test-summary-failure\.test\.mjs/);
  assert.match(result.summary, /### ⏭️ Skipped tests \(1\)/);
  assert.match(result.summary, /skipped failure fixture test.*not relevant to this run/);
  assert.match(result.summary, /### 📝 Todo tests \(1\)/);
  assert.match(result.summary, /todo failure fixture test.*not implemented in the fixture/);
});
