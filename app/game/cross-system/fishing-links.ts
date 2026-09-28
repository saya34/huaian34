import { MATERIALS, PRODUCTS, type RecipeRule } from "../alchemy/item-data";
import type { UnifiedItemStack } from "../core/types";
import type { HerbCropId } from "../farm/farm";
import { FISH, type ChumId, type FishDefinition, type FishingLinkProgress, type FishingLinkToolId, type FishingLocationId } from "../fishing/fishing";
import content from "./content/fishing-links.json";

type PreparedChumRecipe = { chumId: ChumId; materialName: string; servings: number; label: string };
type LinkTool = { id: FishingLinkToolId; name: string; icon: string; description: string; materials: Array<{ materialName: string; amount: number }>; effect: "stable" | "deep" | "treasure" };
type FishableSeed = { id: string; cropId: HerbCropId; name: string; amount: number; unlockAtCatch: number; locations: FishingLocationId[]; description: string };
type Relic = { id: string; name: string; description: string; image: string; rarity: 1|2|3|4|5|6|7; unlockAtCatch: number; characterIds: string[]; relationshipGain: number; reaction: string };
type FishGift = { fishId: string; characterIds: string[]; relationshipGain: number; reaction: string };
type NpcIntel = { id: string; characterId: string; minimumRelationship: number; locationId: FishingLocationId; name: string; hint: string; reaction: string };

export const FISHING_LINK_CONTENT = content as unknown as {
  version: number;
  preparedChums: PreparedChumRecipe[];
  fishableSeeds: FishableSeed[];
  fishFertilizer: { id: "scale-compost"; name: string; eligibleFishIds: string[]; fishCost: number; output: number; description: string };
  fishingTools: LinkTool[];
  miningPond: { locationId: FishingLocationId; unlockAfterMinedTiles: number; discoveryId: string; name: string; description: string };
  miningClue: { id: string; name: string; description: string; rarity: 3; unlockAtCatch: number; repeatChance: number; image: string };
  fishPearl: { id: string; materialName: string; name: string; description: string; unlockAtCatch: number; minimumFishRarity: number; repeatChance: number };
  alchemyRecipe: { id: string; scrollItemId: string; name: string; resultName: string; ingredientNames: string[]; unlockAtCatch: number; description: string; image: string };
  fullManual: { discoveryId: string; itemId: string; name: string; unlockAtCatch: number; description: string };
  relics: Relic[];
  fishGifts: FishGift[];
  npcFishingIntel: NpcIntel[];
};

export type FishingLinkDiscovery = {
  id: string;
  kind: "seed" | "pearl" | "mining-clue" | "alchemy-recipe" | "relic";
  name: string;
  description: string;
  image: string;
  item?: UnifiedItemStack;
  seed?: { cropId: HerbCropId; amount: number };
  recipeId?: string;
  miningClues?: number;
};

export function stableLinkHash(seed: string) {
  let value = 2166136261;
  for (const char of seed) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) / 4294967296;
}

export function chumRecipe(chumId: ChumId) { return FISHING_LINK_CONTENT.preparedChums.find((entry) => entry.chumId === chumId); }
export function fishingTool(toolId: FishingLinkToolId) { return FISHING_LINK_CONTENT.fishingTools.find((entry) => entry.id === toolId)!; }
export function fishingToolMaterials(toolId: FishingLinkToolId) {
  return fishingTool(toolId).materials.map((requirement) => ({ ...requirement, item: MATERIALS.find((item) => item.name === requirement.materialName)! }));
}
export function fishFertilizerCandidate(items: Record<string, { amount: number }>) {
  return FISHING_LINK_CONTENT.fishFertilizer.eligibleFishIds.map((id) => ({ fish: FISH.find((entry) => entry.id === id), amount: items[id]?.amount ?? 0 })).find((entry) => entry.fish && entry.amount >= FISHING_LINK_CONTENT.fishFertilizer.fishCost);
}
export function fishFeedCandidate(items: Record<string, { amount: number }>) {
  return FISHING_LINK_CONTENT.fishFertilizer.eligibleFishIds.map((id) => ({ fish: FISH.find((entry) => entry.id === id), amount: items[id]?.amount ?? 0 })).find((entry) => entry.fish && entry.amount > 0);
}
export function acceptsFishFeed(speciesId: string) { return speciesId === "jade-frog" || speciesId === "moonfeather-hen"; }

function linkItem(itemId: string, itemType: UnifiedItemStack["itemType"], rarity: UnifiedItemStack["rarity"], sourceTags: string[], displayName?: string): UnifiedItemStack {
  return { itemId, itemType, rarity, amount: 1, sourceTags, ...(displayName ? { displayName } : {}) };
}

