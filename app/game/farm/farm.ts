import { MATERIALS, type ElementType, type GameItem } from "../alchemy/item-data";
import type { Period } from "../types";
import { createInitialLivestock, normalizeLivestock, type LivestockProgress } from "./livestock";

export type HerbCropId = "frost-heart" | "jade-lingzhi" | "mystic-algae" | "dragon-nightshade" | "golden-ginseng" | "fated-flower" | "moon-snow-lotus" | "purple-lightning-vine" | "thick-earth-lotus" | "wind-hidden-bamboo" | "blood-jade-fruit" | "sunwheel-flower";

export type HerbCropDefinition = {
  id: HerbCropId;
  materialName: string;
  seedName: string;
  element: ElementType;
  growTicks: number;
  seedPrice: number;
  unlockLevel: number;
  stockType: "resident" | "random";
  bondRequired: number;
  baseYield: number;
  color: string;
  lore: string;
};

export type FertilizerId = "rapid-root" | "bounty-soil" | "five-phase";

export const FERTILIZERS: Record<FertilizerId, { name: string; icon: string; speed: number; yield: number; description: string }> = {
  "rapid-root": { name: "催生灵露", icon: "露", speed: 1, yield: 0, description: "缩短一个游戏时辰的生长时间。" },
  "bounty-soil": { name: "丰穗灵壤", icon: "壤", speed: 0, yield: 1, description: "收获时稳定增加一份产物。" },
  "five-phase": { name: "五行沃土", icon: "阵", speed: 1, yield: 1, description: "兼具催生与增产，并强化天时相合。" },
};

export const HERB_CROPS: HerbCropDefinition[] = [
  { id: "frost-heart", materialName: "霜心草", seedName: "霜心草籽", element: "水", growTicks: 1, seedPrice: 12, unlockLevel: 1, stockType: "resident", bondRequired: 0, baseYield: 1, color: "#9fd8df", lore: "晨露凝叶，最适合初学者照料。" },
  { id: "jade-lingzhi", materialName: "碧落灵芝", seedName: "碧落芝孢", element: "木", growTicks: 2, seedPrice: 22, unlockLevel: 1, stockType: "resident", bondRequired: 0, baseYield: 1, color: "#6fc28f", lore: "木灵丰沛，是回春丹的常用主材。" },
  { id: "mystic-algae", materialName: "玄水藻", seedName: "玄藻灵核", element: "水", growTicks: 3, seedPrice: 34, unlockLevel: 1, stockType: "resident", bondRequired: 5, baseYield: 2, color: "#57a9bf", lore: "需灵泉润养，成熟后可稳定炉温。" },
  { id: "dragon-nightshade", materialName: "赤霄龙葵", seedName: "龙葵火籽", element: "火", growTicks: 4, seedPrice: 52, unlockLevel: 2, stockType: "resident", bondRequired: 10, baseYield: 1, color: "#d76a50", lore: "叶脉藏火，晴暖天气下灵性最盛。" },
  { id: "golden-ginseng", materialName: "金阳参", seedName: "金阳参种", element: "金", growTicks: 5, seedPrice: 76, unlockLevel: 3, stockType: "resident", bondRequired: 20, baseYield: 1, color: "#d6ae55", lore: "吸纳日华而生，是高阶筑基丹材。" },
  { id: "fated-flower", materialName: "星命神花", seedName: "星命花种", element: "阴", growTicks: 8, seedPrice: 240, unlockLevel: 4, stockType: "resident", bondRequired: 35, baseYield: 1, color: "#b889d9", lore: "花开时命星有感，可唤醒罕见炉灵。" },
  { id: "moon-snow-lotus", materialName: "月魄雪莲", seedName: "月魄莲子", element: "水", growTicks: 4, seedPrice: 72, unlockLevel: 1, stockType: "random", bondRequired: 0, baseYield: 1, color: "#b8e8ef", lore: "仅在月相合宜时流入灵圃的寒露奇种。" },
  { id: "purple-lightning-vine", materialName: "紫电藤", seedName: "紫电藤芽", element: "阴", growTicks: 5, seedPrice: 88, unlockLevel: 2, stockType: "random", bondRequired: 0, baseYield: 1, color: "#b985e8", lore: "藤须会追逐雷息，成熟前常有紫芒游走。" },
  { id: "thick-earth-lotus", materialName: "厚土莲", seedName: "厚土莲房", element: "土", growTicks: 3, seedPrice: 50, unlockLevel: 1, stockType: "random", bondRequired: 0, baseYield: 2, color: "#d0ae72", lore: "扎根极深，可温养贫瘠灵壤。" },
  { id: "wind-hidden-bamboo", materialName: "风隐竹节", seedName: "风隐竹米", element: "木", growTicks: 4, seedPrice: 68, unlockLevel: 2, stockType: "random", bondRequired: 0, baseYield: 1, color: "#7ed0a0", lore: "无风自鸣，竹影偶会在月下隐去。" },
  { id: "blood-jade-fruit", materialName: "血玉果", seedName: "血玉果核", element: "火", growTicks: 6, seedPrice: 128, unlockLevel: 3, stockType: "random", bondRequired: 0, baseYield: 1, color: "#e26d69", lore: "果肉蕴含旺盛气血，需以火脉温养。" },
  { id: "sunwheel-flower", materialName: "日轮花", seedName: "日轮花籽", element: "火", growTicks: 7, seedPrice: 160, unlockLevel: 4, stockType: "random", bondRequired: 0, baseYield: 1, color: "#f0c05d", lore: "花冠循日而转，绽放时如小小金轮。" },
];

