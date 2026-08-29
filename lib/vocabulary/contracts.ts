export const VOCABULARY_LIMITS = Object.freeze({
  entryTextCharacters: 240,
  meaningCharacters: 1_000,
  contextCharacters: 1_000,
  readEntries: 20,
  providerMeanings: 6,
  repositoryPersonalMeanings: 7,
});

export const VOCABULARY_LEGACY_MEANING_ID = "legacy";

export type VocabularyStatus = "to_learn" | "learning_now" | "learnt" | "learned";

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
      .normalize("NFKC")
      .trim()
      .replace(/\s+/gu, " ")
      .replace(/[A-Z]/gu, (character) => character.toLowerCase())
    : "";
}
