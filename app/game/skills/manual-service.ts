import manualContent from "./content/manuals.json";
import type { SkillManualDefinition } from "../battle/skillMastery";

type ManualContent = { catalogTitle: string; catalogSubtitle: string; manuals: SkillManualDefinition[] };
const CONTENT = manualContent as ManualContent;

export const MANUAL_COPY = { title: CONTENT.catalogTitle, subtitle: CONTENT.catalogSubtitle } as const;
export const MANUALS = CONTENT.manuals;

export const MANUAL_RARITY_NAMES = {
  common: "凡品",
  fine: "良品",
  rare: "珍品",
  epic: "绝品",
  immortal: "仙品",
} as const;

export function manualById(id: number) {
  return MANUALS.find((manual) => manual.baseId === id) ?? MANUALS[0];
}
