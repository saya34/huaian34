CREATE TABLE `managed_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`character_id` text NOT NULL,
	`scene_id` text NOT NULL,
	`trigger` text NOT NULL,
	`parent_event_id` text,
	`priority` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source_mode` text DEFAULT 'form' NOT NULL,
	`definition_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_managed_events_character_status` ON `managed_events` (`character_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_managed_events_parent` ON `managed_events` (`parent_event_id`);