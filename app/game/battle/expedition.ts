export type TreasureRarity = "common" | "fine" | "rare" | "epic" | "immortal";
export type ChestKind = "treasure" | "buff" | "monster";
export type RunResult = "victory" | "extracted" | "defeat";
export type ContainerKind = "backpack" | "safe";

export interface TreasureDefinition {
  id: string;
  name: string;
  rarity: TreasureRarity;
  width: number;
  height: number;
  value: number;
  description: string;
  art: string;
}

export interface TreasureItem {
  uid: string;
  treasureId: string;
}

export interface PlacedTreasure extends TreasureItem {
  x: number;
  y: number;
}

export interface InventorySize {
  columns: number;
  rows: number;
}

export interface LootOffer {
  chestId: number;
  kind: ChestKind;
  quality: TreasureRarity;
  items: TreasureItem[];
  buffs?: BuffDefinition[];
  equipment?: EquipmentItem[];
}

export type BuffEffect =
  | "damage"
  | "haste"
  | "speed"
  | "vitality"
  | "eliteDamage"
  | "luck"
  | "magnet"
  | "revive";

export interface BuffDefinition {
  id: string;
  name: string;
  description: string;
  effect: BuffEffect;
  value: number;
  art: string;
}

export type PartnerPower = "screenDamage" | "lightning" | "frenzy" | "freeze" | "recovery";

export interface PartnerDefinition {
  id: string;
  name: string;
  title: string;
  tag: "剑" | "雷" | "丹" | "佛" | "妖";
  power: PartnerPower;
  description: string;
  art: string;
}

export interface ExpeditionPhase {
  name: string;
  subtitle: string;
  hp: number;
  attack: number;
  density: number;
  elite: number;
  tint: string;
}

export const RARITY_ORDER: TreasureRarity[] = ["common", "fine", "rare", "epic", "immortal"];

export const RARITY_META: Record<TreasureRarity, { name: string; color: string; beam: string }> = {
  common: { name: "凡品", color: "#c8c3ae", beam: "rgba(216,211,190,.34)" },
  fine: { name: "良品", color: "#65d58a", beam: "rgba(74,222,128,.44)" },
  rare: { name: "珍品", color: "#5cb7ff", beam: "rgba(65,164,255,.55)" },
  epic: { name: "绝品", color: "#c27aff", beam: "rgba(168,85,247,.62)" },
  immortal: { name: "仙品", color: "#ffd66b", beam: "rgba(255,197,61,.78)" },
};

export const EXPEDITION_PHASES: ExpeditionPhase[] = [
  { name: "灵雾初起", subtitle: "秘境初开，宜搜寻遗珍", hp: 1, attack: 1, density: 1, elite: 1, tint: "rgba(22,74,56,0)" },
  { name: "妖潮翻涌", subtitle: "撤离法阵已经显现", hp: 1.35, attack: 1.18, density: 1.25, elite: 1.4, tint: "rgba(16,96,72,.10)" },
  { name: "血月压境", subtitle: "精英妖物增多，高阶宝匣出现", hp: 1.8, attack: 1.38, density: 1.5, elite: 2, tint: "rgba(116,24,45,.14)" },
  { name: "妖王临世", subtitle: "仙品现世，生死只在一念", hp: 2.4, attack: 1.65, density: 1.8, elite: 3, tint: "rgba(69,10,42,.20)" },
];

