import { chooseEvent, getEligibleEvents } from "./event-engine";
import type { EventDefinition, GameState, SceneId, TriggerContext } from "./types";

export function eligibleInspectionEvents(state: GameState, events: EventDefinition[], sceneId: SceneId) {
  const preview = { ...state, sceneId };
  const context: TriggerContext = { trigger: "inspection", sceneId };
  return getEligibleEvents(events, preview, context);
}

export function getInspectionHints(state: GameState, events: EventDefinition[], sceneIds: SceneId[]) {
  const hints = new Set<SceneId>();
  if (state.period !== "夜晚") return hints;
  for (const sceneId of sceneIds) {
    if (state.sceneInspectionDays?.[sceneId] === state.day) continue;
    if (eligibleInspectionEvents(state, events, sceneId).length > 0) hints.add(sceneId);
  }
  return hints;
}

export function rollInspectionEvent(state: GameState, events: EventDefinition[], sceneId: SceneId, random = Math.random) {
  const passed = eligibleInspectionEvents(state, events, sceneId).filter((event) => random() * 100 < (event.inspection?.chance ?? 100));
  return chooseEvent(passed);
}
