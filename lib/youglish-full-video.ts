export type FullVideoOrigin = {
  videoId: string;
  originPhraseId?: string;
  originQuery: string;
  restoreQuery: string;
  originCaption?: string;
  language?: string;
  accent?: string;
};

export type FullVideoResume = {
  seconds: number;
  captionId?: string;
  captionText?: string;
  updatedAt?: string;
};

function cleanText(value: unknown, limit: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, limit)
    : "";
}

function isYouTubeVideoId(value: string) {
  return /^[A-Za-z0-9_-]{11}$/.test(value);
}

export function videoSpecificQuery(queryValue: unknown, videoIdValue: unknown) {
  const query = cleanText(queryValue, 1_000);
  const videoId = cleanText(videoIdValue, 20);
  if (!query || !isYouTubeVideoId(videoId)) return "";
  const constraint = `#${videoId}`;
  const withoutConstraint = query
    .split(/\s+/)
    .filter((part) => part !== constraint)
    .join(" ");
  return `${withoutConstraint} ${constraint}`.trim();
}

export function buildFullVideoTrainerUrl(
  origin: FullVideoOrigin,
  resume: FullVideoResume | null = null,
  baseUrl = "http://localhost",
) {
  const videoId = cleanText(origin.videoId, 20);
  const originalQuery = cleanText(origin.originQuery, 240);
  const restoreQuery = cleanText(origin.restoreQuery, 240);
  if (!isYouTubeVideoId(videoId) || !originalQuery || !restoreQuery) return "";

  const url = new URL("/trainer", baseUrl);
  url.searchParams.set("fullVideo", "1");
  url.searchParams.set("video", videoId);
  url.searchParams.set("query", originalQuery);
  url.searchParams.set("restoreQuery", restoreQuery);
  const phraseId = cleanText(origin.originPhraseId, 120);
  const originCaption = cleanText(origin.originCaption, 1_000);
  const language = cleanText(origin.language, 20).toLocaleLowerCase("en") || "english";
  const accent = cleanText(origin.accent, 20).toLocaleLowerCase("en");
  if (phraseId) url.searchParams.set("phraseId", phraseId);
  if (originCaption) url.searchParams.set("caption", originCaption);
  url.searchParams.set("language", language);
  if (accent === "us" || accent === "uk") url.searchParams.set("accent", accent);

  if (resume) {
    const seconds = Number(resume.seconds);
    const captionId = cleanText(resume.captionId, 160);
    const captionText = cleanText(resume.captionText, 1_000);
    if (Number.isFinite(seconds) && seconds >= 0) url.searchParams.set("resumeTime", String(seconds));
    if (captionId) url.searchParams.set("resumeCaptionId", captionId);
    if (captionText) url.searchParams.set("resumeCaption", captionText);
  }

  return baseUrl === "http://localhost"
    ? `${url.pathname}${url.search}`
    : url.toString();
}
