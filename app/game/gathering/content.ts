import professionsJson from "./content/professions.json";
import itemsJson from "./content/items.json";
import recipesJson from "./content/recipes.json";
import uiJson from "./content/ui.json";
import type { GatheringProfessionId, GatheringToolTrait } from "./types";
import type { UnifiedItemType } from "../core/types";

export type GatheringToolDefinition = { id:string; name:string; trait:GatheringToolTrait; traitName:string; description:string; minTier:number };
export type GatheringProfessionDefinition = { id:GatheringProfessionId; name:string; icon:string; toolName:string; collectionName:string; description:string; tools:GatheringToolDefinition[] };
export type GatheringCompanionDefinition = {
  id:string; name:string; description:string; itemType:UnifiedItemType; rarity:number; weight:number;
  value:number; art:string; tags:string[]; locked?:boolean; equipmentId?:string;
};
export type GatheringRecipe = { id:string; profession:GatheringProfessionId; name:string; place:string; requiredLevel:number; inputs:Array<{itemId:string;name:string;amount:number}>; output:{itemId:string;name:string;amount:number;rarity:number;tags:string[]} };

export const GATHERING_LEVEL_THRESHOLDS = professionsJson.levelThresholds;
export const GATHERING_RARITY_LABELS = professionsJson.rarityLabels;
export const GATHERING_PROFESSIONS = professionsJson.professions as GatheringProfessionDefinition[];
export const GATHERING_UPGRADES = professionsJson.upgrades;
export const GATHERING_COMPANION_POOLS = itemsJson.companionPools as Record<GatheringProfessionId, GatheringCompanionDefinition[]>;
export const GATHERING_ITEM_CATALOG = Object.values(GATHERING_COMPANION_POOLS).flat();
export const gatheringItemById = (id:string) => GATHERING_ITEM_CATALOG.find((entry)=>entry.id===id);
export const GATHERING_GIFT_DEFINITIONS = GATHERING_ITEM_CATALOG.filter((entry)=>entry.itemType==="gift").map((entry)=>({
  id:entry.id,name:entry.name,description:entry.description,icon:entry.name.slice(0,1),tags:entry.tags,image:entry.art,initialCount:0,
}));
export const GATHERING_RECIPES = recipesJson.recipes as GatheringRecipe[];
export const GATHERING_UI = uiJson;
export const gatheringProfession = (id:GatheringProfessionId) => GATHERING_PROFESSIONS.find((entry)=>entry.id===id)!;
