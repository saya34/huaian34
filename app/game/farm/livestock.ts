import { MATERIALS } from "../alchemy/item-data";

export type SpiritBeastId = "moonfeather-hen" | "jade-antler-deer" | "cloudwool-sheep";

export type SpiritBeastDefinition = {
  id: SpiritBeastId;
  name: string;
  role: string;
  icon: string;
  price: number;
  unlockLevel: number;
  feedMaterialName: string;
  productId: string;
  productName: string;
  productDescription: string;
  productArt: string;
  productValue: number;
  productRarity: 1 | 2 | 3 | 4 | 5;
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
};

export type LivestockProgress = { animals: SpiritBeast[]; totalCollected: number; serial: number };

export const SPIRIT_BEASTS: SpiritBeastDefinition[] = [
  { id: "moonfeather-hen", name: "月翎灵雉", role: "灵禽栏", icon: "雉", price: 180, unlockLevel: 1, feedMaterialName: "霜心草", productId: "moonfeather-egg", productName: "月翎灵卵", productDescription: "月翎灵雉凝成的温润灵卵，可交易，也适合制成恢复灵膳。", productArt: "/assets/items/item-05.webp", productValue: 72, productRarity: 2 },
  { id: "cloudwool-sheep", name: "云绒灵羊", role: "灵兽棚", icon: "羊", price: 320, unlockLevel: 2, feedMaterialName: "碧落灵芝", productId: "cloud-spirit-wool", productName: "云灵绒", productDescription: "触感如云的灵绒，是制作护身法衣的上好辅材。", productArt: "/assets/items/item-37.webp", productValue: 138, productRarity: 3 },
  { id: "jade-antler-deer", name: "青玉灵鹿", role: "灵兽棚", icon: "鹿", price: 460, unlockLevel: 3, feedMaterialName: "金阳参", productId: "jade-deer-dew", productName: "玉鹿凝露", productDescription: "灵鹿角尖晨起凝成的玉色露珠，蕴含温和生机。", productArt: "/assets/items/item-28.webp", productValue: 236, productRarity: 4 },
];

export const spiritBeastById = (id: string) => SPIRIT_BEASTS.find((beast) => beast.id === id);
export const livestockProductById = (id: string) => SPIRIT_BEASTS.find((beast) => beast.productId === id);
export const feedMaterialFor = (speciesId: SpiritBeastId) => MATERIALS.find((item) => item.name === spiritBeastById(speciesId)?.feedMaterialName)!;

export function createInitialLivestock(): LivestockProgress { return { animals: [], totalCollected: 0, serial: 0 }; }
export function normalizeLivestock(value?: Partial<LivestockProgress> | null): LivestockProgress { const base = createInitialLivestock(); return { ...base, ...value, animals: Array.isArray(value?.animals) ? value.animals : [] }; }
export function livestockCapacity(farmLevel: number) { return Math.min(8, 2 + farmLevel); }
export function beastLevel(experience: number) { return experience >= 170 ? 5 : experience >= 105 ? 4 : experience >= 55 ? 3 : experience >= 20 ? 2 : 1; }
export function beastLevelProgress(experience: number) { const thresholds = [0, 20, 55, 105, 170, 260]; const level = beastLevel(experience); const start = thresholds[level - 1]; const end = thresholds[level]; return { level, current: experience - start, needed: end - start, percent: Math.min(100, (experience - start) / (end - start) * 100) }; }

export function buySpiritBeast(progress: LivestockProgress, speciesId: SpiritBeastId, day: number, farmLevel: number) {
  const definition = spiritBeastById(speciesId)!;
  if (farmLevel < definition.unlockLevel) return { progress, ok: false as const, message: `灵圃达到 ${definition.unlockLevel} 阶后方可饲养${definition.name}` };
  if (progress.animals.length >= livestockCapacity(farmLevel)) return { progress, ok: false as const, message: "灵兽苑容量已满，请提升灵圃等阶或出售灵兽" };
  const serial = progress.serial + 1;
  const animal: SpiritBeast = { uid: `spirit-beast-${serial}`, speciesId, experience: 0, createdDay: day, lastFedDay: 0, readyDay: 0, lastLovedDay: 0, mood: "idle" };
  return { progress: { ...progress, serial, animals: [...progress.animals, animal] }, ok: true as const, message: `${definition.name}已入住${definition.role}` };
}

export function feedSpiritBeast(progress: LivestockProgress, uid: string, day: number) {
  const animal = progress.animals.find((entry) => entry.uid === uid);
  if (!animal) return { progress, ok: false as const, message: "没有找到这只灵兽" };
  if (animal.lastFedDay === day) return { progress, ok: false as const, message: "今日已经喂养，灵兽正在吐纳休息" };
  if (animal.readyDay > 0 && animal.readyDay <= day) return { progress, ok: false as const, message: "请先收取产物，再开始下一轮喂养" };
  return { progress: { ...progress, animals: progress.animals.map((entry) => entry.uid === uid ? { ...entry, lastFedDay: day, readyDay: day + 1, experience: entry.experience + 12, mood: "fed" as const } : entry) }, ok: true as const, message: "喂养完成 · 明日可收取产物" };
}

export function loveSpiritBeast(progress: LivestockProgress, uid: string, day: number) {
  const animal = progress.animals.find((entry) => entry.uid === uid);
  if (!animal) return { progress, ok: false as const, message: "没有找到这只灵兽" };
  if (animal.lastFedDay !== day) return { progress, ok: false as const, message: "先喂养再抚灵，灵兽才会亲近你" };
  if (animal.lastLovedDay === day) return { progress, ok: false as const, message: "今日已经抚灵，它正安静依偎在栏边" };
  return { progress: { ...progress, animals: progress.animals.map((entry) => entry.uid === uid ? { ...entry, lastLovedDay: day, experience: entry.experience + 8, mood: "happy" as const } : entry) }, ok: true as const, message: "抚灵成功 · 亲和成长，明日产量提升" };
}

export function collectSpiritBeast(progress: LivestockProgress, uid: string, day: number) {
  const animal = progress.animals.find((entry) => entry.uid === uid);
  if (!animal || animal.readyDay <= 0 || animal.readyDay > day) return { progress, ok: false as const, message: "产物尚未凝成" };
  const definition = spiritBeastById(animal.speciesId)!;
  const level = beastLevel(animal.experience);
  const amount = 1 + Math.floor((level - 1) / 2) + (animal.mood === "happy" ? 1 : 0);
  return { progress: { ...progress, totalCollected: progress.totalCollected + amount, animals: progress.animals.map((entry) => entry.uid === uid ? { ...entry, readyDay: 0, mood: "idle" as const, experience: entry.experience + amount * 3 } : entry) }, ok: true as const, message: `收取${definition.productName} ×${amount}`, reward: { itemId: definition.productId, itemType: "material" as const, rarity: definition.productRarity, amount, sourceTags: ["云岫灵圃", "灵兽苑"] } };
}

export function sellSpiritBeast(progress: LivestockProgress, uid: string) {
  const animal = progress.animals.find((entry) => entry.uid === uid);
  if (!animal) return { progress, ok: false as const, message: "没有找到这只灵兽", gain: 0 };
  const definition = spiritBeastById(animal.speciesId)!;
  const gain = Math.floor(definition.price * .55 + beastLevel(animal.experience) * 28);
  return { progress: { ...progress, animals: progress.animals.filter((entry) => entry.uid !== uid) }, ok: true as const, message: `${definition.name}已托付给附近仙庄`, gain };
}
