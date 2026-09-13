"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MATERIALS } from "../alchemy/item-data";
import { DEFAULT_META, normalizeMetaProgress } from "../battle/meta";
import { EVENTS } from "../content";
import { INITIAL_STATE } from "../event-engine";
import { createInitialFarm, normalizeFarmProgress, type FarmProgress } from "../farm/farm";
import { createInitialFishing, normalizeFishingProgress, type FishingProgress } from "../fishing/fishing";
import { createInitialMining, normalizeMiningProgress, type MiningProgress } from "../mining/mining";
import { createInitialGathering, normalizeGathering } from "../gathering/engine";
import type { GatheringProgress } from "../gathering/types";
import { gatheringItemById } from "../gathering/content";
import { findEquipmentPosition } from "../battle/inventorySystem";
import type { GearRarity } from "../battle/progression";
import { createInitialQuestProgress, normalizeQuestProgress } from "../quests/engine";
import type { QuestProgress } from "../quests/types";
import { keyFor, LocalPlayerStateRepository } from "./player-state-repository";
import { SAVE_VERSION, type AlchemyProgress, type GameEffect, type StateSetter, type UnifiedCardInstance, type UnifiedGameState, type UnifiedItemStack } from "./types";
import { grantPlayerExperience, normalizePlayerGrowth, type PlayerGrowth } from "./progression-service";
import { inventoryProjection, syncAlchemyProductInventory } from "./inventory-service";
import { ACTION_COSTS } from "./action-service";
import { canonicalCard, upsertCard } from "./card-service";

const repository = new LocalPlayerStateRepository();

function projectGrowth(state: UnifiedGameState, growth: PlayerGrowth): UnifiedGameState {
  const shared = { ...state.shared, ...growth };
  return {
    ...state,
    shared,
    romance: {
      ...state.romance,
      playerLevel: growth.playerLevel,
      experience: growth.playerExperience,
      spiritStones: shared.spiritStones,
      stamina: shared.stamina,
      teacherSkillRanks: state.battle.passiveRanks,
      learnedSkillIds: shared.learnedSkills,
      ownedCardIds: shared.cards.map((card) => card.id),
      completedDungeons: state.dungeons.completed,
      alchemyResults: Object.values(state.alchemy.productStacks).filter((stack) => stack.count > 0).map((stack) => stack.productId),
      inventoryRarities: Object.fromEntries(Object.entries(shared.items).map(([id, item]) => [id, item.rarity])),
      inventoryItems: inventoryProjection(shared.items),
    },
    battle: { ...state.battle, spiritStones: shared.spiritStones, playerLevel: growth.playerLevel, playerExp: growth.playerExperience },
  };
}

const ITEM_TYPES = new Set(["gift", "material", "pill", "equipment", "card", "treasure", "quest", "fish"]);
const PERIODS = new Set(["清晨", "上午", "午后", "黄昏", "夜晚", "深夜"]);
const CARD_MODES = new Set(["active", "passive"]);
const CARD_SOURCES = new Set(["story", "alchemy", "dungeon"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finiteNumber(value: unknown, fallback: number, minimum = -Number.MAX_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function integer(value: unknown, fallback: number, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  return Math.trunc(finiteNumber(value, fallback, minimum, maximum));
}

function stringArray(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === "string"))] : fallback;
}

function numberArray(value: unknown, fallback: number[] = []) {
  return Array.isArray(value) ? [...new Set(value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry)).map((entry) => Math.trunc(entry)))] : fallback;
}

function numberRecord(value: unknown, fallback: Record<string, number> = {}, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const result = { ...fallback };
  for (const [key, entry] of Object.entries(asRecord(value))) if (typeof entry === "number" && Number.isFinite(entry)) result[key] = Math.max(minimum, Math.min(maximum, entry));
  return result;
}

function booleanRecord(value: unknown, fallback: Record<string, boolean> = {}) {
  const result = { ...fallback };
  for (const [key, entry] of Object.entries(asRecord(value))) if (typeof entry === "boolean") result[key] = entry;
  return result;
}

function stringArrayRecord(value: unknown, fallback: Record<string, string[]> = {}) {
  const result = { ...fallback };
  for (const [key, entry] of Object.entries(asRecord(value))) if (Array.isArray(entry)) result[key] = stringArray(entry);
  return result;
}

