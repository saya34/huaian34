export type CombatTeam = "player" | "enemy";
export type CombatPhase = "active" | "victory" | "defeat" | "retreated";
export type SkillKind = "attack" | "heal" | "buff" | "debuff" | "defense";
export type SkillTarget = "self" | "enemy" | "all_enemies" | "all_allies" | "lowest_enemy";
export type EffectTarget = SkillTarget;
export type ScalingType = "physical" | "spiritual";
export type CombatEventType = "attack" | "heal" | "status" | "miss" | "break" | "recover" | "defeat" | "turn" | "item" | "flee" | "steal";

export type TurnCombatFormula = {
  physicalBase: number;
  physicalStrengthScale: number;
  spiritualBase: number;
  spiritualMagicScale: number;
  speedBase: number;
  speedDexterityScale: number;
  speedAttackScale: number;
  speedMoveScale: number;
  speedMoveBaseline: number;
  speedMin: number;
  speedMax: number;
  defenseConstant: number;
  defenseLevelScale: number;
  maxDamageReduction: number;
  minHitChance: number;
  maxHitChance: number;
  postureBase: number;
  postureDefenseScale: number;
  postureStrengthScale: number;
  brokenPostureRestore: number;
  brokenDelay: number;
  damageVarianceMin: number;
  damageVarianceMax: number;
  aoePowerScale: number;
};

export type TurnCombatSystem = {
  version: number;
  timelineThreshold: number;
  formula: TurnCombatFormula;
  defaultLoadout: number[];
  maxEquippedSkills: number;
  historyLimit: number;
  enemyThinkDelayMs: number;
  impactDurationMs: number;
  settlementDelayMs: number;
  invasion: { day: number; period: string; resolvedFlag: string; queuedFlag: string };
  playerArt: string;
  battleBackground: string;
};

export type CombatConsumableEffect = {
  healthRatio?: number;
  manaRatio?: number;
  postureRatio?: number;
  statusId?: string;
  duration?: number;
  cleanseDanger?: boolean;
};

export type CombatConsumableDefinition = {
  templateId: string;
  role: "health" | "mana" | "buff";
  label: string;
  summary: string;
  recovery: number;
  effects: CombatConsumableEffect[];
};

export type CombatInventoryStack = {
  itemId: string;
  templateId: string;
  name: string;
  art: string;
  rarity: number;
  amount: number;
  quality?: string;
  mutation?: string;
  definition: CombatConsumableDefinition;
};

export type TheftLoot = {
  kind: "currency" | "treasure" | "manual";
  itemId?: string;
  templateId?: string;
  skillId?: number;
  name: string;
  amount: number;
  rarity: number;
  description: string;
};

export type TurnCombatActions = {
  flee: { recovery: number; minimumChance: number; maximumChance: number; speedDeltaScale: number };
  steal: {
    recovery: number;
    baseChance: number;
    finesseScale: number;
    enemyLevelScale: number;
    minimumChance: number;
    maximumChance: number;
    treasureChance: number;
    specialChance: number;
    currencyBase: number;
    currencyPerLevel: number;
    treasures: TheftLoot[];
    specialLoot: Record<string, TheftLoot>;
  };
  consumables: CombatConsumableDefinition[];
};

export type TurnEffectDefinition = {
  kind: "damage" | "heal" | "status" | "restore_mana" | "restore_posture" | "delay";
  target?: EffectTarget;
  scaling?: ScalingType;
  coefficient?: number;
  posture?: number;
  element?: "fire" | "lightning" | "magic";
  statusId?: string;
  chance?: number;
  duration?: number;
  flat?: number;
  maxRatio?: number;
  brokenBonus?: number;
  woundedBonus?: number;
  statusBonusId?: string;
  statusBonus?: number;
};

export type TurnSkillDefinition = {
  id: string;
  sourceSkillId?: number;
  name: string;
  shortName: string;
  description: string;
  kind: SkillKind;
  target: SkillTarget;
  manaCost: number;
  recovery: number;
  accuracy: number;
  telegraph?: string;
  art?: string;
  visual?: string;
  effects: TurnEffectDefinition[];
};

export type TurnSkillVisualDefinition = {
  key: string;
  family: string;
  sigil: string;
  primary: string;
  accent: string;
  intensity: "light" | "medium" | "heavy";
};

export type StatusDefinition = {
  id: string;
  name: string;
  icon: string;
  tone: "jade" | "gold" | "danger";
  description: string;
  modifiers?: {
    defenseMultiplier?: number;
    speedMultiplier?: number;
    damageMultiplier?: number;
    incomingDamageMultiplier?: number;
    dodgeDelta?: number;
    manaCostMultiplier?: number;
  };
  tick?: { kind: "damage" | "heal"; maxHealthRatio: number; posture?: number };
};

export type TurnStats = {
  health: number;
  mana: number;
  defense: number;
  physicalPower: number;
  spiritualPower: number;
  speed: number;
  hitChance: number;
  dodge: number;
  critChance: number;
  critMultiplier: number;
  posture: number;
  level: number;
  finesse?: number;
  fireResist?: number;
  lightningResist?: number;
  magicResist?: number;
};

export type EnemyDefinition = {
  id: string;
  name: string;
  title: string;
  art: string;
  ai: "aggressive" | "guardian" | "commander" | "dummy";
  stats: TurnStats;
  skills: string[];
};

export type EncounterDefinition = {
  id: string;
  kind: "story" | "practice";
  name: string;
  subtitle: string;
  objective: string;
  briefing: string;
  enemyIds: string[];
  background: string;
  rewards: { experience: number; spiritStones: number; itemId?: string; itemName?: string; itemRarity?: number };
  allowRetreat: boolean;
};

export type StatusInstance = { id: string; remaining: number; sourceId: string };

export type CombatantState = {
  id: string;
  templateId: string;
  name: string;
  title: string;
  team: CombatTeam;
  art: string;
  stats: TurnStats;
  health: number;
  mana: number;
  posture: number;
  nextActionAt: number;
  skillIds: string[];
  masteryMultipliers: Record<string, number>;
  statuses: StatusInstance[];
  intentSkillId?: string;
  defeated: boolean;
};

export type CombatEvent = {
  id: number;
  type: CombatEventType;
  actorId?: string;
  targetId?: string;
  amount?: number;
  posture?: number;
  text: string;
  tone: "ink" | "jade" | "gold" | "danger";
  critical?: boolean;
  skillId?: string;
};

export type TurnBattleState = {
  encounterId: string;
  seed: number;
  clock: number;
  actionCount: number;
  activeId: string;
  phase: CombatPhase;
  combatants: CombatantState[];
  history: CombatEvent[];
  lastEvents: CombatEvent[];
  theftAttemptedIds: string[];
  settled: boolean;
};

export type ActionPreview = {
  targetLabel: string;
  damageMin: number;
  damageMax: number;
  posture: number;
  hitChance: number;
  manaCost: number;
  recovery: number;
  affordable: boolean;
  notes: string[];
};

export type PlayerTurnProfile = {
  name: string;
  title: string;
  art: string;
  stats: TurnStats;
  skillIds: string[];
  masteryMultipliers: Record<string, number>;
};

export type TurnCombatResult = {
  encounter: EncounterDefinition;
  outcome: "victory" | "defeat" | "retreated";
  actionCount: number;
};

export type UtilityActionResult = {
  state: TurnBattleState;
  success: boolean;
  chance?: number;
  loot?: TheftLoot;
};
