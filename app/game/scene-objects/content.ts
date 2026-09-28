import { ITEM_TABLE } from "../alchemy/item-data";
import type { UnifiedItemType, UnifiedRarity } from "../core/types";
import rawContent from "./scene-objects.json";

export type SceneObjectRewardEntry = {
  id: string;
  weight: number;
  amount: [number, number];
};

export type SceneObjectDefinition = {
  id: string;
  sceneId: string;
  name: string;
  description: string;
  interaction: string;
  atlas: string;
  cell: [number, number];
  atlasAspect: number;
  layout: { x: number; y: number; size: number };
  production: {
    initialDelayDays: number;
    intervalDays: [number, number];
    spawnChance: number;
    commonPool: SceneObjectRewardEntry[];
    rareChance: number;
    rarePool: SceneObjectRewardEntry[];
  };
};

export type SceneObjectRewardMeta = {
  id: string;
  name: string;
  description: string;
  itemType: UnifiedItemType;
  rarity: UnifiedRarity;
  image: string;
};

type RawContent = {
  rewardCatalog: SceneObjectRewardMeta[];
  objects: SceneObjectDefinition[];
};

const content = rawContent as unknown as RawContent;
const customRewards = new Map(content.rewardCatalog.map((reward) => [reward.id, reward]));

export const SCENE_OBJECTS = content.objects;

export function sceneObjectsFor(sceneId: string) {
  return SCENE_OBJECTS.filter((definition) => definition.sceneId === sceneId);
}
export function sceneObjectRewardById(itemId: string): SceneObjectRewardMeta | undefined {
  const custom = customRewards.get(itemId);
  if (custom) return custom;
  const item = ITEM_TABLE.find((entry) => entry.id === itemId);
  if (!item) return undefined;
  const itemType: UnifiedItemType = item.itemType === "material"
    ? "material"
    : item.category === "丹药"
      ? "pill"
      : item.category === "法器"
        ? "equipment"
        : "treasure";
  return {
    id: item.id,
    name: item.name,
    description: item.effect,
    itemType,
    rarity: Math.max(1, Math.min(7, item.rarity)) as UnifiedRarity,
    image: item.image,
  };
}

export function isSceneObjectReward(itemId: string) {
  return customRewards.has(itemId);
}
