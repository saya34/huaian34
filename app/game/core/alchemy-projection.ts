import { MATERIALS } from "../alchemy/item-data";
import { inventoryProjection, syncAlchemyProductInventory } from "./inventory-service";
import type { AlchemyProgress, UnifiedGameState } from "./types";

/** All alchemy writes update the inventory projections in the same transaction. */
export function withAlchemyState(current: UnifiedGameState, alchemy: AlchemyProgress): UnifiedGameState {
  const materialItems = Object.fromEntries(MATERIALS.map((item) => [item.id, {
    ...(current.shared.items[item.id] ?? { itemId: item.id, itemType: "material" as const, rarity: Math.max(1, Math.min(7, item.rarity)) as 1|2|3|4|5|6|7, sourceTags: ["alchemy"] }),
    amount: alchemy.materialCounts[item.id] ?? 0,
  }]));
  const items = syncAlchemyProductInventory({ ...current.shared.items, ...materialItems }, alchemy.productStacks);
  return { ...current, alchemy, shared: { ...current.shared, items }, romance: {
    ...current.romance,
    alchemyResults: Object.values(alchemy.productStacks).filter((stack) => stack.count > 0).map((stack) => stack.productId),
    inventoryRarities: Object.fromEntries(Object.entries(items).map(([id, item]) => [id, item.rarity])),
    inventoryItems: inventoryProjection(items),
  } };
}
