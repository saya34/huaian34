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

const ACTIVE_EFFECT_NAMES: Record<NonNullable<UnifiedCardInstance["activeEffect"]>, string> = {
  sword: "剑意横空",
  assault: "破阵强袭",
  healing: "青囊回春",
  ward: "护道金光",
  frost: "霜天封境",
};

export function cardAbilityName(card: UnifiedCardInstance) {
  if (card.abilityName) return card.abilityName;
  if (card.mode === "active") return card.activeEffect ? ACTIVE_EFFECT_NAMES[card.activeEffect] : "命契召唤";
  return "命格加护";
}

export function cardAbilityDescription(card: UnifiedCardInstance) {
  if (card.abilityDescription) return card.abilityDescription;
  if (card.mode === "active") return `元气圆满时进入人物卡三选一，召唤后释放「${cardAbilityName(card)}」。`;
  const bonuses = Object.entries(card.bonuses ?? {});
  return bonuses.length ? `持有即生效：${bonuses.map(([key, value]) => `${key} +${value}`).join(" · ")}。` : "持有即生效，为修士提供永久命格加护。";
}
