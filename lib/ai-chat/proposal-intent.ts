export type AiChatProposalToolName =
  | "propose_vocabulary_entries"
  | "propose_vocabulary_state_change";

const ADD_COMMANDS = new Set([
  "add",
  "save",
  "store",
  "добавь",
  "добавьте",
  "добавим",
  "добавляй",
  "добавляйте",
  "сохрани",
  "сохраните",
  "сохраним",
  "сохраняй",
  "сохраняйте",
  "запиши",
  "запишите",
  "запишем",
]);

const STATE_COMMANDS = new Set([
  "delete",
  "mark",
  "move",
  "remove",
  "set",
  "исключи",
  "исключите",
  "отметь",
  "отметьте",
  "перемести",
  "переместите",
  "перенеси",
  "перенесите",
  "пометь",
  "пометьте",
  "поставь",
  "поставьте",
  "убери",
  "уберите",
  "уберем",
  "уберём",
  "удали",
  "удалите",
]);

const PREPARE_COMMANDS = new Set([
  "prepare",
  "подготовь",
  "подготовьте",
]);

const STATE_OPERATION_WORDS = new Set([
  "deletion",
  "removal",
  "removing",
  "удаление",
  "удаления",
]);

const COMMAND_PREFIXES = new Set([
  "да",
  "давай",
  "please",
  "пожалуйста",
]);

const META_OR_NEGATED_LEADS = new Set([
  "don't",
  "dont",
  "explain",
  "how",
  "never",
  "not",
  "what",
  "why",
  "как",
  "не",
  "никогда",
  "объясни",
  "объясните",
  "почему",
]);

const VOCABULARY_OBJECTS = new Set([
  "dictionary",
  "entries",
  "entry",
  "phrases",
  "phrase",
  "terms",
  "term",
  "vocabulary",
  "words",
  "word",
  "словаре",
  "словарь",
  "слова",
  "слово",
  "словом",
  "слов",
  "фраз",
  "фраза",
  "фразе",
  "фразу",
  "фразы",
]);

const REFERENCE_OBJECTS = new Set([
  "it",
  "them",
  "these",
  "those",
  "его",
  "ее",
  "её",
  "их",
  "это",
  "эти",
]);

const PRACTICE_CONTENT_OBJECTS = new Set([
  "answer",
  "answers",
  "example",
  "examples",
  "exercise",
  "exercises",
  "sentence",
  "sentences",
  "text",
  "texts",
  "ответ",
  "ответа",
  "ответы",
  "пример",
  "примера",
  "примеры",
  "предложение",
  "предложения",
  "текст",
  "текста",
  "тексты",
  "упражнение",
  "упражнения",
]);

const DICTIONARY_DESTINATIONS = new Set([
  "dictionary",
  "vocabulary",
  "словаре",
  "словарь",
]);

const STATE_DESTINATIONS = new Set([
  "learned",
  "learning",
  "practice",
  "изучаю",
  "изучение",
  "изучению",
  "практики",
  "практику",
  "выучено",
  "выученные",
]);

const REVOKED_AFTER_COMMAND = new Set([
  "cancel",
  "cancelled",
  "disregard",
  "ignore",
  "отмена",
  "отмени",
  "отмените",
  "передумал",
  "передумала",
  "передумали",
]);

const NEGATED_ACTIONS = new Set([
  "делай",
  "делайте",
  "do",
  "выполняй",
  "выполняйте",
]);

const REMOVAL_COMMANDS = new Set([
  "delete",
  "remove",
  "исключи",
  "исключите",
  "убери",
  "уберите",
  "уберем",
  "уберём",
  "удали",
  "удалите",
]);

const VALUE_PREFIXES = new Set([
  "a",
  "an",
  "english",
  "exactly",
  "five",
  "mixed",
  "one",
  "phrases",
  "phrase",
  "ten",
  "the",
  "these",
  "three",
  "two",
  "words",
  "word",
  "английских",
  "две",
  "два",
  "десять",
  "ещё",
  "еще",
  "из",
  "одну",
  "одно",
  "пять",
  "ровно",
  "слова",
  "слово",
  "смешанную",
  "также",
  "три",
  "фраз",
  "фраза",
  "фразу",
  "фразы",
  "эти",
]);

const EDGE_CHARACTERS = new Set([
  " ", "\t", "\n", "\r", ".", ",", ";", ":", "!", "?",
  "\"", "'", "“", "”", "‘", "’", "«", "»", "(", ")", "[", "]",
]);

const TRANSLATION_SEPARATORS = [" — ", " – ", " -> ", " → ", " = "] as const;

