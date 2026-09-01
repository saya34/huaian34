export type BaitId = "spirit-worm" | "jade-lure" | "star-bait";
export type FishingMapId = "yunzhou" | "canglan" | "chixia";
export type FishingLocationId = "lingxiao-cloudpool" | "tavern-pier" | "yunzhou-wild" | "canglan-wild" | "chixia-wild";

export type FishDefinition = {
  id: string;
  name: string;
  description: string;
  rarity: 1 | 2 | 3 | 4 | 5;
  value: number;
  art: string;
  icon: string;
};

export type FishPoolEntry = { fishId: string; weight: number };

export type FishingLocation = {
  id: FishingLocationId;
  name: string;
  subtitle: string;
  kind: "resident" | "random";
  sceneId?: string;
  mapId: FishingMapId;
  pool: FishPoolEntry[];
};

export type RandomFishingSpot = {
  id: string;
  locationId: FishingLocationId;
  mapId: FishingMapId;
  x: number;
  y: number;
  spawnDay: number;
};

export type PendingFishingCast = {
  locationId: FishingLocationId;
  randomSpotId?: string;
  baitId: BaitId;
  fishId: string;
  castedAtTick: number;
  seed: string;
};

export type FishingProgress = {
  rods: number;
  baits: Record<BaitId, number>;
  dailyDay: number;
  dailyAttempts: number;
  totalCaught: number;
  records: Record<string, number>;
  randomSpots: RandomFishingSpot[];
  lastSpawnDay: number;
  pendingCast: PendingFishingCast | null;
};

export const DAILY_CAST_LIMIT = 6;

export const BAITS: Record<BaitId, { name: string; description: string; price: number; icon: string }> = {
  "spirit-worm": { name: "灵蚯", description: "气息自然，适合常见灵鱼。", price: 12, icon: "虫" },
  "jade-lure": { name: "碧玉拟饵", description: "提高珍稀鱼咬钩的机会。", price: 55, icon: "玉" },
  "star-bait": { name: "星辉饵", description: "大幅提高高阶灵鱼的权重。", price: 180, icon: "星" },
};

export const FISH: FishDefinition[] = [
  { id: "green-scale-crucian", name: "青鳞灵鲫", description: "云州水巷最常见的灵鱼，鳞粉可作温和药引。", rarity: 1, value: 45, art: "/assets/moon-lotus.webp", icon: "鲫" },
  { id: "silver-tail-carp", name: "银尾灵鲤", description: "摆尾时泛起细碎银光，肉质清甜。", rarity: 2, value: 82, art: "/assets/star-sand.webp", icon: "鲤" },
  { id: "drunken-moon-mandarin", name: "醉月鳜", description: "只在酒香与月色交叠的水榭附近出没。", rarity: 2, value: 118, art: "/assets/jade-mushroom.webp", icon: "鳜" },
  { id: "dream-goldscale", name: "云梦金鳞", description: "金鳞如梦，常被修士制成护心灵膳。", rarity: 3, value: 248, art: "/assets/flame-herb.webp", icon: "金" },
  { id: "cloud-wing-fish", name: "云翅飞鱼", description: "借云气浮游于天池，离水仍可滑翔片刻。", rarity: 1, value: 58, art: "/assets/items/item-04.webp", icon: "云" },
  { id: "frost-fin-sturgeon", name: "霜鳍白鲟", description: "霜鳍凝寒，最爱清冽而灵气充盈的深潭。", rarity: 2, value: 126, art: "/assets/items/item-17.webp", icon: "霜" },
  { id: "jade-kun-fry", name: "天游玉鲲", description: "幼鲲藏身云海，灵息沉厚，是极少见的祥瑞。", rarity: 4, value: 720, art: "/assets/demon-core.webp", icon: "鲲" },
  { id: "void-dragon-carp", name: "太虚龙鲤", description: "传说跃过太虚门便能化龙，几乎只存在于游记。", rarity: 5, value: 1680, art: "/assets/xuanhuo-furnace.webp", icon: "龙" },
  { id: "moon-shadow-eel", name: "月影银鳗", description: "随机灵泉的来客，身体像一束游动月光。", rarity: 2, value: 158, art: "/assets/moon-lotus.webp", icon: "鳗" },
  { id: "thunder-swordfish", name: "雷纹剑鱼", description: "额骨如剑，鳞纹中积蓄着细小雷光。", rarity: 3, value: 338, art: "/assets/items/item-31.webp", icon: "雷" },
  { id: "blazing-bone-shark", name: "赤炎骨鲛", description: "游于赤霞地脉熔泉，骨刺灼热却不伤水。", rarity: 4, value: 760, art: "/assets/flame-herb.webp", icon: "炎" },
  { id: "star-marrow-merling", name: "星髓鲛苗", description: "星辉在骨髓内流转，百年也难遇一尾。", rarity: 5, value: 1980, art: "/assets/star-sand.webp", icon: "星" },
];