function sanitizeItems(value: unknown): Record<string, UnifiedItemStack> {
  const result: Record<string, UnifiedItemStack> = {};
  for (const [key, raw] of Object.entries(asRecord(value))) {
    const item = asRecord(raw);
    const itemId = typeof item.itemId === "string" ? item.itemId : key;
    if (!itemId || !ITEM_TYPES.has(String(item.itemType))) continue;
    const rarity = integer(item.rarity, 1, 1, 7) as UnifiedItemStack["rarity"];
    const amount = integer(item.amount, 0, 0);
    result[key] = {
      itemId,
      itemType: item.itemType as UnifiedItemStack["itemType"],
      rarity,
      amount,
      sourceTags: stringArray(item.sourceTags),
      ...(typeof item.templateId === "string" ? { templateId: item.templateId } : {}),
      ...(typeof item.quality === "string" ? { quality: item.quality } : {}),
      ...(typeof item.mutation === "string" ? { mutation: item.mutation } : {}),
      ...(typeof item.displayName === "string" ? { displayName: item.displayName } : {}),
      ...(typeof item.locked === "boolean" ? { locked: item.locked } : {}),
    };
  }
  return result;
}

function sanitizeCards(value: unknown, fallback: UnifiedCardInstance[]) {
  if (!Array.isArray(value)) return fallback;
  return value.flatMap((raw): UnifiedCardInstance[] => {
    const card = asRecord(raw);
    if (typeof card.id !== "string" || typeof card.characterId !== "string" || typeof card.name !== "string" || typeof card.art !== "string" || !CARD_MODES.has(String(card.mode)) || !CARD_SOURCES.has(String(card.source))) return [];
    return [canonicalCard({ ...card, id: card.id, characterId: card.characterId, name: card.name, art: card.art, mode: card.mode, source: card.source, rarity: integer(card.rarity, 1, 1, 7) } as UnifiedCardInstance)];
  });
}

function collectedQuestItems(collectedIds: string[] = []) {
  const collected = new Set(collectedIds);
  return Object.fromEntries(EVENTS.flatMap((event) => {
    const item = event.exploration?.rewardItem;
    if (!item || !collected.has(item.id)) return [];
    return [[item.id, { itemId: item.id, itemType: "quest" as const, rarity: 4 as const, amount: 1, sourceTags: ["剧情", "藏珍录"], locked: true }]];
  }));
}

function cloneInitial(): UnifiedGameState {
  const romance = { ...INITIAL_STATE, inventory: { ...INITIAL_STATE.inventory }, relationships: { ...INITIAL_STATE.relationships }, flags: { ...INITIAL_STATE.flags }, playerLevel: 1, teacherSkillRanks: {}, learnedSkillIds: [], ownedCardIds: ["story-shen-sword-1", "story-liu-ward-1"], completedDungeons: [], alchemyResults: [], inventoryRarities: {}, inventoryItems: {}, pendingUnifiedEffects: [] };
  romance.spiritStones = 5000;
  const giftItems = Object.fromEntries(Object.entries(romance.inventory).map(([itemId, amount]) => [itemId, { itemId, itemType: "gift" as const, rarity: 2 as const, amount, sourceTags: ["romance", "starter"] }]));
  const materialItems = Object.fromEntries(MATERIALS.map((item) => [item.id, { itemId: item.id, itemType: "material" as const, rarity: Math.max(1, Math.min(7, item.rarity)) as 1|2|3|4|5|6|7, amount: item.count, sourceTags: ["alchemy", "starter"] }]));
  const items = { ...giftItems, ...materialItems };
  romance.inventoryItems = inventoryProjection(items);
  return {
    version: SAVE_VERSION,
    updatedAt: Date.now(),
    shared: { spiritStones: romance.spiritStones, stamina: romance.stamina, playerLevel: 1, playerExperience: romance.experience, items, cards: [
      { id: "story-shen-sword-1", characterId: "shen", name: "沈清霜·霜华一剑", rarity: 4, mode: "active", source: "story", art: "/assets/characters/shen-qingshuang.webp", activeEffect: "sword" },
      { id: "story-liu-ward-1", characterId: "liu", name: "柳知意·青囊护道", rarity: 3, mode: "passive", source: "story", art: "/assets/characters/liu-zhiyi.webp", bonuses: { health: 60, defense: 18 } },
    ], learnedSkills: [], globalKeys: { ...romance.flags } },
    romance,
    alchemy: {
      materialCounts: Object.fromEntries(MATERIALS.map((item) => [item.id, item.count])), productStacks: {}, characterCards: [], mythicRareUses: {}, marketOffers: [], manualRefreshCount: 0, refreshResetAt: 0, soldOutRefreshAt: 0, commissions: [], commissionRefreshAt: 0, discoveredRecipes: [],
    },
    battle: { ...DEFAULT_META, spiritStones: romance.spiritStones, baseAttributes: { ...DEFAULT_META.baseAttributes }, equipmentBag: DEFAULT_META.equipmentBag.map((item) => ({ ...item })), equipmentPositions: { ...DEFAULT_META.equipmentPositions }, personalBackpack: [], warehouse: [], equipped: {}, ownedCards: [], cardSlots: [null, null, null], attributeAllocation: { ...DEFAULT_META.attributeAllocation }, passiveRanks: {}, skillMastery: structuredClone(DEFAULT_META.skillMastery), wmDraft: structuredClone(DEFAULT_META.wmDraft), wmPublished: structuredClone(DEFAULT_META.wmPublished), weaponShop: { ...DEFAULT_META.weaponShop, stock: [], buyback: [] } },
    farm: createInitialFarm(),
    fishing: createInitialFishing(),
    mining: createInitialMining(),
    gathering: createInitialGathering(),
    dungeons: { highestUnlocked: 1, completed: [], randomVisible: [] },
    quests: createInitialQuestProgress(),
  };
}

