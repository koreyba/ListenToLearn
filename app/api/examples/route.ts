import { getD1 } from "@/db";

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
  const db = getD1();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS phrase_examples (
      id TEXT PRIMARY KEY,
      phrase_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      query TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      accent TEXT NOT NULL DEFAULT '',
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (phrase_id) REFERENCES phrases(id) ON DELETE CASCADE
    )
  `).run();
  const columns = await db.prepare("PRAGMA table_info(phrase_examples)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "metadata")) {
    await db.prepare("ALTER TABLE phrase_examples ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'").run();
  }
  await db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_phrase_examples_phrase_provider_external
    ON phrase_examples (phrase_id, provider, external_id)
  `).run();
  await db.prepare("PRAGMA optimize").run();
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

export async function GET(request: Request) {
  try {
    await ensureExamples();
    const phraseId = cleanText(new URL(request.url).searchParams.get("phraseId"), 120);
    if (!phraseId) return Response.json({ error: "Фраза не указана." }, { status: 400 });

    const result = await getD1().prepare(`
      SELECT id, phrase_id, provider, external_id, query, caption, accent, metadata, created_at
      FROM phrase_examples
      WHERE phrase_id = ?
      ORDER BY created_at DESC
    `).bind(phraseId).all<ExampleRow>();
    return Response.json({
      examples: result.results.map((row) => ({ ...row, metadata: parseMetadata(row.metadata) })),
    });
  } catch (error) {
    console.error("Examples GET failed:", error);
    return Response.json({ error: "Не удалось загрузить сохранённые примеры." }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
      return Response.json({ error: "Не удалось определить текущий пример." }, { status: 400 });
    }

    const db = getD1();
    const phrase = await db.prepare(
      "SELECT status FROM phrases WHERE id = ?",
    ).bind(phraseId).first<{ status: string }>();
    if (!phrase) return Response.json({ error: "Фраза не найдена." }, { status: 404 });
    if (phrase.status === "pick") {
      return Response.json({ error: "Сначала добавьте фразу в To Learn." }, { status: 409 });
    }

    const existing = await db.prepare(`
      SELECT id FROM phrase_examples
      WHERE phrase_id = ? AND provider = ? AND external_id = ?
    `).bind(phraseId, provider, externalId).first<{ id: string }>();

    if (existing) {
      await db.prepare(`
        UPDATE phrase_examples SET query = ?, caption = ?, accent = ?, metadata = ? WHERE id = ?
      `).bind(query, caption, accent, JSON.stringify(metadata), existing.id).run();
      return Response.json({ id: existing.id, created: false });
    }

    const id = `example-${crypto.randomUUID()}`;
    await db.prepare(`
      INSERT INTO phrase_examples
        (id, phrase_id, provider, external_id, query, caption, accent, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      phraseId,
      provider,
      externalId,
      query,
      caption,
      accent,
      JSON.stringify(metadata),
      new Date().toISOString(),
    ).run();
    return Response.json({ id, created: true }, { status: 201 });
  } catch (error) {
    console.error("Examples POST failed:", error);
    return Response.json({ error: "Не удалось сохранить пример." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureExamples();
    const id = cleanText(new URL(request.url).searchParams.get("id"), 120);
    if (!id) return Response.json({ error: "Пример не указан." }, { status: 400 });
    const result = await getD1().prepare("DELETE FROM phrase_examples WHERE id = ?").bind(id).run();
    if (!result.meta.changes) return Response.json({ error: "Сохранённый пример не найден." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Examples DELETE failed:", error);
    return Response.json({ error: "Не удалось удалить сохранённый пример." }, { status: 500 });
  }
}
