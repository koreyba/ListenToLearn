export type AuthenticatedUser = {
  subject: string;
  email: string;
  name: string;
};

export const AUTHENTICATED_USER_HEADER = "x-unmumble-user";

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

function cleanString(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export function normalizeUserContext(input: {
  subject?: unknown;
  email?: unknown;
  name?: unknown;
}): AuthenticatedUser | null {
  const subject = cleanString(input.subject, 240);
  const email = cleanString(input.email, 320).toLowerCase();
  const name = cleanString(input.name, 240);
  if (!subject || (email && !email.includes("@"))) return null;
  return { subject, email, name };
}

export function encodeUserContext(user: AuthenticatedUser) {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(user)));
}

export function decodeUserContext(value: string | null | undefined): AuthenticatedUser | null {
  if (!value || value.length > 2_000) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(value))) as {
      subject?: unknown;
      email?: unknown;
      name?: unknown;
    };
    return normalizeUserContext(parsed);
  } catch {
    return null;
  }
}
