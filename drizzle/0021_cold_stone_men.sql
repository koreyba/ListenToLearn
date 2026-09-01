CREATE TABLE `ai_chat_vocabulary_write_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`user_message_id` text NOT NULL,
	`assistant_message_id` text NOT NULL,
	`origin_attempt_id` text NOT NULL,
	`origin_tool_call_id` text NOT NULL,
	`operation` text NOT NULL,
	`target_key` text NOT NULL,
	`mutation_input_json` text NOT NULL,
	`mutation_input_sha256` text NOT NULL,
	`public_json` text NOT NULL,
	`status` text NOT NULL,
	`result_json` text,
	`error_code` text,
	`receipt_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`decided_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chat_id`) REFERENCES `ai_chats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_message_id`) REFERENCES `ai_chat_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assistant_message_id`) REFERENCES `ai_chat_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`origin_attempt_id`) REFERENCES `ai_chat_assistant_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`origin_tool_call_id`) REFERENCES `ai_chat_tool_calls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`receipt_id`) REFERENCES `ai_chat_tool_mutation_receipts`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ai_chat_write_proposals_status_check" CHECK("ai_chat_vocabulary_write_proposals"."status" IN ('pending', 'committed', 'cancelled', 'conflict')),
	CONSTRAINT "ai_chat_write_proposals_input_json_check" CHECK(json_valid("ai_chat_vocabulary_write_proposals"."mutation_input_json") AND length("ai_chat_vocabulary_write_proposals"."mutation_input_json") <= 4096),
	CONSTRAINT "ai_chat_write_proposals_public_json_check" CHECK(json_valid("ai_chat_vocabulary_write_proposals"."public_json") AND length("ai_chat_vocabulary_write_proposals"."public_json") <= 4096),
	CONSTRAINT "ai_chat_write_proposals_result_json_check" CHECK("ai_chat_vocabulary_write_proposals"."result_json" IS NULL OR (json_valid("ai_chat_vocabulary_write_proposals"."result_json") AND length("ai_chat_vocabulary_write_proposals"."result_json") <= 8192)),
	CONSTRAINT "ai_chat_write_proposals_input_hash_check" CHECK(length("ai_chat_vocabulary_write_proposals"."mutation_input_sha256") = 64 AND "ai_chat_vocabulary_write_proposals"."mutation_input_sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "ai_chat_write_proposals_metadata_check" CHECK(length("ai_chat_vocabulary_write_proposals"."operation") BETWEEN 1 AND 120 AND length("ai_chat_vocabulary_write_proposals"."target_key") BETWEEN 1 AND 1400),
	CONSTRAINT "ai_chat_write_proposals_lifecycle_check" CHECK((
      "ai_chat_vocabulary_write_proposals"."status" = 'pending'
      AND "ai_chat_vocabulary_write_proposals"."result_json" IS NULL
      AND "ai_chat_vocabulary_write_proposals"."error_code" IS NULL
      AND "ai_chat_vocabulary_write_proposals"."receipt_id" IS NULL
      AND "ai_chat_vocabulary_write_proposals"."decided_at" IS NULL
    ) OR (
      "ai_chat_vocabulary_write_proposals"."status" = 'committed'
      AND "ai_chat_vocabulary_write_proposals"."result_json" IS NOT NULL
      AND "ai_chat_vocabulary_write_proposals"."error_code" IS NULL
      AND "ai_chat_vocabulary_write_proposals"."receipt_id" IS NOT NULL
      AND "ai_chat_vocabulary_write_proposals"."decided_at" IS NOT NULL
    ) OR (
      "ai_chat_vocabulary_write_proposals"."status" = 'cancelled'
      AND "ai_chat_vocabulary_write_proposals"."result_json" IS NULL
      AND "ai_chat_vocabulary_write_proposals"."error_code" IS NULL
      AND "ai_chat_vocabulary_write_proposals"."receipt_id" IS NULL
      AND "ai_chat_vocabulary_write_proposals"."decided_at" IS NOT NULL
    ) OR (
      "ai_chat_vocabulary_write_proposals"."status" = 'conflict'
      AND "ai_chat_vocabulary_write_proposals"."error_code" IS NOT NULL
      AND "ai_chat_vocabulary_write_proposals"."receipt_id" IS NULL
      AND "ai_chat_vocabulary_write_proposals"."decided_at" IS NOT NULL
    ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_chat_write_proposals_message_operation_target` ON `ai_chat_vocabulary_write_proposals` (`user_message_id`,`operation`,`target_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_chat_write_proposals_origin_call` ON `ai_chat_vocabulary_write_proposals` (`origin_tool_call_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_chat_write_proposals_user_chat_assistant_created` ON `ai_chat_vocabulary_write_proposals` (`user_id`,`chat_id`,`assistant_message_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_chat_write_proposals_receipt` ON `ai_chat_vocabulary_write_proposals` (`receipt_id`);