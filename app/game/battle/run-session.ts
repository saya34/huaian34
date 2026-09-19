import type { GameSettings } from "./engine";
import type { MetaProgress } from "./meta";

export type LockedBattleSession = {
  id: string;
  waveId: number;
  settings: GameSettings;
  meta: MetaProgress;
  experienceGain: number;
  supplyItemId?: string;
  supplyName?: string;
};

/** Clone mutable preparation data so another page cannot mutate a live run. */
export function lockBattleSession(input: Omit<LockedBattleSession, "id">): LockedBattleSession {
  return {
    ...structuredClone(input),
    id: `battle-${input.waveId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}
