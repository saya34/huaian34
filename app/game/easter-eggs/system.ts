import type { EventDefinition, GameState, TriggerContext } from "../types";
import type { EasterEggNoteDefinition, EasterEggPresentationDefinition, EasterEggShowcaseDefinition } from "./content";

export function isEasterEggItem(item: { itemType: string; sourceTags: string[] }) {
  return item.itemType === "quest" && item.sourceTags.includes("藏珍录");
}

function noteConditionMet(note: EasterEggNoteDefinition, shownTo: string[]) {
  if (note.condition.type === "acquired") return true;
  if (note.condition.type === "shown_to") return shownTo.includes(note.condition.characterId);
  return note.condition.characterIds.every((characterId) => shownTo.includes(characterId));
}

export function revealEligibleEasterEggNotes(
  state: GameState,
  definition: EasterEggPresentationDefinition,
) {
  const current = state.easterEggProgress[definition.itemId] ?? {
    acquiredDay: state.day,
    shownTo: [],
    unlockedNoteIds: [],
  };
  const newlyUnlocked = definition.notes
    .filter((note) => !current.unlockedNoteIds.includes(note.id) && noteConditionMet(note, current.shownTo))
    .map((note) => note.id);
  if (!newlyUnlocked.length) return { state, newlyUnlocked };
  return {
    state: {
      ...state,
      easterEggProgress: {
        ...state.easterEggProgress,
        [definition.itemId]: {
          ...current,
          unlockedNoteIds: [...current.unlockedNoteIds, ...newlyUnlocked],
        },
      },
    },
    newlyUnlocked,
  };
}

export function markEasterEggShown(state: GameState, itemId: string, characterId: string) {
  const current = state.easterEggProgress[itemId] ?? {
    acquiredDay: state.day,
    shownTo: [],
    unlockedNoteIds: [],
  };
  if (current.shownTo.includes(characterId)) return state;
  return {
    ...state,
    easterEggProgress: {
      ...state.easterEggProgress,
      [itemId]: { ...current, shownTo: [...current.shownTo, characterId] },
    },
  };
}

export function availableEasterEggShowcases(
  ownedItemIds: string[],
  characterId: string,
  state: GameState,
  definitions: EasterEggPresentationDefinition[],
) {
  const owned = new Set(ownedItemIds);
  return definitions.flatMap((definition) => {
    if (!owned.has(definition.itemId)) return [];
    if (state.easterEggProgress[definition.itemId]?.shownTo.includes(characterId)) return [];
    const showcase = definition.showTo.find((entry) => entry.characterId === characterId);
    return showcase ? [{ definition, showcase }] : [];
  });
}

export function buildEasterEggShowcaseEvent(
  definition: EasterEggPresentationDefinition,
  showcase: EasterEggShowcaseDefinition,
  context: TriggerContext,
): EventDefinition {
  const nodes: EventDefinition["nodes"] = {};
  showcase.lines.forEach((line, index) => {
    const id = `line-${index + 1}`;
    const isLast = index === showcase.lines.length - 1;
    nodes[id] = {
      id,
      type: "line",
      speaker: line.speaker === "character" ? showcase.characterId : line.speaker,
      text: line.text,
      mood: line.mood,
      next: isLast ? "end" : `line-${index + 2}`,
      ...(isLast && showcase.relationshipReward > 0 ? {
        effects: [{ type: "relationship", characterId: showcase.characterId, amount: showcase.relationshipReward }],
      } : {}),
    };
  });
  nodes.end = { id: "end", type: "end", summary: `你向对方展示了${definition.sourceLabel}。` };
  return {
    id: `easter-showcase.${definition.itemId}.${showcase.characterId}`,
    title: showcase.title,
    subtitle: showcase.subtitle,
    chapter: "藏珍物语",
    type: "闲谈",
    trigger: "interaction",
    priority: 0,
    once: false,
    journal: false,
    sceneId: context.sceneId,
    characterId: showcase.characterId,
    conditions: [],
    clue: "",
    start: "line-1",
    nodes,
  };
}
