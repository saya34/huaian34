import { createActivityReceipt } from "../core/activity-receipt";
import { reduceGameEffects } from "../core/game-state-reducer";
import type { UnifiedGameState, UnifiedItemStack } from "../core/types";
import { KITCHEN_RECIPES, kitchenFoodItemId, kitchenRecipeById } from "./content";
import type { KitchenProgress, KitchenRecipe, KitchenTransaction, RecipeAvailability } from "./types";

export function createInitialKitchen(): KitchenProgress {
  return { cookedCount: 0, mealsEaten: 0, discoveredRecipes: [], lastStoveSearchDay: 0, stoveFinds: 0 };
}

export function normalizeKitchen(value?: Partial<KitchenProgress> | null): KitchenProgress {
  const base = createInitialKitchen();
  return {
    cookedCount: Math.max(0, Math.trunc(Number(value?.cookedCount) || 0)),
    mealsEaten: Math.max(0, Math.trunc(Number(value?.mealsEaten) || 0)),
    discoveredRecipes: Array.isArray(value?.discoveredRecipes) ? [...new Set(value.discoveredRecipes.filter((id) => KITCHEN_RECIPES.some((recipe) => recipe.id === id)))] : base.discoveredRecipes,
    lastStoveSearchDay: Math.max(0, Math.trunc(Number(value?.lastStoveSearchDay) || 0)),
    stoveFinds: Math.max(0, Math.trunc(Number(value?.stoveFinds) || 0)),
  };
}

export function recipeAvailability(items: UnifiedGameState["shared"]["items"], recipe: KitchenRecipe): RecipeAvailability {
  const ingredients = recipe.ingredients.map((ingredient) => {
    const held = Math.max(0, items[ingredient.itemId]?.amount ?? 0);
    return { ...ingredient, held, missing: Math.max(0, ingredient.amount - held) };
  });
  return { ready: ingredients.every((ingredient) => ingredient.missing === 0), ingredients };
}

export function makeDishItem(recipe: KitchenRecipe): UnifiedItemStack {
  return {
    itemId: kitchenFoodItemId(recipe.id),
    templateId: recipe.id,
    itemType: "food",
    rarity: recipe.rarity,
    amount: 1,
    displayName: recipe.name,
    quality: recipe.rarity >= 5 ? "珍馐" : recipe.rarity >= 4 ? "上品" : "家常",
    sourceTags: ["烟火小灶", "王妈料理"],
  };
}

export function cookRecipe(state: UnifiedGameState, recipeId: string): KitchenTransaction {
  const recipe = kitchenRecipeById(recipeId);
  if (!recipe) return { ok: false, state, message: "这页菜谱已经模糊不清。" };
  const availability = recipeAvailability(state.shared.items, recipe);
  if (!availability.ready) {
    const missing = availability.ingredients.filter((entry) => entry.missing > 0).map((entry) => `${entry.name}×${entry.missing}`).join("、");
    return { ok: false, state, message: `还缺 ${missing}` };
  }
  const item = makeDishItem(recipe);
  const effects = [
    ...recipe.ingredients.map((ingredient) => ({ type: "remove_item" as const, itemId: ingredient.itemId, amount: ingredient.amount })),
    { type: "add_item" as const, item },
    { type: "record_activity" as const, receipt: createActivityReceipt({
      kind: "kitchen",
      title: `烹成 · ${recipe.name}`,
      summary: "田畴、灵兽苑与秘境所得已经在灶火中化作灵膳。",
      rewards: [`${recipe.name} ×1`],
      impacts: ["料理已收入食盒", "食用后将同步体力、修为与食运"],
      nextStep: { target: "kitchen", label: "查看食盒与料理功效" },
    }) },
  ];
  const next = reduceGameEffects(state, effects);
  const discoveredRecipes = [...new Set([...next.kitchen.discoveredRecipes, recipe.id])];
  return { ok: true, recipe, item, state: { ...next, kitchen: { ...next.kitchen, cookedCount: next.kitchen.cookedCount + 1, discoveredRecipes } } };
}

export function eatDish(state: UnifiedGameState, recipeId: string): KitchenTransaction {
  const recipe = kitchenRecipeById(recipeId);
  if (!recipe) return { ok: false, state, message: "没有找到这道料理。" };
  const itemId = kitchenFoodItemId(recipe.id);
  if ((state.shared.items[itemId]?.amount ?? 0) < 1) return { ok: false, state, message: "食盒里已经没有这道料理。" };
  const effects = [
    { type: "remove_item" as const, itemId, amount: 1 },
    ...(recipe.effects.stamina > 0 ? [{ type: "restore_stamina" as const, amount: recipe.effects.stamina }] : []),
    ...(recipe.effects.experience > 0 ? [{ type: "add_player_exp" as const, amount: recipe.effects.experience }] : []),
    ...(recipe.effects.luckCharges > 0 ? [{ type: "add_luck" as const, bonus: recipe.effects.luckBonus, charges: recipe.effects.luckCharges, source: recipe.name }] : []),
  ];
  const next = reduceGameEffects(state, effects);
  return { ok: true, recipe, item: makeDishItem(recipe), state: { ...next, kitchen: { ...next.kitchen, mealsEaten: next.kitchen.mealsEaten + 1 } } };
}

function hash(seed: string) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) value = Math.imul(value ^ seed.charCodeAt(index), 16777619);
  return (value >>> 0) / 4294967296;
}

export function searchWarmStove(state: UnifiedGameState, day: number) {
  if (state.kitchen.lastStoveSearchDay === day) return { ok: false as const, found: false, state, message: "今日的竹罩已经揭过了。" };
  const roll = hash(`wang-ma-stove:${day}:${state.kitchen.stoveFinds}`);
  const base = { ...state, kitchen: { ...state.kitchen, lastStoveSearchDay: day } };
  if (roll >= .42) return { ok: true as const, found: false, state: base, message: "竹罩下只留着一张王妈写的便笺：火要小，心要定。" };
  const recipe = KITCHEN_RECIPES[Math.floor(hash(`stove-dish:${day}`) * Math.min(4, KITCHEN_RECIPES.length))];
  const item = makeDishItem(recipe);
  const next = reduceGameEffects(base, [{ type: "add_item", item }]);
  return { ok: true as const, found: true, recipe, state: { ...next, kitchen: { ...next.kitchen, stoveFinds: next.kitchen.stoveFinds + 1, discoveredRecipes: [...new Set([...next.kitchen.discoveredRecipes, recipe.id])] } }, message: `竹罩下还温着一份${recipe.name}，已收入食盒。` };
}
