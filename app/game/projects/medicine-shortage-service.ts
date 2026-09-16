import content from "./content/medicine-shortage.json";
import { inventoryCount, itemTemplateId } from "../core/item-query";
import type { GameEffect, UnifiedGameState, UnifiedItemType } from "../core/types";
import type { PathProjectRoute } from "../types";

export type PathProjectDestination = "farm" | "alchemy" | "character" | "market" | "battle";

type ProjectRequirement = {
  kind: "farm-harvest" | "item" | "relationship" | "battle-victory" | "battle-material";
  required: number;
  label: string;
  consume?: boolean;
  templateId?: string;
  itemType?: UnifiedItemType;
  characterId?: string;
};

export type ProjectAlchemyRecipe = {
  kicker: string;
  name: string;
  rank: string;
  description: string;
  resultTemplateId: string;
  ingredients: Array<{ templateId: string; quantity: number }>;
  shortcutLabel: string;
  buttonLabel: string;
  readyNotice: string;
  missingNotice: string;
};

export type MedicineRouteContent = {
  id: PathProjectRoute;
  glyph: string;
  name: string;
  role: string;
  description: string;
  result: string;
  requirements: ProjectRequirement[];
  actions: Array<{ target: PathProjectDestination; label: string; sceneId?: string; characterId?: string; waveId?: number }>;
  alchemyRecipe?: ProjectAlchemyRecipe;
};

export type MedicineRouteReadiness = {
  ready: boolean;
  progress: string;
  checks: Array<{ done: boolean; label: string; current: number; required: number }>;
};

export const MEDICINE_SHORTAGE_CONTENT = content;
export const MEDICINE_SHORTAGE_ROUTES = content.routes as MedicineRouteContent[];

export function activeMedicineShortageRecipe(state: UnifiedGameState) {
  if (state.romance.medicineShortage.status !== "active" || state.romance.medicineShortage.route !== "production") return null;
  return MEDICINE_SHORTAGE_ROUTES.find((route) => route.id === "production")?.alchemyRecipe ?? null;
}

function battleMaterialCount(state: UnifiedGameState) {
  return Object.values(state.shared.items).filter((item) => item.itemType === "material" && item.amount > 0 && item.sourceTags.includes("battle")).reduce((sum, item) => sum + item.amount, 0);
}

function requirementCurrent(state: UnifiedGameState, requirement: ProjectRequirement) {
  const project = state.romance.medicineShortage;
  if (requirement.kind === "farm-harvest") return Math.max(0, state.farm.totalHarvests - (project.farmHarvestsAtAccept ?? state.farm.totalHarvests));
  if (requirement.kind === "relationship") return state.romance.relationships[requirement.characterId ?? ""] ?? 0;
  if (requirement.kind === "battle-victory") return project.battleVictories;
  if (requirement.kind === "battle-material") return battleMaterialCount(state);
  return inventoryCount(state.shared.items, { templateId: requirement.templateId, itemType: requirement.itemType });
}

export function evaluateMedicineShortageRoutes(state: UnifiedGameState) {
  return Object.fromEntries(MEDICINE_SHORTAGE_ROUTES.map((route) => {
    const checks = route.requirements.map((requirement) => {
      const current = requirementCurrent(state, requirement);
      return { done: current >= requirement.required, label: requirement.label, current, required: requirement.required };
    });
    return [route.id, {
      ready: checks.every((check) => check.done),
      progress: checks.map((check) => `${check.label} ${Math.min(check.current, check.required)}/${check.required}`).join(" · "),
      checks,
    } satisfies MedicineRouteReadiness];
  })) as Record<PathProjectRoute, MedicineRouteReadiness>;
}

function removeTemplateEffects(state: UnifiedGameState, templateId: string, amount: number): GameEffect[] {
  let remaining = amount;
  const effects: GameEffect[] = [];
  for (const item of Object.values(state.shared.items).filter((entry) => entry.amount > 0 && itemTemplateId(entry) === templateId)) {
    if (remaining <= 0) break;
    const used = Math.min(remaining, item.amount);
    effects.push({ type: "remove_item", itemId: item.itemId, amount: used });
    remaining -= used;
  }
  return effects;
}

export function medicineShortageConsumptionEffects(state: UnifiedGameState, routeId: PathProjectRoute): GameEffect[] {
  const route = MEDICINE_SHORTAGE_ROUTES.find((entry) => entry.id === routeId);
  if (!route) return [];
  return route.requirements.flatMap((requirement) => {
    if (!requirement.consume) return [];
    if (requirement.kind === "item" && requirement.templateId) return removeTemplateEffects(state, requirement.templateId, requirement.required);
    if (requirement.kind === "battle-material") {
      const item = Object.values(state.shared.items).find((entry) => entry.itemType === "material" && entry.amount > 0 && entry.sourceTags.includes("battle"));
      return item ? [{ type: "remove_item" as const, itemId: item.itemId, amount: requirement.required }] : [];
    }
    return [];
  });
}

export function medicineShortageCompletionEffects(outcome: "stabilized" | "recovered"): GameEffect[] {
  const reward = outcome === "stabilized" ? content.completion.onTime : content.completion.recovery;
  return [
    { type: "add_currency", amount: reward.currency },
    { type: "add_relationship", characterId: "liu", amount: reward.relationship },
    { type: "add_item", item: { ...content.completion.rewardItem, itemType: "quest", rarity: 4 } },
    { type: "set_global_key", key: content.completion.globalKey, value: true },
  ];
}

export function medicineShortageCompletionNotice(outcome: "stabilized" | "recovered") {
  return outcome === "stabilized" ? content.completion.onTime.notice : content.completion.recovery.notice;
}
