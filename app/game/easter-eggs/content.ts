import easterEggContent from "../content/easter-eggs.json";
import easterEggInteractionContent from "../content/easter-egg-interactions.json";
import type { CharacterId, EventDefinition } from "../types";

export type EasterEggNoteCondition =
  | { type: "acquired" }
  | { type: "shown_to"; characterId: CharacterId }
  | { type: "shown_to_all"; characterIds: CharacterId[] };

export type EasterEggNoteDefinition = {
  id: string;
  text: string;
  condition: EasterEggNoteCondition;
};

export type EasterEggShowcaseLine = {
  speaker: "player" | "character" | "narrator";
  text: string;
  mood?: string;
};

export type EasterEggShowcaseDefinition = {
  characterId: CharacterId;
  title: string;
  subtitle: string;
  relationshipReward: number;
  lines: EasterEggShowcaseLine[];
};

export type EasterEggPresentationDefinition = {
  itemId: string;
  sourceLabel: string;
  notes: EasterEggNoteDefinition[];
  showTo: EasterEggShowcaseDefinition[];
};

/**
 * Scene secrets are authored outside runtime code so designers can expand the
 * collection without touching discovery, persistence or inventory rules.
 */
const authoredEasterEggEvents = (
  easterEggContent as unknown as { events: EventDefinition[] }
).events;

export const EASTER_EGG_EVENTS = authoredEasterEggEvents.map((event) => {
  const exploration = event.exploration;
  const rewardItem = exploration?.rewardItem;
  if (!rewardItem || rewardItem.image !== "/assets/easter-eggs/easter-egg-atlas.svg") return event;
  return {
    ...event,
    exploration: {
      ...exploration,
      rewardItem: { ...rewardItem, image: "/assets/easter-eggs/easter-egg-atlas-v2.webp" },
    },
  } satisfies EventDefinition;
});

export const EASTER_EGG_PRESENTATIONS = (
  easterEggInteractionContent as unknown as { items: EasterEggPresentationDefinition[] }
).items;

export function easterEggPresentationById(itemId: string) {
  return EASTER_EGG_PRESENTATIONS.find((item) => item.itemId === itemId);
}
