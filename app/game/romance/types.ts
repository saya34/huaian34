import type { AudioFrameId } from "./audio-frames";

export type SceneId = string;
export type CharacterId = string;
export type GiftId = string;
export type Period = "清晨" | "黄昏" | "夜晚";
export type TriggerType = "scene_enter" | "talk" | "gift" | "time_change" | "map_event" | "calendar_event" | "inspection" | "interaction";
export type EventCardStyle = "normal" | "special" | "audio" | "easter_egg" | "trigger_point";
export type OpeningEffect = "none" | "flash_white" | "flash_black";
export type StageEffect = "none" | "soft_glow" | "heartbeat" | "shake";

export type NodeVisual = {
  portrait?: string;
  stageEffect?: StageEffect;
};

export type Effect =
  | { type: "relationship"; characterId: CharacterId; amount: number }
  | { type: "set_flag"; key: string; value: boolean }
  | { type: "consume_gift"; giftId: GiftId; amount: number };

export type Condition =
  | { type: "scene"; value: SceneId }
  | { type: "character"; value: CharacterId }
  | { type: "gift"; value: GiftId }
  | { type: "period"; value: Period }
  | { type: "relationship"; characterId: CharacterId; min: number }
  | { type: "event_completed"; eventId: string }
  | { type: "flag"; key: string; value: boolean };

export type DialogueNode = {
  id: string;
  type: "line";
  speaker: CharacterId | "player" | "narrator";
  text: string;
  mood?: string;
  next: string;
  effects?: Effect[];
} & NodeVisual;

export type ChoiceNode = {
  id: string;
  type: "choice";
  prompt?: string;
  options: Array<{
    id: string;
    label: string;
    next: string;
    effects?: Effect[];
  }>;
} & NodeVisual;

export type EndNode = {
  id: string;
  type: "end";
  summary?: string;
  effects?: Effect[];
} & NodeVisual;

export type EventNode = DialogueNode | ChoiceNode | EndNode;

export type EventDefinition = {
  id: string;
  title: string;
  subtitle: string;
  chapter: string;
  type: "主线" | "相识" | "心事" | "赠礼" | "情缘" | "闲谈";
  trigger: TriggerType;
  priority: number;
  weight?: number;
  once: boolean;
  journal: boolean;
  cardStyle?: EventCardStyle;
  openingEffect?: OpeningEffect;
  defaultPortrait?: string;
  audioSegments?: AudioEventSegment[];
  audioFrameId?: AudioFrameId;
  unlockTitle?: string;
  exploration?: ExplorationEventConfig;
  mapEvent?: MapEventConfig;
  calendarEvent?: CalendarEventConfig;
  inspection?: InspectionEventConfig;
  interactionId?: string;
  sceneId: SceneId;
  characterId: CharacterId;
  conditions: Condition[];
  clue: string;
  start: string;
  nodes: Record<string, EventNode>;
};

export type InspectionEventConfig = {
  chance: number;
  hint: boolean;
};

export type MapEventConfig = {
  mapId: string;
  windowDays: number;
  x: number;
  y: number;
};

export type CalendarDoodle = "birthday" | "auction" | "festival" | "meeting" | "story";

export type CalendarEventConfig = {
  mode: "fixed" | "weekly" | "interval";
  month?: number;
  day?: number;
  weekday?: number;
  everyDays?: number;
  offsetDay?: number;
  doodle: CalendarDoodle;
};

export type EasterEggItemDefinition = {
  id: string;
  name: string;
  image: string;
  description: string;
};

export type ExplorationEventConfig = {
  chance: number;
  positionMode: "random" | "fixed";
  x?: number;
  y?: number;
  image: string;
  text: string;
  rewardItem?: EasterEggItemDefinition;
};

export type AudioEventSegment = {
  id: string;
  image: string;
  audio: string;
  subtitle: string;
};

export type TriggerContext = {
  trigger: TriggerType;
  sceneId: SceneId;
  characterId?: CharacterId;
  giftId?: GiftId;
  interactionId?: string;
};

export type ActiveEvent = {
  eventId: string;
  nodeId: string;
  transient?: EventDefinition;
};

export type GameState = {
  day: number;
  period: Period;
  sceneId: SceneId;
  selectedCharacterId: CharacterId;
  spiritStones: number;
  stamina: number;
  experience: number;
  marketTreasures: Record<string, number>;
  activityNotices: string[];
  relationships: Record<CharacterId, number>;
  inventory: Record<GiftId, number>;
  flags: Record<string, boolean>;
  announcedGlobalKeys: string[];
  receivedMessages: string[];
  claimedMessages: string[];
  discoveredGiftPreferences: Record<CharacterId, GiftId[]>;
  seekingEncounterDays: Record<string, number>;
  mapEventSchedules: Record<string, number>;
  calendarEventRuns: Record<string, string[]>;
  collectedEasterEggs: string[];
  completedEvents: string[];
  eventRuns: Record<string, number>;
  talkCounts: Record<string, number>;
  presentCharacters: Record<SceneId, CharacterId[]>;
  appearanceTriggersUsed: string[];
  sceneVisits: Record<SceneId, number>;
  sceneInspectionDays: Record<SceneId, number>;
  interactionCounts: Record<string, number>;
  proficiencyExperience: Record<string, number>;
  activeEvent: ActiveEvent | null;
  lastContext: TriggerContext | null;
};

