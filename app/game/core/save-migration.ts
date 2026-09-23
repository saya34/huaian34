import { MATERIALS, PRODUCTS } from "../alchemy/item-data";
import { DEFAULT_META, normalizeMetaProgress } from "../battle/meta";
import { EVENTS } from "../content";
import { INITIAL_STATE } from "../event-engine";
import { normalizeAlchemyBatch } from "../alchemy/batch-service";
import { restoreDialogue } from "./dialogue-save";
import { createInitialFarm, normalizeFarmProgress, type FarmProgress } from "../farm/farm";
import { createInitialFishing, normalizeFishingProgress, type FishingProgress } from "../fishing/fishing";
import { createInitialMining, normalizeMiningProgress, type MiningProgress } from "../mining/mining";
import { createInitialGathering, normalizeGathering } from "../gathering/engine";
import type { GatheringProgress } from "../gathering/types";
import { createInitialQuestProgress, normalizeQuestProgress } from "../quests/engine";
import type { QuestProgress } from "../quests/types";
import { canonicalCard } from "./card-service";
import { projectGrowth } from "./game-state-reducer";
import { inventoryProjection, syncAlchemyProductInventory } from "./inventory-service";
import { normalizePlayerGrowth } from "./progression-service";
import { SAVE_VERSION, type ActivityReceipt, type AlchemyProgress, type UnifiedCardInstance, type UnifiedGameState, type UnifiedItemStack } from "./types";
import { createInitialKitchen, normalizeKitchen } from "../kitchen/service";
import { mergeSummonShowcaseCards } from "../battle/summon-showcase";

const ITEM_TYPES = new Set(["gift", "material", "pill", "food", "equipment", "card", "treasure", "quest", "fish", "manual"]);
const PERIODS = new Set(["清晨", "上午", "午后", "黄昏", "夜晚", "深夜"]);
const CARD_MODES = new Set(["active", "passive"]);
const CARD_SOURCES = new Set(["story", "alchemy", "dungeon"]);
const LEGACY_CHARACTER_ART: Record<string, string> = {
  "/assets/characters/shen-qingshuang.webp": "/assets/characters/portrait-refresh/shen-qingshuang.png",
  "/assets/characters/liu-zhiyi.webp": "/assets/characters/portrait-refresh/liu-zhiyi.png",
};

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

