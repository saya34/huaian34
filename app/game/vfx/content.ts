import content from "./effects-content.json";
import type { EventCardStyle, EventDefinition, OpeningEffect, Period, StoryVfxId } from "../types";

export type SceneVfxId = "sakura" | "snow" | "light-rain" | "heavy-rain" | "sun-halo" | "fog" | "falling-leaves" | "fireflies" | "embers" | "spirit-motes";
export type SceneVfxVisual = "petals" | "snow" | "light-rain" | "heavy-rain" | "sun-halo" | "fog" | "leaves" | "fireflies" | "embers" | "spirit-motes";
export type StoryVfxVisual = StoryVfxId;

export type SceneVfxDefinition = {
  id: SceneVfxId;
  name: string;
  visual: SceneVfxVisual;
  particleCount: number;
  group: string;
};

export type StoryVfxDefinition = {
  id: StoryVfxId;
  name: string;
  visual: StoryVfxVisual;
  particleCount: number;
};

type SceneRule = {
  effectId: SceneVfxId;
  priority: number;
  sceneIds?: string[];
  periods?: Period[];
  weatherIds?: string[];
  excludedWeatherIds?: string[];
  dayModulo?: { divisor: number; remainder: number };
};

type StoryRule = {
  effectId: StoryVfxId;
  priority: number;
  eventTypes?: EventDefinition["type"][];
  cardStyles?: EventCardStyle[];
  openingEffects?: OpeningEffect[];
  characterIds?: string[];
};

type VfxContent = {
  sceneEffects: SceneVfxDefinition[];
  storyEffects: StoryVfxDefinition[];
  sceneRules: SceneRule[];
  storyRules: StoryRule[];
};

export const VFX_CONTENT = content as VfxContent;
export const SCENE_VFX = Object.fromEntries(VFX_CONTENT.sceneEffects.map((effect) => [effect.id, effect])) as Record<SceneVfxId, SceneVfxDefinition>;
export const STORY_VFX = Object.fromEntries(VFX_CONTENT.storyEffects.map((effect) => [effect.id, effect])) as Record<StoryVfxId, StoryVfxDefinition>;

export function sceneVfxFor(context: { sceneId: string; period: Period; day: number; weatherId: string }) {
  const groups = new Set<string>();
  const selected: SceneVfxDefinition[] = [];
  const matching = VFX_CONTENT.sceneRules
    .filter((rule) => !rule.sceneIds || rule.sceneIds.includes(context.sceneId))
    .filter((rule) => !rule.periods || rule.periods.includes(context.period))
    .filter((rule) => !rule.weatherIds || rule.weatherIds.includes(context.weatherId))
    .filter((rule) => !rule.excludedWeatherIds?.includes(context.weatherId))
    .filter((rule) => !rule.dayModulo || context.day % rule.dayModulo.divisor === rule.dayModulo.remainder)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of matching) {
    const effect = SCENE_VFX[rule.effectId];
    if (!effect || groups.has(effect.group)) continue;
    groups.add(effect.group);
    selected.push(effect);
    if (selected.length === 2) break;
  }
  return selected;
}

export function storyVfxFor(event: EventDefinition | null, explicit?: StoryVfxId) {
  if (explicit) return STORY_VFX[explicit];
  if (!event) return null;
  const match = VFX_CONTENT.storyRules
    .filter((rule) => !rule.eventTypes || rule.eventTypes.includes(event.type))
    .filter((rule) => !rule.cardStyles || rule.cardStyles.includes(event.cardStyle ?? "normal"))
    .filter((rule) => !rule.openingEffects || rule.openingEffects.includes(event.openingEffect ?? "none"))
    .filter((rule) => !rule.characterIds || rule.characterIds.includes(event.characterId))
    .sort((a, b) => b.priority - a.priority)[0];
  return match ? STORY_VFX[match.effectId] : null;
}
