import type { GameEffect, UnifiedGameState } from "../core/types";
import { QUESTS } from "./content";
import type { QuestDefinition, QuestObjectiveDefinition, QuestProgress, QuestStatus, QuestView } from "./types";

export function createInitialQuestProgress(): QuestProgress {
  const firstMain = QUESTS.filter((quest) => quest.type === "main").sort((a, b) => a.order - b.order)[0];
  return {
    statuses: Object.fromEntries(QUESTS.map((quest) => [quest.id, quest.initialStatus])),
    trackedQuestId: firstMain?.id ?? null,
  };
}

export function isQuestOfferAvailable(definition: QuestDefinition, progress: QuestProgress) {
  if ((progress.statuses[definition.id] ?? definition.initialStatus) !== "unaccepted") return false;
  return !definition.prerequisiteQuestId || progress.statuses[definition.prerequisiteQuestId] === "claimed";
}

export function findQuestOffer(characterId: string, progress: QuestProgress) {
  return QUESTS.filter((quest) => quest.giver?.characterId === characterId && isQuestOfferAvailable(quest, progress)).sort((a, b) => a.order - b.order)[0] ?? null;
}

export function isQuestVisible(definition: QuestDefinition, progress: QuestProgress) {
  const status = progress.statuses[definition.id] ?? definition.initialStatus;
  return status !== "unaccepted" || !definition.prerequisiteQuestId || progress.statuses[definition.prerequisiteQuestId] === "claimed";
}

export function normalizeQuestProgress(value?: Partial<QuestProgress> | null): QuestProgress {
  const initial = createInitialQuestProgress();
  const statuses = { ...initial.statuses, ...(value?.statuses ?? {}) };
  const tracked = value?.trackedQuestId && QUESTS.some((quest) => quest.id === value.trackedQuestId) ? value.trackedQuestId : initial.trackedQuestId;
  return { statuses, trackedQuestId: tracked };
}

export function readObjectiveCurrent(objective: QuestObjectiveDefinition, state: UnifiedGameState) {
  if (objective.target === "alchemy:any-product") return Object.values(state.alchemy.productStacks).reduce((sum, stack) => sum + Math.max(0, stack.count), 0);
  if (objective.target === "dungeon:any-completed") return state.dungeons.completed.length;
  if (objective.target === "path:medicine-shortage-completed") return state.romance.medicineShortage.status === "completed" ? 1 : 0;
  if (objective.target.startsWith("item:")) return state.shared.items[objective.target.slice(5)]?.amount ?? 0;
  if (objective.target === "currency:spirit-stones") return state.shared.spiritStones;
  if (objective.target.startsWith("relationship:")) return state.romance.relationships[objective.target.slice(13)] ?? 0;
  if (objective.target.startsWith("story:")) return state.romance.completedEvents.includes(objective.target.slice(6)) ? 1 : 0;
  if (objective.target === "farm:harvests") return state.farm.totalHarvests;
  return 0;
}

export function questView(definition: QuestDefinition, progress: QuestProgress, state: UnifiedGameState): QuestView {
  const objectives = definition.objectives.map((objective) => {
    const current = Math.min(objective.required, readObjectiveCurrent(objective, state));
    return { ...objective, current, done: current >= objective.required };
  });
  const stored = progress.statuses[definition.id] ?? definition.initialStatus;
  const complete = objectives.every((objective) => objective.done);
  const status: QuestStatus = stored === "in_progress" && complete ? "claimable" : stored;
  return { definition, status, objectives, complete, tracked: progress.trackedQuestId === definition.id };
}

export function synchronizeQuestProgress(progress: QuestProgress, state: UnifiedGameState): QuestProgress {
  let changed = false;
  const statuses = { ...progress.statuses };
  for (const definition of QUESTS) {
    if (statuses[definition.id] !== "in_progress") continue;
    if (!questView(definition, progress, state).complete) continue;
    statuses[definition.id] = "claimable";
    changed = true;
  }
  return changed ? { ...progress, statuses } : progress;
}

export function questRewardEffects(definition: QuestDefinition): GameEffect[] {
  return definition.rewards.flatMap((reward) => {
    if (reward.type === "currency") return [{ type: "add_currency" as const, amount: reward.amount }];
    if (reward.type === "experience") return [{ type: "add_player_exp" as const, amount: reward.amount }];
    if (reward.type === "relationship" && reward.characterId) return [{ type: "add_relationship" as const, characterId: reward.characterId, amount: reward.amount }];
    if (reward.type === "item" && reward.itemId && reward.itemType && reward.rarity) return [{ type: "add_item" as const, item: { itemId: reward.itemId, itemType: reward.itemType, rarity: reward.rarity, amount: reward.amount, sourceTags: ["任务奖励", definition.id], locked: reward.itemType === "quest" } }];
    return [];
  });
}

export const questSortRank: Record<QuestStatus, number> = { claimable: 0, in_progress: 2, completed: 2, unaccepted: 3, claimed: 4 };
