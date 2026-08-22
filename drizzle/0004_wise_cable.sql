CREATE TABLE `managed_character_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_character_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source_mode` text DEFAULT 'form' NOT NULL,
	`definition_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_managed_character_messages_sender_status` ON `managed_character_messages` (`sender_character_id`,`status`);