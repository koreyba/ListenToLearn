CREATE TABLE `ai_chat_assistant_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`user_message_id` text NOT NULL,
	`assistant_message_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`status` text NOT NULL,
	`lease_expires_at` text NOT NULL,
	`provider` text,
	`model` text,
	`usage_json` text,
	`error_code` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chat_id`) REFERENCES `ai_chats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_message_id`) REFERENCES `ai_chat_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assistant_message_id`) REFERENCES `ai_chat_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ai_chat_assistant_attempts_number_check" CHECK("ai_chat_assistant_attempts"."attempt_number" > 0),
	CONSTRAINT "ai_chat_assistant_attempts_status_check" CHECK("ai_chat_assistant_attempts"."status" IN ('pending', 'complete', 'failed', 'expired')),
	CONSTRAINT "ai_chat_assistant_attempts_usage_json_check" CHECK("ai_chat_assistant_attempts"."usage_json" IS NULL OR (json_valid("ai_chat_assistant_attempts"."usage_json") AND length("ai_chat_assistant_attempts"."usage_json") <= 4096))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_chat_assistant_attempts_message_number` ON `ai_chat_assistant_attempts` (`assistant_message_id`,`attempt_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_chat_assistant_attempts_one_pending` ON `ai_chat_assistant_attempts` (`assistant_message_id`) WHERE "ai_chat_assistant_attempts"."status" = 'pending';--> statement-breakpoint
CREATE INDEX `idx_ai_chat_assistant_attempts_user_chat_created` ON `ai_chat_assistant_attempts` (`user_id`,`chat_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_chat_tool_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`user_message_id` text NOT NULL,
	`assistant_attempt_id` text NOT NULL,
	`provider_tool_call_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`args_json` text NOT NULL,
	`args_sha256` text NOT NULL,
	`status` text NOT NULL,
	`result_json` text,
	`error_code` text,
	`receipt_id` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chat_id`) REFERENCES `ai_chats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_message_id`) REFERENCES `ai_chat_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assistant_attempt_id`) REFERENCES `ai_chat_assistant_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`receipt_id`) REFERENCES `ai_chat_tool_mutation_receipts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ai_chat_tool_calls_status_check" CHECK("ai_chat_tool_calls"."status" IN ('received', 'succeeded', 'committed', 'replayed', 'rejected', 'failed')),
	CONSTRAINT "ai_chat_tool_calls_args_json_check" CHECK(json_valid("ai_chat_tool_calls"."args_json") AND length("ai_chat_tool_calls"."args_json") <= 4096),
	CONSTRAINT "ai_chat_tool_calls_result_json_check" CHECK("ai_chat_tool_calls"."result_json" IS NULL OR (json_valid("ai_chat_tool_calls"."result_json") AND length("ai_chat_tool_calls"."result_json") <= 8192)),
	CONSTRAINT "ai_chat_tool_calls_args_hash_check" CHECK(length("ai_chat_tool_calls"."args_sha256") = 64 AND "ai_chat_tool_calls"."args_sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "ai_chat_tool_calls_metadata_check" CHECK(length("ai_chat_tool_calls"."provider_tool_call_id") BETWEEN 1 AND 240 AND length("ai_chat_tool_calls"."tool_name") BETWEEN 1 AND 120)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_chat_tool_calls_attempt_provider_call` ON `ai_chat_tool_calls` (`assistant_attempt_id`,`provider_tool_call_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_chat_tool_calls_user_chat_created` ON `ai_chat_tool_calls` (`user_id`,`chat_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_chat_tool_calls_receipt` ON `ai_chat_tool_calls` (`receipt_id`);--> statement-breakpoint
CREATE TABLE `ai_chat_tool_mutation_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`user_message_id` text NOT NULL,
	`committed_by_attempt_id` text NOT NULL,
	`provider_tool_call_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`operation` text NOT NULL,
	`target_key` text NOT NULL,
	`args_json` text NOT NULL,
	`args_sha256` text NOT NULL,
	`status` text NOT NULL,
	`result_json` text NOT NULL,
	`error_code` text,
	`entity_type` text,
	`entity_id` text,
	`created_at` text NOT NULL,
	`completed_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chat_id`) REFERENCES `ai_chats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_message_id`) REFERENCES `ai_chat_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`committed_by_attempt_id`) REFERENCES `ai_chat_assistant_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ai_chat_tool_receipts_status_check" CHECK("ai_chat_tool_mutation_receipts"."status" IN ('committed', 'rejected')),
	CONSTRAINT "ai_chat_tool_receipts_args_json_check" CHECK(json_valid("ai_chat_tool_mutation_receipts"."args_json") AND length("ai_chat_tool_mutation_receipts"."args_json") <= 4096),
	CONSTRAINT "ai_chat_tool_receipts_result_json_check" CHECK(json_valid("ai_chat_tool_mutation_receipts"."result_json") AND length("ai_chat_tool_mutation_receipts"."result_json") <= 8192),
	CONSTRAINT "ai_chat_tool_receipts_args_hash_check" CHECK(length("ai_chat_tool_mutation_receipts"."args_sha256") = 64 AND "ai_chat_tool_mutation_receipts"."args_sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "ai_chat_tool_receipts_metadata_check" CHECK(length("ai_chat_tool_mutation_receipts"."provider_tool_call_id") BETWEEN 1 AND 240 AND length("ai_chat_tool_mutation_receipts"."tool_name") BETWEEN 1 AND 120 AND length("ai_chat_tool_mutation_receipts"."operation") BETWEEN 1 AND 120 AND length("ai_chat_tool_mutation_receipts"."target_key") BETWEEN 1 AND 1400),
	CONSTRAINT "ai_chat_tool_receipts_entity_check" CHECK("ai_chat_tool_mutation_receipts"."entity_id" IS NULL OR "ai_chat_tool_mutation_receipts"."entity_type" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_chat_tool_receipts_message_operation_target` ON `ai_chat_tool_mutation_receipts` (`user_message_id`,`operation`,`target_key`);--> statement-breakpoint
CREATE INDEX `idx_ai_chat_tool_receipts_user_chat_completed` ON `ai_chat_tool_mutation_receipts` (`user_id`,`chat_id`,`completed_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_chat_tool_receipts_attempt` ON `ai_chat_tool_mutation_receipts` (`committed_by_attempt_id`);
