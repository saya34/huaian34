"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MATERIALS } from "../alchemy/item-data";
import { learnMetaSkill } from "../battle/meta";
import type { FarmProgress } from "../farm/farm";
import type { FishingProgress } from "../fishing/fishing";
import type { MiningProgress } from "../mining/mining";
import type { GatheringProgress } from "../gathering/types";
import type { QuestProgress } from "../quests/types";
import { keyFor, LocalPlayerStateRepository } from "./player-state-repository";
import type { AlchemyProgress, GameEffect, StateSetter, UnifiedGameState } from "./types";
import { grantPlayerExperience, normalizePlayerGrowth, type PlayerGrowth } from "./progression-service";
import { acquireInventoryStack, inventoryProjection, setInventoryStackAmount } from "./inventory-service";
import { upsertCard } from "./card-service";
import { reduceGameEffects } from "./game-state-reducer";
import { cloneInitial, mergeSave } from "./save-migration";
import { withAlchemyState } from "./alchemy-projection";

const repository = new LocalPlayerStateRepository();

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
  transact: (update: (current: UnifiedGameState) => UnifiedGameState) => void;
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
  useLayoutEffect(() => { if (!hydrated) return; if (externallySyncedState.current === state) { externallySyncedState.current = null; return; } void repository.save({ ...state, updatedAt: Date.now() }); }, [hydrated, state]);

  const setRomance = useCallback<StateSetter<UnifiedGameState["romance"]>>((action) => setState((current) => {
    const requested = typeof action === "function" ? action(current.romance) : action;
    if (requested === current.romance) return current;
    const pending = requested.pendingUnifiedEffects ?? [];
    let shared = { ...current.shared };
    let growth: PlayerGrowth = { playerLevel: shared.playerLevel, playerExperience: shared.playerExperience };
    let alchemy = current.alchemy;
    let dungeons = current.dungeons;
    let battle = current.battle;
    for (const effect of pending) {
      if (effect.type === "add_currency") shared = { ...shared, spiritStones: Math.max(0, shared.spiritStones + effect.amount) };
      else if (effect.type === "add_player_exp") growth = grantPlayerExperience(growth, effect.amount);
      else if (effect.type === "learn_skill") { battle = learnMetaSkill(battle, effect.skillId, true); shared = { ...shared, learnedSkills: [...new Set([...shared.learnedSkills, effect.skillId])] }; }
      else if (effect.type === "trigger_map_event") dungeons = { ...dungeons, randomVisible: [...new Set([...dungeons.randomVisible, effect.eventId])] };
      else if (effect.type === "add_item") {
        const item = acquireInventoryStack(shared.items,{ itemId: effect.itemId, itemType: effect.itemType, rarity: effect.rarity, amount: effect.amount, sourceTags: ["story"] },current.updatedAt);
        shared = { ...shared, items: { ...shared.items, [effect.itemId]: item } };
        if (MATERIALS.some((item) => item.id === effect.itemId)) alchemy = { ...alchemy, materialCounts: { ...alchemy.materialCounts, [effect.itemId]: (alchemy.materialCounts[effect.itemId] ?? 0) + effect.amount } };
      } else if (effect.type === "add_card") shared = { ...shared, cards: upsertCard(shared.cards, { id: effect.cardId, characterId: effect.characterId, name: effect.name, rarity: effect.rarity, mode: effect.mode, source: "story", art: effect.art, activeEffect: "sword" }) };
    }
    if (requested.spiritStones !== current.romance.spiritStones) shared = { ...shared, spiritStones: requested.spiritStones };
    if (requested.experience !== current.romance.experience) growth = grantPlayerExperience(growth, requested.experience - current.romance.experience);
    shared = { ...shared, ...growth };
    const next = { ...requested, pendingUnifiedEffects: [], spiritStones: shared.spiritStones, experience: growth.playerExperience, playerLevel: growth.playerLevel };
    let syncedItems={...shared.items};
    for(const [itemId,amount] of Object.entries(next.inventory)){
      const incoming=syncedItems[itemId]??{itemId,itemType:"gift" as const,rarity:2 as const,amount:0,sourceTags:["romance"]};
      syncedItems={...syncedItems,[itemId]:setInventoryStackAmount(syncedItems,incoming,amount,current.updatedAt)};
    }
    shared = { ...shared, spiritStones: next.spiritStones, stamina: next.stamina, items: syncedItems, globalKeys: { ...shared.globalKeys, ...next.flags } };
    const projected = { ...next, playerLevel: growth.playerLevel, teacherSkillRanks: current.battle.passiveRanks, learnedSkillIds: shared.learnedSkills, ownedCardIds: shared.cards.map((card) => card.id), completedDungeons: dungeons.completed, alchemyResults: Object.values(alchemy.productStacks).filter((stack) => stack.count > 0).map((stack) => stack.productId), inventoryRarities: Object.fromEntries(Object.entries(shared.items).map(([id, item]) => [id, item.rarity])), inventoryItems: inventoryProjection(shared.items) };
    return { ...current, romance: projected, shared, alchemy, dungeons, battle: { ...battle, spiritStones: shared.spiritStones, playerLevel: growth.playerLevel, playerExp: growth.playerExperience } };
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
    return withAlchemyState(current, alchemy);
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

  const applyEffects = useCallback((effects: GameEffect[]) => setState((current) => reduceGameEffects(current, effects)), []);

  const transact = useCallback((update: (current: UnifiedGameState) => UnifiedGameState) => setState(update), []);

  const value = useMemo(() => ({ state, hydrated, transact, setRomance, setBattle, setAlchemy, setFarm, setFishing, setMining, setGathering, setQuests, applyEffects, resetGame: () => setState(cloneInitial()) }), [transact, applyEffects, hydrated, setAlchemy, setBattle, setFarm, setFishing, setMining, setGathering, setQuests, setRomance, state]);
  return <UnifiedGameContext.Provider value={value}>{children}</UnifiedGameContext.Provider>;
}

export function useUnifiedGame() {
  const value = useContext(UnifiedGameContext);
  if (!value) throw new Error("useUnifiedGame must be used within UnifiedGameProvider");
  return value;
}