export type FarmPlot = {
  id: string;
  cropId?: HerbCropId;
  plantedAtTick?: number;
  watered?: boolean;
  fertilized?: boolean;
  fertilizerId?: FertilizerId;
  wateredAtDay?: number;
};

export type FarmProgress = {
  plots: FarmPlot[];
  seeds: Record<HerbCropId, number>;
  experience: number;
  totalHarvests: number;
  spiritSoil: number;
  fertilizers: Record<FertilizerId, number>;
  toolLevel: number;
  harvestSerial: number;
  lastDewDay: number;
  wellLevel: number;
  wellUpgradedDay: number;
  // Kept for save compatibility. Water is now a plot-support capacity, as in
  // Sunflower Land's well model, rather than a per-plot daily click currency.
  waterDay: number;
  waterUsed: number;
  livestock: LivestockProgress;
  npcBonds: { seed: number; ranch: number };
  npcTalkDays: { seed: number; ranch: number };
};

export type FarmWeather = {
  id: "spirit-rain" | "sun-warm" | "wood-breeze" | "star-dew";
  name: string;
  icon: string;
  description: string;
  bonusElement: ElementType;
  speedBonus: number;
};

const WEATHER: FarmWeather[] = [
  { id: "wood-breeze", name: "青木和风", icon: "风", description: "木性仙草收获时额外丰产。", bonusElement: "木", speedBonus: 0 },
  { id: "spirit-rain", name: "灵雨润畦", icon: "雨", description: "本日灵泉充盈，所有作物生长加快。", bonusElement: "水", speedBonus: 1 },
  { id: "sun-warm", name: "金乌晴暖", icon: "晴", description: "火性与金性仙草更易丰收。", bonusElement: "火", speedBonus: 0 },
  { id: "star-dew", name: "星辉凝露", icon: "星", description: "阴性仙草灵变概率提高。", bonusElement: "阴", speedBonus: 0 },
];

export const FARM_PLOT_COUNT = 12;
export const DAILY_WATER_CHARGES = 6;

export function createInitialFarm(): FarmProgress {
  return {
    plots: Array.from({ length: FARM_PLOT_COUNT }, (_, index) => ({ id: `plot-${index + 1}` })),
    seeds: Object.fromEntries(HERB_CROPS.map((crop) => [crop.id, crop.id === "frost-heart" ? 4 : crop.id === "jade-lingzhi" ? 3 : crop.id === "mystic-algae" ? 2 : 0])) as Record<HerbCropId, number>,
    experience: 0,
    totalHarvests: 0,
    spiritSoil: 2,
    fertilizers: { "rapid-root": 2, "bounty-soil": 1, "five-phase": 0 },
    toolLevel: 1,
    harvestSerial: 0,
    lastDewDay: 0,
    wellLevel: 1,
    wellUpgradedDay: 0,
    waterDay: 1,
    waterUsed: 0,
    livestock: createInitialLivestock(),
    npcBonds: { seed: 0, ranch: 0 },
    npcTalkDays: { seed: 0, ranch: 0 },
  };
}

