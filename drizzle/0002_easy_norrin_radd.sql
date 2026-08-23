CREATE TABLE `phrase_examples` (
	`id` text PRIMARY KEY NOT NULL,
	`phrase_id` text NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`query` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`accent` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`phrase_id`) REFERENCES `phrases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_phrase_examples_phrase_provider_external` ON `phrase_examples` (`phrase_id`,`provider`,`external_id`);