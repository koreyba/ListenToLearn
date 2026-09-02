import {
  VOCABULARY_LEGACY_MEANING_ID,
  normalizeVocabularyMeaning,
  type VocabularyMeaning,
} from "./contracts.ts";

export type VocabularyPracticeMeaningMode = "all_saved" | "selected" | "explore";

export type VocabularySavedPracticeTarget = {
  phraseId: string;
  meaningMode: VocabularyPracticeMeaningMode;
  selectedMeaningId?: string;
};

export type VocabularyPracticeTargetDraft = {
  phraseId: string | null;
  text: string;
  meaningMode: VocabularyPracticeMeaningMode;
  selectedMeaningId: string | null;
  selectedMeaningSnapshot: string;
};

export type VocabularyPracticeItem = {
  id: string;
  phraseId: string | null;
  text: string;
  meaningMode: VocabularyPracticeMeaningMode;
  selectedMeaningId: string | null;
  selectedMeaningSnapshot: string;
  selectedMeaning: VocabularyMeaning | null;
  knownMeanings: VocabularyMeaning[];
  createdAt: string;
  updatedAt: string;
};

export class VocabularyPracticeReaderError extends Error {
  readonly code = "invalid_target" as const;

  constructor(message: string) {
    super(message);
    this.name = "VocabularyPracticeReaderError";
  }
}

