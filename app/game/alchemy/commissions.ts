import { ElementType, GameItem, ItemQuality } from "./item-data";
import { getMarketPrice } from "./market";

export type MutationId = "normal" | "burnt" | "flawed" | "fine" | "supreme" | "perfect";
export type ProductStack = { productId: string; mutation: MutationId; count: number };
export type SpecificCommission = { id: string; kind: "specific"; itemId: string; quantity: number; reward: number };
export type FuzzyCommission = {
  id: string;
  kind: "fuzzy";
  requirement: "element" | "quality";
  element?: ElementType;
  minimumQuality?: ItemQuality;
  quantity: number;
  reward: number;
  pricingMode: "fixed" | "dynamic";
  title: string;
};
export type DailyCommission = SpecificCommission | FuzzyCommission;

export const COMMISSION_REFRESH_MS = 60_000;
export const COMMISSION_QUALITY_WEIGHTS: Record<ItemQuality, number> = { 凡品: 48, 良品: 30, 珍品: 14, 极品: 6, 神品: 2, 神话: 0 };
const QUALITY_ORDER: ItemQuality[] = ["凡品", "良品", "珍品", "极品", "神品", "神话"];

export const MUTATIONS: Record<MutationId, { id: MutationId; prefix: string; chance: number; valueMultiplier: number; note: string }> = {
  normal: { id: "normal", prefix: "", chance: 90, valueMultiplier: 1, note: "丹相平稳" },
  burnt: { id: "burnt", prefix: "烧焦的", chance: 2, valueMultiplier: 0.3, note: "炉火过盛，药性受损" },
  flawed: { id: "flawed", prefix: "残缺的", chance: 2, valueMultiplier: 0.55, note: "丹纹未合，灵韵残缺" },
  fine: { id: "fine", prefix: "优良的", chance: 2, valueMultiplier: 1.6, note: "丹纹清润，药性充盈" },
  supreme: { id: "supreme", prefix: "极品的", chance: 3, valueMultiplier: 3, note: "丹光圆融，远胜凡品" },
  perfect: { id: "perfect", prefix: "完美的", chance: 1, valueMultiplier: 5, note: "天成丹纹，价值至少五倍" },
};

export function rollMutation(random = Math.random) {
  const roll = random() * 100;
  let cursor = 0;
  for (const id of ["burnt", "flawed", "fine", "supreme", "perfect"] as MutationId[]) {
    cursor += MUTATIONS[id].chance;
    if (roll < cursor) return MUTATIONS[id];
  }
  return MUTATIONS.normal;
}

export function productStackKey(productId: string, mutation: MutationId) {
  return `${productId}::${mutation}`;
}

function weightedItem(items: GameItem[], random: () => number) {
  const weighted = items.map((item) => ({ item, weight: COMMISSION_QUALITY_WEIGHTS[item.quality] }));
  let roll = random() * weighted.reduce((sum, entry) => sum + entry.weight, 0);
  return weighted.find((entry) => (roll -= entry.weight) < 0)?.item ?? items[0];
}

export function generateCommissions(materials: GameItem[], products: GameItem[], random = Math.random): DailyCommission[] {
  const commissionMaterials = materials.filter((item) => !item.advancedCardTrigger);
  const chosen = new Set<string>();
  const picks = (pool: GameItem[], count: number) => Array.from({ length: count }, () => {
    const available = pool.filter((item) => !chosen.has(item.id));
    const item = weightedItem(available, random);
    chosen.add(item.id);
    return item;
  });
  const specificItems = [...picks(commissionMaterials, 4), ...picks(products.filter((item) => item.category === "丹药"), 1)];
  const specific: SpecificCommission[] = specificItems.map((item, index) => {
    const quantity = item.itemType === "material" ? (item.rarity <= 2 ? 3 : 2) : 1;
    const base = item.itemType === "material" ? getMarketPrice(item) : item.price;
    return { id: `specific-${Date.now()}-${index}`, kind: "specific", itemId: item.id, quantity, reward: Math.round(base * quantity * (item.itemType === "material" ? 1.45 : 1.7) / 10) * 10 };
  });
  const elements: ElementType[] = ["火", "水", "木", "金", "土", "阴"];
  const element = elements[Math.floor(random() * elements.length)];
  const qualities: ItemQuality[] = ["珍品", "极品", "神品"];
  const minimumQuality = qualities[Math.floor(random() * qualities.length)];
  const fuzzy: FuzzyCommission[] = [
    { id: `fuzzy-${Date.now()}-element`, kind: "fuzzy", requirement: "element", element, quantity: 2, reward: 4800, pricingMode: "fixed", title: `${element}属性丹药两枚` },
    { id: `fuzzy-${Date.now()}-quality`, kind: "fuzzy", requirement: "quality", minimumQuality, quantity: 3, reward: 0, pricingMode: "dynamic", title: `${minimumQuality}以上丹药三枚` },
  ];
  return [...specific, ...fuzzy];
}

export function mutationDisplayName(item: GameItem, mutation: MutationId) {
  return `${MUTATIONS[mutation].prefix}${item.name}`;
}

export function getMutationValue(item: GameItem, mutation: MutationId) {
  return Math.round(item.value * MUTATIONS[mutation].valueMultiplier);
}

export function matchesFuzzyCommission(item: GameItem, commission: FuzzyCommission) {
  if (item.category !== "丹药") return false;
  if (commission.requirement === "element") return item.element === commission.element;
  return QUALITY_ORDER.indexOf(item.quality) >= QUALITY_ORDER.indexOf(commission.minimumQuality ?? "凡品");
}
