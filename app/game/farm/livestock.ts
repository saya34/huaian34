import { MATERIALS } from "../alchemy/item-data";

export type SpiritBeastId = "moonfeather-hen" | "jade-antler-deer" | "cloudwool-sheep" | "jade-frog" | "spirit-moth" | "cloud-hairball";

export type SpiritBeastDefinition = {
  id: SpiritBeastId;
  name: string;
  role: string;
  icon: string;
  price: number;
  unlockLevel: number;
  stockType: "resident" | "random";
  bondRequired: number;
  feedMaterialName: string;
  productId: string;
  productName: string;
  productDescription: string;
  productArt: string;
  productValue: number;
  productRarity: 1 | 2 | 3 | 4 | 5;
  productionTicks: number;
};

export type SpiritBeast = {
  uid: string;
  speciesId: SpiritBeastId;
  experience: number;
  createdDay: number;
  lastFedDay: number;
  readyDay: number;
  lastLovedDay: number;
  mood: "idle" | "fed" | "happy";
  state: "idle" | "sleeping" | "ready";
  asleepAtTick: number;
  readyAtTick: number;
  lovedAtTick: number;
};

export type LivestockProgress = { animals: SpiritBeast[]; totalCollected: number; serial: number };

export const SPIRIT_BEASTS: SpiritBeastDefinition[] = [
  { id: "moonfeather-hen", name: "月翎灵雉", role: "灵禽栏", icon: "雉", price: 180, unlockLevel: 1, stockType: "resident", bondRequired: 0, feedMaterialName: "霜心草", productId: "moonfeather-egg", productName: "月翎灵卵", productDescription: "月翎灵雉凝成的温润灵卵，可交易，也适合制成恢复灵膳。", productArt: "/assets/items/item-05.webp", productValue: 72, productRarity: 2, productionTicks: 2 },
  { id: "cloudwool-sheep", name: "云绒灵羊", role: "灵兽棚", icon: "羊", price: 320, unlockLevel: 2, stockType: "resident", bondRequired: 8, feedMaterialName: "碧落灵芝", productId: "cloud-spirit-wool", productName: "云灵绒", productDescription: "触感如云的灵绒，是制作护身法衣的上好辅材。", productArt: "/assets/items/item-37.webp", productValue: 138, productRarity: 3, productionTicks: 3 },
  { id: "jade-antler-deer", name: "青玉灵豚", role: "灵兽棚", icon: "豚", price: 460, unlockLevel: 3, stockType: "resident", bondRequired: 18, feedMaterialName: "金阳参", productId: "jade-deer-dew", productName: "玉髓香露", productDescription: "灵豚吐纳地气凝成的玉色香露，蕴含温和生机。", productArt: "/assets/items/item-28.webp", productValue: 236, productRarity: 4, productionTicks: 4 },
  { id: "jade-frog", name: "沧露灵蛙", role: "莲池", icon: "蛙", price: 260, unlockLevel: 1, stockType: "random", bondRequired: 0, feedMaterialName: "玄水藻", productId: "azure-dew-pearl", productName: "沧露蛙珠", productDescription: "灵蛙吐纳月露凝成的水珠，触手清凉。", productArt: "/assets/items/item-19.webp", productValue: 116, productRarity: 3, productionTicks: 3 },
  { id: "spirit-moth", name: "梦粉灵蛾", role: "花廊", icon: "蛾", price: 380, unlockLevel: 2, stockType: "random", bondRequired: 0, feedMaterialName: "碧落灵芝", productId: "dream-moth-dust", productName: "幻梦鳞粉", productDescription: "翅上落下的幻粉，可安神亦可入幻丹。", productArt: "/assets/items/item-30.webp", productValue: 184, productRarity: 4, productionTicks: 4 },
  { id: "cloud-hairball", name: "云团灵狸", role: "暖棚", icon: "狸", price: 520, unlockLevel: 3, stockType: "random", bondRequired: 0, feedMaterialName: "霜心草", productId: "cloud-core-fleece", productName: "云绒芯", productDescription: "灵狸换下的柔软绒芯，天然蕴含护体罡气。", productArt: "/assets/items/item-36.webp", productValue: 268, productRarity: 4, productionTicks: 5 },
];

