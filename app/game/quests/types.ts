import type { UnifiedGameState, UnifiedItemType, UnifiedRarity } from "../core/types";

export type QuestType = "main" | "side";
export type QuestStatus = "unaccepted" | "in_progress" | "completed" | "claimable" | "claimed";
export type QuestObjectiveType = "play" | "acquire" | "reach";
export type QuestDestinationKind = "story" | "alchemy" | "farm" | "battle" | "equipment" | "characters" | "path-project";

export type QuestObjectiveDefinition = {
  id: string;
  type: QuestObjectiveType;
  target: string;
  required: number;
  description: string;
};

export type QuestRewardDefinition = {
  type: "currency" | "experience" | "item";
  amount: number;
  label: string;
  itemId?: string;
  itemType?: UnifiedItemType;
  rarity?: UnifiedRarity;
};

export type QuestDefinition = {
  id: string;
  type: QuestType;
  order: number;
  name: string;
  summary: string;
  initialStatus: QuestStatus;
  objectives: QuestObjectiveDefinition[];
  destination: { kind: QuestDestinationKind; sceneId?: string; waveId?: number };
  rewards: QuestRewardDefinition[];
};

export type QuestProgress = {
  statuses: Record<string, QuestStatus>;
  trackedQuestId: string | null;
};

export type QuestObjectiveProgress = QuestObjectiveDefinition & {
  current: number;
  done: boolean;
};

export type QuestView = {
  definition: QuestDefinition;
  status: QuestStatus;
  objectives: QuestObjectiveProgress[];
  complete: boolean;
  tracked: boolean;
};

export type QuestNavigate = (quest: QuestDefinition) => void;

export type QuestStateReader = Pick<UnifiedGameState, "shared" | "romance" | "alchemy" | "dungeons" | "farm">;
