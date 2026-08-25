CREATE TABLE `saved_videos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`youtube_video_id` text NOT NULL,
	`origin_phrase_id` text,
	`origin_query` text DEFAULT '' NOT NULL,
	`origin_caption` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`origin_phrase_id`) REFERENCES `phrases`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_videos_user_youtube` ON `saved_videos` (`user_id`,`youtube_video_id`);--> statement-breakpoint
CREATE INDEX `idx_saved_videos_user_updated` ON `saved_videos` (`user_id`,`updated_at`);