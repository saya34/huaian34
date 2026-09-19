import { TURN_COMBAT_ACTIONS, TURN_COMBAT_SYSTEM, TURN_ENEMY_MAP, TURN_SKILL_MAP, TURN_STATUS_MAP, turnSkillById } from "./content";
import type {
  ActionPreview,
  CombatEvent,
  CombatantState,
  EncounterDefinition,
  PlayerTurnProfile,
  SkillTarget,
  StatusInstance,
  TurnBattleState,
  CombatConsumableDefinition,
  TurnEffectDefinition,
  TurnSkillDefinition,
  UtilityActionResult,
} from "./types";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const alive = (unit: CombatantState) => !unit.defeated && unit.health > 0;

function random(seed: number) {
  const next = (Math.imul(seed || 1, 1664525) + 1013904223) >>> 0;
  return { value: next / 4294967296, seed: next };
}

function eventId(state: TurnBattleState, offset: number) {
  return state.actionCount * 20 + offset + 1;
}

function statusModifier(unit: CombatantState, key: "defenseMultiplier" | "speedMultiplier" | "damageMultiplier" | "incomingDamageMultiplier" | "dodgeDelta" | "manaCostMultiplier") {
  return unit.statuses.reduce((sum, status) => sum + (TURN_STATUS_MAP[status.id]?.modifiers?.[key] ?? 0), 0);
}

export function effectiveDefense(unit: CombatantState) {
  return Math.max(0, unit.stats.defense * (1 + statusModifier(unit, "defenseMultiplier")));
}

export function effectiveSpeed(unit: CombatantState) {
  return clamp(unit.stats.speed * (1 + statusModifier(unit, "speedMultiplier")), TURN_COMBAT_SYSTEM.formula.speedMin, TURN_COMBAT_SYSTEM.formula.speedMax);
}

export function effectiveDodge(unit: CombatantState) {
  return clamp(unit.stats.dodge + statusModifier(unit, "dodgeDelta"), 0, 0.8);
}

function manaCost(unit: CombatantState, skill: TurnSkillDefinition) {
  return Math.max(0, Math.round(skill.manaCost * (1 + statusModifier(unit, "manaCostMultiplier"))));
}

function initialTimeline(speed: number, order: number) {
  return TURN_COMBAT_SYSTEM.timelineThreshold * 100 / Math.max(1, speed) + order * 3;
}

function nextIntent(unit: CombatantState, actionCount: number) {
  const definition = TURN_ENEMY_MAP[unit.templateId];
  if (!definition) return unit.skillIds[0] ?? "basic-attack";
  if (definition.ai === "guardian" && unit.posture < unit.stats.posture * 0.48 && unit.skillIds.includes("enemy-brace")) return "enemy-brace";
  if (definition.ai === "commander") return actionCount % 3 === 0 ? "enemy-heavy-cleave" : actionCount % 3 === 1 ? "enemy-command" : "basic-attack";
  return unit.skillIds[actionCount % Math.max(1, unit.skillIds.length)] ?? "basic-attack";
}

