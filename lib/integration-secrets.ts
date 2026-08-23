import { env } from "cloudflare:workers";
import { getD1 } from "@/db";

export type IntegrationProvider = "deepl";

type StoredSecret = {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  ciphertext: string;
  iv: string;
  encryption_version: number;
};

export class IntegrationSecretError extends Error {}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function environment() {
  return env as unknown as {
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
  if (!raw) throw new IntegrationSecretError("The integrations store is not configured.");
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(raw);
  } catch {
    throw new IntegrationSecretError("The integrations store is configured incorrectly.");
  }
  if (bytes.byteLength !== 32) {
    throw new IntegrationSecretError("The integrations store is configured incorrectly.");
  }
  return bytes;
}

async function encryptionKey() {
  const bytes = await encryptionKeyBytes();
  return crypto.subtle.importKey("raw", bytes as unknown as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function additionalData(userId: string, provider: IntegrationProvider, version: number) {
  return encoder.encode(
    version === 1
      ? "listen-to-learn:integration:v1:" + provider
      : "listen-to-learn:integration:v2:" + userId + ":" + provider,
  );
}

async function findStoredSecret(userId: string, provider: IntegrationProvider) {
  return getD1().prepare(`
    SELECT id, user_id, provider, ciphertext, iv, encryption_version
    FROM integration_secrets
    WHERE user_id = ? AND provider = ?
  `).bind(userId, provider).first<StoredSecret>();
}

export async function getIntegrationStatus(userId: string, provider: IntegrationProvider) {
  return Boolean(await findStoredSecret(userId, provider));
}

export async function storeIntegrationSecret(userId: string, provider: IntegrationProvider, value: string) {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: additionalData(userId, provider, 2) },
    key,
    encoder.encode(value),
  );
  const now = new Date().toISOString();
  const existing = await findStoredSecret(userId, provider);
  if (existing) {
    await getD1().prepare(`
      UPDATE integration_secrets
      SET ciphertext = ?, iv = ?, encryption_version = 2, updated_at = ?
      WHERE id = ? AND user_id = ? AND provider = ?
    `).bind(
      toBase64Url(new Uint8Array(ciphertext)),
      toBase64Url(iv),
      now,
      existing.id,
      userId,
      provider,
    ).run();
    return;
  }

  await getD1().prepare(`
    INSERT INTO integration_secrets
      (id, user_id, provider, ciphertext, iv, encryption_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 2, ?, ?)
  `).bind(
    "secret:" + userId + ":" + provider,
    userId,
    provider,
    toBase64Url(new Uint8Array(ciphertext)),
    toBase64Url(iv),
    now,
    now,
  ).run();
}

export async function readIntegrationSecret(userId: string, provider: IntegrationProvider) {
  const stored = await findStoredSecret(userId, provider);
  if (!stored) return null;
  const key = await encryptionKey();
  try {
    const version = stored.encryption_version === 1 ? 1 : 2;
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(stored.iv), additionalData: additionalData(userId, provider, version) },
      key,
      fromBase64Url(stored.ciphertext),
    );
    const value = decoder.decode(plaintext);
    if (version === 1) await storeIntegrationSecret(userId, provider, value);
    return value;
  } catch {
    throw new IntegrationSecretError("Could not decrypt the integration key.");
  }
}

export async function deleteIntegrationSecret(userId: string, provider: IntegrationProvider) {
  await getD1().prepare("DELETE FROM integration_secrets WHERE user_id = ? AND provider = ?")
    .bind(userId, provider)
    .run();
}
