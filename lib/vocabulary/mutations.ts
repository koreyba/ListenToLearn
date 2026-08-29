import {
  normalizeVocabularyMeaning,
  normalizeVocabularyTarget,
  VOCABULARY_LIMITS,
} from "./contracts.ts";

export const VOCABULARY_MUTATION_OPERATIONS = Object.freeze({
  addEntry: "vocabulary.add-entry/v1",
  addMeaning: "vocabulary.add-meaning/v1",
  updateMeaning: "vocabulary.update-meaning/v1",
} as const);

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
  statements: D1PreparedStatement[];
  receiptGuard: VocabularyMutationReceiptGuard;
  conflictGuard?: VocabularyMutationReceiptGuard;
};

export type AddVocabularyEntryMutationArgs = {
  text: string;
  translation?: string;
  context?: string;
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

export type AddVocabularyEntryMutationResult = {
  ok: true;
  saved: true;
  text: string;
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

export class VocabularyMutationPlanError extends Error {
  readonly code = "invalid_input";

  constructor(message: string) {
    super(message);
    this.name = "VocabularyMutationPlanError";
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

const ACTIVE_STATUS_SQL = "'to_learn', 'learning_now', 'learnt', 'learned'";

function defaultCreateId(kind: "meaning" | "phrase") {
  return `${kind}-${crypto.randomUUID()}`;
}

function invalid(message: string): never {
  throw new VocabularyMutationPlanError(message);
}

function assertUserId(userId: string) {
  if (typeof userId !== "string" || !userId.trim()) {
    invalid("User identity is invalid.");
  }
}

function cleanSingleLine(value: unknown, maximum: number, label: string) {
  if (typeof value !== "string") invalid(`${label} is invalid.`);
  const cleaned = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
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
  const cleaned = value.normalize("NFKC").trim().replace(/\r\n?/gu, "\n");
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
    const statements: D1PreparedStatement[] = [];

    statements.push(db.prepare(`
      INSERT OR IGNORE INTO phrases (
        id, text, pattern, ipa, translation, context, source_type, catalog_order,
        owner_id, status, created_at, updated_at
      )
      SELECT ?, ?, ?, '', ?, ?, 'custom', NULL, ?, 'pick', ?, ?
      WHERE NOT EXISTS (
        SELECT 1
        FROM phrases
        WHERE text = ? COLLATE NOCASE
          AND (source_type = 'preset' OR owner_id = ?)
      )
    `).bind(
      createId("phrase"),
      text,
      text,
      translation || "",
      context || "",
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
        updated_at = CASE
          WHEN phrase_progress.status = 'pick' THEN excluded.updated_at
          ELSE phrase_progress.updated_at
        END
    `).bind(userId, timestamp, timestamp, text, userId, userId));

    statements.push(db.prepare(`
      UPDATE phrases
      SET
        translation = ?,
        context = CASE WHEN ? = 1 THEN ? ELSE context END,
        updated_at = ?
      WHERE id = (
        SELECT candidate.id
        FROM phrases AS candidate
        WHERE candidate.text = ? COLLATE NOCASE
          AND (candidate.source_type = 'preset' OR candidate.owner_id = ?)
        ORDER BY CASE WHEN candidate.owner_id = ? THEN 0 ELSE 1 END, candidate.id
        LIMIT 1
      )
        AND source_type = 'custom'
        AND owner_id = ?
        AND TRIM(translation) = ''
        AND ? <> ''
    `).bind(
      translation || "",
      contextSupplied,
      context || "",
      timestamp,
      text,
      userId,
      userId,
      userId,
      translation || "",
    ));

    const existingLegacySatisfies = Boolean(
      translation
      && existing?.translation.trim()
      && normalizeVocabularyMeaning(existing.translation) === normalizedTranslation,
    );
    const plansConditionalPersonalMeaning = Boolean(
      translation && !existingLegacySatisfies,
    );

    if (plansConditionalPersonalMeaning) {
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
          AND (
            phrases.source_type = 'preset'
            OR (
              phrases.source_type = 'custom'
              AND phrases.owner_id = ?
              AND (
                phrases.translation <> ?
                OR (? = 1 AND phrases.context <> ?)
              )
            )
          )
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
        context || "",
        timestamp,
        timestamp,
        userId,
        text,
        userId,
        userId,
        translation,
        contextSupplied,
        context || "",
        userId,
        contextSupplied,
        contextSupplied,
      ));
    }

    const mayPersistLegacy = Boolean(translation && (
      existingLegacySatisfies
      || !existing
      || (existing.source_type === "custom" && !existing.translation.trim())
    ));
    const expectedLegacyTranslation = existingLegacySatisfies
      ? existing?.translation || ""
      : translation || "";
    const legacyScope = existingLegacySatisfies ? "visible" : "owned_custom";
    const expectedLegacyContext = existingLegacySatisfies
      ? existing?.context || ""
      : context || "";
    const legacyContextMustMatch = existingLegacySatisfies ? 0 : contextSupplied;

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
            OR (
              ? = 1
              AND phrases.translation = ?
              AND (
                ? = 'visible'
                OR (
                  ? = 'owned_custom'
                  AND phrases.source_type = 'custom'
                  AND phrases.owner_id = ?
                )
              )
              AND (? = 0 OR phrases.context = ?)
            )
            OR (
              ? = 1
              AND EXISTS (
                SELECT 1
                FROM phrase_meanings
                WHERE phrase_meanings.user_id = ?
                  AND phrase_meanings.phrase_id = phrases.id
                  AND phrase_meanings.normalized_translation = ?
                  AND phrase_meanings.translation = ?
                  AND (? = 0 OR phrase_meanings.context = ?)
              )
            )
          )
      )`,
      bindings: [
        text,
        userId,
        userId,
        userId,
        translation ? 1 : 0,
        mayPersistLegacy ? 1 : 0,
        expectedLegacyTranslation,
        legacyScope,
        legacyScope,
        userId,
        legacyContextMustMatch,
        expectedLegacyContext,
        plansConditionalPersonalMeaning ? 1 : 0,
        userId,
        normalizedTranslation,
        translation || "",
        contextSupplied,
        context || "",
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
    const meaningId = cleanSingleLine(input.meaningId, 120, "Meaning identity");
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

  return {
    planAddEntry,
    planAddMeaning,
    planUpdateMeaning,
  };
}
