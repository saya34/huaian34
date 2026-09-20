import { MATERIALS } from "../alchemy/item-data";
import { TREASURES } from "../battle/expedition";
import { SPIRIT_BEASTS } from "../farm/livestock";
import { FISH } from "../fishing/fishing";
import kitchenJson from "./content/kitchen.json";
import type { KitchenRecipe } from "./types";

type RawIngredient = { itemId?: string; materialName?: string; amount: number };
type RawRecipe = Omit<KitchenRecipe, "ingredients"> & { ingredients: RawIngredient[] };

function resolveIngredient(raw: RawIngredient) {
  const material = raw.materialName ? MATERIALS.find((entry) => entry.name === raw.materialName) : undefined;
  const itemId = material?.id ?? raw.itemId ?? "";
  const livestock = SPIRIT_BEASTS.find((entry) => entry.productId === itemId);
  const fish = FISH.find((entry) => entry.id === itemId);
  const treasure = itemId.startsWith("treasure:") ? TREASURES.find((entry) => entry.id === itemId.slice(9)) : undefined;
  return {
    itemId,
    name: material?.name ?? livestock?.productName ?? fish?.name ?? treasure?.name ?? itemId,
    amount: raw.amount,
    art: material?.image ?? livestock?.productArt ?? fish?.art ?? treasure?.art ?? "/assets/items/item-05.webp",
  };
}

export const KITCHEN_COPY = kitchenJson.scene;
export const KITCHEN_UI = kitchenJson.ui;
export const KITCHEN_RECIPES: KitchenRecipe[] = (kitchenJson.recipes as RawRecipe[]).map((recipe) => ({
  ...recipe,
  rarity: Math.max(1, Math.min(7, recipe.rarity)) as KitchenRecipe["rarity"],
  ingredients: recipe.ingredients.map(resolveIngredient),
}));

export const kitchenRecipeById = (id: string) => KITCHEN_RECIPES.find((recipe) => recipe.id === id);
export const kitchenFoodItemId = (recipeId: string) => `food:${recipeId}`;
export const kitchenRecipeByItemId = (itemId: string) => itemId.startsWith("food:") ? kitchenRecipeById(itemId.slice(5)) : undefined;
