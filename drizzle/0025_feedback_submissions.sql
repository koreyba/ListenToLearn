CREATE TABLE `feedback_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`message` text NOT NULL,
	`page_url` text NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`telegram_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`telegram_delivered_at` text,
	CONSTRAINT "feedback_submissions_category_check" CHECK("feedback_submissions"."category" IN ('bug', 'idea', 'other')),
	CONSTRAINT "feedback_submissions_message_check" CHECK(length("feedback_submissions"."message") BETWEEN 1 AND 2000),
	CONSTRAINT "feedback_submissions_telegram_status_check" CHECK("feedback_submissions"."telegram_status" IN ('pending', 'sent', 'not_configured', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `idx_feedback_created` ON `feedback_submissions` (`created_at` DESC);
