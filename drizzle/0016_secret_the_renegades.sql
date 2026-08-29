CREATE TABLE `ai_chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`role` text NOT NULL,
	`sequence` integer NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`practice_context_json` text DEFAULT '[]' NOT NULL,
	`client_message_id` text NOT NULL,
	`provider` text,
	`model` text,
	`usage_json` text,
	`error_code` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `ai_chats`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ai_chat_messages_role_check" CHECK("ai_chat_messages"."role" IN ('user', 'assistant')),
	CONSTRAINT "ai_chat_messages_status_check" CHECK("ai_chat_messages"."status" IN ('complete', 'pending', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `idx_ai_chat_messages_chat_sequence` ON `ai_chat_messages` (`chat_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_chat_messages_chat_sequence_unique` ON `ai_chat_messages` (`chat_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_chat_messages_chat_client_role` ON `ai_chat_messages` (`chat_id`,`client_message_id`,`role`);--> statement-breakpoint
CREATE TABLE `ai_chat_practice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`phrase_id` text,
	`text_snapshot` text NOT NULL,
	`meaning_mode` text NOT NULL,
	`selected_meaning_id` text,
	`selected_meaning_snapshot` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `ai_chats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`phrase_id`) REFERENCES `phrases`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`selected_meaning_id`) REFERENCES `phrase_meanings`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ai_chat_practice_items_meaning_mode_check" CHECK("ai_chat_practice_items"."meaning_mode" IN ('all_saved', 'selected', 'explore'))
);
--> statement-breakpoint
CREATE INDEX `idx_ai_chat_practice_items_chat_created` ON `ai_chat_practice_items` (`chat_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_chats` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`explanation_language` text DEFAULT 'ru' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ai_chats_user_updated` ON `ai_chats` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `phrase_meanings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`phrase_id` text NOT NULL,
	`translation` text NOT NULL,
	`normalized_translation` text NOT NULL,
	`context` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`phrase_id`) REFERENCES `phrases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_phrase_meanings_user_phrase_updated` ON `phrase_meanings` (`user_id`,`phrase_id`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_phrase_meanings_user_phrase_normalized` ON `phrase_meanings` (`user_id`,`phrase_id`,`normalized_translation`);