import type {
  ActiveEvent,
  CharacterDefinition,
  Condition,
  Effect,
  EventDefinition,
  EventNode,
  GameState,
  TriggerContext,
} from "./types";

export const INITIAL_STATE: GameState = {
  day: 1,
  period: "清晨",
  sceneId: "lingxiao",
  selectedCharacterId: "shen",
  spiritStones: 600,
  stamina: 10,
  experience: 0,
  marketTreasures: {},
  activityNotices: [],
  relationships: { shen: 4, su: 4, liu: 4, hua: 4 },
  inventory: { snowTea: 2, peachWine: 2, herbSachet: 2, goldHairpin: 2, osmanthusCake: 4 },
  flags: {},
  announcedGlobalKeys: [],
  receivedMessages: [],
  claimedMessages: [],
  discoveredGiftPreferences: {},
  seekingEncounterDays: {},
  mapEventSchedules: {},
  calendarEventRuns: {},
  collectedEasterEggs: [],
  completedEvents: [],
  eventRuns: {},
  talkCounts: {},
  presentCharacters: {},
  appearanceTriggersUsed: [],
  sceneVisits: {},
  sceneInspectionDays: {},
  interactionCounts: {},
  proficiencyExperience: {},
  activeEvent: null,
  lastContext: null,
};

export function checkCondition(condition: Condition, state: GameState, context: TriggerContext) {
  switch (condition.type) {
    case "scene":
      return context.sceneId === condition.value;
    case "character":
      return context.characterId === condition.value;
    case "gift":
      return context.giftId === condition.value;
    case "period":
      return state.period === condition.value;
    case "relationship":
      return state.relationships[condition.characterId] >= condition.min;
    case "event_completed":
      return state.completedEvents.includes(condition.eventId);
    case "flag":
      return Boolean(state.flags[condition.key]) === condition.value;
    case "player_level":
      return (state.playerLevel ?? 1) >= condition.min;
    case "teacher_skill":
      return (state.teacherSkillRanks?.[condition.skillId] ?? 0) >= condition.minRank;
    case "learned_skill":
      return (state.learnedSkillIds ?? []).includes(condition.skillId);
    case "card_owned":
      return (state.ownedCardIds ?? []).includes(condition.cardId);
    case "item_rarity":
      return Object.values(state.inventoryRarities ?? {}).some((rarity) => rarity >= condition.minRarity);
    case "dungeon_complete":
      return (state.completedDungeons ?? []).includes(condition.waveId);
    case "alchemy_result":
      return (state.alchemyResults ?? []).includes(condition.itemId);
  }
}