export function rotatingBeastStock(day: number) {
  const cycle = Math.floor((Math.max(1, day) - 1) / 15);
  const score = (id: string) => { let value = cycle * 2654435761; for (const char of id) value = (value ^ char.charCodeAt(0)) * 16777619; return Math.abs(value % 100000); };
  return SPIRIT_BEASTS.filter((beast) => beast.stockType === "random").sort((a, b) => score(a.id) - score(b.id)).slice(0, 2);
}

export const spiritBeastById = (id: string) => SPIRIT_BEASTS.find((beast) => beast.id === id);
export const livestockProductById = (id: string) => SPIRIT_BEASTS.find((beast) => beast.productId === id);
export const feedMaterialFor = (speciesId: SpiritBeastId) => MATERIALS.find((item) => item.name === spiritBeastById(speciesId)?.feedMaterialName)!;

export function createInitialLivestock(): LivestockProgress { return { animals: [], totalCollected: 0, serial: 0 }; }
export function normalizeLivestock(value?: Partial<LivestockProgress> | null): LivestockProgress { const base = createInitialLivestock(); return { ...base, ...value, animals: Array.isArray(value?.animals) ? value.animals.map((animal) => ({ ...animal, state: animal.state ?? (animal.readyDay > 0 ? "sleeping" : "idle"), asleepAtTick: animal.asleepAtTick ?? 0, readyAtTick: animal.readyAtTick ?? (animal.readyDay > 0 ? Math.max(1, (animal.readyDay - 1) * 3) : 0), lovedAtTick: animal.lovedAtTick ?? 0 })) : [] }; }
export function livestockCapacity(farmLevel: number) { return Math.min(8, 2 + farmLevel); }
export function beastLevel(experience: number) { return experience >= 170 ? 5 : experience >= 105 ? 4 : experience >= 55 ? 3 : experience >= 20 ? 2 : 1; }
export function beastLevelProgress(experience: number) { const thresholds = [0, 20, 55, 105, 170, 260]; const level = beastLevel(experience); const start = thresholds[level - 1]; const end = thresholds[level]; return { level, current: experience - start, needed: end - start, percent: Math.min(100, (experience - start) / (end - start) * 100) }; }

export function buySpiritBeast(progress: LivestockProgress, speciesId: SpiritBeastId, currentTick: number, farmLevel: number) {
  const definition = spiritBeastById(speciesId)!;
  if (farmLevel < definition.unlockLevel) return { progress, ok: false as const, message: `灵圃达到 ${definition.unlockLevel} 阶后方可饲养${definition.name}` };
  if (progress.animals.length >= livestockCapacity(farmLevel)) return { progress, ok: false as const, message: "灵兽苑容量已满，请提升灵圃等阶或出售灵兽" };
  const serial = progress.serial + 1;
  const animal: SpiritBeast = { uid: `spirit-beast-${serial}`, speciesId, experience: 0, createdDay: Math.floor(currentTick / 3) + 1, lastFedDay: 0, readyDay: 0, lastLovedDay: 0, mood: "idle", state: "idle", asleepAtTick: 0, readyAtTick: 0, lovedAtTick: 0 };
  return { progress: { ...progress, serial, animals: [...progress.animals, animal] }, ok: true as const, message: `${definition.name}已入住${definition.role}` };
}

export function syncLivestock(progress: LivestockProgress, currentTick: number): LivestockProgress {
  return { ...progress, animals: progress.animals.map((animal) => animal.state === "sleeping" && animal.readyAtTick <= currentTick ? { ...animal, state: "ready" as const } : animal) };
}

