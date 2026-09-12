import type { UnifiedItemType } from "./types";

export type InventoryQuery = { itemType?: UnifiedItemType; templateId?: string; minRarity?: number; minAmount?: number };
export type InventoryEntry = { itemId?: string; templateId?: string; itemType: UnifiedItemType; rarity: number; amount: number };

export const itemTemplateId = (item: InventoryEntry) => item.templateId ?? item.itemId ?? "";

export function inventoryMatches(item: InventoryEntry, query: InventoryQuery) {
  return item.amount >= (query.minAmount ?? 1)
    && (!query.itemType || item.itemType === query.itemType)
    && (!query.templateId || itemTemplateId(item) === query.templateId)
    && item.rarity >= (query.minRarity ?? 1);
}

export function inventoryCount(items: Record<string, InventoryEntry>, query: InventoryQuery) {
  return Object.values(items).filter((item) => inventoryMatches(item, query)).reduce((sum, item) => sum + item.amount, 0);
}

export function hasInventoryItem(items: Record<string, InventoryEntry>, query: InventoryQuery) {
  return inventoryCount(items, query) >= (query.minAmount ?? 1);
}
