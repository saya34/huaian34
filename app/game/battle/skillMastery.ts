export const MAX_SKILL_MASTERY_LEVEL = 10;
export const SKILL_BOOK_EXP = 40;

export interface SkillMasteryState {
  learned: boolean;
  level: number;
  exp: number;
}

export type SkillMasteryMap = Record<string, SkillMasteryState>;

export interface SkillManualDefinition {
  baseId: number;
  evolutionId: number;
  school: "剑诀" | "器术" | "刀法" | "灵咒" | "护法" | "御灵" | "阵法";
  element: string;
  verse: string;
  unlockLevel?: number;
  unlockWave?: number;
}

export const SKILL_MANUALS: SkillManualDefinition[] = [
  { baseId: 10000, evolutionId: 10001, school: "剑诀", element: "木", verse: "桃枝引剑，一念逍遥。" },
  { baseId: 10002, evolutionId: 10003, school: "器术", element: "金", verse: "千机齐发，翎羽蔽日。" },
  { baseId: 10004, evolutionId: 10005, school: "器术", element: "风", verse: "玄弦惊月，一箭破妄。" },
  { baseId: 10006, evolutionId: 10007, school: "刀法", element: "煞", verse: "刀过无声，修罗噬魂。" },
  { baseId: 10010, evolutionId: 10011, school: "御灵", element: "风", verse: "燕返千山，百鸟归巢。" },
  { baseId: 10012, evolutionId: 10013, school: "灵咒", element: "毒", verse: "灵蛇衔雾，冥息蚀骨。" },
  { baseId: 10014, evolutionId: 10015, school: "护法", element: "光", verse: "金光护体，莲华镇邪。" },
  { baseId: 10016, evolutionId: 10017, school: "器术", element: "土", verse: "地藏不动，八方伏魔。" },
  { baseId: 10018, evolutionId: 10019, school: "灵咒", element: "火", verse: "火灵振羽，炎雀焚天。" },
  { baseId: 10037, evolutionId: 10038, school: "器术", element: "禅", verse: "行者无尘，一棍定乾坤。" },
  { baseId: 10020, evolutionId: 10021, school: "御灵", element: "冰", verse: "童子踏雪，冰凌照夜。", unlockLevel: 4, unlockWave: 2 },
  { baseId: 10008, evolutionId: 10009, school: "刀法", element: "荒", verse: "八荒俱寂，弑神一刀。", unlockLevel: 8, unlockWave: 4 },
  { baseId: 10023, evolutionId: 10022, school: "剑诀", element: "阳", verse: "天剑无邪，剑气凌霄。", unlockLevel: 10, unlockWave: 5 },
  { baseId: 10024, evolutionId: 10022, school: "剑诀", element: "阴", verse: "魔剑断魂，幽光照魄。", unlockLevel: 10, unlockWave: 5 },
  { baseId: 10025, evolutionId: 10026, school: "御灵", element: "龙", verse: "游龙出渊，伏魔万里。", unlockLevel: 14, unlockWave: 7 },
  { baseId: 10027, evolutionId: 10028, school: "阵法", element: "阴阳", verse: "两仪轮转，法盘分光。", unlockLevel: 18, unlockWave: 9 },
  { baseId: 10029, evolutionId: 10030, school: "刀法", element: "冥", verse: "幽冥护主，斩魂惊世。", unlockLevel: 22, unlockWave: 11 },
  { baseId: 10031, evolutionId: 10032, school: "灵咒", element: "雷", verse: "天雷应念，万钧伏妖。", unlockLevel: 28, unlockWave: 13 },
  { baseId: 10033, evolutionId: 10034, school: "阵法", element: "月", verse: "玄刀列阵，皎月生寒。", unlockLevel: 36, unlockWave: 16 },
  { baseId: 10035, evolutionId: 10036, school: "阵法", element: "轮回", verse: "六道流转，万法归一。", unlockLevel: 46, unlockWave: 19 },
];

const STARTER_SKILLS = new Set(SKILL_MANUALS.slice(0, 10).map((manual) => manual.baseId));

export function defaultSkillMastery(): SkillMasteryMap {
  return Object.fromEntries(SKILL_MANUALS.map((manual) => [String(manual.baseId), {
    learned: STARTER_SKILLS.has(manual.baseId),
    level: 1,
    exp: 0,
  }]));
}

export function normalizeSkillMastery(value: unknown): SkillMasteryMap {
  const source = value && typeof value === "object" ? value as Record<string, Partial<SkillMasteryState>> : {};
  const defaults = defaultSkillMastery();
  return Object.fromEntries(SKILL_MANUALS.map((manual) => {
    const key = String(manual.baseId);
    const saved = source[key];
    return [key, {
      learned: typeof saved?.learned === "boolean" ? saved.learned : defaults[key].learned,
      level: Math.max(1, Math.min(MAX_SKILL_MASTERY_LEVEL, Number(saved?.level) || 1)),
      exp: Math.max(0, Number(saved?.exp) || 0),
    }];
  }));
}

export function skillMasteryExpToNext(level: number) {
  if (level >= MAX_SKILL_MASTERY_LEVEL) return 0;
  return 80 + Math.max(0, level - 1) * 55;
}

export function skillMasteryDamageMultiplier(level: number) {
  return 1 + Math.max(0, Math.min(MAX_SKILL_MASTERY_LEVEL, level) - 1) * 0.06;
}

export function skillUnlockReady(playerLevel: number, highestUnlockedWave: number, manual: SkillManualDefinition) {
  return playerLevel >= (manual.unlockLevel ?? 1) && highestUnlockedWave >= (manual.unlockWave ?? 1);
}

export function learnedSkillIds(mastery: SkillMasteryMap) {
  return SKILL_MANUALS.filter((manual) => mastery[String(manual.baseId)]?.learned).map((manual) => manual.baseId);
}

export function skillDamageBonuses(mastery: SkillMasteryMap) {
  const bonuses: Record<number, number> = {};
  for (const manual of SKILL_MANUALS) {
    const state = mastery[String(manual.baseId)];
    if (!state?.learned) continue;
    const multiplier = skillMasteryDamageMultiplier(state.level);
    bonuses[manual.baseId] = multiplier;
    bonuses[manual.evolutionId] = Math.max(bonuses[manual.evolutionId] ?? 1, multiplier);
  }
  return bonuses;
}
