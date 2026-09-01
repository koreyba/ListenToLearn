import {
  isVocabularyStateDestination,
  normalizeVocabularyMeaning,
  scopedLegacyMeaningId,
  vocabularyCategoryFromStatus,
  VOCABULARY_LIMITS,
  type VocabularyStatus,
  type VocabularyStateDestination,
} from "./contracts.ts";
import { buildVocabularyChangeSetMutationPlan } from "./change-set-plan-builder.ts";
import type {
  VocabularyMutationPlan,
  VocabularyMutationPlanReason,
} from "./mutations.ts";

export const VOCABULARY_CHANGE_SET_OPERATION = "vocabulary.change-set/v1" as const;
export const VOCABULARY_CHANGE_SET_LIMIT = 30;
const VOCABULARY_CHANGE_SET_CANONICAL_JSON_LIMIT = 3_600;
const ACTIVE_STATUS_SQL = "'to_learn', 'learning_now', 'learnt', 'learned'";
const ACTIVE_STATUSES = new Set<VocabularyStatus>([
  "to_learn",
  "learning_now",
  "learnt",
  "learned",
]);

export type VocabularyChangeSetRequestedAction =
  | {
      action: "add_entry";
      text: string;
      translation?: string;
      context?: string;
    }
  | {
      action: "add_meaning";
      text: string;
      translation: string;
      context?: string;
    }
  | {
      action: "update_meaning";
      text: string;
      currentTranslation?: string;
      translation: string;
      context?: string;
    }
  | {
      action: "change_state";
      text: string;
      destination: VocabularyStateDestination;
    }
  | {
      action: "change_recent_state";
      count: number;
      destination: VocabularyStateDestination;
    };

export type VocabularyChangeSetInput = {
  changes: VocabularyChangeSetRequestedAction[];
};

type VocabularyChangeSetAddAction = [
  "add",
  phraseId: string,
  text: string,
  sourceType: "preset" | "custom" | null,
  expectedStatus: VocabularyStatus | null,
  translation: string | null,
  normalizedTranslation: string | null,
  context: string | null,
  meaningId: string | null,
  expectedMeaningTranslation: string | null,
  expectedMeaningContext: string | null,
];

type VocabularyChangeSetAddMeaningAction = [
  "meaning+",
  phraseId: string,
  sourceType: "preset" | "custom",
  expectedStatus: VocabularyStatus,
  translation: string,
  normalizedTranslation: string,
  context: string,
  meaningId: string,
  expectedMeaningTranslation: string | null,
  expectedMeaningContext: string | null,
];

type VocabularyChangeSetUpdateMeaningAction = [
  "meaning~",
  phraseId: string,
  sourceType: "preset" | "custom",
  expectedStatus: VocabularyStatus,
  meaningId: string,
  meaningSource: "personal" | "legacy",
  expectedTranslation: string,
  expectedContext: string,
  translation: string,
  normalizedTranslation: string,
  context: string,
  resultMeaningId: string,
];

type VocabularyChangeSetStateAction = [
  "state",
  phraseId: string,
  sourceType: "preset" | "custom",
  expectedStatus: VocabularyStatus,
  destination: VocabularyStateDestination,
];

export type VocabularyChangeSetAction =
  | VocabularyChangeSetAddAction
  | VocabularyChangeSetAddMeaningAction
  | VocabularyChangeSetUpdateMeaningAction
  | VocabularyChangeSetStateAction;

export type VocabularyChangeSetMutationArgs = {
  v: 1;
  actions: VocabularyChangeSetAction[];
};

export type VocabularyChangeSetMutationResult = {
  ok: true;
  applied: true;
  count: number;
};

export type VocabularyChangeSetPublicItem = {
  id: string;
  actionType: Exclude<VocabularyChangeSetRequestedAction["action"], "change_recent_state">;
  text: string;
  translation?: string;
  context?: string;
  previousTranslation?: string;
  fromCategory?: string;
  toCategory?: string;
};

