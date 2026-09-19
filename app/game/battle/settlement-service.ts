import { MATERIALS as ALCHEMY_MATERIALS } from "../alchemy/item-data";
import { createActivityReceipt } from "../core/activity-receipt";
import type { GameEffect, UnifiedRarity } from "../core/types";
import type { GameSnapshot } from "./engine";
import { treasureById, type RunResult, type TreasureItem } from "./expedition";
import { awardClearExperience, awardSkillBooks, settleExpedition, type MetaProgress } from "./meta";
import type { EquipmentItem } from "./progression";

export type BattleSettlement = {
  kind: RunResult;
  snapshot: GameSnapshot;
  accepted: TreasureItem[];
  overflow: TreasureItem[];
  equipmentOverflow: EquipmentItem[];
  experience: number;
  levelsGained: number;
  skillBooks: number;
};

export type ResolvedBattleSettlement = {
  result: BattleSettlement;
  nextMeta: MetaProgress;
  effects: GameEffect[];
};

/**
 * Pure settlement projection. The caller commits the returned meta/effects in
 * one guarded transaction, keeping Canvas callbacks free of persistence rules.
 */
export function resolveBattleSettlement(input: {
  meta: MetaProgress;
  kind: RunResult;
  snapshot: GameSnapshot;
  waveId: number;
  experienceGain: number;
}): ResolvedBattleSettlement {
  const { meta, kind, snapshot, waveId, experienceGain } = input;
  const settlement = settleExpedition(meta, kind, snapshot.backpack, snapshot.safeBox, snapshot.runEquipment);
  const progression = kind === "victory" ? awardClearExperience(settlement.meta, waveId, experienceGain) : { meta: settlement.meta, gained: 0, levelsGained: 0 };
  const bookReward = awardSkillBooks(progression.meta, kind, waveId);
  const rarityMap: Record<string, UnifiedRarity> = { common: 1, fine: 2, rare: 3, epic: 4, immortal: 6 };
  const effects: GameEffect[] = [
    { type: "complete_dungeon", waveId, result: kind },
    ...settlement.accepted.map((item): GameEffect => {
      const definition = treasureById(item.treasureId);
      return { type: "add_item", item: { itemId: `treasure:${item.treasureId}`, itemType: "treasure", rarity: rarityMap[definition.rarity] ?? 1, amount: 1, sourceTags: ["battle", `wave-${waveId}`] } };
    }),
    ...(kind === "victory" ? [{ type: "add_item" as const, item: { itemId: ALCHEMY_MATERIALS[(waveId * 11) % ALCHEMY_MATERIALS.length].id, itemType: "material" as const, rarity: Math.min(7, 2 + Math.floor(waveId / 4)) as UnifiedRarity, amount: 1, sourceTags: ["battle", "alchemy", `wave-${waveId}`] } }] : []),
    { type: "record_activity", receipt: createActivityReceipt({ kind: "battle", title: kind === "victory" ? "秘境镇压完成" : kind === "extracted" ? "携宝撤离" : "暂退秘境", summary: kind === "victory" ? "战利品、修为与任务进度已经同步结算。" : "本次可保留所得已经写入统一状态。", rewards: [`战利品 ×${settlement.accepted.length}`, `修为 +${progression.gained}`], impacts: [kind === "victory" ? "秘境与任务进度已推进" : "秘境进度未推进", `悟道残卷 +${bookReward.gained}`], nextStep: { target: kind === "victory" ? "tasks" : "battle", label: kind === "victory" ? "查看任务与新解锁" : "重整配装再次挑战" } }) },
  ];
  return {
    nextMeta: bookReward.meta,
    effects,
    result: { kind, snapshot, accepted: settlement.accepted, overflow: settlement.overflow, equipmentOverflow: settlement.equipmentOverflow, experience: progression.gained, levelsGained: progression.levelsGained, skillBooks: bookReward.gained },
  };
}
