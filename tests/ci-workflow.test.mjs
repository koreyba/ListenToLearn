import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL("../.github/workflows/tests.yml", import.meta.url);
const packageJsonPath = new URL("../package.json", import.meta.url);

test("GitHub Actions runs the complete repository validation on pull requests", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /^name: Tests$/m);
  assert.match(workflow, /^  pull_request:$/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
  assert.match(workflow, /^          node-version: 24\.18\.1$/m);
  assert.match(workflow, /^      - run: npm ci --ignore-scripts$/m);
  assert.match(workflow, /^      - run: npm run lint$/m);
  assert.match(workflow, /^      - run: \.\/node_modules\/\.bin\/tsc --noEmit$/m);
  assert.doesNotMatch(workflow, /\bnpx\b/);
  assert.match(workflow, /^      - run: npm run build$/m);
  assert.match(workflow, /^      - name: Run tests and publish summary\n        run: npm run test:ci$/m);
  assert.match(workflow, /^    timeout-minutes: 15$/m);
});

test("CI test command uses the repository-owned GitHub summary reporter", async () => {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const command = packageJson.scripts["test:ci"];

  assert.equal(typeof command, "string");
  assert.match(command, /--test-reporter=spec/);
  assert.match(command, /--test-reporter=\.\/scripts\/github-actions-test-reporter\.mjs/);
  assert.equal(command.match(/--test-reporter-destination=stdout/g)?.length, 2);
  assert.match(command, /tests\/\*\.test\.mjs$/);
});