type VocabularyChangeSetMeaningSnapshot = {
  id: string;
  translation: string;
  normalizedTranslation: string;
  context: string;
};

type VocabularyChangeSetTargetRow = {
  ordinal: number;
  action: string;
  requested_text: string;
  current_translation: string | null;
  phrase_id: string | null;
  phrase_text: string | null;
  phrase_translation: string | null;
  phrase_context: string | null;
  source_type: "preset" | "custom" | null;
  status: VocabularyStatus | null;
  meanings_json: string;
};

type VocabularyChangeSetRecentRow = {
  phrase_id: string;
  text: string;
  source_type: "preset" | "custom";
  status: VocabularyStatus;
};

type VocabularyChangeSetPlannerOptions = {
  createId: (kind: "meaning" | "phrase") => string;
  now: () => string;
  invalid: (message: string, reason?: VocabularyMutationPlanReason) => never;
};

function assertUserId(
  userId: string,
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
) {
  if (typeof userId !== "string" || !userId.trim()) {
    invalid("User identity is invalid.");
  }
}

function cleanSingleLine(
  value: unknown,
  maximum: number,
  label: string,
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
) {
  if (typeof value !== "string") invalid(`${label} is invalid.`);
  const cleaned = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (!cleaned || [...cleaned].length > maximum) {
    invalid(`${label} is invalid.`);
  }
  return cleaned;
}

function cleanOptionalSingleLine(
  value: unknown,
  maximum: number,
  label: string,
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
) {
  if (value === undefined || value === null || value === "") return undefined;
  return cleanSingleLine(value, maximum, label, invalid);
}

function cleanOptionalContext(
  value: unknown,
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") invalid("Vocabulary context is invalid.");
  const cleaned = value.normalize("NFC").trim().replace(/\r\n?/gu, "\n");
  if ([...cleaned].length > VOCABULARY_LIMITS.contextCharacters) {
    invalid("Vocabulary context is invalid.");
  }
  return cleaned;
}

function withOptionalContext<Required extends object>(
  required: Required,
  context: string | undefined,
) {
  return {
    ...required,
    ...(context === undefined ? {} : { context }),
  };
}

function rejectChangeSet(
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
  message: string,
  reason?: VocabularyMutationPlanReason,
): never {
  return invalid(message, reason);
}

function isSourceType(value: unknown): value is "preset" | "custom" {
  return value === "preset" || value === "custom";
}

