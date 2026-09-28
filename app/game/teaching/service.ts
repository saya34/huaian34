import teachingContent from "./content/teaching-content.json";
import { getCalendarDate } from "../calendar-engine";
import { ATTRIBUTE_POINT_BONUS, type AttributeAllocation } from "../battle/progression";
import type { UnifiedGameState } from "../core/types";

export type TeachingStat = keyof AttributeAllocation;

type LessonDefinition = {
  id: string;
  name: string;
  stat: TeachingStat;
  mark: string;
  description: string;
  teacherLine: string;
  weight?: number;
};

type TeachingProfile = {
  characterId: string;
  chance: number;
  minRelationship?: number;
  weekdays?: number[];
  lessonIds: string[];
  fee?: number;
};

type TeachingContent = {
  system: {
    staminaCost: number;
    defaultInvitationChance: number;
    defaultLessons: LessonDefinition[];
    profiles: TeachingProfile[];
    specialLessons: LessonDefinition[];
  };
};

const CONTENT = teachingContent as TeachingContent;
const LESSONS = new Map([...CONTENT.system.defaultLessons, ...CONTENT.system.specialLessons].map((lesson) => [lesson.id, lesson]));
const PROFILES = new Map(CONTENT.system.profiles.map((profile) => [profile.characterId, profile]));

export type TeachingOffer = LessonDefinition & {
  characterId: string;
  day: number;
  fee: number;
  staminaCost: number;
  scheduled: boolean;
};

export type TeachingSessionResult = {
  ok: boolean;
  state: UnifiedGameState;
  message: string;
  beforePoints: number;
  afterPoints: number;
};

export const TEACHING_STAT_LABELS: Record<TeachingStat, string> = {
  health: "体魄",
  defense: "防御",
  damage: "道法",
  dodge: "身法",
  moveSpeed: "疾行",
  attackSpeed: "攻速",
};

function hash(input: string) {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function weightedDefaultLesson(characterId: string, day: number) {
  const pool = CONTENT.system.defaultLessons.flatMap((lesson) => Array.from({ length: Math.max(1, lesson.weight ?? 1) }, () => lesson));
  return pool[hash(`lesson:${characterId}:${day}`) % pool.length];
}

export function attributePointEffect(stat: TeachingStat) {
  const value = ATTRIBUTE_POINT_BONUS[stat];
  if (stat === "damage" || stat === "dodge" || stat === "attackSpeed") return `+${Math.round(value * 10000) / 100}%`;
  return `+${value}`;
}

export function teachingScheduleLabel(characterId: string) {
  const profile = PROFILES.get(characterId);
  if (!profile?.weekdays?.length) return "每日可能来邀";
  const labels = ["一", "二", "三", "四", "五", "六", "日"];
  return profile.weekdays.map((weekday) => `周${labels[weekday - 1]}`).join("、");
}

export function getDailyTeachingOffer(characterId: string, day: number, relationship: number): TeachingOffer | null {
  const profile = PROFILES.get(characterId);
  const weekday = getCalendarDate(day).weekday;
  if (profile?.minRelationship !== undefined && relationship < profile.minRelationship) return null;
  if (profile?.weekdays?.length && !profile.weekdays.includes(weekday)) return null;

  const chance = profile?.chance ?? CONTENT.system.defaultInvitationChance;
  const scheduled = Boolean(profile?.weekdays?.length);
  if (!scheduled && hash(`invite:${characterId}:${day}`) % 100 >= chance) return null;

  const configuredIds = profile?.lessonIds ?? [];
  const lesson = configuredIds.length
    ? LESSONS.get(configuredIds[hash(`profile:${characterId}:${day}`) % configuredIds.length])
    : weightedDefaultLesson(characterId, day);
  if (!lesson) return null;
  return {
    ...lesson,
    characterId,
    day,
    fee: Math.max(0, profile?.fee ?? 0),
    staminaCost: CONTENT.system.staminaCost,
    scheduled,
  };
}

export function completeTeachingSession(state: UnifiedGameState, offer: TeachingOffer): TeachingSessionResult {
  const beforePoints = state.battle.trainingAllocation[offer.stat] ?? 0;
  if (state.shared.stamina < offer.staminaCost) return { ok: false, state, message: `体力不足，需要 ${offer.staminaCost} 点体力。`, beforePoints, afterPoints: beforePoints };
  if (state.shared.spiritStones < offer.fee) return { ok: false, state, message: `灵石不足，需要 ${offer.fee} 灵石。`, beforePoints, afterPoints: beforePoints };

  const stamina = state.shared.stamina - offer.staminaCost;
  const spiritStones = state.shared.spiritStones - offer.fee;
  const trainingAllocation = { ...state.battle.trainingAllocation, [offer.stat]: beforePoints + 1 };
  const recordKey = `${offer.day}:${offer.characterId}:${offer.id}`;
  const trainingRecords = { ...state.battle.trainingRecords, [recordKey]: (state.battle.trainingRecords[recordKey] ?? 0) + 1 };
  const next: UnifiedGameState = {
    ...state,
    shared: { ...state.shared, stamina, spiritStones },
    romance: { ...state.romance, stamina, spiritStones },
    battle: { ...state.battle, spiritStones, trainingAllocation, trainingRecords },
    updatedAt: Date.now(),
  };
  return { ok: true, state: next, message: `${TEACHING_STAT_LABELS[offer.stat]}永久提升 ${attributePointEffect(offer.stat)}`, beforePoints, afterPoints: beforePoints + 1 };
}
