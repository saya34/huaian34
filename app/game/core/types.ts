import type { Dispatch, SetStateAction } from "react";
import type { CharacterCardRecord } from "../alchemy/advanced-card";
import type { DailyCommission, ProductStack } from "../alchemy/commissions";
import type { MarketOffer } from "../alchemy/market";
import type { MetaProgress } from "../battle/meta";
import type { GameState } from "../types";

export const SAVE_VERSION = 2 as const;

export type UnifiedRarity = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type UnifiedItemType = "gift" | "material" | "pill" | "equipment" | "card" | "treasure" | "quest";

export type UnifiedItemStack = {
  itemId: string;
  itemType: UnifiedItemType;
  rarity: UnifiedRarity;
  amount: number;
  sourceTags: string[];
  locked?: boolean;
};

export type UnifiedCardInstance = {
  id: string;
  characterId: string;
  name: string;
  rarity: UnifiedRarity;
  mode: "active" | "passive";
  source: "story" | "alchemy" | "dungeon";
  art: string;
  activeEffect?: "sword" | "assault" | "healing" | "ward" | "frost";
  bonuses?: Partial<Record<"health" | "defense" | "damage" | "dodge" | "moveSpeed" | "expGain" | "attackSpeed" | "projectileSpeed", number>>;
  alchemyRecord?: CharacterCardRecord;
};

export type AlchemyProgress = {
  materialCounts: Record<string, number>;
  productStacks: Record<string, ProductStack>;
  characterCards: CharacterCardRecord[];
  mythicRareUses: Record<string, number>;
  marketOffers: MarketOffer[];
  manualRefreshCount: number;
  refreshResetAt: number;
  soldOutRefreshAt: number;
  commissions: DailyCommission[];
  commissionRefreshAt: number;
  discoveredRecipes: string[];
};

export type DungeonProgress = {
  highestUnlocked: number;
  completed: number[];
  randomVisible: string[];
  lastSettlement?: "victory" | "extracted" | "defeat";
};

export type SharedPlayerState = {
  spiritStones: number;
  stamina: number;
  playerLevel: number;
  playerExperience: number;
  items: Record<string, UnifiedItemStack>;
  cards: UnifiedCardInstance[];
  learnedSkills: number[];
  globalKeys: Record<string, boolean>;
};

export type UnifiedGameState = {
  version: typeof SAVE_VERSION;
  updatedAt: number;
  shared: SharedPlayerState;
  romance: GameState;
  alchemy: AlchemyProgress;
  battle: MetaProgress;
  dungeons: DungeonProgress;
};

export type GameEffect =
  | { type: "add_item"; item: UnifiedItemStack }
  | { type: "remove_item"; itemId: string; amount: number }
  | { type: "add_card"; card: UnifiedCardInstance }
  | { type: "learn_skill"; skillId: number }
  | { type: "add_currency"; amount: number }
  | { type: "add_relationship"; characterId: string; amount: number }
  | { type: "add_player_exp"; amount: number }
  | { type: "spend_stamina"; amount: number }
  | { type: "set_global_key"; key: string; value: boolean }
  | { type: "complete_dungeon"; waveId: number; result: "victory" | "extracted" | "defeat" };

export type StateSetter<T> = Dispatch<SetStateAction<T>>;
