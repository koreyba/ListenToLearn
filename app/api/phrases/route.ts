import { getD1 } from "@/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";
import { DeepLError, translateEnglishToRussian } from "@/lib/deepl";
import { PRESET_PHRASES } from "@/lib/preset-phrases";

export const dynamic = "force-dynamic";

const statuses = new Set(["pick", "to_learn", "learning_now", "learnt"]);
type PhraseStatus = "pick" | "to_learn" | "learning_now" | "learnt";

type PhraseRow = {
  id: string;
  text: string;
  pattern: string;
  ipa: string;
  translation: string;
  context: string;
  source_type: "preset" | "custom";
  catalog_order: number | null;
  status: PhraseStatus;
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
      translation TEXT NOT NULL DEFAULT '',
      context TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL CHECK (source_type IN ('preset', 'custom')),
      catalog_order INTEGER,
      owner_id TEXT,
      status TEXT NOT NULL DEFAULT 'pick' CHECK (status IN ('pick', 'to_learn', 'learning_now', 'learnt')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  const columns = await db.prepare("PRAGMA table_info(phrases)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "translation")) {
    await db.prepare("ALTER TABLE phrases ADD COLUMN translation TEXT NOT NULL DEFAULT ''").run();
  }
  if (!columns.results.some((column) => column.name === "context")) {
    await db.prepare("ALTER TABLE phrases ADD COLUMN context TEXT NOT NULL DEFAULT ''").run();
  }
  if (!columns.results.some((column) => column.name === "owner_id")) {
    await db.prepare("ALTER TABLE phrases ADD COLUMN owner_id TEXT").run();
  }

  const now = new Date().toISOString();
  await db.batch(
    PRESET_PHRASES.map((phrase, index) =>
      db.prepare(`
        INSERT OR IGNORE INTO phrases
          (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, '', '', 'preset', ?, NULL, 'pick', ?, ?)
      `).bind("preset-" + index, phrase.text, phrase.pattern, phrase.ipa, index, now, now),
    ),
  );
}

async function backfillTranslations(userId: string, request: Request) {
  const db = getD1();
  const missing = await db.prepare(`
    SELECT p.id, p.text
    FROM phrases AS p
    LEFT JOIN phrase_progress AS progress
      ON progress.phrase_id = p.id AND progress.user_id = ?
    WHERE (p.source_type = 'preset' OR p.owner_id = ?)
      AND COALESCE(progress.status, 'pick') != 'pick'
      AND p.translation = ''
    ORDER BY p.updated_at ASC
  `).bind(userId, userId).all<{ id: string; text: string }>();
  if (!missing.results.length) return;

  try {
    for (let offset = 0; offset < missing.results.length; offset += 50) {
      const rows = missing.results.slice(offset, offset + 50);
      const translations = await translateEnglishToRussian(rows.map((row) => row.text), "", { request });
      await db.batch(rows.map((row, index) =>
        db.prepare("UPDATE phrases SET translation = ? WHERE id = ? AND translation = ''")
          .bind(translations[index], row.id),
      ));
    }
  } catch (error) {
    console.error("Phrase translation backfill failed:", error);
  }
}

async function translationForPhrase(text: string, existing = "", request?: Request) {
  if (existing) return existing;
  const [translation] = await translateEnglishToRussian([text], "", { request });
  return translation;
}

async function optionalTranslationForPhrase(text: string, existing = "", request?: Request) {
  if (existing) return { text: existing, pending: false };
  try {
    return { text: await translationForPhrase(text, "", request), pending: false };
  } catch (error) {
    if (!(error instanceof DeepLError)) throw error;
    console.warn("Translation unavailable; continuing without it:", error.message);
    return { text: existing, pending: true };
  }
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    await ensureData();
    await backfillTranslations(user.subject, request);
    const result = await getD1().prepare(`
      SELECT
        p.id, p.text, p.pattern, p.ipa, p.translation, p.context, p.source_type, p.catalog_order,
        COALESCE(progress.status, 'pick') AS status,
        p.created_at, p.updated_at
      FROM phrases AS p
      LEFT JOIN phrase_progress AS progress
        ON progress.phrase_id = p.id AND progress.user_id = ?
      WHERE p.source_type = 'preset' OR p.owner_id = ?
      ORDER BY
        CASE WHEN COALESCE(progress.status, 'pick') = 'pick' THEN 0 ELSE 1 END,
        CASE WHEN COALESCE(progress.status, 'pick') = 'pick' THEN p.catalog_order END ASC,
        p.updated_at DESC
    `).bind(user.subject, user.subject).all<PhraseRow>();
    return Response.json({ phrases: result.results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load phrases.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    await ensureData();
    const payload = (await request.json()) as { text?: unknown; context?: unknown; translation?: unknown };
    const text = cleanText(payload.text);
    const context = cleanText(payload.context).slice(0, 1_000);
    const suppliedTranslation = cleanText(payload.translation).slice(0, 1_000);
    if (!text) return Response.json({ error: "Enter a phrase." }, { status: 400 });
    if (text.length > 240) return Response.json({ error: "The phrase is too long." }, { status: 400 });

    const db = getD1();
    const existing = await db.prepare(`
      SELECT p.id, p.translation, p.context, p.source_type,
             COALESCE(progress.status, 'pick') AS status
      FROM phrases AS p
      LEFT JOIN phrase_progress AS progress
        ON progress.phrase_id = p.id AND progress.user_id = ?
      WHERE lower(p.text) = lower(?)
        AND (p.source_type = 'preset' OR p.owner_id = ?)
      LIMIT 1
    `).bind(user.subject, text, user.subject).first<{
      id: string;
      translation: string;
      context: string;
      source_type: "preset" | "custom";
      status: PhraseStatus;
    }>();
    if (existing) {
      const status = existing.status === "pick" ? "to_learn" : existing.status;
      const translation = await optionalTranslationForPhrase(text, existing.translation || suppliedTranslation, request);
      const nextContext = context || existing.context;
      const now = new Date().toISOString();
      await db.batch([
        db.prepare(`
          UPDATE phrases
          SET translation = CASE WHEN translation = '' THEN ? ELSE translation END,
              context = ?, updated_at = ?
          WHERE id = ?
        `).bind(translation.text, nextContext, now, existing.id),
        db.prepare(`
          INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id, phrase_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
        `).bind(user.subject, existing.id, status, now, now),
      ]);
      return Response.json({
        id: existing.id,
        status,
        translation: translation.text,
        context: nextContext,
        translationPending: translation.pending,
        created: false,
      });
    }

    const translation = await optionalTranslationForPhrase(text, suppliedTranslation, request);
    const id = "custom-" + crypto.randomUUID();
    const now = new Date().toISOString();
    await db.batch([
      db.prepare(`
        INSERT INTO phrases
          (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
        VALUES (?, ?, ?, '', ?, ?, 'custom', NULL, ?, 'pick', ?, ?)
      `).bind(id, text, "[" + text + "]", translation.text, context, user.subject, now, now),
      db.prepare(`
        INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
        VALUES (?, ?, 'to_learn', ?, ?)
      `).bind(user.subject, id, now, now),
    ]);
    return Response.json({
      id,
      status: "to_learn",
      translation: translation.text,
      context,
      translationPending: translation.pending,
      created: true,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof DeepLError) {
      return Response.json({ error: error.message }, { status: error.code === "not_configured" ? 503 : 502 });
    }
    const message = error instanceof Error ? error.message : "Could not add the phrase.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    await ensureData();
    const payload = (await request.json()) as { id?: unknown; status?: unknown };
    const id = cleanText(payload.id);
    const status = cleanText(payload.status);
    if (!id || !statuses.has(status)) {
      return Response.json({ error: "Invalid phrase status." }, { status: 400 });
    }

    const db = getD1();
    const phrase = await db.prepare(`
      SELECT p.text, p.translation
      FROM phrases AS p
      WHERE p.id = ? AND (p.source_type = 'preset' OR p.owner_id = ?)
    `).bind(id, user.subject).first<{ text: string; translation: string }>();
    if (!phrase) return Response.json({ error: "Phrase not found." }, { status: 404 });

    const translation = status === "pick"
      ? { text: phrase.translation, pending: false }
      : await optionalTranslationForPhrase(phrase.text, phrase.translation, request);
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("UPDATE phrases SET translation = ?, updated_at = ? WHERE id = ? AND translation = ''")
        .bind(translation.text, now, id),
      db.prepare(`
        INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, phrase_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
      `).bind(user.subject, id, status, now, now),
    ]);
    return Response.json({ ok: true, translation: translation.text, translationPending: translation.pending });
  } catch (error) {
    if (error instanceof DeepLError) {
      return Response.json({ error: error.message }, { status: error.code === "not_configured" ? 503 : 502 });
    }
    const message = error instanceof Error ? error.message : "Could not update the phrase status.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    await ensureData();
    const id = cleanText(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "Phrase is required." }, { status: 400 });

    const db = getD1();
    const existing = await db.prepare(`
      SELECT source_type
      FROM phrases
      WHERE id = ? AND (source_type = 'preset' OR owner_id = ?)
    `).bind(id, user.subject).first<{ source_type: "preset" | "custom" }>();
    if (!existing) return Response.json({ error: "Phrase not found." }, { status: 404 });

    if (existing.source_type === "preset") {
      const now = new Date().toISOString();
      await db.prepare(`
        INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
        VALUES (?, ?, 'pick', ?, ?)
        ON CONFLICT(user_id, phrase_id) DO UPDATE SET status = 'pick', updated_at = excluded.updated_at
      `).bind(user.subject, id, now, now).run();
    } else {
      await db.prepare("DELETE FROM phrases WHERE id = ? AND owner_id = ?").bind(id, user.subject).run();
    }
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the phrase.";
    return Response.json({ error: message }, { status: 500 });
  }
}
