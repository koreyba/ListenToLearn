import {
  normalizeVocabularyMeaning,
  normalizeVocabularyTarget,
  isVocabularyStateDestination,
  readScopedLegacyMeaningId,
  scopedLegacyMeaningId,
  vocabularyCategoryFromStatus,
  vocabularyStatusForCategory,
  VOCABULARY_CATEGORIES,
  VOCABULARY_LIMITS,
  type VocabularyCategory,
  type VocabularyStatus,
  type VocabularyStateDestination,
} from "./contracts.ts";

export const VOCABULARY_MUTATION_OPERATIONS = Object.freeze({
  addEntry: "vocabulary.add-entry/v1",
  addEntries: "vocabulary.add-entries/v1",
  addMeaning: "vocabulary.add-meaning/v1",
  changeState: "vocabulary.change-state/v1",
  setCategory: "vocabulary.set-category/v1",
  updateMeaning: "vocabulary.update-meaning/v1",
  changeSet: "vocabulary.change-set/v1",
} as const);

export const VOCABULARY_BULK_ENTRY_LIMIT = 10;
export const VOCABULARY_CHANGE_SET_LIMIT = 30;
const VOCABULARY_CHANGE_SET_CANONICAL_JSON_LIMIT = 3_600;

export type VocabularyMutationReceiptGuard = {
  sql: string;
  bindings: unknown[];
};

export type VocabularyMutationPlan<
  Operation extends string,
  Args extends object,
  Result extends object,
> = {
  operation: Operation;
  targetKey: string;
  canonicalArgs: Args;
  canonicalResult: Result;
  entityType: "phrase" | "meaning";
  entityId: string | null;
  candidateEntityId?: string;
  statements: D1PreparedStatement[];
  receiptGuard: VocabularyMutationReceiptGuard;
  conflictGuard?: VocabularyMutationReceiptGuard;
};

export type AddVocabularyEntryMutationArgs = {
  text: string;
  translation?: string;
  context?: string;
};

export type AddVocabularyEntriesMutationArgs = {
  entries: AddVocabularyEntryMutationArgs[];
};

export type AddVocabularyMeaningMutationArgs = {
  phraseId: string;
  translation: string;
  context?: string;
};

export type UpdateVocabularyMeaningMutationArgs = {
  meaningId: string;
  phraseId: string;
  expectedTranslation: string;
  expectedContext: string;
  translation: string;
  context?: string;
};

export type SetVocabularyCategoryMutationInput = {
  phraseId: string;
  expectedStoredStatus: VocabularyStatus;
  category: VocabularyCategory;
};

export type SetVocabularyCategoryMutationArgs = {
  phraseId: string;
  expectedStoredStatus: VocabularyStatus;
  category: VocabularyCategory;
};

export type ChangeVocabularyStateMutationEntry = {
  phraseId: string;
  text: string;
  sourceType: "preset" | "custom";
  expectedStoredStatus: VocabularyStatus;
};

export type ChangeVocabularyStateMutationInput = {
  entries: ChangeVocabularyStateMutationEntry[];
  destination: VocabularyStateDestination;
};

export type ChangeVocabularyStateMutationArgs = ChangeVocabularyStateMutationInput;

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

export type AddVocabularyEntryMutationResult = {
  ok: true;
  saved: true;
  text: string;
};

export type AddVocabularyEntriesMutationResult = {
  ok: true;
  saved: true;
  entries: Array<{
    text: string;
    state: "added" | "already_saved";
  }>;
};

export type AddVocabularyMeaningMutationResult = {
  ok: true;
  saved: true;
  phraseId: string;
  translation: string;
};

export type UpdateVocabularyMeaningMutationResult = {
  ok: true;
  updated: true;
  meaningId: string;
  translation: string;
};

export type SetVocabularyCategoryMutationResult = {
  ok: true;
  updated: true;
  phraseId: string;
  category: VocabularyCategory;
};

export type ChangeVocabularyStateMutationResult = {
  ok: true;
  updated: true;
  entries: Array<{
    phraseId: string;
    text: string;
    state: VocabularyStateDestination;
  }>;
};

export type VocabularyMutationPlanReason =
  | "invalid_input"
  | "missing_target"
  | "ambiguous_meaning"
  | "conflicting_changes"
  | "change_limit_exceeded"
  | "unsupported_change";

export class VocabularyMutationPlanError extends Error {
  readonly code = "invalid_input";
  readonly reason: VocabularyMutationPlanReason;

  constructor(message: string, reason: VocabularyMutationPlanReason = "invalid_input") {
    super(message);
    this.name = "VocabularyMutationPlanError";
    this.reason = reason;
  }
}

type PlannerOptions = {
  createId?: (kind: "meaning" | "phrase") => string;
  now?: () => string;
};

type VisiblePhraseRow = {
  id: string;
  translation: string;
  context: string;
  source_type: "preset" | "custom";
  owner_id: string | null;
};

