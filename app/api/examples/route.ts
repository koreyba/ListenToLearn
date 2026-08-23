import { getD1 } from "@/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ExampleRow = {
  id: string;
  phrase_id: string;
  provider: "youglish" | "tatoeba";
  external_id: string;
  query: string;
  caption: string;
  accent: string;
  metadata: string;
  created_at: string;
};

type ExampleMetadata = {
  sentenceId?: string;
  author?: string;
  license?: string;
  attributionUrl?: string;
};

function cleanText(value: unknown, limit = 500) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : "";
}

async function ensureExamples() {
  await getD1().prepare(`
    CREATE TABLE IF NOT EXISTS phrase_examples (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      phrase_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      query TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      accent TEXT NOT NULL DEFAULT '',
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (phrase_id) REFERENCES phrases(id) ON DELETE CASCADE
    )
  `).run();
}

function cleanMetadata(value: unknown): ExampleMetadata {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  return {
    sentenceId: cleanText(input.sentenceId, 32),
    author: cleanText(input.author, 160),
    license: cleanText(input.license, 120),
    attributionUrl: cleanText(input.attributionUrl, 500),
  };
}

function parseMetadata(value: string): ExampleMetadata {
  try {
    return cleanMetadata(JSON.parse(value));
  } catch {
    return {};
  }
}

async function visiblePhrase(userId: string, phraseId: string) {
  return getD1().prepare(`
    SELECT p.id, COALESCE(progress.status, 'pick') AS status
    FROM phrases AS p
    LEFT JOIN phrase_progress AS progress
      ON progress.phrase_id = p.id AND progress.user_id = ?
    WHERE p.id = ? AND (p.source_type = 'preset' OR p.owner_id = ?)
  `).bind(userId, phraseId, userId).first<{ id: string; status: string }>();
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    await ensureExamples();
    const phraseId = cleanText(new URL(request.url).searchParams.get("phraseId"), 120);
    if (!phraseId) return Response.json({ error: "Phrase is required." }, { status: 400 });
    if (!await visiblePhrase(user.subject, phraseId)) {
      return Response.json({ error: "Phrase not found." }, { status: 404 });
    }

    const result = await getD1().prepare(`
      SELECT id, phrase_id, provider, external_id, query, caption, accent, metadata, created_at
      FROM phrase_examples
      WHERE user_id = ? AND phrase_id = ?
      ORDER BY created_at DESC
    `).bind(user.subject, phraseId).all<ExampleRow>();
    return Response.json({
      examples: result.results.map((row) => ({ ...row, metadata: parseMetadata(row.metadata) })),
    });
  } catch (error) {
    console.error("Examples GET failed:", error);
    return Response.json({ error: "Could not load saved examples." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    await ensureExamples();
    const payload = (await request.json()) as Record<string, unknown>;
    const phraseId = cleanText(payload.phraseId, 120);
    const provider = cleanText(payload.provider, 20);
    const externalId = cleanText(payload.externalId, 32);
    const query = cleanText(payload.query, 240);
    const caption = cleanText(payload.caption, 1_000);
    const accent = cleanText(payload.accent, 12);
    const metadata = cleanMetadata(payload.metadata);
    const validExternalId = provider === "youglish"
      ? /^[A-Za-z0-9_-]{6,20}$/.test(externalId)
      : provider === "tatoeba" && /^\d+$/.test(externalId);
    if (!phraseId || !query || !validExternalId) {
      return Response.json({ error: "Could not determine the current example." }, { status: 400 });
    }

    const db = getD1();
    const phrase = await visiblePhrase(user.subject, phraseId);
    if (!phrase) return Response.json({ error: "Phrase not found." }, { status: 404 });
    const phraseStatus = phrase.status === "pick" ? "to_learn" : phrase.status;
    const now = new Date().toISOString();
    const statements = [];
    if (phrase.status === "pick") {
      statements.push(db.prepare(`
        INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
        VALUES (?, ?, 'to_learn', ?, ?)
        ON CONFLICT(user_id, phrase_id) DO UPDATE SET status = 'to_learn', updated_at = excluded.updated_at
      `).bind(user.subject, phraseId, now, now));
    }

    const existing = await db.prepare(`
      SELECT id FROM phrase_examples
      WHERE user_id = ? AND phrase_id = ? AND provider = ? AND external_id = ?
    `).bind(user.subject, phraseId, provider, externalId).first<{ id: string }>();

    if (existing) {
      statements.push(db.prepare(`
        UPDATE phrase_examples SET query = ?, caption = ?, accent = ?, metadata = ? WHERE id = ? AND user_id = ?
      `).bind(query, caption, accent, JSON.stringify(metadata), existing.id, user.subject));
      if (statements.length) await db.batch(statements);
      return Response.json({ id: existing.id, created: false, phraseStatus });
    }

    const id = "example-" + crypto.randomUUID();
    statements.push(db.prepare(`
      INSERT INTO phrase_examples
        (id, user_id, phrase_id, provider, external_id, query, caption, accent, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      user.subject,
      phraseId,
      provider,
      externalId,
      query,
      caption,
      accent,
      JSON.stringify(metadata),
      now,
    ));
    await db.batch(statements);
    return Response.json({ id, created: true, phraseStatus }, { status: 201 });
  } catch (error) {
    console.error("Examples POST failed:", error);
    return Response.json({ error: "Could not save the example." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    await ensureExamples();
    const id = cleanText(new URL(request.url).searchParams.get("id"), 120);
    if (!id) return Response.json({ error: "Example is required." }, { status: 400 });
    const result = await getD1()
      .prepare("DELETE FROM phrase_examples WHERE id = ? AND user_id = ?")
      .bind(id, user.subject)
      .run();
    if (!result.meta.changes) return Response.json({ error: "Saved example not found." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Examples DELETE failed:", error);
    return Response.json({ error: "Could not delete the saved example." }, { status: 500 });
  }
}
