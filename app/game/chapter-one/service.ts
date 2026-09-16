import content from "./content.json";
import { inventoryCount } from "../core/item-query";
import type { GameEffect, UnifiedGameState, UnifiedItemType, UnifiedRarity } from "../core/types";

type OutcomeBonus = {
  type: "currency" | "experience" | "relationship" | "item";
  amount: number;
  label: string;
  characterId?: string;
  itemId?: string;
  itemType?: UnifiedItemType;
  rarity?: UnifiedRarity;
};

type OutcomeConfig = {
  id: string;
  minimumScore: number;
  eyebrow: string;
  title: string;
  body: string;
  nextHook: string;
  bonus: OutcomeBonus[];
};

export type ChapterOneOutcome = OutcomeConfig & {
  score: number;
  routeId: "production" | "relationship" | "battle" | "none";
  routeName: string;
  routeReflection: string;
  signals: Array<{ id: string; met: boolean; label: string }>;
};

export function chapterOneReadiness(state: UnifiedGameState) {
  const relationship = state.romance.relationships[content.signals.relationshipCharacterId] ?? 0;
  const pillCount = inventoryCount(state.shared.items, { itemType: "pill" });
  const signals = [
    { id: "relationship", met: relationship >= content.signals.relationshipTarget, label: `沈清霜缘分 ${relationship}/${content.signals.relationshipTarget}` },
    { id: "level", met: state.shared.playerLevel >= content.signals.levelTarget, label: `修士境界 ${state.shared.playerLevel}/${content.signals.levelTarget}` },
    { id: "pill", met: pillCount >= content.signals.pillTarget, label: `随身丹药 ${Math.min(pillCount, content.signals.pillTarget)}/${content.signals.pillTarget}` },
    { id: "project", met: state.romance.medicineShortage.status === "completed", label: `药路危机 ${state.romance.medicineShortage.status === "completed" ? "已解决" : "未解决"}` },
  ];
  return { score: signals.filter((signal) => signal.met).length, signals };
}

export function resolveChapterOneOutcome(state: UnifiedGameState): ChapterOneOutcome {
  const readiness = chapterOneReadiness(state);
  const orderedOutcomes = ([...content.outcomes] as OutcomeConfig[]).sort((a, b) => b.minimumScore - a.minimumScore);
  const fallback = orderedOutcomes[orderedOutcomes.length - 1];
  const outcome = orderedOutcomes.find((entry) => readiness.score >= entry.minimumScore) ?? fallback;
  const routeId = state.romance.medicineShortage.route ?? "none";
  return {
    ...outcome,
    ...readiness,
    routeId,
    routeName: content.routeNames[routeId],
    routeReflection: content.routeReflections[routeId],
  };
}

export function chapterOneOutcomeEffects(outcome: ChapterOneOutcome): GameEffect[] {
  const effects: GameEffect[] = [
    { type: "set_global_key", key: "chapter_one_complete", value: true },
    { type: "set_global_key", key: `chapter_one_outcome:${outcome.id}`, value: true },
    { type: "set_global_key", key: `chapter_one_route:${outcome.routeId}`, value: true },
  ];
  for (const reward of outcome.bonus) {
    if (reward.type === "currency") effects.push({ type: "add_currency", amount: reward.amount });
    else if (reward.type === "experience") effects.push({ type: "add_player_exp", amount: reward.amount });
    else if (reward.type === "relationship" && reward.characterId) effects.push({ type: "add_relationship", characterId: reward.characterId, amount: reward.amount });
    else if (reward.type === "item" && reward.itemId && reward.itemType && reward.rarity) effects.push({ type: "add_item", item: { itemId: reward.itemId, itemType: reward.itemType, rarity: reward.rarity, amount: reward.amount, sourceTags: ["第一章结局", outcome.id] } });
  }
  return effects;
}

export function chapterOneOutcomeRewardLabels(outcome: ChapterOneOutcome) {
  return outcome.bonus.map((reward) => `${reward.label} ×${reward.amount}`);
}
