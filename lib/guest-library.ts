export const GUEST_LIBRARY_STORAGE_KEY = "listen-to-learn-guest-library-v1";

export const guestStatuses = ["pick", "to_learn", "learning_now", "learnt"] as const;
export type GuestPhraseStatus = (typeof guestStatuses)[number];
export type GuestExampleProvider = "youglish" | "tatoeba";

export type GuestCustomPhrase = {
  id: string;
  text: string;
  pattern: string;
  ipa: string;
  context: string;
  translation: string;
  status: GuestPhraseStatus;
  createdAt: string;
  updatedAt: string;
};

export type GuestSavedExample = {
  id: string;
  phraseId: string;
  provider: GuestExampleProvider;
  externalId: string;
  query: string;
  caption: string;
  accent: string;
  metadata: Record<string, string>;
  createdAt: string;
};

export type GuestSavedVideo = {
  id: string;
  videoId: string;
  originPhraseId: string;
  originQuery: string;
  originCaption: string;
  language: string;
  accent: string;
  createdAt: string;
  updatedAt: string;
};

export type GuestLibraryState = {
  version: 2;
  statuses: Record<string, GuestPhraseStatus>;
  customPhrases: GuestCustomPhrase[];
  savedExamples: GuestSavedExample[];
  savedVideos: GuestSavedVideo[];
};

export type GuestPhraseInput = {
  text?: unknown;
  context?: unknown;
  translation?: unknown;
};

export type GuestExampleInput = {
  phraseId?: unknown;
  provider?: unknown;
  externalId?: unknown;
  query?: unknown;
  caption?: unknown;
  accent?: unknown;
  metadata?: unknown;
};

export type GuestVideoInput = {
  videoId?: unknown;
  originPhraseId?: unknown;
  originQuery?: unknown;
  originCaption?: unknown;
  language?: unknown;
  accent?: unknown;
};

const MAX_STATUSES = 500;
const MAX_CUSTOM_PHRASES = 200;
const MAX_SAVED_EXAMPLES = 500;
const MAX_SAVED_VIDEOS = 200;

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : "";
}

function nowIso(value?: string) {
  return value && !Number.isNaN(Date.parse(value)) ? value : new Date().toISOString();
}

function isStatus(value: unknown): value is GuestPhraseStatus {
  return typeof value === "string" && (guestStatuses as readonly string[]).includes(value);
}

function isProvider(value: unknown): value is GuestExampleProvider {
  return value === "youglish" || value === "tatoeba";
}

function isYouTubeVideoId(value: string) {
  return /^[A-Za-z0-9_-]{11}$/.test(value);
}

function videoLanguage() {
  return "english";
}

