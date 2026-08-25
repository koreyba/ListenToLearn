export const YOUTUBE_PROGRESS_STORAGE_KEY = "unmumble-youtube-progress-v1";
export const LEGACY_YOUTUBE_PROGRESS_STORAGE_KEYS = ["listen-to-learn-youtube-progress-v1"] as const;
const MAX_PROGRESS_SECONDS = 604_800;
const COMPLETION_THRESHOLD_SECONDS = 10;
const MAX_PROGRESS_VIDEOS = 200;

export type YouTubeProgressEntry = {
  seconds: number;
  captionId: string;
  captionText: string;
  updatedAt: string;
};

export type YouTubeProgressState = {
  version: 1;
  videos: Record<string, YouTubeProgressEntry>;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isYouTubeVideoId(value: string) {
  return /^[A-Za-z0-9_-]{11}$/.test(value);
}

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : "";
}

export function normalizeYouTubeProgress(value: unknown): YouTubeProgressState {
  const input = object(value);
  const rawVideos = object(input.videos);
  const validEntries: Array<[string, YouTubeProgressEntry]> = [];

  for (const [videoId, candidate] of Object.entries(rawVideos)) {
    const item = object(candidate);
    const seconds = Number(item.seconds);
    const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt : "";
    if (!isYouTubeVideoId(videoId) || !Number.isFinite(seconds) || seconds < 0 || seconds > MAX_PROGRESS_SECONDS || Number.isNaN(Date.parse(updatedAt))) continue;
    validEntries.push([videoId, {
      seconds,
      captionId: text(item.captionId, 160),
      captionText: text(item.captionText, 1_000),
      updatedAt,
    }]);
  }

  validEntries.sort((left, right) => Date.parse(right[1].updatedAt) - Date.parse(left[1].updatedAt));
  const videos = Object.fromEntries(validEntries.slice(0, MAX_PROGRESS_VIDEOS));
  return { version: 1, videos };
}

export function readYouTubeProgress(state: unknown, videoId: string, durationValue = 0) {
  if (!isYouTubeVideoId(videoId)) return 0;
  const seconds = normalizeYouTubeProgress(state).videos[videoId]?.seconds || 0;
  const duration = Number(durationValue);
  return Number.isFinite(duration)
    && duration > 0
    && seconds >= Math.max(0, duration - COMPLETION_THRESHOLD_SECONDS)
    ? 0
    : seconds;
}

export function readYouTubeResume(state: unknown, videoId: string) {
  if (!isYouTubeVideoId(videoId)) return null;
  return normalizeYouTubeProgress(state).videos[videoId] || null;
}

export function updateYouTubeProgress(
  state: unknown,
  videoId: string,
  secondsValue: number,
  updatedAtValue = new Date().toISOString(),
  captionValue: { captionId?: unknown; captionText?: unknown } = {},
) {
  const next = normalizeYouTubeProgress(state);
  const seconds = Number(secondsValue);
  if (!isYouTubeVideoId(videoId) || !Number.isFinite(seconds) || seconds < 0 || seconds > MAX_PROGRESS_SECONDS) return next;
  const updatedAt = Number.isNaN(Date.parse(updatedAtValue)) ? new Date().toISOString() : updatedAtValue;
  const existing = next.videos[videoId];
  next.videos[videoId] = {
    seconds,
    captionId: text(captionValue.captionId, 160) || existing?.captionId || "",
    captionText: text(captionValue.captionText, 1_000) || existing?.captionText || "",
    updatedAt,
  };
  return normalizeYouTubeProgress(next);
}

export function clearYouTubeProgress(state: unknown, videoId: string) {
  const next = normalizeYouTubeProgress(state);
  if (isYouTubeVideoId(videoId)) delete next.videos[videoId];
  return next;
}