export function createTurnBattle(encounter: EncounterDefinition, player: PlayerTurnProfile, seed = Date.now()): TurnBattleState {
  const playerUnit: CombatantState = {
    id: "player",
    templateId: "player",
    name: player.name,
    title: player.title,
    team: "player",
    art: player.art,
    stats: player.stats,
    health: player.stats.health,
    mana: player.stats.mana,
    posture: player.stats.posture,
    nextActionAt: initialTimeline(player.stats.speed, 0),
    skillIds: player.skillIds,
    masteryMultipliers: player.masteryMultipliers,
    statuses: [],
    defeated: false,
  };
  const enemies = encounter.enemyIds.map((enemyId, index): CombatantState => {
    const enemy = TURN_ENEMY_MAP[enemyId];
    if (!enemy) throw new Error(`Unknown turn-combat enemy: ${enemyId}`);
    const unit: CombatantState = {
      id: `${enemy.id}-${index + 1}`,
      templateId: enemy.id,
      name: enemy.name,
      title: enemy.title,
      team: "enemy",
      art: enemy.art,
      stats: { ...enemy.stats },
      health: enemy.stats.health,
      mana: enemy.stats.mana,
      posture: enemy.stats.posture,
      nextActionAt: initialTimeline(enemy.stats.speed, index + 1),
      skillIds: [...enemy.skills],
      masteryMultipliers: {},
      statuses: [],
      defeated: false,
    };
    unit.intentSkillId = nextIntent(unit, index);
    return unit;
  });
  const combatants = [playerUnit, ...enemies];
  const active = [...combatants].filter(alive).sort((a, b) => a.nextActionAt - b.nextActionAt)[0];
  return {
    encounterId: encounter.id,
    seed: seed >>> 0,
    clock: active?.nextActionAt ?? 0,
    actionCount: 0,
    activeId: active?.id ?? "player",
    phase: "active",
    combatants,
    history: [],
    lastEvents: [],
    theftAttemptedIds: [],
    settled: false,
  };
}

function targetsFor(state: TurnBattleState, actor: CombatantState, mode: SkillTarget, selectedTargetId?: string) {
  const opponents = state.combatants.filter((unit) => alive(unit) && unit.team !== actor.team);
  const allies = state.combatants.filter((unit) => alive(unit) && unit.team === actor.team);
  if (mode === "self") return [actor];
  if (mode === "all_allies") return allies;
  if (mode === "all_enemies") return opponents;
  if (mode === "lowest_enemy") return [...opponents].sort((a, b) => a.health / a.stats.health - b.health / b.stats.health).slice(0, 1);
  const chosen = opponents.find((unit) => unit.id === selectedTargetId);
  return chosen ? [chosen] : opponents.slice(0, 1);
}

function replaceUnit(units: CombatantState[], next: CombatantState) {
  return units.map((unit) => unit.id === next.id ? next : unit);
}

function addStatus(unit: CombatantState, statusId: string, duration: number, sourceId: string) {
  const current = unit.statuses.find((status) => status.id === statusId);
  const statuses: StatusInstance[] = current
    ? unit.statuses.map((status) => status.id === statusId ? { ...status, remaining: Math.max(status.remaining, duration), sourceId } : status)
    : [...unit.statuses, { id: statusId, remaining: duration, sourceId }];
  return { ...unit, statuses };
}

function resistance(target: CombatantState, element?: string) {
  if (element === "fire") return clamp(1 - (target.stats.fireResist ?? 0), 0.25, 1.5);
  if (element === "lightning") return clamp(1 - (target.stats.lightningResist ?? 0), 0.25, 1.5);
  if (element === "magic") return clamp(1 - (target.stats.magicResist ?? 0), 0.25, 1.5);
  return 1;
}

function averageDamage(actor: CombatantState, target: CombatantState, skill: TurnSkillDefinition, effect: TurnEffectDefinition) {
  const formula = TURN_COMBAT_SYSTEM.formula;
  const basePower = effect.scaling === "physical" ? actor.stats.physicalPower : actor.stats.spiritualPower;
  const mastery = actor.masteryMultipliers[skill.id] ?? 1;
  const outgoing = 1 + statusModifier(actor, "damageMultiplier");
  const incoming = 1 + statusModifier(target, "incomingDamageMultiplier");
  const defense = effectiveDefense(target);
  const reduction = Math.min(formula.maxDamageReduction, defense / (defense + formula.defenseConstant + actor.stats.level * formula.defenseLevelScale));
  const groupScale = (effect.target ?? skill.target) === "all_enemies" ? formula.aoePowerScale : 1;
  const brokenScale = target.statuses.some((status) => status.id === "broken") ? 1 + (effect.brokenBonus ?? 0) : 1;
  const woundedScale = target.health / target.stats.health <= 0.35 ? 1 + (effect.woundedBonus ?? 0) : 1;
  const statusScale = effect.statusBonusId && target.statuses.some((status) => status.id === effect.statusBonusId) ? 1 + (effect.statusBonus ?? 0) : 1;
  return Math.max(1, basePower * (effect.coefficient ?? 1) * mastery * outgoing * incoming * (1 - reduction) * resistance(target, effect.element) * groupScale * brokenScale * woundedScale * statusScale);
}