export const fishById = (id: string) => FISH.find((fish) => fish.id === id);

export const FISHING_LOCATIONS: FishingLocation[] = [
  { id: "lingxiao-cloudpool", name: "凌霄云海天池", subtitle: "常驻钓点 · 云气鱼池", kind: "resident", sceneId: "lingxiao", mapId: "yunzhou", pool: [
    { fishId: "cloud-wing-fish", weight: 45 }, { fishId: "frost-fin-sturgeon", weight: 30 }, { fishId: "silver-tail-carp", weight: 17 }, { fishId: "jade-kun-fry", weight: 7 }, { fishId: "void-dragon-carp", weight: 1 },
  ] },
  { id: "tavern-pier", name: "醉月楼水榭", subtitle: "常驻钓点 · 酒香河湾", kind: "resident", sceneId: "tavern", mapId: "yunzhou", pool: [
    { fishId: "green-scale-crucian", weight: 46 }, { fishId: "silver-tail-carp", weight: 29 }, { fishId: "drunken-moon-mandarin", weight: 17 }, { fishId: "dream-goldscale", weight: 7 }, { fishId: "moon-shadow-eel", weight: 1 },
  ] },
  { id: "yunzhou-wild", name: "云州游光灵泉", subtitle: "随机钓点 · 今日显现", kind: "random", mapId: "yunzhou", pool: [
    { fishId: "silver-tail-carp", weight: 34 }, { fishId: "moon-shadow-eel", weight: 29 }, { fishId: "dream-goldscale", weight: 23 }, { fishId: "jade-kun-fry", weight: 11 }, { fishId: "void-dragon-carp", weight: 3 },
  ] },
  { id: "canglan-wild", name: "沧澜裂隙鱼影", subtitle: "随机钓点 · 寒潮鱼池", kind: "random", mapId: "canglan", pool: [
    { fishId: "frost-fin-sturgeon", weight: 39 }, { fishId: "moon-shadow-eel", weight: 28 }, { fishId: "thunder-swordfish", weight: 22 }, { fishId: "jade-kun-fry", weight: 9 }, { fishId: "star-marrow-merling", weight: 2 },
  ] },
  { id: "chixia-wild", name: "赤霞熔泉鱼火", subtitle: "随机钓点 · 炎脉鱼池", kind: "random", mapId: "chixia", pool: [
    { fishId: "dream-goldscale", weight: 38 }, { fishId: "thunder-swordfish", weight: 29 }, { fishId: "blazing-bone-shark", weight: 23 }, { fishId: "void-dragon-carp", weight: 8 }, { fishId: "star-marrow-merling", weight: 2 },
  ] },
];

export const fishingLocationById = (id: string) => FISHING_LOCATIONS.find((location) => location.id === id);

export function createInitialFishing(): FishingProgress {
  return { rods: 8, baits: { "spirit-worm": 8, "jade-lure": 2, "star-bait": 0 }, dailyDay: 1, dailyAttempts: 0, totalCaught: 0, records: {}, randomSpots: [], lastSpawnDay: 0, pendingCast: null };
}

export function normalizeFishingProgress(value?: Partial<FishingProgress> | null): FishingProgress {
  const base = createInitialFishing();
  return { ...base, ...value, baits: { ...base.baits, ...value?.baits }, records: { ...base.records, ...value?.records }, randomSpots: Array.isArray(value?.randomSpots) ? value.randomSpots : [] };
}

function hash(seed: string) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) value = Math.imul(value ^ seed.charCodeAt(index), 16777619);
  return (value >>> 0) / 4294967296;
}

const SPOT_COORDINATES: Record<FishingMapId, Array<[number, number]>> = {
  yunzhou: [[24, 74], [77, 55], [18, 43]],
  canglan: [[28, 68], [71, 31], [52, 76]],
  chixia: [[23, 61], [69, 70], [76, 31]],
};

export function resetFishingDay(progress: FishingProgress, day: number): FishingProgress {
  return progress.dailyDay === day ? progress : { ...progress, dailyDay: day, dailyAttempts: 0 };
}

