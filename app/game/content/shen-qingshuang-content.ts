import dialogueContent from "./shen-qingshuang-dialogue.json";
import eventContent from "./shen-qingshuang-events.json";
import type {
  CalendarEventConfig,
  Condition,
  DialogueProfileDefinition,
  Effect,
  EventDefinition,
  InspectionEventConfig,
  MapEventConfig,
  OpeningEffect,
  StageEffect,
  StoryVfxId,
  TriggerType,
} from "../types";

const PORTRAIT = "/assets/characters/portrait-refresh/shen-qingshuang.png";

type StoryLine = {
  kind: "line";
  speaker: "shen" | "player" | "narrator";
  text: string;
  mood?: string;
  stageEffect?: StageEffect;
  storyEffect?: StoryVfxId;
  effects?: Effect[];
};

type StoryChoice = {
  kind: "choice";
  prompt: string;
  stageEffect?: StageEffect;
  storyEffect?: StoryVfxId;
  options: Array<{
    id: string;
    label: string;
    response: string;
    mood?: string;
    effects?: Effect[];
  }>;
};

type StoryEventSource = {
  id: string;
  order: number;
  phase: string;
  title: string;
  subtitle: string;
  type: EventDefinition["type"];
  trigger: TriggerType;
  priority: number;
  sceneId: string;
  conditions: Condition[];
  clue: string;
  openingEffect?: OpeningEffect;
  defaultStoryEffect?: StoryVfxId;
  cardStyle?: EventDefinition["cardStyle"];
  inspection?: InspectionEventConfig;
  presenceMode?: EventDefinition["presenceMode"];
  mapEvent?: MapEventConfig;
  calendarEvent?: CalendarEventConfig;
  giftId?: string;
  script: Array<StoryLine | StoryChoice>;
  summary: string;
  endingEffects?: Effect[];
};

function nodeId(index: number) {
  return `n${String(index + 1).padStart(2, "0")}`;
}

function compileEvent(source: StoryEventSource): EventDefinition {
  if (source.script.length < 10 || source.script.length > 30) {
    throw new Error(`沈清霜剧情 ${source.id} 应为 10–30 轮，当前为 ${source.script.length} 轮。`);
  }
  const nodes: EventDefinition["nodes"] = {};
  source.script.forEach((entry, index) => {
    const id = nodeId(index);
    const next = index === source.script.length - 1 ? "end" : nodeId(index + 1);
    if (entry.kind === "line") {
      nodes[id] = {
        id,
        type: "line",
        speaker: entry.speaker,
        text: entry.text,
        mood: entry.mood,
        next,
        effects: entry.effects,
        portrait: PORTRAIT,
        stageEffect: entry.stageEffect,
        storyEffect: entry.storyEffect,
      };
      return;
    }
    nodes[id] = {
      id,
      type: "choice",
      prompt: entry.prompt,
      portrait: PORTRAIT,
      stageEffect: entry.stageEffect ?? "heartbeat",
      storyEffect: entry.storyEffect,
      options: entry.options.map((option, optionIndex) => {
        const responseId = `${id}r${optionIndex + 1}`;
        nodes[responseId] = {
          id: responseId,
          type: "line",
          speaker: "shen",
          text: option.response,
          mood: option.mood,
          next,
          effects: option.effects,
          portrait: PORTRAIT,
          stageEffect: option.mood?.includes("慌") || option.mood?.includes("羞") ? "heartbeat" : "soft_glow",
        };
        return { id: option.id, label: option.label, next: responseId };
      }),
    };
  });
  nodes.end = {
    id: "end",
    type: "end",
    summary: source.summary,
    effects: source.endingEffects,
    portrait: PORTRAIT,
    stageEffect: "soft_glow",
  };
  return {
    id: source.id,
    title: source.title,
    subtitle: source.subtitle,
    chapter: `沈清霜 · ${source.phase}`,
    storyPhase: source.phase,
    debugOrder: source.order,
    authoredRoundCount: source.script.length,
    type: source.type,
    trigger: source.trigger,
    priority: source.priority,
    once: true,
    journal: true,
    cardStyle: source.cardStyle ?? "special",
    openingEffect: source.openingEffect ?? "flash_white",
    defaultPortrait: PORTRAIT,
    defaultStoryEffect: source.defaultStoryEffect,
    inspection: source.inspection,
    presenceMode: source.presenceMode,
    mapEvent: source.mapEvent,
    calendarEvent: source.calendarEvent,
    sceneId: source.sceneId,
    characterId: "shen",
    conditions: source.conditions,
    clue: source.clue,
    start: nodeId(0),
    nodes,
  };
}

export const SHEN_QINGSHUANG_CHARACTER = dialogueContent.character;
export const SHEN_QINGSHUANG_DIALOGUE = dialogueContent.dialogueProfile as DialogueProfileDefinition;
export const SHEN_QINGSHUANG_EVENTS = (eventContent.events as StoryEventSource[])
  .map(compileEvent)
  .sort((a, b) => (a.debugOrder ?? 0) - (b.debugOrder ?? 0));
