import type { VocabularyCategory } from "../../../vocabulary/contracts.ts";

const WRITE_VERB_PATTERN = [
  "добав(?:ь|ьте|ляй|ляйте|ить|им|имте|лю)",
  "сохран(?:и|ите|яй|яйте|ить|им|ю)",
  "запиш(?:и|ите|ем|у|ите)",
  "обнов(?:и|ите|ляй|ляйте|ить|им|лю)",
  "измен(?:и|ите|яй|яйте|ить|им|ю)",
  "исправ(?:ь|ьте|ляй|ляйте|ить|им|лю)",
  "замен(?:и|ите|яй|яйте|ить|им|ю)",
  "add",
  "save",
  "store",
  "update",
  "change",
  "correct",
  "replace",
].join("|");

const ADD_WRITE_VERB_PATTERN = [
  "добав(?:ь|ьте|ляй|ляйте|ить|им|имте|лю)",
  "сохран(?:и|ите|яй|яйте|ить|им|ю)",
  "запиш(?:и|ите|ем|у|ите)",
  "add",
  "save",
  "store",
].join("|");

const UPDATE_WRITE_VERB_PATTERN = [
  "обнов(?:и|ите|ляй|ляйте|ить|им|лю)",
  "измен(?:и|ите|яй|яйте|ить|им|ю)",
  "исправ(?:ь|ьте|ляй|ляйте|ить|им|лю)",
  "замен(?:и|ите|яй|яйте|ить|им|ю)",
  "update",
  "change",
  "correct",
  "replace",
].join("|");

const VOCABULARY_WRITE_OBJECT_PATTERN = [
  "слов(?:о|а)",
  "фраз(?:а|у|ы)",
  "перевод(?:а|у|ом)?",
  "значени(?:е|я|ю)",
  "смысл",
  "контекст",
  "в\\s+словар(?:ь|е)",
  "words?",
  "phrases?",
  "translations?",
  "meanings?",
  "contexts?",
  "(?:to|in)\\s+(?:my\\s+)?(?:vocabulary|dictionary)",
].join("|");

const DIRECT_VOCABULARY_WRITE_COMMAND = new RegExp(
  `^(?:(?:пожалуйста|please)\\s*[,;:—-]?\\s+|давай\\s+)?(?:${WRITE_VERB_PATTERN})(?:\\s+\\S+){0,4}\\s+(?:${VOCABULARY_WRITE_OBJECT_PATTERN})(?:$|[^\\p{L}])`,
  "iu",
);
const ENTRY_WRITE_OBJECT_PATTERN = [
  "слов(?:о|а)",
  "фраз(?:а|у|ы)",
  "в\\s+словар(?:ь|е)",
  "words?",
  "phrases?",
  "(?:to|in)\\s+(?:my\\s+)?(?:vocabulary|dictionary)",
].join("|");
const MEANING_WRITE_OBJECT_PATTERN = [
  "перевод(?:а|у|ом)?",
  "значени(?:е|я|ю)",
  "смысл",
  "контекст",
  "translations?",
  "meanings?",
  "contexts?",
].join("|");
const DIRECT_ADD_ENTRY_COMMAND = new RegExp(
  `^(?:(?:пожалуйста|please)\\s*[,;:—-]?\\s+|давай\\s+)?(?:${ADD_WRITE_VERB_PATTERN})(?:\\s+\\S+){0,4}\\s+(?:${ENTRY_WRITE_OBJECT_PATTERN})(?:$|[^\\p{L}])`,
  "iu",
);
const DIRECT_ADD_MEANING_COMMAND = new RegExp(
  `^(?:(?:пожалуйста|please)\\s*[,;:—-]?\\s+|давай\\s+)?(?:${ADD_WRITE_VERB_PATTERN})(?:\\s+\\S+){0,4}\\s+(?:${MEANING_WRITE_OBJECT_PATTERN})(?:$|[^\\p{L}])`,
  "iu",
);
const DIRECT_UPDATE_MEANING_COMMAND = new RegExp(
  `^(?:(?:пожалуйста|please)\\s*[,;:—-]?\\s+|давай\\s+)?(?:${UPDATE_WRITE_VERB_PATTERN})(?:\\s+\\S+){0,4}\\s+(?:${MEANING_WRITE_OBJECT_PATTERN})(?:$|[^\\p{L}])`,
  "iu",
);
const PRACTICE_ADD_DESTINATION = /(?:^|[^\p{L}])(?:предложен\p{L}*|пример\p{L}*|упражнен\p{L}*|текст\p{L}*|ответ\p{L}*|sentences?|examples?|exercises?|texts?|answers?)(?:$|[^\p{L}])/iu;
const DICTIONARY_ADD_DESTINATION = /(?:в\s+(?:мой\s+)?словарь|(?:to|in)\s+(?:my\s+)?(?:vocabulary|dictionary))/iu;
const NEGATED_WRITE_VERB = new RegExp(
  `^(?:(?:пожалуйста|please)\\s*[,;:—-]?\\s+)?(?:не|никогда|do\\s+not|don['’]t|never)\\s+(?:\\S+\\s+){0,2}(?:${WRITE_VERB_PATTERN})(?:$|[^\\p{L}])`,
  "iu",
);
// Input is whitespace-normalized before these expressions. Keeping the optional
// prefix to fixed single-space alternatives avoids overlapping unbounded matches.
const NORMALIZED_POLITE_PREFIX_PATTERN =
  "(?:(?:пожалуйста|please)(?: ?[,;:—-])? )?";
