import type {
  VocabularyMutationPlan,
  VocabularyMutationPlanReason,
} from "./mutations.ts";
import type {
  VocabularyChangeSetAction,
  VocabularyChangeSetMutationArgs,
  VocabularyChangeSetMutationResult,
  VocabularyChangeSetPublicItem,
} from "./change-set-planner.ts";

export function buildVocabularyChangeSetMutationPlan({
  actions,
  activeStatusSql,
  canonicalJsonLimit,
  changeSetLimit,
  db,
  invalid,
  now,
  operation,
  publicItems,
  userId,
}: {
  actions: VocabularyChangeSetAction[];
  activeStatusSql: string;
  canonicalJsonLimit: number;
  changeSetLimit: number;
  db: D1Database;
  invalid: (message: string, reason?: VocabularyMutationPlanReason) => never;
  now: () => string;
  operation: "vocabulary.change-set/v1";
  publicItems: VocabularyChangeSetPublicItem[];
  userId: string;
}): VocabularyMutationPlan<
  "vocabulary.change-set/v1",
  VocabularyChangeSetMutationArgs,
  VocabularyChangeSetMutationResult
> & { publicItems: VocabularyChangeSetPublicItem[] } {
const canonicalArgs: VocabularyChangeSetMutationArgs = { v: 1, actions };
const actionsJson = JSON.stringify(actions);
if (
  actions.length < 1
  || actions.length > changeSetLimit
  || JSON.stringify(canonicalArgs).length > canonicalJsonLimit
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
        WHEN json_extract(value, '$[4]') IN (${activeStatusSql})
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
    WHERE progress.status IN (${activeStatusSql})
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
        AND progress.status IN (${activeStatusSql})
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
        AND progress.status IN (${activeStatusSql})
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
        AND progress.status IN (${activeStatusSql})
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
        AND progress.status IN (${activeStatusSql})
    )
    ELSE 1
  END
)`;
return {
  operation,
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
