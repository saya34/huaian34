import rules from "./content/trading.json";
import { ITEM_TABLE, MATERIALS } from "../alchemy/item-data";
import { getMutationValue, type MutationId } from "../alchemy/commissions";
import { getMarketPrice, getManualRefreshPrice, MARKET_RESET_TICKS, SOLD_OUT_REFRESH_TICKS, type MarketOffer } from "../alchemy/market";
import { treasureById } from "../battle/expedition";
import { fishById } from "../fishing/fishing";
import { livestockProductById } from "../farm/livestock";
import { manualItemById, SHOP_MANUAL } from "../skills/manual-items";
import { SHOP_OFFERS } from "../shop-content";
import { reduceGameEffects } from "./game-state-reducer";
import type { UnifiedGameState, UnifiedItemStack } from "./types";

export const MONTHLY_MARKET_PRICES = rules.monthlyMarketPrices;
export function shopDiscount(state: UnifiedGameState) {
  const bond = state.romance.relationships.ning ?? 0;
  return Math.max(rules.minimumDiscount, (bond >= 65 ? .82 : bond >= 35 ? .88 : bond >= 15 ? .94 : 1) * (state.shared.globalKeys.medicine_supply_restored ? .92 : 1));
}
function shopOffer(itemId: string) {
  if (itemId === SHOP_MANUAL.itemId) return { price: SHOP_MANUAL.price, stock: rules.dailyStock.manual };
  const offer = SHOP_OFFERS.find((entry) => entry.itemId === itemId);
  return offer ? { price: offer.price, stock: rules.dailyStock[offer.stock] } : null;
}
export function shopStockRemaining(state: UnifiedGameState, itemId: string) {
  const purchases = state.shared.shopPurchases;
  return Math.max(0, (shopOffer(itemId)?.stock ?? 0) - (purchases?.day === state.romance.day ? purchases.counts[itemId] ?? 0 : 0));
}
export function shopBuyPrice(state: UnifiedGameState, itemId: string) {
  return Math.max(1, Math.round((shopOffer(itemId)?.price ?? 0) * shopDiscount(state)));
}

/** Every known purchasing channel caps resale below its cheapest legal purchase price. */
export function itemSellValue(stack: UnifiedItemStack) {
  const id = stack.templateId ?? stack.itemId;
  const item = ITEM_TABLE.find((entry) => entry.id === id);
  const manual = manualItemById(id);
  const treasure = stack.itemType === "treasure" ? treasureById(id.replace(/^treasure:/, "")) : undefined;
  const fish = stack.itemType === "fish" ? fishById(id) : undefined;
  const livestock = livestockProductById(id);
  const value = item ? (stack.mutation ? getMutationValue(item, stack.mutation as MutationId) : item.value) : treasure?.value ?? fish?.value ?? livestock?.productValue ?? manual?.price ?? stack.rarity ** 2 * 45;
  const buyPrices: number[] = [];
  const offer = shopOffer(id);
  if (offer) buyPrices.push(Math.round(offer.price * rules.minimumDiscount));
  if (item?.itemType === "material") buyPrices.push(getMarketPrice(item));
  const monthly = rules.monthlyMarketPrices[id as keyof typeof rules.monthlyMarketPrices];
  if (monthly) buyPrices.push(monthly);
  return Math.max(1, Math.floor(Math.min(value, ...buyPrices) * rules.resaleRatio));
}

export function buyShopItem(state: UnifiedGameState, itemId: string): UnifiedGameState {
  const offer = shopOffer(itemId);
  const price = shopBuyPrice(state, itemId);
  if (!offer || !shopStockRemaining(state, itemId) || state.shared.spiritStones < price) return state;
  const counts = state.shared.shopPurchases?.day === state.romance.day ? state.shared.shopPurchases.counts : {};
  const next = reduceGameEffects(state, [
    { type: "add_currency", amount: -price },
    { type: "add_item", item: { itemId, itemType: itemId === SHOP_MANUAL.itemId ? "manual" : "gift", rarity: itemId === SHOP_MANUAL.itemId ? SHOP_MANUAL.rarity : itemId === "jadeAbacusCharm" ? 4 : 2, amount: 1, sourceTags: ["栖珍阁", "购入"] } },
  ]);
  return { ...next, shared: { ...next.shared, shopPurchases: { day: state.romance.day, counts: { ...counts, [itemId]: (counts[itemId] ?? 0) + 1 } } } };
}

export function sellShopItem(state: UnifiedGameState, itemId: string, quantity: number): UnifiedGameState {
  const item = state.shared.items[itemId];
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || !item || item.locked || item.itemType === "quest" || item.itemType === "card" || item.amount < quantity) return state;
  // Equipment has its own instance-aware sale path; never pay for its inventory projection.
  if (item.itemType === "equipment") return state;
  let next = reduceGameEffects(state, [{ type: "remove_item", itemId, amount: quantity }, { type: "add_currency", amount: itemSellValue(item) * quantity }]);
  if (item.itemType === "treasure") {
    let remaining = quantity;
    const treasureId = itemId.replace(/^treasure:/, "");
    const remove = <T extends { treasureId: string }>(items: T[]) => items.filter((entry) => entry.treasureId !== treasureId || remaining-- <= 0);
    next = { ...next, battle: { ...next.battle, personalBackpack: remove(next.battle.personalBackpack), warehouse: remove(next.battle.warehouse) } };
  }
  return next;
}

function marketClock(state: UnifiedGameState) {
  return (state.romance.day - 1) * 6 + ["清晨", "上午", "午后", "黄昏", "夜晚", "深夜"].indexOf(state.romance.period);
}
export function buyAlchemyMarketOffer(state: UnifiedGameState, offerId: string): UnifiedGameState {
  const offer = state.alchemy.marketOffers.find((entry) => entry.id === offerId);
  const item = offer && MATERIALS.find((entry) => entry.id === offer.itemId);
  if (!offer || offer.sold || !item || state.shared.spiritStones < getMarketPrice(item)) return state;
  const next = reduceGameEffects(state, [
    { type: "add_currency", amount: -getMarketPrice(item) },
    { type: "add_item", item: { itemId: item.id, itemType: "material", rarity: Math.max(1, Math.min(7, item.rarity)) as UnifiedItemStack["rarity"], amount: 1, sourceTags: ["云游集市"] } },
  ]);
  const marketOffers = next.alchemy.marketOffers.map((entry) => entry.id === offerId ? { ...entry, sold: true } : entry);
  return { ...next, alchemy: { ...next.alchemy, marketOffers, soldOutRefreshAt: marketOffers.every((entry) => entry.sold) ? marketClock(state) + SOLD_OUT_REFRESH_TICKS : next.alchemy.soldOutRefreshAt } };
}
export function refreshAlchemyMarket(state: UnifiedGameState, offers: MarketOffer[]): UnifiedGameState {
  const price = getManualRefreshPrice(state.alchemy.manualRefreshCount);
  if (state.shared.spiritStones < price) return state;
  const next = reduceGameEffects(state, [{ type: "add_currency", amount: -price }]);
  return { ...next, alchemy: { ...next.alchemy, marketOffers: offers, manualRefreshCount: next.alchemy.manualRefreshCount + 1, refreshResetAt: marketClock(state) + MARKET_RESET_TICKS, soldOutRefreshAt: 0 } };
}
