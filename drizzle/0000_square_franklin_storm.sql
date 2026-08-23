CREATE TABLE `phrases` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`pattern` text NOT NULL,
	`ipa` text DEFAULT '' NOT NULL,
	`source_type` text NOT NULL,
	`catalog_order` integer,
	`status` text DEFAULT 'pick' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
