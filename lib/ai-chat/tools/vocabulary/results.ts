import { AI_CHAT_LIMITS } from "../../contracts.ts";
import {
  scopedLegacyMeaningId,
  vocabularyCategoryFromStatus,
  type VocabularyCategoryFilter,
} from "../../../vocabulary/contracts.ts";
import type {
  VocabularyEntry,
  VocabularyMeaning,
  VocabularyPage,
} from "../../../vocabulary/repository.ts";

import {
  AI_VOCABULARY_MAX_TOOL_RESULTS,
  AI_VOCABULARY_MAX_TOOL_RESULT_JSON_CHARACTERS,
  type AiVocabularyToolEntry,
} from "./contracts.ts";
import { encodeAiVocabularyListCursor } from "./pagination.ts";

function truncateCharacters(value: string, maximum: number) {
  return [...value].slice(0, maximum).join("");
}
function boundedToolMeaning(
  meaning: VocabularyMeaning,
  entry?: Pick<VocabularyEntry, "phraseId" | "sourceType">,
): VocabularyMeaning {
  const id = meaning.source === "legacy" && entry?.sourceType === "custom"
    ? scopedLegacyMeaningId(entry.phraseId)
    : meaning.id;
  return {
    ...meaning,
    id: typeof id === "string" ? truncateCharacters(id, 140) : id,
    translation: truncateCharacters(
      meaning.translation,
      AI_CHAT_LIMITS.promptMeaningCharacters,
    ),
    context: truncateCharacters(meaning.context, AI_CHAT_LIMITS.promptContextCharacters),
  };
}

function boundedToolEntry(entry: VocabularyEntry): AiVocabularyToolEntry {
  const includedMeanings = entry.meanings.slice(0, 6);
  return {
    phraseId: truncateCharacters(entry.phraseId, 120),
    text: truncateCharacters(entry.text, AI_CHAT_LIMITS.targetTextCharacters),
    category: vocabularyCategoryFromStatus(entry.status),
    meanings: includedMeanings.map((meaning) => boundedToolMeaning(meaning, entry)),
    meaningCount: entry.meaningCount,
    meaningsTruncated: entry.meaningCount > 6,
    detailsTruncated: includedMeanings.some((meaning) => (
      [...meaning.translation].length > AI_CHAT_LIMITS.promptMeaningCharacters
      || [...meaning.context].length > AI_CHAT_LIMITS.promptContextCharacters
      || (typeof meaning.id === "string" && [...meaning.id].length > 120)
    )),
  };
}

export function boundedToolEntries(
  entries: readonly VocabularyEntry[],
  envelope: (bounded: AiVocabularyToolEntry[]) => object = (bounded) => ({
    ok: true,
    entries: bounded,
  }),
) {
  const bounded = entries.slice(0, AI_VOCABULARY_MAX_TOOL_RESULTS).map(boundedToolEntry);
  const resultCharacters = () => JSON.stringify(envelope(bounded)).length;

  while (resultCharacters() > AI_VOCABULARY_MAX_TOOL_RESULT_JSON_CHARACTERS) {
    const candidate = bounded
      .filter((entry) => entry.meanings.length > 1)
      .sort((left, right) => right.meanings.length - left.meanings.length)[0];
    if (!candidate) break;
    candidate.meanings.pop();
    candidate.meaningsTruncated = true;
  }

  while (resultCharacters() > AI_VOCABULARY_MAX_TOOL_RESULT_JSON_CHARACTERS) {
    const candidate = bounded
      .flatMap((entry) => entry.meanings.map((meaning) => ({ entry, meaning })))
      .filter(({ meaning }) => Boolean(meaning.context))
      .sort((left, right) => right.meaning.context.length - left.meaning.context.length)[0];
    if (!candidate) break;
    candidate.meaning.context = "";
    candidate.entry.detailsTruncated = true;
  }

  while (
    resultCharacters() > AI_VOCABULARY_MAX_TOOL_RESULT_JSON_CHARACTERS
    && bounded.length > 1
  ) {
    bounded.pop();
  }

  while (resultCharacters() > AI_VOCABULARY_MAX_TOOL_RESULT_JSON_CHARACTERS) {
    const candidate = bounded.find((entry) => entry.meanings.length > 0);
    if (!candidate) break;
    candidate.meanings.pop();
    candidate.meaningsTruncated = true;
    candidate.detailsTruncated = true;
  }

  return resultCharacters() <= AI_VOCABULARY_MAX_TOOL_RESULT_JSON_CHARACTERS ? bounded : [];
}

export function boundedVocabularyPage(
  page: VocabularyPage,
  category: VocabularyCategoryFilter,
) {
  const result = (entries: AiVocabularyToolEntry[]) => {
    const sourceEntry = page.entries[entries.length - 1];
    const hasMore = page.hasMore || entries.length < page.entries.length;
    const nextCursor = hasMore && sourceEntry
      ? encodeAiVocabularyListCursor({
          category,
          addedAt: sourceEntry.addedAt,
          phraseId: sourceEntry.phraseId,
        })
      : null;
    return { ok: true as const, category, entries, hasMore, nextCursor };
  };
  const entries = boundedToolEntries(page.entries, result);
  return result(entries);
}

export function buildVocabularyOpeningMessage(entries: readonly VocabularyEntry[]) {
  if (!entries.length) {
    return "В словаре пока нет слов. Можешь назвать слово или фразу для практики — сохранять их буду только по твоей прямой команде.";
  }
  const vocabulary = entries.map((entry, index) => {
    const allTranslations = [...new Set(
      entry.meanings.map((meaning) => meaning.translation.trim()).filter(Boolean),
    )];
    const translations = allTranslations
      .slice(0, 3)
      .map((translation) => truncateCharacters(translation, 120));
    const hiddenMeaningCount = Math.max(0, entry.meaningCount - translations.length);
    const meaningText = translations.length
      ? `${translations.join("; ")}${hiddenMeaningCount > 0 ? `; ещё ${hiddenMeaningCount}` : ""}`
      : "перевод пока не сохранён";
    return `${index + 1}. ${truncateCharacters(entry.text, 160)} — ${meaningText}`;
  }).join("\n");
  return [
    `Последние ${entries.length} добавленных слов и фраз:`,
    vocabulary,
    "Хочешь потренировать все или выберешь несколько? Можешь также попросить, например, последние 10.",
  ].join("\n\n");
}
