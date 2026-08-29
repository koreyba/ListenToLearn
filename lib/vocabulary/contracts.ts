export const VOCABULARY_LIMITS = Object.freeze({
  entryTextCharacters: 240,
  meaningCharacters: 1_000,
  contextCharacters: 1_000,
  readEntries: 20,
  meaningList: 50,
  providerMeanings: 6,
  repositoryPersonalMeanings: 7,
});

export const VOCABULARY_LEGACY_MEANING_ID = "legacy";
export const VOCABULARY_SCOPED_LEGACY_MEANING_PREFIX = "legacy:";

export function scopedLegacyMeaningId(phraseId: string) {
  return `${VOCABULARY_SCOPED_LEGACY_MEANING_PREFIX}${phraseId}`;
}

export function readScopedLegacyMeaningId(value: string) {
  if (!value.startsWith(VOCABULARY_SCOPED_LEGACY_MEANING_PREFIX)) return null;
  const phraseId = value.slice(VOCABULARY_SCOPED_LEGACY_MEANING_PREFIX.length);
  return phraseId && [...phraseId].length <= 120 ? phraseId : null;
}

export type VocabularyStatus = "to_learn" | "learning_now" | "learnt" | "learned";

export const VOCABULARY_CATEGORIES = ["to_learn", "learning", "learned"] as const;

export type VocabularyCategory = (typeof VOCABULARY_CATEGORIES)[number];
export type VocabularyCategoryFilter = VocabularyCategory | "all";

export function isVocabularyCategoryFilter(
  value: unknown,
): value is VocabularyCategoryFilter {
  return value === "all"
    || (typeof value === "string"
      && (VOCABULARY_CATEGORIES as readonly string[]).includes(value));
}

export function vocabularyCategoryFromStatus(
  status: VocabularyStatus,
): VocabularyCategory {
  if (status === "learning_now") return "learning";
  if (status === "learnt" || status === "learned") return "learned";
  return "to_learn";
}

export function vocabularyStatusForCategory(
  category: VocabularyCategory,
): Exclude<VocabularyStatus, "learned"> {
  if (category === "learning") return "learning_now";
  if (category === "learned") return "learnt";
  return "to_learn";
}

export type VocabularyMeaning = {
  id: string | null;
  source: "legacy" | "personal";
  translation: string;
  context: string;
};

export type VocabularyMeaningList = {
  phraseId: string;
  text: string;
  meanings: VocabularyMeaning[];
  meaningCount: number;
  meaningsTruncated: boolean;
};

export type VocabularyEntry = {
  phraseId: string;
  text: string;
  status: VocabularyStatus;
  sourceType: "preset" | "custom";
  addedAt: string;
  updatedAt: string;
  meanings: VocabularyMeaning[];
  meaningCount: number;
};

export type VocabularyPageCursor = Pick<VocabularyEntry, "phraseId" | "addedAt">;

const VOCABULARY_SQLITE_TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.\d{1,9})?$/u;
const VOCABULARY_ISO_TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d{1,9})?Z$/u;

export function isVocabularyStoredTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = VOCABULARY_SQLITE_TIMESTAMP.exec(value)
    || VOCABULARY_ISO_TIMESTAMP.exec(value);
  if (!match) return false;
  const parsed = Date.parse(`${match[1]}T${match[2]}Z`);
  return Number.isFinite(parsed)
    && new Date(parsed).toISOString().slice(0, 19) === `${match[1]}T${match[2]}`;
}

export type VocabularyPage = {
  entries: VocabularyEntry[];
  hasMore: boolean;
  nextCursor: VocabularyPageCursor | null;
};

export type VocabularyCategoryTarget = {
  phraseId: string;
  text: string;
  storedStatus: VocabularyStatus;
  category: VocabularyCategory;
};

export function normalizeVocabularyMeaning(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase()
    : "";
}

// SQLite's built-in NOCASE collation folds ASCII only. Keep mutation receipt
// keys byte-for-byte aligned with the database uniqueness boundary instead of
// claiming a broader Unicode equivalence that D1 cannot enforce.
export function normalizeVocabularyTarget(value: unknown): string {
  return typeof value === "string"
    ? value
      .normalize("NFC")
      .trim()
      .replace(/\s+/gu, " ")
      .replace(/[A-Z]/gu, (character) => character.toLowerCase())
    : "";
}
