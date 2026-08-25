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
