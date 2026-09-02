import { getD1 } from "@/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";
import { normalizeStoredVideoProgress, readVideoProgressInput } from "@/lib/video-history";
import { isYouTubeVideoId } from "@/lib/youtube-player";

export const dynamic = "force-dynamic";
const MAX_BODY_LENGTH = 16_384;

type SavedVideoRow = {
  id: string;
  youtube_video_id: string;
  origin_phrase_id: string | null;
  origin_query: string;
  restore_query: string;
  restore_anchor_seconds: number;
  origin_caption: string;
  language: string;
  accent: string;
  resume_seconds: number;
  resume_caption_id: string;
  resume_caption_text: string;
  progress_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

function cleanText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : "";
}

function validVideoTime(value: unknown) {
  if (value === null || value === undefined
      || (typeof value === "string" && !value.trim())) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 604_800 ? seconds : null;
}

function publicVideo(row: SavedVideoRow) {
  return {
    id: row.id,
    videoId: row.youtube_video_id,
    originPhraseId: row.origin_phrase_id || "",
    originQuery: row.origin_query,
    restoreQuery: row.restore_query,
    restoreAnchorTime: row.restore_anchor_seconds,
    originCaption: row.origin_caption,
    language: row.language,
    accent: row.accent,
    progress: normalizeStoredVideoProgress({
      seconds: row.resume_seconds,
      captionId: row.resume_caption_id,
      captionText: row.resume_caption_text,
      updatedAt: row.progress_updated_at,
    }),
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
      SELECT id, youtube_video_id, origin_phrase_id, origin_query, restore_query, restore_anchor_seconds,
        origin_caption, language, accent,
        resume_seconds, resume_caption_id, resume_caption_text, progress_updated_at, created_at, updated_at
      FROM saved_videos
      WHERE user_id = ? AND restore_query <> '' AND restore_anchor_seconds >= 0
      ORDER BY updated_at DESC, id ASC
      LIMIT 200
    `).bind(user.subject).all<SavedVideoRow>();
    const videos = result.results.map(publicVideo);
    const etag = `W/"videos-${videos.length}-${videos[0]?.updatedAt || ""}-${user.subject}"`;
    const cacheHeaders: Record<string, string> = {
      "Cache-Control": "private, no-cache",
      ETag: etag,
    };
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: cacheHeaders });
    }
    return Response.json({ videos }, { headers: cacheHeaders });
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
    const restoreQuery = cleanText(payload.restoreQuery, 240);
    const restoreAnchorTime = validVideoTime(payload.restoreAnchorTime);
    const originCaption = cleanText(payload.originCaption, 1_000);
    const language = cleanText(payload.language, 20).toLocaleLowerCase("en") || "english";
    const accent = cleanText(payload.accent, 20).toLocaleLowerCase("en");
    const progressResult = readVideoProgressInput(payload.progress);
    const validLanguage = language === "english";
    const validAccent = !accent || accent === "us" || accent === "uk";
    if (!isYouTubeVideoId(videoId) || !originQuery || !restoreQuery || restoreAnchorTime === null) {
      return json({ error: "A valid YouTube video, display query, restore query, and restore anchor are required." }, { status: 400 });
    }
    if (!validLanguage || !validAccent) {
      return json({ error: "Unsupported YouGlish language or accent." }, { status: 400 });
    }
    if (!progressResult.ok) {
      return json({ error: progressResult.error }, { status: 400 });
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
    const progress = progressResult.value;
    const progressProvided = progress !== null;
    const id = existing?.id || "video-" + crypto.randomUUID();
    await db.prepare(`
      INSERT INTO saved_videos
        (id, user_id, youtube_video_id, origin_phrase_id, origin_query, restore_query, restore_anchor_seconds,
          origin_caption, language, accent,
          resume_seconds, resume_caption_id, resume_caption_text, progress_updated_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, youtube_video_id) DO UPDATE SET
        origin_phrase_id = CASE
          WHEN excluded.origin_phrase_id IS NOT NULL THEN excluded.origin_phrase_id
          ELSE saved_videos.origin_phrase_id
        END,
        origin_query = CASE
          WHEN excluded.origin_query <> '' THEN excluded.origin_query
          ELSE saved_videos.origin_query
        END,
        restore_query = excluded.restore_query,
        restore_anchor_seconds = excluded.restore_anchor_seconds,
        origin_caption = CASE
          WHEN excluded.origin_caption <> '' THEN excluded.origin_caption
          ELSE saved_videos.origin_caption
        END,
        language = excluded.language,
        accent = excluded.accent,
        resume_seconds = CASE
          WHEN excluded.progress_updated_at IS NOT NULL THEN excluded.resume_seconds
          ELSE saved_videos.resume_seconds
        END,
        resume_caption_id = CASE
          WHEN excluded.progress_updated_at IS NOT NULL THEN excluded.resume_caption_id
          ELSE saved_videos.resume_caption_id
        END,
        resume_caption_text = CASE
          WHEN excluded.progress_updated_at IS NOT NULL THEN excluded.resume_caption_text
          ELSE saved_videos.resume_caption_text
        END,
        progress_updated_at = CASE
          WHEN excluded.progress_updated_at IS NOT NULL THEN excluded.progress_updated_at
          ELSE saved_videos.progress_updated_at
        END,
        updated_at = excluded.updated_at
    `).bind(
      id,
      user.subject,
      videoId,
      visiblePhraseId,
      originQuery,
      restoreQuery,
      restoreAnchorTime,
      originCaption,
      language,
      accent,
      progress?.seconds || 0,
      progress?.captionId || "",
      progress?.captionText || "",
      progressProvided ? now : null,
      now,
      now,
    ).run();

    const row = await db.prepare(`
      SELECT id, youtube_video_id, origin_phrase_id, origin_query, restore_query, restore_anchor_seconds,
        origin_caption, language, accent,
        resume_seconds, resume_caption_id, resume_caption_text, progress_updated_at, created_at, updated_at
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