type VocabularyPracticeReaderOptions = {
  meaningsPerTarget: number;
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

type PracticeItemRow = {
  item_id: string;
  phrase_id: string | null;
  text_snapshot: string;
  meaning_mode: VocabularyPracticeMeaningMode;
  selected_meaning_id: string | null;
  selected_meaning_snapshot: string;
  item_created_at: string;
  item_updated_at: string;
  legacy_translation: string | null;
  legacy_context: string | null;
  meaning_id: string | null;
  meaning_translation: string | null;
  meaning_context: string | null;
};

function invalidTarget(message: string): never {
  throw new VocabularyPracticeReaderError(message);
}

export function createVocabularyPracticeReader(
  db: D1Database,
  options: VocabularyPracticeReaderOptions,
) {
  async function visiblePhrase(userId: string, phraseId: string) {
    return db.prepare(`
      SELECT id, text, translation, context
      FROM phrases
      WHERE id = ? AND (source_type = 'preset' OR owner_id = ?)
      LIMIT 1
    `).bind(phraseId, userId).first<PhraseRow>();
  }

  async function resolveSavedTarget(
    userId: string,
    input: VocabularySavedPracticeTarget,
  ): Promise<VocabularyPracticeTargetDraft> {
    const phrase = await visiblePhrase(userId, input.phraseId);
    if (!phrase) invalidTarget("Saved target is not visible.");
    if (input.meaningMode !== "selected") {
      return {
        phraseId: phrase.id,
        text: phrase.text,
        meaningMode: input.meaningMode,
        selectedMeaningId: null,
        selectedMeaningSnapshot: "",
      };
    }

    if (input.selectedMeaningId === VOCABULARY_LEGACY_MEANING_ID) {
      if (!phrase.translation.trim()) {
        invalidTarget("This target has no legacy meaning to select.");
      }
      return {
        phraseId: phrase.id,
        text: phrase.text,
        meaningMode: "selected",
        selectedMeaningId: null,
        selectedMeaningSnapshot: phrase.translation,
      };
    }

    const selectedMeaning = await db.prepare(`
      SELECT id, translation, context
      FROM phrase_meanings
      WHERE id = ? AND user_id = ? AND phrase_id = ?
      LIMIT 1
    `).bind(input.selectedMeaningId || "", userId, phrase.id).first<MeaningRow>();
    if (!selectedMeaning) {
      invalidTarget("Selected meaning is not owned for this target.");
    }
    return {
      phraseId: phrase.id,
      text: phrase.text,
      meaningMode: "selected",
      selectedMeaningId: selectedMeaning.id,
      selectedMeaningSnapshot: selectedMeaning.translation,
    };
  }

  async function resolveSavedTargets(
    userId: string,
    inputs: readonly VocabularySavedPracticeTarget[],
  ): Promise<VocabularyPracticeTargetDraft[]> {
    if (inputs.length === 0) return [];
    if (inputs.length === 1) {
      return [await resolveSavedTarget(userId, inputs[0])];
    }

    const uniquePhraseIds = [...new Set(inputs.map((i) => i.phraseId))];
    const phrasePlaceholders = uniquePhraseIds.map(() => "?").join(", ");
    const phraseResults = await db.prepare(`
      SELECT id, text, translation, context
      FROM phrases
      WHERE id IN (${phrasePlaceholders}) AND (source_type = 'preset' OR owner_id = ?)
    `).bind(...uniquePhraseIds, userId).all<PhraseRow>();

    const phrasesById = new Map<string, PhraseRow>();
    for (const phrase of phraseResults.results) {
      phrasesById.set(phrase.id, phrase);
    }

    for (const input of inputs) {
      if (!phrasesById.has(input.phraseId)) {
        invalidTarget("Saved target is not visible.");
      }
    }

    const selectedMeaningInputs = inputs.filter(
      (i) => i.meaningMode === "selected" && i.selectedMeaningId && i.selectedMeaningId !== VOCABULARY_LEGACY_MEANING_ID,
    );

    const meaningsById = new Map<string, MeaningRow>();
    if (selectedMeaningInputs.length > 0) {
      const uniqueMeaningIds = [...new Set(selectedMeaningInputs.map((i) => i.selectedMeaningId!))];
      const meaningPlaceholders = uniqueMeaningIds.map(() => "?").join(", ");
      const meaningResults = await db.prepare(`
        SELECT id, phrase_id, translation, context
        FROM phrase_meanings
        WHERE id IN (${meaningPlaceholders}) AND user_id = ?
      `).bind(...uniqueMeaningIds, userId).all<MeaningRow & { phrase_id: string }>();

      for (const meaning of meaningResults.results) {
        meaningsById.set(`${meaning.phrase_id}:${meaning.id}`, meaning);
      }
    }

    return inputs.map((input) => {
      const phrase = phrasesById.get(input.phraseId)!;
      if (input.meaningMode !== "selected") {
        return {
          phraseId: phrase.id,
          text: phrase.text,
          meaningMode: input.meaningMode,
          selectedMeaningId: null,
          selectedMeaningSnapshot: "",
        };
      }

      if (input.selectedMeaningId === VOCABULARY_LEGACY_MEANING_ID) {
        if (!phrase.translation.trim()) {
          invalidTarget("This target has no legacy meaning to select.");
        }
        return {
          phraseId: phrase.id,
          text: phrase.text,
          meaningMode: "selected",
          selectedMeaningId: null,
          selectedMeaningSnapshot: phrase.translation,
        };
      }

      const selectedMeaning = meaningsById.get(`${phrase.id}:${input.selectedMeaningId || ""}`);
      if (!selectedMeaning) {
        invalidTarget("Selected meaning is not owned for this target.");
      }
      return {
        phraseId: phrase.id,
        text: phrase.text,
        meaningMode: "selected",
        selectedMeaningId: selectedMeaning.id,
        selectedMeaningSnapshot: selectedMeaning.translation,
      };
    });
  }

  async function readCurrentItems(
    userId: string,
    chatId: string,
  ): Promise<VocabularyPracticeItem[]> {
    const result = await db.prepare(`
      WITH owned_items AS (
        SELECT items.*, items.rowid AS item_rowid
        FROM ai_chat_practice_items AS items
        JOIN ai_chats AS chats ON chats.id = items.chat_id
        WHERE items.chat_id = ? AND chats.user_id = ?
      ),
      ranked_meanings AS (
        SELECT
          meanings.id,
          meanings.phrase_id,
          meanings.translation,
          meanings.context,
          ROW_NUMBER() OVER (
            PARTITION BY meanings.phrase_id
            ORDER BY meanings.created_at, meanings.id
          ) AS meaning_rank
        FROM phrase_meanings AS meanings
        WHERE meanings.user_id = ?
          AND EXISTS (
            SELECT 1
            FROM owned_items
            WHERE owned_items.phrase_id = meanings.phrase_id
          )
      )
      SELECT
        items.id AS item_id,
        items.phrase_id,
        items.text_snapshot,
        items.meaning_mode,
        items.selected_meaning_id,
        items.selected_meaning_snapshot,
        items.created_at AS item_created_at,
        items.updated_at AS item_updated_at,
        phrases.translation AS legacy_translation,
        phrases.context AS legacy_context,
        meanings.id AS meaning_id,
        meanings.translation AS meaning_translation,
        meanings.context AS meaning_context
      FROM owned_items AS items
      LEFT JOIN phrases ON phrases.id = items.phrase_id
      LEFT JOIN ranked_meanings AS meanings
        ON meanings.phrase_id = items.phrase_id
        AND (
          (
            items.meaning_mode = 'selected'
            AND meanings.id = items.selected_meaning_id
          )
          OR (
            items.meaning_mode <> 'selected'
            AND meanings.meaning_rank
              + CASE WHEN TRIM(COALESCE(phrases.translation, '')) <> '' THEN 1 ELSE 0 END
              <= ?
          )
        )
      ORDER BY items.created_at, items.item_rowid, meanings.meaning_rank
    `).bind(chatId, userId, userId, options.meaningsPerTarget).all<PracticeItemRow>();

    const targets: VocabularyPracticeItem[] = [];
    const byId = new Map<string, VocabularyPracticeItem>();
    for (const row of result.results) {
      let target = byId.get(row.item_id);
      if (!target) {
        const legacySnapshot = normalizeVocabularyMeaning(row.selected_meaning_snapshot);
        const selectedMeaningIsLegacy = row.meaning_mode === "selected"
          && row.selected_meaning_id === null
          && Boolean(legacySnapshot)
          && legacySnapshot === normalizeVocabularyMeaning(row.legacy_translation || "");
        const selectedMeaning: VocabularyMeaning | null = row.meaning_mode === "selected"
          ? {
              id: selectedMeaningIsLegacy ? VOCABULARY_LEGACY_MEANING_ID : row.selected_meaning_id,
              source: selectedMeaningIsLegacy ? "legacy" : "personal",
              translation: row.selected_meaning_snapshot,
              context: selectedMeaningIsLegacy ? row.legacy_context || "" : "",
            }
          : null;
        target = {
          id: row.item_id,
          phraseId: row.phrase_id,
          text: row.text_snapshot,
          meaningMode: row.meaning_mode,
          selectedMeaningId: row.selected_meaning_id,
          selectedMeaningSnapshot: row.selected_meaning_snapshot,
          selectedMeaning,
          knownMeanings: [],
          createdAt: row.item_created_at,
          updatedAt: row.item_updated_at,
        };
        if (row.meaning_mode !== "selected" && row.legacy_translation?.trim()) {
          target.knownMeanings.push({
            id: VOCABULARY_LEGACY_MEANING_ID,
            source: "legacy",
            translation: row.legacy_translation,
            context: row.legacy_context || "",
          });
        }
        targets.push(target);
        byId.set(row.item_id, target);
      }
      if (
        row.meaning_mode === "selected"
        && row.selected_meaning_id
        && row.meaning_id === row.selected_meaning_id
        && target.selectedMeaning
      ) {
        target.selectedMeaning.context = row.meaning_context || "";
      }
      if (
        row.meaning_mode !== "selected"
        && row.meaning_id
        && row.meaning_translation !== null
      ) {
        target.knownMeanings.push({
          id: row.meaning_id,
          source: "personal",
          translation: row.meaning_translation,
          context: row.meaning_context || "",
        });
      }
    }
    return targets;
  }

  return { resolveSavedTarget, resolveSavedTargets, readCurrentItems };
}
