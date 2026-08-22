import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