function applyDamage(state: TurnBattleState, actor: CombatantState, target: CombatantState, skill: TurnSkillDefinition, effect: TurnEffectDefinition, offset: number) {
  const formula = TURN_COMBAT_SYSTEM.formula;
  let roll = random(state.seed);
  let nextSeed = roll.seed;
  const hitChance = clamp(actor.stats.hitChance + skill.accuracy - effectiveDodge(target), formula.minHitChance, formula.maxHitChance);
  if (roll.value > hitChance) {
    return { state: { ...state, seed: nextSeed }, unit: target, event: { id: eventId(state, offset), type: "miss", actorId: actor.id, targetId: target.id, text: `${target.name}避开了${skill.name}`, tone: "ink" } as CombatEvent };
  }
  roll = random(nextSeed); nextSeed = roll.seed;
  const variance = formula.damageVarianceMin + (formula.damageVarianceMax - formula.damageVarianceMin) * roll.value;
  roll = random(nextSeed); nextSeed = roll.seed;
  const critical = roll.value < actor.stats.critChance;
  const amount = Math.max(1, Math.round(averageDamage(actor, target, skill, effect) * variance * (critical ? actor.stats.critMultiplier : 1)));
  const postureScale = (effect.target ?? skill.target) === "all_enemies" ? formula.aoePowerScale : 1;
  const posture = Math.max(0, Math.round((effect.posture ?? 0) * (1 + actor.stats.physicalPower / 500) * postureScale));
  let unit = { ...target, health: Math.max(0, target.health - amount), posture: Math.max(0, target.posture - posture) };
  let breakEvent: CombatEvent | undefined;
  if (unit.health <= 0) unit = { ...unit, defeated: true };
  else if (unit.posture <= 0 && !unit.statuses.some((status) => status.id === "broken")) {
    unit = addStatus({ ...unit, nextActionAt: unit.nextActionAt + formula.brokenDelay }, "broken", 1, actor.id);
    breakEvent = { id: eventId(state, offset + 1), type: "break", actorId: actor.id, targetId: target.id, text: `${target.name}架势崩解，破绽已现`, tone: "gold", posture: target.posture };
  }
  return {
    state: { ...state, seed: nextSeed },
    unit,
    event: { id: eventId(state, offset), type: "attack", actorId: actor.id, targetId: target.id, amount, posture, text: `${actor.name}施展${skill.name}，造成${amount}点伤害`, tone: critical ? "gold" : "danger", critical } as CombatEvent,
    breakEvent,
  };
}

