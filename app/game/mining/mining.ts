import { MATERIALS, type GameItem } from "../alchemy/item-data";

export type MiningMapId = "yunzhou" | "canglan" | "chixia";
export type MiningLocationId = "yunzhou-mine" | "yunzhou-vein" | "canglan-vein" | "chixia-vein";
export type MiningLocation = { id: MiningLocationId; name: string; subtitle: string; kind: "resident" | "random"; mapId: MiningMapId; x?: number; y?: number; pool: Array<{ materialName: string; weight: number }> };
export type MiningNode = { id: string; materialName: string; minedAtTick: number; readyAtTick: number; recoveryTicks: number };
export type RandomMiningSpot = { id: string; locationId: MiningLocationId; mapId: MiningMapId; x: number; y: number; spawnDay: number; durability: number; maxDurability: number; nodes: MiningNode[] };
export type MiningProgress = { pickaxes: number; dailyDay: number; residentDurability: number; residentMaxDurability: number; residentNodes: MiningNode[]; randomSpots: RandomMiningSpot[]; lastSpawnDay: number; totalMined: number; records: Record<string, number>; strikeSerial: number };

export const PICKAXE_PRICE = 36;
export const MINING_LOCATIONS: MiningLocation[] = [
  { id: "yunzhou-mine", name: "玄铁常明矿窟", subtitle: "常驻矿洞 · 矿点按游戏时辰复原", kind: "resident", mapId: "yunzhou", x: 84, y: 60, pool: [{ materialName: "黑曜火铁", weight: 42 }, { materialName: "星陨铁", weight: 30 }, { materialName: "雷纹紫晶", weight: 20 }, { materialName: "太初玉髓", weight: 8 }] },
  { id: "yunzhou-vein", name: "云州游光矿脉", subtitle: "随机矿脉 · 耗尽消失", kind: "random", mapId: "yunzhou", pool: [{ materialName: "星陨铁", weight: 40 }, { materialName: "黑曜火铁", weight: 32 }, { materialName: "金乌翎石", weight: 20 }, { materialName: "太初玉髓", weight: 8 }] },
  { id: "canglan-vein", name: "沧澜寒晶裂脉", subtitle: "随机矿脉 · 寒潮矿池", kind: "random", mapId: "canglan", pool: [{ materialName: "寒渊玄冰", weight: 48 }, { materialName: "雷纹紫晶", weight: 30 }, { materialName: "星陨铁", weight: 16 }, { materialName: "太初玉髓", weight: 6 }] },
  { id: "chixia-vein", name: "赤霞熔金矿脉", subtitle: "随机矿脉 · 炎脉矿池", kind: "random", mapId: "chixia", pool: [{ materialName: "黑曜火铁", weight: 44 }, { materialName: "金乌翎石", weight: 31 }, { materialName: "雷纹紫晶", weight: 18 }, { materialName: "太初玉髓", weight: 7 }] },
];

export const miningLocationById = (id: string) => MINING_LOCATIONS.find((location) => location.id === id);
export const miningMaterialByName = (name: string) => MATERIALS.find((item) => item.name === name)!;

function hash(seed: string) { let value = 2166136261; for (let index = 0; index < seed.length; index += 1) value = Math.imul(value ^ seed.charCodeAt(index), 16777619); return (value >>> 0) / 4294967296; }
function makeNode(id: string, materialName: string, recoveryTicks: number): MiningNode { return { id, materialName, minedAtTick: -1, readyAtTick: 0, recoveryTicks }; }
function initialResidentNodes() { return [makeNode("resident-iron", "黑曜火铁", 1), makeNode("resident-star", "星陨铁", 2), makeNode("resident-thunder", "雷纹紫晶", 3), makeNode("resident-jade", "太初玉髓", 4)]; }

export function createInitialMining(): MiningProgress { return { pickaxes: 6, dailyDay: 1, residentDurability: 4, residentMaxDurability: 4, residentNodes: initialResidentNodes(), randomSpots: [], lastSpawnDay: 0, totalMined: 0, records: {}, strikeSerial: 0 }; }

export function miningPool(location: MiningLocation) { const total = location.pool.reduce((sum, entry) => sum + entry.weight, 0); return location.pool.map((entry) => ({ ...entry, material: miningMaterialByName(entry.materialName), probability: entry.weight / total })); }
export function rollMiningMaterial(location: MiningLocation, seed: string): GameItem { let roll = hash(seed); const pool = miningPool(location); for (const entry of pool) { roll -= entry.probability; if (roll <= 0) return entry.material; } return pool.at(-1)!.material; }
function materialForNode(location: MiningLocation, seed: string) { return rollMiningMaterial(location, seed).name; }

function normalizeSpot(spot: Partial<RandomMiningSpot> & Pick<RandomMiningSpot, "id" | "locationId" | "mapId" | "x" | "y" | "spawnDay">): RandomMiningSpot {
  const location = miningLocationById(spot.locationId)!;
  const count = Math.max(1, spot.maxDurability ?? spot.durability ?? 3);
  const stored = Array.isArray(spot.nodes) ? spot.nodes : [];
  const nodes = stored.length ? stored : Array.from({ length: count }, (_, index) => makeNode(`${spot.id}-node-${index}`, materialForNode(location, `${spot.id}:${index}`), 0));
  const durability = nodes.filter((node) => node.minedAtTick < 0).length;
  return { id: spot.id, locationId: spot.locationId, mapId: spot.mapId, x: spot.x, y: spot.y, spawnDay: spot.spawnDay, nodes, durability, maxDurability: nodes.length };
}

