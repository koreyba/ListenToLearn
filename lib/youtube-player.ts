export function isYouTubeVideoId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{11}$/.test(value);
}

export function youtubeWatchUrl(videoId: string) {
  return isYouTubeVideoId(videoId)
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
    : "";
}

export function youtubeThumbnailUrl(videoId: string) {
  return isYouTubeVideoId(videoId)
    ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`
    : "";
}

export function youtubePlayerVars(origin: string) {
  return {
    controls: 1,
    playsinline: 1,
    cc_load_policy: 1,
    cc_lang_pref: "en",
    origin,
  } as const;
}
