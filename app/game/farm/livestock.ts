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
  favoriteMaterialName: string;
  feedQuantity: number;
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
  loveCount: number;
  productionCount: number;
  sick: boolean;
  interactionNeed: "pet" | "brush" | "music";
};

export type LivestockProgress = { animals: SpiritBeast[]; totalCollected: number; serial: number; shelterLevel: number };

export const SPIRIT_BEASTS: SpiritBeastDefinition[] = [
  { id: "moonfeather-hen", name: "月翎灵雉", role: "灵禽栏", icon: "雉", price: 180, unlockLevel: 1, stockType: "resident", bondRequired: 0, feedMaterialName: "霜心草", favoriteMaterialName: "玄水藻", feedQuantity: 1, productId: "moonfeather-egg", productName: "月翎灵卵", productDescription: "月翎灵雉凝成的温润灵卵，可交易，也适合制成恢复灵膳。", productArt: "/assets/items/item-05.webp", productValue: 72, productRarity: 2, productionTicks: 2 },
  { id: "cloudwool-sheep", name: "云绒灵羊", role: "灵兽棚", icon: "羊", price: 320, unlockLevel: 2, stockType: "resident", bondRequired: 8, feedMaterialName: "碧落灵芝", favoriteMaterialName: "金阳参", feedQuantity: 3, productId: "cloud-spirit-wool", productName: "云灵绒", productDescription: "触感如云的灵绒，是制作护身法衣的上好辅材。", productArt: "/assets/items/item-37.webp", productValue: 138, productRarity: 3, productionTicks: 3 },
  { id: "jade-antler-deer", name: "青玉灵豚", role: "灵兽棚", icon: "豚", price: 460, unlockLevel: 3, stockType: "resident", bondRequired: 18, feedMaterialName: "金阳参", favoriteMaterialName: "星命神花", feedQuantity: 5, productId: "jade-deer-dew", productName: "玉髓香露", productDescription: "灵豚吐纳地气凝成的玉色香露，蕴含温和生机。", productArt: "/assets/items/item-28.webp", productValue: 236, productRarity: 4, productionTicks: 4 },
  { id: "jade-frog", name: "沧露灵蛙", role: "莲池", icon: "蛙", price: 260, unlockLevel: 1, stockType: "random", bondRequired: 0, feedMaterialName: "玄水藻", favoriteMaterialName: "霜心草", feedQuantity: 1, productId: "azure-dew-pearl", productName: "沧露蛙珠", productDescription: "灵蛙吐纳月露凝成的水珠，触手清凉。", productArt: "/assets/items/item-19.webp", productValue: 116, productRarity: 3, productionTicks: 3 },
  { id: "spirit-moth", name: "梦粉灵蛾", role: "花廊", icon: "蛾", price: 380, unlockLevel: 2, stockType: "random", bondRequired: 0, feedMaterialName: "碧落灵芝", favoriteMaterialName: "星命神花", feedQuantity: 1, productId: "dream-moth-dust", productName: "幻梦鳞粉", productDescription: "翅上落下的幻粉，可安神亦可入幻丹。", productArt: "/assets/items/item-30.webp", productValue: 184, productRarity: 4, productionTicks: 4 },
  { id: "cloud-hairball", name: "云团灵狸", role: "暖棚", icon: "狸", price: 520, unlockLevel: 3, stockType: "random", bondRequired: 0, feedMaterialName: "霜心草", favoriteMaterialName: "赤霄龙葵", feedQuantity: 2, productId: "cloud-core-fleece", productName: "云绒芯", productDescription: "灵狸换下的柔软绒芯，天然蕴含护体罡气。", productArt: "/assets/items/item-36.webp", productValue: 268, productRarity: 4, productionTicks: 5 },
];

export function rotatingBeastStock(day: number) {
  const cycle = Math.floor((Math.max(1, day) - 1) / 15);
  const score = (id: string) => { let value = cycle * 2654435761; for (const char of id) value = (value ^ char.charCodeAt(0)) * 16777619; return Math.abs(value % 100000); };
  return SPIRIT_BEASTS.filter((beast) => beast.stockType === "random").sort((a, b) => score(a.id) - score(b.id)).slice(0, 2);
}

export const spiritBeastById = (id: string) => SPIRIT_BEASTS.find((beast) => beast.id === id);
export const livestockProductById = (id: string) => SPIRIT_BEASTS.find((beast) => beast.productId === id);
export const feedMaterialFor = (speciesId: SpiritBeastId) => MATERIALS.find((item) => item.name === spiritBeastById(speciesId)?.feedMaterialName)!;
export const favoriteFeedFor = (speciesId: SpiritBeastId) => MATERIALS.find((item) => item.name === spiritBeastById(speciesId)?.favoriteMaterialName)!;

