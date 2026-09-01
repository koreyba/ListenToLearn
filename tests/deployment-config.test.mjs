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
const AI_CHAT_MODEL = "deepseek/deepseek-v4-flash-0731";

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

test("branch previews apply preview D1 migrations before uploading a version", () => {
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
  const invocations = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(invocations[0].slice(0, 4), [
    "d1",
    "migrations",
    "apply",
    "unmumble-preview-db",
  ]);
  assert.deepEqual(invocations[0].slice(4, 6), ["--remote", "--config"]);
  assert.match(invocations[0][6], /wrangler\.preview\.jsonc$/);
  assert.deepEqual(invocations[1].slice(0, 2), ["versions", "upload"]);
  assert.equal(invocations[1][2], "--config");
  assert.match(invocations[1][3], /wrangler\.preview\.jsonc$/);
});

test("named preview deploys apply preview D1 migrations before promotion", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/deploy-worker.mjs", "preview"],
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
  const invocations = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(invocations[0].slice(0, 4), [
    "d1",
    "migrations",
    "apply",
    "unmumble-preview-db",
  ]);
  assert.deepEqual(invocations[1].slice(0, 1), ["deploy"]);
});

test("a failed preview migration blocks the version upload", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/deploy-worker.mjs", "branch-preview"],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      env: {
        ...process.env,
        WRANGLER_BIN: new URL(
          "fixtures/fail-preview-migration.mjs",
          import.meta.url,
        ).pathname,
      },
    },
  );

  assert.equal(result.status, 23, `${result.stdout}\n${result.stderr}`);
  const invocations = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(invocations.length, 1, "version upload must not run after a failed migration");
  assert.deepEqual(invocations[0].slice(0, 3), ["d1", "migrations", "apply"]);
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

test("AI generation has account and per-location aggregate edge rate limits", () => {
  const expectedLimits = [
    {
      name: "AI_CHAT_USER_RATE_LIMITER",
      namespace_id: "310001",
      simple: { limit: 10, period: 60 },
    },
    {
      name: "AI_CHAT_EDGE_AGGREGATE_RATE_LIMITER",
      namespace_id: "310002",
      simple: { limit: 100, period: 60 },
    },
  ];
  const expectedPreviewLimits = expectedLimits.map((binding, index) => ({
    ...binding,
    namespace_id: String(311001 + index),
  }));

  assert.deepEqual(sourceConfig.ratelimits, expectedLimits);
  assert.deepEqual(productionConfig.ratelimits, expectedLimits);
  assert.deepEqual(sourceConfig.env.preview.ratelimits, expectedPreviewLimits);
  assert.deepEqual(previewConfig.ratelimits, expectedPreviewLimits);
  assert.equal(new Set([
    ...expectedLimits,
    ...expectedPreviewLimits,
  ].map((binding) => binding.namespace_id)).size, 4);
});

test("AI generation uses the code-owned concrete OpenRouter model in every environment", () => {
  assert.equal(sourceConfig.vars.OPENROUTER_MODEL, AI_CHAT_MODEL);
  assert.equal(sourceConfig.env.preview.vars.OPENROUTER_MODEL, AI_CHAT_MODEL);
  assert.equal(previewConfig.vars.OPENROUTER_MODEL, AI_CHAT_MODEL);
  assert.equal(productionConfig.vars.OPENROUTER_MODEL, AI_CHAT_MODEL);
  assert.equal(AI_CHAT_MODEL.startsWith("@preset/"), false);
});

test("preview and production persist sampled Worker logs and traces", () => {
  const productionObservability = {
    enabled: true,
    logs: { enabled: true, head_sampling_rate: 1 },
    traces: { enabled: true, head_sampling_rate: 0.1 },
  };
  const previewObservability = {
    enabled: true,
    logs: { enabled: true, head_sampling_rate: 1 },
    traces: { enabled: true, head_sampling_rate: 1 },
  };

  assert.deepEqual(sourceConfig.observability, productionObservability);
  assert.deepEqual(productionConfig.observability, productionObservability);
  assert.deepEqual(sourceConfig.env.preview.observability, previewObservability);
  assert.deepEqual(previewConfig.observability, previewObservability);
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
