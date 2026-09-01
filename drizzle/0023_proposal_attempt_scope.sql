DROP INDEX `idx_ai_chat_write_proposals_message_operation_target`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_chat_write_proposals_attempt_operation_target` ON `ai_chat_vocabulary_write_proposals` (`origin_attempt_id`,`operation`,`target_key`);
