CREATE TABLE `integration_secrets` (
	`provider` text PRIMARY KEY NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
