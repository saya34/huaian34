import { MATERIALS, type GameItem } from "../alchemy/item-data";

export type MiningMapId = "yunzhou" | "canglan" | "chixia";
export type MiningLocationId = "yunzhou-mine" | "yunzhou-vein" | "canglan-vein" | "chixia-vein";
export type MiningLocation = { id: MiningLocationId; name: string; subtitle: string; kind: "resident" | "random"; mapId: MiningMapId; x?: number; y?: number; pool: Array<{ materialName: string; weight: number }> };
export type RandomMiningSpot = { id: string; locationId: MiningLocationId; mapId: MiningMapId; x: number; y: number; spawnDay: number; durability: number; maxDurability: number };
export type MiningProgress = { pickaxes: number; dailyDay: number; residentDurability: number; residentMaxDurability: number; randomSpots: RandomMiningSpot[]; lastSpawnDay: number; totalMined: number; records: Record<string, number>; strikeSerial: number };

export const PICKAXE_PRICE = 36;
export const MINING_LOCATIONS: MiningLocation[] = [
  { id: "yunzhou-mine", name: "玄铁常明矿窟", subtitle: "常驻矿洞 · 每日恢复", kind: "resident", mapId: "yunzhou", x: 84, y: 60, pool: [{ materialName: "黑曜火铁", weight: 42 }, { materialName: "星陨铁", weight: 30 }, { materialName: "雷纹紫晶", weight: 20 }, { materialName: "太初玉髓", weight: 8 }] },
  { id: "yunzhou-vein", name: "云州游光矿脉", subtitle: "随机矿脉 · 耗尽消失", kind: "random", mapId: "yunzhou", pool: [{ materialName: "星陨铁", weight: 40 }, { materialName: "黑曜火铁", weight: 32 }, { materialName: "金乌翎石", weight: 20 }, { materialName: "太初玉髓", weight: 8 }] },
  { id: "canglan-vein", name: "沧澜寒晶裂脉", subtitle: "随机矿脉 · 寒潮矿池", kind: "random", mapId: "canglan", pool: [{ materialName: "寒渊玄冰", weight: 48 }, { materialName: "雷纹紫晶", weight: 30 }, { materialName: "星陨铁", weight: 16 }, { materialName: "太初玉髓", weight: 6 }] },
  { id: "chixia-vein", name: "赤霞熔金矿脉", subtitle: "随机矿脉 · 炎脉矿池", kind: "random", mapId: "chixia", pool: [{ materialName: "黑曜火铁", weight: 44 }, { materialName: "金乌翎石", weight: 31 }, { materialName: "雷纹紫晶", weight: 18 }, { materialName: "太初玉髓", weight: 7 }] },
];

export const miningLocationById = (id: string) => MINING_LOCATIONS.find((location) => location.id === id);
export const miningMaterialByName = (name: string) => MATERIALS.find((item) => item.name === name)!;

export function createInitialMining(): MiningProgress { return { pickaxes: 6, dailyDay: 1, residentDurability: 5, residentMaxDurability: 5, randomSpots: [], lastSpawnDay: 0, totalMined: 0, records: {}, strikeSerial: 0 }; }
export function normalizeMiningProgress(value?: Partial<MiningProgress> | null): MiningProgress { const base = createInitialMining(); return { ...base, ...value, records: { ...base.records, ...value?.records }, randomSpots: Array.isArray(value?.randomSpots) ? value.randomSpots : [] }; }

function hash(seed: string) { let value = 2166136261; for (let index = 0; index < seed.length; index += 1) value = Math.imul(value ^ seed.charCodeAt(index), 16777619); return (value >>> 0) / 4294967296; }
const VEIN_COORDINATES: Record<MiningMapId, Array<[number, number]>> = { yunzhou: [[17, 63], [68, 79], [31, 26]], canglan: [[19, 46], [64, 72], [78, 47]], chixia: [[31, 77], [68, 45], [81, 67]] };

export function resetMiningDay(progress: MiningProgress, day: number) { return progress.dailyDay === day ? progress : { ...progress, dailyDay: day, residentDurability: progress.residentMaxDurability }; }
export function ensureRandomMiningSpots(progress: MiningProgress, day: number, highestUnlocked: number): MiningProgress {
  const current = resetMiningDay(progress, day); if (current.lastSpawnDay === day) return current;
  const maps: MiningMapId[] = ["yunzhou"]; if (highestUnlocked >= 8) maps.push("canglan"); if (highestUnlocked >= 15) maps.push("chixia");
  const count = day % 4 === 0 ? 2 : 1;
  const spots = Array.from({ length: count }, (_, index) => { const mapId = maps[Math.floor(hash(`ore-map:${day}:${index}`) * maps.length)]; const coords = VEIN_COORDINATES[mapId]; const [x, y] = coords[Math.floor(hash(`ore-pos:${day}:${index}`) * coords.length)]; const maxDurability = 2 + Math.floor(hash(`ore-hp:${day}:${index}`) * 3); return { id: `ore-vein-${day}-${index}`, locationId: `${mapId}-vein` as MiningLocationId, mapId, x, y, spawnDay: day, durability: maxDurability, maxDurability }; });
  return { ...current, randomSpots: spots, lastSpawnDay: day };
}

export function miningPool(location: MiningLocation) { const total = location.pool.reduce((sum, entry) => sum + entry.weight, 0); return location.pool.map((entry) => ({ ...entry, material: miningMaterialByName(entry.materialName), probability: entry.weight / total })); }
export function rollMiningMaterial(location: MiningLocation, seed: string): GameItem { let roll = hash(seed); const pool = miningPool(location); for (const entry of pool) { roll -= entry.probability; if (roll <= 0) return entry.material; } return pool.at(-1)!.material; }
export function criticalStrikeIndex(seed: string) { return Math.floor(hash(`critical:${seed}`) * 3); }

export function resolveMiningStrike(progress: MiningProgress, day: number, location: MiningLocation, materialId: string, critical: boolean, randomSpotId?: string) {
  const current = resetMiningDay(progress, day); if (current.pickaxes <= 0) return current;
  const amount = critical ? 2 : 1;
  if (location.kind === "resident") {
    if (current.residentDurability <= 0) return current;
    return { ...current, pickaxes: current.pickaxes - 1, residentDurability: current.residentDurability - 1, totalMined: current.totalMined + amount, strikeSerial: current.strikeSerial + 1, records: { ...current.records, [materialId]: (current.records[materialId] ?? 0) + amount } };
  }
  const spot = current.randomSpots.find((entry) => entry.id === randomSpotId); if (!spot || spot.durability <= 0) return current;
  const durability = spot.durability - 1;
  return { ...current, pickaxes: current.pickaxes - 1, totalMined: current.totalMined + amount, strikeSerial: current.strikeSerial + 1, records: { ...current.records, [materialId]: (current.records[materialId] ?? 0) + amount }, randomSpots: durability <= 0 ? current.randomSpots.filter((entry) => entry.id !== spot.id) : current.randomSpots.map((entry) => entry.id === spot.id ? { ...entry, durability } : entry) };
}