function applyEffect(state: TurnBattleState, actor: CombatantState, skill: TurnSkillDefinition, effect: TurnEffectDefinition, selectedTargetId: string | undefined, offset: number) {
  const mode = effect.target ?? skill.target;
  const targets = targetsFor(state, actor, mode, selectedTargetId);
  let next = state;
  const events: CombatEvent[] = [];
  let cursor = offset;
  for (const target of targets) {
    const current = next.combatants.find((unit) => unit.id === target.id);
    if (!current || !alive(current)) continue;
    if (effect.kind === "damage") {
      const result = applyDamage(next, actor, current, skill, effect, cursor);
      next = { ...result.state, combatants: replaceUnit(result.state.combatants, result.unit) };
      events.push(result.event);
      if (result.breakEvent) events.push(result.breakEvent);
    } else if (effect.kind === "heal") {
      const base = effect.scaling === "physical" ? actor.stats.physicalPower : actor.stats.spiritualPower;
      const amount = Math.max(1, Math.round(base * (effect.coefficient ?? 0) + current.stats.health * (effect.maxRatio ?? 0)));
      const healed = Math.min(amount, current.stats.health - current.health);
      const unit = { ...current, health: Math.min(current.stats.health, current.health + amount) };
      next = { ...next, combatants: replaceUnit(next.combatants, unit) };
      events.push({ id: eventId(next, cursor), type: "heal", actorId: actor.id, targetId: current.id, amount: healed, text: `${current.name}回复${healed}点气血`, tone: "jade" });
    } else if (effect.kind === "restore_mana") {
      const amount = Math.round((effect.flat ?? 0) + current.stats.mana * (effect.maxRatio ?? 0));
      const restored = Math.min(amount, current.stats.mana - current.mana);
      const unit = { ...current, mana: Math.min(current.stats.mana, current.mana + amount) };
      next = { ...next, combatants: replaceUnit(next.combatants, unit) };
      if (restored > 0) events.push({ id: eventId(next, cursor), type: "recover", actorId: actor.id, targetId: current.id, amount: restored, text: `${current.name}回复${restored}点内力`, tone: "jade" });
    } else if (effect.kind === "restore_posture") {
      const amount = Math.round((effect.flat ?? 0) + current.stats.posture * (effect.maxRatio ?? 0));
      const restored = Math.min(amount, current.stats.posture - current.posture);
      const unit = { ...current, posture: Math.min(current.stats.posture, current.posture + amount) };
      next = { ...next, combatants: replaceUnit(next.combatants, unit) };
      if (restored > 0) events.push({ id: eventId(next, cursor), type: "recover", actorId: actor.id, targetId: current.id, posture: restored, text: `${current.name}稳住${restored}点架势`, tone: "jade" });
    } else if (effect.kind === "delay") {
      const unit = { ...current, nextActionAt: current.nextActionAt + (effect.flat ?? 0) };
      next = { ...next, combatants: replaceUnit(next.combatants, unit) };
      events.push({ id: eventId(next, cursor), type: "status", actorId: actor.id, targetId: current.id, text: `${current.name}的气机被向后推移`, tone: "gold" });
    } else if (effect.kind === "status" && effect.statusId) {
      const roll = random(next.seed);
      next = { ...next, seed: roll.seed };
      if (roll.value <= (effect.chance ?? 1)) {
        const unit = addStatus(current, effect.statusId, effect.duration ?? 1, actor.id);
        next = { ...next, combatants: replaceUnit(next.combatants, unit) };
        const status = TURN_STATUS_MAP[effect.statusId];
        events.push({ id: eventId(next, cursor), type: "status", actorId: actor.id, targetId: current.id, text: `${current.name}获得「${status?.name ?? effect.statusId}」`, tone: status?.tone === "danger" ? "danger" : status?.tone === "gold" ? "gold" : "jade" });
      }
    }
    cursor += 2;
  }
  return { state: next, events };
}

function terminalPhase(combatants: CombatantState[]) {
  if (!combatants.some((unit) => unit.team === "player" && alive(unit))) return "defeat" as const;
  if (!combatants.some((unit) => unit.team === "enemy" && alive(unit))) return "victory" as const;
  return "active" as const;
}

