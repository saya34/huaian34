import batch144Data from "./data/imported-144.json";
import life24Data from "./data/imported-life-24.json";
import recipeChainsData from "./data/imported-recipe-chains.json";

export type ElementType = "火" | "水" | "木" | "金" | "土" | "阴";
export type ItemKind = "材料" | "产物";
export type ItemType = "material" | "product";
export type ItemCategory = "灵草" | "矿骨" | "妖丹" | "辅材" | "丹药" | "灵卡" | "法器";
export type ItemQuality = "凡品" | "良品" | "珍品" | "极品" | "神品" | "神话";
export type CharacterId = "qingdai" | "hanyan" | "mingzhu" | "lingxi" | "ruoshui";

export type CharacterProfile = {
  id: CharacterId;
  name: string;
  title: string;
  relation: string;
  element: ElementType;
  trait: string;
  images: string[];
};

export type CharacterLink = Pick<CharacterProfile, "id" | "name" | "title" | "relation"> & {
  affinity: number;
};

export type GameItem = {
  id: string;
  index: number;
  name: string;
  short: string;
  kind: ItemKind;
  itemType: ItemType;
  canBeIngredient: boolean;
  category: ItemCategory;
  element: ElementType;
  quality: ItemQuality;
  rarity: number;
  value: number;
  price: number;
  attribute: string;
  trait: string;
  effect: string;
  image: string;
  count: number;
  color: string;
  characterTrigger?: boolean;
  advancedCardTrigger?: boolean;
  character?: CharacterLink;
  group?: string;
  recipeTier?: number;
  prompt?: string;
  source?: string;
  originalName?: string;
};

export type RecipeItemRequirement = {
  itemId: string;
  quantity: number;
};

export type RecipeElementRequirement = {
  element: ElementType;
  minCount: number;
  additional?: boolean;
};

export type RecipeRule = {
  id: string;
  name: string;
  resultItemId: string;
  enabled: boolean;
  priority: number;
  weight: number;
  minMaterialCount: number;
  requiredItems: RecipeItemRequirement[];
  elementRequirements: RecipeElementRequirement[];
  minimumQuality?: ItemQuality;
};

export const ELEMENT_TYPES: ElementType[] = ["火", "水", "木", "金", "土", "阴"];
export const ITEM_QUALITIES: ItemQuality[] = ["凡品", "良品", "珍品", "极品", "神品", "神话"];

const ELEMENT_COLORS: Record<ElementType, string> = {
  "火": "#ef6b3a",
  "水": "#71c9ee",
  "木": "#62d6a5",
  "金": "#efc45d",
  "土": "#d59658",
  "阴": "#b77aef",
};

export const CHARACTER_PROFILES: CharacterProfile[] = [
  { id: "qingdai", name: "青黛", title: "师姐·青黛", relation: "同门师姐", element: "水", trait: "静水丹心", images: ["/cha-pics/raw_213258_output_0.webp", "/cha-pics/raw_213258_output_1.webp"] },
  { id: "hanyan", name: "寒烟", title: "星命·寒烟", relation: "命星故人", element: "阴", trait: "雾隐星痕", images: ["/cha-pics/raw_213359_output_0.webp", "/cha-pics/raw_213359_output_1.webp"] },
  { id: "mingzhu", name: "明珠", title: "师妹·明珠", relation: "同门师妹", element: "木", trait: "灵药妙心", images: ["/cha-pics/raw_213540_output_0.webp", "/cha-pics/raw_213540_output_1.webp"] },
  { id: "lingxi", name: "灵汐", title: "剑契·灵汐", relation: "旧日剑契", element: "金", trait: "剑意通明", images: ["/cha-pics/raw_213731_output_0.webp", "/cha-pics/raw_213731_output_1.webp"] },
  { id: "ruoshui", name: "若水", title: "师尊·若水", relation: "授业师尊", element: "土", trait: "太虚守一", images: ["/cha-pics/raw_213836_output_0.webp", "/cha-pics/raw_213836_output_1.webp"] },
];

const CHARACTER_BY_ID = Object.fromEntries(CHARACTER_PROFILES.map((profile) => [profile.id, profile])) as Record<CharacterId, CharacterProfile>;

