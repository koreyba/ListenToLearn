import { getD1 } from "@/db";
import {
  AUTHENTICATED_USER_HEADER,
  decodeUserContext,
  type AuthenticatedUser,
} from "@/lib/user-context";

export const LEGACY_OWNER_EMAIL = "koreybadenis@gmail.com";
export const LEGACY_OWNER_ID = "legacy:" + LEGACY_OWNER_EMAIL;

export function getAuthenticatedUser(request: Request) {
  return decodeUserContext(request.headers.get(AUTHENTICATED_USER_HEADER));
}

export function unauthorizedResponse() {
  return Response.json(
    { error: "Войди через Google, чтобы использовать приложение." },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": "Bearer",
      },
    },
  );
}

export async function getCurrentUser(request: Request) {
  const user = getAuthenticatedUser(request);
  if (!user) return null;
  await ensureUser(user);
  return user;
}

export async function ensureUser(user: AuthenticatedUser) {
  const db = getD1();
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO users (id, email, display_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name,
      updated_at = excluded.updated_at
  `).bind(user.subject, user.email, user.name, now, now).run();

  if (user.email !== LEGACY_OWNER_EMAIL || user.subject === LEGACY_OWNER_ID) return;

  await db.batch([
    db.prepare(`
      INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
      SELECT ?, phrase_id, status, created_at, updated_at
      FROM phrase_progress
      WHERE user_id = ?
      ON CONFLICT(user_id, phrase_id) DO NOTHING
    `).bind(user.subject, LEGACY_OWNER_ID),
    db.prepare(`
      INSERT OR IGNORE INTO phrase_examples
        (id, user_id, phrase_id, provider, external_id, query, caption, accent, metadata, created_at)
      SELECT 'migrated-' || id, ?, phrase_id, provider, external_id, query, caption, accent, metadata, created_at
      FROM phrase_examples AS legacy
      WHERE legacy.user_id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM phrase_examples AS current
          WHERE current.user_id = ?
            AND current.phrase_id = legacy.phrase_id
            AND current.provider = legacy.provider
            AND current.external_id = legacy.external_id
        )
    `).bind(user.subject, LEGACY_OWNER_ID, user.subject),
    db.prepare(`
      INSERT OR IGNORE INTO integration_secrets
        (id, user_id, provider, ciphertext, iv, encryption_version, created_at, updated_at)
      SELECT 'migrated-' || id, ?, provider, ciphertext, iv, encryption_version, created_at, updated_at
      FROM integration_secrets AS legacy
      WHERE legacy.user_id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM integration_secrets AS current
          WHERE current.user_id = ? AND current.provider = legacy.provider
        )
    `).bind(user.subject, LEGACY_OWNER_ID, user.subject),
    db.prepare("UPDATE phrases SET owner_id = ? WHERE owner_id = ?")
      .bind(user.subject, LEGACY_OWNER_ID),
    db.prepare("DELETE FROM phrase_progress WHERE user_id = ?").bind(LEGACY_OWNER_ID),
    db.prepare("DELETE FROM phrase_examples WHERE user_id = ?").bind(LEGACY_OWNER_ID),
    db.prepare("DELETE FROM integration_secrets WHERE user_id = ?").bind(LEGACY_OWNER_ID),
    db.prepare("DELETE FROM users WHERE id = ?").bind(LEGACY_OWNER_ID),
  ]);
}