const segmenter = new Intl.Segmenter("und", { granularity: "word" });

type IndexedWord = {
  value: string;
  index: number;
  end: number;
};

function indexedWords(message: string): IndexedWord[] {
  return [...segmenter.segment(message)].flatMap((part) => part.isWordLike
    ? [{
        value: part.segment.toLocaleLowerCase("ru"),
        index: part.index,
        end: part.index + part.segment.length,
      }]
    : []);
}

function wordTokens(message: string) {
  return indexedWords(message.normalize("NFC")).map((part) => part.value);
}

function includesAny(words: readonly string[], values: ReadonlySet<string>) {
  return words.some((word) => values.has(word));
}

function commandIndex(words: readonly string[]) {
  const searchLimit = Math.min(words.length, 6);
  for (let index = 0; index < searchLimit; index += 1) {
    const word = words[index];
    if (
      ADD_COMMANDS.has(word)
      || STATE_COMMANDS.has(word)
      || PREPARE_COMMANDS.has(word)
    ) {
      const leadingWords = words.slice(0, index)
        .filter((leading) => !COMMAND_PREFIXES.has(leading));
      return includesAny(leadingWords, META_OR_NEGATED_LEADS) ? -1 : index;
    }
  }
  return -1;
}

function commandWasRevoked(words: readonly string[], commandIndex: number) {
  const afterCommand = words.slice(commandIndex + 1);
  if (includesAny(afterCommand, REVOKED_AFTER_COMMAND)) return true;
  return afterCommand.some((word, index) => (
    (word === "не" || word === "not" || word === "don't")
    && NEGATED_ACTIONS.has(afterCommand[index + 1] || "")
  ));
}

/**
 * Routes an unmistakable learner command to the proposal-capable model tool.
 * This is only model-call routing: tool execution still creates a pending
 * proposal, and the learner's separate inline confirmation authorizes writes.
 */
export function routeAiChatProposalIntent(
  message: string,
): AiChatProposalToolName | null {
  const words = wordTokens(message);
  const routedCommandIndex = commandIndex(words);
  const command = words[routedCommandIndex];
  if (!command || commandWasRevoked(words, routedCommandIndex)) return null;

  const argumentsWords = words.slice(routedCommandIndex + 1);
  const hasVocabularyObject = includesAny(argumentsWords, VOCABULARY_OBJECTS);
  const hasReferenceObject = includesAny(argumentsWords, REFERENCE_OBJECTS);

  if (ADD_COMMANDS.has(command)) {
    const hasDictionaryDestination = includesAny(
      argumentsWords,
      DICTIONARY_DESTINATIONS,
    );
    const asksForPracticeContent = includesAny(
      argumentsWords,
      PRACTICE_CONTENT_OBJECTS,
    );
    if (asksForPracticeContent && !hasDictionaryDestination) return null;
    return argumentsWords.length > 0
      ? "propose_vocabulary_entries"
      : null;
  }

  if (PREPARE_COMMANDS.has(command)) {
    return includesAny(argumentsWords, STATE_OPERATION_WORDS)
      && (
        hasVocabularyObject
        || hasReferenceObject
        || includesAny(argumentsWords, STATE_DESTINATIONS)
      )
      ? "propose_vocabulary_state_change"
      : null;
  }

  if (STATE_COMMANDS.has(command)) {
    return hasVocabularyObject
      || hasReferenceObject
      || includesAny(argumentsWords, STATE_DESTINATIONS)
      ? "propose_vocabulary_state_change"
      : null;
  }

  return null;
}

type VocabularyStateDestination = "to_learn" | "learning" | "learned" | "removed";

export type AiChatProposalFallback =
  | {
      toolName: "propose_vocabulary_entries";
      input: {
        entries: Array<{ text: string; translation?: string }>;
      };
    }
  | {
      toolName: "propose_vocabulary_state_change";
      input: {
        entries: Array<{ text: string }>;
        destination: VocabularyStateDestination;
      };
    };

function normalizeMessage(message: string) {
  return message.normalize("NFC").trim().replace(/\s+/gu, " ");
}

function trimEdges(value: string) {
  let start = 0;
  let end = value.length;
  while (start < end && EDGE_CHARACTERS.has(value[start])) start += 1;
  while (end > start && EDGE_CHARACTERS.has(value[end - 1])) end -= 1;
  return value.slice(start, end).trim();
}

function stripValuePrefixes(value: string) {
  const words = indexedWords(value);
  let cut = 0;
  for (const word of words) {
    if (!VALUE_PREFIXES.has(word.value)) break;
    cut = word.end;
  }
  return trimEdges(value.slice(cut));
}

