CREATE TABLE `managed_global_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source_mode` text DEFAULT 'form' NOT NULL,
	`definition_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_managed_global_keys_status` ON `managed_global_keys` (`status`);