export type GatheringProfessionId = "fishing" | "farming" | "mining";
export type GatheringToolTrait = "stable" | "treasure" | "affinity" | "character";
export type GatheringRarity = 1 | 2 | 3 | 4 | 5;

export type GatheringDiscovery = {
  itemId: string; name: string; rarity: GatheringRarity; art: string; location: string; tags: string[]; discoveredAtTick: number;
};
export type GatheringCareerState = {
  experience: number; toolTier: GatheringRarity; selectedToolId: string; discoveries: Record<string, GatheringDiscovery>; displayed: Record<string, GatheringDiscovery>; harvestCount: number; processedCount: number;
};
export type GatheringProgress = { careers: Record<GatheringProfessionId, GatheringCareerState> };
export type GatheringOutcomeInput = {
  professionId: GatheringProfessionId; itemId: string; name: string; rarity: number; art: string; location: string; tick: number; seed: string; tags: string[];
};