function inferCharacterId(name: string, index: number): CharacterId {
  if (name.includes("师姐")) return "qingdai";
  if (name.includes("师妹")) return "mingzhu";
  if (name.includes("师尊")) return "ruoshui";
  if (name.includes("师兄") || name.includes("剑") || name.includes("竹马")) return "lingxi";
  return CHARACTER_PROFILES[index % CHARACTER_PROFILES.length].id;
}

function createCharacterLink(name: string, index: number, rarity: number): CharacterLink {
  const profile = CHARACTER_BY_ID[inferCharacterId(name, index)];
  return {
    id: profile.id,
    name: profile.name,
    title: profile.title,
    relation: profile.relation,
    affinity: 28 + rarity * 4,
  };
}

type Row = [string, ItemKind, ItemCategory, ElementType, GameItem["quality"], number, number, string, string, boolean?];

const ROWS: Row[] = [
  ["赤霄龙葵", "材料", "灵草", "火", "珍品", 3, 180, "烈火灵根", "提升火性丹药灵变率"],
  ["月魄雪莲", "材料", "灵草", "水", "珍品", 3, 175, "月潭凝霜", "稳定水性炉息"],
  ["碧落灵芝", "材料", "灵草", "木", "良品", 2, 120, "生机不息", "提升回复类产物品质"],
  ["紫电藤", "材料", "灵草", "阴", "珍品", 3, 190, "雷息缠枝", "转化为突破类丹药"],
  ["金阳参", "材料", "灵草", "金", "珍品", 3, 210, "吸日金芒", "提高成丹基础率"],
  ["星命神花", "材料", "灵草", "阴", "神品", 5, 1200, "命星降世", "入炉时唤醒命定炉灵", true],
  ["玄水藻", "材料", "灵草", "水", "良品", 2, 95, "深潭灵息", "降低炼制温度"],
  ["厚土莲", "材料", "灵草", "土", "良品", 2, 105, "石瓣藏息", "增加防御类产物权重"],
  ["风隐竹节", "材料", "灵草", "木", "珍品", 3, 160, "听风而生", "缩短炼制时间"],
  ["血玉果", "材料", "灵草", "火", "极品", 4, 360, "赤血如玉", "小概率炼成涅槃丹"],
  ["霜心草", "材料", "灵草", "水", "珍品", 3, 155, "冰心绝尘", "清除材料间的五行冲突"],
  ["日轮花", "材料", "灵草", "火", "极品", 4, 400, "花开如日", "提升悟道类产物权重"],
  ["黑曜火铁", "材料", "矿骨", "火", "珍品", 3, 220, "地火淬铁", "适合炼制攻击法器"],
  ["寒渊玄冰", "材料", "矿骨", "水", "珍品", 3, 225, "万载不化", "适合炼制护心丹"],
  ["雷纹紫晶", "材料", "矿骨", "阴", "极品", 4, 480, "天雷刻纹", "必定保留雷性特效"],
  ["青木灵核", "材料", "妖丹", "木", "珍品", 3, 250, "古木凝核", "产物附带持续恢复"],
  ["大地龙骨", "材料", "矿骨", "土", "极品", 4, 520, "龙骨如山", "产物附带金刚护体"],
  ["金乌翎石", "材料", "矿骨", "金", "极品", 4, 540, "日精凝翎", "大幅提高产物价值"],
  ["沧海鲛珠", "材料", "妖丹", "水", "极品", 4, 490, "鲛泪成珠", "优先炼成治疗类灵卡"],
  ["风蚀天砂", "材料", "辅材", "金", "良品", 2, 130, "天风磨砂", "缩短炼制二成时间"],
  ["熔岩兽角", "材料", "矿骨", "火", "珍品", 3, 280, "熔岩遗角", "提高火属性伤害"],
  ["幽冥妖丹", "材料", "妖丹", "阴", "极品", 4, 560, "冥火凝魄", "可炼成稀有战斗灵卡"],
  ["星陨铁", "材料", "矿骨", "金", "珍品", 3, 310, "星外陨金", "提升法器类产物权重"],
  ["太初玉髓", "材料", "矿骨", "土", "神品", 5, 980, "太初玉质", "保证产物不低于极品"],
  ["朱雀符", "材料", "辅材", "火", "珍品", 3, 260, "朱雀浴火", "引导火性成丹"],
  ["玄武符", "材料", "辅材", "水", "珍品", 3, 260, "玄武镇水", "引导护体类成丹"],
  ["青龙符", "材料", "辅材", "木", "珍品", 3, 260, "青龙化生", "引导恢复类成丹"],
  ["白虎符", "材料", "辅材", "金", "珍品", 3, 260, "白虎主杀", "引导攻击类成丹"],
  ["九转灵液", "材料", "辅材", "水", "极品", 4, 520, "九转纯液", "大幅提高成丹率"],
  ["太虚炉灰", "材料", "辅材", "土", "良品", 2, 80, "千炉遗灰", "小幅稳定所有属性"],
  ["混元火种", "材料", "辅材", "火", "神品", 5, 1100, "不灭混元", "大幅提高灵变率"],
  ["时轮砂", "材料", "辅材", "金", "极品", 4, 450, "流光成砂", "炼制时间缩短一半"],
  ["玲珑玉简", "材料", "辅材", "木", "珍品", 3, 330, "古法藏简", "提高新丹方解锁率"],
  ["魂引灯", "材料", "辅材", "阴", "极品", 4, 610, "青灯引魂", "提高灵卡类产物权重"],
  ["乾坤残卷", "材料", "辅材", "金", "极品", 4, 680, "天地残章", "成丹后额外获得丹方经验"],
  ["五行玄珠", "材料", "妖丹", "阴", "神品", 5, 1050, "五行归一", "忽略所有五行冲突"],
  ["九转赤霄丹", "产物", "丹药", "火", "神品", 5, 1800, "龙吟赤霄", "回复45%气血并提升12%灵力"],
  ["广寒凝露丹", "产物", "丹药", "水", "极品", 4, 920, "月露凝神", "清除两层负面效果"],
  ["碧落回春丹", "产物", "丹药", "木", "极品", 4, 880, "万木回春", "三息内持续回复气血"],
  ["紫雷破境丹", "产物", "丹药", "阴", "神品", 5, 1650, "雷劫破境", "提高修为突破成功率"],
  ["金阳筑基丹", "产物", "丹药", "金", "极品", 4, 1100, "金阳筑基", "永久提升少量根骨"],
  ["星命唤灵丹", "产物", "丹药", "阴", "神品", 5, 2100, "命星共鸣", "与命定炉灵缔结契约"],
  ["沧海护心丹", "产物", "丹药", "水", "珍品", 3, 640, "潮生护心", "获得可吸收伤害的水盾"],
  ["厚土金刚丹", "产物", "丹药", "土", "极品", 4, 970, "金刚不动", "五息内大幅提升防御"],
  ["风行无影丹", "产物", "丹药", "木", "珍品", 3, 700, "踏风无影", "三息内提高闪避与速度"],
  ["血玉涅槃丹", "产物", "丹药", "火", "神品", 5, 2200, "涅槃重生", "濒死时恢复一半气血"],
  ["霜华定神丹", "产物", "丹药", "水", "极品", 4, 890, "冰心定神", "免疫一次心魔或控制"],
  ["日轮悟道丹", "产物", "丹药", "火", "神品", 5, 1950, "日轮悟道", "立即获得大量悟道经验"],
  ["赤霄龙吟卡", "产物", "灵卡", "火", "神品", 5, 2400, "赤龙现世", "对全体敌人造成火性伤害"],
  ["广寒月魄卡", "产物", "灵卡", "水", "极品", 4, 1380, "广寒月影", "冻结敌人并降低攻速"],
  ["青帝回春卡", "产物", "灵卡", "木", "极品", 4, 1320, "青帝赐生", "回复全体友方气血"],
  ["紫电天劫卡", "产物", "灵卡", "阴", "神品", 5, 2500, "天劫九落", "连续降下九道雷击"],
  ["金乌耀世卡", "产物", "灵卡", "金", "神品", 5, 2600, "金乌凌日", "提升全体火金属性伤害"],
  ["沧海潮生卡", "产物", "灵卡", "水", "极品", 4, 1450, "沧海潮生", "卷起海潮击退全体敌人"],
  ["玄火丹鼎", "产物", "法器", "火", "神品", 5, 3200, "玄火不灭", "永久提升炼丹成功率"],
  ["太虚玉镜", "产物", "法器", "水", "神品", 5, 3100, "镜映太虚", "复制一次敌方法术"],
  ["五行法轮", "产物", "法器", "金", "神品", 5, 3500, "五行流转", "自动转化不利五行"],
  ["星命玉简", "产物", "法器", "木", "极品", 4, 1900, "群星定命", "提高稀有奇遇触发率"],
  ["幽冥魂灯", "产物", "法器", "阴", "神品", 5, 3300, "青灯引魂", "战斗后收集敌人残魂"],
  ["乾坤灵葫", "产物", "法器", "土", "神品", 5, 3600, "葫中乾坤", "额外增加大量背包容量"],
];

