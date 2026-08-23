import { getD1 } from "@/db";
import { PRESET_PHRASES } from "@/lib/preset-phrases";

export const dynamic = "force-dynamic";

const statuses = new Set(["pick", "to_learn", "learning_now", "learnt"]);

type PhraseRow = {
  id: string;
  text: string;
  pattern: string;
  ipa: string;
  source_type: "preset" | "custom";
  catalog_order: number | null;
  status: "pick" | "to_learn" | "learning_now" | "learnt";
  created_at: string;
  updated_at: string;
};

async function ensureData() {
  const db = getD1();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS phrases (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      pattern TEXT NOT NULL,
      ipa TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL CHECK (source_type IN ('preset', 'custom')),
      catalog_order INTEGER,
      status TEXT NOT NULL DEFAULT 'pick' CHECK (status IN ('pick', 'to_learn', 'learning_now', 'learnt')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  const now = new Date().toISOString();
  await db.batch(
    PRESET_PHRASES.map((phrase, index) =>
      db.prepare(`
        INSERT OR IGNORE INTO phrases
          (id, text, pattern, ipa, source_type, catalog_order, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'preset', ?, 'pick', ?, ?)
      `).bind(`preset-${index}`, phrase.text, phrase.pattern, phrase.ipa, index, now, now)
    )
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function GET() {
  try {
    await ensureData();
    const db = getD1();
    const result = await db.prepare(`
      SELECT id, text, pattern, ipa, source_type, catalog_order, status, created_at, updated_at
      FROM phrases
      ORDER BY
        CASE WHEN status = 'pick' THEN 0 ELSE 1 END,
        CASE WHEN status = 'pick' THEN catalog_order END ASC,
        updated_at DESC
    `).all<PhraseRow>();
    return Response.json({ phrases: result.results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить фразы.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureData();
    const payload = (await request.json()) as { text?: unknown };
    const text = cleanText(payload.text);
    if (!text) return Response.json({ error: "Введите фразу." }, { status: 400 });
    if (text.length > 240) return Response.json({ error: "Фраза слишком длинная." }, { status: 400 });

    const db = getD1();
    const existing = await db.prepare(
      "SELECT id, status FROM phrases WHERE text = ? COLLATE NOCASE LIMIT 1"
    ).bind(text).first<{ id: string; status: PhraseRow["status"] }>();
    if (existing) {
      const status = existing.status === "pick" ? "to_learn" : existing.status;
      if (status !== existing.status) {
        await db.prepare(
          "UPDATE phrases SET status = ?, updated_at = ? WHERE id = ?"
        ).bind(status, new Date().toISOString(), existing.id).run();
      }
      return Response.json({ id: existing.id, status, created: false });
    }

    const id = `custom-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO phrases
        (id, text, pattern, ipa, source_type, catalog_order, status, created_at, updated_at)
      VALUES (?, ?, ?, '', 'custom', NULL, 'to_learn', ?, ?)
    `).bind(id, text, `[${text}]`, now, now).run();
    return Response.json({ id, status: "to_learn", created: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось добавить фразу.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureData();
    const payload = (await request.json()) as { id?: unknown; status?: unknown };
    const id = cleanText(payload.id);
    const status = cleanText(payload.status);
    if (!id || !statuses.has(status)) {
      return Response.json({ error: "Некорректный статус фразы." }, { status: 400 });
    }

    const db = getD1();
    const result = await db.prepare(
      "UPDATE phrases SET status = ?, updated_at = ? WHERE id = ?"
    ).bind(status, new Date().toISOString(), id).run();
    if (!result.meta.changes) return Response.json({ error: "Фраза не найдена." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось изменить статус.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureData();
    const id = cleanText(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "Фраза не указана." }, { status: 400 });

    const db = getD1();
    const existing = await db.prepare(
      "SELECT source_type FROM phrases WHERE id = ?"
    ).bind(id).first<{ source_type: "preset" | "custom" }>();
    if (!existing) return Response.json({ error: "Фраза не найдена." }, { status: 404 });

    if (existing.source_type === "preset") {
      await db.prepare(
        "UPDATE phrases SET status = 'pick', updated_at = ? WHERE id = ?"
      ).bind(new Date().toISOString(), id).run();
    } else {
      await db.prepare("DELETE FROM phrases WHERE id = ?").bind(id).run();
    }
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось удалить фразу.";
    return Response.json({ error: message }, { status: 500 });
  }
}
