import type { UnifiedRarity } from "../core/types";

function normalizeRarity(rarity: number): UnifiedRarity {
  return Math.max(1, Math.min(7, Math.trunc(rarity))) as UnifiedRarity;
}

/** A non-interactive rarity layer shared by character-card surfaces. */
export function CardRaritySheen({ rarity }: { rarity: number }) {
  return <span className="card-rarity-sheen" data-rarity={normalizeRarity(rarity)} aria-hidden="true" />;
}