function processTurnStart(state: TurnBattleState, unitId: string) {
  let next = state;
  let unit = next.combatants.find((entry) => entry.id === unitId);
  if (!unit) return next;
  const events: CombatEvent[] = [];
  const kept: StatusInstance[] = [];
  for (const instance of unit.statuses) {
    const definition = TURN_STATUS_MAP[instance.id];
    if (definition?.tick) {
      const amount = Math.max(1, Math.round(unit.stats.health * definition.tick.maxHealthRatio));
      if (definition.tick.kind === "damage") {
        unit = { ...unit, health: Math.max(0, unit.health - amount), posture: Math.max(0, unit.posture - (definition.tick.posture ?? 0)) };
        events.push({ id: eventId(next, events.length), type: "attack", targetId: unit.id, amount, text: `${definition.name}造成${amount}点伤害`, tone: "danger" });
      } else {
        const healed = Math.min(amount, unit.stats.health - unit.health);
        unit = { ...unit, health: Math.min(unit.stats.health, unit.health + amount) };
        events.push({ id: eventId(next, events.length), type: "heal", targetId: unit.id, amount: healed, text: `${definition.name}回复${healed}点气血`, tone: "jade" });
      }
    }
    const remaining = instance.remaining - 1;
    if (remaining > 0) kept.push({ ...instance, remaining });
    else if (instance.id === "broken") unit = { ...unit, posture: Math.max(unit.posture, Math.round(unit.stats.posture * TURN_COMBAT_SYSTEM.formula.brokenPostureRestore)) };
  }
  unit = { ...unit, statuses: kept, defeated: unit.health <= 0 };
  next = { ...next, combatants: replaceUnit(next.combatants, unit), lastEvents: [...next.lastEvents, ...events] };
  return next;
}

function beginNextTurn(state: TurnBattleState): TurnBattleState {
  let next = state;
  for (let attempts = 0; attempts < next.combatants.length + 1; attempts += 1) {
    const phase = terminalPhase(next.combatants);
    if (phase !== "active") return { ...next, phase, activeId: "" };
    const candidate = [...next.combatants].filter(alive).sort((a, b) => a.nextActionAt - b.nextActionAt || a.id.localeCompare(b.id))[0];
    if (!candidate) return { ...next, phase: "defeat", activeId: "" };
    next = { ...next, activeId: candidate.id, clock: candidate.nextActionAt };
    next = processTurnStart(next, candidate.id);
    const refreshed = next.combatants.find((unit) => unit.id === candidate.id);
    if (refreshed && alive(refreshed)) return next;
  }
  return { ...next, phase: terminalPhase(next.combatants), activeId: "" };
}

export function resolveTurnAction(state: TurnBattleState, skillId: string, selectedTargetId?: string): TurnBattleState {
  if (state.phase !== "active") return state;
  const actor = state.combatants.find((unit) => unit.id === state.activeId);
  const skill = TURN_SKILL_MAP[skillId];
  if (!actor || !skill || !alive(actor)) return state;
  const cost = manaCost(actor, skill);
  if (actor.mana < cost) return state;
  let next: TurnBattleState = { ...state, actionCount: state.actionCount + 1, lastEvents: [], combatants: state.combatants.map((unit) => ({ ...unit, statuses: unit.statuses.map((status) => ({ ...status })) })) };
  let active = next.combatants.find((unit) => unit.id === actor.id)!;
  active = { ...active, mana: Math.max(0, active.mana - cost) };
  next = { ...next, combatants: replaceUnit(next.combatants, active) };
  const actionEvents: CombatEvent[] = [{ id: eventId(next, 0), type: "turn", actorId: active.id, skillId: skill.id, text: `${active.name}施展「${skill.name}」`, tone: active.team === "player" ? "gold" : "danger" }];
  for (const effect of skill.effects) {
    active = next.combatants.find((unit) => unit.id === actor.id) ?? active;
    const result = applyEffect(next, active, skill, effect, selectedTargetId, actionEvents.length + 1);
    next = result.state;
    actionEvents.push(...result.events);
  }
  active = next.combatants.find((unit) => unit.id === actor.id) ?? active;
  const recovery = skill.recovery * 100 / effectiveSpeed(active);
  active = { ...active, nextActionAt: Math.max(active.nextActionAt, next.clock) + recovery };
  if (active.team === "enemy") active = { ...active, intentSkillId: nextIntent(active, next.actionCount) };
  next = { ...next, combatants: replaceUnit(next.combatants, active), lastEvents: actionEvents };
  const phase = terminalPhase(next.combatants);
  if (phase !== "active") {
    const history = [...actionEvents, ...next.history].slice(0, TURN_COMBAT_SYSTEM.historyLimit);
    return { ...next, phase, activeId: "", history, lastEvents: actionEvents };
  }
  next = beginNextTurn(next);
  const combinedEvents = next.lastEvents.length > actionEvents.length ? [...actionEvents, ...next.lastEvents.filter((event) => !actionEvents.includes(event))] : actionEvents;
  return { ...next, history: [...combinedEvents, ...next.history].slice(0, TURN_COMBAT_SYSTEM.historyLimit), lastEvents: combinedEvents };
}

