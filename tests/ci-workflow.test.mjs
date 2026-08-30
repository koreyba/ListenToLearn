import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL("../.github/workflows/tests.yml", import.meta.url);

test("GitHub Actions runs the complete repository validation on pull requests", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /^name: Tests$/m);
  assert.match(workflow, /^  pull_request:$/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
  assert.match(workflow, /^          node-version: 22\.13\.0$/m);
  assert.match(workflow, /^      - run: npm ci$/m);
  assert.match(workflow, /^      - run: npm run lint$/m);
  assert.match(workflow, /^      - run: npx tsc --noEmit$/m);
  assert.match(workflow, /^      - run: npm test$/m);
  assert.match(workflow, /^    timeout-minutes: 15$/m);
});
