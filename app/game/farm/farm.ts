import { MATERIALS, type ElementType, type GameItem } from "../alchemy/item-data";
import type { Period } from "../types";

export type HerbCropId = "frost-heart" | "jade-lingzhi" | "mystic-algae" | "dragon-nightshade" | "golden-ginseng" | "fated-flower";

export type HerbCropDefinition = {
  id: HerbCropId;
  materialName: string;
  seedName: string;
  element: ElementType;
  growTicks: number;
  seedPrice: number;
  unlockLevel: number;
  baseYield: number;
  color: string;
  lore: string;
};

export const HERB_CROPS: HerbCropDefinition[] = [
  { id: "frost-heart", materialName: "霜心草", seedName: "霜心草籽", element: "水", growTicks: 1, seedPrice: 12, unlockLevel: 1, baseYield: 1, color: "#9fd8df", lore: "晨露凝叶，最适合初学者照料。" },
  { id: "jade-lingzhi", materialName: "碧落灵芝", seedName: "碧落芝孢", element: "木", growTicks: 2, seedPrice: 22, unlockLevel: 1, baseYield: 1, color: "#6fc28f", lore: "木灵丰沛，是回春丹的常用主材。" },
  { id: "mystic-algae", materialName: "玄水藻", seedName: "玄藻灵核", element: "水", growTicks: 3, seedPrice: 34, unlockLevel: 1, baseYield: 2, color: "#57a9bf", lore: "需灵泉润养，成熟后可稳定炉温。" },
  { id: "dragon-nightshade", materialName: "赤霄龙葵", seedName: "龙葵火籽", element: "火", growTicks: 4, seedPrice: 52, unlockLevel: 2, baseYield: 1, color: "#d76a50", lore: "叶脉藏火，晴暖天气下灵性最盛。" },
  { id: "golden-ginseng", materialName: "金阳参", seedName: "金阳参种", element: "金", growTicks: 5, seedPrice: 76, unlockLevel: 3, baseYield: 1, color: "#d6ae55", lore: "吸纳日华而生，是高阶筑基丹材。" },
  { id: "fated-flower", materialName: "星命神花", seedName: "星命花种", element: "阴", growTicks: 8, seedPrice: 240, unlockLevel: 4, baseYield: 1, color: "#b889d9", lore: "花开时命星有感，可唤醒罕见炉灵。" },
];

export type FarmPlot = {
  id: string;
  cropId?: HerbCropId;
  plantedAtTick?: number;
  watered?: boolean;
  fertilized?: boolean;
};

export type FarmProgress = {
  plots: FarmPlot[];
  seeds: Record<HerbCropId, number>;
  experience: number;
  totalHarvests: number;
  spiritSoil: number;
  lastDewDay: number;
  waterDay: number;
  waterUsed: number;
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
  { id: "spirit-rain", name: "灵雨润畦", icon: "雨", description: "本日所有作物视为已浇灌，生长加快。", bonusElement: "水", speedBonus: 1 },
  { id: "sun-warm", name: "金乌晴暖", icon: "晴", description: "火性与金性仙草更易丰收。", bonusElement: "火", speedBonus: 0 },
  { id: "star-dew", name: "星辉凝露", icon: "星", description: "阴性仙草灵变概率提高。", bonusElement: "阴", speedBonus: 0 },
];

export const FARM_PLOT_COUNT = 12;
export const DAILY_WATER_CHARGES = 6;