function mergeSave(saved: unknown) {
  const base = cloneInitial();
  const envelope = asRecord(saved);
  if (envelope.version !== SAVE_VERSION) return base;
  const savedShared = asRecord(envelope.shared);
  const savedRomance = asRecord(envelope.romance);
  const savedAlchemy = asRecord(envelope.alchemy);
  const savedBattle = asRecord(envelope.battle);
  const savedDungeons = asRecord(envelope.dungeons);
  const savedQuests = asRecord(envelope.quests);
  const collectedEasterEggs = stringArray(savedRomance.collectedEasterEggs);
  const productStacks = Object.fromEntries(Object.entries(asRecord(savedAlchemy.productStacks)).flatMap(([key, raw]) => {
    const stack = asRecord(raw);
    const mutation = typeof stack.mutation === "string" && ["normal", "burnt", "flawed", "fine", "supreme", "perfect"].includes(stack.mutation) ? stack.mutation : "normal";
    return typeof stack.productId === "string" ? [[key, { productId: stack.productId, mutation, count: integer(stack.count, 0, 0) }]] : [];
  })) as AlchemyProgress["productStacks"];
  const characterCards = Array.isArray(savedAlchemy.characterCards) ? savedAlchemy.characterCards.filter((card) => {
    const value = asRecord(card);
    return typeof value.id === "string" && typeof value.createdAt === "number" && (Array.isArray(value.optionIds) || value.origin === "fated");
  }).map((card) => {
    const value = asRecord(card);
    return Array.isArray(value.optionIds) ? { ...value, quality: "神品" } : { ...value, quality: "仙品" };
  }) as AlchemyProgress["characterCards"] : [];
  const alchemy: AlchemyProgress = {
    ...base.alchemy,
    materialCounts: numberRecord(savedAlchemy.materialCounts, base.alchemy.materialCounts),
    productStacks,
    characterCards,
    mythicRareUses: numberRecord(savedAlchemy.mythicRareUses, {}, 0),
    marketOffers: Array.isArray(savedAlchemy.marketOffers) ? savedAlchemy.marketOffers.filter((entry) => typeof asRecord(entry).id === "string") as AlchemyProgress["marketOffers"] : [],
    manualRefreshCount: integer(savedAlchemy.manualRefreshCount, 0, 0),
    refreshResetAt: finiteNumber(savedAlchemy.refreshResetAt, 0, 0),
    soldOutRefreshAt: finiteNumber(savedAlchemy.soldOutRefreshAt, 0, 0),
    commissions: Array.isArray(savedAlchemy.commissions) ? savedAlchemy.commissions.filter((entry) => typeof asRecord(entry).id === "string" && ["specific", "fuzzy"].includes(String(asRecord(entry).kind))) as AlchemyProgress["commissions"] : [],
    commissionRefreshAt: finiteNumber(savedAlchemy.commissionRefreshAt, 0, 0),
    discoveredRecipes: stringArray(savedAlchemy.discoveredRecipes),
  };
  const rawItems = { ...base.shared.items, ...sanitizeItems(savedShared.items), ...collectedQuestItems(collectedEasterEggs) };
  const items = syncAlchemyProductInventory(rawItems, alchemy.productStacks);
  const shared = {
    ...base.shared,
    spiritStones: finiteNumber(savedShared.spiritStones, base.shared.spiritStones, 0),
    stamina: finiteNumber(savedShared.stamina, base.shared.stamina, 0, 10),
    playerLevel: integer(savedShared.playerLevel, base.shared.playerLevel, 1, 60),
    playerExperience: finiteNumber(savedShared.playerExperience, base.shared.playerExperience, 0),
    items,
    cards: sanitizeCards(savedShared.cards, base.shared.cards),
    learnedSkills: numberArray(savedShared.learnedSkills, base.shared.learnedSkills),
    globalKeys: booleanRecord(savedShared.globalKeys, base.shared.globalKeys),
  };
  const normalizedBattle = normalizeMetaProgress({ ...base.battle, ...savedBattle });
  normalizedBattle.spiritStones = shared.spiritStones;
  normalizedBattle.backpackLevel = integer(savedBattle.backpackLevel, base.battle.backpackLevel, 0);
  normalizedBattle.safeLevel = integer(savedBattle.safeLevel, base.battle.safeLevel, 0);
  normalizedBattle.warehouseLevel = integer(savedBattle.warehouseLevel, base.battle.warehouseLevel, 0);
  normalizedBattle.baseAttributes = numberRecord(savedBattle.baseAttributes, base.battle.baseAttributes, 0) as typeof normalizedBattle.baseAttributes;
  normalizedBattle.attributeAllocation = numberRecord(savedBattle.attributeAllocation, base.battle.attributeAllocation, 0) as typeof normalizedBattle.attributeAllocation;
  normalizedBattle.passiveRanks = numberRecord(savedBattle.passiveRanks, {}, 0);
  normalizedBattle.cardSlots = normalizedBattle.cardSlots.map((id) => id && shared.cards.some((card) => card.id === id && card.mode === "active") ? id : null);
  const romanceCandidate = { ...base.romance, ...savedRomance } as UnifiedGameState["romance"];
  let merged: UnifiedGameState = {
    ...base, version: SAVE_VERSION, updatedAt: finiteNumber(envelope.updatedAt, Date.now(), 0),
    shared,
    romance: {
      ...romanceCandidate,
      day: integer(savedRomance.day, base.romance.day, 1),
      period: PERIODS.has(String(savedRomance.period)) ? savedRomance.period as typeof base.romance.period : base.romance.period,
      sceneId: typeof savedRomance.sceneId === "string" ? savedRomance.sceneId as typeof base.romance.sceneId : base.romance.sceneId,
      selectedCharacterId: typeof savedRomance.selectedCharacterId === "string" ? savedRomance.selectedCharacterId as typeof base.romance.selectedCharacterId : base.romance.selectedCharacterId,
      spiritStones: shared.spiritStones,
      stamina: shared.stamina,
      experience: shared.playerExperience,
      relationships: numberRecord(savedRomance.relationships, base.romance.relationships, 0, 100) as typeof base.romance.relationships,
      inventory: numberRecord(savedRomance.inventory, base.romance.inventory, 0) as typeof base.romance.inventory,
      flags: booleanRecord(savedRomance.flags, base.romance.flags),
      marketTreasures: numberRecord(savedRomance.marketTreasures, base.romance.marketTreasures, 0),
      proficiencyExperience: numberRecord(savedRomance.proficiencyExperience, base.romance.proficiencyExperience, 0),
      eventRuns: numberRecord(savedRomance.eventRuns, base.romance.eventRuns, 0),
      talkCounts: numberRecord(savedRomance.talkCounts, base.romance.talkCounts, 0),
      sceneVisits: numberRecord(savedRomance.sceneVisits, base.romance.sceneVisits, 0) as typeof base.romance.sceneVisits,
      sceneInspectionDays: numberRecord(savedRomance.sceneInspectionDays, base.romance.sceneInspectionDays, 0) as typeof base.romance.sceneInspectionDays,
      interactionCounts: numberRecord(savedRomance.interactionCounts, base.romance.interactionCounts, 0),
      seekingEncounterDays: numberRecord(savedRomance.seekingEncounterDays, base.romance.seekingEncounterDays, 0),
      mapEventSchedules: numberRecord(savedRomance.mapEventSchedules, base.romance.mapEventSchedules, 0),
      calendarEventRuns: stringArrayRecord(savedRomance.calendarEventRuns, base.romance.calendarEventRuns),
      discoveredGiftPreferences: stringArrayRecord(savedRomance.discoveredGiftPreferences, base.romance.discoveredGiftPreferences) as typeof base.romance.discoveredGiftPreferences,
      presentCharacters: stringArrayRecord(savedRomance.presentCharacters, base.romance.presentCharacters) as typeof base.romance.presentCharacters,
      activityNotices: stringArray(savedRomance.activityNotices, base.romance.activityNotices),
      announcedGlobalKeys: stringArray(savedRomance.announcedGlobalKeys, base.romance.announcedGlobalKeys),
      receivedMessages: stringArray(savedRomance.receivedMessages, base.romance.receivedMessages),
      claimedMessages: stringArray(savedRomance.claimedMessages, base.romance.claimedMessages),
      collectedEasterEggs,
      completedEvents: stringArray(savedRomance.completedEvents, base.romance.completedEvents),
      appearanceTriggersUsed: stringArray(savedRomance.appearanceTriggersUsed, base.romance.appearanceTriggersUsed),
      shortRestDay: integer(savedRomance.shortRestDay, base.romance.shortRestDay, 0),
      shortRestCount: integer(savedRomance.shortRestCount, base.romance.shortRestCount, 0),
      medicineShortage: (() => {
        const project = asRecord(savedRomance.medicineShortage);
        if (!["offered", "active", "completed"].includes(String(project.status))) return base.romance.medicineShortage;
        return {
          status: project.status as "offered" | "active" | "completed",
          battleVictories: integer(project.battleVictories, 0, 0),
          ...(typeof project.acceptedDay === "number" ? { acceptedDay: integer(project.acceptedDay, 1, 1) } : {}),
          ...(typeof project.deadlineDay === "number" ? { deadlineDay: integer(project.deadlineDay, 1, 1) } : {}),
          ...(["production", "relationship", "battle"].includes(String(project.route)) ? { route: project.route as "production" | "relationship" | "battle" } : {}),
          ...(typeof project.farmHarvestsAtAccept === "number" ? { farmHarvestsAtAccept: integer(project.farmHarvestsAtAccept, 0, 0) } : {}),
          ...(typeof project.completedDay === "number" ? { completedDay: integer(project.completedDay, 1, 1) } : {}),
          ...(["stabilized", "recovered"].includes(String(project.outcome)) ? { outcome: project.outcome as "stabilized" | "recovered" } : {}),
        };
      })(),
      inventoryItems: inventoryProjection(items),
      activeEvent: null,
      lastContext: null,
      pendingUnifiedEffects: [],
    },
    alchemy,
    battle: normalizedBattle,
    farm: normalizeFarmProgress(envelope.farm as FarmProgress | undefined),
    fishing: normalizeFishingProgress(envelope.fishing as FishingProgress | undefined),
    mining: normalizeMiningProgress(envelope.mining as MiningProgress | undefined),
    gathering: normalizeGathering(envelope.gathering as GatheringProgress | undefined),
    dungeons: {
      highestUnlocked: integer(savedDungeons.highestUnlocked, base.dungeons.highestUnlocked, 1),
      completed: numberArray(savedDungeons.completed).filter((value) => value > 0),
      randomVisible: stringArray(savedDungeons.randomVisible),
      ...(["victory", "extracted", "defeat"].includes(String(savedDungeons.lastSettlement)) ? { lastSettlement: savedDungeons.lastSettlement as "victory" | "extracted" | "defeat" } : {}),
    },
    quests: normalizeQuestProgress({
      statuses: Object.fromEntries(Object.entries(asRecord(savedQuests.statuses)).filter(([, status]) => ["unaccepted", "in_progress", "completed", "claimable", "claimed"].includes(String(status)))) as QuestProgress["statuses"],
      trackedQuestId: typeof savedQuests.trackedQuestId === "string" ? savedQuests.trackedQuestId : null,
    }),
  };
  const growth = normalizePlayerGrowth({ playerLevel: shared.playerLevel, playerExperience: shared.playerExperience });
  merged = projectGrowth(merged, growth);
  return merged;
}

