import type { UnifiedCardInstance, UnifiedRarity } from "./types";

export const CARD_QUALITY_NAMES: Record<UnifiedRarity, string> = { 1: "凡品", 2: "良品", 3: "珍品", 4: "绝品", 5: "灵品", 6: "仙品", 7: "神品" };

export function cardQualityName(rarity: number) {
  return CARD_QUALITY_NAMES[Math.max(1, Math.min(7, Math.trunc(rarity))) as UnifiedRarity];
}

export function normalizeCardName(name: string) {
  const parts = name.split("·").map((part) => part.trim()).filter(Boolean);
  return parts.filter((part, index) => index === 0 || part !== parts[index - 1]).join("·");
}

export function canonicalCard(card: UnifiedCardInstance): UnifiedCardInstance {
  return { ...card, name: normalizeCardName(card.name) };
}

export function upsertCard(cards: UnifiedCardInstance[], incoming: UnifiedCardInstance) {
  const card = canonicalCard(incoming);
  const index = cards.findIndex((entry) => entry.id === card.id);
  if (index < 0) return [...cards, card];
  return cards.map((entry, current) => current === index ? card : entry);
}