export function createInitialFarm(): FarmProgress {
  return {
    plots: Array.from({ length: FARM_PLOT_COUNT }, (_, index) => ({ id: `plot-${index + 1}` })),
    seeds: { "frost-heart": 4, "jade-lingzhi": 3, "mystic-algae": 2, "dragon-nightshade": 0, "golden-ginseng": 0, "fated-flower": 0 },
    experience: 0,
    totalHarvests: 0,
    spiritSoil: 2,
    lastDewDay: 0,
    waterDay: 1,
    waterUsed: 0,
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
  };
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

export function gameTick(day: number, period: Period) {
  const periods: Period[] = ["清晨", "黄昏", "夜晚"];
  return (Math.max(1, day) - 1) * periods.length + Math.max(0, periods.indexOf(period));
}

export function getFarmWeather(day: number) {
  return WEATHER[(Math.max(1, day) - 1) % WEATHER.length];
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
  const watered = plot.watered || weather.id === "spirit-rain";
  const required = Math.max(1, crop.growTicks - (watered ? 1 : 0) - weather.speedBonus);
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
  return {
    ok: true,
    message: `种下${crop.seedName}`,
    farm: { ...farm, seeds: { ...farm.seeds, [cropId]: farm.seeds[cropId] - 1 }, plots: farm.plots.map((plot) => plot.id === plotId ? { id: plot.id, cropId, plantedAtTick: currentTick, watered: false, fertilized: false } : plot) },
  };
}

export function waterPlot(farm: FarmProgress, plotId: string, day: number) {
  const waterUsed = farm.waterDay === day ? farm.waterUsed : 0;
  if (waterUsed >= DAILY_WATER_CHARGES) return { farm, ok: false, message: "今日灵泉水已经用尽" };
  const target = farm.plots.find((plot) => plot.id === plotId);
  if (!target?.cropId || target.watered) return { farm, ok: false, message: target?.watered ? "这畦已经浇灌" : "空田无需浇灌" };
  return { ok: true, message: "灵泉浇灌完成，成熟提前且产量提升", farm: { ...farm, waterDay: day, waterUsed: waterUsed + 1, plots: farm.plots.map((plot) => plot.id === plotId ? { ...plot, watered: true } : plot) } };
}

export function fertilizePlot(farm: FarmProgress, plotId: string) {
  if (farm.spiritSoil < 1) return { farm, ok: false, message: "灵壤不足，可每日凝露培土获得" };
  const target = farm.plots.find((plot) => plot.id === plotId);
  if (!target?.cropId || target.fertilized) return { farm, ok: false, message: target?.fertilized ? "这畦已经施过灵壤" : "请先播种" };
  return { ok: true, message: "灵壤已融入土脉，收获时额外增产", farm: { ...farm, spiritSoil: farm.spiritSoil - 1, plots: farm.plots.map((plot) => plot.id === plotId ? { ...plot, fertilized: true } : plot) } };
}

function stableRoll(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % 100;
}

export function harvestPlot(farm: FarmProgress, plotId: string, currentTick: number, day: number) {
  const plot = farm.plots.find((entry) => entry.id === plotId);
  if (!plot?.cropId || plot.plantedAtTick === undefined) return { farm, ok: false as const, message: "这块田还没有作物" };
  const crop = cropById(plot.cropId);
  const weather = getFarmWeather(day);
  if (!plotGrowth(plot, currentTick, weather).ready) return { farm, ok: false as const, message: "仙草尚未成熟" };
  const material = cropMaterial(crop);
  const elementFavored = weather.bonusElement === crop.element || (weather.id === "sun-warm" && crop.element === "金");
  const mutationChance = 12 + (plot.fertilized ? 8 : 0) + (weather.id === "star-dew" && crop.element === "阴" ? 15 : 0);
  const mutated = stableRoll(`${plot.id}:${plot.plantedAtTick}:${crop.id}:${day}`) < mutationChance;
  const amount = crop.baseYield + (plot.watered || weather.id === "spirit-rain" ? 1 : 0) + (plot.fertilized ? 1 : 0) + (elementFavored ? 1 : 0) + (mutated ? 1 : 0);
  const experience = crop.growTicks * 2 + amount;
  const nextFarm: FarmProgress = {
    ...farm,
    experience: farm.experience + experience,
    totalHarvests: farm.totalHarvests + amount,
    seeds: { ...farm.seeds, [crop.id]: farm.seeds[crop.id] + (mutated ? 1 : 0) },
    plots: farm.plots.map((entry) => entry.id === plotId ? { id: entry.id } : entry),
  };
  return {
    farm: nextFarm,
    ok: true as const,
    message: `收获${material.name} ×${amount}${mutated ? " · 灵变返种" : ""}`,
    reward: { itemId: material.id, itemType: "material" as const, rarity: Math.max(1, Math.min(7, material.rarity)) as 1 | 2 | 3 | 4 | 5 | 6 | 7, amount, sourceTags: ["灵圃", "种植"] },
    experience,
    mutated,
  };
}