type UnifiedContextValue = {
  state: UnifiedGameState;
  hydrated: boolean;
  setRomance: StateSetter<UnifiedGameState["romance"]>;
  setBattle: StateSetter<UnifiedGameState["battle"]>;
  setAlchemy: StateSetter<AlchemyProgress>;
  setFarm: StateSetter<FarmProgress>;
  setFishing: StateSetter<FishingProgress>;
  setMining: StateSetter<MiningProgress>;
  setGathering: StateSetter<GatheringProgress>;
  setQuests: StateSetter<QuestProgress>;
  applyEffects: (effects: GameEffect[]) => void;
  resetGame: () => void;
};

const UnifiedGameContext = createContext<UnifiedContextValue | null>(null);

export function UnifiedGameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UnifiedGameState>(cloneInitial);
  const [hydrated, setHydrated] = useState(false);
  const externallySyncedState = useRef<UnifiedGameState | null>(null);

  useEffect(() => { repository.load("main").then((saved) => { setState(mergeSave(saved)); setHydrated(true); }); }, []);
  useEffect(() => {
    const syncOtherGameWindow = (event: StorageEvent) => {
      if (event.key !== keyFor("main") || !event.newValue) return;
      try { const next = mergeSave(JSON.parse(event.newValue) as UnifiedGameState); externallySyncedState.current = next; setState(next); } catch { /* Ignore incomplete cross-window writes. */ }
    };
    window.addEventListener("storage", syncOtherGameWindow);
    return () => window.removeEventListener("storage", syncOtherGameWindow);
  }, []);
  useEffect(() => { if (!hydrated) return; if (externallySyncedState.current === state) { externallySyncedState.current = null; return; } const timer = window.setTimeout(() => repository.save({ ...state, updatedAt: Date.now() }), 120); return () => window.clearTimeout(timer); }, [hydrated, state]);

  const setRomance = useCallback<StateSetter<UnifiedGameState["romance"]>>((action) => setState((current) => {
    const requested = typeof action === "function" ? action(current.romance) : action;
    if (requested === current.romance) return current;
    const pending = requested.pendingUnifiedEffects ?? [];
    let shared = { ...current.shared };
    let growth: PlayerGrowth = { playerLevel: shared.playerLevel, playerExperience: shared.playerExperience };
    let alchemy = current.alchemy;
    let dungeons = current.dungeons;
    for (const effect of pending) {
      if (effect.type === "add_currency") shared = { ...shared, spiritStones: Math.max(0, shared.spiritStones + effect.amount) };
      else if (effect.type === "add_player_exp") growth = grantPlayerExperience(growth, effect.amount);
      else if (effect.type === "learn_skill") shared = { ...shared, learnedSkills: [...new Set([...shared.learnedSkills, effect.skillId])] };
      else if (effect.type === "trigger_map_event") dungeons = { ...dungeons, randomVisible: [...new Set([...dungeons.randomVisible, effect.eventId])] };
      else if (effect.type === "add_item") {
        const previous = shared.items[effect.itemId];
        shared = { ...shared, items: { ...shared.items, [effect.itemId]: { itemId: effect.itemId, itemType: effect.itemType, rarity: effect.rarity, amount: (previous?.amount ?? 0) + effect.amount, sourceTags: ["story"] } } };
        if (MATERIALS.some((item) => item.id === effect.itemId)) alchemy = { ...alchemy, materialCounts: { ...alchemy.materialCounts, [effect.itemId]: (alchemy.materialCounts[effect.itemId] ?? 0) + effect.amount } };
      } else if (effect.type === "add_card") shared = { ...shared, cards: upsertCard(shared.cards, { id: effect.cardId, characterId: effect.characterId, name: effect.name, rarity: effect.rarity, mode: effect.mode, source: "story", art: effect.art, activeEffect: "sword" }) };
    }
    if (requested.spiritStones !== current.romance.spiritStones) shared = { ...shared, spiritStones: requested.spiritStones };
    if (requested.experience !== current.romance.experience) growth = grantPlayerExperience(growth, requested.experience - current.romance.experience);
    shared = { ...shared, ...growth };
    const next = { ...requested, pendingUnifiedEffects: [], spiritStones: shared.spiritStones, experience: growth.playerExperience, playerLevel: growth.playerLevel };
    const giftItems = Object.fromEntries(Object.entries(next.inventory).map(([itemId, amount]) => [itemId, { ...(current.shared.items[itemId] ?? { itemId, itemType: "gift" as const, rarity: 2 as const, sourceTags: ["romance"] }), amount }]));
    shared = { ...shared, spiritStones: next.spiritStones, stamina: next.stamina, items: { ...shared.items, ...giftItems }, globalKeys: { ...shared.globalKeys, ...next.flags } };
    const projected = { ...next, playerLevel: growth.playerLevel, teacherSkillRanks: current.battle.passiveRanks, learnedSkillIds: shared.learnedSkills, ownedCardIds: shared.cards.map((card) => card.id), completedDungeons: dungeons.completed, alchemyResults: Object.values(alchemy.productStacks).filter((stack) => stack.count > 0).map((stack) => stack.productId), inventoryRarities: Object.fromEntries(Object.entries(shared.items).map(([id, item]) => [id, item.rarity])), inventoryItems: inventoryProjection(shared.items) };
    return { ...current, romance: projected, shared, alchemy, dungeons, battle: { ...current.battle, spiritStones: shared.spiritStones, playerLevel: growth.playerLevel, playerExp: growth.playerExperience } };
  }), []);

  const setBattle = useCallback<StateSetter<UnifiedGameState["battle"]>>((action) => setState((current) => {
    const next = typeof action === "function" ? action(current.battle) : action;
    if (next === current.battle) return current;
    const spiritStones = next.spiritStones;
    const battleExperienceChanged = next.playerExp !== current.battle.playerExp || next.playerLevel !== current.battle.playerLevel;
    const growth = battleExperienceChanged
      ? normalizePlayerGrowth({ playerLevel: next.playerLevel, playerExperience: next.playerExp })
      : { playerLevel: current.shared.playerLevel, playerExperience: current.shared.playerExperience };
    const synchronizedBattle = { ...next, playerExp: growth.playerExperience, playerLevel: growth.playerLevel };
    const learnedSkills = Object.entries(next.skillMastery).filter(([, value]) => value.learned).map(([id]) => Number(id));
    return { ...current, battle: synchronizedBattle, shared: { ...current.shared, spiritStones, ...growth, learnedSkills }, romance: { ...current.romance, spiritStones, experience: growth.playerExperience, playerLevel: growth.playerLevel, teacherSkillRanks: next.passiveRanks, learnedSkillIds: learnedSkills } };
  }), []);

  const setAlchemy = useCallback<StateSetter<AlchemyProgress>>((action) => setState((current) => {
    const alchemy = typeof action === "function" ? action(current.alchemy) : action;
    if (alchemy === current.alchemy) return current;
    const materialItems = Object.fromEntries(MATERIALS.map((item) => [item.id, { ...(current.shared.items[item.id] ?? { itemId: item.id, itemType: "material" as const, rarity: Math.max(1, Math.min(7, item.rarity)) as 1|2|3|4|5|6|7, sourceTags: ["alchemy"] }), amount: alchemy.materialCounts[item.id] ?? 0 }]));
    const items = syncAlchemyProductInventory({ ...current.shared.items, ...materialItems }, alchemy.productStacks);
    const alchemyResults = Object.values(alchemy.productStacks).filter((stack) => stack.count > 0).map((stack) => stack.productId);
    return { ...current, alchemy, shared: { ...current.shared, items }, romance: { ...current.romance, alchemyResults, inventoryRarities: Object.fromEntries(Object.entries(items).map(([id, item]) => [id, item.rarity])), inventoryItems: inventoryProjection(items) } };
  }), []);

  const setFarm = useCallback<StateSetter<FarmProgress>>((action) => setState((current) => {
    const farm = typeof action === "function" ? action(current.farm) : action;
    return farm === current.farm ? current : { ...current, farm };
  }), []);

  const setFishing = useCallback<StateSetter<FishingProgress>>((action) => setState((current) => {
    const fishing = typeof action === "function" ? action(current.fishing) : action;
    return fishing === current.fishing ? current : { ...current, fishing };
  }), []);

  const setMining = useCallback<StateSetter<MiningProgress>>((action) => setState((current) => {
    const mining = typeof action === "function" ? action(current.mining) : action;
    return mining === current.mining ? current : { ...current, mining };
  }), []);

  const setGathering = useCallback<StateSetter<GatheringProgress>>((action) => setState((current) => {
    const gathering = typeof action === "function" ? action(current.gathering) : action;
    return gathering === current.gathering ? current : { ...current, gathering };
  }), []);

  const setQuests = useCallback<StateSetter<QuestProgress>>((action) => setState((current) => {
    const quests = typeof action === "function" ? action(current.quests) : action;
    return quests === current.quests ? current : { ...current, quests };
  }), []);

  const applyEffects = useCallback((effects: GameEffect[]) => setState((current) => effects.reduce((next, effect) => {
    if (effect.type === "add_currency") { const spiritStones = Math.max(0, next.shared.spiritStones + effect.amount); return { ...next, shared: { ...next.shared, spiritStones }, romance: { ...next.romance, spiritStones }, battle: { ...next.battle, spiritStones } }; }
    if (effect.type === "spend_stamina") { const stamina = Math.max(0, next.shared.stamina - effect.amount); return { ...next, shared: { ...next.shared, stamina }, romance: { ...next.romance, stamina } }; }
    if (effect.type === "add_item") {
      const previous = next.shared.items[effect.item.itemId];
      const item = { ...effect.item, amount: (previous?.amount ?? 0) + effect.item.amount };
      const isAlchemyMaterial = MATERIALS.some((entry) => entry.id === item.itemId);
      const romance = item.itemType === "gift" ? { ...next.romance, inventory: { ...next.romance.inventory, [item.itemId]: (next.romance.inventory[item.itemId] ?? 0) + effect.item.amount } } : next.romance;
      let battle = next.battle;
      const gatheringEquipment = item.itemType === "equipment" ? gatheringItemById(item.itemId) : undefined;
      if (gatheringEquipment?.equipmentId && effect.item.amount > 0) {
        const rarityByTier:GearRarity[]=["common","common","fine","rare","epic","immortal"];
        for(let index=0;index<effect.item.amount;index+=1){
          const equipment={uid:`gathering-${gatheringEquipment.id}-${next.updatedAt}-${battle.equipmentBag.length}-${index}`,equipmentId:gatheringEquipment.equipmentId,name:gatheringEquipment.name,description:gatheringEquipment.description,art:gatheringEquipment.art,price:gatheringEquipment.value,rarity:rarityByTier[gatheringEquipment.rarity]??"common",identified:true};
          const position=findEquipmentPosition(battle.equipmentBag,battle.equipmentPositions,equipment);
          if(position)battle={...battle,equipmentBag:[...battle.equipmentBag,equipment],equipmentPositions:{...battle.equipmentPositions,[equipment.uid]:position}};
        }
      }
      const items = { ...next.shared.items, [item.itemId]: item };
      return { ...next, romance: { ...romance, inventoryItems: inventoryProjection(items), inventoryRarities: Object.fromEntries(Object.entries(items).map(([id, entry]) => [id, entry.rarity])) }, battle, shared: { ...next.shared, items }, alchemy: isAlchemyMaterial ? { ...next.alchemy, materialCounts: { ...next.alchemy.materialCounts, [item.itemId]: (next.alchemy.materialCounts[item.itemId] ?? 0) + effect.item.amount } } : next.alchemy };
    }
    if (effect.type === "remove_item") {
      const previous = next.shared.items[effect.itemId]; if (!previous) return next;
      const amount = Math.max(0, previous.amount - effect.amount);
      const isAlchemyMaterial = MATERIALS.some((entry) => entry.id === effect.itemId);
      let alchemy = isAlchemyMaterial ? { ...next.alchemy, materialCounts: { ...next.alchemy.materialCounts, [effect.itemId]: amount } } : next.alchemy;
      if (previous.sourceTags.includes("alchemy-product") && effect.itemId.startsWith("alchemy:")) {
        const stackKey = effect.itemId.slice("alchemy:".length);
        const stack = alchemy.productStacks[stackKey];
        if (stack) alchemy = { ...alchemy, productStacks: { ...alchemy.productStacks, [stackKey]: { ...stack, count: amount } } };
      }
      const items = { ...next.shared.items, [effect.itemId]: { ...previous, amount } };
      const romance = previous.itemType === "gift" ? { ...next.romance, inventory: { ...next.romance.inventory, [effect.itemId]: amount } } : next.romance;
      return { ...next, romance: { ...romance, inventoryItems: inventoryProjection(items), inventoryRarities: Object.fromEntries(Object.entries(items).map(([id, entry]) => [id, entry.rarity])) }, shared: { ...next.shared, items }, alchemy };
    }
    if (effect.type === "add_card") { const cards = upsertCard(next.shared.cards, effect.card); return { ...next, shared: { ...next.shared, cards }, romance: { ...next.romance, ownedCardIds: cards.map((card) => card.id) } }; }
    if (effect.type === "learn_skill") return { ...next, shared: { ...next.shared, learnedSkills: [...new Set([...next.shared.learnedSkills, effect.skillId])] } };
    if (effect.type === "add_relationship") return { ...next, romance: { ...next.romance, relationships: { ...next.romance.relationships, [effect.characterId]: Math.max(0, Math.min(100, (next.romance.relationships[effect.characterId] ?? 0) + effect.amount)) } } };
    if (effect.type === "add_player_exp") return projectGrowth(next, grantPlayerExperience(next.shared, effect.amount));
    if (effect.type === "set_global_key") return { ...next, shared: { ...next.shared, globalKeys: { ...next.shared.globalKeys, [effect.key]: effect.value } }, romance: { ...next.romance, flags: { ...next.romance.flags, [effect.key]: effect.value } } };
    if (effect.type === "reveal_dungeon") return { ...next, dungeons: { ...next.dungeons, randomVisible: [...new Set([...next.dungeons.randomVisible, effect.dungeonId])] } };
    if (effect.type === "complete_dungeon") {
      const settled = effect.result !== "defeat";
      const completed = effect.result === "victory" ? [...new Set([...next.dungeons.completed, effect.waveId])] : next.dungeons.completed;
      const highestUnlocked = effect.result === "victory" ? Math.max(next.dungeons.highestUnlocked, Math.min(21, effect.waveId + 1)) : next.dungeons.highestUnlocked;
      const periods = ["清晨", "上午", "午后", "黄昏", "夜晚", "深夜"] as const;
      const currentPeriodIndex = Math.max(0, periods.indexOf(next.romance.period));
      const wrapsToNextDay = currentPeriodIndex === periods.length - 1;
      const period = settled ? periods[(currentPeriodIndex + ACTION_COSTS.battle.timeStages) % periods.length] : next.romance.period;
      const day = next.romance.day + (settled && wrapsToNextDay ? 1 : 0);
      const stamina = settled ? Math.max(0, next.shared.stamina - ACTION_COSTS.battle.stamina) : next.shared.stamina;
      return {
        ...next,
        dungeons: { ...next.dungeons, completed, highestUnlocked, lastSettlement: effect.result },
        shared: { ...next.shared, stamina },
        romance: { ...next.romance, day, period, stamina, completedDungeons: completed, medicineShortage: effect.result === "victory" && next.romance.medicineShortage.status === "active" ? { ...next.romance.medicineShortage, battleVictories: next.romance.medicineShortage.battleVictories + 1 } : next.romance.medicineShortage },
        battle: { ...next.battle, highestUnlockedWave: highestUnlocked },
      };
    }
    return next;
  }, current)), []);

  const value = useMemo(() => ({ state, hydrated, setRomance, setBattle, setAlchemy, setFarm, setFishing, setMining, setGathering, setQuests, applyEffects, resetGame: () => setState(cloneInitial()) }), [applyEffects, hydrated, setAlchemy, setBattle, setFarm, setFishing, setMining, setGathering, setQuests, setRomance, state]);
  return <UnifiedGameContext.Provider value={value}>{children}</UnifiedGameContext.Provider>;
}

export function useUnifiedGame() {
  const value = useContext(UnifiedGameContext);
  if (!value) throw new Error("useUnifiedGame must be used within UnifiedGameProvider");
  return value;
}
