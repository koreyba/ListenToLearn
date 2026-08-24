import { getD1 } from "@/db";
import { getCurrentUser, LEGACY_OWNER_EMAIL, unauthorizedResponse } from "@/lib/auth";
import { DeepLError, translateEnglishToRussian } from "@/lib/deepl";

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

type EmbeddedExampleRow = {
  example_id: string | null;
  example_phrase_id: string | null;
  example_provider: "youglish" | "tatoeba" | null;
  example_external_id: string | null;
  example_query: string | null;
  example_caption: string | null;
  example_accent: string | null;
  example_metadata: string | null;
  example_created_at: string | null;
};

type EmbeddedPhraseRow = PhraseRow & EmbeddedExampleRow;

type ExampleMetadata = {
  sentenceId?: string;
  author?: string;
  license?: string;
  attributionUrl?: string;
};

function parseExampleMetadata(value: string | null): ExampleMetadata {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      ...(typeof parsed.sentenceId === "string" ? { sentenceId: parsed.sentenceId } : {}),
      ...(typeof parsed.author === "string" ? { author: parsed.author } : {}),
      ...(typeof parsed.license === "string" ? { license: parsed.license } : {}),
      ...(typeof parsed.attributionUrl === "string" ? { attributionUrl: parsed.attributionUrl } : {}),
    };
  } catch {
    return {};
  }
}

function publicUser(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return null;
  return {
    id: user.subject,
    email: user.email,
    name: user.name,
    legacyStateAvailable: user.email === LEGACY_OWNER_EMAIL,
  };
}

function embeddedExamples(rows: EmbeddedExampleRow[]) {
  return rows.flatMap((row) => row.example_id && row.example_phrase_id && row.example_provider && row.example_external_id && row.example_query
    ? [{
        id: row.example_id,
        phrase_id: row.example_phrase_id,
        provider: row.example_provider,
        external_id: row.example_external_id,
        query: row.example_query,
        caption: row.example_caption || "",
        accent: row.example_accent || "",
        metadata: parseExampleMetadata(row.example_metadata),
        created_at: row.example_created_at || "",
      }]
    : []);
}

export async function backfillTranslations(userId: string, request: Request) {
  try {
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
    const db = getD1();
    const phraseId = cleanText(new URL(request.url).searchParams.get("id")).slice(0, 120);
    if (phraseId) {
      const result = await db.prepare(`
        SELECT
          p.id, p.text, p.pattern, p.ipa, p.translation, p.context, p.source_type, p.catalog_order,
          COALESCE(progress.status, 'pick') AS status,
          p.created_at, p.updated_at,
          examples.id AS example_id,
          examples.phrase_id AS example_phrase_id,
          examples.provider AS example_provider,
          examples.external_id AS example_external_id,
          examples.query AS example_query,
          examples.caption AS example_caption,
          examples.accent AS example_accent,
          examples.metadata AS example_metadata,
          examples.created_at AS example_created_at
        FROM phrases AS p
        LEFT JOIN phrase_progress AS progress
          ON progress.phrase_id = p.id AND progress.user_id = ?
        LEFT JOIN phrase_examples AS examples
          ON examples.phrase_id = p.id AND examples.user_id = ?
        WHERE p.id = ? AND (p.source_type = 'preset' OR p.owner_id = ?)
        ORDER BY examples.created_at DESC
      `).bind(user.subject, user.subject, phraseId, user.subject).all<EmbeddedPhraseRow>();
      const first = result.results[0];
      const phrase = first && {
        id: first.id,
        text: first.text,
        pattern: first.pattern,
        ipa: first.ipa,
        translation: first.translation,
        context: first.context,
        source_type: first.source_type,
        catalog_order: first.catalog_order,
        status: first.status,
        created_at: first.created_at,
        updated_at: first.updated_at,
      } satisfies PhraseRow;
      return Response.json({
        phrases: phrase ? [phrase] : [],
        examples: embeddedExamples(result.results),
        user: publicUser(user),
      });
    }

    const result = await db.prepare(`
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
    const needsBackfill = result.results.some((phrase) => phrase.status !== "pick" && !phrase.translation);
    return Response.json(
      { phrases: result.results, user: publicUser(user) },
      needsBackfill ? { headers: { "X-ListenToLearn-Backfill": "1" } } : undefined,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load phrases.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const payload = (await request.json()) as { text?: unknown; context?: unknown; translation?: unknown };
    const text = cleanText(payload.text);
    const context = cleanText(payload.context).slice(0, 1_000);
    const suppliedTranslation = cleanText(payload.translation).slice(0, 1_000);
    if (!text) return Response.json({ error: "Enter a phrase." }, { status: 400 });
    if (text.length > 240) return Response.json({ error: "The phrase is too long." }, { status: 400 });

    const db = getD1();
    const existing = await db.prepare(`
      SELECT p.id, p.translation, p.context, p.source_type,
             p.created_at, p.updated_at,
             COALESCE(progress.status, 'pick') AS status
      FROM phrases AS p
      LEFT JOIN phrase_progress AS progress
        ON progress.phrase_id = p.id AND progress.user_id = ?
      WHERE p.text = ? COLLATE NOCASE
        AND (p.source_type = 'preset' OR p.owner_id = ?)
      LIMIT 1
    `).bind(user.subject, text, user.subject).first<{
      id: string;
      translation: string;
      context: string;
      source_type: "preset" | "custom";
      created_at: string;
      updated_at: string;
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
        created_at: existing.created_at,
        updated_at: now,
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
      created_at: now,
      updated_at: now,
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
    return Response.json({
      ok: true,
      status,
      translation: translation.text,
      updated_at: now,
      translationPending: translation.pending,
    });
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
