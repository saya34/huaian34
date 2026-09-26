import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const itemManagerState = sqliteTable("item_manager_state", {
  id: integer("id").primaryKey(),
  draftJson: text("draft_json").notNull(),
  publishedJson: text("published_json").notNull(),
  publishedVersion: integer("published_version").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  publishedAt: text("published_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const managedEvents = sqliteTable(
  "managed_events",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    characterId: text("character_id").notNull(),
    sceneId: text("scene_id").notNull(),
    trigger: text("trigger").notNull(),
    parentEventId: text("parent_event_id"),
    priority: integer("priority").notNull(),
    status: text("status").notNull().default("draft"),
    sourceMode: text("source_mode").notNull().default("form"),
    definitionJson: text("definition_json").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("idx_managed_events_character_status").on(table.characterId, table.status),
    index("idx_managed_events_parent").on(table.parentEventId),
  ],
);

export const managedCharacters = sqliteTable(
  "managed_characters",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    sceneId: text("scene_id").notNull(),
    status: text("status").notNull().default("draft"),
    sourceMode: text("source_mode").notNull().default("form"),
    definitionJson: text("definition_json").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("idx_managed_characters_scene_status").on(table.sceneId, table.status)],
);

export const managedScenes = sqliteTable(
  "managed_scenes",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"),
    sourceMode: text("source_mode").notNull().default("form"),
    definitionJson: text("definition_json").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("idx_managed_scenes_status").on(table.status)],
);

export const managedGifts = sqliteTable(
  "managed_gifts",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"),
    sourceMode: text("source_mode").notNull().default("form"),
    definitionJson: text("definition_json").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("idx_managed_gifts_status").on(table.status)],
);

export const managedDialogueProfiles = sqliteTable(
  "managed_dialogue_profiles",
  {
    id: text("id").primaryKey(),
    characterId: text("character_id").notNull(),
    status: text("status").notNull().default("draft"),
    sourceMode: text("source_mode").notNull().default("form"),
    definitionJson: text("definition_json").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("idx_managed_dialogue_character_status").on(table.characterId, table.status)],
);

export const managedGlobalKeys = sqliteTable(
  "managed_global_keys",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"),
    sourceMode: text("source_mode").notNull().default("form"),
    definitionJson: text("definition_json").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("idx_managed_global_keys_status").on(table.status)],
);

export const managedCharacterMessages = sqliteTable(
  "managed_character_messages",
  {
    id: text("id").primaryKey(),
    senderCharacterId: text("sender_character_id").notNull(),
    status: text("status").notNull().default("draft"),
    sourceMode: text("source_mode").notNull().default("form"),
    definitionJson: text("definition_json").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("idx_managed_character_messages_sender_status").on(table.senderCharacterId, table.status)],
);

export const forumPosts = sqliteTable(
  "forum_posts",
  {
    id: text("id").primaryKey(),
    channel: text("channel").notNull().default("square"),
    author: text("author").notNull(),
    authorTitle: text("author_title").notNull(),
    avatar: text("avatar").notNull(),
    visitorHash: text("visitor_hash").notNull(),
    content: text("content").notNull(),
    tagsJson: text("tags_json").notNull().default("[]"),
    attachmentsJson: text("attachments_json").notNull().default("[]"),
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    official: integer("official", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("visible"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_forum_posts_channel_created").on(table.channel, table.createdAt),
    index("idx_forum_posts_visitor_created").on(table.visitorHash, table.createdAt),
  ],
);

export const forumComments = sqliteTable(
  "forum_comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    author: text("author").notNull(),
    authorTitle: text("author_title").notNull(),
    avatar: text("avatar").notNull(),
    visitorHash: text("visitor_hash").notNull(),
    content: text("content").notNull(),
    attachmentsJson: text("attachments_json").notNull().default("[]"),
    status: text("status").notNull().default("visible"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_forum_comments_post_created").on(table.postId, table.createdAt),
    index("idx_forum_comments_visitor_created").on(table.visitorHash, table.createdAt),
  ],
);

export const forumLikes = sqliteTable(
  "forum_likes",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    visitorHash: text("visitor_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_forum_likes_post_visitor").on(table.postId, table.visitorHash),
    index("idx_forum_likes_post").on(table.postId),
  ],
);

export const forumMedia = sqliteTable(
  "forum_media",
  {
    id: text("id").primaryKey(),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    originalName: text("original_name").notNull(),
    alt: text("alt").notNull().default("道友上传的留影"),
    ownerHash: text("owner_hash").notNull(),
    postId: text("post_id"),
    commentId: text("comment_id"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_forum_media_storage_key").on(table.storageKey),
    index("idx_forum_media_owner_created").on(table.ownerHash, table.createdAt),
    index("idx_forum_media_post").on(table.postId),
    index("idx_forum_media_comment").on(table.commentId),
  ],
);