const BASE_ITEMS: GameItem[] = ROWS.map((row, offset) => {
  const index = offset + 1;
  return {
    id: `${row[1] === "材料" ? "mat" : "prd"}-${String(index).padStart(2, "0")}`,
    index,
    name: row[0],
    kind: row[1],
    itemType: row[1] === "材料" ? "material" : "product",
    canBeIngredient: row[1] === "材料",
    category: row[2],
    element: row[3],
    quality: row[4],
    rarity: row[5],
    value: row[6],
    price: row[6],
    attribute: `${row[3]}灵性 · ${row[2]}`,
    trait: row[7],
    short: row[7],
    effect: row[8],
    characterTrigger: row[9],
    image: `/assets/items/item-${String(index).padStart(2, "0")}.webp`,
    count: row[1] === "材料" ? 3 + ((index * 7) % 21) : 0,
    color: ELEMENT_COLORS[row[3]],
    group: "原有图鉴",
    source: "原版60项",
  };
});

type ImportedItem = Omit<GameItem, "index" | "image" | "color" | "price" | "attribute" | "trait" | "character" | "itemType" | "canBeIngredient"> & {
  index: number;
  image: string;
};

const IMPORTED_NAME_OVERRIDES: Record<string, string> = {
  "mat-05-advanced-011": "星命神花·古种",
  "prd-06-pills-008": "星命唤灵丹·古方",
};

