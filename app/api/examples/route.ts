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

type ExampleProvider = ExampleRow["provider"];

type VisibleExampleRow = {
  id: string | null;
  phrase_id: string | null;
  provider: ExampleProvider | null;
  external_id: string | null;
  query: string | null;
  caption: string | null;
  accent: string | null;
  metadata: string | null;
  created_at: string | null;
};

type PhraseExampleIdentityRow = {
  phrase_id: string;
  status: string;
  existing_id: string | null;
  existing_created_at: string | null;
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

function validProvider(value: string): value is ExampleProvider {
  return value === "youglish" || value === "tatoeba";
}

function publicExample(row: {
  id: string;
  phrase_id: string;
  provider: ExampleProvider;
  external_id: string;
  query: string;
  caption: string;
  accent: string;
  metadata: string;
  created_at: string;
}) {
  return { ...row, metadata: parseMetadata(row.metadata) };
}

function visibleExamples(rows: VisibleExampleRow[]) {
  return rows.flatMap((row) => row.id && row.phrase_id && row.provider && row.external_id && row.query && row.metadata !== null && row.created_at
    ? [publicExample({
        id: row.id,
        phrase_id: row.phrase_id,
        provider: row.provider,
        external_id: row.external_id,
        query: row.query,
        caption: row.caption || "",
        accent: row.accent || "",
        metadata: row.metadata,
        created_at: row.created_at,
      })]
    : []);
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const phraseId = cleanText(new URL(request.url).searchParams.get("phraseId"), 120);
    if (!phraseId) return Response.json({ error: "Phrase is required." }, { status: 400 });

    const result = await getD1().prepare(`
      SELECT
        examples.id,
        examples.phrase_id,
        examples.provider,
        examples.external_id,
        examples.query,
        examples.caption,
        examples.accent,
        examples.metadata,
        examples.created_at
      FROM phrases AS p
      LEFT JOIN phrase_examples AS examples
        ON examples.user_id = ? AND examples.phrase_id = p.id
      WHERE p.id = ? AND (p.source_type = 'preset' OR p.owner_id = ?)
      ORDER BY examples.created_at DESC
    `).bind(user.subject, phraseId, user.subject).all<VisibleExampleRow>();
    if (!result.results.length) {
      return Response.json({ error: "Phrase not found." }, { status: 404 });
    }

    const examples = visibleExamples(result.results);
    const body = JSON.stringify({ examples });
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
    const etag = `W/"examples-${phraseId}-${user.subject}-${hash}"`;
    const cacheHeaders: Record<string, string> = {
      "Cache-Control": "private, no-cache",
      ETag: etag,
    };
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: cacheHeaders });
    }
    return new Response(body, {
      headers: {
        ...cacheHeaders,
        "Content-Type": "application/json",
      },
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
    if (!phraseId || !query || !validProvider(provider) || !validExternalId) {
      return Response.json({ error: "Could not determine the current example." }, { status: 400 });
    }

    const db = getD1();
    const phrase = await db.prepare(`
      SELECT
        p.id AS phrase_id,
        COALESCE(progress.status, 'pick') AS status,
        existing.id AS existing_id,
        existing.created_at AS existing_created_at
      FROM phrases AS p
      LEFT JOIN phrase_progress AS progress
        ON progress.phrase_id = p.id AND progress.user_id = ?
      LEFT JOIN phrase_examples AS existing
        ON existing.user_id = ?
          AND existing.phrase_id = p.id
          AND existing.provider = ?
          AND existing.external_id = ?
      WHERE p.id = ? AND (p.source_type = 'preset' OR p.owner_id = ?)
    `).bind(user.subject, user.subject, provider, externalId, phraseId, user.subject)
      .first<PhraseExampleIdentityRow>();
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

    if (phrase.existing_id) {
      statements.push(db.prepare(`
        UPDATE phrase_examples SET query = ?, caption = ?, accent = ?, metadata = ? WHERE id = ? AND user_id = ?
      `).bind(query, caption, accent, JSON.stringify(metadata), phrase.existing_id, user.subject));
      if (statements.length) await db.batch(statements);
      return Response.json({
        id: phrase.existing_id,
        created: false,
        phraseStatus,
        example: publicExample({
          id: phrase.existing_id,
          phrase_id: phraseId,
          provider,
          external_id: externalId,
          query,
          caption,
          accent,
          metadata: JSON.stringify(metadata),
          created_at: phrase.existing_created_at || now,
        }),
      });
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
    return Response.json({
      id,
      created: true,
      phraseStatus,
      example: publicExample({
        id,
        phrase_id: phraseId,
        provider,
        external_id: externalId,
        query,
        caption,
        accent,
        metadata: JSON.stringify(metadata),
        created_at: now,
      }),
    }, { status: 201 });
  } catch (error) {
    console.error("Examples POST failed:", error);
    return Response.json({ error: "Could not save the example." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
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