type BulkVisiblePhraseStateRow = {
  ordinal: number;
  status: VocabularyStatus | null;
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

const ACTIVE_STATUS_SQL = "'to_learn', 'learning_now', 'learnt', 'learned'";
const ACTIVE_STATUSES = new Set<VocabularyStatus>([
  "to_learn",
  "learning_now",
  "learnt",
  "learned",
]);

function defaultCreateId(kind: "meaning" | "phrase") {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const random = btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
  return `${kind === "phrase" ? "p" : "m"}-${random}`;
}

function invalid(
  message: string,
  reason: VocabularyMutationPlanReason = "invalid_input",
): never {
  throw new VocabularyMutationPlanError(message, reason);
}

function assertUserId(userId: string) {
  if (typeof userId !== "string" || !userId.trim()) {
    invalid("User identity is invalid.");
  }
}

function cleanSingleLine(value: unknown, maximum: number, label: string) {
  if (typeof value !== "string") invalid(`${label} is invalid.`);
  const cleaned = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (!cleaned || [...cleaned].length > maximum) {
    invalid(`${label} is invalid.`);
  }
  return cleaned;
}

function cleanOptionalSingleLine(value: unknown, maximum: number, label: string) {
  if (value === undefined || value === null || value === "") return undefined;
  return cleanSingleLine(value, maximum, label);
}

function cleanOptionalContext(value: unknown) {
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

export function createVocabularyMutationPlanner(
  db: D1Database,
  options: PlannerOptions = {},
) {
  const createId = options.createId || defaultCreateId;
  const now = options.now || (() => new Date().toISOString());

  async function findVisibleByText(userId: string, text: string) {
    return db.prepare(`
      SELECT id, translation, context, source_type, owner_id
      FROM phrases
      WHERE text = ? COLLATE NOCASE
        AND (source_type = 'preset' OR owner_id = ?)
      ORDER BY CASE WHEN owner_id = ? THEN 0 ELSE 1 END, id
      LIMIT 1
    `).bind(text, userId, userId).first<VisiblePhraseRow>();
  }

  async function planAddEntry(
    userId: string,
    input: AddVocabularyEntryMutationArgs,
  ): Promise<VocabularyMutationPlan<
    typeof VOCABULARY_MUTATION_OPERATIONS.addEntry,
    AddVocabularyEntryMutationArgs,
    AddVocabularyEntryMutationResult
  >> {
    assertUserId(userId);
    const text = cleanSingleLine(
      input.text,
      VOCABULARY_LIMITS.entryTextCharacters,
      "Vocabulary text",
    );
    const translation = cleanOptionalSingleLine(
      input.translation,
      VOCABULARY_LIMITS.meaningCharacters,
      "Vocabulary translation",
    );
    const context = cleanOptionalContext(input.context);
    const normalizedText = normalizeVocabularyTarget(text);
    const normalizedTranslation = normalizeVocabularyMeaning(translation);
    const timestamp = now();
    const existing = await findVisibleByText(userId, text);
    const contextSupplied = context === undefined ? 0 : 1;
    const personalContext = context === undefined
      ? existing?.source_type === "custom" && !existing.translation.trim()
        ? existing.context
        : ""
      : context;
    const statements: D1PreparedStatement[] = [];
    const candidatePhraseId = createId("phrase");

    statements.push(db.prepare(`
      INSERT OR IGNORE INTO phrases (
        id, text, pattern, ipa, translation, context, source_type, catalog_order,
        owner_id, status, created_at, updated_at
      )
      SELECT ?, ?, ?, '', '', ?, 'custom', NULL, ?, 'pick', ?, ?
      WHERE NOT EXISTS (
        SELECT 1
        FROM phrases
        WHERE text = ? COLLATE NOCASE
          AND (source_type = 'preset' OR owner_id = ?)
      )
    `).bind(
      candidatePhraseId,
      text,
      text,
      translation ? "" : context || "",
      userId,
      timestamp,
      timestamp,
      text,
      userId,
    ));

    statements.push(db.prepare(`
      INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
      SELECT ?, phrases.id, 'to_learn', ?, ?
      FROM phrases
      WHERE phrases.text = ? COLLATE NOCASE
        AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
      ORDER BY CASE WHEN phrases.owner_id = ? THEN 0 ELSE 1 END, phrases.id
      LIMIT 1
      ON CONFLICT(user_id, phrase_id) DO UPDATE SET
        status = CASE
          WHEN phrase_progress.status = 'pick' THEN 'to_learn'
          ELSE phrase_progress.status
        END,
        created_at = CASE
          WHEN phrase_progress.status = 'pick' THEN excluded.created_at
          ELSE phrase_progress.created_at
        END,
        updated_at = CASE
          WHEN phrase_progress.status = 'pick' THEN excluded.updated_at
          ELSE phrase_progress.updated_at
        END
    `).bind(userId, timestamp, timestamp, text, userId, userId));

    if (translation) {
      statements.push(db.prepare(`
        INSERT INTO phrase_meanings (
          id, user_id, phrase_id, translation, normalized_translation, context,
          created_at, updated_at
        )
        SELECT ?, ?, phrases.id, ?, ?, ?, ?, ?
        FROM phrases
        JOIN phrase_progress AS progress
          ON progress.phrase_id = phrases.id AND progress.user_id = ?
        WHERE phrases.text = ? COLLATE NOCASE
          AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
          AND progress.status IN (${ACTIVE_STATUS_SQL})
        ORDER BY CASE WHEN phrases.owner_id = ? THEN 0 ELSE 1 END, phrases.id
        LIMIT 1
        ON CONFLICT(user_id, phrase_id, normalized_translation) DO UPDATE SET
          updated_at = CASE
            WHEN phrase_meanings.translation <> excluded.translation
              OR (? = 1 AND phrase_meanings.context <> excluded.context)
              THEN excluded.updated_at
            ELSE phrase_meanings.updated_at
          END,
          translation = excluded.translation,
          context = CASE
            WHEN ? = 1 THEN excluded.context
            ELSE phrase_meanings.context
          END
      `).bind(
        createId("meaning"),
        userId,
        translation,
        normalizedTranslation,
        personalContext,
        timestamp,
        timestamp,
        userId,
        text,
        userId,
        userId,
        contextSupplied,
        contextSupplied,
      ));
    }

    const receiptGuard: VocabularyMutationReceiptGuard = {
      sql: `EXISTS (
        SELECT 1
        FROM phrases
        JOIN phrase_progress AS progress ON progress.phrase_id = phrases.id
        WHERE phrases.id = (
          SELECT candidate.id
          FROM phrases AS candidate
          WHERE candidate.text = ? COLLATE NOCASE
            AND (candidate.source_type = 'preset' OR candidate.owner_id = ?)
          ORDER BY CASE WHEN candidate.owner_id = ? THEN 0 ELSE 1 END, candidate.id
          LIMIT 1
        )
          AND progress.user_id = ?
          AND progress.status IN (${ACTIVE_STATUS_SQL})
          AND (
            ? = 0
            OR EXISTS (
              SELECT 1
              FROM phrase_meanings
              WHERE ? = 1
                AND phrase_meanings.user_id = ?
                AND phrase_meanings.phrase_id = phrases.id
                AND phrase_meanings.normalized_translation = ?
                AND phrase_meanings.translation = ?
                AND (? = 0 OR phrase_meanings.context = ?)
            )
          )
      )`,
      bindings: [
        text,
        userId,
        userId,
        userId,
        translation ? 1 : 0,
        translation ? 1 : 0,
        userId,
        normalizedTranslation,
        translation || "",
        contextSupplied,
        personalContext,
      ],
    };

    return {
      operation: VOCABULARY_MUTATION_OPERATIONS.addEntry,
      targetKey: normalizedText,
      canonicalArgs: {
        text,
        ...(translation === undefined ? {} : { translation }),
        ...(context === undefined ? {} : { context }),
      },
      canonicalResult: { ok: true, saved: true, text },
      entityType: "phrase",
      entityId: null,
      candidateEntityId: candidatePhraseId,
      statements,
      receiptGuard,
    };
  }

  async function planAddEntries(
    userId: string,
    input: AddVocabularyEntriesMutationArgs,
  ): Promise<VocabularyMutationPlan<
    typeof VOCABULARY_MUTATION_OPERATIONS.addEntries,
    AddVocabularyEntriesMutationArgs,
    AddVocabularyEntriesMutationResult
  >> {
    assertUserId(userId);
    if (
      !input
      || !Array.isArray(input.entries)
      || input.entries.length < 1
      || input.entries.length > VOCABULARY_BULK_ENTRY_LIMIT
    ) {
      invalid("Vocabulary entries are invalid.");
    }
    const entries: AddVocabularyEntryMutationArgs[] = [];
    const entriesByText = new Map<string, AddVocabularyEntryMutationArgs>();
    for (const entry of input.entries) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        invalid("Vocabulary entry is invalid.");
      }
      const text = cleanSingleLine(
        entry.text,
        VOCABULARY_LIMITS.entryTextCharacters,
        "Vocabulary text",
      );
      const translation = cleanOptionalSingleLine(
        entry.translation,
        VOCABULARY_LIMITS.meaningCharacters,
        "Vocabulary translation",
      );
      const context = cleanOptionalContext(entry.context);
      const canonicalEntry = {
        text,
        ...(translation === undefined ? {} : { translation }),
        ...(context === undefined ? {} : { context }),
      };
      const normalizedText = normalizeVocabularyTarget(text);
      const duplicate = entriesByText.get(normalizedText);
      if (duplicate) {
        if (
          duplicate.translation !== canonicalEntry.translation
          || duplicate.context !== canonicalEntry.context
        ) {
          invalid("Vocabulary duplicate entries conflict.");
        }
        continue;
      }
      entriesByText.set(normalizedText, canonicalEntry);
      entries.push(canonicalEntry);
    }
    const requestedValuesSql = entries.map(() => "(?, ?)").join(", ");
    const requestedBindings = entries.flatMap((entry, ordinal) => [ordinal, entry.text]);
    const visibleStates = await db.prepare(`
      WITH requested (ordinal, text) AS (VALUES ${requestedValuesSql})
      SELECT requested.ordinal, progress.status
      FROM requested
      LEFT JOIN phrases ON phrases.id = (
        SELECT candidate.id
        FROM phrases AS candidate
        WHERE candidate.text = requested.text COLLATE NOCASE
          AND (candidate.source_type = 'preset' OR candidate.owner_id = ?)
        ORDER BY CASE WHEN candidate.owner_id = ? THEN 0 ELSE 1 END, candidate.id
        LIMIT 1
      )
      LEFT JOIN phrase_progress AS progress
        ON progress.phrase_id = phrases.id AND progress.user_id = ?
      ORDER BY requested.ordinal
    `).bind(
      ...requestedBindings,
      userId,
      userId,
      userId,
    ).all<BulkVisiblePhraseStateRow>();
    const alreadySavedOrdinals = new Set(
      (visibleStates.results || [])
        .filter((row) => row.status !== null && ACTIVE_STATUSES.has(row.status))
        .map((row) => Number(row.ordinal)),
    );
    const timestamp = now();
    const rows = entries.map((entry, ordinal) => ({
      ordinal,
      phraseId: createId("phrase"),
      meaningId: entry.translation ? createId("meaning") : "",
      text: entry.text,
      translation: entry.translation || null,
      normalizedTranslation: normalizeVocabularyMeaning(entry.translation),
      context: entry.context ?? null,
      contextSupplied: entry.context === undefined ? 0 : 1,
    }));
    const inputValuesSql = rows
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?)")
      .join(", ");
    const inputBindings = rows.flatMap((row) => [
      row.ordinal,
      row.phraseId,
      row.meaningId,
      row.text,
      row.translation,
      row.normalizedTranslation,
      row.context,
      row.contextSupplied,
    ]);
    const inputCte = `input (
      ordinal, phrase_id, meaning_id, text, translation,
      normalized_translation, context, context_supplied
    ) AS (VALUES ${inputValuesSql})`;
    const statements = [
      db.prepare(`
        WITH ${inputCte}
        INSERT OR IGNORE INTO phrases (
          id, text, pattern, ipa, translation, context, source_type, catalog_order,
          owner_id, status, created_at, updated_at
        )
        SELECT
          input.phrase_id,
          input.text,
          input.text,
          '',
          '',
          CASE WHEN input.translation IS NULL THEN COALESCE(input.context, '') ELSE '' END,
          'custom',
          NULL,
          ?,
          'pick',
          ?,
          ?
        FROM input
        WHERE NOT EXISTS (
          SELECT 1
          FROM phrases
          WHERE phrases.text = input.text COLLATE NOCASE
            AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
        )
        ORDER BY input.ordinal
      `).bind(...inputBindings, userId, timestamp, timestamp, userId),
      db.prepare(`
        WITH ${inputCte}
        INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
        SELECT ?, phrases.id, 'to_learn', ?, ?
        FROM input
        JOIN phrases ON phrases.id = (
          SELECT candidate.id
          FROM phrases AS candidate
          WHERE candidate.text = input.text COLLATE NOCASE
            AND (candidate.source_type = 'preset' OR candidate.owner_id = ?)
          ORDER BY CASE WHEN candidate.owner_id = ? THEN 0 ELSE 1 END, candidate.id
          LIMIT 1
        )
        ORDER BY input.ordinal
        ON CONFLICT(user_id, phrase_id) DO UPDATE SET
          status = CASE
            WHEN phrase_progress.status = 'pick' THEN 'to_learn'
            ELSE phrase_progress.status
          END,
          created_at = CASE
            WHEN phrase_progress.status = 'pick' THEN excluded.created_at
            ELSE phrase_progress.created_at
          END,
          updated_at = CASE
            WHEN phrase_progress.status = 'pick' THEN excluded.updated_at
            ELSE phrase_progress.updated_at
          END
      `).bind(
        ...inputBindings,
        userId,
        timestamp,
        timestamp,
        userId,
        userId,
      ),
      db.prepare(`
        WITH ${inputCte}
        INSERT INTO phrase_meanings (
          id, user_id, phrase_id, translation, normalized_translation, context,
          created_at, updated_at
        )
        SELECT
          input.meaning_id,
          ?,
          phrases.id,
          input.translation,
          input.normalized_translation,
          CASE
            WHEN input.context_supplied = 1 THEN input.context
            WHEN existing_meaning.id IS NOT NULL THEN existing_meaning.context
            WHEN phrases.source_type = 'custom' AND trim(phrases.translation) = ''
              THEN phrases.context
            ELSE ''
          END,
          ?,
          ?
        FROM input
        JOIN phrases ON phrases.id = (
          SELECT candidate.id
          FROM phrases AS candidate
          WHERE candidate.text = input.text COLLATE NOCASE
            AND (candidate.source_type = 'preset' OR candidate.owner_id = ?)
          ORDER BY CASE WHEN candidate.owner_id = ? THEN 0 ELSE 1 END, candidate.id
          LIMIT 1
        )
        JOIN phrase_progress AS progress
          ON progress.phrase_id = phrases.id AND progress.user_id = ?
        LEFT JOIN phrase_meanings AS existing_meaning
          ON existing_meaning.user_id = ?
          AND existing_meaning.phrase_id = phrases.id
          AND existing_meaning.normalized_translation = input.normalized_translation
        WHERE input.translation IS NOT NULL
          AND progress.status IN (${ACTIVE_STATUS_SQL})
        ORDER BY input.ordinal
        ON CONFLICT(user_id, phrase_id, normalized_translation) DO UPDATE SET
          updated_at = CASE
            WHEN phrase_meanings.translation <> excluded.translation
              OR phrase_meanings.context <> excluded.context
              THEN excluded.updated_at
            ELSE phrase_meanings.updated_at
          END,
          translation = excluded.translation,
          context = excluded.context
      `).bind(
        ...inputBindings,
        userId,
        timestamp,
        timestamp,
        userId,
        userId,
        userId,
        userId,
      ),
    ];
    const expectedValuesSql = rows.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const expectedBindings = rows.flatMap((row) => [
      row.text,
      row.translation,
      row.normalizedTranslation,
      row.context,
      row.contextSupplied,
    ]);
    const receiptGuard: VocabularyMutationReceiptGuard = {
      sql: `NOT EXISTS (
        WITH expected (
          text, translation, normalized_translation, context, context_supplied
        ) AS (VALUES ${expectedValuesSql})
        SELECT 1
        FROM expected
        WHERE NOT EXISTS (
          SELECT 1
          FROM phrases
          JOIN phrase_progress AS progress ON progress.phrase_id = phrases.id
          WHERE phrases.id = (
            SELECT candidate.id
            FROM phrases AS candidate
            WHERE candidate.text = expected.text COLLATE NOCASE
              AND (candidate.source_type = 'preset' OR candidate.owner_id = ?)
            ORDER BY CASE WHEN candidate.owner_id = ? THEN 0 ELSE 1 END, candidate.id
            LIMIT 1
          )
            AND progress.user_id = ?
            AND progress.status IN (${ACTIVE_STATUS_SQL})
            AND (
              expected.translation IS NULL
              OR EXISTS (
                SELECT 1
                FROM phrase_meanings AS meanings
                WHERE meanings.user_id = ?
                  AND meanings.phrase_id = phrases.id
                  AND meanings.normalized_translation = expected.normalized_translation
                  AND meanings.translation = expected.translation
                  AND (
                    expected.context_supplied = 0
                    OR meanings.context = expected.context
                  )
              )
            )
        )
      )`,
      bindings: [
        ...expectedBindings,
        userId,
        userId,
        userId,
        userId,
      ],
    };
    return {
      operation: VOCABULARY_MUTATION_OPERATIONS.addEntries,
      targetKey: "entries",
      canonicalArgs: { entries },
      canonicalResult: {
        ok: true,
        saved: true,
        entries: entries.map(({ text }, ordinal) => ({
          text,
          state: alreadySavedOrdinals.has(ordinal) ? "already_saved" : "added",
        })),
      },
      entityType: "phrase",
      entityId: null,
      statements,
      receiptGuard,
    };
  }

  async function planAddMeaning(
    userId: string,
    input: AddVocabularyMeaningMutationArgs,
  ): Promise<VocabularyMutationPlan<
    typeof VOCABULARY_MUTATION_OPERATIONS.addMeaning,
    AddVocabularyMeaningMutationArgs,
    AddVocabularyMeaningMutationResult
  >> {
    assertUserId(userId);
    const phraseId = cleanSingleLine(input.phraseId, 120, "Phrase identity");
    const translation = cleanSingleLine(
      input.translation,
      VOCABULARY_LIMITS.meaningCharacters,
      "Vocabulary translation",
    );
    const context = cleanOptionalContext(input.context);
    const normalizedTranslation = normalizeVocabularyMeaning(translation);
    const timestamp = now();
    const contextSupplied = context === undefined ? 0 : 1;

    const statements = [db.prepare(`
      INSERT INTO phrase_meanings (
        id, user_id, phrase_id, translation, normalized_translation, context,
        created_at, updated_at
      )
      SELECT ?, ?, phrases.id, ?, ?, ?, ?, ?
      FROM phrases
      JOIN phrase_progress AS progress
        ON progress.phrase_id = phrases.id AND progress.user_id = ?
      WHERE phrases.id = ?
        AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
        AND progress.status IN (${ACTIVE_STATUS_SQL})
      ON CONFLICT(user_id, phrase_id, normalized_translation) DO UPDATE SET
        updated_at = CASE
          WHEN phrase_meanings.translation <> excluded.translation
            OR (? = 1 AND phrase_meanings.context <> excluded.context)
            THEN excluded.updated_at
          ELSE phrase_meanings.updated_at
        END,
        translation = excluded.translation,
        context = CASE
          WHEN ? = 1 THEN excluded.context
          ELSE phrase_meanings.context
        END
    `).bind(
      createId("meaning"),
      userId,
      translation,
      normalizedTranslation,
      context || "",
      timestamp,
      timestamp,
      userId,
      phraseId,
      userId,
      contextSupplied,
      contextSupplied,
    )];

    const receiptGuard: VocabularyMutationReceiptGuard = {
      sql: `EXISTS (
        SELECT 1
        FROM phrase_meanings AS meanings
        JOIN phrases ON phrases.id = meanings.phrase_id
        JOIN phrase_progress AS progress
          ON progress.phrase_id = phrases.id AND progress.user_id = meanings.user_id
        WHERE meanings.user_id = ?
          AND meanings.phrase_id = ?
          AND meanings.normalized_translation = ?
          AND meanings.translation = ?
          AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
          AND progress.user_id = ?
          AND progress.status IN (${ACTIVE_STATUS_SQL})
          AND (? = 0 OR meanings.context = ?)
      )`,
      bindings: [
        userId,
        phraseId,
        normalizedTranslation,
        translation,
        userId,
        userId,
        contextSupplied,
        context || "",
      ],
    };

    return {
      operation: VOCABULARY_MUTATION_OPERATIONS.addMeaning,
      targetKey: `${phraseId}:${normalizedTranslation}`,
      canonicalArgs: withOptionalContext({ phraseId, translation }, context),
      canonicalResult: { ok: true, saved: true, phraseId, translation },
      entityType: "meaning",
      entityId: null,
      statements,
      receiptGuard,
    };
  }

  async function planUpdateMeaning(
    userId: string,
    input: UpdateVocabularyMeaningMutationArgs,
  ): Promise<VocabularyMutationPlan<
    typeof VOCABULARY_MUTATION_OPERATIONS.updateMeaning,
    UpdateVocabularyMeaningMutationArgs,
    UpdateVocabularyMeaningMutationResult
  >> {
    assertUserId(userId);
    const meaningId = cleanSingleLine(input.meaningId, 140, "Meaning identity");
    const phraseId = cleanSingleLine(input.phraseId, 120, "Phrase identity");
    const expectedTranslation = cleanSingleLine(
      input.expectedTranslation,
      VOCABULARY_LIMITS.meaningCharacters,
      "Expected vocabulary translation",
    );
    if (typeof input.expectedContext !== "string") {
      invalid("Expected vocabulary context is invalid.");
    }
    const expectedContext = cleanOptionalContext(input.expectedContext);
    if (expectedContext === undefined) {
      invalid("Expected vocabulary context is invalid.");
    }
    const translation = cleanSingleLine(
      input.translation,
      VOCABULARY_LIMITS.meaningCharacters,
      "Vocabulary translation",
    );
    const context = cleanOptionalContext(input.context);
    const normalizedTranslation = normalizeVocabularyMeaning(translation);
    const timestamp = now();
    const contextSupplied = context === undefined ? 0 : 1;

    const scopedLegacyPhraseId = readScopedLegacyMeaningId(meaningId);
    if (scopedLegacyPhraseId) {
      const nextContext = context === undefined ? expectedContext : context;
      const existingMeaning = await db.prepare(`
        SELECT id
        FROM phrase_meanings
        WHERE user_id = ? AND phrase_id = ? AND normalized_translation = ?
        LIMIT 1
      `).bind(
        userId,
        phraseId,
        normalizedTranslation,
      ).first<{ id: string }>();
      const personalMeaningId = existingMeaning?.id || createId("meaning");

      const statements = [
        db.prepare(`
          INSERT INTO phrase_meanings (
            id, user_id, phrase_id, translation, normalized_translation, context,
            created_at, updated_at
          )
          SELECT ?, ?, phrases.id, ?, ?, ?, ?, ?
          FROM phrases
          JOIN phrase_progress AS progress
            ON progress.phrase_id = phrases.id AND progress.user_id = ?
          WHERE phrases.id = ?
            AND phrases.id = ?
            AND phrases.source_type = 'custom'
            AND phrases.owner_id = ?
            AND phrases.translation = ?
            AND phrases.context = ?
            AND progress.status IN (${ACTIVE_STATUS_SQL})
          ON CONFLICT(user_id, phrase_id, normalized_translation) DO UPDATE SET
            translation = excluded.translation,
            context = excluded.context,
            updated_at = CASE
              WHEN phrase_meanings.translation <> excluded.translation
                OR phrase_meanings.context <> excluded.context
                THEN excluded.updated_at
              ELSE phrase_meanings.updated_at
            END
        `).bind(
          personalMeaningId,
          userId,
          translation,
          normalizedTranslation,
          nextContext,
          timestamp,
          timestamp,
          userId,
          phraseId,
          scopedLegacyPhraseId,
          userId,
          expectedTranslation,
          expectedContext,
        ),
        db.prepare(`
          UPDATE phrases
          SET translation = '', context = '', updated_at = ?
          WHERE id = ?
            AND id = ?
            AND source_type = 'custom'
            AND owner_id = ?
            AND translation = ?
            AND context = ?
            AND EXISTS (
              SELECT 1
              FROM phrase_progress AS progress
              WHERE progress.phrase_id = phrases.id
                AND progress.user_id = ?
                AND progress.status IN (${ACTIVE_STATUS_SQL})
            )
            AND EXISTS (
              SELECT 1
              FROM phrase_meanings AS meanings
              WHERE meanings.id = ?
                AND meanings.user_id = ?
                AND meanings.phrase_id = phrases.id
                AND meanings.translation = ?
                AND meanings.normalized_translation = ?
                AND meanings.context = ?
            )
        `).bind(
          timestamp,
          phraseId,
          scopedLegacyPhraseId,
          userId,
          expectedTranslation,
          expectedContext,
          userId,
          personalMeaningId,
          userId,
          translation,
          normalizedTranslation,
          nextContext,
        ),
      ];

      const receiptGuard: VocabularyMutationReceiptGuard = {
        sql: `changes() = 1 AND EXISTS (
          SELECT 1
          FROM phrases
          JOIN phrase_progress AS progress
            ON progress.phrase_id = phrases.id
          JOIN phrase_meanings AS meanings
            ON meanings.phrase_id = phrases.id
          WHERE phrases.id = ?
            AND phrases.source_type = 'custom'
            AND phrases.owner_id = ?
            AND phrases.translation = ''
            AND phrases.context = ''
            AND progress.user_id = ?
            AND progress.status IN (${ACTIVE_STATUS_SQL})
            AND meanings.id = ?
            AND meanings.user_id = ?
            AND meanings.translation = ?
            AND meanings.normalized_translation = ?
            AND meanings.context = ?
        )`,
        bindings: [
          phraseId,
          userId,
          userId,
          personalMeaningId,
          userId,
          translation,
          normalizedTranslation,
          nextContext,
        ],
      };

      const conflictGuard: VocabularyMutationReceiptGuard = {
        sql: `EXISTS (
          SELECT 1
          FROM phrases
          JOIN phrase_progress AS progress
            ON progress.phrase_id = phrases.id
          WHERE phrases.id = ?
            AND phrases.id = ?
            AND phrases.source_type = 'custom'
            AND phrases.owner_id = ?
            AND phrases.translation = ?
            AND phrases.context = ?
            AND progress.user_id = ?
            AND progress.status IN (${ACTIVE_STATUS_SQL})
            AND NOT EXISTS (
              SELECT 1
              FROM phrase_meanings AS duplicate
              WHERE duplicate.user_id = ?
                AND duplicate.phrase_id = phrases.id
                AND duplicate.normalized_translation = ?
                AND duplicate.id <> ?
            )
        )`,
        bindings: [
          phraseId,
          scopedLegacyPhraseId,
          userId,
          expectedTranslation,
          expectedContext,
          userId,
          userId,
          normalizedTranslation,
          personalMeaningId,
        ],
      };

      return {
        operation: VOCABULARY_MUTATION_OPERATIONS.updateMeaning,
        targetKey: meaningId,
        canonicalArgs: withOptionalContext({
          meaningId,
          phraseId,
          expectedTranslation,
          expectedContext,
          translation,
        }, context),
        canonicalResult: {
          ok: true,
          updated: true,
          meaningId: personalMeaningId,
          translation,
        },
        entityType: "meaning",
        entityId: personalMeaningId,
        statements,
        receiptGuard,
        conflictGuard,
      };
    }

    const statements = [db.prepare(`
      UPDATE phrase_meanings
      SET
        updated_at = CASE
          WHEN translation <> ?
            OR normalized_translation <> ?
            OR (? = 1 AND context <> ?)
            THEN ?
          ELSE updated_at
        END,
        translation = ?,
        normalized_translation = ?,
        context = CASE WHEN ? = 1 THEN ? ELSE context END
      WHERE id = ?
        AND user_id = ?
        AND phrase_id = ?
        AND translation = ?
        AND context = ?
        AND EXISTS (
          SELECT 1
          FROM phrases
          JOIN phrase_progress AS progress
            ON progress.phrase_id = phrases.id
          WHERE phrases.id = phrase_meanings.phrase_id
            AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
            AND progress.user_id = ?
            AND progress.status IN (${ACTIVE_STATUS_SQL})
        )
        AND NOT EXISTS (
          SELECT 1
          FROM phrase_meanings AS duplicate
          WHERE duplicate.user_id = ?
            AND duplicate.phrase_id = phrase_meanings.phrase_id
            AND duplicate.normalized_translation = ?
            AND duplicate.id <> ?
        )
    `).bind(
      translation,
      normalizedTranslation,
      contextSupplied,
      context || "",
      timestamp,
      translation,
      normalizedTranslation,
      contextSupplied,
      context || "",
      meaningId,
      userId,
      phraseId,
      expectedTranslation,
      expectedContext,
      userId,
      userId,
      userId,
      normalizedTranslation,
      meaningId,
    )];

    const receiptGuard: VocabularyMutationReceiptGuard = {
      sql: `changes() = 1 AND EXISTS (
        SELECT 1
        FROM phrase_meanings AS meanings
        JOIN phrases ON phrases.id = meanings.phrase_id
        JOIN phrase_progress AS progress
          ON progress.phrase_id = phrases.id AND progress.user_id = meanings.user_id
        WHERE meanings.id = ?
          AND meanings.user_id = ?
          AND meanings.phrase_id = ?
          AND meanings.translation = ?
          AND meanings.normalized_translation = ?
          AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
          AND progress.user_id = ?
          AND progress.status IN (${ACTIVE_STATUS_SQL})
          AND (? = 0 OR meanings.context = ?)
      )`,
      bindings: [
        meaningId,
        userId,
        phraseId,
        translation,
        normalizedTranslation,
        userId,
        userId,
        contextSupplied,
        context || "",
      ],
    };

    const conflictGuard: VocabularyMutationReceiptGuard = {
      sql: `EXISTS (
        SELECT 1
        FROM phrase_meanings AS meanings
        JOIN phrases ON phrases.id = meanings.phrase_id
        JOIN phrase_progress AS progress
          ON progress.phrase_id = phrases.id AND progress.user_id = meanings.user_id
        WHERE meanings.id = ?
          AND meanings.user_id = ?
          AND meanings.phrase_id = ?
          AND meanings.translation = ?
          AND meanings.context = ?
          AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
          AND progress.user_id = ?
          AND progress.status IN (${ACTIVE_STATUS_SQL})
          AND NOT EXISTS (
            SELECT 1
            FROM phrase_meanings AS duplicate
            WHERE duplicate.user_id = ?
              AND duplicate.phrase_id = meanings.phrase_id
              AND duplicate.normalized_translation = ?
              AND duplicate.id <> ?
          )
      )`,
      bindings: [
        meaningId,
        userId,
        phraseId,
        expectedTranslation,
        expectedContext,
        userId,
        userId,
        userId,
        normalizedTranslation,
        meaningId,
      ],
    };

    return {
      operation: VOCABULARY_MUTATION_OPERATIONS.updateMeaning,
      targetKey: meaningId,
      canonicalArgs: withOptionalContext({
        meaningId,
        phraseId,
        expectedTranslation,
        expectedContext,
        translation,
      }, context),
      canonicalResult: { ok: true, updated: true, meaningId, translation },
      entityType: "meaning",
      entityId: meaningId,
      statements,
      receiptGuard,
      conflictGuard,
    };
  }

  async function planSetCategory(
    userId: string,
    input: SetVocabularyCategoryMutationInput,
  ): Promise<VocabularyMutationPlan<
    typeof VOCABULARY_MUTATION_OPERATIONS.setCategory,
    SetVocabularyCategoryMutationArgs,
    SetVocabularyCategoryMutationResult
  >> {
    assertUserId(userId);
    const phraseId = cleanSingleLine(input.phraseId, 120, "Phrase identity");
    if (!ACTIVE_STATUSES.has(input.expectedStoredStatus)) {
      invalid("Expected vocabulary status is invalid.");
    }
    if (!(VOCABULARY_CATEGORIES as readonly unknown[]).includes(input.category)) {
      invalid("Vocabulary category is invalid.");
    }
    const expectedStoredStatus = input.expectedStoredStatus;
    const category = input.category;
    const storedStatus = vocabularyStatusForCategory(category);
    const timestamp = now();
    const statements = [db.prepare(`
      UPDATE phrase_progress
      SET
        status = ?,
        updated_at = CASE WHEN status <> ? THEN ? ELSE updated_at END
      WHERE user_id = ?
        AND phrase_id = ?
        AND status = ?
        AND status IN (${ACTIVE_STATUS_SQL})
        AND EXISTS (
          SELECT 1
          FROM phrases
          WHERE phrases.id = phrase_progress.phrase_id
            AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
        )
    `).bind(
      storedStatus,
      storedStatus,
      timestamp,
      userId,
      phraseId,
      expectedStoredStatus,
      userId,
    )];
    const receiptGuard: VocabularyMutationReceiptGuard = {
      sql: `changes() = 1 AND EXISTS (
        SELECT 1
        FROM phrase_progress AS progress
        JOIN phrases ON phrases.id = progress.phrase_id
        WHERE progress.user_id = ?
          AND progress.phrase_id = ?
          AND progress.status = ?
          AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
      )`,
      bindings: [userId, phraseId, storedStatus, userId],
    };
    const conflictGuard: VocabularyMutationReceiptGuard = {
      sql: `EXISTS (
        SELECT 1
        FROM phrase_progress AS progress
        JOIN phrases ON phrases.id = progress.phrase_id
        WHERE progress.user_id = ?
          AND progress.phrase_id = ?
          AND progress.status = ?
          AND progress.status IN (${ACTIVE_STATUS_SQL})
          AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
      )`,
      bindings: [userId, phraseId, expectedStoredStatus, userId],
    };
    return {
      operation: VOCABULARY_MUTATION_OPERATIONS.setCategory,
      targetKey: phraseId,
      canonicalArgs: { phraseId, expectedStoredStatus, category },
      canonicalResult: { ok: true, updated: true, phraseId, category },
      entityType: "phrase",
      entityId: phraseId,
      statements,
      receiptGuard,
      conflictGuard,
    };
  }

  async function planChangeState(
    userId: string,
    input: ChangeVocabularyStateMutationInput,
  ): Promise<VocabularyMutationPlan<
    typeof VOCABULARY_MUTATION_OPERATIONS.changeState,
    ChangeVocabularyStateMutationArgs,
    ChangeVocabularyStateMutationResult
  >> {
    assertUserId(userId);
    if (
      !input
      || !Array.isArray(input.entries)
      || input.entries.length < 1
      || input.entries.length > VOCABULARY_BULK_ENTRY_LIMIT
      || !isVocabularyStateDestination(input.destination)
    ) {
      invalid("Vocabulary state change is invalid.");
    }
    const entries: ChangeVocabularyStateMutationEntry[] = [];
    const phraseIds = new Set<string>();
    const normalizedTexts = new Set<string>();
    for (const entry of input.entries) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        invalid("Vocabulary state entry is invalid.");
      }
      const phraseId = cleanSingleLine(entry.phraseId, 120, "Phrase identity");
      const text = cleanSingleLine(
        entry.text,
        VOCABULARY_LIMITS.entryTextCharacters,
        "Vocabulary text",
      );
      if (
        (entry.sourceType !== "preset" && entry.sourceType !== "custom")
        || !ACTIVE_STATUSES.has(entry.expectedStoredStatus)
        || phraseIds.has(phraseId)
        || normalizedTexts.has(normalizeVocabularyTarget(text))
      ) {
        invalid("Vocabulary state entry is invalid.");
      }
      phraseIds.add(phraseId);
      normalizedTexts.add(normalizeVocabularyTarget(text));
      entries.push({
        phraseId,
        text,
        sourceType: entry.sourceType,
        expectedStoredStatus: entry.expectedStoredStatus,
      });
    }

    const destination = input.destination;
    const timestamp = now();
    const expectedValuesSql = entries.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const expectedBindings = entries.flatMap((entry, ordinal) => [
      ordinal,
      entry.phraseId,
      entry.text,
      entry.sourceType,
      entry.expectedStoredStatus,
    ]);
    const expectedCte = `expected (
      ordinal, phrase_id, text, source_type, expected_status
    ) AS (VALUES ${expectedValuesSql})`;
    const activeSnapshotGuard: VocabularyMutationReceiptGuard = {
      sql: `NOT EXISTS (
        WITH ${expectedCte}
        SELECT 1
        FROM expected
        WHERE NOT EXISTS (
          SELECT 1
          FROM phrase_progress AS progress
          JOIN phrases ON phrases.id = progress.phrase_id
          WHERE progress.user_id = ?
            AND progress.phrase_id = expected.phrase_id
            AND progress.status = expected.expected_status
            AND progress.status IN (${ACTIVE_STATUS_SQL})
            AND phrases.text = expected.text
            AND phrases.source_type = expected.source_type
            AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
        )
      )`,
      bindings: [...expectedBindings, userId, userId],
    };
    const canonicalResult: ChangeVocabularyStateMutationResult = {
      ok: true,
      updated: true,
      entries: entries.map(({ phraseId, text }) => ({
        phraseId,
        text,
        state: destination,
      })),
    };

    if (destination !== "removed") {
      const storedStatus = vocabularyStatusForCategory(destination);
      const statements = [
        db.prepare(`
          WITH ${expectedCte}
          UPDATE phrase_progress
          SET
            status = ?,
            updated_at = CASE WHEN status <> ? THEN ? ELSE updated_at END
          WHERE user_id = ?
            AND EXISTS (
              SELECT 1
              FROM expected
              JOIN phrases ON phrases.id = expected.phrase_id
              WHERE expected.phrase_id = phrase_progress.phrase_id
                AND expected.expected_status = phrase_progress.status
                AND expected.text = phrases.text
                AND expected.source_type = phrases.source_type
                AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
            )
        `).bind(
          ...expectedBindings,
          storedStatus,
          storedStatus,
          timestamp,
          userId,
          userId,
        ),
        db.prepare(`
          UPDATE users SET id = id
          WHERE id = ? AND changes() = ?
        `).bind(userId, entries.length),
      ];
      const receiptGuard: VocabularyMutationReceiptGuard = {
        sql: `changes() = 1 AND NOT EXISTS (
          WITH ${expectedCte}
          SELECT 1
          FROM expected
          WHERE NOT EXISTS (
            SELECT 1
            FROM phrase_progress AS progress
            JOIN phrases ON phrases.id = progress.phrase_id
            WHERE progress.user_id = ?
              AND progress.phrase_id = expected.phrase_id
              AND progress.status = ?
              AND phrases.text = expected.text
              AND phrases.source_type = expected.source_type
              AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
          )
        )`,
        bindings: [...expectedBindings, userId, storedStatus, userId],
      };
      return {
        operation: VOCABULARY_MUTATION_OPERATIONS.changeState,
        targetKey: "entries",
        canonicalArgs: { entries, destination },
        canonicalResult,
        entityType: "phrase",
        entityId: null,
        statements,
        receiptGuard,
        conflictGuard: activeSnapshotGuard,
      };
    }

    const presetCount = entries.filter((entry) => entry.sourceType === "preset").length;
    const customCount = entries.length - presetCount;
    const removedPostconditionSql = `NOT EXISTS (
      WITH ${expectedCte}
      SELECT 1
      FROM expected
      WHERE (
        expected.source_type = 'preset'
        AND NOT EXISTS (
          SELECT 1
          FROM phrases
          JOIN phrase_progress AS progress ON progress.phrase_id = phrases.id
          WHERE phrases.id = expected.phrase_id
            AND phrases.text = expected.text
            AND phrases.source_type = 'preset'
            AND progress.user_id = ?
            AND progress.status = 'pick'
        )
      ) OR (
        expected.source_type = 'custom'
        AND EXISTS (SELECT 1 FROM phrases WHERE phrases.id = expected.phrase_id)
      )
    )`;
    const removedPostconditionBindings = [...expectedBindings, userId];
    const statements = [
      db.prepare(`
        WITH ${expectedCte}
        UPDATE phrase_progress
        SET status = 'pick', updated_at = ?
        WHERE user_id = ?
          AND EXISTS (
            SELECT 1
            FROM expected
            JOIN phrases ON phrases.id = expected.phrase_id
            WHERE expected.source_type = 'preset'
              AND phrases.source_type = 'preset'
              AND expected.phrase_id = phrase_progress.phrase_id
              AND expected.expected_status = phrase_progress.status
              AND expected.text = phrases.text
          )
      `).bind(...expectedBindings, timestamp, userId),
      db.prepare(`
        UPDATE users SET id = id
        WHERE id = ? AND changes() = ?
      `).bind(userId, presetCount),
      db.prepare(`
        WITH ${expectedCte}
        DELETE FROM phrases
        WHERE phrases.source_type = 'custom'
          AND phrases.owner_id = ?
          AND changes() = 1
          AND EXISTS (
            SELECT 1
            FROM expected
            WHERE expected.source_type = 'custom'
              AND expected.phrase_id = phrases.id
              AND expected.text = phrases.text
              AND EXISTS (
                SELECT 1
                FROM phrase_progress AS progress
                WHERE progress.user_id = ?
                  AND progress.phrase_id = phrases.id
                  AND progress.status = expected.expected_status
                  AND progress.status IN (${ACTIVE_STATUS_SQL})
              )
          )
      `).bind(...expectedBindings, userId, userId),
      db.prepare(`
        UPDATE users SET id = id
        WHERE id = ?
          AND changes() = ?
          AND (${removedPostconditionSql})
      `).bind(
        userId,
        customCount,
        ...removedPostconditionBindings,
      ),
    ];
    return {
      operation: VOCABULARY_MUTATION_OPERATIONS.changeState,
      targetKey: "entries",
      canonicalArgs: { entries, destination },
      canonicalResult,
      entityType: "phrase",
      entityId: null,
      statements,
      receiptGuard: {
        sql: `changes() = 1 AND (${removedPostconditionSql})`,
        bindings: removedPostconditionBindings,
      },
      conflictGuard: activeSnapshotGuard,
    };
  }

  async function planChangeSet(
    userId: string,
    input: VocabularyChangeSetInput | VocabularyChangeSetMutationArgs,
  ): Promise<VocabularyMutationPlan<
    typeof VOCABULARY_MUTATION_OPERATIONS.changeSet,
    VocabularyChangeSetMutationArgs,
    VocabularyChangeSetMutationResult
  > & { publicItems: VocabularyChangeSetPublicItem[] }> {
    assertUserId(userId);

    const isSourceType = (value: unknown): value is "preset" | "custom" => (
      value === "preset" || value === "custom"
    );
    const isStoredStatus = (value: unknown): value is VocabularyStatus => (
      typeof value === "string" && (
        ACTIVE_STATUSES.has(value as VocabularyStatus) || value === "pick"
      )
    );
    const isNullableString = (value: unknown) => value === null || typeof value === "string";
    const canonicalActionIsValid = (action: unknown): action is VocabularyChangeSetAction => {
      if (!Array.isArray(action)) return false;
      if (action[0] === "add") {
        return action.length === 11
          && typeof action[1] === "string" && Boolean(action[1])
          && typeof action[2] === "string" && Boolean(action[2])
          && (action[3] === null || isSourceType(action[3]))
          && (action[4] === null || isStoredStatus(action[4]))
          && action.slice(5).every(isNullableString);
      }
      if (action[0] === "meaning+") {
        return action.length === 10
          && typeof action[1] === "string" && Boolean(action[1])
          && isSourceType(action[2])
          && isStoredStatus(action[3]) && ACTIVE_STATUSES.has(action[3])
          && action.slice(4, 8).every((value) => typeof value === "string")
          && action.slice(8).every(isNullableString);
      }
      if (action[0] === "meaning~") {
        return action.length === 12
          && typeof action[1] === "string" && Boolean(action[1])
          && isSourceType(action[2])
          && isStoredStatus(action[3]) && ACTIVE_STATUSES.has(action[3])
          && typeof action[4] === "string" && Boolean(action[4])
          && (action[5] === "personal" || action[5] === "legacy")
          && action.slice(6).every((value) => typeof value === "string");
      }
      return action[0] === "state"
        && action.length === 5
        && typeof action[1] === "string" && Boolean(action[1])
        && isSourceType(action[2])
        && isStoredStatus(action[3]) && ACTIVE_STATUSES.has(action[3])
        && isVocabularyStateDestination(action[4]);
    };

    let actions: VocabularyChangeSetAction[];
    let publicItems: VocabularyChangeSetPublicItem[] = [];
    if (
      input
      && typeof input === "object"
      && "actions" in input
      && Array.isArray(input.actions)
    ) {
      if (
        input.v !== 1
        || input.actions.length < 1
        || input.actions.length > VOCABULARY_CHANGE_SET_LIMIT
        || !input.actions.every(canonicalActionIsValid)
      ) {
        invalid("Vocabulary change-set is invalid.");
      }
      actions = input.actions.map((action) => [...action]) as VocabularyChangeSetAction[];
    } else {
      if (
        !input
        || typeof input !== "object"
        || !("changes" in input)
        || !Array.isArray(input.changes)
        || input.changes.length < 1
      ) {
        invalid("Vocabulary change-set is invalid.");
      }
      const requested: VocabularyChangeSetRequestedAction[] = [];
      let concreteCount = 0;
      let recentActionCount = 0;
      for (const raw of input.changes) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
          invalid("Vocabulary change is invalid.");
        }
        if (raw.action === "change_recent_state") {
          if (
            !Number.isSafeInteger(raw.count)
            || raw.count < 1
            || raw.count > VOCABULARY_CHANGE_SET_LIMIT
            || !isVocabularyStateDestination(raw.destination)
            || recentActionCount > 0
          ) {
            invalid("Recent vocabulary change is invalid.");
          }
          recentActionCount += 1;
          concreteCount += raw.count;
          requested.push({
            action: raw.action,
            count: raw.count,
            destination: raw.destination,
          });
          continue;
        }
        if (
          raw.action !== "add_entry"
          && raw.action !== "add_meaning"
          && raw.action !== "update_meaning"
          && raw.action !== "change_state"
        ) {
          invalid("Vocabulary change is invalid.");
        }
        const text = cleanSingleLine(
          raw.text,
          VOCABULARY_LIMITS.entryTextCharacters,
          "Vocabulary text",
        );
        concreteCount += 1;
        if (raw.action === "change_state") {
          if (!isVocabularyStateDestination(raw.destination)) {
            invalid("Vocabulary destination is invalid.");
          }
          requested.push({ action: raw.action, text, destination: raw.destination });
          continue;
        }
        const translation = raw.action === "add_entry"
          ? cleanOptionalSingleLine(
              raw.translation,
              VOCABULARY_LIMITS.meaningCharacters,
              "Vocabulary translation",
            )
          : cleanSingleLine(
              raw.translation,
              VOCABULARY_LIMITS.meaningCharacters,
              "Vocabulary translation",
            );
        const context = cleanOptionalContext(raw.context);
        if (raw.action === "update_meaning") {
          if (translation === undefined) {
            invalid("Vocabulary translation is invalid.");
          }
          const currentTranslation = cleanOptionalSingleLine(
            raw.currentTranslation,
            VOCABULARY_LIMITS.meaningCharacters,
            "Current vocabulary translation",
          );
          requested.push(withOptionalContext({
            action: raw.action,
            text,
            ...(currentTranslation === undefined ? {} : { currentTranslation }),
            translation,
          }, context));
        } else {
          requested.push(withOptionalContext({
            action: raw.action,
            text,
            ...(translation === undefined ? {} : { translation }),
          }, context) as VocabularyChangeSetRequestedAction);
        }
      }
      if (concreteCount < 1 || concreteCount > VOCABULARY_CHANGE_SET_LIMIT) {
        invalid(
          "Vocabulary change-set exceeds its concrete action limit.",
          "change_limit_exceeded",
        );
      }

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
          invalid("Not enough recent vocabulary entries exist.", "missing_target");
        }
      }

      const parseMeanings = (row: VocabularyChangeSetTargetRow) => {
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
      };
      const resolvedActions: VocabularyChangeSetAction[] = [];
      const displays: VocabularyChangeSetPublicItem[] = [];
      const appendState = (
        target: VocabularyChangeSetRecentRow,
        destination: VocabularyStateDestination,
      ) => {
        if (!ACTIVE_STATUSES.has(target.status)) {
          invalid("Vocabulary state target is not active.", "missing_target");
        }
        resolvedActions.push([
          "state",
          target.phrase_id,
          target.source_type,
          target.status,
          destination,
        ]);
        displays.push({
          id: `change-${displays.length + 1}`,
          actionType: "change_state",
          text: target.text,
          fromCategory: vocabularyCategoryFromStatus(target.status),
          toCategory: destination,
        });
      };

      for (let ordinal = 0; ordinal < requested.length; ordinal += 1) {
        const change = requested[ordinal];
        if (change.action === "change_recent_state") {
          for (const target of recentRows) appendState(target, change.destination);
          continue;
        }
        const row = explicitRows.get(ordinal);
        if (!row) invalid("Vocabulary target resolution failed.", "missing_target");
        const meanings = parseMeanings(row);
        const phraseId = row.phrase_id;
        const sourceType = row.source_type;
        const status = row.status;
        if (change.action === "add_entry") {
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
              ?? (sourceType === "custom" && !(row.phrase_translation || "").trim()
                ? row.phrase_context || ""
                : ""))
            : (change.context ?? "");
          resolvedActions.push([
            "add",
            phraseId || createId("phrase"),
            change.text,
            sourceType,
            status,
            translation || null,
            normalizedTranslation,
            context,
            translation ? (existingMeaning?.id || createId("meaning")) : null,
            existingMeaning?.translation || null,
            existingMeaning?.context || null,
          ]);
          displays.push({
            id: `change-${displays.length + 1}`,
            actionType: "add_entry",
            text: change.text,
            ...(translation ? { translation } : {}),
            ...(change.context === undefined ? {} : { context: change.context }),
          });
          continue;
        }
        if (!phraseId || !sourceType || !status || !ACTIVE_STATUSES.has(status)) {
          invalid("Vocabulary target is missing or inactive.", "missing_target");
        }
        if (change.action === "change_state") {
          appendState({
            phrase_id: phraseId,
            text: row.phrase_text || change.text,
            source_type: sourceType,
            status,
          }, change.destination);
          continue;
        }
        if (change.action === "add_meaning") {
          const normalizedTranslation = normalizeVocabularyMeaning(change.translation);
          const existingMeaning = meanings.find(
            (meaning) => meaning.normalizedTranslation === normalizedTranslation,
          );
          const context = change.context ?? existingMeaning?.context ?? "";
          resolvedActions.push([
            "meaning+",
            phraseId,
            sourceType,
            status,
            change.translation,
            normalizedTranslation,
            context,
            existingMeaning?.id || createId("meaning"),
            existingMeaning?.translation || null,
            existingMeaning?.context || null,
          ]);
          displays.push({
            id: `change-${displays.length + 1}`,
            actionType: "add_meaning",
            text: row.phrase_text || change.text,
            translation: change.translation,
            ...(change.context === undefined ? {} : { context: change.context }),
          });
          continue;
        }

        const availableMeanings: Array<VocabularyChangeSetMeaningSnapshot & {
          source: "personal" | "legacy";
        }> = meanings.map((meaning) => ({ ...meaning, source: "personal" as const }));
        if ((row.phrase_translation || "").trim()) {
          availableMeanings.unshift({
            id: scopedLegacyMeaningId(phraseId),
            source: "legacy",
            translation: row.phrase_translation || "",
            normalizedTranslation: normalizeVocabularyMeaning(row.phrase_translation),
            context: row.phrase_context || "",
          });
        }
        const candidates = change.currentTranslation
          ? availableMeanings.filter((meaning) => (
              meaning.normalizedTranslation === normalizeVocabularyMeaning(change.currentTranslation)
            ))
          : availableMeanings;
        if (candidates.length !== 1) {
          invalid("Vocabulary meaning target is ambiguous.", "ambiguous_meaning");
        }
        const selected = candidates[0];
        if (selected.source === "legacy" && sourceType === "preset") {
          invalid(
            "Shared preset meanings cannot be edited.",
            "unsupported_change",
          );
        }
        const normalizedTranslation = normalizeVocabularyMeaning(change.translation);
        if (meanings.some((meaning) => (
          meaning.id !== selected.id
          && meaning.normalizedTranslation === normalizedTranslation
        ))) {
          invalid(
            "Vocabulary meaning update conflicts with another meaning.",
            "conflicting_changes",
          );
        }
        const context = change.context ?? selected.context;
        resolvedActions.push([
          "meaning~",
          phraseId,
          sourceType,
          status,
          selected.id,
          selected.source,
          selected.translation,
          selected.context,
          change.translation,
          normalizedTranslation,
          context,
          selected.source === "personal" ? selected.id : createId("meaning"),
        ]);
        displays.push({
          id: `change-${displays.length + 1}`,
          actionType: "update_meaning",
          text: row.phrase_text || change.text,
          previousTranslation: selected.translation,
          translation: change.translation,
          ...(change.context === undefined ? {} : { context: change.context }),
        });
      }

      const byPhrase = new Map<string, VocabularyChangeSetAction[]>();
      for (const action of resolvedActions) {
        const phraseId = action[1];
        const grouped = byPhrase.get(phraseId) || [];
        grouped.push(action);
        byPhrase.set(phraseId, grouped);
      }
      for (const grouped of byPhrase.values()) {
        const addCount = grouped.filter((action) => action[0] === "add").length;
        const stateActions = grouped.filter((action) => action[0] === "state");
        if (addCount > 1 || (addCount === 1 && grouped.length > 1) || stateActions.length > 1) {
          invalid(
            "Vocabulary change-set contains conflicting duplicate targets.",
            "conflicting_changes",
          );
        }
        if (
          stateActions.some((action) => action[0] === "state" && action[4] === "removed")
          && grouped.some((action) => action[0] === "meaning+" || action[0] === "meaning~")
        ) {
          invalid("Removed vocabulary cannot also change meanings.", "conflicting_changes");
        }
        const meaningKeys = new Set<string>();
        const meaningTargets = new Set<string>();
        const meaningOutputs = new Set<string>();
        for (const action of grouped) {
          const key = action[0] === "meaning+"
            ? `add:${action[5]}`
            : action[0] === "meaning~"
              ? `update:${action[4]}`
              : null;
          const target = action[0] === "meaning+"
            ? action[7]
            : action[0] === "meaning~"
              ? action[4]
              : null;
          const output = action[0] === "meaning+"
            ? action[5]
            : action[0] === "meaning~"
              ? action[9]
              : null;
          if (key && meaningKeys.has(key)) {
            invalid(
              "Vocabulary change-set contains duplicate meaning changes.",
              "conflicting_changes",
            );
          }
          if (
            (target && meaningTargets.has(target))
            || (output && meaningOutputs.has(output))
          ) {
            invalid(
              "Vocabulary change-set contains colliding meaning changes.",
              "conflicting_changes",
            );
          }
          if (key) meaningKeys.add(key);
          if (target) meaningTargets.add(target);
          if (output) meaningOutputs.add(output);
        }
      }
      actions = resolvedActions;
      publicItems = displays;
    }

    const canonicalArgs: VocabularyChangeSetMutationArgs = { v: 1, actions };
    const actionsJson = JSON.stringify(actions);
    if (
      actions.length < 1
      || actions.length > VOCABULARY_CHANGE_SET_LIMIT
      || JSON.stringify(canonicalArgs).length > VOCABULARY_CHANGE_SET_CANONICAL_JSON_LIMIT
    ) {
      invalid("Vocabulary change-set exceeds its storage budget.", "change_limit_exceeded");
    }
    const timestamp = now();
    const inputCte = "input(value) AS (SELECT value FROM json_each(?))";
    const ownerCte = "params(owner_id, changed_at) AS (VALUES (?, ?))";
    const statements = [
      db.prepare(`
        WITH ${inputCte}, ${ownerCte}
        INSERT INTO phrases (
          id, text, pattern, ipa, translation, context, source_type, catalog_order,
          owner_id, status, created_at, updated_at
        )
        SELECT
          json_extract(value, '$[1]'),
          json_extract(value, '$[2]'),
          json_extract(value, '$[2]'),
          '', '',
          CASE WHEN json_extract(value, '$[5]') IS NULL
            THEN COALESCE(json_extract(value, '$[7]'), '') ELSE '' END,
          'custom', NULL, params.owner_id, 'pick', params.changed_at, params.changed_at
        FROM input, params
        WHERE json_extract(value, '$[0]') = 'add'
          AND json_extract(value, '$[3]') IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM phrases AS visible
            WHERE visible.text = json_extract(value, '$[2]') COLLATE NOCASE
              AND (visible.source_type = 'preset' OR visible.owner_id = params.owner_id)
          )
      `).bind(actionsJson, userId, timestamp),
      db.prepare(`
        WITH ${inputCte}, ${ownerCte}
        INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
        SELECT
          params.owner_id,
          phrases.id,
          CASE
            WHEN json_extract(value, '$[4]') IN (${ACTIVE_STATUS_SQL})
              THEN json_extract(value, '$[4]')
            ELSE 'to_learn'
          END,
          params.changed_at,
          params.changed_at
        FROM input, params
        JOIN phrases ON phrases.id = json_extract(value, '$[1]')
        LEFT JOIN phrase_progress AS current
          ON current.user_id = params.owner_id AND current.phrase_id = phrases.id
        WHERE json_extract(value, '$[0]') = 'add'
          AND phrases.text = json_extract(value, '$[2]')
          AND (
            (json_extract(value, '$[3]') IS NULL
              AND phrases.source_type = 'custom' AND phrases.owner_id = params.owner_id)
            OR (phrases.source_type = json_extract(value, '$[3]')
              AND (phrases.source_type = 'preset' OR phrases.owner_id = params.owner_id))
          )
          AND (
            (json_extract(value, '$[4]') IS NULL AND current.status IS NULL)
            OR current.status = json_extract(value, '$[4]')
          )
        ON CONFLICT(user_id, phrase_id) DO UPDATE SET
          status = excluded.status,
          created_at = CASE
            WHEN phrase_progress.status = 'pick' THEN excluded.created_at
            ELSE phrase_progress.created_at
          END,
          updated_at = CASE
            WHEN phrase_progress.status = 'pick' THEN excluded.updated_at
            ELSE phrase_progress.updated_at
          END
      `).bind(actionsJson, userId, timestamp),
      db.prepare(`
        WITH ${inputCte}, ${ownerCte}, meaning_input AS (
          SELECT
            json_extract(value, '$[0]') AS kind,
            json_extract(value, '$[1]') AS phrase_id,
            CASE json_extract(value, '$[0]')
              WHEN 'add' THEN json_extract(value, '$[3]')
              ELSE json_extract(value, '$[2]')
            END AS source_type,
            CASE json_extract(value, '$[0]')
              WHEN 'add' THEN json_extract(value, '$[4]')
              ELSE json_extract(value, '$[3]')
            END AS expected_status,
            CASE json_extract(value, '$[0]')
              WHEN 'add' THEN json_extract(value, '$[5]')
              ELSE json_extract(value, '$[4]')
            END AS translation,
            CASE json_extract(value, '$[0]')
              WHEN 'add' THEN json_extract(value, '$[6]')
              ELSE json_extract(value, '$[5]')
            END AS normalized_translation,
            CASE json_extract(value, '$[0]')
              WHEN 'add' THEN json_extract(value, '$[7]')
              ELSE json_extract(value, '$[6]')
            END AS context,
            CASE json_extract(value, '$[0]')
              WHEN 'add' THEN json_extract(value, '$[8]')
              ELSE json_extract(value, '$[7]')
            END AS meaning_id,
            CASE json_extract(value, '$[0]')
              WHEN 'add' THEN json_extract(value, '$[9]')
              ELSE json_extract(value, '$[8]')
            END AS expected_translation,
            CASE json_extract(value, '$[0]')
              WHEN 'add' THEN json_extract(value, '$[10]')
              ELSE json_extract(value, '$[9]')
            END AS expected_context
          FROM input
          WHERE json_extract(value, '$[0]') IN ('add', 'meaning+')
            AND (json_extract(value, '$[0]') <> 'add' OR json_extract(value, '$[5]') IS NOT NULL)
        )
        INSERT INTO phrase_meanings (
          id, user_id, phrase_id, translation, normalized_translation, context,
          created_at, updated_at
        )
        SELECT
          meaning_input.meaning_id,
          params.owner_id,
          phrases.id,
          meaning_input.translation,
          meaning_input.normalized_translation,
          meaning_input.context,
          params.changed_at,
          params.changed_at
        FROM meaning_input, params
        JOIN phrases ON phrases.id = meaning_input.phrase_id
        JOIN phrase_progress AS progress
          ON progress.user_id = params.owner_id AND progress.phrase_id = phrases.id
        LEFT JOIN phrase_meanings AS expected_meaning
          ON expected_meaning.id = meaning_input.meaning_id
          AND expected_meaning.user_id = params.owner_id
          AND expected_meaning.phrase_id = phrases.id
        WHERE progress.status IN (${ACTIVE_STATUS_SQL})
          AND (
            (meaning_input.kind = 'add' AND (
              (meaning_input.source_type IS NULL
                AND phrases.source_type = 'custom' AND phrases.owner_id = params.owner_id)
              OR (phrases.source_type = meaning_input.source_type
                AND (phrases.source_type = 'preset' OR phrases.owner_id = params.owner_id))
            ))
            OR (meaning_input.kind = 'meaning+'
              AND phrases.source_type = meaning_input.source_type
              AND progress.status = meaning_input.expected_status
              AND (phrases.source_type = 'preset' OR phrases.owner_id = params.owner_id))
          )
          AND (
            (meaning_input.expected_translation IS NULL AND NOT EXISTS (
              SELECT 1 FROM phrase_meanings AS collision
              WHERE collision.user_id = params.owner_id
                AND collision.phrase_id = phrases.id
                AND collision.normalized_translation = meaning_input.normalized_translation
            ))
            OR (
              expected_meaning.translation = meaning_input.expected_translation
              AND expected_meaning.context = meaning_input.expected_context
              AND expected_meaning.normalized_translation = meaning_input.normalized_translation
            )
          )
        ON CONFLICT(user_id, phrase_id, normalized_translation) DO UPDATE SET
          translation = excluded.translation,
          context = excluded.context,
          updated_at = excluded.updated_at
      `).bind(actionsJson, userId, timestamp),
      db.prepare(`
        WITH ${inputCte}, ${ownerCte}
        UPDATE phrase_meanings
        SET
          translation = (
            SELECT json_extract(value, '$[8]') FROM input
            WHERE json_extract(value, '$[0]') = 'meaning~'
              AND json_extract(value, '$[5]') = 'personal'
              AND json_extract(value, '$[4]') = phrase_meanings.id
          ),
          normalized_translation = (
            SELECT json_extract(value, '$[9]') FROM input
            WHERE json_extract(value, '$[0]') = 'meaning~'
              AND json_extract(value, '$[5]') = 'personal'
              AND json_extract(value, '$[4]') = phrase_meanings.id
          ),
          context = (
            SELECT json_extract(value, '$[10]') FROM input
            WHERE json_extract(value, '$[0]') = 'meaning~'
              AND json_extract(value, '$[5]') = 'personal'
              AND json_extract(value, '$[4]') = phrase_meanings.id
          ),
          updated_at = (SELECT changed_at FROM params)
        WHERE user_id = (SELECT owner_id FROM params)
          AND EXISTS (
            SELECT 1
            FROM input, params
            JOIN phrases ON phrases.id = json_extract(value, '$[1]')
            JOIN phrase_progress AS progress
              ON progress.user_id = params.owner_id AND progress.phrase_id = phrases.id
            WHERE json_extract(value, '$[0]') = 'meaning~'
              AND json_extract(value, '$[5]') = 'personal'
              AND json_extract(value, '$[4]') = phrase_meanings.id
              AND phrase_meanings.phrase_id = phrases.id
              AND phrase_meanings.translation = json_extract(value, '$[6]')
              AND phrase_meanings.context = json_extract(value, '$[7]')
              AND phrases.source_type = json_extract(value, '$[2]')
              AND (phrases.source_type = 'preset' OR phrases.owner_id = params.owner_id)
              AND progress.status = json_extract(value, '$[3]')
              AND NOT EXISTS (
                SELECT 1 FROM phrase_meanings AS collision
                WHERE collision.user_id = params.owner_id
                  AND collision.phrase_id = phrases.id
                  AND collision.normalized_translation = json_extract(value, '$[9]')
                  AND collision.id <> phrase_meanings.id
              )
          )
      `).bind(actionsJson, userId, timestamp),
      db.prepare(`
        WITH ${inputCte}, ${ownerCte}
        INSERT INTO phrase_meanings (
          id, user_id, phrase_id, translation, normalized_translation, context,
          created_at, updated_at
        )
        SELECT
          json_extract(value, '$[11]'),
          params.owner_id,
          phrases.id,
          json_extract(value, '$[8]'),
          json_extract(value, '$[9]'),
          json_extract(value, '$[10]'),
          params.changed_at,
          params.changed_at
        FROM input, params
        JOIN phrases ON phrases.id = json_extract(value, '$[1]')
        JOIN phrase_progress AS progress
          ON progress.user_id = params.owner_id AND progress.phrase_id = phrases.id
        WHERE json_extract(value, '$[0]') = 'meaning~'
          AND json_extract(value, '$[5]') = 'legacy'
          AND phrases.source_type = json_extract(value, '$[2]')
          AND phrases.source_type = 'custom'
          AND phrases.owner_id = params.owner_id
          AND progress.status = json_extract(value, '$[3]')
          AND phrases.translation = json_extract(value, '$[6]')
          AND phrases.context = json_extract(value, '$[7]')
          AND NOT EXISTS (
            SELECT 1 FROM phrase_meanings AS collision
            WHERE collision.user_id = params.owner_id
              AND collision.phrase_id = phrases.id
              AND collision.normalized_translation = json_extract(value, '$[9]')
          )
      `).bind(actionsJson, userId, timestamp),
      db.prepare(`
        WITH ${inputCte}, ${ownerCte}
        UPDATE phrases
        SET translation = '', context = '', updated_at = (SELECT changed_at FROM params)
        WHERE source_type = 'custom' AND owner_id = (SELECT owner_id FROM params)
          AND EXISTS (
            SELECT 1
            FROM input, params
            JOIN phrase_progress AS progress
              ON progress.user_id = params.owner_id
              AND progress.phrase_id = phrases.id
            JOIN phrase_meanings AS result_meaning
              ON result_meaning.id = json_extract(value, '$[11]')
              AND result_meaning.user_id = params.owner_id
              AND result_meaning.phrase_id = phrases.id
            WHERE json_extract(value, '$[0]') = 'meaning~'
              AND json_extract(value, '$[5]') = 'legacy'
              AND json_extract(value, '$[1]') = phrases.id
              AND progress.status = json_extract(value, '$[3]')
              AND phrases.translation = json_extract(value, '$[6]')
              AND phrases.context = json_extract(value, '$[7]')
              AND result_meaning.translation = json_extract(value, '$[8]')
              AND result_meaning.normalized_translation = json_extract(value, '$[9]')
              AND result_meaning.context = json_extract(value, '$[10]')
          )
      `).bind(actionsJson, userId, timestamp),
      db.prepare(`
        WITH ${inputCte}, ${ownerCte}
        UPDATE phrase_progress
        SET
          status = CASE (
            SELECT json_extract(value, '$[4]') FROM input
            WHERE json_extract(value, '$[0]') = 'state'
              AND json_extract(value, '$[1]') = phrase_progress.phrase_id
          )
            WHEN 'to_learn' THEN 'to_learn'
            WHEN 'learning' THEN 'learning_now'
            WHEN 'learned' THEN 'learnt'
          END,
          updated_at = (SELECT changed_at FROM params)
        WHERE user_id = (SELECT owner_id FROM params)
          AND EXISTS (
            SELECT 1 FROM input, params
            JOIN phrases ON phrases.id = json_extract(value, '$[1]')
            WHERE json_extract(value, '$[0]') = 'state'
              AND json_extract(value, '$[4]') <> 'removed'
              AND phrase_progress.phrase_id = phrases.id
              AND phrase_progress.status = json_extract(value, '$[3]')
              AND phrases.source_type = json_extract(value, '$[2]')
              AND (phrases.source_type = 'preset' OR phrases.owner_id = params.owner_id)
          )
      `).bind(actionsJson, userId, timestamp),
      db.prepare(`
        WITH ${inputCte}, ${ownerCte}
        UPDATE phrase_progress
        SET status = 'pick', updated_at = (SELECT changed_at FROM params)
        WHERE user_id = (SELECT owner_id FROM params)
          AND EXISTS (
            SELECT 1 FROM input, params
            JOIN phrases ON phrases.id = json_extract(value, '$[1]')
            WHERE json_extract(value, '$[0]') = 'state'
              AND json_extract(value, '$[4]') = 'removed'
              AND json_extract(value, '$[2]') = 'preset'
              AND phrase_progress.phrase_id = phrases.id
              AND phrase_progress.status = json_extract(value, '$[3]')
              AND phrases.source_type = 'preset'
          )
      `).bind(actionsJson, userId, timestamp),
      db.prepare(`
        WITH ${inputCte}, ${ownerCte}
        DELETE FROM phrases
        WHERE source_type = 'custom' AND owner_id = (SELECT owner_id FROM params)
          AND EXISTS (
            SELECT 1 FROM input, params
            JOIN phrase_progress AS progress
              ON progress.user_id = params.owner_id AND progress.phrase_id = phrases.id
            WHERE json_extract(value, '$[0]') = 'state'
              AND json_extract(value, '$[4]') = 'removed'
              AND json_extract(value, '$[2]') = 'custom'
              AND json_extract(value, '$[1]') = phrases.id
              AND progress.status = json_extract(value, '$[3]')
          )
      `).bind(actionsJson, userId, timestamp),
    ];

    const postconditionSql = `NOT EXISTS (
      WITH ${inputCte}, owner(owner_id) AS (VALUES (?))
      SELECT 1 FROM input, owner
      WHERE CASE json_extract(value, '$[0]')
        WHEN 'add' THEN NOT EXISTS (
          SELECT 1
          FROM phrases
          JOIN phrase_progress AS progress
            ON progress.phrase_id = phrases.id AND progress.user_id = owner.owner_id
          WHERE phrases.id = json_extract(value, '$[1]')
            AND phrases.text = json_extract(value, '$[2]')
            AND progress.status IN (${ACTIVE_STATUS_SQL})
            AND (phrases.source_type = 'preset' OR phrases.owner_id = owner.owner_id)
            AND (
              json_extract(value, '$[5]') IS NULL
              OR EXISTS (
                SELECT 1 FROM phrase_meanings AS meanings
                WHERE meanings.id = json_extract(value, '$[8]')
                  AND meanings.user_id = owner.owner_id
                  AND meanings.phrase_id = phrases.id
                  AND meanings.translation = json_extract(value, '$[5]')
                  AND meanings.normalized_translation = json_extract(value, '$[6]')
                  AND meanings.context = json_extract(value, '$[7]')
              )
            )
        )
        WHEN 'meaning+' THEN NOT EXISTS (
          SELECT 1 FROM phrase_meanings AS meanings
          JOIN phrases ON phrases.id = meanings.phrase_id
          JOIN phrase_progress AS progress
            ON progress.phrase_id = phrases.id AND progress.user_id = owner.owner_id
          WHERE meanings.id = json_extract(value, '$[7]')
            AND meanings.user_id = owner.owner_id
            AND meanings.phrase_id = json_extract(value, '$[1]')
            AND meanings.translation = json_extract(value, '$[4]')
            AND meanings.normalized_translation = json_extract(value, '$[5]')
            AND meanings.context = json_extract(value, '$[6]')
            AND progress.status IN (${ACTIVE_STATUS_SQL})
        )
        WHEN 'meaning~' THEN NOT EXISTS (
          SELECT 1 FROM phrase_meanings AS meanings
          JOIN phrases ON phrases.id = meanings.phrase_id
          JOIN phrase_progress AS progress
            ON progress.phrase_id = phrases.id AND progress.user_id = owner.owner_id
          WHERE meanings.id = json_extract(value, '$[11]')
            AND meanings.user_id = owner.owner_id
            AND meanings.phrase_id = json_extract(value, '$[1]')
            AND meanings.translation = json_extract(value, '$[8]')
            AND meanings.normalized_translation = json_extract(value, '$[9]')
            AND meanings.context = json_extract(value, '$[10]')
            AND progress.status IN (${ACTIVE_STATUS_SQL})
            AND (
              json_extract(value, '$[5]') <> 'legacy'
              OR (phrases.translation = '' AND phrases.context = '')
            )
        )
        WHEN 'state' THEN CASE
          WHEN json_extract(value, '$[4]') = 'removed'
            AND json_extract(value, '$[2]') = 'custom'
            THEN EXISTS (SELECT 1 FROM phrases WHERE id = json_extract(value, '$[1]'))
          WHEN json_extract(value, '$[4]') = 'removed'
            THEN NOT EXISTS (
              SELECT 1 FROM phrase_progress
              WHERE user_id = owner.owner_id
                AND phrase_id = json_extract(value, '$[1]')
                AND status = 'pick'
            )
          ELSE NOT EXISTS (
            SELECT 1 FROM phrase_progress
            WHERE user_id = owner.owner_id
              AND phrase_id = json_extract(value, '$[1]')
              AND status = CASE json_extract(value, '$[4]')
                WHEN 'to_learn' THEN 'to_learn'
                WHEN 'learning' THEN 'learning_now'
                WHEN 'learned' THEN 'learnt'
              END
          )
        END
        ELSE 1
      END
    )`;
    const snapshotSql = `NOT EXISTS (
      WITH ${inputCte}, owner(owner_id) AS (VALUES (?))
      SELECT 1 FROM input, owner
      WHERE CASE json_extract(value, '$[0]')
        WHEN 'add' THEN CASE
          WHEN json_extract(value, '$[3]') IS NULL THEN EXISTS (
            SELECT 1 FROM phrases
            WHERE text = json_extract(value, '$[2]') COLLATE NOCASE
              AND (source_type = 'preset' OR owner_id = owner.owner_id)
          )
          ELSE NOT EXISTS (
            SELECT 1 FROM phrases
            LEFT JOIN phrase_progress AS progress
              ON progress.phrase_id = phrases.id AND progress.user_id = owner.owner_id
            WHERE phrases.id = json_extract(value, '$[1]')
              AND phrases.text = json_extract(value, '$[2]')
              AND phrases.source_type = json_extract(value, '$[3]')
              AND (phrases.source_type = 'preset' OR phrases.owner_id = owner.owner_id)
              AND (
                (json_extract(value, '$[4]') IS NULL AND progress.status IS NULL)
                OR progress.status = json_extract(value, '$[4]')
              )
          )
        END
        WHEN 'meaning+' THEN NOT EXISTS (
          SELECT 1 FROM phrases
          JOIN phrase_progress AS progress
            ON progress.phrase_id = phrases.id AND progress.user_id = owner.owner_id
          WHERE phrases.id = json_extract(value, '$[1]')
            AND phrases.source_type = json_extract(value, '$[2]')
            AND (phrases.source_type = 'preset' OR phrases.owner_id = owner.owner_id)
            AND progress.status = json_extract(value, '$[3]')
            AND (
              (json_extract(value, '$[8]') IS NULL AND NOT EXISTS (
                SELECT 1 FROM phrase_meanings AS meanings
                WHERE meanings.user_id = owner.owner_id
                  AND meanings.phrase_id = phrases.id
                  AND meanings.normalized_translation = json_extract(value, '$[5]')
              ))
              OR EXISTS (
                SELECT 1 FROM phrase_meanings AS meanings
                WHERE meanings.id = json_extract(value, '$[7]')
                  AND meanings.user_id = owner.owner_id
                  AND meanings.phrase_id = phrases.id
                  AND meanings.translation = json_extract(value, '$[8]')
                  AND meanings.context = json_extract(value, '$[9]')
                  AND meanings.normalized_translation = json_extract(value, '$[5]')
              )
            )
        )
        WHEN 'meaning~' THEN NOT EXISTS (
          SELECT 1 FROM phrases
          JOIN phrase_progress AS progress
            ON progress.phrase_id = phrases.id AND progress.user_id = owner.owner_id
          WHERE phrases.id = json_extract(value, '$[1]')
            AND phrases.source_type = json_extract(value, '$[2]')
            AND (phrases.source_type = 'preset' OR phrases.owner_id = owner.owner_id)
            AND progress.status = json_extract(value, '$[3]')
            AND (
              (json_extract(value, '$[5]') = 'legacy'
                AND phrases.source_type = 'custom'
                AND phrases.translation = json_extract(value, '$[6]')
                AND phrases.context = json_extract(value, '$[7]'))
              OR (json_extract(value, '$[5]') = 'personal' AND EXISTS (
                SELECT 1 FROM phrase_meanings AS meanings
                WHERE meanings.id = json_extract(value, '$[4]')
                  AND meanings.user_id = owner.owner_id
                  AND meanings.phrase_id = phrases.id
                  AND meanings.translation = json_extract(value, '$[6]')
                  AND meanings.context = json_extract(value, '$[7]')
              ))
            )
        )
        WHEN 'state' THEN NOT EXISTS (
          SELECT 1 FROM phrases
          JOIN phrase_progress AS progress
            ON progress.phrase_id = phrases.id AND progress.user_id = owner.owner_id
          WHERE phrases.id = json_extract(value, '$[1]')
            AND phrases.source_type = json_extract(value, '$[2]')
            AND (phrases.source_type = 'preset' OR phrases.owner_id = owner.owner_id)
            AND progress.status = json_extract(value, '$[3]')
            AND progress.status IN (${ACTIVE_STATUS_SQL})
        )
        ELSE 1
      END
    )`;
    return {
      operation: VOCABULARY_MUTATION_OPERATIONS.changeSet,
      targetKey: "change-set",
      canonicalArgs,
      canonicalResult: { ok: true, applied: true, count: actions.length },
      entityType: "phrase",
      entityId: null,
      statements,
      receiptGuard: {
        sql: postconditionSql,
        bindings: [actionsJson, userId],
      },
      conflictGuard: {
        sql: snapshotSql,
        bindings: [actionsJson, userId],
      },
      publicItems,
    };
  }

  return {
    planAddEntry,
    planAddEntries,
    planAddMeaning,
    planChangeState,
    planSetCategory,
    planUpdateMeaning,
    planChangeSet,
  };
}
