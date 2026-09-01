"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MATERIALS } from "../alchemy/item-data";
import { DEFAULT_META, normalizeMetaProgress } from "../battle/meta";
import { EVENTS } from "../content";
import { INITIAL_STATE } from "../event-engine";
import { createInitialFarm, normalizeFarmProgress, type FarmProgress } from "../farm/farm";
import { createInitialFishing, normalizeFishingProgress, type FishingProgress } from "../fishing/fishing";
import { keyFor, LocalPlayerStateRepository } from "./player-state-repository";
import { SAVE_VERSION, type AlchemyProgress, type GameEffect, type StateSetter, type UnifiedGameState } from "./types";

const repository = new LocalPlayerStateRepository();

function collectedQuestItems(collectedIds: string[] = []) {
  const collected = new Set(collectedIds);
  return Object.fromEntries(EVENTS.flatMap((event) => {
    const item = event.exploration?.rewardItem;
    if (!item || !collected.has(item.id)) return [];
    return [[item.id, { itemId: item.id, itemType: "quest" as const, rarity: 4 as const, amount: 1, sourceTags: ["剧情", "藏珍录"], locked: true }]];
  }));
}

function cloneInitial(): UnifiedGameState {
  const romance = { ...INITIAL_STATE, inventory: { ...INITIAL_STATE.inventory }, relationships: { ...INITIAL_STATE.relationships }, flags: { ...INITIAL_STATE.flags }, playerLevel: 1, teacherSkillRanks: {}, learnedSkillIds: [], ownedCardIds: ["story-shen-sword-1", "story-liu-ward-1"], completedDungeons: [], alchemyResults: [], inventoryRarities: {}, pendingUnifiedEffects: [] };
  romance.spiritStones = 5000;
  const giftItems = Object.fromEntries(Object.entries(romance.inventory).map(([itemId, amount]) => [itemId, { itemId, itemType: "gift" as const, rarity: 2 as const, amount, sourceTags: ["romance", "starter"] }]));
  const materialItems = Object.fromEntries(MATERIALS.map((item) => [item.id, { itemId: item.id, itemType: "material" as const, rarity: Math.max(1, Math.min(7, item.rarity)) as 1|2|3|4|5|6|7, amount: item.count, sourceTags: ["alchemy", "starter"] }]));
  const items = { ...giftItems, ...materialItems };
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
    dungeons: { highestUnlocked: 1, completed: [], randomVisible: [] },
  };
}

function mergeSave(saved: UnifiedGameState | null) {
  const base = cloneInitial();
  if (!saved || saved.version !== SAVE_VERSION) return base;
  return {
    ...base, ...saved, version: SAVE_VERSION,
    shared: { ...base.shared, ...saved.shared, items: { ...base.shared.items, ...saved.shared?.items, ...collectedQuestItems(saved.romance?.collectedEasterEggs) }, globalKeys: { ...base.shared.globalKeys, ...saved.shared?.globalKeys } },
    romance: {
      ...base.romance,
      ...saved.romance,
      relationships: { ...base.romance.relationships, ...saved.romance?.relationships },
      inventory: { ...base.romance.inventory, ...saved.romance?.inventory },
      flags: { ...base.romance.flags, ...saved.romance?.flags },
      activeEvent: null,
    },
    alchemy: { ...base.alchemy, ...saved.alchemy }, battle: normalizeMetaProgress({ ...base.battle, ...saved.battle }), farm: normalizeFarmProgress(saved.farm), fishing: normalizeFishingProgress(saved.fishing), dungeons: { ...base.dungeons, ...saved.dungeons },
  };
}