export function ensureRandomFishingSpots(progress: FishingProgress, day: number, highestUnlocked: number): FishingProgress {
  const current = resetFishingDay(progress, day);
  if (current.lastSpawnDay === day) return current;
  const maps: FishingMapId[] = ["yunzhou"];
  if (highestUnlocked >= 8) maps.push("canglan");
  if (highestUnlocked >= 15) maps.push("chixia");
  const count = day % 5 === 0 ? 2 : 1;
  const spots = Array.from({ length: count }, (_, index) => {
    const mapId = maps[Math.floor(hash(`map:${day}:${index}`) * maps.length)];
    const coordinates = SPOT_COORDINATES[mapId];
    const [x, y] = coordinates[Math.floor(hash(`coord:${day}:${index}`) * coordinates.length)];
    return { id: `fishing-light-${day}-${index}`, locationId: `${mapId}-wild` as FishingLocationId, mapId, x, y, spawnDay: day };
  });
  return { ...current, randomSpots: spots, lastSpawnDay: day };
}

export function weightedPool(location: FishingLocation, baitId: BaitId) {
  const entries = location.pool.map((entry) => {
    const rarity = fishById(entry.fishId)?.rarity ?? 1;
    const multiplier = baitId === "star-bait" ? (rarity >= 4 ? 2.5 : rarity === 3 ? 1.5 : .8) : baitId === "jade-lure" ? (rarity >= 4 ? 1.7 : rarity === 3 ? 1.3 : .92) : 1;
    return { ...entry, adjustedWeight: entry.weight * multiplier };
  });
  const total = entries.reduce((sum, entry) => sum + entry.adjustedWeight, 0);
  return entries.map((entry) => ({ ...entry, probability: entry.adjustedWeight / total }));
}

export function rollFish(location: FishingLocation, baitId: BaitId, seed: string) {
  const pool = weightedPool(location, baitId);
  let roll = hash(seed);
  for (const entry of pool) {
    roll -= entry.probability;
    if (roll <= 0) return fishById(entry.fishId) ?? FISH[0];
  }
  return fishById(pool.at(-1)?.fishId ?? "") ?? FISH[0];
}

// Mirrors the reference reducer order: validate the wharf, consume rod + bait,
// then persist the pending catch. Reeling is a separate transaction.
export function castFishing(progress: FishingProgress, input: { day: number; tick: number; location: FishingLocation; baitId: BaitId; randomSpotId?: string }) {
  const { day, tick, location, baitId, randomSpotId } = input;
  const current = resetFishingDay(progress, day);
  if (current.pendingCast) return { progress: current, ok: false as const, message: "已有一竿尚未收线" };
  if (current.dailyAttempts >= DAILY_CAST_LIMIT) return { progress: current, ok: false as const, message: "今日垂钓次数已经用尽" };
  if (current.rods <= 0) return { progress: current, ok: false as const, message: "灵木钓竿已经用尽" };
  if ((current.baits[baitId] ?? 0) <= 0) return { progress: current, ok: false as const, message: `没有${BAITS[baitId].name}了` };
  if (randomSpotId && !current.randomSpots.some((spot) => spot.id === randomSpotId)) return { progress: current, ok: false as const, message: "这处游光钓点已经消散" };
  const seed = `${day}:${tick}:${location.id}:${current.totalCaught}:${current.dailyAttempts}:${baitId}`;
  const fish = rollFish(location, baitId, seed);
  const pendingCast: PendingFishingCast = { locationId: location.id, randomSpotId, baitId, fishId: fish.id, castedAtTick: tick, seed };
  return { ok: true as const, catch: pendingCast, progress: { ...current, rods: current.rods - 1, baits: { ...current.baits, [baitId]: current.baits[baitId] - 1 }, dailyAttempts: current.dailyAttempts + 1, pendingCast } };
}

export function reelFishing(progress: FishingProgress, success: boolean) {
  const pending = progress.pendingCast;
  if (!pending) return { progress, ok: false as const, message: "当前没有等待收线的鱼竿" };
  return {
    ok: true as const,
    fishId: pending.fishId,
    progress: {
      ...progress,
      pendingCast: null,
      totalCaught: progress.totalCaught + (success ? 1 : 0),
      records: success ? { ...progress.records, [pending.fishId]: (progress.records[pending.fishId] ?? 0) + 1 } : progress.records,
      randomSpots: pending.randomSpotId ? progress.randomSpots.filter((spot) => spot.id !== pending.randomSpotId) : progress.randomSpots,
    },
  };
}