export function createInitialLivestock(): LivestockProgress { return { animals: [], totalCollected: 0, serial: 0, shelterLevel: 1 }; }
export function normalizeLivestock(value?: Partial<LivestockProgress> | null): LivestockProgress { const base = createInitialLivestock(); return { ...base, ...value, animals: Array.isArray(value?.animals) ? value.animals.map((animal) => ({ ...animal, state: animal.state ?? (animal.readyDay > 0 ? "sleeping" : "idle"), asleepAtTick: animal.asleepAtTick ?? 0, readyAtTick: animal.readyAtTick ?? (animal.readyDay > 0 ? Math.max(1, (animal.readyDay - 1) * 3) : 0), lovedAtTick: animal.lovedAtTick ?? 0, loveCount: animal.loveCount ?? (animal.lovedAtTick ? 1 : 0), productionCount: animal.productionCount ?? 0, sick: animal.sick ?? false, interactionNeed: animal.interactionNeed ?? "pet" })) : [] }; }
export function livestockCapacity(farmLevel: number, shelterLevel = 1) { return Math.min(12, 1 + farmLevel + Math.max(1, shelterLevel) * 2); }
export function experienceForBeastLevel(level: number) { return Math.max(0, (level - 1) * level * 14); }
export function beastLevel(experience: number) { let level = 1; while (level < 15 && experience >= experienceForBeastLevel(level + 1)) level += 1; return level; }
export function beastLevelProgress(experience: number) { const level = beastLevel(experience); const start = experienceForBeastLevel(level); const end = level >= 15 ? start : experienceForBeastLevel(level + 1); return { level, current: Math.max(0, experience - start), needed: level >= 15 ? 0 : end - start, percent: level >= 15 ? 100 : Math.min(100, (experience - start) / (end - start) * 100) }; }

export function buySpiritBeast(progress: LivestockProgress, speciesId: SpiritBeastId, currentTick: number, farmLevel: number) {
  const definition = spiritBeastById(speciesId)!;
  if (farmLevel < definition.unlockLevel) return { progress, ok: false as const, message: `灵圃达到 ${definition.unlockLevel} 阶后方可饲养${definition.name}` };
  if (progress.animals.length >= livestockCapacity(farmLevel, progress.shelterLevel)) return { progress, ok: false as const, message: "灵兽苑容量已满，请提升栏舍或出售灵兽" };
  const serial = progress.serial + 1;
  const animal: SpiritBeast = { uid: `spirit-beast-${serial}`, speciesId, experience: 0, createdDay: Math.floor(currentTick / 3) + 1, lastFedDay: 0, readyDay: 0, lastLovedDay: 0, mood: "idle", state: "idle", asleepAtTick: 0, readyAtTick: 0, lovedAtTick: 0, loveCount: 0, productionCount: 0, sick: false, interactionNeed: "pet" };
  return { progress: { ...progress, serial, animals: [...progress.animals, animal] }, ok: true as const, message: `${definition.name}已入住${definition.role}` };
}

export function syncLivestock(progress: LivestockProgress, currentTick: number): LivestockProgress {
  return { ...progress, animals: progress.animals.map((animal) => animal.state === "sleeping" && animal.readyAtTick <= currentTick ? { ...animal, state: "ready" as const } : animal) };
}

export function feedSpiritBeast(progress: LivestockProgress, uid: string, currentTick: number, favorite = false) {
  const animal = progress.animals.find((entry) => entry.uid === uid);
  if (!animal) return { progress, ok: false as const, message: "没有找到这只灵兽" };
  if (animal.state !== "idle") return { progress, ok: false as const, message: animal.state === "ready" ? "请先唤醒并收取产物" : "灵兽已经饱食，正在睡眠生产" };
  if (animal.sick) return { progress, ok: false as const, message: "灵兽染恙，需要先请宁绾秋施药诊治" };
  const definition = spiritBeastById(animal.speciesId)!;
  const readyAtTick = currentTick + definition.productionTicks;
  const day = Math.floor(currentTick / 3) + 1;
  const interactionNeed = (["pet", "brush", "music"] as const)[(animal.productionCount + definition.productionTicks) % 3];
  return { progress: { ...progress, animals: progress.animals.map((entry) => entry.uid === uid ? { ...entry, lastFedDay: day, readyDay: Math.floor(readyAtTick / 3) + 1, asleepAtTick: currentTick, readyAtTick, lovedAtTick: 0, loveCount: 0, interactionNeed, state: "sleeping" as const, experience: entry.experience + (favorite ? 20 : 12), mood: favorite ? "happy" as const : "fed" as const } : entry) }, ok: true as const, requiredQuantity: favorite ? 1 : definition.feedQuantity, materialName: favorite ? definition.favoriteMaterialName : definition.feedMaterialName, message: `${favorite ? "喜食投喂 · " : "喂养完成 · "}${definition.productionTicks} 个游戏时辰后凝成产物` };
}

