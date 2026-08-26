import type { AppSessionRecord, AppSessionStore, ResolvedAppSession } from "@/lib/app-session";

type SessionUserRow = {
  subject: string;
  email: string;
  name: string;
  expires_at: string;
};

export function d1AppSessionStore(db: D1Database): AppSessionStore {
  return {
    async rotate(previousTokenHash: string | null, next: AppSessionRecord, nowIso: string) {
      const statements = [
        db.prepare("DELETE FROM app_sessions WHERE expires_at <= ?").bind(nowIso),
      ];
      if (previousTokenHash) {
        statements.push(
          db.prepare("DELETE FROM app_sessions WHERE token_hash = ?").bind(previousTokenHash),
        );
      }
      statements.push(
        db.prepare(`
          INSERT INTO app_sessions (token_hash, user_id, created_at, expires_at)
          VALUES (?, ?, ?, ?)
        `).bind(next.tokenHash, next.userId, next.createdAt, next.expiresAt),
      );
      await db.batch(statements);
    },

    async find(tokenHash: string): Promise<ResolvedAppSession | null> {
      const row = await db.prepare(`
        SELECT
          users.id AS subject,
          users.email AS email,
          users.display_name AS name,
          sessions.expires_at AS expires_at
        FROM app_sessions AS sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ?
        LIMIT 1
      `).bind(tokenHash).first<SessionUserRow>();
      if (!row) return null;
      return {
        user: {
          subject: row.subject,
          email: row.email,
          name: row.name,
        },
        expiresAt: row.expires_at,
      };
    },

    async revoke(tokenHash: string) {
      await db.prepare("DELETE FROM app_sessions WHERE token_hash = ?").bind(tokenHash).run();
    },
  };
}