export function normalizeMiningProgress(value?: Partial<MiningProgress> | null): MiningProgress {
  const base = createInitialMining();
  const resident = Array.isArray(value?.residentNodes) && value.residentNodes.length ? value.residentNodes : base.residentNodes;
  const spots = Array.isArray(value?.randomSpots) ? value.randomSpots.map((spot) => normalizeSpot(spot)) : [];
  return { ...base, ...value, residentNodes: resident, residentDurability: resident.length, residentMaxDurability: resident.length, records: { ...base.records, ...value?.records }, randomSpots: spots };
}

const VEIN_COORDINATES: Record<MiningMapId, Array<[number, number]>> = { yunzhou: [[17, 63], [68, 79], [31, 26]], canglan: [[19, 46], [64, 72], [78, 47]], chixia: [[31, 77], [68, 45], [81, 67]] };
export function resetMiningDay(progress: MiningProgress, day: number) { return progress.dailyDay === day ? progress : { ...progress, dailyDay: day }; }

export function ensureRandomMiningSpots(progress: MiningProgress, day: number, highestUnlocked: number): MiningProgress {
  const current = resetMiningDay(progress, day); if (current.lastSpawnDay === day) return current;
  const maps: MiningMapId[] = ["yunzhou"]; if (highestUnlocked >= 8) maps.push("canglan"); if (highestUnlocked >= 15) maps.push("chixia");
  const count = day % 4 === 0 ? 2 : 1;
  const spots = Array.from({ length: count }, (_, index) => {
    const mapId = maps[Math.floor(hash(`ore-map:${day}:${index}`) * maps.length)]; const coords = VEIN_COORDINATES[mapId]; const [x, y] = coords[Math.floor(hash(`ore-pos:${day}:${index}`) * coords.length)]; const nodeCount = 2 + Math.floor(hash(`ore-hp:${day}:${index}`) * 3); const id = `ore-vein-${day}-${index}`; const locationId = `${mapId}-vein` as MiningLocationId; const location = miningLocationById(locationId)!;
    const nodes = Array.from({ length: nodeCount }, (_, nodeIndex) => makeNode(`${id}-node-${nodeIndex}`, materialForNode(location, `${id}:${nodeIndex}`), 0));
    return { id, locationId, mapId, x, y, spawnDay: day, durability: nodes.length, maxDurability: nodes.length, nodes };
  });
  return { ...current, randomSpots: spots, lastSpawnDay: day };
}

export function miningNodes(progress: MiningProgress, location: MiningLocation, randomSpotId?: string) {
  return location.kind === "resident" ? progress.residentNodes : progress.randomSpots.find((spot) => spot.id === randomSpotId)?.nodes ?? [];
}

// Reference reducer order: validate node and tool, consume one pickaxe, grant
// yield, then persist the node's mined/recovery state.
export function mineNode(progress: MiningProgress, input: { day: number; tick: number; location: MiningLocation; nodeId: string; randomSpotId?: string }) {
  const current = resetMiningDay(progress, input.day);
  if (current.pickaxes <= 0) return { progress: current, ok: false as const, message: "灵木矿镐已经用尽" };
  const nodes = miningNodes(current, input.location, input.randomSpotId);
  const node = nodes.find((entry) => entry.id === input.nodeId);
  if (!node) return { progress: current, ok: false as const, message: "没有找到这处矿点" };
  if (input.location.kind === "resident" && node.readyAtTick > input.tick) return { progress: current, ok: false as const, message: `矿点正在复原，尚余 ${node.readyAtTick - input.tick} 个游戏时辰` };
  if (input.location.kind === "random" && node.minedAtTick >= 0) return { progress: current, ok: false as const, message: "这处矿点已经采尽" };
  const critical = hash(`mine-critical:${input.day}:${input.tick}:${node.id}:${current.strikeSerial}`) < .15;
  const amount = critical ? 2 : 1;
  const material = miningMaterialByName(node.materialName);
  const minedNode = { ...node, minedAtTick: input.tick, readyAtTick: input.location.kind === "resident" ? input.tick + node.recoveryTicks : Number.MAX_SAFE_INTEGER };
  let residentNodes = current.residentNodes;
  let randomSpots = current.randomSpots;
  if (input.location.kind === "resident") residentNodes = current.residentNodes.map((entry) => entry.id === node.id ? minedNode : entry);
  else {
    const spot = current.randomSpots.find((entry) => entry.id === input.randomSpotId)!;
    const nextNodes = spot.nodes.map((entry) => entry.id === node.id ? minedNode : entry);
    const durability = nextNodes.filter((entry) => entry.minedAtTick < 0).length;
    randomSpots = durability <= 0 ? current.randomSpots.filter((entry) => entry.id !== spot.id) : current.randomSpots.map((entry) => entry.id === spot.id ? { ...entry, nodes: nextNodes, durability } : entry);
  }
  const next = { ...current, pickaxes: current.pickaxes - 1, residentNodes, residentDurability: residentNodes.filter((entry) => entry.readyAtTick <= input.tick).length, randomSpots, totalMined: current.totalMined + amount, strikeSerial: current.strikeSerial + 1, records: { ...current.records, [material.id]: (current.records[material.id] ?? 0) + amount } };
  return { progress: next, ok: true as const, material, amount, critical, message: `${critical ? "灵脉共振 · " : "开采成功 · "}${material.name} ×${amount}` };
}
