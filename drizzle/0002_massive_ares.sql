CREATE TABLE `managed_dialogue_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source_mode` text DEFAULT 'form' NOT NULL,
	`definition_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_managed_dialogue_character_status` ON `managed_dialogue_profiles` (`character_id`,`status`);--> statement-breakpoint
CREATE TABLE `managed_gifts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source_mode` text DEFAULT 'form' NOT NULL,
	`definition_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_managed_gifts_status` ON `managed_gifts` (`status`);