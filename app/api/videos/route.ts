import { getD1 } from "@/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";
import { isYouTubeVideoId } from "@/lib/youtube-player";

export const dynamic = "force-dynamic";
const MAX_BODY_LENGTH = 16_384;

type SavedVideoRow = {
  id: string;
  youtube_video_id: string;
  origin_phrase_id: string | null;
  origin_query: string;
  origin_caption: string;
  language: string;
  accent: string;
  created_at: string;
  updated_at: string;
};

function cleanText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : "";
}

function publicVideo(row: SavedVideoRow) {
  return {
    id: row.id,
    videoId: row.youtube_video_id,
    originPhraseId: row.origin_phrase_id || "",
    originQuery: row.origin_query,
    originCaption: row.origin_caption,
    language: row.language,
    accent: row.accent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function json(value: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(value, { ...init, headers });
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const result = await getD1().prepare(`
      SELECT id, youtube_video_id, origin_phrase_id, origin_query, origin_caption, language, accent, created_at, updated_at
      FROM saved_videos
      WHERE user_id = ?
      ORDER BY updated_at DESC, id ASC
      LIMIT 200
    `).bind(user.subject).all<SavedVideoRow>();
    return json({ videos: result.results.map(publicVideo) });
  } catch (error) {
    console.error("Videos GET failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Could not load saved videos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_LENGTH) {
      return json({ error: "Request body is too large." }, { status: 413 });
    }
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) {
      return json({ error: "Request body is too large." }, { status: 413 });
    }
    let payload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid body");
      payload = parsed as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const videoId = cleanText(payload.videoId, 20);
    const originPhraseId = cleanText(payload.originPhraseId, 120);
    const originQuery = cleanText(payload.originQuery, 240);
    const originCaption = cleanText(payload.originCaption, 1_000);
    const language = cleanText(payload.language, 20).toLocaleLowerCase("en") || "english";
    const accent = cleanText(payload.accent, 20).toLocaleLowerCase("en");
    const validLanguage = language === "english";
    const validAccent = !accent || accent === "us" || accent === "uk";
    if (!isYouTubeVideoId(videoId) || !originQuery) {
      return json({ error: "A valid YouTube video and its original query are required." }, { status: 400 });
    }
    if (!validLanguage || !validAccent) {
      return json({ error: "Unsupported YouGlish language or accent." }, { status: 400 });
    }

    const db = getD1();
    let visiblePhraseId: string | null = null;
    if (originPhraseId) {
      const phrase = await db.prepare(`
        SELECT p.id
        FROM phrases AS p
        WHERE p.id = ? AND (p.source_type = 'preset' OR p.owner_id = ?)
      `).bind(originPhraseId, user.subject).first<{ id: string }>();
      if (!phrase) return json({ error: "Origin phrase not found." }, { status: 404 });
      visiblePhraseId = phrase.id;
    }

    const existing = await db.prepare(`
      SELECT id
      FROM saved_videos
      WHERE user_id = ? AND youtube_video_id = ?
    `).bind(user.subject, videoId).first<{ id: string }>();
    const now = new Date().toISOString();
    const id = existing?.id || "video-" + crypto.randomUUID();
    await db.prepare(`
      INSERT INTO saved_videos
        (id, user_id, youtube_video_id, origin_phrase_id, origin_query, origin_caption, language, accent, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, youtube_video_id) DO UPDATE SET
        origin_phrase_id = CASE
          WHEN excluded.origin_phrase_id IS NOT NULL THEN excluded.origin_phrase_id
          ELSE saved_videos.origin_phrase_id
        END,
        origin_query = CASE
          WHEN excluded.origin_query <> '' THEN excluded.origin_query
          ELSE saved_videos.origin_query
        END,
        origin_caption = CASE
          WHEN excluded.origin_caption <> '' THEN excluded.origin_caption
          ELSE saved_videos.origin_caption
        END,
        language = excluded.language,
        accent = excluded.accent,
        updated_at = excluded.updated_at
    `).bind(
      id,
      user.subject,
      videoId,
      visiblePhraseId,
      originQuery,
      originCaption,
      language,
      accent,
      now,
      now,
    ).run();

    const row = await db.prepare(`
      SELECT id, youtube_video_id, origin_phrase_id, origin_query, origin_caption, language, accent, created_at, updated_at
      FROM saved_videos
      WHERE user_id = ? AND youtube_video_id = ?
    `).bind(user.subject, videoId).first<SavedVideoRow>();
    if (!row) throw new Error("saved video missing after upsert");
    return json({ video: publicVideo(row), created: !existing }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("Videos POST failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Could not save the video." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const id = cleanText(new URL(request.url).searchParams.get("id"), 160);
    if (!id) return json({ error: "Saved video is required." }, { status: 400 });
    const result = await getD1().prepare(`
      DELETE FROM saved_videos
      WHERE id = ? AND user_id = ?
    `).bind(id, user.subject).run();
    if (!result.meta.changes) return json({ error: "Saved video not found." }, { status: 404 });
    return json({ deleted: true });
  } catch (error) {
    console.error("Videos DELETE failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Could not delete the saved video." }, { status: 500 });
  }
}
