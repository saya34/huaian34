import { RARITY_ORDER, TREASURES, TreasureDefinition, TreasureRarity } from "./expedition";
import { AttributeBonus, EQUIPMENT, EquipmentDefinition, EquipmentItem, HeroAttributes } from "./progression";

export type WMAttributeKey = keyof HeroAttributes;
export interface WMStatRange { key: WMAttributeKey; min: number; max: number }
export interface WMAffixRule { id: string; name: string; chance: number; stats: WMStatRange[] }
export interface WMEquipmentRule {
  equipmentId: string; enabled: boolean; rarity: TreasureRarity; price: number; universal: boolean; waves: number[];
  dropChance: number; boundStats: WMStatRange[]; optionalStats: WMStatRange[]; optionalPick: number;
  affixIds: string[]; affixCap: number;
}
export interface WMTreasureRule { treasureId: string; enabled: boolean; universal: boolean; waves: number[]; dropChance: number; price: number }
export interface WMConfig { version: 1; name: string; equipment: WMEquipmentRule[]; affixes: WMAffixRule[]; treasures: WMTreasureRule[] }

const stat = (key: WMAttributeKey, min: number, max: number): WMStatRange => ({ key, min, max });
const slotDefaults: Record<EquipmentDefinition["slot"], { bound: WMStatRange[]; optional: WMStatRange[] }> = {
  weapon: { bound: [stat("damage", .1, .18)], optional: [stat("attackSpeed", .05, .12), stat("projectileSpeed", .06, .15), stat("expGain", .03, .08), stat("defense", 12, 30)] },
  head: { bound: [stat("defense", 20, 38)], optional: [stat("health", 55, 110), stat("damage", .03, .08), stat("expGain", .03, .07), stat("dodge", .01, .025)] },
  chest: { bound: [stat("health", 100, 190)], optional: [stat("defense", 35, 75), stat("damage", .03, .07), stat("dodge", .01, .025), stat("moveSpeed", 5, 12)] },
  hands: { bound: [stat("damage", .06, .12)], optional: [stat("attackSpeed", .04, .1), stat("defense", 15, 32), stat("health", 40, 90), stat("projectileSpeed", .04, .1)] },
  legs: { bound: [stat("moveSpeed", 8, 18)], optional: [stat("health", 65, 130), stat("defense", 20, 46), stat("dodge", .012, .03), stat("damage", .025, .06)] },
  feet: { bound: [stat("dodge", .018, .04)], optional: [stat("moveSpeed", 12, 25), stat("health", 35, 85), stat("defense", 12, 28), stat("attackSpeed", .025, .07)] },
};

