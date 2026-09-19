import { chooseEvent, getEligibleEvents } from "./event-engine";
import type { EventDefinition, GameState, Period, SceneId, TriggerContext } from "./types";

export const canInspectPeriod = (period: Period) => period === "夜晚" || period === "深夜";
export const inspectionSlot = (day: number, period: Period) => `${day}:${period}`;
export const hasInspectedScene = (state: GameState, sceneId: SceneId) => state.sceneInspectionSlots?.[sceneId] === inspectionSlot(state.day, state.period);

export function eligibleInspectionEvents(state: GameState, events: EventDefinition[], sceneId: SceneId) {
  if (!canInspectPeriod(state.period) || hasInspectedScene(state, sceneId)) return [];
  const preview = { ...state, sceneId };
  const context: TriggerContext = { trigger: "inspection", sceneId };
  return getEligibleEvents(events, preview, context);
}

export function getInspectionHints(state: GameState, events: EventDefinition[], sceneIds: SceneId[]) {
  const hints = new Set<SceneId>();
  if (!canInspectPeriod(state.period)) return hints;
  for (const sceneId of sceneIds) {
    if (hasInspectedScene(state, sceneId)) continue;
    if (eligibleInspectionEvents(state, events, sceneId).length > 0) hints.add(sceneId);
  }
  return hints;
}

export function rollInspectionEvent(state: GameState, events: EventDefinition[], sceneId: SceneId, random = Math.random) {
  const passed = eligibleInspectionEvents(state, events, sceneId).filter((event) => random() * 100 < (event.inspection?.chance ?? 100));
  return chooseEvent(passed);
}