function firstSentenceEnd(message: string, start: number) {
  let end = message.length;
  for (const character of [".", "!", "?", "\n"]) {
    const index = message.indexOf(character, start);
    if (index >= 0 && index < end) end = index;
  }
  return end;
}

function splitDelimited(value: string) {
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "," && value[index] !== ";") continue;
    parts.push(value.slice(start, index));
    start = index + 1;
  }
  parts.push(value.slice(start));
  return parts.map(trimEdges).filter(Boolean);
}

function splitStateConjunctions(value: string) {
  const words = indexedWords(value);
  const parts: string[] = [];
  let start = 0;
  for (const word of words) {
    if (word.value !== "и" && word.value !== "and") continue;
    parts.push(value.slice(start, word.index));
    start = word.end;
  }
  parts.push(value.slice(start));
  return parts.map(trimEdges).filter(Boolean);
}

function hasTranslationSeparator(value: string) {
  return TRANSLATION_SEPARATORS.some((separator) => value.includes(separator));
}

function splitTranslatedConjunctions(value: string) {
  const words = indexedWords(value);
  const parts: string[] = [];
  let start = 0;
  for (const word of words) {
    if (word.value !== "и" && word.value !== "and") continue;
    const left = value.slice(start, word.index);
    const right = value.slice(word.end);
    if (!hasTranslationSeparator(left) || !hasTranslationSeparator(right)) continue;
    parts.push(left);
    start = word.end;
  }
  parts.push(value.slice(start));
  return parts.map(trimEdges).filter(Boolean);
}

function splitTranslation(value: string) {
  let selectedIndex = -1;
  let selectedSeparator = "";
  for (const separator of TRANSLATION_SEPARATORS) {
    const index = value.indexOf(separator);
    if (index > 0 && (selectedIndex < 0 || index < selectedIndex)) {
      selectedIndex = index;
      selectedSeparator = separator;
    }
  }
  if (selectedIndex < 0) return { text: trimEdges(value) };
  return {
    text: trimEdges(value.slice(0, selectedIndex)),
    translation: trimEdges(value.slice(selectedIndex + selectedSeparator.length)),
  };
}

function explicitValue(value: string) {
  const cleaned = stripValuePrefixes(value);
  const words = wordTokens(cleaned);
  if (!cleaned || words.length === 0 || [...cleaned].length > 240) return null;
  if (words.every((word) => (
    REFERENCE_OBJECTS.has(word)
    || VOCABULARY_OBJECTS.has(word)
    || VALUE_PREFIXES.has(word)
  ))) return null;
  return cleaned;
}

function destinationFromCommand(command: string, words: readonly IndexedWord[]) {
  if (REMOVAL_COMMANDS.has(command)) return "removed" as const;
  if (PREPARE_COMMANDS.has(command)
    && words.some((word) => STATE_OPERATION_WORDS.has(word.value))) {
    return "removed" as const;
  }
  if (words.some((word) => word.value === "learning" || word.value === "изучаю")) {
    return "learning" as const;
  }
  if (words.some((word) => (
    word.value === "learned" || word.value === "learnt" || word.value === "выучено"
  ))) return "learned" as const;
  if (words.some((word) => word.value === "to_learn" || word.value === "изучению")) {
    return "to_learn" as const;
  }
  return null;
}

function stateBodyEnd(
  message: string,
  words: readonly IndexedWord[],
  startWord: number,
  destination: VocabularyStateDestination,
  sentenceEnd: number,
) {
  for (let index = startWord; index < words.length; index += 1) {
    const word = words[index];
    if (word.index >= sentenceEnd) break;
    if (destination === "removed" && (word.value === "из" || word.value === "from")) {
      const tail = words.slice(index + 1, index + 4).map((part) => part.value);
      if (tail.some((value) => value === "practice" || value === "практики")) {
        return word.index;
      }
    }
    const isDestination = (
      destination === "learning" && (word.value === "learning" || word.value === "изучаю")
    ) || (
      destination === "learned" && ["learned", "learnt", "выучено"].includes(word.value)
    ) || (
      destination === "to_learn" && ["to_learn", "изучению"].includes(word.value)
    );
    if (!isDestination) continue;
    for (let previous = index - 1; previous >= Math.max(startWord, index - 3); previous -= 1) {
      if (["as", "to", "в", "как", "на"].includes(words[previous].value)) {
        return words[previous].index;
      }
    }
    return word.index;
  }
  return sentenceEnd;
}

