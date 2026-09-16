import type { UnifiedGameState } from "./types";

export interface PlayerStateRepository {
  load(slotId: string): Promise<unknown | null>;
  save(state: UnifiedGameState, expectedVersion?: number): Promise<void>;
}

export const keyFor = (slotId: string) => `huaian-dream-save-${slotId}-v4`;
const LEGACY_KEYS = ["huaian-dream-save-main-v3", "huaian-dream-save-main-v2", "huaian-dream-save-main-v1", "huaian-romance-state"];

export class LocalPlayerStateRepository implements PlayerStateRepository {
  async load(slotId: string) {
    if (typeof window === "undefined") return null;
    for (const key of [keyFor(slotId), ...(slotId === "main" ? LEGACY_KEYS : [])]) {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) return JSON.parse(raw) as unknown;
      } catch {
        // A broken legacy slot must not prevent a later valid slot from loading.
      }
    }
    return null;
  }

  async save(state: UnifiedGameState) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(keyFor("main"), JSON.stringify(state));
    } catch {
      // Private browsing and quota failures must not crash the running session.
    }
  }
}
