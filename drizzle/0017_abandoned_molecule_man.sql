CREATE TABLE `__migration_0017_phrase_members` (
	`member_id` text PRIMARY KEY NOT NULL,
	`canonical_id` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__migration_0017_phrase_members` (`member_id`, `canonical_id`)
SELECT
	member.id,
	(
		SELECT candidate.id
		FROM phrases AS candidate
		WHERE candidate.source_type = 'custom'
			AND candidate.owner_id = member.owner_id
			AND candidate.text = member.text COLLATE NOCASE
		ORDER BY candidate.created_at, candidate.id
		LIMIT 1
	)
FROM phrases AS member
WHERE member.source_type = 'custom'
	AND member.owner_id IS NOT NULL;
--> statement-breakpoint
UPDATE phrases AS canonical
SET
	translation = CASE
		WHEN TRIM(canonical.translation) <> '' THEN canonical.translation
		ELSE COALESCE((
			SELECT member.translation
			FROM phrases AS member
			JOIN `__migration_0017_phrase_members` AS membership
				ON membership.member_id = member.id
			WHERE membership.canonical_id = canonical.id
				AND TRIM(member.translation) <> ''
			ORDER BY member.created_at, member.id
			LIMIT 1
		), '')
	END,
	context = CASE
		WHEN TRIM(canonical.context) <> '' THEN canonical.context
		ELSE COALESCE((
			SELECT member.context
			FROM phrases AS member
			JOIN `__migration_0017_phrase_members` AS membership
				ON membership.member_id = member.id
			WHERE membership.canonical_id = canonical.id
				AND TRIM(member.context) <> ''
			ORDER BY member.created_at, member.id
			LIMIT 1
		), '')
	END,
	updated_at = COALESCE((
		SELECT MAX(member.updated_at)
		FROM phrases AS member
		JOIN `__migration_0017_phrase_members` AS membership
			ON membership.member_id = member.id
		WHERE membership.canonical_id = canonical.id
	), canonical.updated_at)
WHERE canonical.id IN (
	SELECT canonical_id FROM `__migration_0017_phrase_members`
);
--> statement-breakpoint
INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
SELECT
	progress.user_id,
	membership.canonical_id,
	progress.status,
	progress.created_at,
	progress.updated_at
FROM phrase_progress AS progress
JOIN `__migration_0017_phrase_members` AS membership
	ON membership.member_id = progress.phrase_id
WHERE 1
ON CONFLICT(user_id, phrase_id) DO UPDATE SET
	status = CASE
		WHEN excluded.updated_at >= phrase_progress.updated_at THEN excluded.status
		ELSE phrase_progress.status
	END,
	created_at = MIN(phrase_progress.created_at, excluded.created_at),
	updated_at = MAX(phrase_progress.updated_at, excluded.updated_at);
--> statement-breakpoint
DELETE FROM phrase_progress
WHERE phrase_id IN (
	SELECT member_id
	FROM `__migration_0017_phrase_members`
	WHERE member_id <> canonical_id
);
--> statement-breakpoint
DELETE FROM phrase_examples AS duplicate
WHERE duplicate.phrase_id IN (
	SELECT member_id FROM `__migration_0017_phrase_members`
)
	AND duplicate.id <> (
		SELECT candidate.id
		FROM phrase_examples AS candidate
		JOIN `__migration_0017_phrase_members` AS candidate_membership
			ON candidate_membership.member_id = candidate.phrase_id
		JOIN `__migration_0017_phrase_members` AS duplicate_membership
			ON duplicate_membership.member_id = duplicate.phrase_id
		WHERE candidate_membership.canonical_id = duplicate_membership.canonical_id
			AND candidate.user_id = duplicate.user_id
			AND candidate.provider = duplicate.provider
			AND candidate.external_id = duplicate.external_id
		ORDER BY candidate.created_at, candidate.id
		LIMIT 1
	);
--> statement-breakpoint
UPDATE phrase_examples
SET phrase_id = (
	SELECT canonical_id
	FROM `__migration_0017_phrase_members`
	WHERE member_id = phrase_examples.phrase_id
)
WHERE phrase_id IN (
	SELECT member_id FROM `__migration_0017_phrase_members`
);
--> statement-breakpoint
UPDATE saved_videos
SET origin_phrase_id = (
	SELECT canonical_id
	FROM `__migration_0017_phrase_members`
	WHERE member_id = saved_videos.origin_phrase_id
)
WHERE origin_phrase_id IN (
	SELECT member_id FROM `__migration_0017_phrase_members`
);
--> statement-breakpoint
DELETE FROM catalog_phrase_analysis AS duplicate
WHERE duplicate.phrase_id IN (
	SELECT member_id FROM `__migration_0017_phrase_members`
)
	AND duplicate.phrase_id <> (
		SELECT candidate.phrase_id
		FROM catalog_phrase_analysis AS candidate
		JOIN `__migration_0017_phrase_members` AS candidate_membership
			ON candidate_membership.member_id = candidate.phrase_id
		JOIN `__migration_0017_phrase_members` AS duplicate_membership
			ON duplicate_membership.member_id = duplicate.phrase_id
		WHERE candidate_membership.canonical_id = duplicate_membership.canonical_id
		ORDER BY candidate.phrase_id
		LIMIT 1
	);
--> statement-breakpoint
UPDATE catalog_phrase_analysis
SET phrase_id = (
	SELECT canonical_id
	FROM `__migration_0017_phrase_members`
	WHERE member_id = catalog_phrase_analysis.phrase_id
)
WHERE phrase_id IN (
	SELECT member_id FROM `__migration_0017_phrase_members`
);
--> statement-breakpoint
DELETE FROM phrase_mechanisms AS duplicate
WHERE duplicate.phrase_id IN (
	SELECT member_id FROM `__migration_0017_phrase_members`
)
	AND duplicate.phrase_id <> (
		SELECT candidate.phrase_id
		FROM phrase_mechanisms AS candidate
		JOIN `__migration_0017_phrase_members` AS candidate_membership
			ON candidate_membership.member_id = candidate.phrase_id
		JOIN `__migration_0017_phrase_members` AS duplicate_membership
			ON duplicate_membership.member_id = duplicate.phrase_id
		WHERE candidate_membership.canonical_id = duplicate_membership.canonical_id
			AND candidate.mechanism = duplicate.mechanism
		ORDER BY candidate.phrase_id
		LIMIT 1
	);
--> statement-breakpoint
UPDATE phrase_mechanisms
SET phrase_id = (
	SELECT canonical_id
	FROM `__migration_0017_phrase_members`
	WHERE member_id = phrase_mechanisms.phrase_id
)
WHERE phrase_id IN (
	SELECT member_id FROM `__migration_0017_phrase_members`
);
--> statement-breakpoint
CREATE TABLE `__migration_0017_meaning_members` (
	`member_id` text PRIMARY KEY NOT NULL,
	`canonical_id` text NOT NULL,
	`canonical_phrase_id` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__migration_0017_meaning_members` (
	`member_id`, `canonical_id`, `canonical_phrase_id`
)
SELECT
	meaning.id,
	(
		SELECT candidate.id
		FROM phrase_meanings AS candidate
		JOIN `__migration_0017_phrase_members` AS candidate_membership
			ON candidate_membership.member_id = candidate.phrase_id
		WHERE candidate_membership.canonical_id = membership.canonical_id
			AND candidate.user_id = meaning.user_id
			AND candidate.normalized_translation = meaning.normalized_translation
		ORDER BY candidate.created_at, candidate.id
		LIMIT 1
	),
	membership.canonical_id
FROM phrase_meanings AS meaning
JOIN `__migration_0017_phrase_members` AS membership
	ON membership.member_id = meaning.phrase_id;
--> statement-breakpoint
UPDATE ai_chat_practice_items
SET selected_meaning_id = (
	SELECT canonical_id
	FROM `__migration_0017_meaning_members`
	WHERE member_id = ai_chat_practice_items.selected_meaning_id
)
WHERE selected_meaning_id IN (
	SELECT member_id FROM `__migration_0017_meaning_members`
);
--> statement-breakpoint
DELETE FROM phrase_meanings
WHERE id IN (
	SELECT member_id
	FROM `__migration_0017_meaning_members`
	WHERE member_id <> canonical_id
);
--> statement-breakpoint
UPDATE phrase_meanings
SET phrase_id = (
	SELECT canonical_phrase_id
	FROM `__migration_0017_meaning_members`
	WHERE member_id = phrase_meanings.id
)
WHERE id IN (
	SELECT canonical_id FROM `__migration_0017_meaning_members`
);
--> statement-breakpoint
UPDATE ai_chat_practice_items
SET phrase_id = (
	SELECT canonical_id
	FROM `__migration_0017_phrase_members`
	WHERE member_id = ai_chat_practice_items.phrase_id
)
WHERE phrase_id IN (
	SELECT member_id FROM `__migration_0017_phrase_members`
);
--> statement-breakpoint
DELETE FROM phrases
WHERE id IN (
	SELECT member_id
	FROM `__migration_0017_phrase_members`
	WHERE member_id <> canonical_id
);
--> statement-breakpoint
DROP TABLE `__migration_0017_meaning_members`;
--> statement-breakpoint
DROP TABLE `__migration_0017_phrase_members`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_phrases_custom_owner_text_nocase` ON `phrases` (`owner_id`, "text" COLLATE NOCASE) WHERE "phrases"."source_type" = 'custom' AND "phrases"."owner_id" IS NOT NULL;