function videoAccent(value: unknown) {
  const valueText = text(value, 20).toLocaleLowerCase("en");
  return valueText === "us" || valueText === "uk" ? valueText : "";
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metadata(value: unknown) {
  const input = object(value);
  return Object.fromEntries(
    Object.entries(input)
      .slice(0, 8)
      .map(([key, item]) => [text(key, 80), text(item, 500)])
      .filter(([key, item]) => key && item),
  );
}

function id(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid || Date.now().toString(36)}`;
}

export function createGuestLibrary(): GuestLibraryState {
  return {
    version: 2,
    statuses: {},
    customPhrases: [],
    savedExamples: [],
    savedVideos: [],
  };
}

export function normalizeGuestLibrary(value: unknown): GuestLibraryState {
  const input = object(value);
  const statuses: Record<string, GuestPhraseStatus> = {};
  const rawStatuses = object(input.statuses);
  for (const [key, valueForKey] of Object.entries(rawStatuses).slice(0, MAX_STATUSES)) {
    const phraseId = text(key, 120);
    if (phraseId && isStatus(valueForKey)) statuses[phraseId] = valueForKey;
  }

  const customPhrases: GuestCustomPhrase[] = [];
  const rawPhrases = Array.isArray(input.customPhrases) ? input.customPhrases : [];
  for (const candidate of rawPhrases.slice(0, MAX_CUSTOM_PHRASES)) {
    const item = object(candidate);
    const phraseText = text(item.text, 240);
    const phraseId = text(item.id, 120);
    if (!phraseText || !phraseId) continue;
    customPhrases.push({
      id: phraseId,
      text: phraseText,
      pattern: text(item.pattern, 600) || `[${phraseText}]`,
      ipa: text(item.ipa, 240),
      context: text(item.context, 1_000),
      translation: text(item.translation, 1_000),
      status: isStatus(item.status) ? item.status : "to_learn",
      createdAt: nowIso(typeof item.createdAt === "string" ? item.createdAt : undefined),
      updatedAt: nowIso(typeof item.updatedAt === "string" ? item.updatedAt : undefined),
    });
  }

  const savedExamples: GuestSavedExample[] = [];
  const rawExamples = Array.isArray(input.savedExamples) ? input.savedExamples : [];
  for (const candidate of rawExamples.slice(0, MAX_SAVED_EXAMPLES)) {
    const item = object(candidate);
    const phraseId = text(item.phraseId, 120);
    const provider = item.provider;
    const externalId = text(item.externalId, 120);
    const query = text(item.query, 240);
    const exampleId = text(item.id, 160);
    if (!phraseId || !isProvider(provider) || !externalId || !query || !exampleId) continue;
    savedExamples.push({
      id: exampleId,
      phraseId,
      provider,
      externalId,
      query,
      caption: text(item.caption, 1_000),
      accent: text(item.accent, 20),
      metadata: metadata(item.metadata),
      createdAt: nowIso(typeof item.createdAt === "string" ? item.createdAt : undefined),
    });
  }

  const savedVideos: GuestSavedVideo[] = [];
  const rawVideos = Array.isArray(input.savedVideos) ? input.savedVideos : [];
  for (const candidate of rawVideos.slice(0, MAX_SAVED_VIDEOS)) {
    const item = object(candidate);
    const videoId = text(item.videoId, 20);
    const savedVideoId = text(item.id, 160);
    if (!savedVideoId || !isYouTubeVideoId(videoId)) continue;
    savedVideos.push({
      id: savedVideoId,
      videoId,
      originPhraseId: text(item.originPhraseId, 120),
      originQuery: text(item.originQuery, 240),
      originCaption: text(item.originCaption, 1_000),
      language: videoLanguage(),
      accent: videoAccent(item.accent),
      createdAt: nowIso(typeof item.createdAt === "string" ? item.createdAt : undefined),
      updatedAt: nowIso(typeof item.updatedAt === "string" ? item.updatedAt : undefined),
    });
  }

  return { version: 2, statuses, customPhrases, savedExamples, savedVideos };
}

export function setGuestPhraseStatus(
  state: GuestLibraryState,
  phraseId: string,
  status: GuestPhraseStatus,
  updatedAt = new Date().toISOString(),
) {
  const next = normalizeGuestLibrary(state);
  const idToUpdate = text(phraseId, 120);
  if (!idToUpdate || !isStatus(status)) return next;
  next.statuses[idToUpdate] = status;
  next.customPhrases = next.customPhrases.map((phrase) =>
    phrase.id === idToUpdate ? { ...phrase, status, updatedAt: nowIso(updatedAt) } : phrase,
  );
  return next;
}

export function addGuestPhrase(
  state: GuestLibraryState,
  input: GuestPhraseInput,
  createdAt = new Date().toISOString(),
) {
  const next = normalizeGuestLibrary(state);
  const phraseText = text(input.text, 240);
  if (!phraseText) return { state: next, phrase: null, created: false };
  const normalizedText = phraseText.toLocaleLowerCase("en");
  const existing = next.customPhrases.find((phrase) => phrase.text.toLocaleLowerCase("en") === normalizedText);
  if (existing) {
    const updated = setGuestPhraseStatus(next, existing.id, existing.status === "pick" ? "to_learn" : existing.status, createdAt);
    const phrase = updated.customPhrases.find((item) => item.id === existing.id) || existing;
    return { state: updated, phrase, created: false };
  }

  const timestamp = nowIso(createdAt);
  const phrase: GuestCustomPhrase = {
    id: id("guest-custom"),
    text: phraseText,
    pattern: `[${phraseText}]`,
    ipa: "",
    context: text(input.context, 1_000),
    translation: text(input.translation, 1_000),
    status: "to_learn",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  next.customPhrases = [phrase, ...next.customPhrases].slice(0, MAX_CUSTOM_PHRASES);
  return { state: next, phrase, created: true };
}

export function removeGuestPhrase(state: GuestLibraryState, phraseId: string) {
  const next = normalizeGuestLibrary(state);
  const idToRemove = text(phraseId, 120);
  next.statuses = Object.fromEntries(
    Object.entries(next.statuses).filter(([id]) => id !== idToRemove),
  );
  next.customPhrases = next.customPhrases.filter((phrase) => phrase.id !== idToRemove);
  next.savedExamples = next.savedExamples.filter((example) => example.phraseId !== idToRemove);
  return next;
}

export function toggleGuestSavedExample(
  state: GuestLibraryState,
  input: GuestExampleInput,
  createdAt = new Date().toISOString(),
) {
  const next = normalizeGuestLibrary(state);
  const phraseId = text(input.phraseId, 120);
  const provider = input.provider;
  const externalId = text(input.externalId, 120);
  const query = text(input.query, 240);
  if (!phraseId || !isProvider(provider) || !externalId || !query) {
    return { state: next, saved: false, example: null };
  }

  const existing = next.savedExamples.find((example) =>
    example.phraseId === phraseId && example.provider === provider && example.externalId === externalId,
  );
  if (existing) {
    next.savedExamples = next.savedExamples.filter((example) => example.id !== existing.id);
    return { state: next, saved: false, example: existing };
  }

  const example: GuestSavedExample = {
    id: id("guest-example"),
    phraseId,
    provider,
    externalId,
    query,
    caption: text(input.caption, 1_000),
    accent: text(input.accent, 20),
    metadata: metadata(input.metadata),
    createdAt: nowIso(createdAt),
  };
  next.savedExamples = [example, ...next.savedExamples].slice(0, MAX_SAVED_EXAMPLES);
  return { state: next, saved: true, example };
}

export function removeGuestSavedExample(state: GuestLibraryState, exampleId: string) {
  const next = normalizeGuestLibrary(state);
  const idToRemove = text(exampleId, 160);
  next.savedExamples = next.savedExamples.filter((example) => example.id !== idToRemove);
  return next;
}

export function guestSavedExamplesForPhrase(state: GuestLibraryState, phraseId: string) {
  const normalized = text(phraseId, 120);
  return normalizeGuestLibrary(state).savedExamples.filter((example) => example.phraseId === normalized);
}

export function saveGuestVideo(
  state: GuestLibraryState,
  input: GuestVideoInput,
  updatedAt = new Date().toISOString(),
) {
  const next = normalizeGuestLibrary(state);
  const videoId = text(input.videoId, 20);
  const originQuery = text(input.originQuery, 240);
  const existing = next.savedVideos.find((video) => video.videoId === videoId);
  if (!isYouTubeVideoId(videoId) || (!existing && !originQuery)) {
    return { state: next, video: null, created: false };
  }

  const timestamp = nowIso(updatedAt);
  const video: GuestSavedVideo = existing
    ? {
        ...existing,
        originPhraseId: text(input.originPhraseId, 120) || existing.originPhraseId,
        originQuery: originQuery || existing.originQuery,
        originCaption: text(input.originCaption, 1_000) || existing.originCaption,
        language: videoLanguage(),
        accent: input.accent === undefined ? existing.accent : videoAccent(input.accent),
        updatedAt: timestamp,
      }
    : {
        id: id("guest-video"),
        videoId,
        originPhraseId: text(input.originPhraseId, 120),
        originQuery,
        originCaption: text(input.originCaption, 1_000),
        language: videoLanguage(),
        accent: videoAccent(input.accent),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

  next.savedVideos = [
    video,
    ...next.savedVideos.filter((item) => item.videoId !== videoId),
  ].slice(0, MAX_SAVED_VIDEOS);
  return { state: next, video, created: !existing };
}

export function removeGuestSavedVideo(state: GuestLibraryState, videoRecordId: string) {
  const next = normalizeGuestLibrary(state);
  const idToRemove = text(videoRecordId, 160);
  next.savedVideos = next.savedVideos.filter((video) => video.id !== idToRemove);
  return next;
}
