import {
  isVocabularyStoredTimestamp,
  isVocabularyCategoryFilter,
  type VocabularyCategoryFilter,
  type VocabularyPageCursor,
} from "../../../vocabulary/contracts.ts";

const CURSOR_VERSION = 1;
export const AI_VOCABULARY_LIST_CURSOR_MAX_CHARACTERS = 512;

type SerializedVocabularyListCursor = {
  v: typeof CURSOR_VERSION;
  category: VocabularyCategoryFilter;
  addedAt: string;
  phraseId: string;
};

export type AiVocabularyListCursor = Omit<SerializedVocabularyListCursor, "v">;

function isPhraseId(value: unknown): value is string {
  return typeof value === "string"
    && Boolean(value)
    && [...value].length <= 120
    && !/[\r\n\0]/u.test(value);
}

function utf8ToBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  const base64 = btoa(binary)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_");
  const paddingStart = base64.indexOf("=");
  return paddingStart === -1 ? base64 : base64.slice(0, paddingStart);
}

function base64UrlToUtf8(value: string) {
  if (
    !value
    || value.length > AI_VOCABULARY_LIST_CURSOR_MAX_CHARACTERS
    || !/^[A-Za-z0-9_-]+$/u.test(value)
  ) {
    return null;
  }
  const padded = value.replace(/-/gu, "+").replace(/_/gu, "/")
    + "=".repeat((4 - value.length % 4) % 4);
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(
      binary,
      (character) => character.codePointAt(0) ?? 0,
    );
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return utf8ToBase64Url(decoded) === value ? decoded : null;
  } catch {
    return null;
  }
}

export function encodeAiVocabularyListCursor(input: AiVocabularyListCursor) {
  if (
    !isVocabularyCategoryFilter(input.category)
    || !isVocabularyStoredTimestamp(input.addedAt)
    || !isPhraseId(input.phraseId)
  ) {
    throw new TypeError("Vocabulary list cursor is invalid.");
  }
  const cursor = utf8ToBase64Url(JSON.stringify({
    v: CURSOR_VERSION,
    category: input.category,
    addedAt: input.addedAt,
    phraseId: input.phraseId,
  } satisfies SerializedVocabularyListCursor));
  if (cursor.length > AI_VOCABULARY_LIST_CURSOR_MAX_CHARACTERS) {
    throw new TypeError("Vocabulary list cursor is too large.");
  }
  return cursor;
}

export function readAiVocabularyListCursor(
  value: unknown,
  expectedCategory?: VocabularyCategoryFilter,
): AiVocabularyListCursor | null {
  if (typeof value !== "string") return null;
  const decoded = base64UrlToUtf8(value);
  if (!decoded) return null;
  try {
    const parsed = JSON.parse(decoded) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (
      Object.keys(record).sort((left, right) => left.localeCompare(right)).join(",")
        !== "addedAt,category,phraseId,v"
      || record.v !== CURSOR_VERSION
      || !isVocabularyCategoryFilter(record.category)
      || (expectedCategory !== undefined && record.category !== expectedCategory)
      || !isVocabularyStoredTimestamp(record.addedAt)
      || !isPhraseId(record.phraseId)
    ) {
      return null;
    }
    return {
      category: record.category,
      addedAt: record.addedAt,
      phraseId: record.phraseId,
    };
  } catch {
    return null;
  }
}

export function pageCursorFromListCursor(
  cursor: AiVocabularyListCursor,
): VocabularyPageCursor {
  return { addedAt: cursor.addedAt, phraseId: cursor.phraseId };
}

export type AiVocabularyListContinuation = {
  category: VocabularyCategoryFilter;
  cursor: string;
};

export function readAiVocabularyListContinuation(
  value: unknown,
): AiVocabularyListContinuation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (
    result.ok !== true
    || result.hasMore !== true
    || !isVocabularyCategoryFilter(result.category)
    || typeof result.nextCursor !== "string"
    || !readAiVocabularyListCursor(result.nextCursor, result.category)
  ) {
    return null;
  }
  return { category: result.category, cursor: result.nextCursor };
}