function isStoredStatus(value: unknown): value is VocabularyStatus {
  return typeof value === "string"
    && (ACTIVE_STATUSES.has(value as VocabularyStatus) || value === "pick");
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function canonicalAddActionIsValid(action: unknown[]) {
  return action.length === 11
    && typeof action[1] === "string" && Boolean(action[1])
    && typeof action[2] === "string" && Boolean(action[2])
    && (action[3] === null || isSourceType(action[3]))
    && (action[4] === null || isStoredStatus(action[4]))
    && action.slice(5).every(isNullableString);
}

function canonicalAddMeaningActionIsValid(action: unknown[]) {
  return action.length === 10
    && typeof action[1] === "string" && Boolean(action[1])
    && isSourceType(action[2])
    && isStoredStatus(action[3]) && ACTIVE_STATUSES.has(action[3])
    && action.slice(4, 8).every((value) => typeof value === "string")
    && action.slice(8).every(isNullableString);
}

function canonicalUpdateMeaningActionIsValid(action: unknown[]) {
  return action.length === 12
    && typeof action[1] === "string" && Boolean(action[1])
    && isSourceType(action[2])
    && isStoredStatus(action[3]) && ACTIVE_STATUSES.has(action[3])
    && typeof action[4] === "string" && Boolean(action[4])
    && (action[5] === "personal" || action[5] === "legacy")
    && action.slice(6).every((value) => typeof value === "string");
}

function canonicalStateActionIsValid(action: unknown[]) {
  return action.length === 5
    && typeof action[1] === "string" && Boolean(action[1])
    && isSourceType(action[2])
    && isStoredStatus(action[3]) && ACTIVE_STATUSES.has(action[3])
    && isVocabularyStateDestination(action[4]);
}

function canonicalActionIsValid(action: unknown): action is VocabularyChangeSetAction {
  if (!Array.isArray(action)) return false;
  switch (action[0]) {
    case "add":
      return canonicalAddActionIsValid(action);
    case "meaning+":
      return canonicalAddMeaningActionIsValid(action);
    case "meaning~":
      return canonicalUpdateMeaningActionIsValid(action);
    case "state":
      return canonicalStateActionIsValid(action);
    default:
      return false;
  }
}

function readCanonicalVocabularyChangeSet(
  input: VocabularyChangeSetInput | VocabularyChangeSetMutationArgs,
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
) {
  if (
    !input
    || typeof input !== "object"
    || !("actions" in input)
  ) {
    return null;
  }
  if (
    input.v !== 1
    || !Array.isArray(input.actions)
    || input.actions.length < 1
    || input.actions.length > VOCABULARY_CHANGE_SET_LIMIT
    || !input.actions.every(canonicalActionIsValid)
  ) {
    rejectChangeSet(invalid, "Vocabulary change-set is invalid.");
  }
  return input.actions.map((action) => [...action]) as VocabularyChangeSetAction[];
}

type ParsedRequestedChange = {
  change: VocabularyChangeSetRequestedAction;
  recent: boolean;
  weight: number;
};

function parseRecentStateChange(
  raw: Extract<VocabularyChangeSetRequestedAction, { action: "change_recent_state" }>,
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
): ParsedRequestedChange {
  if (
    !Number.isSafeInteger(raw.count)
    || raw.count < 1
    || raw.count > VOCABULARY_CHANGE_SET_LIMIT
    || !isVocabularyStateDestination(raw.destination)
  ) {
    rejectChangeSet(invalid, "Recent vocabulary change is invalid.");
  }
  return {
    change: {
      action: raw.action,
      count: raw.count,
      destination: raw.destination,
    },
    recent: true,
    weight: raw.count,
  };
}

function parseStateChange(
  raw: Extract<VocabularyChangeSetRequestedAction, { action: "change_state" }>,
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
) {
  if (!isVocabularyStateDestination(raw.destination)) {
    rejectChangeSet(invalid, "Vocabulary destination is invalid.");
  }
  return {
    action: raw.action,
    text: cleanSingleLine(
      raw.text,
      VOCABULARY_LIMITS.entryTextCharacters,
      "Vocabulary text",
      invalid,
    ),
    destination: raw.destination,
  } satisfies VocabularyChangeSetRequestedAction;
}

function parseMeaningChange(
  raw: Extract<
    VocabularyChangeSetRequestedAction,
    { action: "add_entry" | "add_meaning" | "update_meaning" }
  >,
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
) {
  const text = cleanSingleLine(
    raw.text,
    VOCABULARY_LIMITS.entryTextCharacters,
    "Vocabulary text",
    invalid,
  );
  const translation = raw.action === "add_entry"
    ? cleanOptionalSingleLine(
        raw.translation,
        VOCABULARY_LIMITS.meaningCharacters,
        "Vocabulary translation",
        invalid,
      )
    : cleanSingleLine(
        raw.translation,
        VOCABULARY_LIMITS.meaningCharacters,
        "Vocabulary translation",
        invalid,
      );
  const context = cleanOptionalContext(raw.context, invalid);
  if (raw.action !== "update_meaning") {
    return withOptionalContext({
      action: raw.action,
      text,
      ...(translation === undefined ? {} : { translation }),
    }, context) as VocabularyChangeSetRequestedAction;
  }
  if (translation === undefined) {
    rejectChangeSet(invalid, "Vocabulary translation is invalid.");
  }
  const currentTranslation = cleanOptionalSingleLine(
    raw.currentTranslation,
    VOCABULARY_LIMITS.meaningCharacters,
    "Current vocabulary translation",
    invalid,
  );
  return withOptionalContext({
    action: raw.action,
    text,
    ...(currentTranslation === undefined ? {} : { currentTranslation }),
    translation,
  }, context);
}

function parseRequestedVocabularyChange(
  raw: VocabularyChangeSetRequestedAction,
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
): ParsedRequestedChange {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    rejectChangeSet(invalid, "Vocabulary change is invalid.");
  }
  if (raw.action === "change_recent_state") {
    return parseRecentStateChange(raw, invalid);
  }
  if (raw.action === "change_state") {
    return { change: parseStateChange(raw, invalid), recent: false, weight: 1 };
  }
  if (
    raw.action === "add_entry"
    || raw.action === "add_meaning"
    || raw.action === "update_meaning"
  ) {
    return { change: parseMeaningChange(raw, invalid), recent: false, weight: 1 };
  }
  return rejectChangeSet(invalid, "Vocabulary change is invalid.");
}

