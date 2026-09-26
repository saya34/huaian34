CREATE TABLE `forum_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author` text NOT NULL,
	`author_title` text NOT NULL,
	`avatar` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`content` text NOT NULL,
	`attachments_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_forum_comments_post_created` ON `forum_comments` (`post_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_forum_comments_visitor_created` ON `forum_comments` (`visitor_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `forum_likes` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_forum_likes_post_visitor` ON `forum_likes` (`post_id`,`visitor_hash`);--> statement-breakpoint
CREATE INDEX `idx_forum_likes_post` ON `forum_likes` (`post_id`);--> statement-breakpoint
CREATE TABLE `forum_media` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`original_name` text NOT NULL,
	`alt` text DEFAULT '道友上传的留影' NOT NULL,
	`owner_hash` text NOT NULL,
	`post_id` text,
	`comment_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_forum_media_storage_key` ON `forum_media` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_forum_media_owner_created` ON `forum_media` (`owner_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_forum_media_post` ON `forum_media` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_forum_media_comment` ON `forum_media` (`comment_id`);--> statement-breakpoint
CREATE TABLE `forum_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text DEFAULT 'square' NOT NULL,
	`author` text NOT NULL,
	`author_title` text NOT NULL,
	`avatar` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`content` text NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`attachments_json` text DEFAULT '[]' NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`official` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_forum_posts_channel_created` ON `forum_posts` (`channel`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_forum_posts_visitor_created` ON `forum_posts` (`visitor_hash`,`created_at`);
--> statement-breakpoint
PRAGMA optimize;