export function normalizeFarmProgress(value: Partial<FarmProgress> | null | undefined): FarmProgress {
  const base = createInitialFarm();
  const storedPlots = Array.isArray(value?.plots) ? value.plots : [];
  return {
    ...base,
    ...value,
    plots: base.plots.map((plot) => ({ ...plot, ...(storedPlots.find((entry) => entry?.id === plot.id) ?? {}) })),
    seeds: { ...base.seeds, ...(value?.seeds ?? {}) },
    fertilizers: { ...base.fertilizers, ...(value?.fertilizers ?? {}) },
    livestock: normalizeLivestock(value?.livestock),
    npcBonds: { ...base.npcBonds, ...(value?.npcBonds ?? {}) },
    npcTalkDays: { ...base.npcTalkDays, ...(value?.npcTalkDays ?? {}) },
  };
}

export function halfMonthCycle(day: number) { return Math.floor((Math.max(1, day) - 1) / 15); }
export function nextHalfMonthDay(day: number) { return (halfMonthCycle(day) + 1) * 15 + 1; }

function seededOrder(seed: number, id: string) {
  let value = seed * 1103515245 + 12345;
  for (const char of id) value = (value ^ char.charCodeAt(0)) * 16777619;
  return Math.abs(value % 100000);
}

export function rotatingHerbStock(day: number) {
  const cycle = halfMonthCycle(day);
  return HERB_CROPS.filter((crop) => crop.stockType === "random").sort((a, b) => seededOrder(cycle + 19, a.id) - seededOrder(cycle + 19, b.id)).slice(0, 3);
}

export function farmLevel(experience: number) {
  if (experience >= 180) return 4;
  if (experience >= 80) return 3;
  if (experience >= 28) return 2;
  return 1;
}

export function farmLevelProgress(experience: number) {
  const thresholds = [0, 28, 80, 180, 320];
  const level = farmLevel(experience);
  const start = thresholds[level - 1];
  const end = thresholds[level];
  return { level, current: experience - start, needed: end - start, percentage: Math.min(100, ((experience - start) / (end - start)) * 100) };
}

export function unlockedPlotCount(level: number) {
  return Math.min(FARM_PLOT_COUNT, 6 + level * 2);
}

export function supportedPlotCount(wellLevel: number) {
  return Math.min(FARM_PLOT_COUNT, 6 + Math.max(1, wellLevel) * 2);
}

export function upgradeSpiritWell(farm: FarmProgress, day: number) {
  if (farm.wellLevel >= 3) return { farm, ok: false as const, message: "灵泉井已升至最高阶" };
  if (farm.wellUpgradedDay === day) return { farm, ok: false as const, message: "今日刚刚疏浚过灵泉，明日再继续" };
  const nextLevel = farm.wellLevel + 1;
  return { farm: { ...farm, wellLevel: nextLevel, wellUpgradedDay: day }, ok: true as const, message: `灵泉升至 ${nextLevel} 阶，可润养 ${supportedPlotCount(nextLevel)} 畦灵田` };
}

export function gameTick(day: number, period: Period) {
  const periods: Period[] = ["清晨", "黄昏", "夜晚"];
  return (Math.max(1, day) - 1) * periods.length + Math.max(0, periods.indexOf(period));
}

export function getFarmWeather(day: number) {
  return WEATHER[(Math.max(1, day) - 1) % WEATHER.length];
}

export function getFarmEvent(day: number) {
  if (day > 2 && day % 11 === 0) return { id: "frost" as const, name: "寒潮侵畦", icon: "霜", description: "未浇灌的仙草生长延缓一个时辰。" };
  if (day > 2 && day % 7 === 0) return { id: "spirit-surge" as const, name: "灵潮漫圃", icon: "潮", description: "成熟仙草更容易触发丰收。" };
  return { id: "calm" as const, name: "灵脉安稳", icon: "和", description: "今日灵圃运转平稳。" };
}

