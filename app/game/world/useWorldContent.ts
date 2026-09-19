"use client";

import { useEffect, useMemo, useState } from "react";
import { CHARACTERS, CHARACTER_MESSAGES, DIALOGUE_PROFILES, EVENTS, GIFTS, GLOBAL_KEYS, SCENES } from "../content";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import type {
  CharacterDefinition,
  CharacterMessageDefinition,
  DialogueProfileDefinition,
  EventDefinition,
  GiftDefinition,
  GlobalKeyDefinition,
  SceneDefinition,
} from "../types";

type DefinitionEnvelope<T> = { definition: T };
type GiftResponse = { gifts?: DefinitionEnvelope<GiftDefinition>[] };
type DialogueResponse = { dialogues?: DefinitionEnvelope<DialogueProfileDefinition>[] };
type GlobalKeyResponse = { keys?: DefinitionEnvelope<GlobalKeyDefinition>[] };
type MessageResponse = { messages?: DefinitionEnvelope<CharacterMessageDefinition>[] };
type ContentResponse = { characters?: DefinitionEnvelope<CharacterDefinition>[]; scenes?: DefinitionEnvelope<SceneDefinition>[] };
type EventResponse = { events?: DefinitionEnvelope<EventDefinition>[] };

async function publishedJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`内容请求失败：${url}`);
  return response.json() as Promise<T>;
}

/**
 * Owns loading and merging authored world definitions. Runtime game progress
 * remains exclusively in UnifiedGameProvider; this hook only supplies metadata.
 */
export function useWorldContent() {
  const { setRomance } = useUnifiedGame();
  const [eventDefinitions, setEventDefinitions] = useState<EventDefinition[]>(EVENTS);
  const [definitionsReady, setDefinitionsReady] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const [managedCharacters, setManagedCharacters] = useState<CharacterDefinition[]>([]);
  const [managedScenes, setManagedScenes] = useState<SceneDefinition[]>([]);
  const [managedGifts, setManagedGifts] = useState<GiftDefinition[]>([]);
  const [managedMessages, setManagedMessages] = useState<CharacterMessageDefinition[]>([]);
  const [dialogueProfiles, setDialogueProfiles] = useState<DialogueProfileDefinition[]>(DIALOGUE_PROFILES);
  const [globalKeys, setGlobalKeys] = useState<GlobalKeyDefinition[]>(GLOBAL_KEYS);

  useEffect(() => {
    let active = true;
    Promise.all([
      publishedJson<GiftResponse>("/api/em/gifts?status=published"),
      publishedJson<DialogueResponse>("/api/em/dialogues?status=published"),
      publishedJson<GlobalKeyResponse>("/api/em/global-keys?status=published"),
    ]).then(([giftData, dialogueData, keyData]) => {
      if (!active) return;
      setManagedGifts((giftData.gifts ?? []).map((item) => item.definition));
      const managedDialogues = (dialogueData.dialogues ?? []).map((item) => item.definition);
      const managedDialogueIds = new Set(managedDialogues.map((item) => item.id));
      setDialogueProfiles([...DIALOGUE_PROFILES.filter((item) => !managedDialogueIds.has(item.id)), ...managedDialogues]);
      const managedKeys = (keyData.keys ?? []).map((item) => item.definition);
      const managedKeyIds = new Set(managedKeys.map((item) => item.id));
      setGlobalKeys([...GLOBAL_KEYS.filter((item) => !managedKeyIds.has(item.id)), ...managedKeys]);
    }).catch(() => { /* Built-in definitions remain playable while EM is offline. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    publishedJson<MessageResponse>("/api/em/messages?status=published")
      .then((data) => { if (active) setManagedMessages((data.messages ?? []).map((item) => item.definition)); })
      .catch(() => { /* Built-in letters remain available. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    publishedJson<ContentResponse>("/api/em/content?status=published")
      .then((data) => {
        if (!active) return;
        const characters = (data.characters ?? []).map((item) => item.definition);
        setManagedCharacters(characters);
        setManagedScenes((data.scenes ?? []).map((item) => item.definition));
        setRomance((state) => ({ ...state, relationships: { ...Object.fromEntries(characters.map((item) => [item.id, 4])), ...state.relationships } }));
      })
      .catch(() => { /* Built-in content remains playable. */ })
      .finally(() => { if (active) setContentReady(true); });
    return () => { active = false; };
  }, [setRomance]);

  useEffect(() => {
    let active = true;
    publishedJson<EventResponse>("/api/em/events?status=published")
      .then((data) => {
        if (!active) return;
        const merged = new Map(EVENTS.map((event) => [event.id, event]));
        for (const item of data.events ?? []) merged.set(item.definition.id, item.definition);
        setEventDefinitions([...merged.values()]);
      })
      .catch(() => { /* Built-in events remain available. */ })
      .finally(() => { if (active) setDefinitionsReady(true); });
    return () => { active = false; };
  }, []);

  const characters = useMemo(() => {
    const ids = new Set(managedCharacters.map((item) => item.id));
    return [...CHARACTERS.filter((item) => !ids.has(item.id)), ...managedCharacters];
  }, [managedCharacters]);
  const scenes = useMemo(() => {
    const ids = new Set(managedScenes.map((item) => item.id));
    const definitions = [...SCENES.filter((item) => !ids.has(item.id)), ...managedScenes];
    return definitions.map((item) => ({
      ...item,
      characters: characters.filter((character) => character.sceneId === item.id || character.appearances?.some((appearance) => appearance.sceneId === item.id)).map((character) => character.id),
    }));
  }, [characters, managedScenes]);
  const gifts = useMemo(() => {
    const ids = new Set(managedGifts.map((item) => item.id));
    return [...GIFTS.filter((item) => !ids.has(item.id)), ...managedGifts];
  }, [managedGifts]);
  const messageDefinitions = useMemo(() => {
    const ids = new Set(managedMessages.map((item) => item.id));
    return [...CHARACTER_MESSAGES.filter((item) => !ids.has(item.id)), ...managedMessages];
  }, [managedMessages]);

  return { characters, scenes, gifts, messageDefinitions, dialogueProfiles, globalKeys, eventDefinitions, definitionsReady, contentReady };
}
