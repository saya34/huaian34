CREATE TABLE `managed_characters` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`scene_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source_mode` text DEFAULT 'form' NOT NULL,
	`definition_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_managed_characters_scene_status` ON `managed_characters` (`scene_id`,`status`);--> statement-breakpoint
CREATE TABLE `managed_scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source_mode` text DEFAULT 'form' NOT NULL,
	`definition_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_managed_scenes_status` ON `managed_scenes` (`status`);