function parseRequestedVocabularyChanges(
  input: VocabularyChangeSetInput | VocabularyChangeSetMutationArgs,
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
) {
  if (
    !input
    || typeof input !== "object"
    || !("changes" in input)
    || !Array.isArray(input.changes)
    || input.changes.length < 1
  ) {
    rejectChangeSet(invalid, "Vocabulary change-set is invalid.");
  }

  const requested: VocabularyChangeSetRequestedAction[] = [];
  let concreteCount = 0;
  let recentActionCount = 0;
  for (const raw of input.changes) {
    const parsed = parseRequestedVocabularyChange(raw, invalid);
    if (parsed.recent) recentActionCount += 1;
    if (recentActionCount > 1) {
      rejectChangeSet(invalid, "Recent vocabulary change is invalid.");
    }
    concreteCount += parsed.weight;
    requested.push(parsed.change);
  }
  if (concreteCount < 1 || concreteCount > VOCABULARY_CHANGE_SET_LIMIT) {
    rejectChangeSet(
      invalid,
      "Vocabulary change-set exceeds its concrete action limit.",
      "change_limit_exceeded",
    );
  }
  return requested;
}

async function loadVocabularyChangeSetSnapshots({
  db,
  invalid,
  requested,
  userId,
}: {
  db: D1Database;
  invalid: VocabularyChangeSetPlannerOptions["invalid"];
  requested: VocabularyChangeSetRequestedAction[];
  userId: string;
}) {
const explicitRequests = requested.flatMap((change, ordinal) => (
  change.action === "change_recent_state"
    ? []
    : [{ ordinal, ...change }]
));
const explicitRows = new Map<number, VocabularyChangeSetTargetRow>();
if (explicitRequests.length > 0) {
  const result = await db.prepare(`
    WITH requested AS (
      SELECT
        CAST(key AS INTEGER) AS row_number,
        CAST(json_extract(value, '$.ordinal') AS INTEGER) AS ordinal,
        json_extract(value, '$.action') AS action,
        json_extract(value, '$.text') AS requested_text,
        json_extract(value, '$.currentTranslation') AS current_translation
      FROM json_each(?)
    )
    SELECT
      requested.ordinal,
      requested.action,
      requested.requested_text,
      requested.current_translation,
      phrases.id AS phrase_id,
      phrases.text AS phrase_text,
      phrases.translation AS phrase_translation,
      phrases.context AS phrase_context,
      phrases.source_type,
      progress.status,
      COALESCE((
        SELECT json_group_array(json_object(
          'id', meanings.id,
          'translation', meanings.translation,
          'normalizedTranslation', meanings.normalized_translation,
          'context', meanings.context
        ))
        FROM phrase_meanings AS meanings
        WHERE meanings.user_id = ? AND meanings.phrase_id = phrases.id
      ), '[]') AS meanings_json
    FROM requested
    LEFT JOIN phrases ON phrases.id = (
      SELECT candidate.id
      FROM phrases AS candidate
      WHERE candidate.text = requested.requested_text COLLATE NOCASE
        AND (candidate.source_type = 'preset' OR candidate.owner_id = ?)
      ORDER BY CASE WHEN candidate.owner_id = ? THEN 0 ELSE 1 END, candidate.id
      LIMIT 1
    )
    LEFT JOIN phrase_progress AS progress
      ON progress.phrase_id = phrases.id AND progress.user_id = ?
    ORDER BY requested.row_number
  `).bind(
    JSON.stringify(explicitRequests),
    userId,
    userId,
    userId,
    userId,
  ).all<VocabularyChangeSetTargetRow>();
  for (const row of result.results || []) explicitRows.set(Number(row.ordinal), row);
}

const requestedRecent = requested.find((change) => change.action === "change_recent_state");
let recentRows: VocabularyChangeSetRecentRow[] = [];
if (requestedRecent?.action === "change_recent_state") {
  const result = await db.prepare(`
    SELECT
      phrases.id AS phrase_id,
      phrases.text,
      phrases.source_type,
      progress.status
    FROM phrase_progress AS progress
    JOIN phrases ON phrases.id = progress.phrase_id
    WHERE progress.user_id = ?
      AND progress.status IN (${ACTIVE_STATUS_SQL})
      AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
    ORDER BY julianday(progress.created_at) DESC, phrases.id DESC
    LIMIT ?
  `).bind(userId, userId, requestedRecent.count).all<VocabularyChangeSetRecentRow>();
  recentRows = result.results || [];
  if (recentRows.length !== requestedRecent.count) {
    rejectChangeSet(invalid, "Not enough recent vocabulary entries exist.", "missing_target");
  }
}

  return { explicitRows, recentRows };
}

