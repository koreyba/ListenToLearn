import type { AuthenticatedUser } from "@/lib/user-context";

export const APP_SESSION_COOKIE = "__Host-unmumble_session";
export const LEGACY_SIGNED_OUT_COOKIE = "__Host-listen_to_learn_signed_out";
export const APP_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const TOKEN_BYTES = 32;
const TOKEN_LENGTH = 43;
const COOKIE_ATTRIBUTES = `Path=/; Max-Age=${APP_SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
const CLEAR_COOKIE_ATTRIBUTES = "Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";

export type AppSessionRecord = {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type ResolvedAppSession = {
  user: AuthenticatedUser;
  expiresAt: string;
};

export interface AppSessionStore {
  rotate(previousTokenHash: string | null, next: AppSessionRecord, nowIso: string): Promise<void>;
  find(tokenHash: string): Promise<ResolvedAppSession | null>;
  revoke(tokenHash: string): Promise<void>;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function validToken(value: string) {
  return value.length === TOKEN_LENGTH && /^[A-Za-z0-9_-]+$/.test(value);
}

function cleanString(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function normalizeSessionUser(input: AuthenticatedUser) {
  const subject = cleanString(input.subject, 240);
  const email = cleanString(input.email, 320).toLowerCase();
  const name = cleanString(input.name, 240);
  if (!subject || (email && !email.includes("@"))) return null;
  return { subject, email, name };
}

export function appSessionTokenFromRequest(request: Request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0 || entry.slice(0, separator).trim() !== APP_SESSION_COOKIE) continue;
    const value = entry.slice(separator + 1).trim();
    return validToken(value) ? value : "";
  }
  return "";
}

export async function hashAppSessionToken(token: string) {
  if (!validToken(token)) throw new Error("Application session token is invalid.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toBase64Url(new Uint8Array(digest));
}

function secureRandomBytes() {
  return crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
}

export async function issueAppSession(
  request: Request,
  user: AuthenticatedUser,
  store: AppSessionStore,
  options: { now?: Date; randomBytes?: () => Uint8Array } = {},
) {
  const normalized = normalizeSessionUser(user);
  if (!normalized) throw new Error("Application session user is invalid.");

  const now = options.now || new Date();
  const randomBytes = (options.randomBytes || secureRandomBytes)();
  if (randomBytes.length !== TOKEN_BYTES) throw new Error("Application session entropy is invalid.");

  const token = toBase64Url(randomBytes);
  const previousToken = appSessionTokenFromRequest(request);
  const previousTokenHash = previousToken ? await hashAppSessionToken(previousToken) : null;
  const tokenHash = await hashAppSessionToken(token);
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + APP_SESSION_MAX_AGE_SECONDS * 1_000).toISOString();

  await store.rotate(previousTokenHash, {
    tokenHash,
    userId: normalized.subject,
    createdAt,
    expiresAt,
  }, createdAt);

  return { token, expiresAt };
}

export async function resolveAppSession(
  request: Request,
  store: AppSessionStore,
  options: { now?: Date } = {},
) {
  const token = appSessionTokenFromRequest(request);
  if (!token) return null;

  const tokenHash = await hashAppSessionToken(token);
  const session = await store.find(tokenHash);
  if (!session) return null;

  const now = (options.now || new Date()).getTime();
  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    await store.revoke(tokenHash);
    return null;
  }

  return normalizeSessionUser(session.user);
}

export async function revokeAppSession(request: Request, store: AppSessionStore) {
  const token = appSessionTokenFromRequest(request);
  if (!token) return false;
  await store.revoke(await hashAppSessionToken(token));
  return true;
}

export function appSessionCookie(token: string) {
  if (!validToken(token)) throw new Error("Application session token is invalid.");
  return `${APP_SESSION_COOKIE}=${token}; ${COOKIE_ATTRIBUTES}`;
}

export function clearLegacySignedOutCookie() {
  return `${LEGACY_SIGNED_OUT_COOKIE}=; ${CLEAR_COOKIE_ATTRIBUTES}`;
}

export function clearAppSessionCookies() {
  return [
    `${APP_SESSION_COOKIE}=; ${CLEAR_COOKIE_ATTRIBUTES}`,
    clearLegacySignedOutCookie(),
  ];
}