export function feedSpiritBeast(progress: LivestockProgress, uid: string, currentTick: number) {
  const animal = progress.animals.find((entry) => entry.uid === uid);
  if (!animal) return { progress, ok: false as const, message: "没有找到这只灵兽" };
  if (animal.state !== "idle") return { progress, ok: false as const, message: animal.state === "ready" ? "请先唤醒并收取产物" : "灵兽已经饱食，正在睡眠生产" };
  const definition = spiritBeastById(animal.speciesId)!;
  const readyAtTick = currentTick + definition.productionTicks;
  const day = Math.floor(currentTick / 3) + 1;
  return { progress: { ...progress, animals: progress.animals.map((entry) => entry.uid === uid ? { ...entry, lastFedDay: day, readyDay: Math.floor(readyAtTick / 3) + 1, asleepAtTick: currentTick, readyAtTick, lovedAtTick: 0, state: "sleeping" as const, experience: entry.experience + 12, mood: "fed" as const } : entry) }, ok: true as const, message: `喂养完成 · ${definition.productionTicks} 个游戏时辰后凝成产物` };
}

export function loveSpiritBeast(progress: LivestockProgress, uid: string, currentTick: number) {
  const animal = progress.animals.find((entry) => entry.uid === uid);
  if (!animal) return { progress, ok: false as const, message: "没有找到这只灵兽" };
  if (animal.state !== "sleeping") return { progress, ok: false as const, message: "抚灵只在灵兽睡眠生产期间开放" };
  if (currentTick <= animal.asleepAtTick) return { progress, ok: false as const, message: "灵兽刚刚入睡，下一时辰再来抚灵" };
  if (animal.lovedAtTick >= animal.asleepAtTick) return { progress, ok: false as const, message: "本轮生产已经抚灵" };
  const day = Math.floor(currentTick / 3) + 1;
  return { progress: { ...progress, animals: progress.animals.map((entry) => entry.uid === uid ? { ...entry, lastLovedDay: day, lovedAtTick: currentTick, experience: entry.experience + 8, mood: "happy" as const } : entry) }, ok: true as const, message: "抚灵成功 · 亲和成长，本轮产量提升" };
}

export function collectSpiritBeast(progress: LivestockProgress, uid: string, currentTick: number) {
  const animal = progress.animals.find((entry) => entry.uid === uid);
  if (!animal || animal.readyAtTick <= 0 || animal.readyAtTick > currentTick) return { progress, ok: false as const, message: "产物尚未凝成" };
  const definition = spiritBeastById(animal.speciesId)!;
  const level = beastLevel(animal.experience);
  const amount = 1 + Math.floor((level - 1) / 2) + (animal.mood === "happy" ? 1 : 0);
  return { progress: { ...progress, totalCollected: progress.totalCollected + amount, animals: progress.animals.map((entry) => entry.uid === uid ? { ...entry, readyDay: 0, readyAtTick: 0, asleepAtTick: 0, lovedAtTick: 0, state: "idle" as const, mood: "idle" as const, experience: entry.experience + amount * 3 } : entry) }, ok: true as const, message: `唤醒灵兽 · 收取${definition.productName} ×${amount}`, reward: { itemId: definition.productId, itemType: "material" as const, rarity: definition.productRarity, amount, sourceTags: ["云岫灵圃", "灵兽苑"] } };
}

export function sellSpiritBeast(progress: LivestockProgress, uid: string) {
  const animal = progress.animals.find((entry) => entry.uid === uid);
  if (!animal) return { progress, ok: false as const, message: "没有找到这只灵兽", gain: 0 };
  const definition = spiritBeastById(animal.speciesId)!;
  const gain = Math.floor(definition.price * .55 + beastLevel(animal.experience) * 28);
  return { progress: { ...progress, animals: progress.animals.filter((entry) => entry.uid !== uid) }, ok: true as const, message: `${definition.name}已托付给附近仙庄`, gain };
}