type ActiveVocabularyChangeSetTargetRow = VocabularyChangeSetTargetRow & {
  phrase_id: string;
  source_type: "preset" | "custom";
  status: VocabularyStatus;
};

type ResolvedVocabularyChange = {
  action: VocabularyChangeSetAction;
  publicItem: Omit<VocabularyChangeSetPublicItem, "id">;
};

function parseVocabularyChangeSetMeanings(row: VocabularyChangeSetTargetRow) {
  try {
    const parsed = JSON.parse(row.meanings_json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is VocabularyChangeSetMeaningSnapshot => (
      Boolean(value)
      && typeof value === "object"
      && typeof (value as VocabularyChangeSetMeaningSnapshot).id === "string"
      && typeof (value as VocabularyChangeSetMeaningSnapshot).translation === "string"
      && typeof (value as VocabularyChangeSetMeaningSnapshot).normalizedTranslation === "string"
      && typeof (value as VocabularyChangeSetMeaningSnapshot).context === "string"
    ));
  } catch {
    return [];
  }
}

function requireActiveVocabularyTarget(
  row: VocabularyChangeSetTargetRow,
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
): asserts row is ActiveVocabularyChangeSetTargetRow {
  if (
    !row.phrase_id
    || !row.source_type
    || !row.status
    || !ACTIVE_STATUSES.has(row.status)
  ) {
    rejectChangeSet(invalid, "Vocabulary target is missing or inactive.", "missing_target");
  }
}

function resolveStateChange(
  target: VocabularyChangeSetRecentRow,
  destination: VocabularyStateDestination,
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
): ResolvedVocabularyChange {
  if (!ACTIVE_STATUSES.has(target.status)) {
    rejectChangeSet(invalid, "Vocabulary state target is not active.", "missing_target");
  }
  return {
    action: [
      "state",
      target.phrase_id,
      target.source_type,
      target.status,
      destination,
    ],
    publicItem: {
      actionType: "change_state",
      text: target.text,
      fromCategory: vocabularyCategoryFromStatus(target.status),
      toCategory: destination,
    },
  };
}