export const DEFAULT_WM_CONFIG: WMConfig = {
  version: 1,
  name: "默认掉落规则",
  affixes: [
    { id: "agile", name: "敏捷的", chance: .28, stats: [stat("moveSpeed", 8, 18), stat("dodge", .012, .03)] },
    { id: "cold", name: "寒霜的", chance: .18, stats: [stat("projectileSpeed", .06, .14), stat("defense", 15, 35)] },
    { id: "fierce", name: "凶猛的", chance: .22, stats: [stat("damage", .06, .13)] },
    { id: "sage", name: "悟道的", chance: .15, stats: [stat("expGain", .05, .12), stat("attackSpeed", .03, .08)] },
    { id: "vital", name: "长生的", chance: .2, stats: [stat("health", 90, 190), stat("defense", 18, 38)] },
    { id: "thunderous", name: "雷鸣的", chance: .14, stats: [stat("attackSpeed", .06, .14), stat("projectileSpeed", .08, .18)] },
    { id: "unyielding", name: "不屈的", chance: .2, stats: [stat("defense", 35, 72), stat("health", 75, 155)] },
    { id: "ethereal", name: "缥缈的", chance: .12, stats: [stat("dodge", .025, .055), stat("moveSpeed", 12, 25)] },
    { id: "bloodthirsty", name: "嗜血的", chance: .1, stats: [stat("damage", .09, .18), stat("health", 45, 110)] },
    { id: "piercing", name: "破空的", chance: .16, stats: [stat("projectileSpeed", .12, .24), stat("damage", .04, .1)] },
    { id: "enlightened", name: "通明的", chance: .11, stats: [stat("expGain", .09, .2), stat("dodge", .01, .025)] },
    { id: "mountain", name: "镇岳的", chance: .17, stats: [stat("defense", 55, 105), stat("moveSpeed", -10, -4)] },
    { id: "sunfire", name: "曜日的", chance: .08, stats: [stat("damage", .12, .22), stat("attackSpeed", .05, .11)] },
    { id: "moonshadow", name: "月影的", chance: .13, stats: [stat("dodge", .02, .05), stat("attackSpeed", .04, .1)] },
    { id: "primordial", name: "混元的", chance: .05, stats: [stat("health", 130, 260), stat("damage", .1, .2)] },
  ],
  equipment: EQUIPMENT.map((item) => {
    const defaults = slotDefaults[item.slot];
    return {
      equipmentId: item.id, enabled: true, rarity: item.rarity, price: item.price, universal: true, waves: [],
      dropChance: item.rarity === "common" ? .36 : item.rarity === "fine" ? .25 : item.rarity === "rare" ? .15 : item.rarity === "epic" ? .07 : .025,
      boundStats: defaults.bound, optionalStats: defaults.optional, optionalPick: 2, affixIds: ["agile", "cold", "fierce", "sage", "vital", "thunderous", "unyielding", "ethereal", "bloodthirsty", "piercing", "enlightened", "mountain", "sunfire", "moonshadow", "primordial"], affixCap: 2,
    };
  }),
  treasures: TREASURES.map((item) => ({ treasureId: item.id, enabled: true, universal: true, waves: [], dropChance: 1, price: item.value })),
};

export const cloneWMConfig = (config: WMConfig): WMConfig => JSON.parse(JSON.stringify(config)) as WMConfig;

export function mergeWMConfig(config: WMConfig | undefined): WMConfig {
  if (!config) return cloneWMConfig(DEFAULT_WM_CONFIG);
  const equipment = DEFAULT_WM_CONFIG.equipment.map((fallback) => {
    const saved = config.equipment?.find((rule) => rule.equipmentId === fallback.equipmentId);
    return saved ? { ...fallback, ...saved, affixIds: [...new Set([...saved.affixIds, ...fallback.affixIds])] } : cloneWMConfig({ ...DEFAULT_WM_CONFIG, equipment: [fallback] }).equipment[0];
  });
  const affixes = DEFAULT_WM_CONFIG.affixes.map((fallback) => config.affixes?.find((affix) => affix.id === fallback.id) ?? { ...fallback, stats: fallback.stats.map((entry) => ({ ...entry })) });
  const treasures = DEFAULT_WM_CONFIG.treasures.map((fallback) => config.treasures?.find((rule) => rule.treasureId === fallback.treasureId) ?? { ...fallback, waves: [...fallback.waves] });
  return { version: 1, name: config.name || DEFAULT_WM_CONFIG.name, equipment, affixes, treasures };
}
const waveAllowed = (universal: boolean, waves: number[], waveId: number) => universal || waves.includes(waveId);
const roll = (range: WMStatRange) => range.min + Math.random() * (range.max - range.min);

function rollStats(ranges: WMStatRange[]) {
  const result: AttributeBonus = {};
  for (const range of ranges) result[range.key] = (result[range.key] ?? 0) + roll(range);
  return result;
}

function mergeBonuses(...bonuses: AttributeBonus[]) {
  const result: AttributeBonus = {};
  for (const bonus of bonuses) for (const key of Object.keys(bonus) as WMAttributeKey[]) result[key] = (result[key] ?? 0) + (bonus[key] ?? 0);
  return result;
}