export function resolveEnemyTurn(state: TurnBattleState) {
  const actor = state.combatants.find((unit) => unit.id === state.activeId);
  if (!actor || actor.team !== "enemy") return state;
  return resolveTurnAction(state, actor.intentSkillId ?? actor.skillIds[0] ?? "basic-attack", state.combatants.find((unit) => unit.team === "player" && alive(unit))?.id);
}

export function retreatTurnBattle(state: TurnBattleState) {
  return state.phase === "active" ? { ...state, phase: "retreated" as const, activeId: "" } : state;
}

function finishUtilityTurn(state: TurnBattleState, actor: CombatantState, recovery: number, events: CombatEvent[]) {
  const current = state.combatants.find((unit) => unit.id === actor.id) ?? actor;
  const advanced = { ...current, nextActionAt: Math.max(current.nextActionAt, state.clock) + recovery * 100 / effectiveSpeed(current) };
  let next = { ...state, combatants: replaceUnit(state.combatants, advanced), lastEvents: events };
  next = beginNextTurn(next);
  const combinedEvents = next.lastEvents.length > events.length ? [...events, ...next.lastEvents.filter((event) => !events.includes(event))] : events;
  return { ...next, history: [...combinedEvents, ...next.history].slice(0, TURN_COMBAT_SYSTEM.historyLimit), lastEvents: combinedEvents };
}

export function fleeChance(state: TurnBattleState) {
  const player = state.combatants.find((unit) => unit.team === "player");
  const enemySpeed = Math.max(0, ...state.combatants.filter((unit) => unit.team === "enemy" && alive(unit)).map(effectiveSpeed));
  if (!player) return 0;
  const config = TURN_COMBAT_ACTIONS.flee;
  return clamp(0.5 + (effectiveSpeed(player) - enemySpeed) * config.speedDeltaScale, config.minimumChance, config.maximumChance);
}

export function resolveFleeAction(state: TurnBattleState): UtilityActionResult {
  const actor = state.combatants.find((unit) => unit.id === state.activeId);
  if (state.phase !== "active" || !actor || actor.team !== "player") return { state, success: false };
  const chance = fleeChance(state);
  const roll = random(state.seed);
  const base: TurnBattleState = { ...state, seed: roll.seed, actionCount: state.actionCount + 1, lastEvents: [] };
  const event: CombatEvent = {
    id: eventId(base, 0), type: "flee", actorId: actor.id, skillId: "utility-flee",
    text: roll.value <= chance ? `身法判定成功（${Math.round(chance * 100)}%），你抽身离阵` : `身法判定失败（${Math.round(chance * 100)}%），退路被截断`,
    tone: roll.value <= chance ? "jade" : "danger",
  };
  if (roll.value <= chance) return { state: { ...base, phase: "retreated", activeId: "", lastEvents: [event], history: [event, ...state.history].slice(0, TURN_COMBAT_SYSTEM.historyLimit) }, success: true, chance };
  return { state: finishUtilityTurn(base, actor, TURN_COMBAT_ACTIONS.flee.recovery, [event]), success: false, chance };
}