function normalizeImportedItems(
  rows: ImportedItem[],
  offset: number,
  assetRoot: string,
  source: string,
  defaultGroup?: string,
): GameItem[] {
  return rows.map((item, position) => {
    const renamed = IMPORTED_NAME_OVERRIDES[item.id];
    const wasCharacterMaterial = item.kind === "材料" && Boolean(item.characterTrigger);
    return {
      ...item,
      name: renamed ?? item.name,
      originalName: renamed ? item.name : undefined,
      index: offset + position + 1,
      image: `${assetRoot}/${item.image.replace(/^assets\/items\//, "")}`,
      color: ELEMENT_COLORS[item.element],
      itemType: item.kind === "材料" ? "material" : "product",
      canBeIngredient: item.kind === "材料",
      price: item.value,
      attribute: `${item.element}灵性 · ${item.category}`,
      trait: item.short,
      characterTrigger: false,
      character: wasCharacterMaterial ? createCharacterLink(renamed ?? item.name, offset + position + 1, item.rarity) : undefined,
      group: item.group ?? defaultGroup,
      source,
    };
  });
}

const IMPORTED_144 = normalizeImportedItems(
  batch144Data as unknown as ImportedItem[],
  BASE_ITEMS.length,
  "/assets/items/expansion-144",
  "六类炼丹素材144件",
);

const IMPORTED_LIFE_24 = normalizeImportedItems(
  life24Data as unknown as ImportedItem[],
  BASE_ITEMS.length + IMPORTED_144.length,
  "/assets/items/life-24",
  "生活系炼丹素材24件",
  "生活奇珍",
);