export const TREASURES: TreasureDefinition[] = [
  { id: "spirit-pearl", name: "凝露灵珠", rarity: "common", width: 1, height: 1, value: 45, description: "沾有秘境灵露的圆润宝珠。", art: "/game-assets/treasures/relic-pearl.webp" },
  { id: "jade-slip", name: "残缺玉简", rarity: "common", width: 1, height: 1, value: 55, description: "记载着残缺吐纳法门。", art: "/game-assets/treasures/jade-scroll.webp" },
  { id: "demon-core", name: "浑浊妖丹", rarity: "common", width: 1, height: 1, value: 60, description: "低阶妖物体内凝结的妖力。", art: "/game-assets/treasures/relic-pearl.webp" },
  { id: "spirit-wood", name: "百年灵木", rarity: "fine", width: 1, height: 2, value: 150, description: "适合炼制法器的温润灵材。", art: "/game-assets/treasures/jade-scroll.webp" },
  { id: "cloud-scroll", name: "流云功卷", rarity: "fine", width: 1, height: 2, value: 180, description: "卷面有云气自行流转。", art: "/game-assets/treasures/jade-scroll.webp" },
  { id: "jade-gourd", name: "青玉丹葫", rarity: "fine", width: 1, height: 2, value: 210, description: "葫中尚留一缕药香。", art: "/game-assets/treasures/relic-pearl.webp" },
  { id: "thunder-seal", name: "玄雷法印", rarity: "rare", width: 1, height: 1, value: 320, description: "印面偶有细小雷弧跃动。", art: "/game-assets/treasures/mystic-weapon.webp" },
  { id: "moon-mirror", name: "照月古镜", rarity: "rare", width: 2, height: 1, value: 560, description: "镜中映出的月色并非此界。", art: "/game-assets/treasures/relic-pearl.webp" },
  { id: "sword-fragment", name: "诛邪剑胚", rarity: "rare", width: 1, height: 2, value: 520, description: "尚未开锋，已有凛冽剑意。", art: "/game-assets/treasures/mystic-weapon.webp" },
  { id: "lotus-lamp", name: "净世莲灯", rarity: "epic", width: 2, height: 2, value: 1250, description: "莲心长明，可驱散妖雾。", art: "/game-assets/treasures/lotus-artifact.webp" },
  { id: "star-compass", name: "星罗天盘", rarity: "epic", width: 2, height: 2, value: 1480, description: "盘上星轨会随秘境气机变化。", art: "/game-assets/treasures/relic-pearl.webp" },
  { id: "phoenix-feather", name: "赤鸾真羽", rarity: "epic", width: 1, height: 2, value: 980, description: "离火不熄，握之如春。", art: "/game-assets/treasures/lotus-artifact.webp" },
  { id: "dragon-cauldron", name: "蟠龙古鼎", rarity: "immortal", width: 2, height: 2, value: 3200, description: "鼎身蟠龙似在沉睡，来历不可考。", art: "/game-assets/treasures/ancient-cauldron.webp" },
  { id: "heavenly-sword", name: "太虚剑匣", rarity: "immortal", width: 2, height: 2, value: 3600, description: "匣未开，剑鸣已震慑群妖。", art: "/game-assets/treasures/mystic-weapon.webp" },
  { id: "immortal-seal", name: "九霄仙印", rarity: "immortal", width: 2, height: 2, value: 4200, description: "传说可号令一方灵脉。", art: "/game-assets/treasures/ancient-cauldron.webp" },
];

export const BUFFS: BuffDefinition[] = [
  { id: "dragon-pill", name: "蛟血丹", description: "本局伤害提高 30%。", effect: "damage", value: .3, art: "/game-assets/spells/dragon-pill.webp" },
  { id: "wind-mantra", name: "御风真诀", description: "本局攻击速度提高 25%。", effect: "haste", value: .25, art: "/game-assets/spells/wind-mantra.webp" },
  { id: "cloud-step", name: "流云步", description: "本局移动速度提高 20%。", effect: "speed", value: .2, art: "/game-assets/spells/wind-mantra.webp" },
  { id: "golden-body", name: "金身丹", description: "最大生命提高 30%并立即恢复。", effect: "vitality", value: .3, art: "/game-assets/spells/dragon-pill.webp" },
  { id: "demon-slayer", name: "斩妖录", description: "对精英和妖王伤害提高 40%。", effect: "eliteDamage", value: .4, art: "/game-assets/spells/wind-mantra.webp" },
  { id: "fortune-scripture", name: "纳福心经", description: "后续宝箱更容易出现高品质宝物。", effect: "luck", value: 1, art: "/game-assets/spells/revival-talisman.webp" },
  { id: "cosmos-gourd", name: "乾坤摄物诀", description: "拾取范围大幅提高。", effect: "magnet", value: .75, art: "/game-assets/spells/wind-mantra.webp" },
  { id: "nirvana-talisman", name: "涅槃替身符", description: "抵挡一次致命伤并恢复半数生命。", effect: "revive", value: .5, art: "/game-assets/spells/revival-talisman.webp" },
];