const rarityDropFactor: Record<TreasureRarity, number> = { common: 1, fine: .72, rare: .42, epic: .2, immortal: .07 };

const PREFIXES = [
  { name: "锋锐", stats: { weaponMinDamage: 4, weaponMaxDamage: 9, damage: .04 }, value: 18 },
  { name: "镇岳", stats: { defense: 34, strength: 3 }, value: 16 },
  { name: "流光", stats: { hitChance: .045, dexterity: 3, attackSpeed: .035 }, value: 17 },
  { name: "离火", stats: { fireResist: .08, damage: .035 }, value: 20 },
  { name: "玄雷", stats: { lightningResist: .08, projectileSpeed: .05 }, value: 20 },
] satisfies Array<{ name: string; stats: AttributeBonus; value: number }>;

const SUFFIXES = [
  { name: "护命", stats: { health: 90, mana: 15 }, value: 16 },
  { name: "通玄", stats: { magic: 4, mana: 28, magicResist: .07 }, value: 19 },
  { name: "破军", stats: { weaponMinDamage: 3, weaponMaxDamage: 12, hitChance: .025 }, value: 21 },
  { name: "避劫", stats: { fireResist: .05, lightningResist: .05, magicResist: .05 }, value: 18 },
  { name: "轻灵", stats: { dexterity: 4, dodge: .012, moveSpeed: 7 }, value: 17 },
] satisfies Array<{ name: string; stats: AttributeBonus; value: number }>;

export function rollManagedEquipment(config: WMConfig, waveId: number, chestRarity: TreasureRarity, uidSeed: number, random: () => number = Math.random): EquipmentItem | null {
  const chestRank = RARITY_ORDER.indexOf(chestRarity);
  const candidates = config.equipment.filter((rule) => rule.enabled && waveAllowed(rule.universal, rule.waves, waveId));
  const weights = candidates.map((rule) => rule.dropChance * rarityDropFactor[rule.rarity] * (1 / (1 + Math.abs(RARITY_ORDER.indexOf(rule.rarity) - chestRank))));
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (!total || random() > Math.min(.72, total / Math.max(1, candidates.length) * 1.8)) return null;
  let point = random() * total;
  let rule = candidates[0];
  for (let index = 0; index < candidates.length; index++) if ((point -= weights[index]) <= 0) { rule = candidates[index]; break; }
  const shuffle = <T,>(source: T[]) => {
    const result = [...source];
    for (let index = result.length - 1; index > 0; index--) { const swap = Math.floor(random() * (index + 1)); [result[index], result[swap]] = [result[swap], result[index]]; }
    return result;
  };
  const rollWith = (range: WMStatRange) => range.min + random() * (range.max - range.min);
  const rollStatsWith = (ranges: WMStatRange[]) => {
    const result: AttributeBonus = {};
    for (const range of ranges) result[range.key] = (result[range.key] ?? 0) + rollWith(range);
    return result;
  };
  const optional = shuffle(rule.optionalStats).slice(0, Math.max(0, rule.optionalPick));
  const affixes = shuffle(config.affixes.filter((affix) => rule.affixIds.includes(affix.id) && random() < affix.chance)).slice(0, Math.max(0, rule.affixCap));
  const managedBonuses = mergeBonuses(rollStatsWith([...rule.boundStats, ...optional]), ...affixes.map((affix) => rollStatsWith(affix.stats)));
  const definition = EQUIPMENT.find((item) => item.id === rule.equipmentId) ?? EQUIPMENT[0];
  // 与 DevilutionX 的生成节奏一致：前缀约四分之一、后缀约三分之二；两者都未命中时至少补一个。
  let prefix = random() < .25 ? PREFIXES[Math.floor(random() * PREFIXES.length)] : undefined;
  let suffix = random() < 2 / 3 ? SUFFIXES[Math.floor(random() * SUFFIXES.length)] : undefined;
  if (!prefix && !suffix) {
    if (random() < .5) prefix = PREFIXES[Math.floor(random() * PREFIXES.length)];
    else suffix = SUFFIXES[Math.floor(random() * SUFFIXES.length)];
  }
  const magicBonuses = mergeBonuses(managedBonuses, prefix?.stats ?? {}, suffix?.stats ?? {});
  const rank = Math.max(0, RARITY_ORDER.indexOf(rule.rarity));
  const weapon = definition.slot === "weapon";
  const twoHanded = weapon && /弓|戟|枪|刀/.test(definition.name);
  const item: EquipmentItem = {
    uid: `wm-${Date.now().toString(36)}-${uidSeed.toString(36)}-${Math.floor(random() * 0xfffffff).toString(36)}`,
    equipmentId: rule.equipmentId,
    name: `${prefix?.name ?? ""}${affixes.map((affix) => affix.name).join("")}${definition.name}${suffix ? `·${suffix.name}` : ""}`,
    rarity: rule.rarity,
    price: rule.price,
    baseBonuses: {
      ...definition.bonuses,
      ...(weapon ? { weaponMinDamage: 5 + waveId * 2 + rank * 3, weaponMaxDamage: 11 + waveId * 3 + rank * 6, hitChance: .01 + rank * .008 } : { defense: (definition.bonuses.defense ?? 0) + waveId * 2 }),
    },
    magicBonuses,
    bonuses: mergeBonuses(definition.bonuses, magicBonuses),
    affixes: affixes.map((affix) => affix.id),
    prefix: prefix?.name,
    suffix: suffix?.name,
    identified: rule.rarity === "common" || rule.rarity === "fine",
    twoHanded,
    width: weapon ? (twoHanded ? 2 : 1) : 2,
    height: weapon || definition.slot === "chest" || definition.slot === "legs" ? 3 : 2,
    requirements: {
      strength: Math.round(12 + waveId * 1.7 + (definition.slot === "chest" || twoHanded ? 8 : 0)),
      dexterity: Math.round(10 + waveId * 1.35 + (weapon ? 5 : 0)),
      magic: Math.round(10 + waveId * 1.5 + (rank >= 3 ? 8 : 0)),
    },
  };
  return item;
}

