import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const sourceConfig = JSON.parse(
  await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
);
const previewConfig = JSON.parse(
  await readFile(new URL("../wrangler.preview.jsonc", import.meta.url), "utf8"),
);
const productionConfig = JSON.parse(
  await readFile(
    new URL("../wrangler.production.jsonc", import.meta.url),
    "utf8",
  ),
);

test("preview Wrangler environment has its own Worker name", () => {
  assert.equal(sourceConfig.env?.preview?.name, "listen-to-learn-preview");
  assert.equal(previewConfig.name, "listen-to-learn-preview");
  assert.equal(
    previewConfig.d1_databases[0].database_name,
    "listen-to-learn-preview-db",
  );
});

test("production deploy is opt-in", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/deploy-worker.mjs", "production"],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      env: {
        ...process.env,
        ALLOW_PRODUCTION_DEPLOY: "",
        WRANGLER_BIN: "/path/that/does/not/exist",
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /ALLOW_PRODUCTION_DEPLOY=1/,
  );
  assert.equal(productionConfig.name, "listen-to-learn");
});