export function resolveFishingLinkDiscovery(input: { links: FishingLinkProgress; catchNumber: number; fish: FishDefinition; locationId: FishingLocationId; seed: string }): { links: FishingLinkProgress; discovery: FishingLinkDiscovery | null } {
  const { links, catchNumber, fish, locationId, seed } = input;
  const discovered = new Set(links.discoveredIds);
  const mark = (id: string) => ({ ...links, discoveredIds: [...discovered, id] });
  const seedReward = FISHING_LINK_CONTENT.fishableSeeds.find((entry) => !discovered.has(entry.id) && catchNumber >= entry.unlockAtCatch && entry.locations.includes(locationId));
  if (seedReward) return { links: mark(seedReward.id), discovery: { id: seedReward.id, kind: "seed", name: seedReward.name, description: seedReward.description, image: "/assets/items/item-07.webp", seed: { cropId: seedReward.cropId, amount: seedReward.amount } } };

  const pearl = FISHING_LINK_CONTENT.fishPearl;
  if (!discovered.has(pearl.id) && catchNumber >= pearl.unlockAtCatch && fish.rarity >= pearl.minimumFishRarity) {
    const material = MATERIALS.find((item) => item.name === pearl.materialName)!;
    return { links: mark(pearl.id), discovery: { id: pearl.id, kind: "pearl", name: pearl.name, description: pearl.description, image: material.image, item: linkItem(material.id, "material", Math.min(7, material.rarity) as UnifiedItemStack["rarity"], ["钓鱼联动", "鱼珠", "炼丹"], material.name) } };
  }

  const clue = FISHING_LINK_CONTENT.miningClue;
  if (!discovered.has(clue.id) && catchNumber >= clue.unlockAtCatch) {
    const next = mark(clue.id);
    return { links: { ...next, miningClues: next.miningClues + 1 }, discovery: { id: clue.id, kind: "mining-clue", name: clue.name, description: clue.description, image: clue.image, miningClues: 1, item: linkItem(clue.id, "quest", clue.rarity, ["钓鱼联动", "矿洞线索"], clue.name) } };
  }

  const recipe = FISHING_LINK_CONTENT.alchemyRecipe;
  if (!discovered.has(recipe.id) && catchNumber >= recipe.unlockAtCatch) {
    return { links: mark(recipe.id), discovery: { id: recipe.id, kind: "alchemy-recipe", name: recipe.name, description: recipe.description, image: recipe.image, recipeId: recipe.id, item: linkItem(recipe.scrollItemId, "quest", 4, ["钓鱼联动", "丹方"], recipe.name) } };
  }

  const relic = FISHING_LINK_CONTENT.relics.find((entry) => !discovered.has(entry.id) && catchNumber >= entry.unlockAtCatch);
  if (relic) return { links: mark(relic.id), discovery: { id: relic.id, kind: "relic", name: relic.name, description: relic.description, image: relic.image, item: linkItem(relic.id, "quest", relic.rarity, ["钓鱼联动", "人物遗物", ...relic.characterIds], relic.name) } };

  const toolBonus = fishingTool(links.activeToolId).effect === "treasure" ? .14 : 0;
  const roll = stableLinkHash(`${seed}:repeat-link:${catchNumber}`);
  if (fish.rarity >= pearl.minimumFishRarity && roll < pearl.repeatChance + toolBonus) {
    const material = MATERIALS.find((item) => item.name === pearl.materialName)!;
    return { links, discovery: { id: `${pearl.id}-repeat-${catchNumber}`, kind: "pearl", name: pearl.name, description: pearl.description, image: material.image, item: linkItem(material.id, "material", Math.min(7, material.rarity) as UnifiedItemStack["rarity"], ["钓鱼联动", "鱼珠", "炼丹"], material.name) } };
  }
  if (roll > .86 - toolBonus && roll < .86 + clue.repeatChance + toolBonus) {
    return { links: { ...links, miningClues: links.miningClues + 1 }, discovery: { id: `${clue.id}-repeat-${catchNumber}`, kind: "mining-clue", name: clue.name, description: clue.description, image: clue.image, miningClues: 1, item: linkItem(clue.id, "quest", clue.rarity, ["钓鱼联动", "矿洞线索"], clue.name) } };
  }
  return { links, discovery: null };
}

export function fishingAlchemyRecipeRule(): RecipeRule {
  const definition = FISHING_LINK_CONTENT.alchemyRecipe;
  return {
    id: definition.id,
    name: definition.name,
    resultItemId: PRODUCTS.find((item) => item.name === definition.resultName)!.id,
    enabled: true,
    priority: 180,
    weight: 100,
    minMaterialCount: definition.ingredientNames.length,
    requiredItems: definition.ingredientNames.map((name) => ({ itemId: MATERIALS.find((item) => item.name === name)!.id, quantity: 1 })),
    elementRequirements: [],
  };
}

export function fishGiftFor(characterId: string, fishId: string) { return FISHING_LINK_CONTENT.fishGifts.find((entry) => entry.fishId === fishId && entry.characterIds.includes(characterId)); }
export function ownedFishGifts(characterId: string, items: Record<string, { amount: number }>) {
  return FISHING_LINK_CONTENT.fishGifts.flatMap((entry) => entry.characterIds.includes(characterId) && (items[entry.fishId]?.amount ?? 0) > 0 ? [{ ...entry, fish: FISH.find((fish) => fish.id === entry.fishId)! }] : []);
}
export function availableRelicFor(characterId: string, items: Record<string, { amount: number }>, links: FishingLinkProgress) {
  return FISHING_LINK_CONTENT.relics.find((entry) => entry.characterIds.includes(characterId) && (items[entry.id]?.amount ?? 0) > 0 && !(links.relicsShownTo[entry.id] ?? []).includes(characterId));
}
export function npcFishingIntel(characterId: string, relationship: number) { return FISHING_LINK_CONTENT.npcFishingIntel.find((entry) => entry.characterId === characterId && relationship >= entry.minimumRelationship); }