function resolveAddEntryChange(
  change: Extract<VocabularyChangeSetRequestedAction, { action: "add_entry" }>,
  row: VocabularyChangeSetTargetRow,
  meanings: VocabularyChangeSetMeaningSnapshot[],
  createId: VocabularyChangeSetPlannerOptions["createId"],
): ResolvedVocabularyChange {
  const translation = change.translation;
  const normalizedTranslation = translation
    ? normalizeVocabularyMeaning(translation)
    : null;
  const existingMeaning = normalizedTranslation
    ? meanings.find((meaning) => meaning.normalizedTranslation === normalizedTranslation)
    : undefined;
  const context = translation
    ? (change.context
      ?? existingMeaning?.context
      ?? (row.source_type === "custom" && !(row.phrase_translation || "").trim()
        ? row.phrase_context || ""
        : ""))
    : (change.context ?? "");
  return {
    action: [
      "add",
      row.phrase_id || createId("phrase"),
      change.text,
      row.source_type,
      row.status,
      translation || null,
      normalizedTranslation,
      context,
      translation ? (existingMeaning?.id || createId("meaning")) : null,
      existingMeaning?.translation || null,
      existingMeaning?.context || null,
    ],
    publicItem: {
      actionType: "add_entry",
      text: change.text,
      ...(translation ? { translation } : {}),
      ...(change.context === undefined ? {} : { context: change.context }),
    },
  };
}

function resolveAddMeaningChange(
  change: Extract<VocabularyChangeSetRequestedAction, { action: "add_meaning" }>,
  row: ActiveVocabularyChangeSetTargetRow,
  meanings: VocabularyChangeSetMeaningSnapshot[],
  createId: VocabularyChangeSetPlannerOptions["createId"],
): ResolvedVocabularyChange {
  const normalizedTranslation = normalizeVocabularyMeaning(change.translation);
  const existingMeaning = meanings.find(
    (meaning) => meaning.normalizedTranslation === normalizedTranslation,
  );
  const context = change.context ?? existingMeaning?.context ?? "";
  return {
    action: [
      "meaning+",
      row.phrase_id,
      row.source_type,
      row.status,
      change.translation,
      normalizedTranslation,
      context,
      existingMeaning?.id || createId("meaning"),
      existingMeaning?.translation || null,
      existingMeaning?.context || null,
    ],
    publicItem: {
      actionType: "add_meaning",
      text: row.phrase_text || change.text,
      translation: change.translation,
      ...(change.context === undefined ? {} : { context: change.context }),
    },
  };
}

function vocabularyMeaningCandidates(
  row: ActiveVocabularyChangeSetTargetRow,
  meanings: VocabularyChangeSetMeaningSnapshot[],
) {
  const candidates: Array<VocabularyChangeSetMeaningSnapshot & {
    source: "personal" | "legacy";
  }> = meanings.map((meaning) => ({ ...meaning, source: "personal" as const }));
  if ((row.phrase_translation || "").trim()) {
    candidates.unshift({
      id: scopedLegacyMeaningId(row.phrase_id),
      source: "legacy",
      translation: row.phrase_translation || "",
      normalizedTranslation: normalizeVocabularyMeaning(row.phrase_translation),
      context: row.phrase_context || "",
    });
  }
  return candidates;
}

function resolveUpdateMeaningChange(
  change: Extract<VocabularyChangeSetRequestedAction, { action: "update_meaning" }>,
  row: ActiveVocabularyChangeSetTargetRow,
  meanings: VocabularyChangeSetMeaningSnapshot[],
  createId: VocabularyChangeSetPlannerOptions["createId"],
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
): ResolvedVocabularyChange {
  const availableMeanings = vocabularyMeaningCandidates(row, meanings);
  const candidates = change.currentTranslation
    ? availableMeanings.filter((meaning) => (
        meaning.normalizedTranslation === normalizeVocabularyMeaning(change.currentTranslation)
      ))
    : availableMeanings;
  if (candidates.length !== 1) {
    rejectChangeSet(invalid, "Vocabulary meaning target is ambiguous.", "ambiguous_meaning");
  }
  const selected = candidates[0];
  if (selected.source === "legacy" && row.source_type === "preset") {
    rejectChangeSet(invalid, "Shared preset meanings cannot be edited.", "unsupported_change");
  }
  const normalizedTranslation = normalizeVocabularyMeaning(change.translation);
  if (meanings.some((meaning) => (
    meaning.id !== selected.id
    && meaning.normalizedTranslation === normalizedTranslation
  ))) {
    rejectChangeSet(
      invalid,
      "Vocabulary meaning update conflicts with another meaning.",
      "conflicting_changes",
    );
  }
  const context = change.context ?? selected.context;
  return {
    action: [
      "meaning~",
      row.phrase_id,
      row.source_type,
      row.status,
      selected.id,
      selected.source,
      selected.translation,
      selected.context,
      change.translation,
      normalizedTranslation,
      context,
      selected.source === "personal" ? selected.id : createId("meaning"),
    ],
    publicItem: {
      actionType: "update_meaning",
      text: row.phrase_text || change.text,
      previousTranslation: selected.translation,
      translation: change.translation,
      ...(change.context === undefined ? {} : { context: change.context }),
    },
  };
}