export function loveSpiritBeast(progress: LivestockProgress, uid: string, currentTick: number, tool: "pet" | "brush" | "music" = "pet") {
  const animal = progress.animals.find((entry) => entry.uid === uid);
  if (!animal) return { progress, ok: false as const, message: "没有找到这只灵兽" };
  if (animal.state !== "sleeping") return { progress, ok: false as const, message: "抚灵只在灵兽睡眠生产期间开放" };
  if (currentTick <= animal.asleepAtTick) return { progress, ok: false as const, message: "灵兽刚刚入睡，下一时辰再来照料" };
  if (animal.loveCount >= 2) return { progress, ok: false as const, message: "本轮生产已经完成两次亲和照料" };
  if (animal.lovedAtTick === currentTick) return { progress, ok: false as const, message: "这个时辰已经照料过它" };
  if (tool !== animal.interactionNeed) return { progress, ok: false as const, message: `它此刻更需要${animal.interactionNeed === "brush" ? "梳理毛羽" : animal.interactionNeed === "music" ? "听一段安神曲" : "轻轻抚摸"}` };
  const day = Math.floor(currentTick / 3) + 1;
  return { progress: { ...progress, animals: progress.animals.map((entry) => entry.uid === uid ? { ...entry, lastLovedDay: day, lovedAtTick: currentTick, loveCount: entry.loveCount + 1, interactionNeed: (["pet", "brush", "music"] as const)[(["pet", "brush", "music"] as const).indexOf(entry.interactionNeed) === 2 ? 0 : (["pet", "brush", "music"] as const).indexOf(entry.interactionNeed) + 1], experience: entry.experience + 8, mood: "happy" as const } : entry) }, ok: true as const, message: `亲和照料成功 · 本轮 ${animal.loveCount + 1}/2` };
}

export function collectSpiritBeast(progress: LivestockProgress, uid: string, currentTick: number) {
  const animal = progress.animals.find((entry) => entry.uid === uid);
  if (!animal || animal.readyAtTick <= 0 || animal.readyAtTick > currentTick) return { progress, ok: false as const, message: "产物尚未凝成" };
  const definition = spiritBeastById(animal.speciesId)!;
  const level = beastLevel(animal.experience);
  const amount = 1 + Math.floor((level - 1) / 3) + animal.loveCount + (animal.mood === "happy" ? 1 : 0);
  const becomesSick = ((animal.productionCount + definition.productionTicks + level) % 13 === 0);
  return { progress: { ...progress, totalCollected: progress.totalCollected + amount, animals: progress.animals.map((entry) => entry.uid === uid ? { ...entry, readyDay: 0, readyAtTick: 0, asleepAtTick: 0, lovedAtTick: 0, loveCount: 0, productionCount: entry.productionCount + 1, sick: becomesSick, state: "idle" as const, mood: "idle" as const, experience: entry.experience + amount * 3 } : entry) }, ok: true as const, becameSick: becomesSick, message: `唤醒灵兽 · 收取${definition.productName} ×${amount}${becomesSick ? " · 灵息略有不稳" : ""}`, reward: { itemId: definition.productId, itemType: "material" as const, rarity: definition.productRarity, amount, sourceTags: ["云岫灵圃", "灵兽苑"] } };
}

export function cureSpiritBeast(progress: LivestockProgress, uid: string) {
  const animal = progress.animals.find((entry) => entry.uid === uid);
  if (!animal?.sick) return { progress, ok: false as const, message: "这只灵兽气息安稳，无需诊治" };
  return { progress: { ...progress, animals: progress.animals.map((entry) => entry.uid === uid ? { ...entry, sick: false, mood: "happy" as const, experience: entry.experience + 5 } : entry) }, ok: true as const, message: "宁绾秋施下安灵药，灵兽恢复了精神" };
}

export function upgradeShelter(progress: LivestockProgress) {
  if (progress.shelterLevel >= 4) return { progress, ok: false as const, message: "云栖栏舍已经扩建至最高阶" };
  const shelterLevel = progress.shelterLevel + 1;
  return { progress: { ...progress, shelterLevel }, ok: true as const, message: `云栖栏舍升至 ${shelterLevel} 阶，容量与安养环境提升` };
}

export function sellSpiritBeast(progress: LivestockProgress, uid: string) {
  const animal = progress.animals.find((entry) => entry.uid === uid);
  if (!animal) return { progress, ok: false as const, message: "没有找到这只灵兽", gain: 0 };
  const definition = spiritBeastById(animal.speciesId)!;
  const gain = Math.floor(definition.price * .55 + beastLevel(animal.experience) * 28);
  return { progress: { ...progress, animals: progress.animals.filter((entry) => entry.uid !== uid) }, ok: true as const, message: `${definition.name}已托付给附近仙庄`, gain };
}
