ALTER TABLE `saved_videos` ADD `language` text DEFAULT 'english' NOT NULL;--> statement-breakpoint
ALTER TABLE `saved_videos` ADD `accent` text DEFAULT '' NOT NULL;