import { ElementType, GameItem, ItemQuality } from "./item-data";
import { getMarketPrice } from "./market";
import { inventoryMatches, type InventoryEntry } from "../core/item-query";
import { COMMISSION_NPCS } from "./commission-npcs";
import passerbyIssuersData from "./data/commission-issuers.json";

export type MutationId = "normal" | "burnt" | "flawed" | "fine" | "supreme" | "perfect";
export type ProductStack = { productId: string; mutation: MutationId; count: number };
export type CommissionCategory = "regular" | "product" | "npc" | "passerby";
export type CommissionMeta = { category: CommissionCategory; issuerId: string; issuerName: string; issuerTitle: string; issuerSeal: string };
export type SpecificCommission = CommissionMeta & { id: string; kind: "specific"; itemId: string; quantity: number; reward: number };
export type FuzzyCommission = CommissionMeta & {
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

export const COMMISSION_CATEGORY_META: Record<CommissionCategory, { label: string; short: string; description: string }> = {
  regular: { label: "常规委托", short: "常", description: "仙门长期收购基础灵材" },
  product: { label: "成品库委托", short: "丹", description: "只验收亲手炼成的丹药" },
  npc: { label: "NPC委托", short: "缘", description: "有名有姓的来客亲自托付" },
  passerby: { label: "路人委托", short: "行", description: "随行旅人临时张贴的需求" },
};

const PASSERBY_ISSUERS = passerbyIssuersData as Array<{ id: string; name: string; title: string; seal: string }>;

export const COMMISSION_REFRESH_TICKS = 6;
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
  const materialPicks = picks(commissionMaterials, 4);
  const productPicks = picks(products.filter((item) => item.category === "丹药"), 2);
  const specific = (item: GameItem, index: number, meta: CommissionMeta): SpecificCommission => {
    const quantity = item.itemType === "material" ? (item.rarity <= 2 ? 3 : 2) : 1;
    const base = item.itemType === "material" ? getMarketPrice(item) : item.price;
    const premium = meta.category === "npc" ? 1.2 : meta.category === "passerby" ? .92 : 1;
    return { ...meta, id: `specific-${Date.now()}-${index}`, kind: "specific", itemId: item.id, quantity, reward: Math.round(base * quantity * (item.itemType === "material" ? .8 : 1.7) * premium / 10) * 10 };
  };
  const elements: ElementType[] = ["火", "水", "木", "金", "土", "阴"];
  const element = elements[Math.floor(random() * elements.length)];
  const qualities: ItemQuality[] = ["珍品", "极品", "神品"];
  const minimumQuality = qualities[Math.floor(random() * qualities.length)];
  const npcA = COMMISSION_NPCS[Math.floor(random() * COMMISSION_NPCS.length)];
  const npcB = COMMISSION_NPCS[(COMMISSION_NPCS.indexOf(npcA) + 1) % COMMISSION_NPCS.length];
  const passerbyA = PASSERBY_ISSUERS[Math.floor(random() * PASSERBY_ISSUERS.length)];
  const passerbyB = PASSERBY_ISSUERS[(PASSERBY_ISSUERS.indexOf(passerbyA) + 1) % PASSERBY_ISSUERS.length];
  const regularMeta: CommissionMeta = { category: "regular", issuerId: "sect-procurement", issuerName: "仙门收购司", issuerTitle: "常备物资采买", issuerSeal: "常" };
  const productMeta: CommissionMeta = { category: "product", issuerId: "finished-pill-vault", issuerName: "丹成阁", issuerTitle: "成品库验丹", issuerSeal: "丹" };
  const npcMeta = (npc: typeof npcA): CommissionMeta => ({ category: "npc", issuerId: npc.id, issuerName: npc.name, issuerTitle: `${npc.organization} · ${npc.title}`, issuerSeal: npc.name.slice(0, 1) });
  const passerbyMeta = (issuer: typeof passerbyA): CommissionMeta => ({ category: "passerby", issuerId: issuer.id, issuerName: issuer.name, issuerTitle: issuer.title, issuerSeal: issuer.seal });
  return [
    specific(materialPicks[0], 0, regularMeta),
    specific(materialPicks[1], 1, regularMeta),
    specific(productPicks[0], 2, productMeta),
    { ...productMeta, id: `fuzzy-${Date.now()}-quality`, kind: "fuzzy", requirement: "quality", minimumQuality, quantity: 3, reward: 0, pricingMode: "dynamic", title: `${minimumQuality}以上丹药三枚` },
    specific(materialPicks[2], 3, npcMeta(npcA)),
    { ...npcMeta(npcB), id: `fuzzy-${Date.now()}-element`, kind: "fuzzy", requirement: "element", element, quantity: 2, reward: 4800, pricingMode: "fixed", title: `${element}属性丹药两枚` },
    specific(materialPicks[3], 4, passerbyMeta(passerbyA)),
    specific(productPicks[1], 5, passerbyMeta(passerbyB)),
  ];
}

export function commissionCategoryOf(commission: DailyCommission): CommissionCategory {
  return commission.category && COMMISSION_CATEGORY_META[commission.category] ? commission.category : commission.kind === "fuzzy" ? "product" : "regular";
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

export function matchesCommissionInventory(entry: InventoryEntry, commission: DailyCommission) {
  if (commission.kind === "specific") return inventoryMatches(entry, { templateId: commission.itemId, minAmount: 1 });
  return inventoryMatches(entry, { itemType: "pill", minAmount: 1 });
}
