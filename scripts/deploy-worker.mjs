import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const deployments = {
  preview: {
    configFile: "wrangler.preview.jsonc",
    workerName: "listen-to-learn-preview",
  },
  production: {
    configFile: "wrangler.production.jsonc",
    workerName: "listen-to-learn",
  },
};

function fail(message) {
  console.error(`Deploy blocked: ${message}`);
  process.exit(1);
}

const target = process.argv[2];
const extraArgs = process.argv.slice(3);
const deployment = deployments[target];

if (!deployment) {
  fail("target must be exactly preview or production");
}

if (
  extraArgs.some((argument) =>
    ["--config", "-c", "--env", "-e", "--name"].some(
      (flag) => argument === flag || argument.startsWith(`${flag}=`),
    ),
  )
) {
  fail("--config, --env and --name cannot override the selected target");
}

if (target === "production" && process.env.ALLOW_PRODUCTION_DEPLOY !== "1") {
  fail("production requires ALLOW_PRODUCTION_DEPLOY=1");
}

const configPath = path.join(repositoryRoot, deployment.configFile);
const config = JSON.parse(await readFile(configPath, "utf8"));

if (config.name !== deployment.workerName) {
  fail(
    `${deployment.configFile} must target ${deployment.workerName}, got ${config.name ?? "<missing>"}`,
  );
}

for (const artifact of ["dist/server/index.js", "dist/client/trainer.html"]) {
  try {
    await access(path.join(repositoryRoot, artifact));
  } catch {
    fail(`missing build artifact ${artifact}; build before deploying`);
  }
}

const wranglerBinary =
  process.env.WRANGLER_BIN ?? path.join(repositoryRoot, "node_modules/.bin/wrangler");
const result = spawnSync(
  wranglerBinary,
  ["deploy", "--config", configPath, ...extraArgs],
  {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(`Deploy failed to start: ${result.error.message}`);
  process.exit(1);
}

process.exitCode = result.status ?? 1;