export function cropById(id: HerbCropId) {
  return HERB_CROPS.find((crop) => crop.id === id)!;
}

export function cropMaterial(crop: HerbCropDefinition): GameItem {
  const material = MATERIALS.find((item) => item.name === crop.materialName);
  if (!material) throw new Error(`Missing alchemy material for farm crop: ${crop.materialName}`);
  return material;
}

export function plotGrowth(plot: FarmPlot, currentTick: number, weather: FarmWeather) {
  if (!plot.cropId || plot.plantedAtTick === undefined) return { progress: 0, ready: false, remaining: 0, elapsed: 0, required: 0 };
  const crop = cropById(plot.cropId);
  const fertilizer = plot.fertilizerId ? FERTILIZERS[plot.fertilizerId] : null;
  const day = Math.floor(currentTick / 3) + 1;
  const event = getFarmEvent(day);
  const coldDelay = event.id === "frost" && plot.wateredAtDay !== day ? 1 : 0;
  const required = Math.max(1, crop.growTicks - (fertilizer?.speed ?? (plot.fertilized ? 1 : 0)) - weather.speedBonus - (plot.watered ? 1 : 0) + coldDelay);
  const elapsed = Math.max(0, currentTick - plot.plantedAtTick);
  return { progress: Math.min(100, (elapsed / required) * 100), ready: elapsed >= required, remaining: Math.max(0, required - elapsed), elapsed, required };
}

export function plantPlot(farm: FarmProgress, plotId: string, cropId: HerbCropId, currentTick: number) {
  const crop = cropById(cropId);
  if (farmLevel(farm.experience) < crop.unlockLevel) return { farm, ok: false, message: `灵圃达到 ${crop.unlockLevel} 阶后方可培育${crop.materialName}` };
  if ((farm.seeds[cropId] ?? 0) < 1) return { farm, ok: false, message: `${crop.seedName}不足` };
  const index = farm.plots.findIndex((plot) => plot.id === plotId);
  if (index < 0 || farm.plots[index].cropId) return { farm, ok: false, message: "这块灵田已经有作物" };
  if (index >= unlockedPlotCount(farmLevel(farm.experience))) return { farm, ok: false, message: "这块灵田尚未解锁" };
  if (index >= supportedPlotCount(farm.wellLevel)) return { farm, ok: false, message: "灵泉井的润养范围尚未覆盖这块田" };
  const previous = farm.plots[index];
  return {
    ok: true,
    message: `种下${crop.seedName}`,
    farm: { ...farm, seeds: { ...farm.seeds, [cropId]: farm.seeds[cropId] - 1 }, plots: farm.plots.map((plot) => plot.id === plotId ? { id: plot.id, cropId, plantedAtTick: currentTick, fertilized: previous.fertilized, fertilizerId: previous.fertilizerId } : plot) },
  };
}

export function waterPlot(farm: FarmProgress, plotId: string, day: number) {
  const waterUsed = farm.waterDay === day ? farm.waterUsed : 0;
  if (waterUsed >= DAILY_WATER_CHARGES) return { farm, ok: false, message: "今日灵泉水已经用尽" };
  const target = farm.plots.find((plot) => plot.id === plotId);
  if (!target?.cropId || target.watered) return { farm, ok: false, message: target?.watered ? "这畦已经浇灌" : "空田无需浇灌" };
  return { ok: true, message: "灵泉浇灌完成，成熟提前且产量提升", farm: { ...farm, waterDay: day, waterUsed: waterUsed + 1, plots: farm.plots.map((plot) => plot.id === plotId ? { ...plot, watered: true, wateredAtDay: day } : plot) } };
}

