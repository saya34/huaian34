import { checkCondition, getEligibleEvents, isExplorationEvent } from "./event-engine";
import type { EventDefinition, GameState, SceneId, TriggerContext } from "./types";

export function scheduleMapEvents(state: GameState, definitions: EventDefinition[], random = Math.random): GameState {
  const schedules = { ...(state.mapEventSchedules ?? {}) };
  let changed = false;
  for (const event of definitions) {
    if (event.trigger !== "map_event" || !event.mapEvent || state.completedEvents.includes(event.id) || schedules[event.id] !== undefined) continue;
    const context: TriggerContext = { trigger: "map_event", sceneId: event.sceneId, characterId: event.characterId };
    if (!event.conditions.every((condition) => checkCondition(condition, state, context))) continue;
    const windowDays = Math.max(1, Math.floor(event.mapEvent.windowDays || 10));
    schedules[event.id] = state.day + 1 + Math.floor(Math.max(0, Math.min(.999999, random())) * windowDays);
    changed = true;
  }
  return changed ? { ...state, mapEventSchedules: schedules } : state;
}

export function getVisibleMapEvents(state: GameState, definitions: EventDefinition[]) {
  return definitions.filter((event) => {
    const scheduledDay = state.mapEventSchedules?.[event.id];
    return event.trigger === "map_event" && event.mapEvent && scheduledDay !== undefined && scheduledDay <= state.day && !state.completedEvents.includes(event.id);
  });
}

export function getSceneEventHints(state: GameState, definitions: EventDefinition[], sceneIds: SceneId[]) {
  const result = new Set<SceneId>();
  for (const sceneId of sceneIds) {
    const presentCharacters = { ...state.presentCharacters };
    delete presentCharacters[sceneId];
    const previewState = { ...state, sceneId, presentCharacters };
    const context: TriggerContext = { trigger: "scene_enter", sceneId };
    const eligible = getEligibleEvents(definitions, previewState, context).some((event) => !isExplorationEvent(event));
    if (eligible) result.add(sceneId);
  }
  return result;
}