type UnifiedContextValue = {
  state: UnifiedGameState;
  hydrated: boolean;
  setRomance: StateSetter<UnifiedGameState["romance"]>;
  setBattle: StateSetter<UnifiedGameState["battle"]>;
  setAlchemy: StateSetter<AlchemyProgress>;
  setFarm: StateSetter<FarmProgress>;
  setFishing: StateSetter<FishingProgress>;
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
    let alchemy = current.alchemy;
    let dungeons = current.dungeons;
    for (const effect of pending) {
      if (effect.type === "add_currency") shared = { ...shared, spiritStones: Math.max(0, shared.spiritStones + effect.amount) };
      else if (effect.type === "add_player_exp") shared = { ...shared, playerExperience: shared.playerExperience + effect.amount };
      else if (effect.type === "learn_skill") shared = { ...shared, learnedSkills: [...new Set([...shared.learnedSkills, effect.skillId])] };
      else if (effect.type === "trigger_map_event") dungeons = { ...dungeons, randomVisible: [...new Set([...dungeons.randomVisible, effect.eventId])] };
      else if (effect.type === "add_item") {
        const previous = shared.items[effect.itemId];
        shared = { ...shared, items: { ...shared.items, [effect.itemId]: { itemId: effect.itemId, itemType: effect.itemType, rarity: effect.rarity, amount: (previous?.amount ?? 0) + effect.amount, sourceTags: ["story"] } } };
        if (MATERIALS.some((item) => item.id === effect.itemId)) alchemy = { ...alchemy, materialCounts: { ...alchemy.materialCounts, [effect.itemId]: (alchemy.materialCounts[effect.itemId] ?? 0) + effect.amount } };
      } else if (effect.type === "add_card") shared = { ...shared, cards: [...shared.cards, { id: effect.cardId, characterId: effect.characterId, name: effect.name, rarity: effect.rarity, mode: effect.mode, source: "story", art: effect.art, activeEffect: "sword" }] };
    }
    if (requested.spiritStones !== current.romance.spiritStones) shared = { ...shared, spiritStones: requested.spiritStones };
    if (requested.experience !== current.romance.experience) shared = { ...shared, playerExperience: requested.experience };
    if (requested.playerLevel !== current.romance.playerLevel) shared = { ...shared, playerLevel: requested.playerLevel ?? current.romance.playerLevel ?? 1 };
    const next = { ...requested, pendingUnifiedEffects: [], spiritStones: shared.spiritStones, experience: shared.playerExperience };
    const giftItems = Object.fromEntries(Object.entries(next.inventory).map(([itemId, amount]) => [itemId, { ...(current.shared.items[itemId] ?? { itemId, itemType: "gift" as const, rarity: 2 as const, sourceTags: ["romance"] }), amount }]));
    shared = { ...shared, spiritStones: next.spiritStones, stamina: next.stamina, playerExperience: next.experience, items: { ...shared.items, ...giftItems }, globalKeys: { ...shared.globalKeys, ...next.flags } };
    const projected = { ...next, playerLevel: shared.playerLevel, teacherSkillRanks: current.battle.passiveRanks, learnedSkillIds: shared.learnedSkills, ownedCardIds: shared.cards.map((card) => card.id), completedDungeons: dungeons.completed, alchemyResults: Object.values(alchemy.productStacks).filter((stack) => stack.count > 0).map((stack) => stack.productId), inventoryRarities: Object.fromEntries(Object.entries(shared.items).map(([id, item]) => [id, item.rarity])) };
    return { ...current, romance: projected, shared, alchemy, dungeons, battle: { ...current.battle, spiritStones: shared.spiritStones, playerLevel: shared.playerLevel, playerExp: shared.playerExperience } };
  }), []);

  const setBattle = useCallback<StateSetter<UnifiedGameState["battle"]>>((action) => setState((current) => {
    const next = typeof action === "function" ? action(current.battle) : action;
    if (next === current.battle) return current;
    const spiritStones = next.spiritStones;
    const battleExperienceChanged = next.playerExp !== current.battle.playerExp || next.playerLevel !== current.battle.playerLevel;
    const playerExperience = battleExperienceChanged ? next.playerExp : current.shared.playerExperience;
    const playerLevel = battleExperienceChanged ? next.playerLevel : current.shared.playerLevel;
    const synchronizedBattle = battleExperienceChanged ? next : { ...next, playerExp: playerExperience, playerLevel };
    const learnedSkills = Object.entries(next.skillMastery).filter(([, value]) => value.learned).map(([id]) => Number(id));
    return { ...current, battle: synchronizedBattle, shared: { ...current.shared, spiritStones, playerLevel, playerExperience, learnedSkills }, romance: { ...current.romance, spiritStones, experience: playerExperience, playerLevel, teacherSkillRanks: next.passiveRanks, learnedSkillIds: learnedSkills } };
  }), []);

  const setAlchemy = useCallback<StateSetter<AlchemyProgress>>((action) => setState((current) => {
    const alchemy = typeof action === "function" ? action(current.alchemy) : action;
    if (alchemy === current.alchemy) return current;
    const materialItems = Object.fromEntries(MATERIALS.map((item) => [item.id, { ...(current.shared.items[item.id] ?? { itemId: item.id, itemType: "material" as const, rarity: Math.max(1, Math.min(7, item.rarity)) as 1|2|3|4|5|6|7, sourceTags: ["alchemy"] }), amount: alchemy.materialCounts[item.id] ?? 0 }]));
    const items = { ...current.shared.items, ...materialItems };
    const alchemyResults = Object.values(alchemy.productStacks).filter((stack) => stack.count > 0).map((stack) => stack.productId);
    return { ...current, alchemy, shared: { ...current.shared, items }, romance: { ...current.romance, alchemyResults, inventoryRarities: Object.fromEntries(Object.entries(items).map(([id, item]) => [id, item.rarity])) } };
  }), []);

  const setFarm = useCallback<StateSetter<FarmProgress>>((action) => setState((current) => {
    const farm = typeof action === "function" ? action(current.farm) : action;
    return farm === current.farm ? current : { ...current, farm };
  }), []);

  const setFishing = useCallback<StateSetter<FishingProgress>>((action) => setState((current) => {
    const fishing = typeof action === "function" ? action(current.fishing) : action;
    return fishing === current.fishing ? current : { ...current, fishing };
  }), []);

  const applyEffects = useCallback((effects: GameEffect[]) => setState((current) => effects.reduce((next, effect) => {
    if (effect.type === "add_currency") { const spiritStones = Math.max(0, next.shared.spiritStones + effect.amount); return { ...next, shared: { ...next.shared, spiritStones }, romance: { ...next.romance, spiritStones }, battle: { ...next.battle, spiritStones } }; }
    if (effect.type === "spend_stamina") { const stamina = Math.max(0, next.shared.stamina - effect.amount); return { ...next, shared: { ...next.shared, stamina }, romance: { ...next.romance, stamina } }; }
    if (effect.type === "add_item") {
      const previous = next.shared.items[effect.item.itemId];
      const item = { ...effect.item, amount: (previous?.amount ?? 0) + effect.item.amount };
      const isAlchemyMaterial = MATERIALS.some((entry) => entry.id === item.itemId);
      const romance = item.itemType === "gift" ? { ...next.romance, inventory: { ...next.romance.inventory, [item.itemId]: (next.romance.inventory[item.itemId] ?? 0) + effect.item.amount } } : next.romance;
      return { ...next, romance, shared: { ...next.shared, items: { ...next.shared.items, [item.itemId]: item } }, alchemy: isAlchemyMaterial ? { ...next.alchemy, materialCounts: { ...next.alchemy.materialCounts, [item.itemId]: (next.alchemy.materialCounts[item.itemId] ?? 0) + effect.item.amount } } : next.alchemy };
    }
    if (effect.type === "remove_item") {
      const previous = next.shared.items[effect.itemId]; if (!previous) return next;
      const amount = Math.max(0, previous.amount - effect.amount);
      const isAlchemyMaterial = MATERIALS.some((entry) => entry.id === effect.itemId);
      const romance = previous.itemType === "gift" ? { ...next.romance, inventory: { ...next.romance.inventory, [effect.itemId]: amount } } : next.romance;
      return { ...next, romance, shared: { ...next.shared, items: { ...next.shared.items, [effect.itemId]: { ...previous, amount } } }, alchemy: isAlchemyMaterial ? { ...next.alchemy, materialCounts: { ...next.alchemy.materialCounts, [effect.itemId]: amount } } : next.alchemy };
    }
    if (effect.type === "add_card") { const cards = [...next.shared.cards, effect.card]; return { ...next, shared: { ...next.shared, cards }, romance: { ...next.romance, ownedCardIds: cards.map((card) => card.id) } }; }
    if (effect.type === "learn_skill") return { ...next, shared: { ...next.shared, learnedSkills: [...new Set([...next.shared.learnedSkills, effect.skillId])] } };
    if (effect.type === "add_relationship") return { ...next, romance: { ...next.romance, relationships: { ...next.romance.relationships, [effect.characterId]: Math.max(0, (next.romance.relationships[effect.characterId] ?? 0) + effect.amount) } } };
    if (effect.type === "add_player_exp") return { ...next, shared: { ...next.shared, playerExperience: next.shared.playerExperience + effect.amount }, romance: { ...next.romance, experience: next.romance.experience + effect.amount } };
    if (effect.type === "set_global_key") return { ...next, shared: { ...next.shared, globalKeys: { ...next.shared.globalKeys, [effect.key]: effect.value } }, romance: { ...next.romance, flags: { ...next.romance.flags, [effect.key]: effect.value } } };
    if (effect.type === "complete_dungeon") {
      const completed = effect.result === "victory" ? [...new Set([...next.dungeons.completed, effect.waveId])] : next.dungeons.completed;
      const highestUnlocked = effect.result === "victory" ? Math.max(next.dungeons.highestUnlocked, Math.min(21, effect.waveId + 1)) : next.dungeons.highestUnlocked;
      const periods = ["清晨", "黄昏", "夜晚"] as const;
      const currentPeriodIndex = Math.max(0, periods.indexOf(next.romance.period));
      const wrapsToNextDay = currentPeriodIndex === periods.length - 1;
      const period = periods[(currentPeriodIndex + 1) % periods.length];
      const day = next.romance.day + (wrapsToNextDay ? 1 : 0);
      return {
        ...next,
        dungeons: { ...next.dungeons, completed, highestUnlocked, lastSettlement: effect.result },
        shared: { ...next.shared, stamina: 10 },
        romance: { ...next.romance, day, period, stamina: 10, completedDungeons: completed },
        battle: { ...next.battle, highestUnlockedWave: highestUnlocked },
      };
    }
    return next;
  }, current)), []);

  const value = useMemo(() => ({ state, hydrated, setRomance, setBattle, setAlchemy, setFarm, setFishing, applyEffects, resetGame: () => setState(cloneInitial()) }), [applyEffects, hydrated, setAlchemy, setBattle, setFarm, setFishing, setRomance, state]);
  return <UnifiedGameContext.Provider value={value}>{children}</UnifiedGameContext.Provider>;
}

export function useUnifiedGame() {
  const value = useContext(UnifiedGameContext);
  if (!value) throw new Error("useUnifiedGame must be used within UnifiedGameProvider");
  return value;
}
