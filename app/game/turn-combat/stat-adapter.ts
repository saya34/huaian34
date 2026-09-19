import { computeCombatTraits } from "../battle/progression";
import { skillMasteryDamageMultiplier } from "../battle/skillMastery";
import { computeFinalAttributes } from "../core/attributes-service";
import type { UnifiedGameState } from "../core/types";
import { TURN_COMBAT_SYSTEM, TURN_SKILL_MAP } from "./content";
import type { PlayerTurnProfile } from "./types";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createPlayerTurnProfile(state: UnifiedGameState): PlayerTurnProfile {
  const attributes = computeFinalAttributes(state);
  const traits = computeCombatTraits(state.battle.passiveRanks);
  const formula = TURN_COMBAT_SYSTEM.formula;
  const averageWeaponDamage = (attributes.weaponMinDamage + attributes.weaponMaxDamage) / 2;
  const speed = clamp(
    formula.speedBase
      + attributes.dexterity * formula.speedDexterityScale
      + (attributes.attackSpeed - 1) * formula.speedAttackScale
      + (attributes.moveSpeed - formula.speedMoveBaseline) * formula.speedMoveScale,
    formula.speedMin,
    formula.speedMax,
  );

  const learned = state.shared.learnedSkills.filter((skillId) => TURN_SKILL_MAP[`manual-${skillId}`]);
  const preferred = TURN_COMBAT_SYSTEM.defaultLoadout.filter((skillId) => learned.includes(skillId));
  // 回合制不再使用割草局内的四格候选限制；所有已习得功法都进入分类式功法匣。
  const selected = [...preferred, ...learned.filter((skillId) => !preferred.includes(skillId))];
  const skillIds = selected.map((skillId) => `manual-${skillId}`);
  const masteryMultipliers = Object.fromEntries(selected.map((skillId) => {
    const mastery = state.battle.skillMastery[String(skillId)];
    return [`manual-${skillId}`, skillMasteryDamageMultiplier(mastery?.level ?? 1)];
  }));

  return {
    name: "槐安行者",
    title: `问道 · ${state.shared.playerLevel}阶`,
    art: TURN_COMBAT_SYSTEM.playerArt,
    stats: {
      health: Math.max(1, Math.round(attributes.health)),
      mana: Math.max(1, Math.round(attributes.mana)),
      defense: Math.max(0, Math.round(attributes.defense)),
      physicalPower: Math.max(1, Math.round((formula.physicalBase + attributes.strength * formula.physicalStrengthScale + averageWeaponDamage) * attributes.damage)),
      spiritualPower: Math.max(1, Math.round((formula.spiritualBase + attributes.magic * formula.spiritualMagicScale) * attributes.damage)),
      speed: Math.round(speed),
      hitChance: attributes.hitChance,
      dodge: attributes.dodge,
      critChance: traits.critChance,
      critMultiplier: traits.critMultiplier,
      posture: Math.max(1, Math.round(formula.postureBase + attributes.defense * formula.postureDefenseScale + attributes.strength * formula.postureStrengthScale)),
      level: state.shared.playerLevel,
      finesse: Math.round(attributes.dexterity * 2 + state.shared.playerLevel * 8),
      fireResist: attributes.fireResist,
      lightningResist: attributes.lightningResist,
      magicResist: attributes.magicResist,
    },
    skillIds,
    masteryMultipliers,
  };
}