export type SceneDefinition = {
  id: SceneId;
  name: string;
  shortName: string;
  description: string;
  atmosphere: string;
  image: string;
  characters: CharacterId[];
  minigameDifficulty?: MiniGameDifficultyDefinition;
  variants?: SceneVariantDefinition[];
};

export type MiniGameDifficultyDefinition = {
  drinking?: number;
};

export type SceneVariantDefinition = {
  id: string;
  name?: string;
  description?: string;
  atmosphere?: string;
  image: string;
  priority: number;
  conditions: Condition[];
};

export type GuaranteedPresenceRule = {
  id: string;
  label: string;
  conditions: Condition[];
  triggerEventId?: string;
};

export type RandomPresenceRule = {
  id: string;
  label: string;
  periods: Period[];
  conditions: Condition[];
  probability: number;
};

export type CharacterPresenceDefinition = {
  mode: "resident" | "random";
  guaranteedRules: GuaranteedPresenceRule[];
  randomRules: RandomPresenceRule[];
};

export type CharacterSceneAppearance = CharacterPresenceDefinition & {
  sceneId: SceneId;
};

export type CharacterDefinition = {
  id: CharacterId;
  name: string;
  role: string;
  courtesy: string;
  bio: string;
  sceneId: SceneId;
  image: string;
  accent: string;
  lovedGift: GiftId;
  ambientLines: string[];
  presence?: CharacterPresenceDefinition;
  appearances?: CharacterSceneAppearance[];
  relationshipStages?: RelationshipStageDefinition[];
  giftPreferences?: GiftPreferenceDefinition[];
  seekingRules?: SeekingEncounterRule[];
  interactions?: CharacterInteractionDefinition;
};

export type CharacterInteractionDefinition = {
  drinking?: DrinkingInteractionDefinition;
};

export type DrinkingInteractionDefinition = {
  enabled: boolean;
  sceneIds: SceneId[];
  periods: Period[];
  minRelationship: number;
  maxAttempts: number;
  targetScore: number;
  specialWinCount: number;
  specialEventId?: string;
};

export type RelationshipStageDefinition = {
  id: string;
  min: number;
  name: string;
  addressing: string;
  description: string;
};

export type GiftPreferenceDefinition = {
  giftId: GiftId;
  tier: "loved" | "liked" | "neutral" | "disliked";
  reaction: string;
};

export type SeekingEncounterRule = {
  id: string;
  label: string;
  periods: Period[];
  probability: number;
  cooldownDays: number;
  priority: number;
  conditions: GlobalKeyAutoCondition[];
  triggerEventId?: string;
  intro: string;
};

export type GiftDefinition = {
  id: GiftId;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  image: string;
  imagePosition?: string;
  initialCount: number;
  energyRestore?: number;
};

export type DialogueRule = {
  id: string;
  minRelationship: number;
  maxRelationship: number;
  period: Period;
  lines: string[];
  closingAfter: number;
  closingLine: string;
};

export type DialogueProfileDefinition = {
  id: string;
  characterId: CharacterId;
  rules: DialogueRule[];
};

export type CharacterMessageDefinition = {
  id: string;
  senderCharacterId: CharacterId;
  title: string;
  body: string;
  signature: string;
  conditions: GlobalKeyAutoCondition[];
  relationshipAmount?: number;
  giftId?: GiftId;
  giftAmount?: number;
  setFlagKey?: string;
};

export type GlobalKeyDefinition = {
  id: string;
  name: string;
  category: string;
  description: string;
  initialValue: boolean;
  triggerMode?: "manual" | "automatic" | "both";
  autoRules?: GlobalKeyAutoRule[];
  announcement?: GlobalKeyAnnouncement;
};

export type GlobalKeyAnnouncement = {
  enabled: boolean;
  title: string;
  message: string;
};

export type GlobalKeyAutoCondition =
  | { type: "event_completed"; eventId: string }
  | { type: "day_reached"; min: number }
  | { type: "period"; value: Period }
  | { type: "scene"; value: SceneId }
  | { type: "flag"; key: string; value: boolean }
  | { type: "relationship"; characterId: CharacterId; min: number }
  | { type: "event_run_count"; eventId: string; min: number }
  | { type: "completed_event_count"; min: number }
  | { type: "scene_visit_count"; sceneId: SceneId; min: number }
  | { type: "gift_count"; giftId: GiftId; min: number };

export type GlobalKeyAutoRule = {
  id: string;
  label: string;
  conditions: GlobalKeyAutoCondition[];
};
