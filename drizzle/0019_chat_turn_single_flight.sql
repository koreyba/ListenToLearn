UPDATE ai_chat_assistant_attempts AS duplicate
SET
	status = 'expired',
	error_code = 'provider_timeout',
	updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE duplicate.status = 'pending'
	AND EXISTS (
		SELECT 1
		FROM ai_chat_assistant_attempts AS keeper
		WHERE keeper.chat_id = duplicate.chat_id
			AND keeper.status = 'pending'
			AND (
				keeper.lease_expires_at > duplicate.lease_expires_at
				OR (
					keeper.lease_expires_at = duplicate.lease_expires_at
					AND keeper.created_at > duplicate.created_at
				)
				OR (
					keeper.lease_expires_at = duplicate.lease_expires_at
					AND keeper.created_at = duplicate.created_at
					AND keeper.id > duplicate.id
				)
			)
	);
--> statement-breakpoint
UPDATE ai_chat_messages AS messages
SET
	status = 'failed',
	error_code = 'provider_timeout',
	updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE messages.role = 'assistant'
	AND messages.status = 'pending'
	AND EXISTS (
		SELECT 1
		FROM ai_chat_assistant_attempts AS expired
		WHERE expired.assistant_message_id = messages.id
			AND expired.status = 'expired'
	)
	AND NOT EXISTS (
		SELECT 1
		FROM ai_chat_assistant_attempts AS active
		WHERE active.assistant_message_id = messages.id
			AND active.status = 'pending'
	);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_chat_assistant_attempts_one_pending_chat` ON `ai_chat_assistant_attempts` (`chat_id`) WHERE "ai_chat_assistant_attempts"."status" = 'pending';
