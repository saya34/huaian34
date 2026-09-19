import systemJson from "./content/system.json";
import skillJson from "./content/skills.json";
import statusJson from "./content/statuses.json";
import enemyJson from "./content/enemies.json";
import encounterJson from "./content/encounters.json";
import uiJson from "./content/ui.json";
import actionsJson from "./content/actions.json";
import visualsJson from "./content/visuals.json";
import { PRODUCTS } from "../alchemy/item-data";
import { manualById } from "../skills/manual-service";
import type { CombatInventoryStack, EncounterDefinition, EnemyDefinition, StatusDefinition, TurnCombatActions, TurnCombatSystem, TurnSkillDefinition, TurnSkillVisualDefinition } from "./types";

export const TURN_COMBAT_SYSTEM = systemJson as TurnCombatSystem;
export const TURN_COMBAT_UI = uiJson;
export const TURN_COMBAT_ACTIONS = actionsJson as TurnCombatActions;
export const TURN_SKILL_VISUALS = visualsJson.skillVisuals as Record<string, TurnSkillVisualDefinition>;
export const TURN_STATUSES = (statusJson.statuses as StatusDefinition[]);
export const TURN_STATUS_MAP = Object.fromEntries(TURN_STATUSES.map((status) => [status.id, status])) as Record<string, StatusDefinition>;

export const TURN_SKILLS = (skillJson.skills as TurnSkillDefinition[]).map((skill) => ({
  ...skill,
  art: skill.sourceSkillId ? manualById(skill.sourceSkillId).art : skill.art,
  visual: TURN_SKILL_VISUALS[skill.id]?.key ?? "ink-slash",
  effects: skill.id === "manual-10014" ? skill.effects.map((effect) => effect.statusId === "fortified" ? { ...effect, duration: 3 } : effect) : skill.effects,
}));
export const TURN_SKILL_MAP = Object.fromEntries(TURN_SKILLS.map((skill) => [skill.id, skill])) as Record<string, TurnSkillDefinition>;

export const TURN_ENEMIES = enemyJson.enemies as EnemyDefinition[];
export const TURN_ENEMY_MAP = Object.fromEntries(TURN_ENEMIES.map((enemy) => [enemy.id, enemy])) as Record<string, EnemyDefinition>;

export const TURN_ENCOUNTERS = encounterJson.encounters as EncounterDefinition[];
export const TURN_ENCOUNTER_MAP = Object.fromEntries(TURN_ENCOUNTERS.map((encounter) => [encounter.id, encounter])) as Record<string, EncounterDefinition>;

export function turnEncounterById(id: string) {
  return TURN_ENCOUNTER_MAP[id] ?? TURN_ENCOUNTERS[0];
}

export function turnSkillById(id: string) {
  return TURN_SKILL_MAP[id] ?? TURN_SKILL_MAP["basic-attack"];
}

export function turnCombatInventory(items: Record<string, { itemId: string; templateId?: string; itemType: string; rarity: number; amount: number; quality?: string; mutation?: string }>): CombatInventoryStack[] {
  return Object.values(items).flatMap((stack) => {
    if (stack.itemType !== "pill" || stack.amount <= 0) return [];
    const templateId = stack.templateId ?? stack.itemId;
    const definition = TURN_COMBAT_ACTIONS.consumables.find((entry) => entry.templateId === templateId);
    const item = PRODUCTS.find((entry) => entry.id === templateId);
    if (!definition || !item) return [];
    return [{ itemId: stack.itemId, templateId, name: item.name, art: item.image, rarity: stack.rarity, amount: stack.amount, quality: stack.quality, mutation: stack.mutation, definition }];
  });
}

export function validateTurnCombatContent() {
  const errors: string[] = [];
  for (const encounter of TURN_ENCOUNTERS) {
    for (const enemyId of encounter.enemyIds) if (!TURN_ENEMY_MAP[enemyId]) errors.push(`${encounter.id}: missing enemy ${enemyId}`);
  }
  for (const enemy of TURN_ENEMIES) {
    for (const skillId of enemy.skills) if (!TURN_SKILL_MAP[skillId]) errors.push(`${enemy.id}: missing skill ${skillId}`);
  }
  for (const skill of TURN_SKILLS) {
    for (const effect of skill.effects) if (effect.statusId && !TURN_STATUS_MAP[effect.statusId]) errors.push(`${skill.id}: missing status ${effect.statusId}`);
  }
  for (const pill of TURN_COMBAT_ACTIONS.consumables) if (!PRODUCTS.some((item) => item.id === pill.templateId)) errors.push(`missing combat pill ${pill.templateId}`);
  if (errors.length) throw new Error(`Turn combat content invalid:\n${errors.join("\n")}`);
  return true;
}

validateTurnCombatContent();
