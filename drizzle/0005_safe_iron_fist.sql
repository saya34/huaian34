CREATE TABLE `item_manager_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`draft_json` text NOT NULL,
	`published_json` text NOT NULL,
	`published_version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