function sanitizeEasterEggProgress(value: unknown, collectedIds: string[], fallbackDay: number) {
  const source = asRecord(value);
  return Object.fromEntries(collectedIds.map((itemId) => {
    const record = asRecord(source[itemId]);
    return [itemId, {
      acquiredDay: integer(record.acquiredDay, fallbackDay, 1),
      shownTo: stringArray(record.shownTo),
      unlockedNoteIds: stringArray(record.unlockedNoteIds),
    }];
  }));
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
      ...(typeof item.lastAcquiredAt === "number" && Number.isFinite(item.lastAcquiredAt) ? { lastAcquiredAt: Math.max(0, Math.floor(item.lastAcquiredAt)) } : {}),
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
    return [canonicalCard({ ...card, id: card.id, characterId: card.characterId, name: card.name, art: LEGACY_CHARACTER_ART[card.art] ?? card.art, mode: card.mode, source: card.source, rarity: integer(card.rarity, 1, 1, 7) } as UnifiedCardInstance)];
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

function sanitizeActivityReceipt(value: unknown): ActivityReceipt | undefined {
  const receipt = asRecord(value);
  const kinds = new Set(["battle", "alchemy", "fishing", "mining", "farming", "livestock", "kitchen", "story", "quest"]);
  const targets = new Set(["inventory", "tasks", "alchemy", "battle", "farm", "fishing", "mining", "kitchen", "world"]);
  const nextStep = asRecord(receipt.nextStep);
  if (typeof receipt.id !== "string" || typeof receipt.title !== "string" || typeof receipt.summary !== "string" || !kinds.has(String(receipt.kind)) || !targets.has(String(nextStep.target)) || typeof nextStep.label !== "string") return undefined;
  return {
    id: receipt.id,
    kind: receipt.kind as ActivityReceipt["kind"],
    title: receipt.title,
    summary: receipt.summary,
    rewards: stringArray(receipt.rewards),
    impacts: stringArray(receipt.impacts),
    nextStep: { target: nextStep.target as ActivityReceipt["nextStep"]["target"], label: nextStep.label },
    createdAt: finiteNumber(receipt.createdAt, Date.now(), 0),
  };
}

export function cloneInitial(): UnifiedGameState {
  const starterCards = mergeSummonShowcaseCards([
    { id: "story-shen-sword-1", characterId: "shen", name: "沈清霜·霜华一剑", rarity: 4, mode: "active", source: "story", art: "/assets/characters/portrait-refresh/shen-qingshuang.png", activeEffect: "sword" },
    { id: "story-liu-ward-1", characterId: "liu", name: "柳知意·青囊护道", rarity: 3, mode: "passive", source: "story", art: "/assets/characters/portrait-refresh/liu-zhiyi.png", bonuses: { health: 60, defense: 18 } },
  ]);
  const romance = { ...INITIAL_STATE, inventory: { ...INITIAL_STATE.inventory }, relationships: { ...INITIAL_STATE.relationships }, flags: { ...INITIAL_STATE.flags }, playerLevel: 1, teacherSkillRanks: {}, learnedSkillIds: [], ownedCardIds: starterCards.map((card) => card.id), completedDungeons: [], alchemyResults: [], inventoryRarities: {}, inventoryItems: {}, pendingUnifiedEffects: [] };
  romance.spiritStones = 5000;
  const giftItems = Object.fromEntries(Object.entries(romance.inventory).map(([itemId, amount]) => [itemId, { itemId, itemType: "gift" as const, rarity: 2 as const, amount, sourceTags: ["romance", "starter"] }]));
  const materialItems = Object.fromEntries(MATERIALS.map((item) => [item.id, { itemId: item.id, itemType: "material" as const, rarity: Math.max(1, Math.min(7, item.rarity)) as 1|2|3|4|5|6|7, amount: item.count, sourceTags: ["alchemy", "starter"] }]));
  const starterCombatPillIds = new Set(["prd-37", "prd-38", "prd-39", "prd-40", "prd-41", "prd-42", "prd-43", "prd-44"]);
  const starterCombatPills = Object.fromEntries(PRODUCTS.filter((item) => starterCombatPillIds.has(item.id)).map((item) => [`turn-pill:${item.id}`, {
    itemId: `turn-pill:${item.id}`,
    templateId: item.id,
    itemType: "pill" as const,
    rarity: Math.max(1, Math.min(7, item.rarity)) as 1|2|3|4|5|6|7,
    amount: 2,
    quality: item.quality,
    displayName: item.name,
    sourceTags: ["回合战斗", "初始丹药匣"],
  }]));
  const items = { ...giftItems, ...materialItems, ...starterCombatPills };
  romance.inventoryItems = inventoryProjection(items);
  return {
    version: SAVE_VERSION,
    updatedAt: Date.now(),
    shared: { spiritStones: romance.spiritStones, stamina: romance.stamina, playerLevel: 1, playerExperience: romance.experience, items, cards: starterCards, learnedSkills: [], globalKeys: { ...romance.flags }, luck: { bonus: 0, charges: 0, source: "" } },
    romance,
    alchemy: {
      materialCounts: Object.fromEntries(MATERIALS.map((item) => [item.id, item.count])), productStacks: {}, characterCards: [], mythicRareUses: {}, marketOffers: [], manualRefreshCount: 0, refreshResetAt: 0, soldOutRefreshAt: 0, commissions: [], commissionRefreshAt: 0, discoveredRecipes: [],
    },
    battle: { ...DEFAULT_META, spiritStones: romance.spiritStones, baseAttributes: { ...DEFAULT_META.baseAttributes }, equipmentBag: DEFAULT_META.equipmentBag.map((item) => ({ ...item })), equipmentPositions: { ...DEFAULT_META.equipmentPositions }, personalBackpack: [], warehouse: [], equipped: {}, ownedCards: [], cardSlots: [null, null, null], attributeAllocation: { ...DEFAULT_META.attributeAllocation }, passiveRanks: {}, skillMastery: structuredClone(DEFAULT_META.skillMastery), wmDraft: structuredClone(DEFAULT_META.wmDraft), wmPublished: structuredClone(DEFAULT_META.wmPublished), weaponShop: { ...DEFAULT_META.weaponShop, stock: [], buyback: [] } },
    farm: createInitialFarm(),
    fishing: createInitialFishing(),
    mining: createInitialMining(),
    gathering: createInitialGathering(),
    kitchen: createInitialKitchen(),
    dungeons: { highestUnlocked: 1, completed: [], randomVisible: [] },
    quests: createInitialQuestProgress(),
    activity: { history: [] },
  };
}

export function mergeSave(saved: unknown) {
  const base = cloneInitial();
  const rawEnvelope = asRecord(saved);
  const rawVersion = integer(rawEnvelope.version, rawEnvelope.sceneId ? 1 : 0, 0, SAVE_VERSION + 1);
  if (rawVersion > SAVE_VERSION || rawVersion === 0) return base;
  const envelope = rawEnvelope.romance || !rawEnvelope.sceneId ? rawEnvelope : { version: rawVersion, romance: rawEnvelope };
  const savedShared = asRecord(envelope.shared);
  const savedRomance = asRecord(envelope.romance);
  const savedAlchemy = asRecord(envelope.alchemy);
  const savedBattle = asRecord(envelope.battle);
  const savedDungeons = asRecord(envelope.dungeons);
  const savedQuests = asRecord(envelope.quests);
  const savedKitchen = asRecord(envelope.kitchen);
  const collectedEasterEggs = stringArray(savedRomance.collectedEasterEggs);
  const savedDay = integer(savedRomance.day, base.romance.day, 1);
  const easterEggProgress = sanitizeEasterEggProgress(savedRomance.easterEggProgress, collectedEasterEggs, savedDay);
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
    pendingBatch: normalizeAlchemyBatch(savedAlchemy.pendingBatch),
    completedBrews: integer(savedAlchemy.completedBrews, 0, 0),
    brewSequence: integer(savedAlchemy.brewSequence, 0, 0),
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
    shopPurchases: { day: integer(asRecord(savedShared.shopPurchases).day, 0, 0), counts: numberRecord(asRecord(savedShared.shopPurchases).counts, {}, 0) },
    spiritStones: finiteNumber(savedShared.spiritStones, base.shared.spiritStones, 0),
    stamina: finiteNumber(savedShared.stamina, base.shared.stamina, 0, 10),
    playerLevel: integer(savedShared.playerLevel, base.shared.playerLevel, 1, 60),
    playerExperience: finiteNumber(savedShared.playerExperience, base.shared.playerExperience, 0),
    items,
    cards: mergeSummonShowcaseCards(sanitizeCards(savedShared.cards, base.shared.cards)),
    learnedSkills: numberArray(savedShared.learnedSkills, base.shared.learnedSkills),
    globalKeys: booleanRecord(savedShared.globalKeys, base.shared.globalKeys),
    luck: {
      bonus: finiteNumber(asRecord(savedShared.luck).bonus, 0, 0, 5),
      charges: integer(asRecord(savedShared.luck).charges, 0, 0, 9),
      source: typeof asRecord(savedShared.luck).source === "string" ? String(asRecord(savedShared.luck).source) : "",
    },
  };
  const normalizedBattle = normalizeMetaProgress({ ...base.battle, ...savedBattle });
  normalizedBattle.spiritStones = shared.spiritStones;
  normalizedBattle.backpackLevel = integer(savedBattle.backpackLevel, base.battle.backpackLevel, 0);
  normalizedBattle.safeLevel = integer(savedBattle.safeLevel, base.battle.safeLevel, 0);
  normalizedBattle.warehouseLevel = integer(savedBattle.warehouseLevel, base.battle.warehouseLevel, 0);
  normalizedBattle.baseAttributes = numberRecord(savedBattle.baseAttributes, base.battle.baseAttributes as unknown as Record<string, number>, 0) as unknown as typeof normalizedBattle.baseAttributes;
  normalizedBattle.attributeAllocation = numberRecord(savedBattle.attributeAllocation, base.battle.attributeAllocation as unknown as Record<string, number>, 0) as unknown as typeof normalizedBattle.attributeAllocation;
  normalizedBattle.passiveRanks = numberRecord(savedBattle.passiveRanks, {}, 0);
  normalizedBattle.cardSlots = normalizedBattle.cardSlots.map((id) => id && shared.cards.some((card) => card.id === id && card.mode === "active") ? id : null);
  const romanceCandidate = { ...base.romance, ...savedRomance } as UnifiedGameState["romance"];
  let merged: UnifiedGameState = {
    ...base, version: SAVE_VERSION, updatedAt: finiteNumber(envelope.updatedAt, Date.now(), 0),
    shared,
    romance: {
      ...romanceCandidate,
      day: savedDay,
      period: PERIODS.has(String(savedRomance.period)) ? savedRomance.period as typeof base.romance.period : base.romance.period,
      sceneId: typeof savedRomance.sceneId === "string" ? savedRomance.sceneId as typeof base.romance.sceneId : base.romance.sceneId,
      selectedCharacterId: typeof savedRomance.selectedCharacterId === "string" ? savedRomance.selectedCharacterId as typeof base.romance.selectedCharacterId : base.romance.selectedCharacterId,
      spiritStones: shared.spiritStones,
      stamina: shared.stamina,
      experience: shared.playerExperience,
      ownedCardIds: shared.cards.map((card) => card.id),
      relationships: numberRecord(savedRomance.relationships, base.romance.relationships, 0, 100) as typeof base.romance.relationships,
      inventory: numberRecord(savedRomance.inventory, base.romance.inventory, 0) as typeof base.romance.inventory,
      flags: booleanRecord(savedRomance.flags, base.romance.flags),
      marketTreasures: numberRecord(savedRomance.marketTreasures, base.romance.marketTreasures, 0),
      proficiencyExperience: numberRecord(savedRomance.proficiencyExperience, base.romance.proficiencyExperience, 0),
      eventRuns: numberRecord(savedRomance.eventRuns, base.romance.eventRuns, 0),
      talkCounts: numberRecord(savedRomance.talkCounts, base.romance.talkCounts, 0),
      sceneVisits: numberRecord(savedRomance.sceneVisits, base.romance.sceneVisits, 0) as typeof base.romance.sceneVisits,
      sceneInspectionDays: numberRecord(savedRomance.sceneInspectionDays, base.romance.sceneInspectionDays, 0) as typeof base.romance.sceneInspectionDays,
      sceneInspectionSlots: Object.fromEntries(Object.entries(asRecord(savedRomance.sceneInspectionSlots)).filter(([, value]) => typeof value === "string" && /^\d+:(夜晚|深夜)$/.test(value))) as Record<string, string>,
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
      easterEggProgress,
      daybreakStoryRuns: stringArray(savedRomance.daybreakStoryRuns, base.romance.daybreakStoryRuns),
      daybreakAcknowledgedDays: numberArray(savedRomance.daybreakAcknowledgedDays, base.romance.daybreakAcknowledgedDays).filter((day) => day > 0),
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
      ...restoreDialogue(savedRomance.activeEvent, savedRomance.lastContext, stringArray(savedRomance.completedEvents), EVENTS),
      pendingUnifiedEffects: [],
    },
    alchemy,
    battle: normalizedBattle,
    farm: normalizeFarmProgress(envelope.farm as FarmProgress | undefined),
    fishing: normalizeFishingProgress(envelope.fishing as FishingProgress | undefined),
    mining: normalizeMiningProgress(envelope.mining as MiningProgress | undefined),
    gathering: normalizeGathering(envelope.gathering as GatheringProgress | undefined),
    kitchen: normalizeKitchen(savedKitchen),
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
    activity: (() => {
      const savedActivity = asRecord(envelope.activity);
      const last = sanitizeActivityReceipt(savedActivity.last);
      const history = (Array.isArray(savedActivity.history) ? savedActivity.history : [])
        .map(sanitizeActivityReceipt)
        .filter((receipt): receipt is ActivityReceipt => Boolean(receipt))
        .slice(0, 40);
      if (last && !history.some((receipt) => receipt.id === last.id)) history.unshift(last);
      return { ...(last ? { last } : {}), history: history.slice(0, 40) };
    })(),
  };
  const growth = normalizePlayerGrowth({ playerLevel: shared.playerLevel, playerExperience: shared.playerExperience });
  merged = projectGrowth(merged, growth);
  return merged;
}
