import { GameItem, ItemQuality } from "./item-data";

export type MarketOffer = {
  id: string;
  itemId: string;
  sold: boolean;
};

export const MARKET_SIZE = 6;
export const MARKET_RESET_MS = 120_000;
export const SOLD_OUT_REFRESH_MS = 10_000;
export const STARTING_GOLD = 50_000;

export const MARKET_QUALITY_WEIGHTS: Record<ItemQuality, number> = {
  凡品: 50,
  良品: 30,
  珍品: 14,
  极品: 5,
  神品: 1,
  神话: 0,
};

const QUALITIES = Object.keys(MARKET_QUALITY_WEIGHTS) as ItemQuality[];

export function getManualRefreshPrice(refreshCount: number) {
  if (refreshCount <= 0) return 0;
  return 500 + (refreshCount - 1) * 250;
}

export function getMarketPrice(item: GameItem) {
  return Math.max(80, Math.round((item.price * 0.55) / 10) * 10);
}

export function rollMarketOffers(materials: GameItem[], random = Math.random): MarketOffer[] {
  const remaining = materials.filter((item) => item.quality !== "神话");
  const offers: MarketOffer[] = [];

  while (offers.length < MARKET_SIZE && remaining.length > 0) {
    const availableQualities = QUALITIES.filter((quality) => remaining.some((item) => item.quality === quality));
    const totalWeight = availableQualities.reduce((sum, quality) => sum + MARKET_QUALITY_WEIGHTS[quality], 0);
    let qualityRoll = random() * totalWeight;
    const selectedQuality = availableQualities.find((quality) => {
      qualityRoll -= MARKET_QUALITY_WEIGHTS[quality];
      return qualityRoll < 0;
    }) ?? availableQualities[0];
    const candidates = remaining.filter((item) => item.quality === selectedQuality);
    const item = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
    offers.push({ id: `${Date.now()}-${offers.length}-${item.id}`, itemId: item.id, sold: false });
    remaining.splice(remaining.findIndex((candidate) => candidate.id === item.id), 1);
  }

  return offers;
}
