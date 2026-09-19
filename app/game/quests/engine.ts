import type { GameEffect, UnifiedGameState } from "../core/types";
import { QUESTS } from "./content";
import type { QuestDefinition, QuestObjectiveDefinition, QuestProgress, QuestStatus, QuestView } from "./types";
import { inventoryCount } from "../core/item-query";
import { chapterOneOutcomeEffects, chapterOneOutcomeRewardLabels, resolveChapterOneOutcome } from "../chapter-one/service";

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
  if (objective.target === "alchemy:any-product") return objective.type === "play"
    ? state.alchemy.completedBrews ?? 0
    : inventoryCount(state.shared.items, { itemType: "pill" });
  if (objective.target === "dungeon:any-completed") return state.dungeons.completed.length;
  if (objective.target.startsWith("dungeon:wave-") && objective.target.endsWith("-completed")) {
    const waveId = Number(objective.target.slice("dungeon:wave-".length, -"-completed".length));
    return Number.isFinite(waveId) && state.dungeons.completed.includes(waveId) ? 1 : 0;
  }
  if (objective.target === "path:medicine-shortage-completed") return state.romance.medicineShortage.status === "completed" ? 1 : 0;
  if (objective.target.startsWith("item:")) return inventoryCount(state.shared.items, { templateId: objective.target.slice(5) });
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
  const status: QuestStatus = ["in_progress", "completed", "claimable"].includes(stored)
    ? complete ? "claimable" : "in_progress" : stored;
  return { definition, status, objectives, complete, tracked: progress.trackedQuestId === definition.id };
}

export function synchronizeQuestProgress(progress: QuestProgress, state: UnifiedGameState): QuestProgress {
  let changed = false;
  const statuses = { ...progress.statuses };
  for (const definition of QUESTS) {
    const status = questView(definition, progress, state).status;
    if (statuses[definition.id] === status) continue;
    statuses[definition.id] = status;
    changed = true;
  }
  return changed ? { ...progress, statuses } : progress;
}

export function questRewardEffects(definition: QuestDefinition, state?: UnifiedGameState): GameEffect[] {
  const effects: GameEffect[] = [];
  for (const reward of definition.rewards) {
    if (reward.type === "currency") effects.push({ type: "add_currency", amount: reward.amount });
    else if (reward.type === "experience") effects.push({ type: "add_player_exp", amount: reward.amount });
    else if (reward.type === "relationship" && reward.characterId) effects.push({ type: "add_relationship", characterId: reward.characterId, amount: reward.amount });
    else if (reward.type === "item" && reward.itemId && reward.itemType && reward.rarity) effects.push({ type: "add_item", item: { itemId: reward.itemId, itemType: reward.itemType, rarity: reward.rarity, amount: reward.amount, sourceTags: ["任务奖励", definition.id], locked: reward.itemType === "quest" } });
  }
  const chapterOutcome = definition.id === "main-chapter-one-return" && state ? resolveChapterOneOutcome(state) : null;
  if (chapterOutcome) effects.push(...chapterOneOutcomeEffects(chapterOutcome));
  const impacts = [...new Set([
    chapterOutcome ? `${chapterOutcome.routeName}路线已写入章节结果` : definition.completion?.nextHook ?? "新的目标已经出现在任务簿中。",
    chapterOutcome?.nextHook ?? "",
  ].filter(Boolean))];
  effects.push({
    type: "record_activity",
    receipt: {
      id: `quest:${definition.id}:${Date.now()}`,
      kind: "quest",
      title: chapterOutcome?.title ?? definition.completion?.title ?? `任务完成 · ${definition.name}`,
      summary: chapterOutcome ? `${chapterOutcome.body}${chapterOutcome.routeReflection}` : definition.completion?.body ?? "任务奖励已经写入统一状态。",
      rewards: [...definition.rewards.map((reward) => `${reward.label} +${reward.amount}`), ...(chapterOutcome ? chapterOneOutcomeRewardLabels(chapterOutcome) : [])],
      impacts,
      nextStep: { target: "tasks", label: definition.id === "main-chapter-one-return" ? "查看章节余韵" : "查看下一项任务" },
      createdAt: Date.now(),
    },
  });
  return effects;
}

export const questSortRank: Record<QuestStatus, number> = { claimable: 0, in_progress: 2, completed: 2, unaccepted: 3, claimed: 4 };