const NORMALIZED_COMMAND_PREFIX_PATTERN =
  "(?:(?:пожалуйста|please)(?: ?[,;:—-])? |давай )?";
const DIRECT_ADD_COMMAND = new RegExp(
  `^${NORMALIZED_COMMAND_PREFIX_PATTERN}(?:добав(?:ь|ьте|ляй|ляйте|ить|им|имте|лю)|add)(?:$|[^\\p{L}])`,
  "iu",
);
const LEADING_REVOKED_WRITE_COMMAND = new RegExp(
  `^${NORMALIZED_POLITE_PREFIX_PATTERN}(?:не (?:делай|делайте) (?:этого|это)|не надо|отмен(?:а|и|ите)|передумал(?:а)?|do not do (?:it|that)|don['’]t do (?:it|that)|cancel (?:it|that)|never mind)(?:$|[^\\p{L}])`,
  "iu",
);
const TRAILING_REVOKED_WRITE_COMMAND = /^(?:не (?:делай|делайте) (?:этого|это)|не надо|не выполняй(?:те)?(?: (?:это|этого))?|отмен(?:а|и|ите)|передумал(?:а)?|забудь(?:те)?(?: (?:это|об этом))?|игнорируй(?:те)?(?: (?:это|эту команду))?|do not do (?:it|that)|don['’]t do (?:it|that)|cancel (?:it|that)|never mind|ignore|disregard)(?: (?:this|that)(?: instruction)?| (?:it|that))?$/iu;
const TRAILING_REVOCATION_SEPARATORS = [",", ";", "—", "–"] as const;
const TERMINAL_COMMAND_PUNCTUATION = new Set([".", ",", "?", ";", ":"]);
const TRANSLATION_PAIR_SEPARATORS = ["—", "–", "->", "→", "=", ":"] as const;

export type VocabularyWriteOperation =
  | "add_entry"
  | "add_meaning"
  | "set_category"
  | "update_meaning";

function normalizedCommandText(value: unknown) {
  return typeof value === "string"
    ? value.normalize("NFC").trim().replace(/\s+/gu, " ")
    : "";
}

function hasTrailingRevokedWriteCommand(value: string) {
  const lower = value.toLowerCase();
  let end = lower.length;
  while (end > 0 && ".!?".includes(lower[end - 1])) end -= 1;
  while (end > 0 && lower[end - 1].trim() === "") end -= 1;
  const withoutPunctuation = lower.slice(0, end);
  const separatorIndex = Math.max(...TRAILING_REVOCATION_SEPARATORS.map(
    (separator) => withoutPunctuation.lastIndexOf(separator),
  ));
  if (separatorIndex < 0) return false;
  return TRAILING_REVOKED_WRITE_COMMAND.test(
    withoutPunctuation.slice(separatorIndex + 1).trimStart(),
  );
}

function trimTrailingCommandPunctuation(value: string) {
  let end = value.length;
  while (end > 0) {
    const character = value[end - 1];
    if (!TERMINAL_COMMAND_PUNCTUATION.has(character) && character.trim() !== "") {
      break;
    }
    end -= 1;
  }
  return value.slice(0, end);
}

function splitTranslationPair(value: string): readonly [string, string] | null {
  let selectedIndex = -1;
  let selectedMarker = "";
  for (const separator of TRANSLATION_PAIR_SEPARATORS) {
    const marker = ` ${separator} `;
    const index = value.indexOf(marker);
    if (index > 0 && (selectedIndex < 0 || index < selectedIndex)) {
      selectedIndex = index;
      selectedMarker = marker;
    }
  }
  if (selectedIndex < 0) return null;
  const right = value.slice(selectedIndex + selectedMarker.length);
  return right ? [value.slice(0, selectedIndex), right] : null;
}

const COMMAND_PREFIX_PATTERN = "(?:(?:пожалуйста|please)\\s*[,;:—-]?\\s+|давай\\s+)?";
const ENTRY_VALUE_LABEL_PATTERN = "(?:слов(?:о|а)|фраз(?:а|у|ы)|words?|phrases?)";
const TRANSLATION_VALUE_LABEL_PATTERN = "(?:перевод(?:а|у|ом)?|значени(?:е|я|ю)|смысл|translations?|meanings?)";
const CONTEXT_SEPARATOR_PATTERN = "(?:в\\s+контексте|контекст|with\\s+(?:the\\s+)?context)";

function cleanCommandValue(value: string | undefined) {
  const cleaned = normalizedCommandText(value);
  const quotePairs: Readonly<Record<string, string>> = {
    '"': '"',
    "'": "'",
    "“": "”",
    "‘": "’",
    "«": "»",
  };
  const closingQuote = quotePairs[cleaned[0]];
  if (closingQuote && cleaned.endsWith(closingQuote) && cleaned.length >= 2) {
    return cleaned.slice(1, -1).trim();
  }
  return trimTrailingCommandPunctuation(cleaned);
}

export function exactCommandValue(actual: string | undefined, expected: string) {
  return Boolean(actual) && cleanCommandValue(actual) === cleanCommandValue(expected);
}

function parseContextSuffix(value: string) {
  const match = new RegExp(
    `^(?<value>.+?)\\s+${CONTEXT_SEPARATOR_PATTERN}\\s*[:—–-]?\\s+(?<context>.+)$`,
    "iu",
  ).exec(value);
  return match?.groups
    ? { value: match.groups.value, context: match.groups.context }
    : { value, context: undefined };
}

export function parseAddEntryCommands(message: string) {
  const normalized = normalizedCommandText(message);
  const match = new RegExp(
    `^${COMMAND_PREFIX_PATTERN}(?:${ADD_WRITE_VERB_PATTERN})(?:\\s+\\S+){0,3}\\s+(?<body>${ENTRY_VALUE_LABEL_PATTERN}\\s+.+?)(?:\\s+(?:в\\s+(?:мой\\s+)?словарь|(?:to|in)\\s+(?:my\\s+)?(?:vocabulary|dictionary)))?[.!?]?$`,
    "iu",
  ).exec(normalized);
  if (!match?.groups?.body) return [];
  const clauses = match.groups.body.split(new RegExp(
    `\\s+(?:и|and)\\s+(?=${ENTRY_VALUE_LABEL_PATTERN}\\s+)`,
    "iu",
  ));
  return clauses.flatMap((clause) => {
    const entry = new RegExp(
      `^${ENTRY_VALUE_LABEL_PATTERN}\\s+(?<body>.+)$`,
      "iu",
    ).exec(clause);
    if (!entry?.groups?.body) return [];
    const withContext = parseContextSuffix(entry.groups.body);
    const values = splitTranslationPair(withContext.value);
    return [{
      text: values?.[0] || withContext.value,
      translation: values?.[1],
      context: withContext.context,
    }];
  });
}

export function parseAddMeaningCommand(message: string) {
  const normalized = normalizedCommandText(message);
  const match = new RegExp(
    `^${COMMAND_PREFIX_PATTERN}(?:${ADD_WRITE_VERB_PATTERN})\\s+(?:к|для|to|for)\\s+(?<entry>.+?)\\s+${TRANSLATION_VALUE_LABEL_PATTERN}\\s*[:—–-]?\\s+(?<body>.+?)[.!?]?$`,
    "iu",
  ).exec(normalized);
  if (!match?.groups?.entry || !match.groups.body) return null;
  const withContext = parseContextSuffix(match.groups.body);
  return {
    entry: match.groups.entry,
    translation: withContext.value,
    context: withContext.context,
  };
}

export function parseUpdateMeaningCommand(message: string) {
  const normalized = normalizedCommandText(message);
  const russianOwner = new RegExp(
    `^${COMMAND_PREFIX_PATTERN}(?:${UPDATE_WRITE_VERB_PATTERN})(?:\\s+\\S+){0,2}\\s+у\\s+(?<entry>.+?)\\s+${TRANSLATION_VALUE_LABEL_PATTERN}\\s+(?<old>.+?)\\s+(?:на|->|→)\\s+(?<body>.+?)[.!?]?$`,
    "iu",
  ).exec(normalized);
  const russianFrom = new RegExp(
    `^${COMMAND_PREFIX_PATTERN}(?:${UPDATE_WRITE_VERB_PATTERN})(?:\\s+\\S+){0,2}\\s+${TRANSLATION_VALUE_LABEL_PATTERN}\\s+(?<entry>.+?)\\s+с\\s+(?<old>.+?)\\s+(?:на|->|→)\\s+(?<body>.+?)[.!?]?$`,
    "iu",
  ).exec(normalized);
  const english = new RegExp(
    `^${COMMAND_PREFIX_PATTERN}(?:${UPDATE_WRITE_VERB_PATTERN})(?:\\s+\\S+){0,2}\\s+${TRANSLATION_VALUE_LABEL_PATTERN}(?:\\s+(?:of|for))?\\s+(?<entry>.+?)\\s+from\\s+(?<old>.+?)\\s+to\\s+(?<body>.+?)[.!?]?$`,
    "iu",
  ).exec(normalized);
  const match = russianOwner || russianFrom || english;
  if (!match?.groups?.entry || !match.groups.old || !match.groups.body) return null;
  const withContext = parseContextSuffix(match.groups.body);
  return {
    entry: match.groups.entry,
    oldTranslation: match.groups.old,
    translation: withContext.value,
    context: withContext.context,
  };
}

const CATEGORY_VALUE_PATTERN = [
  "to\\s+learn",
  "to_learn",
  "learning",
  "learned",
  "learnt",
  "к\\s+изучению",
  "на\\s+изучение",
  "изучаю",
  "в\\s+процессе",
  "выучено",
].join("|");
const CATEGORY_COMMAND_VERB_PATTERN = [
  "перемест(?:и|ите)",
  "перенес(?:и|ите)",
  "помет(?:ь|ьте)",
  "отмет(?:ь|ьте)",
  "постав(?:ь|ьте)",
  "move",
  "mark",
  "set",
].join("|");

function vocabularyCategoryFromCommand(value: string): VocabularyCategory | null {
  const normalized = normalizedCommandText(value).toLowerCase();
  if (normalized === "to learn" || normalized === "to_learn"
    || normalized === "к изучению" || normalized === "на изучение") {
    return "to_learn";
  }
  if (normalized === "learning" || normalized === "изучаю"
    || normalized === "в процессе") {
    return "learning";
  }
  if (normalized === "learned" || normalized === "learnt" || normalized === "выучено") {
    return "learned";
  }
  return null;
}

export function parseSetCategoryCommand(message: string) {
  const normalized = normalizedCommandText(message);
  if (
    !normalized
    || NEGATED_WRITE_VERB.test(normalized)
    || LEADING_REVOKED_WRITE_COMMAND.test(normalized)
    || hasTrailingRevokedWriteCommand(normalized)
  ) {
    return null;
  }
  const categoryChangePatterns = [
    `^${COMMAND_PREFIX_PATTERN}(?:измен(?:и|ите)|поменяй(?:те)?|установ(?:и|ите))\\s+категори(?:ю|и)\\s+(?:(?:слов(?:а|о)|фраз(?:ы|у))\\s+)?(?<entry>.+?)\\s+(?:на|в)\\s+(?<category>${CATEGORY_VALUE_PATTERN})[.!?]?$`,
    `^${COMMAND_PREFIX_PATTERN}(?:change|set)\\s+(?:the\\s+)?category\\s+(?:of|for)\\s+(?<entry>.+?)\\s+to\\s+(?<category>${CATEGORY_VALUE_PATTERN})[.!?]?$`,
    `^${COMMAND_PREFIX_PATTERN}(?:change|set)\\s+(?<entry>.+?)(?:['’]s)\\s+category\\s+to\\s+(?<category>${CATEGORY_VALUE_PATTERN})[.!?]?$`,
    `^${COMMAND_PREFIX_PATTERN}(?:${CATEGORY_COMMAND_VERB_PATTERN})\\s+(?:(?:the\\s+)?(?:слов(?:о|а)|фраз(?:а|у|ы)|words?|phrases?)\\s+)?(?<entry>.+?)\\s+(?:в|как|to|as)\\s+(?<category>${CATEGORY_VALUE_PATTERN})[.!?]?$`,
  ];
  const match = categoryChangePatterns
    .map((pattern) => new RegExp(pattern, "iu").exec(normalized))
    .find(Boolean);
  if (!match?.groups?.entry || !match.groups.category) return null;
  const category = vocabularyCategoryFromCommand(match.groups.category);
  return category ? { entry: match.groups.entry, category } : null;
}

export function optionalCommandValueMatches(actual: string | undefined, expected: string | undefined) {
  return actual === undefined
    ? expected === undefined
    : exactCommandValue(actual, expected || "");
}

export function isExplicitVocabularyWriteOperation(
  message: string,
  operation: VocabularyWriteOperation,
) {
  const normalized = normalizedCommandText(message);
  if (
    !normalized
    || NEGATED_WRITE_VERB.test(normalized)
    || LEADING_REVOKED_WRITE_COMMAND.test(normalized)
    || hasTrailingRevokedWriteCommand(normalized)
  ) {
    return false;
  }
  if (operation === "add_entry") {
    const ambiguousPracticeAdd = DIRECT_ADD_COMMAND.test(normalized)
      && PRACTICE_ADD_DESTINATION.test(normalized)
      && !DICTIONARY_ADD_DESTINATION.test(normalized);
    return DIRECT_ADD_ENTRY_COMMAND.test(normalized) && !ambiguousPracticeAdd;
  }
  if (operation === "set_category") {
    return Boolean(parseSetCategoryCommand(normalized));
  }
  return operation === "add_meaning"
    ? DIRECT_ADD_MEANING_COMMAND.test(normalized)
    : DIRECT_UPDATE_MEANING_COMMAND.test(normalized);
}

export function isExplicitVocabularyWriteRequest(message: string) {
  const normalized = normalizedCommandText(message);
  const ambiguousPracticeAdd = DIRECT_ADD_COMMAND.test(normalized)
    && PRACTICE_ADD_DESTINATION.test(normalized)
    && !DICTIONARY_ADD_DESTINATION.test(normalized);
  return Boolean(normalized)
    && (DIRECT_VOCABULARY_WRITE_COMMAND.test(normalized)
      || Boolean(parseSetCategoryCommand(normalized)))
    && !ambiguousPracticeAdd
    && !NEGATED_WRITE_VERB.test(normalized)
    && !LEADING_REVOKED_WRITE_COMMAND.test(normalized)
    && !hasTrailingRevokedWriteCommand(normalized);
}
