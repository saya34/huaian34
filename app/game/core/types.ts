import type { Dispatch, SetStateAction } from "react";
import type { CharacterCardRecord } from "../alchemy/advanced-card";
import type { DailyCommission, ProductStack } from "../alchemy/commissions";
import type { MarketOffer } from "../alchemy/market";
import type { MetaProgress } from "../battle/meta";
import type { GameState } from "../types";
import type { FarmProgress } from "../farm/farm";
import type { FishingProgress } from "../fishing/fishing";
import type { MiningProgress } from "../mining/mining";
import type { QuestProgress } from "../quests/types";
import type { GatheringProgress } from "../gathering/types";
import type { AlchemyBatch } from "../alchemy/batch-service";
import type { KitchenProgress, LuckBlessing } from "../kitchen/types";

export const SAVE_VERSION = 7 as const;

export type UnifiedRarity = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type UnifiedItemType = "gift" | "material" | "pill" | "food" | "equipment" | "card" | "treasure" | "quest" | "fish" | "manual";

export type UnifiedItemStack = {
  itemId: string;
  templateId?: string;
  itemType: UnifiedItemType;
  rarity: UnifiedRarity;
  amount: number;
  sourceTags: string[];
  locked?: boolean;
  quality?: string;
  mutation?: string;
  displayName?: string;
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
  pendingBatch?: AlchemyBatch | null;
  completedBrews?: number;
  brewSequence?: number;
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

export type ActivityDestination = "inventory" | "tasks" | "alchemy" | "battle" | "farm" | "fishing" | "mining" | "kitchen" | "world";

export type ActivityReceipt = {
  id: string;
  kind: "battle" | "alchemy" | "fishing" | "mining" | "farming" | "livestock" | "kitchen" | "story" | "quest";
  title: string;
  summary: string;
  rewards: string[];
  impacts: string[];
  nextStep: { target: ActivityDestination; label: string };
  createdAt: number;
};

export type SharedPlayerState = {
  shopPurchases?: { day: number; counts: Record<string, number> };
  spiritStones: number;
  stamina: number;
  playerLevel: number;
  playerExperience: number;
  items: Record<string, UnifiedItemStack>;
  cards: UnifiedCardInstance[];
  learnedSkills: number[];
  globalKeys: Record<string, boolean>;
  luck: LuckBlessing;
};

export type UnifiedGameState = {
  version: typeof SAVE_VERSION;
  updatedAt: number;
  shared: SharedPlayerState;
  romance: GameState;
  alchemy: AlchemyProgress;
  battle: MetaProgress;
  farm: FarmProgress;
  fishing: FishingProgress;
  mining: MiningProgress;
  gathering: GatheringProgress;
  kitchen: KitchenProgress;
  dungeons: DungeonProgress;
  quests: QuestProgress;
  activity: { last?: ActivityReceipt; history: ActivityReceipt[] };
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
  | { type: "restore_stamina"; amount: number }
  | { type: "add_luck"; bonus: number; charges: number; source: string }
  | { type: "consume_luck_charge" }
  | { type: "set_global_key"; key: string; value: boolean }
  | { type: "reveal_dungeon"; dungeonId: string }
  | { type: "complete_dungeon"; waveId: number; result: "victory" | "extracted" | "defeat" }
  | { type: "record_activity"; receipt: ActivityReceipt }
  | { type: "clear_activity" };

export type StateSetter<T> = Dispatch<SetStateAction<T>>;