export function resolveConsumableAction(state: TurnBattleState, item: CombatConsumableDefinition): UtilityActionResult {
  const actor = state.combatants.find((unit) => unit.id === state.activeId);
  if (state.phase !== "active" || !actor || actor.team !== "player") return { state, success: false };
  let unit = { ...actor, statuses: actor.statuses.map((status) => ({ ...status })) };
  const details: string[] = [];
  for (const effect of item.effects) {
    if (effect.healthRatio) {
      const amount = Math.min(unit.stats.health - unit.health, Math.round(unit.stats.health * effect.healthRatio));
      unit = { ...unit, health: Math.min(unit.stats.health, unit.health + amount) };
      if (amount > 0) details.push(`气血+${amount}`);
    }
    if (effect.manaRatio) {
      const amount = Math.min(unit.stats.mana - unit.mana, Math.round(unit.stats.mana * effect.manaRatio));
      unit = { ...unit, mana: Math.min(unit.stats.mana, unit.mana + amount) };
      if (amount > 0) details.push(`法力+${amount}`);
    }
    if (effect.postureRatio) {
      const amount = Math.min(unit.stats.posture - unit.posture, Math.round(unit.stats.posture * effect.postureRatio));
      unit = { ...unit, posture: Math.min(unit.stats.posture, unit.posture + amount) };
      if (amount > 0) details.push(`架势+${amount}`);
    }
    if (effect.cleanseDanger) {
      const before = unit.statuses.length;
      unit = { ...unit, statuses: unit.statuses.filter((status) => TURN_STATUS_MAP[status.id]?.tone !== "danger") };
      if (before !== unit.statuses.length) details.push("净除减益");
    }
    if (effect.statusId) {
      unit = addStatus(unit, effect.statusId, effect.duration ?? 1, actor.id);
      details.push(TURN_STATUS_MAP[effect.statusId]?.name ?? effect.statusId);
    }
  }
  const base: TurnBattleState = { ...state, actionCount: state.actionCount + 1, lastEvents: [], combatants: replaceUnit(state.combatants, unit) };
  const event: CombatEvent = { id: eventId(base, 0), type: "item", actorId: actor.id, targetId: actor.id, skillId: `item-${item.templateId}`, text: `${actor.name}服下丹药 · ${details.join("、") || item.summary}`, tone: "jade" };
  return { state: finishUtilityTurn(base, unit, item.recovery, [event]), success: true };
}

export function theftChance(state: TurnBattleState, targetId?: string) {
  const actor = state.combatants.find((unit) => unit.team === "player");
  const target = state.combatants.find((unit) => unit.id === targetId && unit.team === "enemy" && alive(unit));
  if (!actor || !target || target.templateId.includes("dummy")) return 0;
  const config = TURN_COMBAT_ACTIONS.steal;
  return clamp(config.baseChance + (actor.stats.finesse ?? 0) * config.finesseScale - target.stats.level * config.enemyLevelScale, config.minimumChance, config.maximumChance);
}

export function resolveStealAction(state: TurnBattleState, targetId?: string): UtilityActionResult {
  const actor = state.combatants.find((unit) => unit.id === state.activeId);
  const target = state.combatants.find((unit) => unit.id === targetId && unit.team === "enemy" && alive(unit));
  if (state.phase !== "active" || !actor || actor.team !== "player" || !target || target.templateId.includes("dummy") || state.theftAttemptedIds.includes(target.id)) return { state, success: false };
  const config = TURN_COMBAT_ACTIONS.steal;
  const chance = theftChance(state, target.id);
  let roll = random(state.seed);
  const success = roll.value <= chance;
  let nextSeed = roll.seed;
  let loot: UtilityActionResult["loot"];
  if (success) {
    roll = random(nextSeed); nextSeed = roll.seed;
    const special = config.specialLoot[target.templateId];
    if (special && roll.value <= config.specialChance) loot = { ...special };
    else {
      roll = random(nextSeed); nextSeed = roll.seed;
      if (roll.value <= config.treasureChance) {
        roll = random(nextSeed); nextSeed = roll.seed;
        const available = config.treasures.slice(0, Math.max(1, Math.min(config.treasures.length, 1 + Math.floor(actor.stats.level / 4))));
        loot = { ...available[Math.min(available.length - 1, Math.floor(roll.value * available.length))] };
      } else {
        roll = random(nextSeed); nextSeed = roll.seed;
        loot = { kind: "currency", name: "灵石", amount: Math.round(config.currencyBase + actor.stats.level * config.currencyPerLevel * (0.75 + roll.value * 0.5)), rarity: 1, description: "从敌人行囊中摸出的灵石。" };
      }
    }
  }
  const base: TurnBattleState = { ...state, seed: nextSeed, actionCount: state.actionCount + 1, lastEvents: [], theftAttemptedIds: [...state.theftAttemptedIds, target.id] };
  const event: CombatEvent = {
    id: eventId(base, 0), type: "steal", actorId: actor.id, targetId: target.id, skillId: "utility-steal",
    text: success && loot ? `妙手成功：从${target.name}处取得${loot.name}${loot.amount > 1 ? ` ×${loot.amount}` : ""}` : `妙手失手（${Math.round(chance * 100)}%），${target.name}护住了行囊`,
    tone: success ? (loot?.rarity && loot.rarity >= 5 ? "gold" : "jade") : "danger",
  };
  return { state: finishUtilityTurn(base, actor, config.recovery, [event]), success, chance, loot };
}

