import {
  AI_CHAT_LIMITS,
  isMeaningMode,
  type AiChatMeaningMode,
} from "./contracts.ts";
import type { AiChatPromptMeaning, AiChatPromptTarget } from "./prompt.ts";

type PracticeMeaningSource = {
  translation: string;
  context?: string;
};

export type AiChatPracticeContextSource = {
  text: string;
  meaningMode: AiChatMeaningMode;
  selectedMeaning: PracticeMeaningSource | null;
  knownMeanings: readonly PracticeMeaningSource[];
};

function truncateCharacters(value: string, maximum: number) {
  return [...value].slice(0, maximum).join("");
}

function cleanText(value: string, maximum: number, singleLine = false) {
  const normalized = singleLine
    ? value.normalize("NFKC").trim().replace(/\s+/gu, " ")
    : value.normalize("NFKC").trim().replace(/\r\n?/gu, "\n");
  return truncateCharacters(normalized, maximum);
}

function snapshotMeaning(meaning: PracticeMeaningSource): AiChatPromptMeaning {
  return {
    translation: cleanText(meaning.translation, AI_CHAT_LIMITS.meaningCharacters, true),
    context: cleanText(meaning.context || "", AI_CHAT_LIMITS.contextCharacters),
  };
}

export function createAiChatPracticeContext(
  items: readonly AiChatPracticeContextSource[],
): AiChatPromptTarget[] {
  return items.slice(0, AI_CHAT_LIMITS.targetCount).map((item) => {
    const text = cleanText(item.text, AI_CHAT_LIMITS.targetTextCharacters, true);
    if (item.meaningMode === "selected") {
      if (!item.selectedMeaning) throw new Error("Selected practice meaning is missing.");
      return {
        text,
        meaningMode: "selected",
        selectedMeaning: snapshotMeaning(item.selectedMeaning),
      };
    }
    return {
      text,
      meaningMode: item.meaningMode,
      knownMeanings: item.knownMeanings
        .slice(0, AI_CHAT_LIMITS.meaningsPerTarget)
        .map(snapshotMeaning),
    };
  });
}

function readStoredText(value: unknown, maximum: number, allowEmpty = false) {
  if (typeof value !== "string") return null;
  const cleaned = value.normalize("NFKC").trim().replace(/\r\n?/gu, "\n");
  if ((!allowEmpty && !cleaned) || [...cleaned].length > maximum) return null;
  return cleaned;
}

function readStoredMeaning(value: unknown): AiChatPromptMeaning | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const meaning = value as Record<string, unknown>;
  if (Object.keys(meaning).some((key) => key !== "translation" && key !== "context")) return null;
  const translation = readStoredText(meaning.translation, AI_CHAT_LIMITS.meaningCharacters);
  const context = meaning.context === undefined
    ? ""
    : readStoredText(meaning.context, AI_CHAT_LIMITS.contextCharacters, true);
  return translation !== null && context !== null ? { translation, context } : null;
}

export function readAiChatPracticeContext(value: unknown): AiChatPromptTarget[] | null {
  if (!Array.isArray(value) || value.length > AI_CHAT_LIMITS.targetCount) return null;
  const targets: AiChatPromptTarget[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const target = candidate as Record<string, unknown>;
    const text = readStoredText(target.text, AI_CHAT_LIMITS.targetTextCharacters);
    if (!text || !isMeaningMode(target.meaningMode)) return null;
    if (target.meaningMode === "selected") {
      if (Object.keys(target).some((key) => !["text", "meaningMode", "selectedMeaning"].includes(key))) {
        return null;
      }
      const selectedMeaning = readStoredMeaning(target.selectedMeaning);
      if (!selectedMeaning) return null;
      targets.push({ text, meaningMode: "selected", selectedMeaning });
      continue;
    }
    if (Object.keys(target).some((key) => !["text", "meaningMode", "knownMeanings"].includes(key))) {
      return null;
    }
    if (!Array.isArray(target.knownMeanings) || target.knownMeanings.length > AI_CHAT_LIMITS.meaningsPerTarget) {
      return null;
    }
    const knownMeanings: AiChatPromptMeaning[] = [];
    for (const meaningValue of target.knownMeanings) {
      const meaning = readStoredMeaning(meaningValue);
      if (!meaning) return null;
      knownMeanings.push(meaning);
    }
    targets.push({ text, meaningMode: target.meaningMode, knownMeanings });
  }
  return targets;
}
