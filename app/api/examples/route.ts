import { getD1 } from "@/db";

export const dynamic = "force-dynamic";

type ExampleRow = {
  id: string;
  phrase_id: string;
  provider: "youglish";
  external_id: string;
  query: string;
  caption: string;
  accent: string;
  created_at: string;
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
      provider TEXT NOT NULL CHECK (provider IN ('youglish')),
      external_id TEXT NOT NULL,
      query TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      accent TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (phrase_id) REFERENCES phrases(id) ON DELETE CASCADE
    )
  `).run();
  await db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_phrase_examples_phrase_provider_external
    ON phrase_examples (phrase_id, provider, external_id)
  `).run();
  await db.prepare("PRAGMA optimize").run();
}

export async function GET(request: Request) {
  try {
    await ensureExamples();
    const phraseId = cleanText(new URL(request.url).searchParams.get("phraseId"), 120);
    if (!phraseId) return Response.json({ error: "Фраза не указана." }, { status: 400 });

    const result = await getD1().prepare(`
      SELECT id, phrase_id, provider, external_id, query, caption, accent, created_at
      FROM phrase_examples
      WHERE phrase_id = ?
      ORDER BY created_at DESC
    `).bind(phraseId).all<ExampleRow>();
    return Response.json({ examples: result.results });
  } catch (error) {
    console.error("Examples GET failed:", error);
    return Response.json({ error: "Не удалось загрузить сохранённые видео." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureExamples();
    const payload = (await request.json()) as Record<string, unknown>;
    const phraseId = cleanText(payload.phraseId, 120);
    const externalId = cleanText(payload.externalId, 32);
    const query = cleanText(payload.query, 240);
    const caption = cleanText(payload.caption, 1_000);
    const accent = cleanText(payload.accent, 12);
    if (!phraseId || !query || !/^[A-Za-z0-9_-]{6,20}$/.test(externalId)) {
      return Response.json({ error: "Не удалось определить текущее видео." }, { status: 400 });
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
      WHERE phrase_id = ? AND provider = 'youglish' AND external_id = ?
    `).bind(phraseId, externalId).first<{ id: string }>();

    if (existing) {
      await db.prepare(`
        UPDATE phrase_examples SET query = ?, caption = ?, accent = ? WHERE id = ?
      `).bind(query, caption, accent, existing.id).run();
      return Response.json({ id: existing.id, created: false });
    }

    const id = `example-${crypto.randomUUID()}`;
    await db.prepare(`
      INSERT INTO phrase_examples
        (id, phrase_id, provider, external_id, query, caption, accent, created_at)
      VALUES (?, ?, 'youglish', ?, ?, ?, ?, ?)
    `).bind(id, phraseId, externalId, query, caption, accent, new Date().toISOString()).run();
    return Response.json({ id, created: true }, { status: 201 });
  } catch (error) {
    console.error("Examples POST failed:", error);
    return Response.json({ error: "Не удалось сохранить видео." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureExamples();
    const id = cleanText(new URL(request.url).searchParams.get("id"), 120);
    if (!id) return Response.json({ error: "Видео не указано." }, { status: 400 });
    const result = await getD1().prepare("DELETE FROM phrase_examples WHERE id = ?").bind(id).run();
    if (!result.meta.changes) return Response.json({ error: "Сохранённое видео не найдено." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Examples DELETE failed:", error);
    return Response.json({ error: "Не удалось удалить сохранённое видео." }, { status: 500 });
  }
}
