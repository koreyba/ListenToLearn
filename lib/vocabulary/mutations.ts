import {
  normalizeVocabularyMeaning,
  normalizeVocabularyTarget,
  isVocabularyStateDestination,
  readScopedLegacyMeaningId,
  vocabularyStatusForCategory,
  VOCABULARY_CATEGORIES,
  VOCABULARY_LIMITS,
  type VocabularyCategory,
  type VocabularyStatus,
  type VocabularyStateDestination,
} from "./contracts.ts";
import {
  createVocabularyChangeSetPlanner,
  VOCABULARY_CHANGE_SET_OPERATION,
} from "./change-set-planner.ts";
export { VOCABULARY_CHANGE_SET_LIMIT } from "./change-set-planner.ts";
export type {
  VocabularyChangeSetAction,
  VocabularyChangeSetInput,
  VocabularyChangeSetMutationArgs,
  VocabularyChangeSetMutationResult,
  VocabularyChangeSetPublicItem,
  VocabularyChangeSetRequestedAction,
} from "./change-set-planner.ts";

export const VOCABULARY_MUTATION_OPERATIONS = Object.freeze({
  addEntry: "vocabulary.add-entry/v1",
  addEntries: "vocabulary.add-entries/v1",
  addMeaning: "vocabulary.add-meaning/v1",
  changeState: "vocabulary.change-state/v1",
  setCategory: "vocabulary.set-category/v1",
  updateMeaning: "vocabulary.update-meaning/v1",
  changeSet: VOCABULARY_CHANGE_SET_OPERATION,
} as const);

export const VOCABULARY_BULK_ENTRY_LIMIT = 10;

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
  const planChangeSet = createVocabularyChangeSetPlanner(db, {
    createId,
    invalid,
    now,
  });

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