export const MYTHIC_MATERIAL: GameItem = {
  id: "mat-mythic-primordial-scroll",
  index: BASE_ITEMS.length + IMPORTED_144.length + IMPORTED_LIFE_24.length + 1,
  name: "太初命卷",
  short: "诸天命格之母",
  kind: "材料",
  itemType: "material",
  canBeIngredient: true,
  category: "辅材",
  element: "阴",
  quality: "神话",
  rarity: 6,
  value: 12_000,
  price: 12_000,
  attribute: "太初灵性 · 命契奇珍",
  trait: "神话命刻",
  effect: "单独入炉后展开太初命卷，可定制并生成高级人物卡片",
  image: "/assets/items/primordial-fate-scroll.webp",
  count: 1,
  color: "#f0c86c",
  advancedCardTrigger: true,
  group: "太初奇珍",
  prompt: "古老神话羊皮命卷，青铜云兽卷轴头、朱金命印、玉紫星河与云雾环绕",
  source: "神话人物卡系统",
};

export const ITEM_TABLE: GameItem[] = [...BASE_ITEMS, ...IMPORTED_144, ...IMPORTED_LIFE_24, MYTHIC_MATERIAL];

export const MATERIALS = ITEM_TABLE.filter((item) => item.itemType === "material" && item.canBeIngredient);
export const PRODUCTS = ITEM_TABLE.filter((item) => item.itemType === "product");
export const RARE_MATERIAL = MATERIALS.find((item) => item.name === "星命神花")!;
export const ITEM_GROUPS = Array.from(new Set(ITEM_TABLE.map((item) => item.group).filter((group): group is string => Boolean(group))));
export const RECIPE_CHAINS = recipeChainsData as Record<string, string[]>;

export function isFatedFlower(item: GameItem | null | undefined) {
  return item?.id === RARE_MATERIAL.id;
}

export function isMythicScroll(item: GameItem | null | undefined) {
  return item?.id === MYTHIC_MATERIAL.id;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getDominantCharacter(materials: Array<GameItem | null>) {
  const scores = new Map<CharacterId, number>();
  materials.forEach((item) => {
    if (!item?.character) return;
    scores.set(item.character.id, (scores.get(item.character.id) ?? 0) + item.character.affinity);
  });
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const [id, score] = ranked[0];
  return { profile: CHARACTER_BY_ID[id], score };
}

export function selectCharacterOutcome(materials: Array<GameItem | null>, brewSeed = 0) {
  if (!materials.some(isFatedFlower)) return null;
  const weights = CHARACTER_PROFILES.map((profile) => ({
    profile,
    weight: 1 + materials.reduce((sum, item) => sum + (item?.character?.id === profile.id ? item.character.affinity : 0), 0),
  }));
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
  const source = materials.filter(Boolean).map((item) => item!.id).sort().join("|");
  let roll = stableHash(`${source}:${brewSeed}`) % totalWeight;
  const selected = weights.find((entry) => {
    roll -= entry.weight;
    return roll < 0;
  }) ?? weights[0];
  const imageIndex = stableHash(`${source}:portrait:${brewSeed}`) % selected.profile.images.length;
  return {
    ...selected.profile,
    image: selected.profile.images[imageIndex],
    chance: Math.round((selected.weight / totalWeight) * 100),
    targeted: selected.weight > 1,
  };
}

const RECIPE_RESULT_ALIASES: Record<string, string> = {
  "生活清心丹": "广寒凝露丹",
  "三生缘契丹": "红尘忘忧丹",
  "筑基聚气丹": "金阳筑基丹",
  "紫府凝神丹": "紫府养神丹",
  "星命唤灵丹": "星命唤灵丹·古方",
  "鸿蒙道极丹": "鸿蒙道极丹",
};

function findItemByAnyName(name: string) {
  return ITEM_TABLE.find((item) => item.name === name || item.originalName === name);
}

const CHAIN_RULES: RecipeRule[] = Object.entries(RECIPE_CHAINS).flatMap(([recipeName, ingredientNames], index) => {
  const resultName = RECIPE_RESULT_ALIASES[recipeName] ?? recipeName;
  const result = PRODUCTS.find((item) => item.name === resultName);
  const ingredients = ingredientNames.map(findItemByAnyName).filter((item): item is GameItem => Boolean(item?.canBeIngredient));
  if (!result || ingredients.length !== ingredientNames.length) return [];
  return [{
    id: `default-chain-${String(index + 1).padStart(2, "0")}`,
    // Keep a display-only alias for compatibility with older local D1 previews.
    // The stable rule id, rather than this label, carries the recipe identity.
    name: index === 0 ? "生活静心丹·古方" : `${recipeName}·古方`,
    resultItemId: result.id,
    enabled: true,
    priority: 100,
    weight: 100,
    minMaterialCount: ingredientNames.length,
    requiredItems: ingredients.map((item) => ({ itemId: item.id, quantity: 1 })),
    elementRequirements: [],
  }];
});

const RED_CLOUD_RULE: RecipeRule = {
  id: "default-red-cloud",
  name: "赤霄引火方",
  resultItemId: PRODUCTS.find((item) => item.name === "九转赤霄丹")!.id,
  enabled: true,
  priority: 120,
  weight: 100,
  minMaterialCount: 3,
  requiredItems: ["赤霄龙葵", "月魄雪莲"].map((name) => ({ itemId: MATERIALS.find((item) => item.name === name)!.id, quantity: 1 })),
  elementRequirements: [{ element: "火", minCount: 1, additional: true }],
  minimumQuality: "良品",
};

export const DEFAULT_RECIPE_RULES: RecipeRule[] = [RED_CLOUD_RULE, ...CHAIN_RULES];

const QUALITY_RANK: Record<ItemQuality, number> = { "凡品": 1, "良品": 2, "珍品": 3, "极品": 4, "神品": 5, "神话": 6 };

export function matchesRecipeRule(materials: Array<GameItem | null>, rule: RecipeRule) {
  const selected = materials.filter((item): item is GameItem => Boolean(item?.canBeIngredient));
  if (!rule.enabled || selected.length < rule.minMaterialCount) return false;
  if (rule.minimumQuality && selected.some((item) => QUALITY_RANK[item.quality] < QUALITY_RANK[rule.minimumQuality!])) return false;

  const consumed = new Set<number>();
  for (const requirement of rule.requiredItems) {
    const matches = selected
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => item.id === requirement.itemId && !consumed.has(index));
    if (matches.length < requirement.quantity) return false;
    matches.slice(0, requirement.quantity).forEach(({ index }) => consumed.add(index));
  }

  return rule.elementRequirements.every((requirement) => {
    const pool = requirement.additional ? selected.filter((_, index) => !consumed.has(index)) : selected;
    return pool.filter((item) => item.element === requirement.element).length >= requirement.minCount;
  });
}

