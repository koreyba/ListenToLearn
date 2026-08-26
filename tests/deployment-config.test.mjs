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
  "85d7b3fcc999788239cf6f922a2bcf6b63be99dd2e05df2af5e66e7645bea1a4";
const LOGIN_ACCESS_AUD =
  "9b29b79b8bca8308e4933c030f464d5a1da798497182652fe75a1fd304975a29";

test("Unmumble environments have explicit Worker and D1 names", () => {
  assert.equal(sourceConfig.name, "unmumble-prod");
  assert.equal(sourceConfig.env?.preview?.name, "unmumble-preview");
  assert.equal(previewConfig.name, "unmumble-preview");
  assert.equal(
    previewConfig.d1_databases[0].database_name,
    "unmumble-preview-db",
  );
  assert.equal(
    previewConfig.d1_databases[0].database_id,
    "0d361b44-60ef-4c5b-b2ea-fe9d4d5020f1",
  );
  assert.equal(productionConfig.name, "unmumble-prod");
  assert.equal(
    productionConfig.d1_databases[0].database_name,
    "unmumble-prod-db",
  );
  assert.equal(
    productionConfig.d1_databases[0].database_id,
    "9e187b50-9012-45d9-aeec-40a573e59d79",
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

test("production routes the Unmumble domain to the Unmumble Worker", () => {
  assert.deepEqual(productionConfig.routes, [
    { pattern: "unmumble.online", custom_domain: true },
  ]);
});

test("preview accepts its Access application without widening production", () => {
  const previewAudiences = previewConfig.vars.ACCESS_AUD.split(",");
  const sourcePreviewAudiences = sourceConfig.env.preview.vars.ACCESS_AUD.split(",");
  const productionAudiences = productionConfig.vars.ACCESS_AUD.split(",");
  const sourceProductionAudiences = sourceConfig.vars.ACCESS_AUD.split(",");

  assert.deepEqual(previewAudiences, [PREVIEW_WORKER_ACCESS_AUD]);
  assert.deepEqual(sourcePreviewAudiences, [PREVIEW_WORKER_ACCESS_AUD]);
  assert.deepEqual(productionAudiences, [LOGIN_ACCESS_AUD]);
  assert.deepEqual(sourceProductionAudiences, [LOGIN_ACCESS_AUD]);
  assert.ok(!previewAudiences.includes(LOGIN_ACCESS_AUD));
  assert.ok(!productionAudiences.includes(PREVIEW_WORKER_ACCESS_AUD));
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
  assert.equal(productionConfig.name, "unmumble-prod");
});
