import { applyAutomaticGlobalKeys, resolveScenePresence, resolveSeekingEncounter } from "../world-engine";
import type { CharacterDefinition, EventDefinition, GameState, GlobalKeyDefinition, Period, SceneDefinition, SceneId } from "../types";
import { DAYBREAK_CONTENT } from "../daybreak/content";

export const WORLD_PERIODS: Period[] = ["清晨", "上午", "午后", "黄昏", "夜晚", "深夜"];
export type TimeAdvanceMode = "wait" | "rest" | "sleep";

export type PreparedSceneTransition = {
  state: GameState;
  forcedEvent?: EventDefinition;
  selectedCharacterId: GameState["selectedCharacterId"];
};

/**
 * Authoritative scene transition order:
 * destination -> automatic world keys -> presence -> selected resident -> forced event.
 */
export function prepareSceneTransition(input: {
  state: GameState;
  sceneId: SceneId;
  destination: SceneDefinition;
  characters: CharacterDefinition[];
  events: EventDefinition[];
  globalKeys: GlobalKeyDefinition[];
}): PreparedSceneTransition {
  const { state, sceneId, destination, characters, events, globalKeys } = input;
  const moved = applyAutomaticGlobalKeys({ ...state, sceneId, activeEvent: null }, globalKeys);
  if (destination.id === "spirit-farm") {
    return { state: moved, selectedCharacterId: moved.selectedCharacterId };
  }
  const presence = resolveScenePresence(moved, sceneId, characters, events, true);
  const selectedCharacterId = presence.present[0] ?? destination.characters[0] ?? state.selectedCharacterId;
  return {
    state: { ...presence.state, selectedCharacterId },
    forcedEvent: presence.forcedEvent,
    selectedCharacterId,
  };
}

export function previewTimeAdvance(state: GameState, mode: TimeAdvanceMode) {
  const current = Math.max(0, WORLD_PERIODS.indexOf(state.period));
  const wrapped = current === WORLD_PERIODS.length - 1;
  const period = mode === "sleep" ? "清晨" : WORLD_PERIODS[(current + 1) % WORLD_PERIODS.length];
  const day = mode === "sleep" ? state.day + 1 : state.day + (wrapped ? 1 : 0);
  const restCount = state.shortRestDay === state.day ? state.shortRestCount : 0;
  const restGain = Math.max(1, 3 - restCount);
  return { period, day, wrapped, restCount, restGain };
}

export type PreparedTimeTransition = {
  state: GameState;
  forcedEvent?: EventDefinition;
  seeking: ReturnType<typeof resolveSeekingEncounter>;
};

/**
 * Authoritative time transition order:
 * time/stamina -> automatic world keys -> presence -> forced event -> seeking encounter.
 * Ordinary time-change events are deliberately left to the caller as the final step.
 */
export function prepareTimeTransition(input: {
  state: GameState;
  mode: TimeAdvanceMode;
  characters: CharacterDefinition[];
  events: EventDefinition[];
  globalKeys: GlobalKeyDefinition[];
}): PreparedTimeTransition {
  const { state, mode, characters, events, globalKeys } = input;
  const preview = previewTimeAdvance(state, mode);
  const wakingAtHome = preview.day > state.day && preview.period === "清晨";
  const sceneId = wakingAtHome ? DAYBREAK_CONTENT.homeSceneId : state.sceneId;
  const stamina = mode === "sleep"
    ? 10
    : mode === "rest"
      ? Math.min(10, state.stamina + preview.restGain)
      : state.stamina;
  const timed = applyAutomaticGlobalKeys({
    ...state,
    period: preview.period,
    day: preview.day,
    sceneId,
    stamina,
    shortRestDay: mode === "sleep" || preview.wrapped ? preview.day : state.day,
    shortRestCount: mode === "sleep" || preview.wrapped ? 0 : mode === "rest" ? preview.restCount + 1 : preview.restCount,
  }, globalKeys);
  const presence = resolveScenePresence(timed, sceneId, characters, events, false);
  const ready = { ...presence.state, selectedCharacterId: presence.present[0] ?? state.selectedCharacterId };
  if (presence.forcedEvent) return { state: ready, forcedEvent: presence.forcedEvent, seeking: null };
  const seeking = resolveSeekingEncounter(ready, characters, events);
  return { state: seeking?.state ?? ready, seeking };
}
