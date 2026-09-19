import manualItems from "./content/manual-items.json";
import { manualById } from "./manual-service";
import type { UnifiedRarity } from "../core/types";

export type ManualItemDefinition = {
  itemId: string;
  skillId: number;
  name: string;
  description: string;
  rarity: UnifiedRarity;
  price: number;
  icon: string;
  tags: string[];
  source: string;
  art: string;
};

export const MANUAL_ITEMS: ManualItemDefinition[] = manualItems.items.map((item) => ({
  ...item,
  rarity: item.rarity as UnifiedRarity,
  art: manualById(item.skillId).art,
}));

export const SHOP_MANUAL = MANUAL_ITEMS.find((item) => item.itemId === "manual-snow-child")!;
export const FISHING_SECOND_CATCH_MANUAL = MANUAL_ITEMS.find((item) => item.itemId === "manual-thunder-incantation")!;

export function manualItemById(itemId: string) {
  return MANUAL_ITEMS.find((item) => item.itemId === itemId);
}