export function getEligibleEvents(
  definitions: EventDefinition[],
  state: GameState,
  context: TriggerContext,
) {
  return definitions
    .filter((event) => event.trigger === context.trigger)
    .filter((event) => !event.interactionId || event.interactionId === context.interactionId)
    .filter((event) => !event.once || !state.completedEvents.includes(event.id))
    .filter((event) => {
      // Scene entry and time changes are world actions, not conversations with
      // one specific NPC. Evaluate each event against its owning character so
      // an event is not accidentally blocked just because another resident was
      // selected first. A character event can still only fire while that NPC is
      // present in the current scene.
      const isWorldTrigger = context.trigger === "scene_enter" || context.trigger === "time_change" || context.trigger === "inspection";
      const requiresPresence = context.trigger === "scene_enter" || context.trigger === "time_change";
      const present = state.presentCharacters[context.sceneId];
      if (requiresPresence && !isExplorationEvent(event) && present?.length && !present.includes(event.characterId)) return false;
      const scopedContext = isWorldTrigger ? { ...context, characterId: event.characterId } : context;
      return event.conditions.every((condition) => checkCondition(condition, state, scopedContext));
    })
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

export function isExplorationEvent(event: EventDefinition) {
  return event.cardStyle === "easter_egg" || event.cardStyle === "trigger_point";
}

export function chooseEvent(events: EventDefinition[]) {
  if (!events.length) return null;
  const topPriority = events[0].priority;
  const top = events.filter((event) => event.priority === topPriority);
  if (top.length === 1) return top[0];
  const total = top.reduce((sum, event) => sum + (event.weight ?? 1), 0);
  let cursor = Math.random() * total;
  for (const event of top) {
    cursor -= event.weight ?? 1;
    if (cursor <= 0) return event;
  }
  return top[0];
}

export function applyEffects(state: GameState, effects: Effect[] = []): GameState {
  return effects.reduce<GameState>((next, effect) => {
    if (effect.type === "relationship") {
      return {
        ...next,
        relationships: {
          ...next.relationships,
          [effect.characterId]: Math.max(0, Math.min(100, (next.relationships[effect.characterId] ?? 0) + effect.amount)),
        },
      };
    }
    if (effect.type === "set_flag") {
      return { ...next, flags: { ...next.flags, [effect.key]: effect.value } };
    }
    if (effect.type === "consume_gift") return {
      ...next,
      inventory: {
        ...next.inventory,
        [effect.giftId]: Math.max(0, next.inventory[effect.giftId] - effect.amount),
      },
    };
    return { ...next, pendingUnifiedEffects: [...(next.pendingUnifiedEffects ?? []), effect] };
  }, state);
}

export function startDefinition(state: GameState, event: EventDefinition, context: TriggerContext): GameState {
  return {
    ...state,
    activeEvent: { eventId: event.id, nodeId: event.start },
    lastContext: context,
    eventRuns: { ...state.eventRuns, [event.id]: (state.eventRuns[event.id] ?? 0) + 1 },
  };
}

export function startTransient(state: GameState, event: EventDefinition, context: TriggerContext): GameState {
  return {
    ...state,
    activeEvent: { eventId: event.id, nodeId: event.start, transient: event },
    lastContext: context,
  };
}

export function resolveEvent(active: ActiveEvent, definitions: EventDefinition[]) {
  return active.transient ?? definitions.find((event) => event.id === active.eventId) ?? null;
}

export function currentNode(state: GameState, definitions: EventDefinition[]): EventNode | null {
  if (!state.activeEvent) return null;
  const event = resolveEvent(state.activeEvent, definitions);
  return event?.nodes[state.activeEvent.nodeId] ?? null;
}

function completeEvent(state: GameState, event: EventDefinition, effects: Effect[] = []) {
  const effected = applyEffects(state, effects);
  // One-off hidden events still need an internal completion mark even when they
  // are not shown in the player's journal.
  const shouldRecord = (event.journal || event.once) && !effected.completedEvents.includes(event.id);
  return {
    ...effected,
    activeEvent: null,
    completedEvents: shouldRecord ? [...effected.completedEvents, event.id] : effected.completedEvents,
  };
}

export function advanceEvent(
  state: GameState,
  definitions: EventDefinition[],
  optionId?: string,
): GameState {
  if (!state.activeEvent) return state;
  const event = resolveEvent(state.activeEvent, definitions);
  if (!event) return { ...state, activeEvent: null };
  const node = event.nodes[state.activeEvent.nodeId];
  if (!node) return { ...state, activeEvent: null };

  if (node.type === "end") return completeEvent(state, event, node.effects);

  if (node.type === "line") {
    const next = applyEffects(state, node.effects);
    const target = event.nodes[node.next];
    if (target?.type === "end") return completeEvent(next, event, target.effects);
    return { ...next, activeEvent: { ...state.activeEvent, nodeId: node.next } };
  }

  const option = node.options.find((item) => item.id === optionId);
  if (!option) return state;
  const next = applyEffects(state, option.effects);
  const target = event.nodes[option.next];
  if (target?.type === "end") return completeEvent(next, event, target.effects);
  return { ...next, activeEvent: { ...state.activeEvent, nodeId: option.next } };
}

export function buildAmbientEvent(character: CharacterDefinition, index: number, text?: string, closing = false): EventDefinition {
  return {
    id: `ambient.${character.id}.${Date.now()}`,
    title: `与${character.name}闲谈`,
    subtitle: closing ? "今日此时，言尽意未尽" : "山中寻常一刻",
    chapter: "闲谈",
    type: "闲谈",
    trigger: "talk",
    priority: 0,
    once: false,
    journal: false,
    sceneId: character.sceneId,
    characterId: character.id,
    conditions: [],
    clue: "",
    start: "line",
    nodes: {
      line: {
        id: "line",
        type: "line",
        speaker: character.id,
        text: text ?? character.ambientLines[index % Math.max(1, character.ambientLines.length)] ?? "今日暂且无话，陪我静坐片刻也好。",
        next: "end",
        effects: [{ type: "relationship", characterId: character.id, amount: 1 }],
      },
      end: { id: "end", type: "end" },
    },
  };
}

export function buildGiftFallback(character: CharacterDefinition, giftName: string, tier: "loved" | "liked" | "neutral" | "disliked" = "neutral", reaction?: string): EventDefinition {
  const amount = tier === "loved" ? 7 : tier === "liked" ? 4 : tier === "disliked" ? 0 : 2;
  return {
    id: `gift.${character.id}.${Date.now()}`,
    title: `赠予${giftName}`,
    subtitle: tier === "loved" ? "正合心意" : tier === "liked" ? "颇为喜欢" : tier === "disliked" ? "并不合意" : "一份心意",
    chapter: "赠礼",
    type: "赠礼",
    trigger: "gift",
    priority: 0,
    once: false,
    journal: false,
    sceneId: character.sceneId,
    characterId: character.id,
    conditions: [],
    clue: "",
    start: "line",
    nodes: {
      line: {
        id: "line",
        type: "line",
        speaker: character.id,
        text: reaction ?? (tier === "loved"
          ? `你竟记得我偏爱${giftName}。这份心意，我会好好收着。`
          : tier === "disliked" ? `${giftName}……你的心意我明白，只是下次不必为我寻这个。` : `${giftName}么……多谢。我会寻个合适的地方收好。`),
        next: "end",
        effects: [{ type: "relationship", characterId: character.id, amount }],
      },
      end: { id: "end", type: "end" },
    },
  };
}