function parseStateFallback(
  message: string,
  words: readonly IndexedWord[],
  routedCommandIndex: number,
): AiChatProposalFallback | null {
  const command = words[routedCommandIndex]?.value || "";
  const destination = destinationFromCommand(command, words.slice(routedCommandIndex + 1));
  if (!destination) return null;
  const commandWord = words[routedCommandIndex];
  let bodyStart = commandWord.end;
  let firstBodyWord = routedCommandIndex + 1;
  if (PREPARE_COMMANDS.has(command) && STATE_OPERATION_WORDS.has(words[firstBodyWord]?.value)) {
    bodyStart = words[firstBodyWord].end;
    firstBodyWord += 1;
  }
  const sentenceEnd = firstSentenceEnd(message, bodyStart);
  const colon = message.indexOf(":", bodyStart);
  if (colon >= 0 && colon < sentenceEnd) {
    bodyStart = colon + 1;
    firstBodyWord = words.findIndex((word) => word.index >= bodyStart);
  }
  const bodyEnd = stateBodyEnd(
    message,
    words,
    Math.max(firstBodyWord, 0),
    destination,
    sentenceEnd,
  );
  const clauses = splitDelimited(message.slice(bodyStart, bodyEnd))
    .flatMap(splitStateConjunctions);
  const entries = clauses.flatMap((clause) => {
    const text = explicitValue(clause);
    return text ? [{ text }] : [];
  });
  if (entries.length < 1 || entries.length > 10 || entries.length !== clauses.length) {
    return null;
  }
  return {
    toolName: "propose_vocabulary_state_change",
    input: { entries, destination },
  };
}

function addBodyEnd(
  message: string,
  words: readonly IndexedWord[],
  startWord: number,
  sentenceEnd: number,
) {
  for (let index = startWord; index < words.length; index += 1) {
    const word = words[index];
    if (word.index >= sentenceEnd) break;
    if (word.value === "как" || word.value === "as") return word.index;
    if (!DICTIONARY_DESTINATIONS.has(word.value)) continue;
    for (let previous = index - 1; previous >= Math.max(startWord, index - 3); previous -= 1) {
      if (["in", "to", "в"].includes(words[previous].value)) {
        return words[previous].index;
      }
    }
  }
  return sentenceEnd;
}

function parseAddFallback(
  message: string,
  words: readonly IndexedWord[],
  routedCommandIndex: number,
): AiChatProposalFallback | null {
  const commandWord = words[routedCommandIndex];
  let bodyStart = commandWord.end;
  let firstBodyWord = routedCommandIndex + 1;
  const sentenceEnd = firstSentenceEnd(message, bodyStart);
  const colon = message.indexOf(":", bodyStart);
  if (colon >= 0 && colon < sentenceEnd) {
    bodyStart = colon + 1;
    firstBodyWord = words.findIndex((word) => word.index >= bodyStart);
  }
  const bodyEnd = addBodyEnd(message, words, Math.max(firstBodyWord, 0), sentenceEnd);
  const clauses = splitDelimited(message.slice(bodyStart, bodyEnd))
    .flatMap(splitTranslatedConjunctions);
  const entries = clauses.flatMap((clause) => {
    const pair = splitTranslation(stripValuePrefixes(clause));
    const text = explicitValue(pair.text);
    if (!text) return [];
    const translation = pair.translation ? trimEdges(pair.translation) : "";
    if (pair.translation !== undefined && (!translation || [...translation].length > 500)) {
      return [];
    }
    return [{ text, ...(translation ? { translation } : {}) }];
  });
  if (entries.length < 1 || entries.length > 10 || entries.length !== clauses.length) {
    return null;
  }
  return {
    toolName: "propose_vocabulary_entries",
    input: { entries },
  };
}

/**
 * Conservative last-resort arguments for a clear explicit mutation command.
 * The provider remains the primary interpreter. This parser is used only after
 * repeated ignored required-tool calls, and the returned proposal still needs
 * a separate learner confirmation before any write.
 */
export function parseAiChatProposalFallback(
  rawMessage: string,
): AiChatProposalFallback | null {
  const message = normalizeMessage(rawMessage);
  const routedTool = routeAiChatProposalIntent(message);
  if (!routedTool) return null;
  const words = indexedWords(message);
  const routedCommandIndex = commandIndex(words.map((word) => word.value));
  if (routedCommandIndex < 0) return null;
  return routedTool === "propose_vocabulary_entries"
    ? parseAddFallback(message, words, routedCommandIndex)
    : parseStateFallback(message, words, routedCommandIndex);
}
