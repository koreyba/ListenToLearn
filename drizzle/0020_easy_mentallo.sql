ALTER TABLE `ai_chat_assistant_attempts` ADD `configured_provider` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_chat_assistant_attempts` ADD `configured_model` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
UPDATE `ai_chat_assistant_attempts`
SET
	`configured_provider` = COALESCE(NULLIF(`provider`, ''), 'unknown'),
	`configured_model` = COALESCE(
		NULLIF(json_extract(`usage_json`, '$.configuredModel'), ''),
		NULLIF(`model`, ''),
		'unknown'
	);