export function resolveManagedRecipe(materials: Array<GameItem | null>, rules: RecipeRule[]) {
  const matching = rules.filter((rule) => matchesRecipeRule(materials, rule));
  if (!matching.length) return null;
  const highestPriority = Math.max(...matching.map((rule) => rule.priority));
  const candidates = matching.filter((rule) => rule.priority === highestPriority);
  const totalWeight = candidates.reduce((sum, rule) => sum + Math.max(1, rule.weight), 0);
  const source = materials.filter(Boolean).map((item) => item!.id).sort().join("|");
  let roll = stableHash(`${source}:managed-recipe`) % totalWeight;
  const rule = candidates.find((candidate) => {
    roll -= Math.max(1, candidate.weight);
    return roll < 0;
  }) ?? candidates[0];
  const item = PRODUCTS.find((product) => product.id === rule.resultItemId);
  return item ? { rule, item } : null;
}

export function selectAlchemyResult(materials: Array<GameItem | null>, managedRules: RecipeRule[] = []) {
  const selected = materials.filter((item): item is GameItem => Boolean(item));
  const managed = resolveManagedRecipe(materials, managedRules);
  if (managed) return managed.item;
  const selectedNames = new Set(selected.flatMap((item) => item.originalName ? [item.name, item.originalName] : [item.name]));
  for (const [recipeName, ingredients] of Object.entries(RECIPE_CHAINS)) {
    if (ingredients.every((ingredient) => selectedNames.has(ingredient))) {
      const resultName = RECIPE_RESULT_ALIASES[recipeName] ?? recipeName;
      const recipeResult = PRODUCTS.find((item) => item.name === resultName);
      if (recipeResult) return recipeResult;
    }
  }
  const starResult = PRODUCTS.find((item) => item.id === "prd-42") ?? PRODUCTS.find((item) => item.name === "星命唤灵丹")!;
  if (selected.some(isFatedFlower)) return starResult;
  const seed = selected.reduce((sum, item) => sum + item.index * (item.rarity + 1), 0);
  return PRODUCTS[seed % PRODUCTS.length];
}