export function fertilizePlot(farm: FarmProgress, plotId: string, fertilizerId: FertilizerId = "bounty-soil") {
  if ((farm.fertilizers[fertilizerId] ?? 0) < 1) return { farm, ok: false, message: `${FERTILIZERS[fertilizerId].name}不足，可向叶青禾购置或在灵圃炼制` };
  const target = farm.plots.find((plot) => plot.id === plotId);
  if (!target || target.fertilized) return { farm, ok: false, message: target?.fertilized ? "这畦已经施过灵壤" : "没有找到这块灵田" };
  const fertilizer = FERTILIZERS[fertilizerId];
  return { ok: true, message: target.cropId ? `${fertilizer.name}已融入根系` : `${fertilizer.name}已翻入空田，下次播种立即生效`, farm: { ...farm, spiritSoil: Math.max(0, farm.spiritSoil - (fertilizerId === "bounty-soil" ? 1 : 0)), fertilizers: { ...farm.fertilizers, [fertilizerId]: farm.fertilizers[fertilizerId] - 1 }, plots: farm.plots.map((plot) => plot.id === plotId ? { ...plot, fertilized: true, fertilizerId } : plot) } };
}

export function harvestPlot(farm: FarmProgress, plotId: string, currentTick: number, day: number) {
  const plot = farm.plots.find((entry) => entry.id === plotId);
  if (!plot?.cropId || plot.plantedAtTick === undefined) return { farm, ok: false as const, message: "这块田还没有作物" };
  const crop = cropById(plot.cropId);
  const weather = getFarmWeather(day);
  if (!plotGrowth(plot, currentTick, weather).ready) return { farm, ok: false as const, message: "仙草尚未成熟" };
  const material = cropMaterial(crop);
  const elementFavored = weather.bonusElement === crop.element || (weather.id === "sun-warm" && crop.element === "金");
  const fertilizer = plot.fertilizerId ? FERTILIZERS[plot.fertilizerId] : null;
  const event = getFarmEvent(day);
  const seed = `${day}:${plot.id}:${crop.id}:${farm.harvestSerial}`;
  const roll = seededOrder(day + farm.harvestSerial, seed) / 100000;
  const critChance = .08 + farm.toolLevel * .02 + (event.id === "spirit-surge" ? .12 : 0) + (plot.fertilizerId === "five-phase" ? .06 : 0);
  const abundant = roll < critChance;
  const mutated = roll > .965 && (weather.bonusElement === crop.element || plot.fertilizerId === "five-phase");
  const amount = crop.baseYield + (fertilizer?.yield ?? (plot.fertilized ? 1 : 0)) + (plot.watered ? 1 : 0) + (elementFavored ? 1 : 0) + (abundant ? 1 + Math.floor(farm.toolLevel / 2) : 0) + (mutated ? 1 : 0);
  const experience = crop.growTicks * 2 + amount;
  const nextFarm: FarmProgress = {
    ...farm,
    experience: farm.experience + experience,
    totalHarvests: farm.totalHarvests + amount,
    harvestSerial: farm.harvestSerial + 1,
    plots: farm.plots.map((entry) => entry.id === plotId ? { id: entry.id } : entry),
  };
  return {
    farm: nextFarm,
    ok: true as const,
    message: `${abundant ? "丰收灵光 · " : ""}${mutated ? "灵变异株 · " : ""}收获${material.name} ×${amount}`,
    reward: { itemId: material.id, itemType: "material" as const, rarity: Math.max(1, Math.min(7, material.rarity)) as 1 | 2 | 3 | 4 | 5 | 6 | 7, amount, sourceTags: ["灵圃", "种植"] },
    experience,
    abundant,
    mutated,
  };
}

export function craftFertilizer(farm: FarmProgress, id: FertilizerId) {
  const cost = id === "five-phase" ? 3 : 2;
  if (farm.spiritSoil < cost) return { farm, ok: false as const, message: `炼制${FERTILIZERS[id].name}需要 ${cost} 份原生灵壤` };
  return { farm: { ...farm, spiritSoil: farm.spiritSoil - cost, fertilizers: { ...farm.fertilizers, [id]: farm.fertilizers[id] + 1 } }, ok: true as const, message: `炼成${FERTILIZERS[id].name} ×1` };
}

export function upgradeFarmTool(farm: FarmProgress) {
  if (farm.toolLevel >= 3) return { farm, ok: false as const, message: "青木灵锄已经蕴养至最高阶" };
  const toolLevel = farm.toolLevel + 1;
  return { farm: { ...farm, toolLevel }, ok: true as const, message: `青木灵锄升至 ${toolLevel} 阶，丰收概率与连作效率提升` };
}