function appendResolvedVocabularyChange(
  result: ResolvedVocabularyChange,
  actions: VocabularyChangeSetAction[],
  publicItems: VocabularyChangeSetPublicItem[],
) {
  actions.push(result.action);
  publicItems.push({
    id: `change-${publicItems.length + 1}`,
    ...result.publicItem,
  });
}

function resolveVocabularyChangeSet({
  createId,
  explicitRows,
  invalid,
  recentRows,
  requested,
}: {
  createId: VocabularyChangeSetPlannerOptions["createId"];
  explicitRows: Map<number, VocabularyChangeSetTargetRow>;
  invalid: VocabularyChangeSetPlannerOptions["invalid"];
  recentRows: VocabularyChangeSetRecentRow[];
  requested: VocabularyChangeSetRequestedAction[];
}) {
  const actions: VocabularyChangeSetAction[] = [];
  const publicItems: VocabularyChangeSetPublicItem[] = [];
  for (let ordinal = 0; ordinal < requested.length; ordinal += 1) {
    const change = requested[ordinal];
    if (change.action === "change_recent_state") {
      for (const target of recentRows) {
        appendResolvedVocabularyChange(
          resolveStateChange(target, change.destination, invalid),
          actions,
          publicItems,
        );
      }
      continue;
    }

    const row = explicitRows.get(ordinal);
    if (!row) {
      rejectChangeSet(invalid, "Vocabulary target resolution failed.", "missing_target");
    }
    const meanings = parseVocabularyChangeSetMeanings(row);
    if (change.action === "add_entry") {
      appendResolvedVocabularyChange(
        resolveAddEntryChange(change, row, meanings, createId),
        actions,
        publicItems,
      );
      continue;
    }

    requireActiveVocabularyTarget(row, invalid);
    const resolved = change.action === "change_state"
      ? resolveStateChange({
          phrase_id: row.phrase_id,
          text: row.phrase_text || change.text,
          source_type: row.source_type,
          status: row.status,
        }, change.destination, invalid)
      : change.action === "add_meaning"
        ? resolveAddMeaningChange(change, row, meanings, createId)
        : resolveUpdateMeaningChange(change, row, meanings, createId, invalid);
    appendResolvedVocabularyChange(resolved, actions, publicItems);
  }
  return { actions, publicItems };
}

function groupVocabularyChangeSetActions(actions: VocabularyChangeSetAction[]) {
  const byPhrase = new Map<string, VocabularyChangeSetAction[]>();
  for (const action of actions) {
    const phraseId = action[1];
    const grouped = byPhrase.get(phraseId) || [];
    grouped.push(action);
    byPhrase.set(phraseId, grouped);
  }
  return byPhrase.values();
}

function validatePhraseActionConflicts(
  actions: VocabularyChangeSetAction[],
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
) {
  const addCount = actions.filter((action) => action[0] === "add").length;
  const stateActions = actions.filter((action) => action[0] === "state");
  if (addCount > 1 || (addCount === 1 && actions.length > 1) || stateActions.length > 1) {
    rejectChangeSet(
      invalid,
      "Vocabulary change-set contains conflicting duplicate targets.",
      "conflicting_changes",
    );
  }
  const removesEntry = stateActions.some(
    (action) => action[0] === "state" && action[4] === "removed",
  );
  const changesMeaning = actions.some(
    (action) => action[0] === "meaning+" || action[0] === "meaning~",
  );
  if (removesEntry && changesMeaning) {
    rejectChangeSet(invalid, "Removed vocabulary cannot also change meanings.", "conflicting_changes");
  }
}

