import {
  normalizeVocabularyMeaning,
  readScopedLegacyMeaningId,
  scopedLegacyMeaningId,
  VOCABULARY_LEGACY_MEANING_ID,
  VOCABULARY_LIMITS,
  isVocabularyStoredTimestamp,
  isVocabularyCategoryFilter,
  vocabularyCategoryFromStatus,
  type VocabularyCategoryTarget,
  type VocabularyEntry,
  type VocabularyMeaning,
  type VocabularyMeaningList,
  type VocabularyCategoryFilter,
  type VocabularyPage,
  type VocabularyPageCursor,
  type VocabularyStatus,
} from "./contracts.ts";
import { createVocabularyMutationPlanner } from "./mutations.ts";

export type VocabularyRepositoryErrorCode =
  | "not_found"
  | "conflict"
  | "invalid_target";

export class VocabularyRepositoryError extends Error {
  readonly code: VocabularyRepositoryErrorCode;

  constructor(code: VocabularyRepositoryErrorCode, message: string) {
    super(message);
    this.name = "VocabularyRepositoryError";
    this.code = code;
  }
}

type RepositoryOptions = {
  createId?: (kind: "meaning" | "phrase") => string;
  now?: () => string;
};

type PhraseRow = {
  id: string;
  text: string;
  translation: string;
  context: string;
};

type MeaningRow = {
  id: string;
  translation: string;
  context: string;
};

export type VocabularyEntryForMeaning = VocabularyEntry & {
  selectedMeaning: VocabularyMeaning & {
    id: string;
    source: "legacy" | "personal";
  };
};

type BoundedMeaningRow = MeaningRow & {
  phrase_id: string;
  total_count: number;
};

type VocabularyEntryRow = {
  phrase_id: string;
  text: string;
  translation: string;
  context: string;
  source_type: "preset" | "custom";
  owner_id: string | null;
  status: VocabularyStatus;
  added_at: string;
  updated_at: string;
};

type VisibleVocabularyRow = Omit<VocabularyEntryRow, "status" | "added_at"> & {
  status: VocabularyStatus | "pick";
  added_at: string | null;
};

function fail(code: VocabularyRepositoryErrorCode, message: string): never {
  throw new VocabularyRepositoryError(code, message);
}

function cleanSingleLine(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

function cleanContext(value: string) {
  return value.normalize("NFC").trim().replace(/\r\n?/gu, "\n");
}

function boundedLimit(value: number, fallback: number) {
  return Number.isSafeInteger(value) && value > 0
    ? Math.min(value, VOCABULARY_LIMITS.readEntries)
    : fallback;
}

const ACTIVE_VOCABULARY_STATUSES = [
  "to_learn",
  "learning_now",
  "learnt",
  "learned",
] as const satisfies readonly VocabularyStatus[];

function statusesForCategory(
  category: VocabularyCategoryFilter,
): readonly VocabularyStatus[] {
  if (category === "to_learn") return ["to_learn"];
  if (category === "learning") return ["learning_now"];
  if (category === "learned") return ["learnt", "learned"];
  return ACTIVE_VOCABULARY_STATUSES;
}

function validPageCursor(value: VocabularyPageCursor | null | undefined) {
  if (value == null) return value === null || value === undefined;
  if (
    typeof value.phraseId !== "string"
    || !value.phraseId
    || [...value.phraseId].length > 120
    || /[\r\n\0]/u.test(value.phraseId)
    || !isVocabularyStoredTimestamp(value.addedAt)
  ) {
    return false;
  }
  return true;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/gu, (character) => `\\${character}`);
}

export const VOCABULARY_SEARCH_MAX_QUERY_CHARACTERS = 48;
export const VOCABULARY_SEARCH_MAX_PATTERN_BYTES = 50;

export function createVocabularySearchPattern(value: unknown): {
  query: string;
  normalizedQuery: string;
  pattern: string;
} | null {
  if (typeof value !== "string") return null;
  const query = cleanSingleLine(value);
  if (!query || [...query].length > VOCABULARY_SEARCH_MAX_QUERY_CHARACTERS) {
    return null;
  }
  const pattern = `%${escapeLike(query)}%`;
  if (new TextEncoder().encode(pattern).byteLength > VOCABULARY_SEARCH_MAX_PATTERN_BYTES) {
    return null;
  }
  return {
    query,
    normalizedQuery: normalizeVocabularyMeaning(query),
    pattern,
  };
}

