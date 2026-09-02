import assert from "node:assert/strict";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function compileDeeplModule() {
  const result = await build({
    absWorkingDir: root,
    bundle: true,
    entryPoints: ["lib/deepl.ts"],
    format: "esm",
    platform: "node",
    target: "node24",
    write: false,
    plugins: [{
      name: "deepl-test-mocks",
      setup(esbuild) {
        esbuild.onResolve({ filter: /^cloudflare:workers$/ }, () => ({
          path: "cloudflare:workers",
          namespace: "mock-cf",
        }));
        esbuild.onLoad({ filter: /.*/, namespace: "mock-cf" }, () => ({
          contents: `export const env = new Proxy({}, { get(_, prop) { return globalThis.__mockWorkerEnv?.[prop]; } });`,
          loader: "js",
        }));
        esbuild.onResolve({ filter: /^@\/lib\/integration-secrets$/ }, () => ({
          path: "@/lib/integration-secrets",
          namespace: "mock-secrets",
        }));
        esbuild.onLoad({ filter: /.*/, namespace: "mock-secrets" }, () => ({
          contents: `
            export class IntegrationSecretError extends Error {}
            export async function readIntegrationSecret(userId, provider) {
              return globalThis.__mockUserSecrets?.[userId]?.[provider] || null;
            }
          `,
          loader: "js",
        }));
        esbuild.onResolve({ filter: /^@\/lib\/auth$/ }, () => ({
          path: "@/lib/auth",
          namespace: "mock-auth",
        }));
        esbuild.onLoad({ filter: /.*/, namespace: "mock-auth" }, () => ({
          contents: `
            export function getAuthenticatedUser(request) {
              return globalThis.__mockAuthUser || null;
            }
          `,
          loader: "js",
        }));
      },
    }],
  });
  const source = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

async function compileIntegrationsRoute() {
  const result = await build({
    absWorkingDir: root,
    bundle: true,
    entryPoints: ["app/api/integrations/route.ts"],
    format: "esm",
    platform: "node",
    target: "node24",
    write: false,
    plugins: [{
      name: "integrations-route-mocks",
      setup(esbuild) {
        esbuild.onResolve({ filter: /^cloudflare:workers$/ }, () => ({
          path: "cloudflare:workers",
          namespace: "mock-cf",
        }));
        esbuild.onLoad({ filter: /.*/, namespace: "mock-cf" }, () => ({
          contents: `export const env = new Proxy({}, { get(_, prop) { return globalThis.__mockWorkerEnv?.[prop]; } });`,
          loader: "js",
        }));
        esbuild.onResolve({ filter: /^@\/lib\/auth$/ }, () => ({
          path: "@/lib/auth",
          namespace: "mock-auth",
        }));
        esbuild.onLoad({ filter: /.*/, namespace: "mock-auth" }, () => ({
          contents: `
            export function getAuthenticatedUser(request) {
              return globalThis.__mockAuthUser || null;
            }
            export async function getCurrentUser(request) {
              return globalThis.__mockAuthUser || null;
            }
            export function unauthorizedResponse() {
              return Response.json({ error: "unauthorized" }, { status: 401 });
            }
          `,
          loader: "js",
        }));
        esbuild.onResolve({ filter: /^@\/lib\/integration-secrets$/ }, () => ({
          path: "@/lib/integration-secrets",
          namespace: "mock-secrets",
        }));
        esbuild.onLoad({ filter: /.*/, namespace: "mock-secrets" }, () => ({
          contents: `
            export class IntegrationSecretError extends Error {}
            export async function readIntegrationSecret(userId, provider) {
              return globalThis.__mockUserSecrets?.[userId]?.[provider] || null;
            }
            export async function getIntegrationStatus(userId, provider) {
              return Boolean(globalThis.__mockUserSecrets?.[userId]?.[provider]);
            }
            export async function storeIntegrationSecret(userId, provider, value) {
              if (!globalThis.__mockUserSecrets) globalThis.__mockUserSecrets = {};
              if (!globalThis.__mockUserSecrets[userId]) globalThis.__mockUserSecrets[userId] = {};
              globalThis.__mockUserSecrets[userId][provider] = value;
            }
            export async function deleteIntegrationSecret(userId, provider) {
              if (globalThis.__mockUserSecrets?.[userId]) {
                delete globalThis.__mockUserSecrets[userId][provider];
              }
            }
          `,
          loader: "js",
        }));
      },
    }],
  });
  const source = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

test("getDefaultDeeplApiKey resolves from worker env or process env", async () => {
  const deepl = await compileDeeplModule();

  // 1. Neither env nor process.env
  globalThis.__mockWorkerEnv = {};
  const prevProcessKey = process.env.DEEPL_DEFAULT_API_KEY;
  const prevProcessAlias = process.env.DEEPL_API_KEY;
  delete process.env.DEEPL_DEFAULT_API_KEY;
  delete process.env.DEEPL_API_KEY;

  assert.equal(deepl.getDefaultDeeplApiKey(), undefined);

  // 2. From worker env DEEPL_DEFAULT_API_KEY
  globalThis.__mockWorkerEnv = { DEEPL_DEFAULT_API_KEY: "default-key-123" };
  assert.equal(deepl.getDefaultDeeplApiKey(), "default-key-123");

  // 3. From worker env DEEPL_API_KEY alias
  globalThis.__mockWorkerEnv = { DEEPL_API_KEY: "alias-key-456" };
  assert.equal(deepl.getDefaultDeeplApiKey(), "alias-key-456");

  // 4. From process.env fallback when worker env is empty
  globalThis.__mockWorkerEnv = {};
  process.env.DEEPL_DEFAULT_API_KEY = "proc-key-789";
  assert.equal(deepl.getDefaultDeeplApiKey(), "proc-key-789");

  // Cleanup
  if (prevProcessKey) process.env.DEEPL_DEFAULT_API_KEY = prevProcessKey;
  else delete process.env.DEEPL_DEFAULT_API_KEY;
  if (prevProcessAlias) process.env.DEEPL_API_KEY = prevProcessAlias;
  else delete process.env.DEEPL_API_KEY;
  delete globalThis.__mockWorkerEnv;
});

test("translateEnglishToRussian prefers user personal key over default key", async () => {
  const deepl = await compileDeeplModule();

  globalThis.__mockWorkerEnv = { DEEPL_DEFAULT_API_KEY: "default-system-key:fx" };
  globalThis.__mockAuthUser = { subject: "user-test" };
  globalThis.__mockUserSecrets = {
    "user-test": { deepl: "user-custom-key:fx" },
  };

  let requestedAuthHeader = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requestedAuthHeader = init?.headers?.Authorization || "";
    return new Response(JSON.stringify({
      translations: [{ text: "Привет" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await deepl.translateEnglishToRussian(["Hello"], "", {
      request: new Request("https://unmumble.online/api/translate"),
    });
    assert.deepEqual(result, ["Привет"]);
    assert.equal(requestedAuthHeader, "DeepL-Auth-Key user-custom-key:fx");
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__mockWorkerEnv;
    delete globalThis.__mockAuthUser;
    delete globalThis.__mockUserSecrets;
  }
});

test("translateEnglishToRussian falls back to default key when user has no personal key", async () => {
  const deepl = await compileDeeplModule();

  globalThis.__mockWorkerEnv = { DEEPL_DEFAULT_API_KEY: "default-fallback-key:fx" };
  globalThis.__mockAuthUser = { subject: "user-without-key" };
  globalThis.__mockUserSecrets = {};

  let requestedAuthHeader = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requestedAuthHeader = init?.headers?.Authorization || "";
    return new Response(JSON.stringify({
      translations: [{ text: "Мир" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await deepl.translateEnglishToRussian(["World"], "", {
      request: new Request("https://unmumble.online/api/translate"),
    });
    assert.deepEqual(result, ["Мир"]);
    assert.equal(requestedAuthHeader, "DeepL-Auth-Key default-fallback-key:fx");
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__mockWorkerEnv;
    delete globalThis.__mockAuthUser;
    delete globalThis.__mockUserSecrets;
  }
});

test("translateEnglishToRussian throws not_configured when neither user key nor default key exists", async () => {
  const deepl = await compileDeeplModule();

  globalThis.__mockWorkerEnv = {};
  delete process.env.DEEPL_DEFAULT_API_KEY;
  delete process.env.DEEPL_API_KEY;
  globalThis.__mockAuthUser = { subject: "user-without-key" };
  globalThis.__mockUserSecrets = {};

  await assert.rejects(
    async () => {
      await deepl.translateEnglishToRussian(["Hello"], "", {
        request: new Request("https://unmumble.online/api/translate"),
      });
    },
    (err) => {
      assert.equal(err.code, "not_configured");
      assert.match(err.message, /Translation is not configured yet/);
      return true;
    },
  );

  delete globalThis.__mockWorkerEnv;
  delete globalThis.__mockAuthUser;
  delete globalThis.__mockUserSecrets;
});

test("GET /api/integrations returns source='default' when default key exists and user has no custom key", async () => {
  const route = await compileIntegrationsRoute();

  globalThis.__mockWorkerEnv = { DEEPL_DEFAULT_API_KEY: "default-key" };
  globalThis.__mockAuthUser = { subject: "user-1" };
  globalThis.__mockUserSecrets = {};

  const res = await route.GET(new Request("https://unmumble.online/api/integrations"));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.integrations, [{
    provider: "deepl",
    label: "DeepL",
    configured: true,
    source: "default",
  }]);

  delete globalThis.__mockWorkerEnv;
  delete globalThis.__mockAuthUser;
  delete globalThis.__mockUserSecrets;
});

test("GET /api/integrations returns source='integrations' when user has custom key configured", async () => {
  const route = await compileIntegrationsRoute();

  globalThis.__mockWorkerEnv = { DEEPL_DEFAULT_API_KEY: "default-key" };
  globalThis.__mockAuthUser = { subject: "user-1" };
  globalThis.__mockUserSecrets = {
    "user-1": { deepl: "my-custom-key" },
  };

  const res = await route.GET(new Request("https://unmumble.online/api/integrations"));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.integrations, [{
    provider: "deepl",
    label: "DeepL",
    configured: true,
    source: "integrations",
  }]);

  delete globalThis.__mockWorkerEnv;
  delete globalThis.__mockAuthUser;
  delete globalThis.__mockUserSecrets;
});

test("DELETE /api/integrations removes custom key and reverts to source='default'", async () => {
  const route = await compileIntegrationsRoute();

  globalThis.__mockWorkerEnv = { DEEPL_DEFAULT_API_KEY: "default-key" };
  globalThis.__mockAuthUser = { subject: "user-1" };
  globalThis.__mockUserSecrets = {
    "user-1": { deepl: "my-custom-key" },
  };

  const req = new Request("https://unmumble.online/api/integrations?provider=deepl", {
    method: "DELETE",
    headers: { Origin: "https://unmumble.online" },
  });
  const res = await route.DELETE(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.configured, true);
  assert.equal(data.source, "default");
  assert.equal(globalThis.__mockUserSecrets["user-1"].deepl, undefined);

  delete globalThis.__mockWorkerEnv;
  delete globalThis.__mockAuthUser;
  delete globalThis.__mockUserSecrets;
});