function meaningConflictIdentity(action: VocabularyChangeSetAction) {
  if (action[0] === "meaning+") {
    return {
      key: `add:${action[5]}`,
      output: action[5],
      target: action[7],
    };
  }
  if (action[0] === "meaning~") {
    return {
      key: `update:${action[4]}`,
      output: action[9],
      target: action[4],
    };
  }
  return null;
}

function validateMeaningActionConflicts(
  actions: VocabularyChangeSetAction[],
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
) {
  const keys = new Set<string>();
  const targets = new Set<string>();
  const outputs = new Set<string>();
  for (const action of actions) {
    const identity = meaningConflictIdentity(action);
    if (!identity) continue;
    if (keys.has(identity.key)) {
      rejectChangeSet(
        invalid,
        "Vocabulary change-set contains duplicate meaning changes.",
        "conflicting_changes",
      );
    }
    if (targets.has(identity.target) || outputs.has(identity.output)) {
      rejectChangeSet(
        invalid,
        "Vocabulary change-set contains colliding meaning changes.",
        "conflicting_changes",
      );
    }
    keys.add(identity.key);
    targets.add(identity.target);
    outputs.add(identity.output);
  }
}

function validateVocabularyChangeSetConflicts(
  actions: VocabularyChangeSetAction[],
  invalid: VocabularyChangeSetPlannerOptions["invalid"],
) {
  for (const grouped of groupVocabularyChangeSetActions(actions)) {
    validatePhraseActionConflicts(grouped, invalid);
    validateMeaningActionConflicts(grouped, invalid);
  }
}

export function createVocabularyChangeSetPlanner(
  db: D1Database,
  options: VocabularyChangeSetPlannerOptions,
) {
  const { createId, invalid: reportInvalid, now } = options;

  function invalid(
    message: string,
    reason?: VocabularyMutationPlanReason,
  ): never {
    return reportInvalid(message, reason);
  }

  async function planChangeSet(
    userId: string,
    input: VocabularyChangeSetInput | VocabularyChangeSetMutationArgs,
  ): Promise<VocabularyMutationPlan<
    typeof VOCABULARY_CHANGE_SET_OPERATION,
    VocabularyChangeSetMutationArgs,
    VocabularyChangeSetMutationResult
  > & { publicItems: VocabularyChangeSetPublicItem[] }> {
    assertUserId(userId, invalid);

    const canonicalActions = readCanonicalVocabularyChangeSet(input, invalid);
    let actions: VocabularyChangeSetAction[];
    let publicItems: VocabularyChangeSetPublicItem[] = [];
    if (canonicalActions) {
      actions = canonicalActions;
    } else {
      const requested = parseRequestedVocabularyChanges(input, invalid);

      const { explicitRows, recentRows } = await loadVocabularyChangeSetSnapshots({
        db,
        invalid,
        requested,
        userId,
      });

      const {
        actions: resolvedActions,
        publicItems: displays,
      } = resolveVocabularyChangeSet({
        createId,
        explicitRows,
        invalid,
        recentRows,
        requested,
      });

      validateVocabularyChangeSetConflicts(resolvedActions, invalid);
      actions = resolvedActions;
      publicItems = displays;
    }

    return buildVocabularyChangeSetMutationPlan({
      actions,
      activeStatusSql: ACTIVE_STATUS_SQL,
      canonicalJsonLimit: VOCABULARY_CHANGE_SET_CANONICAL_JSON_LIMIT,
      changeSetLimit: VOCABULARY_CHANGE_SET_LIMIT,
      db,
      invalid,
      now,
      operation: VOCABULARY_CHANGE_SET_OPERATION,
      publicItems,
      userId,
    });
  }

  return planChangeSet;
}
