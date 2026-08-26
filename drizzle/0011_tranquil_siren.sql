ALTER TABLE `saved_videos` ADD `resume_seconds` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saved_videos` ADD `resume_caption_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `saved_videos` ADD `resume_caption_text` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `saved_videos` ADD `progress_updated_at` text;