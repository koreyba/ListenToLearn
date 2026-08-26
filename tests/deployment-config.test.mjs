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
const packageConfig = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const PREVIEW_WORKER_ACCESS_AUD =
  "c3e7906e8ce42cf58b85e2c72d27df691fdb0fec681cedd8093ada530e9c2518";
const LOGIN_ACCESS_AUD =
  "315a0118e28bc19c5d5cc5298a8fb4704ad351ebe58774f9966cd678458d8ff0";
const LEGACY_SETTINGS_ACCESS_AUD =
  "a68b687d83c86b363a5c14f609b7026721dc8c6c77b7293c4337390d5dc45341";

test("preview Wrangler environment has its own Worker name", () => {
  assert.equal(sourceConfig.env?.preview?.name, "listen-to-learn-preview");
  assert.equal(previewConfig.name, "listen-to-learn-preview");
  assert.equal(
    previewConfig.d1_databases[0].database_name,
    "listen-to-learn-preview-db",
  );
});

test("branch previews upload a version without promoting the preview Worker", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/deploy-worker.mjs", "branch-preview"],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      env: {
        ...process.env,
        WRANGLER_BIN: new URL(
          "fixtures/capture-args.mjs",
          import.meta.url,
        ).pathname,
      },
    },
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const args = JSON.parse(result.stdout.trim());
  assert.deepEqual(args.slice(0, 2), ["versions", "upload"]);
  assert.equal(args[2], "--config");
  assert.match(args[3], /wrangler\.preview\.jsonc$/);
});

test("Workers Builds has an explicit branch-preview command", () => {
  assert.equal(
    packageConfig.scripts["deploy:branch-preview"],
    "node scripts/deploy-worker.mjs branch-preview",
  );
});

test("preview URLs stay enabled through Wrangler deployments", () => {
  assert.equal(previewConfig.preview_urls, true);
});

test("preview accepts its Access application without widening production", () => {
  const previewAudiences = previewConfig.vars.ACCESS_AUD.split(",");
  const sourcePreviewAudiences = sourceConfig.env.preview.vars.ACCESS_AUD.split(",");
  const productionAudiences = productionConfig.vars.ACCESS_AUD.split(",");
  const sourceProductionAudiences = sourceConfig.vars.ACCESS_AUD.split(",");

  assert.ok(previewAudiences.includes(PREVIEW_WORKER_ACCESS_AUD));
  assert.ok(sourcePreviewAudiences.includes(PREVIEW_WORKER_ACCESS_AUD));
  assert.ok(!productionAudiences.includes(PREVIEW_WORKER_ACCESS_AUD));
  assert.ok(!sourceProductionAudiences.includes(PREVIEW_WORKER_ACCESS_AUD));
  assert.deepEqual(productionAudiences, [LOGIN_ACCESS_AUD]);
  assert.deepEqual(sourceProductionAudiences, [LOGIN_ACCESS_AUD]);
  assert.deepEqual(new Set(previewAudiences), new Set([LOGIN_ACCESS_AUD, PREVIEW_WORKER_ACCESS_AUD]));
  assert.deepEqual(new Set(sourcePreviewAudiences), new Set([LOGIN_ACCESS_AUD, PREVIEW_WORKER_ACCESS_AUD]));
  for (const audiences of [previewAudiences, sourcePreviewAudiences, productionAudiences, sourceProductionAudiences]) {
    assert.ok(!audiences.includes(LEGACY_SETTINGS_ACCESS_AUD));
  }
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