export function rollManagedTreasure(config: WMConfig, rarity: TreasureRarity, waveId: number, uidSeed: number) {
  let pool = config.treasures.filter((rule) => {
    const item = TREASURES.find((entry) => entry.id === rule.treasureId);
    return rule.enabled && item?.rarity === rarity && waveAllowed(rule.universal, rule.waves, waveId) && rule.dropChance > 0;
  });
  if (!pool.length) pool = config.treasures.filter((rule) => rule.enabled && waveAllowed(rule.universal, rule.waves, waveId) && rule.dropChance > 0);
  if (!pool.length) return null;
  let point = Math.random() * pool.reduce((sum, rule) => sum + rule.dropChance, 0);
  let chosen = pool[0];
  for (const rule of pool) if ((point -= rule.dropChance) <= 0) { chosen = rule; break; }
  return { uid: `${Date.now().toString(36)}-${uidSeed.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, treasureId: chosen.treasureId };
}

export function managedTreasureDefinition(config: WMConfig, treasureId: string): TreasureDefinition {
  const base = TREASURES.find((item) => item.id === treasureId) ?? TREASURES[0];
  const rule = config.treasures.find((item) => item.treasureId === treasureId);
  return rule ? { ...base, value: rule.price } : base;
}

export function validateWMConfig(value: unknown): WMConfig {
  if (!value || typeof value !== "object") throw new Error("结构体必须是对象");
  const config = value as Partial<WMConfig>;
  if (!Array.isArray(config.equipment) || !Array.isArray(config.affixes) || !Array.isArray(config.treasures)) throw new Error("缺少 equipment、affixes 或 treasures 数组");
  return { version: 1, name: String(config.name || "导入配置"), equipment: config.equipment, affixes: config.affixes, treasures: config.treasures };
}
