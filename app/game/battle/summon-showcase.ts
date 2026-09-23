import type { UnifiedCardInstance } from "../core/types";
import cardContent from "./content/summon-showcase-cards.json";

type ShowcaseCardContent = Omit<UnifiedCardInstance, "mode" | "source"> & {
  sourceFile: string;
  effectId: string;
};

const CONTENT = cardContent.cards as ShowcaseCardContent[];
const EFFECT_BY_CARD = new Map(CONTENT.map((card) => [card.id, card.effectId]));

export const SUMMON_SHOWCASE_CARDS: UnifiedCardInstance[] = CONTENT.map((card) => ({
  id: card.id,
  characterId: card.characterId,
  name: card.name,
  rarity: card.rarity,
  art: card.art,
  activeEffect: card.activeEffect,
  mode: "active",
  source: "dungeon",
}));

export function showcaseEffectIdForCard(cardId: string | undefined) {
  return cardId ? EFFECT_BY_CARD.get(cardId) : undefined;
}

export function mergeSummonShowcaseCards(cards: UnifiedCardInstance[]) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  for (const card of SUMMON_SHOWCASE_CARDS) byId.set(card.id, card);
  return [...byId.values()];
}

export function summonShowcaseAudit() {
  return {
    cards: CONTENT.length,
    effects: new Set(CONTENT.map((card) => card.effectId)).size,
    images: new Set(CONTENT.map((card) => card.art)).size,
  };
}