function defaultCreateId(kind: "meaning" | "phrase") {
  return `${kind}-${crypto.randomUUID()}`;
}

function mapMeaning(row: MeaningRow): VocabularyMeaning {
  return {
    id: row.id,
    source: "personal",
    translation: row.translation,
    context: row.context,
  };
}

export function createVocabularyRepository(
  db: D1Database,
  options: RepositoryOptions = {},
) {
  const createId = options.createId || defaultCreateId;
  const now = options.now || (() => new Date().toISOString());

  async function visiblePhrase(userId: string, phraseId: string) {
    return db.prepare(`
      SELECT id, text, translation, context
      FROM phrases
      WHERE id = ? AND (source_type = 'preset' OR owner_id = ?)
      LIMIT 1
    `).bind(phraseId, userId).first<PhraseRow>();
  }

  async function listMeanings(
    userId: string,
    phraseId: string,
  ): Promise<VocabularyMeaningList | null> {
    const phrase = await visiblePhrase(userId, phraseId);
    if (!phrase) return null;
    const result = await db.prepare(`
      SELECT id, translation, context, total_count
      FROM (
        SELECT
          id,
          translation,
          context,
          created_at,
          COUNT(*) OVER () AS total_count
        FROM phrase_meanings
        WHERE user_id = ? AND phrase_id = ?
      ) AS owned_meanings
      ORDER BY created_at, id
      LIMIT ?
    `).bind(
      userId,
      phraseId,
      VOCABULARY_LIMITS.meaningList,
    ).all<MeaningRow & { total_count: number }>();
    const meanings: VocabularyMeaning[] = [];
    if (phrase.translation.trim()) {
      meanings.push({
        id: VOCABULARY_LEGACY_MEANING_ID,
        source: "legacy",
        translation: phrase.translation,
        context: phrase.context,
      });
    }
    meanings.push(...result.results.map(mapMeaning));
    const personalMeaningCount = Number(result.results[0]?.total_count || 0);
    return {
      phraseId: phrase.id,
      text: phrase.text,
      meanings,
      meaningCount: personalMeaningCount + (phrase.translation.trim() ? 1 : 0),
      meaningsTruncated: personalMeaningCount > result.results.length,
    };
  }

  async function addMeaning(
    userId: string,
    input: { phraseId: string; translation: string; context?: string },
  ): Promise<VocabularyMeaning> {
    if (!await visiblePhrase(userId, input.phraseId)) {
      fail("not_found", "Phrase not found.");
    }
    const translation = cleanSingleLine(input.translation);
    const normalizedTranslation = normalizeVocabularyMeaning(translation);
    if (
      !normalizedTranslation
      || [...translation].length > VOCABULARY_LIMITS.meaningCharacters
    ) {
      fail("invalid_target", "Meaning is invalid.");
    }
    const contextSupplied = input.context !== undefined;
    const context = contextSupplied ? cleanContext(input.context || "") : "";
    if ([...context].length > VOCABULARY_LIMITS.contextCharacters) {
      fail("invalid_target", "Meaning context is too long.");
    }
    const timestamp = now();
    await db.prepare(`
      INSERT INTO phrase_meanings (
        id, user_id, phrase_id, translation, normalized_translation, context, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, phrase_id, normalized_translation) DO UPDATE SET
        translation = excluded.translation,
        context = CASE
          WHEN ? = 1 THEN excluded.context
          ELSE phrase_meanings.context
        END,
        updated_at = excluded.updated_at
    `).bind(
      createId("meaning"),
      userId,
      input.phraseId,
      translation,
      normalizedTranslation,
      context,
      timestamp,
      timestamp,
      contextSupplied ? 1 : 0,
    ).run();
    const row = await db.prepare(`
      SELECT id, translation, context
      FROM phrase_meanings
      WHERE user_id = ? AND phrase_id = ? AND normalized_translation = ?
      LIMIT 1
    `).bind(userId, input.phraseId, normalizedTranslation).first<MeaningRow>();
    if (!row) fail("conflict", "Meaning could not be persisted.");
    return mapMeaning(row);
  }

  async function attachMeanings(
    userId: string,
    rows: readonly VocabularyEntryRow[],
  ): Promise<VocabularyEntry[]> {
    if (!rows.length) return [];
    const phraseIds = [...new Set(rows.map((row) => row.phrase_id))];
    const placeholders = phraseIds.map(() => "?").join(", ");
    const personalResult = await db.prepare(`
      SELECT phrase_id, id, translation, context, total_count
      FROM (
        SELECT
          phrase_id,
          id,
          translation,
          context,
          ROW_NUMBER() OVER (
            PARTITION BY phrase_id ORDER BY created_at, id
          ) AS meaning_rank,
          COUNT(*) OVER (PARTITION BY phrase_id) AS total_count
        FROM phrase_meanings
        WHERE user_id = ? AND phrase_id IN (${placeholders})
      ) AS ranked_meanings
      WHERE meaning_rank <= ?
      ORDER BY phrase_id, meaning_rank
    `).bind(
      userId,
      ...phraseIds,
      VOCABULARY_LIMITS.repositoryPersonalMeanings,
    ).all<BoundedMeaningRow>();
    const personalMeanings = new Map<string, BoundedMeaningRow[]>();
    for (const meaning of personalResult.results) {
      const current = personalMeanings.get(meaning.phrase_id) || [];
      current.push(meaning);
      personalMeanings.set(meaning.phrase_id, current);
    }
    return rows.map((row) => {
      const meanings: VocabularyMeaning[] = [];
      const personalRows = personalMeanings.get(row.phrase_id) || [];
      if (row.translation.trim()) {
        meanings.push({
          id: VOCABULARY_LEGACY_MEANING_ID,
          source: "legacy",
          translation: row.translation,
          context: row.context,
        });
      }
      meanings.push(...personalRows.map(mapMeaning));
      return {
        phraseId: row.phrase_id,
        text: row.text,
        status: row.status,
        sourceType: row.source_type,
        addedAt: row.added_at,
        updatedAt: row.updated_at,
        meanings,
        meaningCount: (row.translation.trim() ? 1 : 0)
          + Number(personalRows[0]?.total_count || 0),
      };
    });
  }

  async function getEntry(
    userId: string,
    phraseId: string,
  ): Promise<VocabularyEntry | null> {
    const row = await db.prepare(`
      SELECT
        phrases.id AS phrase_id,
        phrases.text,
        phrases.translation,
        phrases.context,
        phrases.source_type,
        phrases.owner_id,
        progress.status,
        progress.created_at AS added_at,
        progress.updated_at
      FROM phrase_progress AS progress
      JOIN phrases ON phrases.id = progress.phrase_id
      WHERE progress.user_id = ?
        AND progress.status IN ('to_learn', 'learning_now', 'learnt', 'learned')
        AND phrases.id = ?
        AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
      LIMIT 1
    `).bind(userId, phraseId, userId).first<VocabularyEntryRow>();
    if (!row) return null;
    return (await attachMeanings(userId, [row]))[0] || null;
  }

  async function getCategoryTarget(
    userId: string,
    phraseId: string,
  ): Promise<VocabularyCategoryTarget | null> {
    const row = await db.prepare(`
      SELECT phrases.id AS phrase_id, phrases.text, progress.status
      FROM phrase_progress AS progress
      JOIN phrases ON phrases.id = progress.phrase_id
      WHERE progress.user_id = ?
        AND progress.phrase_id = ?
        AND progress.status IN ('to_learn', 'learning_now', 'learnt', 'learned')
        AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
      LIMIT 1
    `).bind(userId, phraseId, userId).first<{
      phrase_id: string;
      text: string;
      status: VocabularyStatus;
    }>();
    return row
      ? {
          phraseId: row.phrase_id,
          text: row.text,
          storedStatus: row.status,
          category: vocabularyCategoryFromStatus(row.status),
        }
      : null;
  }

  async function getEntryForMeaning(
    userId: string,
    meaningId: string,
  ): Promise<VocabularyEntryForMeaning | null> {
    if (meaningId === VOCABULARY_LEGACY_MEANING_ID) return null;
    const scopedLegacyPhraseId = readScopedLegacyMeaningId(meaningId);
    if (scopedLegacyPhraseId) {
      const legacy = await db.prepare(`
        SELECT phrases.translation, phrases.context
        FROM phrases
        JOIN phrase_progress AS progress ON progress.phrase_id = phrases.id
        WHERE phrases.id = ? AND phrases.source_type = 'custom'
          AND phrases.owner_id = ? AND TRIM(phrases.translation) <> ''
          AND progress.user_id = ?
          AND progress.status IN ('to_learn', 'learning_now', 'learnt', 'learned')
        LIMIT 1
      `).bind(scopedLegacyPhraseId, userId, userId).first<{
        translation: string;
        context: string;
      }>();
      if (!legacy) return null;
      const entry = await getEntry(userId, scopedLegacyPhraseId);
      return entry
        ? {
            ...entry,
            selectedMeaning: {
              id: scopedLegacyMeaningId(scopedLegacyPhraseId),
              source: "legacy",
              translation: legacy.translation,
              context: legacy.context,
            },
          }
        : null;
    }
    const row = await db.prepare(`
      SELECT meanings.id, meanings.phrase_id, meanings.translation, meanings.context
      FROM phrase_meanings AS meanings
      JOIN phrase_progress AS progress
        ON progress.phrase_id = meanings.phrase_id AND progress.user_id = meanings.user_id
      JOIN phrases ON phrases.id = meanings.phrase_id
      WHERE meanings.id = ?
        AND meanings.user_id = ?
        AND progress.status IN ('to_learn', 'learning_now', 'learnt', 'learned')
        AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
      LIMIT 1
    `).bind(meaningId, userId, userId).first<MeaningRow & { phrase_id: string }>();
    if (!row) return null;
    const entry = await getEntry(userId, row.phrase_id);
    return entry
      ? {
          ...entry,
          selectedMeaning: {
            ...mapMeaning(row),
            id: row.id,
            source: "personal",
          },
        }
      : null;
  }

  async function listPage(
    userId: string,
    input: {
      category?: VocabularyCategoryFilter;
      limit?: number;
      cursor?: VocabularyPageCursor | null;
    } = {},
  ): Promise<VocabularyPage> {
    const category = input.category || "all";
    if (!isVocabularyCategoryFilter(category) || !validPageCursor(input.cursor)) {
      fail("invalid_target", "Vocabulary page is invalid.");
    }
    const limit = boundedLimit(input.limit || 0, 10);
    const statuses = statusesForCategory(category);
    const statusPlaceholders = statuses.map(() => "?").join(", ");
    const cursor = input.cursor || null;
    const cursorPredicate = cursor
      ? `AND (
          julianday(progress.created_at) < julianday(?)
          OR (
            julianday(progress.created_at) = julianday(?)
            AND phrases.id < ?
          )
        )`
      : "";
    const bindings: unknown[] = [userId, ...statuses, userId];
    if (cursor) bindings.push(cursor.addedAt, cursor.addedAt, cursor.phraseId);
    bindings.push(limit + 1);
    const result = await db.prepare(`
      SELECT
        phrases.id AS phrase_id,
        phrases.text,
        phrases.translation,
        phrases.context,
        phrases.source_type,
        phrases.owner_id,
        progress.status,
        progress.created_at AS added_at,
        progress.updated_at
      FROM phrase_progress AS progress
      JOIN phrases ON phrases.id = progress.phrase_id
      WHERE progress.user_id = ?
        AND progress.status IN (${statusPlaceholders})
        AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
        ${cursorPredicate}
      ORDER BY julianday(progress.created_at) DESC, phrases.id DESC
      LIMIT ?
    `).bind(...bindings).all<VocabularyEntryRow>();
    const pageRows = result.results.slice(0, limit);
    const entries = await attachMeanings(userId, pageRows);
    const hasMore = result.results.length > limit;
    const last = pageRows.at(-1);
    return {
      entries,
      hasMore,
      nextCursor: hasMore && last
        ? { addedAt: last.added_at, phraseId: last.phrase_id }
        : null,
    };
  }

  async function listRecent(userId: string, requestedLimit = 5) {
    return (await listPage(userId, {
      category: "all",
      limit: boundedLimit(requestedLimit, 5),
    })).entries;
  }

  async function search(userId: string, query: string, requestedLimit = 10) {
    const searchPattern = createVocabularySearchPattern(query);
    if (!searchPattern) return [];
    const {
      query: cleanedQuery,
      normalizedQuery,
      pattern,
    } = searchPattern;
    const limit = boundedLimit(requestedLimit, 10);
    const result = await db.prepare(`
      SELECT
        phrases.id AS phrase_id,
        phrases.text,
        phrases.translation,
        phrases.context,
        phrases.source_type,
        phrases.owner_id,
        progress.status,
        progress.created_at AS added_at,
        progress.updated_at
      FROM phrase_progress AS progress
      JOIN phrases ON phrases.id = progress.phrase_id
      WHERE progress.user_id = ?
        AND progress.status IN ('to_learn', 'learning_now', 'learnt', 'learned')
        AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
        AND (
          phrases.text LIKE ? ESCAPE '\\' COLLATE NOCASE
          OR phrases.translation LIKE ? ESCAPE '\\' COLLATE NOCASE
          OR EXISTS (
            SELECT 1
            FROM phrase_meanings AS matching_meanings
            WHERE matching_meanings.user_id = ?
              AND matching_meanings.phrase_id = phrases.id
              AND (
                matching_meanings.translation LIKE ? ESCAPE '\\' COLLATE NOCASE
                OR matching_meanings.normalized_translation = ?
              )
          )
        )
      ORDER BY
        CASE
          WHEN phrases.text = ? COLLATE NOCASE THEN 0
          WHEN phrases.translation = ? COLLATE NOCASE THEN 1
          WHEN EXISTS (
            SELECT 1
            FROM phrase_meanings AS exact_meanings
            WHERE exact_meanings.user_id = ?
              AND exact_meanings.phrase_id = phrases.id
              AND exact_meanings.normalized_translation = ?
          ) THEN 1
          ELSE 2
        END,
        progress.created_at DESC,
        phrases.id DESC
      LIMIT ?
    `).bind(
      userId,
      userId,
      pattern,
      pattern,
      userId,
      pattern,
      normalizedQuery,
      cleanedQuery,
      cleanedQuery,
      userId,
      normalizedQuery,
      limit,
    ).all<VocabularyEntryRow>();
    return attachMeanings(userId, result.results);
  }

  async function findVisibleByText(userId: string, text: string) {
    return db.prepare(`
      SELECT
        phrases.id AS phrase_id,
        phrases.text,
        phrases.translation,
        phrases.context,
        phrases.source_type,
        phrases.owner_id,
        COALESCE(progress.status, 'pick') AS status,
        progress.created_at AS added_at,
        COALESCE(progress.updated_at, phrases.updated_at) AS updated_at
      FROM phrases
      LEFT JOIN phrase_progress AS progress
        ON progress.phrase_id = phrases.id AND progress.user_id = ?
      WHERE phrases.text = ? COLLATE NOCASE
        AND (phrases.source_type = 'preset' OR phrases.owner_id = ?)
      ORDER BY CASE WHEN phrases.owner_id = ? THEN 0 ELSE 1 END, phrases.id
      LIMIT 1
    `).bind(userId, text, userId, userId).first<VisibleVocabularyRow>();
  }

  async function addEntry(
    userId: string,
    input: { text: string; translation?: string; context?: string },
  ): Promise<{ entry: VocabularyEntry; created: boolean }> {
    const text = cleanSingleLine(input.text);
    const translation = cleanSingleLine(input.translation || "");
    const context = input.context === undefined ? undefined : cleanContext(input.context);
    if (!text || [...text].length > VOCABULARY_LIMITS.entryTextCharacters) {
      fail("invalid_target", "Vocabulary text is invalid.");
    }
    if ([...translation].length > VOCABULARY_LIMITS.meaningCharacters) {
      fail("invalid_target", "Vocabulary translation is too long.");
    }
    if (context !== undefined && [...context].length > VOCABULARY_LIMITS.contextCharacters) {
      fail("invalid_target", "Vocabulary context is too long.");
    }

    const plan = await createVocabularyMutationPlanner(db, { createId, now }).planAddEntry(
      userId,
      {
        text,
        ...(translation ? { translation } : {}),
        ...(context === undefined ? {} : { context }),
      },
    );
    await db.batch(plan.statements);
    const persisted = await findVisibleByText(userId, text);
    if (!persisted) fail("conflict", "Vocabulary entry could not be persisted.");
    const entry = await getEntry(userId, persisted.phrase_id);
    if (!entry) fail("conflict", "Vocabulary entry could not be persisted.");
    return {
      entry,
      created: persisted.phrase_id === plan.candidateEntityId,
    };
  }

  async function updateMeaning(
    userId: string,
    input: {
      meaningId: string;
      phraseId: string;
      expectedTranslation: string;
      expectedContext: string;
      translation: string;
      context?: string;
    },
  ): Promise<VocabularyMeaning> {
    const meaningId = cleanSingleLine(input.meaningId);
    const phraseId = cleanSingleLine(input.phraseId);
    const expectedTranslation = cleanSingleLine(input.expectedTranslation);
    const expectedContext = cleanContext(input.expectedContext);
    const translation = cleanSingleLine(input.translation);
    const normalizedTranslation = normalizeVocabularyMeaning(translation);
    const suppliedContext = input.context === undefined ? undefined : cleanContext(input.context);
    if (
      !meaningId
      || !phraseId
      || !expectedTranslation
      || !normalizedTranslation
      || [...meaningId].length > 120
      || [...phraseId].length > 120
      || [...expectedTranslation].length > VOCABULARY_LIMITS.meaningCharacters
      || [...expectedContext].length > VOCABULARY_LIMITS.contextCharacters
      || [...translation].length > VOCABULARY_LIMITS.meaningCharacters
      || (suppliedContext !== undefined
        && [...suppliedContext].length > VOCABULARY_LIMITS.contextCharacters)
    ) {
      fail("invalid_target", "Meaning update is invalid.");
    }
    const current = await getEntryForMeaning(userId, meaningId);
    if (!current) fail("not_found", "Meaning not found.");
    if (
      current.phraseId !== phraseId
      || current.selectedMeaning.translation !== expectedTranslation
      || current.selectedMeaning.context !== expectedContext
    ) {
      fail("conflict", "Meaning changed before it could be updated.");
    }
    const context = suppliedContext === undefined ? expectedContext : suppliedContext;
    const timestamp = now();
    const result = await db.prepare(`
      UPDATE phrase_meanings
      SET translation = ?, normalized_translation = ?, context = ?, updated_at = ?
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
            AND progress.status IN ('to_learn', 'learning_now', 'learnt', 'learned')
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
      context,
      timestamp,
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
    ).run();
    if (Number(result.meta?.changes || 0) !== 1) {
      fail("conflict", "Meaning changed before it could be updated.");
    }
    const updated = await db.prepare(`
      SELECT id, translation, context
      FROM phrase_meanings
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `).bind(meaningId, userId).first<MeaningRow>();
    if (!updated) fail("conflict", "Meaning could not be updated.");
    return mapMeaning(updated);
  }

  return {
    addEntry,
    addMeaning,
    getCategoryTarget,
    getEntry,
    getEntryForMeaning,
    listMeanings,
    listPage,
    listRecent,
    search,
    updateMeaning,
  };
}

export {
  normalizeVocabularyMeaning,
  VOCABULARY_LEGACY_MEANING_ID,
  VOCABULARY_LIMITS,
  type VocabularyEntry,
  type VocabularyCategory,
  type VocabularyCategoryTarget,
  type VocabularyCategoryFilter,
  type VocabularyMeaning,
  type VocabularyMeaningList,
  type VocabularyPage,
  type VocabularyPageCursor,
  type VocabularyStatus,
} from "./contracts.ts";