export const PARTNERS: PartnerDefinition[] = [
  { id: "sword-sister", name: "凌霜师姐", title: "万剑归宗", tag: "剑", power: "screenDamage", description: "剑意横扫全场，对所有妖物造成重创。", art: "/game-assets/partners/sword-sister.webp" },
  { id: "thunder-lord", name: "玄霆真君", title: "天雷渡厄", tag: "雷", power: "lightning", description: "连续召下天雷，优先轰击精英和妖王。", art: "/game-assets/partners/thunder-lord.webp" },
  { id: "pill-fairy", name: "青璃丹仙", title: "九转回元", tag: "丹", power: "recovery", description: "恢复生命并获得短暂护体灵光。", art: "/game-assets/partners/pill-fairy.webp" },
  { id: "vajra-monk", name: "无相禅师", title: "金身法相", tag: "佛", power: "frenzy", description: "短时间大幅提高攻击、攻速和移动速度。", art: "/game-assets/partners/vajra-monk.webp" },
  { id: "moon-demon", name: "月魄妖姬", title: "冰封千里", tag: "妖", power: "freeze", description: "冻结全场妖物并造成一次寒魄伤害。", art: "/game-assets/partners/moon-demon.webp" },
];

export function phaseCountForWave(waveId: number) {
  if (waveId <= 8) return 2;
  if (waveId <= 15) return 3;
  return 4;
}

export function targetDurationForWave(waveId: number) {
  if (waveId <= 3) return 480;
  if (waveId <= 8) return 600;
  if (waveId <= 15) return 720;
  return 900;
}

export function rarityIndex(rarity: TreasureRarity) {
  return RARITY_ORDER.indexOf(rarity);
}

export function rollRarity(phaseIndex: number, waveId: number, luck = 0): TreasureRarity {
  const weights = [
    [70, 25, 5, 0, 0],
    [45, 35, 17, 3, 0],
    [25, 35, 28, 10, 2],
    [10, 25, 35, 23, 7],
  ][Math.max(0, Math.min(3, phaseIndex))].slice();
  const progression = Math.floor(Math.max(0, waveId - 1) / 5) + luck;
  for (let shift = 0; shift < progression; shift++) {
    const from = Math.max(0, weights.findIndex((value) => value > 5));
    if (from < 4) {
      const amount = Math.min(3, weights[from]);
      weights[from] -= amount;
      weights[from + 1] += amount;
    }
  }
  let roll = Math.random() * weights.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < weights.length; index++) {
    roll -= weights[index];
    if (roll <= 0) return RARITY_ORDER[index];
  }
  return "common";
}

export function createTreasureItem(rarity: TreasureRarity, uidSeed: number): TreasureItem {
  const pool = TREASURES.filter((treasure) => treasure.rarity === rarity);
  const fallback = TREASURES.filter((treasure) => rarityIndex(treasure.rarity) <= rarityIndex(rarity));
  const definition = (pool.length ? pool : fallback)[Math.floor(Math.random() * Math.max(1, pool.length || fallback.length))] ?? TREASURES[0];
  return { uid: `${Date.now().toString(36)}-${uidSeed.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, treasureId: definition.id };
}

export function treasureById(id: string) {
  return TREASURES.find((treasure) => treasure.id === id) ?? TREASURES[0];
}

export function canPlaceTreasure(
  items: PlacedTreasure[],
  item: TreasureItem,
  size: InventorySize,
  x: number,
  y: number,
  ignoreUid = "",
) {
  const definition = treasureById(item.treasureId);
  if (
    x < 0
    || y < 0
    || x + definition.width > size.columns
    || y + definition.height > size.rows
  ) return false;
  return items.every((placed) => {
    if (placed.uid === ignoreUid) return true;
    const other = treasureById(placed.treasureId);
    return (
      x + definition.width <= placed.x
      || placed.x + other.width <= x
      || y + definition.height <= placed.y
      || placed.y + other.height <= y
    );
  });
}

export function firstTreasurePosition(
  items: PlacedTreasure[],
  item: TreasureItem,
  size: InventorySize,
  ignoreUid = "",
) {
  const definition = treasureById(item.treasureId);
  for (let y = 0; y <= size.rows - definition.height; y++) {
    for (let x = 0; x <= size.columns - definition.width; x++) {
      if (canPlaceTreasure(items, item, size, x, y, ignoreUid)) return { x, y };
    }
  }
  return null;
}

export function placeItems(items: TreasureItem[], size: InventorySize): PlacedTreasure[] | null {
  const placed: PlacedTreasure[] = [];
  const sorted = [...items].sort((a, b) => {
    const aa = treasureById(a.treasureId);
    const bb = treasureById(b.treasureId);
    return bb.width * bb.height - aa.width * aa.height;
  });
  for (const item of sorted) {
    const position = firstTreasurePosition(placed, item, size);
    if (!position) return null;
    placed.push({ ...item, ...position });
  }
  return placed;
}

export function randomBuffChoices(count = 3) {
  return [...BUFFS].sort(() => Math.random() - .5).slice(0, count);
}
import type { EquipmentItem } from "./progression";
