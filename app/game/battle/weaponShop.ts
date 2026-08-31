import { RARITY_ORDER, type InventorySize, type TreasureRarity } from "./expedition";
import { findEquipmentPosition, organizeEquipment } from "./inventorySystem";
import { EQUIPMENT, equipmentById, equipmentValue, type EquipmentItem, type EquipmentPosition, type GearRarity } from "./progression";
import { rollManagedEquipment, type WMConfig } from "./weaponManager";

export interface WeaponShopState {
  weekKey: string;
  stock: EquipmentItem[];
  buyback: EquipmentItem[];
}

export const EMPTY_WEAPON_SHOP: WeaponShopState = { weekKey: "", stock: [], buyback: [] };
export const WEAPON_SHOP_GRID_SIZE: InventorySize = { columns: 10, rows: 10 };

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function weaponShopWeekNumber(gameDay: number) {
  return Math.floor((Math.max(1, Math.floor(gameDay)) - 1) / 7) + 1;
}

export function weaponShopWeekKey(gameDay: number) {
  return `game-week-${weaponShopWeekNumber(gameDay)}`;
}

export function nextWeaponShopRefreshDay(gameDay: number) {
  return weaponShopWeekNumber(gameDay) * 7 + 1;
}

function pickRarity(random: () => number, highestWave: number): TreasureRarity {
  const entries: Array<[TreasureRarity, number]> = [
    ["common", 30],
    ["fine", 34],
    ["rare", highestWave >= 3 ? 24 : 8],
    ["epic", highestWave >= 7 ? 10 : 2],
    ["immortal", highestWave >= 13 ? 2 : 0],
  ];
  let point = random() * entries.reduce((sum, entry) => sum + entry[1], 0);
  return entries.find((entry) => (point -= entry[1]) <= 0)?.[0] ?? "common";
}

export function generateWeeklyWeaponStock(config: WMConfig, weekKey: string, highestWave: number, playerLevel: number) {
  const random = seededRandom(hashText(`${weekKey}:玄锋号:${Math.max(1, highestWave)}:${Math.max(1, playerLevel)}`));
  const weaponConfig: WMConfig = {
    ...config,
    equipment: config.equipment.filter((rule) => EQUIPMENT.some((item) => item.id === rule.equipmentId && item.slot === "weapon")),
  };
  const stock: EquipmentItem[] = [];
  const positions: Record<string, EquipmentPosition> = {};
  const targetCount = 20 + Math.floor(random() * 5);
  for (let attempt = 0; attempt < 420 && stock.length < targetCount; attempt++) {
    const rarity = pickRarity(random, highestWave);
    const item = rollManagedEquipment(weaponConfig, Math.max(1, highestWave), rarity, attempt, random);
    if (!item || equipmentById(item.equipmentId).slot !== "weapon") continue;
    item.uid = `xuanfeng-${weekKey}-${stock.length}-${Math.floor(random() * 0xffffff).toString(36)}`;
    item.identified = random() >= .46;
    const point = findEquipmentPosition(stock, positions, item, WEAPON_SHOP_GRID_SIZE);
    if (!point) continue;
    positions[item.uid] = point;
    stock.push(item);
  }
  const unknownNeeded = Math.min(2, stock.length);
  for (let index = 0; index < unknownNeeded; index++) stock[index].identified = false;
  if (stock.length > 2 && stock.every((item) => item.identified === false)) stock[stock.length - 1].identified = true;
  return stock;
}

export function ensureWeeklyWeaponShop(state: WeaponShopState | undefined, config: WMConfig, highestWave: number, playerLevel: number, gameDay: number) {
  const weekKey = weaponShopWeekKey(gameDay);
  if (state?.weekKey === weekKey) return state;
  return { weekKey, stock: generateWeeklyWeaponStock(config, weekKey, highestWave, playerLevel), buyback: [] };
}

export function normalizeWeaponShop(value: Partial<WeaponShopState> | null | undefined): WeaponShopState {
  const valid = (item: unknown): item is EquipmentItem => Boolean(item && typeof item === "object" && typeof (item as EquipmentItem).uid === "string" && typeof (item as EquipmentItem).equipmentId === "string");
  return {
    weekKey: typeof value?.weekKey === "string" ? value.weekKey : "",
    stock: Array.isArray(value?.stock) ? value.stock.filter(valid) : [],
    buyback: Array.isArray(value?.buyback) ? value.buyback.filter(valid) : [],
  };
}

export function weaponGridPositions(items: EquipmentItem[], size: InventorySize = WEAPON_SHOP_GRID_SIZE) {
  return organizeEquipment(items, size) ?? {};
}

export function weaponPurchasePrice(item: EquipmentItem, buyback = false) {
  if (buyback) return weaponSellPrice(item);
  return Math.max(1, Math.round(equipmentValue(item) * 1.22));
}

export function weaponSellPrice(item: EquipmentItem) {
  const definition = equipmentById(item.equipmentId);
  const value = item.identified === false ? item.price ?? definition.price : equipmentValue(item);
  return Math.max(1, Math.floor(value / 4));
}

export function publicWeaponRarity(item: EquipmentItem): GearRarity | null {
  if (item.identified === false) return null;
  return item.rarity ?? equipmentById(item.equipmentId).rarity;
}

export function rarityRank(rarity: GearRarity) {
  return Math.max(0, RARITY_ORDER.indexOf(rarity));
}
