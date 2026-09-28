import type { FeedbackInput, FeedbackTone, ItemAcquiredPresentation } from "./types";

export type ItemAcquiredInput = ItemAcquiredPresentation & {
  rarity?: number;
  eventId?: string;
  dedupeKey?: string;
  presentationOwner?: string;
};

function toneForRarity(rarity = 1): FeedbackTone {
  return rarity >= 4 ? "gold" : rarity >= 2 ? "jade" : "muted";
}

/**
 * The single compact presentation used by ordinary item gains outside the
 * four gathering loops and mowing combat. Important first discoveries keep
 * their authored reveal and should not call this helper.
 */
export function itemAcquiredFeedback(input: ItemAcquiredInput): FeedbackInput {
  return {
    variant: "item-acquired",
    level: "L1",
    priority: 2,
    tone: toneForRarity(input.rarity),
    titleKey: "items.gainedTitle",
    durationMs: 2800,
    dismissPolicy: "auto",
    itemAcquired: {
      name: input.name,
      amount: Math.max(1, Math.floor(input.amount)),
      description: input.description,
      imageSrc: input.imageSrc,
      imagePosition: input.imagePosition,
    },
    eventId: input.eventId,
    dedupeKey: input.dedupeKey,
    presentationOwner: input.presentationOwner,
  };
}
