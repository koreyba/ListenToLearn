import { env } from "cloudflare:workers";
import { getD1 } from "@/db";

export type IntegrationProvider = "deepl";

type StoredSecret = {
  provider: IntegrationProvider;
  ciphertext: string;
  iv: string;
};

export class IntegrationSecretError extends Error {}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SESSION_COOKIE = "l2l_integration_session";
const SESSION_MAX_AGE = 24 * 60 * 60;

function environment() {
  return env as unknown as {
    DEEPL_API_KEY?: string;
    INTEGRATIONS_ENCRYPTION_KEY?: string;
  };
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKeyBytes() {
  const raw = environment().INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw) throw new IntegrationSecretError("Хранилище интеграций не настроено.");
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(raw);
  } catch {
    throw new IntegrationSecretError("Хранилище интеграций настроено некорректно.");
  }
  if (bytes.byteLength !== 32) {
    throw new IntegrationSecretError("Хранилище интеграций настроено некорректно.");
  }
  return bytes;
}

async function encryptionKey() {
  const bytes = await encryptionKeyBytes();
  return crypto.subtle.importKey("raw", bytes as unknown as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function sessionKey() {
  const bytes = await encryptionKeyBytes();
  return crypto.subtle.importKey(
    "raw",
    bytes as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function findStoredSecret(provider: IntegrationProvider) {
  return getD1().prepare(`
    SELECT provider, ciphertext, iv
    FROM integration_secrets
    WHERE provider = ?
  `).bind(provider).first<StoredSecret>();
}

export async function getIntegrationStatus(provider: IntegrationProvider) {
  return Boolean(await findStoredSecret(provider));
}

function requestCookie(request: Request) {
  const cookieHeader = request.headers.get("Cookie") || request.headers.get("cookie") || "";
  const entry = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return entry?.slice(SESSION_COOKIE.length + 1) || "";
}

export async function createIntegrationSession(request: Request) {
  if (!request.headers.get("Cf-Access-Jwt-Assertion") && !request.headers.get("Cf-Access-Authenticated-User-Email")) return null;
  const payload = toBase64Url(encoder.encode(JSON.stringify({ exp: Date.now() + SESSION_MAX_AGE * 1_000 })));
  const signature = await crypto.subtle.sign("HMAC", await sessionKey(), encoder.encode(payload));
  return `${SESSION_COOKIE}=${payload}.${toBase64Url(new Uint8Array(signature))}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

export async function hasIntegrationSession(request: Request) {
  const value = requestCookie(request);
  const [payload, encodedSignature] = value.split(".");
  if (!payload || !encodedSignature) return false;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await sessionKey(),
      fromBase64Url(encodedSignature),
      encoder.encode(payload),
    );
    if (!valid) return false;
    const decoded = JSON.parse(decoder.decode(fromBase64Url(payload))) as { exp?: unknown };
    return typeof decoded.exp === "number" && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

export async function storeIntegrationSecret(provider: IntegrationProvider, value: string) {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(`listen-to-learn:integration:v1:${provider}`) },
    key,
    encoder.encode(value),
  );
  const now = new Date().toISOString();
  await getD1().prepare(`
    INSERT INTO integration_secrets (provider, ciphertext, iv, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, updated_at = excluded.updated_at
  `).bind(provider, toBase64Url(new Uint8Array(ciphertext)), toBase64Url(iv), now, now).run();
}

export async function readIntegrationSecret(provider: IntegrationProvider, request?: Request) {
  if (!request || !(await hasIntegrationSession(request))) return null;
  const stored = await findStoredSecret(provider);
  if (!stored) return null;
  const key = await encryptionKey();
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(stored.iv), additionalData: encoder.encode(`listen-to-learn:integration:v1:${provider}`) },
      key,
      fromBase64Url(stored.ciphertext),
    );
    return decoder.decode(plaintext);
  } catch {
    throw new IntegrationSecretError("Не удалось расшифровать ключ интеграции.");
  }
}

export async function deleteIntegrationSecret(provider: IntegrationProvider) {
  await getD1().prepare("DELETE FROM integration_secrets WHERE provider = ?").bind(provider).run();
}
