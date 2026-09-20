import type { UnifiedItemStack, UnifiedRarity } from "../core/types";

export type KitchenIngredient = {
  itemId: string;
  name: string;
  amount: number;
  art: string;
};

export type KitchenDishEffects = {
  stamina: number;
  experience: number;
  luckBonus: number;
  luckCharges: number;
};

export type KitchenRecipe = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  art: string;
  rarity: UnifiedRarity;
  ingredients: KitchenIngredient[];
  effects: KitchenDishEffects;
};

export type KitchenProgress = {
  cookedCount: number;
  mealsEaten: number;
  discoveredRecipes: string[];
  lastStoveSearchDay: number;
  stoveFinds: number;
};

export type LuckBlessing = {
  bonus: number;
  charges: number;
  source: string;
};

export type RecipeAvailability = {
  ready: boolean;
  ingredients: Array<KitchenIngredient & { held: number; missing: number }>;
};

export type KitchenTransaction =
  | { ok: true; state: import("../core/types").UnifiedGameState; recipe: KitchenRecipe; item: UnifiedItemStack }
  | { ok: false; state: import("../core/types").UnifiedGameState; message: string };
