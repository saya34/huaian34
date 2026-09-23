import type { UnifiedCardInstance } from "../core/types";
import type { PartnerDefinition, PartnerPower } from "./expedition";
import effectContent from "./content/summon-effects.json";
import gameplayContent from "./content/summon-gameplay-effects.json";
import { showcaseEffectIdForCard } from "./summon-showcase";

export type SummonEffectTemplate =
  | "sword-rift"
  | "thunder-seal"
  | "frost-lotus"
  | "golden-ward"
  | "healing-bloom"
  | "phoenix-descent"
  | "shadow-assault"
  | "wind-domain"
  | "starfall-array"
  | "ink-dragon";

export type SummonEffectCategory = "attack" | "buff" | "protect" | "healing" | "control" | "debuff";
export type SummonParticleShape = "shard" | "spark" | "leaf" | "rune" | "snow" | "petal" | "feather" | "ember" | "drop" | "ink" | "mist" | "star";

export type SummonPalette = {
  primary: string;
  secondary: string;
  accent: string;
  shadow: string;
};

export type SummonPersistentVisual = "sword" | "blood" | "lightning" | "frost" | "ward" | "healing" | "phoenix" | "shadow" | "wind" | "star" | "dragon";
export type SummonGameplayEffect = {
  effectId: string;
  summary: string;
  durationSeconds: number;
  visual: SummonPersistentVisual;
  color: string;
  accent: string;
  damage?: {
    mode: "burst" | "pulse" | "dot";
    interval: number;
    hits: number;
    maxHpRatio: number;
    bossScale: number;
    minDamage: number;
  };
  heal?: {
    interval: number;
    ticks: number;
    maxHpRatio: number;
    initialMaxHpRatio?: number;
  };
  buff?: {
    damageBonus?: number;
    hasteBonus?: number;
    speedBonus?: number;
    invulnerableSeconds?: number;
  };
  control?: {
    freezeSeconds?: number;
    pullStrength?: number;
  };
};

export type SummonEffectDefinition = {
  id: string;
  template: SummonEffectTemplate;
  category: SummonEffectCategory;
  categoryLabel: string;
  name: string;
  incantation: string;
  glyph: string;
  particle: SummonParticleShape;
  particleCount: number;
  intensity: number;
  shake: number;
  palette: SummonPalette;
  gameplay: SummonGameplayEffect;
};

type ActiveCardEffect = NonNullable<UnifiedCardInstance["activeEffect"]>;
type SummonEffectContent = {
  durationMs: number;
  exactBindings: Record<string, string>;
  skillPools: Record<ActiveCardEffect, string[]>;
  variants: Omit<SummonEffectDefinition, "gameplay">[];
};

const CONTENT = effectContent as SummonEffectContent;
const GAMEPLAY = gameplayContent as { version: number; effects: SummonGameplayEffect[] };
const GAMEPLAY_BY_ID = new Map(GAMEPLAY.effects.map((effect) => [effect.effectId, effect]));
const EFFECTS = CONTENT.variants.map((effect) => ({
  ...effect,
  gameplay: GAMEPLAY_BY_ID.get(effect.id)!,
}));
const EFFECTS_BY_ID = new Map(EFFECTS.map((effect) => [effect.id, effect]));

const POWER_TO_EFFECT: Record<PartnerPower, ActiveCardEffect> = {
  screenDamage: "sword",
  lightning: "assault",
  frenzy: "ward",
  freeze: "frost",
  recovery: "healing",
};

function stableHash(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function effectById(id: string | undefined) {
  return id ? EFFECTS_BY_ID.get(id) : undefined;
}

export const SUMMON_EFFECTS = EFFECTS;

export function summonEffectDuration(effect: SummonEffectDefinition, resonance: boolean) {
  return Math.round(CONTENT.durationMs * (resonance ? 1.2 : 1) * Math.max(0.92, Math.min(1.12, effect.intensity)));
}

export function resolveSummonEffect(card: UnifiedCardInstance | null | undefined, partner: PartnerDefinition, resonance: boolean) {
  const exact = effectById(card ? showcaseEffectIdForCard(card.id) ?? CONTENT.exactBindings[card.id] : undefined);
  if (exact) return exact;

  const skill = card?.activeEffect ?? POWER_TO_EFFECT[partner.power];
  const pool = CONTENT.skillPools[skill] ?? CONTENT.skillPools.sword;
  const signature = card
    ? `${card.id}|${card.characterId}|${card.name}|${card.source}|${card.rarity}|${resonance ? "resonance" : "cast"}`
    : `${partner.id}|${partner.power}|${partner.tag}|${resonance ? "resonance" : "cast"}`;
  const rarityOffset = card && card.rarity >= 6 ? 2 : card && card.rarity >= 4 ? 1 : 0;
  const selectedId = pool[(stableHash(signature) + rarityOffset) % pool.length];
  return effectById(selectedId) ?? EFFECTS[0];
}

export function summonEffectAudit() {
  const templates = new Set(EFFECTS.map((effect) => effect.template));
  const referenced = new Set(Object.values(CONTENT.skillPools).flat());
  return {
    variants: EFFECTS.length,
    templates: templates.size,
    unbound: EFFECTS.filter((effect) => !referenced.has(effect.id)).map((effect) => effect.id),
    missingGameplay: EFFECTS.filter((effect) => !effect.gameplay).map((effect) => effect.id),
  };
}
