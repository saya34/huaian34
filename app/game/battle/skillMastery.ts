import { MANUALS } from "../skills/manual-service";

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
  name: string;
  evolutionName: string;
  school: "剑诀" | "器术" | "刀法" | "灵咒" | "护法" | "御灵" | "阵法";
  element: string;
  verse: string;
  role: string;
  description: string;
  rarity: "common" | "fine" | "rare" | "epic" | "immortal";
  source: string;
  art: string;
  starter?: boolean;
  unlockLevel?: number;
  unlockWave?: number;
}

export const SKILL_MANUALS: SkillManualDefinition[] = MANUALS;

const STARTER_SKILLS = new Set(SKILL_MANUALS.filter((manual) => manual.starter).map((manual) => manual.baseId));

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
  if (manual.unlockLevel === undefined && manual.unlockWave === undefined) return false;
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
