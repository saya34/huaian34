import type { UnifiedGameState } from "./types";

export interface PlayerStateRepository {
  load(slotId: string): Promise<UnifiedGameState | null>;
  save(state: UnifiedGameState, expectedVersion?: number): Promise<void>;
}

export const keyFor = (slotId: string) => `huaian-dream-save-${slotId}-v2`;

export class LocalPlayerStateRepository implements PlayerStateRepository {
  async load(slotId: string) {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(keyFor(slotId));
      return raw ? JSON.parse(raw) as UnifiedGameState : null;
    } catch {
      return null;
    }
  }

  async save(state: UnifiedGameState) {
    if (typeof window !== "undefined") window.localStorage.setItem(keyFor("main"), JSON.stringify(state));
  }
}