export function actionPreview(state: TurnBattleState, skillId: string, selectedTargetId?: string): ActionPreview {
  // The command deck always previews the player's locked battle snapshot, even
  // while an enemy is briefly resolving its telegraphed action.
  const actor = state.combatants.find((unit) => unit.team === "player")!;
  const skill = turnSkillById(skillId);
  const targets = targetsFor(state, actor, skill.target, selectedTargetId);
  const target = targets[0];
  const damageEffects = skill.effects.filter((effect) => effect.kind === "damage");
  const damage = target ? damageEffects.reduce((sum, effect) => sum + averageDamage(actor, target, skill, effect), 0) : 0;
  const formula = TURN_COMBAT_SYSTEM.formula;
  const posture = damageEffects.reduce((sum, effect) => {
    const groupScale = (effect.target ?? skill.target) === "all_enemies" ? formula.aoePowerScale : 1;
    return sum + (effect.posture ?? 0) * (1 + actor.stats.physicalPower / 500) * groupScale;
  }, 0);
  const hitChance = target ? clamp(actor.stats.hitChance + skill.accuracy - effectiveDodge(target), formula.minHitChance, formula.maxHitChance) : 1;
  const cost = manaCost(actor, skill);
  const notes = skill.effects.flatMap((effect) => effect.statusId ? [TURN_STATUS_MAP[effect.statusId]?.name ?? effect.statusId] : effect.kind === "heal" ? ["回复气血"] : effect.kind === "restore_posture" ? ["稳固架势"] : effect.kind === "delay" ? ["推迟气机"] : []);
  return {
    targetLabel: skill.target === "all_enemies" ? "敌方全体" : skill.target === "all_allies" ? "我方全体" : skill.target === "self" ? "自身" : target?.name ?? "选择目标",
    damageMin: Math.round(damage * formula.damageVarianceMin),
    damageMax: Math.round(damage * formula.damageVarianceMax * Math.max(1, actor.stats.critMultiplier)),
    posture: Math.round(posture),
    hitChance,
    manaCost: cost,
    recovery: Math.round(skill.recovery * 100 / effectiveSpeed(actor)),
    affordable: actor.mana >= cost,
    notes,
  };
}

export function timelineForecast(state: TurnBattleState, count = 6) {
  const living = state.combatants.filter(alive);
  const projected = living.flatMap((unit) => Array.from({ length: Math.max(1, Math.ceil(count / living.length)) + 1 }, (_, index) => ({
    unit,
    at: index === 0 ? unit.nextActionAt : unit.nextActionAt + index * TURN_COMBAT_SYSTEM.timelineThreshold * 100 / effectiveSpeed(unit),
  })));
  return projected.sort((a, b) => a.at - b.at).slice(0, count);
}
