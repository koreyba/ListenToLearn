CREATE INDEX IF NOT EXISTS `idx_phrase_progress_user_status_created` ON `phrase_progress` (`user_id`, `status`, `created_at` DESC, `phrase_id` DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_phrase_meanings_user_phrase_created` ON `phrase_meanings` (`user_id`, `phrase_id`, `created_at`, `id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_saved_videos_user_updated_id` ON `saved_videos` (`user_id`, `updated_at` DESC, `id` ASC);
