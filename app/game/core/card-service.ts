import type { UnifiedCardInstance } from "./types";

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
