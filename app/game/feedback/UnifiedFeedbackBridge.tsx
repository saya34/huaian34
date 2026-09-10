"use client";

import { useEffect, useRef } from "react";
import { CHARACTERS, GLOBAL_KEYS } from "../content";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import type { UnifiedGameState } from "../core/types";
import { useFeedback } from "./FeedbackProvider";
import { feedbackText } from "./texts";

const RELATIONSHIP_STAGES = [
  { min: 70, textKey: "relationship.stageDevoted" },
  { min: 45, textKey: "relationship.stageFond" },
  { min: 25, textKey: "relationship.stageKnown" },
  { min: 10, textKey: "relationship.stageFirst" },
];

function crossedStage(previous: number, current: number) {
  return RELATIONSHIP_STAGES.find((stage) => previous < stage.min && current >= stage.min);
}

export function UnifiedFeedbackBridge({ children }: { children: React.ReactNode }) {
  const { state, hydrated } = useUnifiedGame();
  const feedback = useFeedback();
  const previousRef = useRef<UnifiedGameState | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const previous = previousRef.current;
    previousRef.current = state;
    if (!previous) return;

    if (state.romance.day > previous.romance.day) {
      feedback.publish({
        variant: "day-opening",
        priority: 1,
        titleKey: "calendar.dayTitle",
        bodyKey: "calendar.dayBody",
        params: { day: state.romance.day, period: state.romance.period },
        icon: feedbackText("calendar.dayIcon"),
        dedupeKey: `day:${state.romance.day}`,
      });
    }

    if (state.shared.playerLevel > previous.shared.playerLevel) {
      feedback.publish({
        variant: "progression-milestone",
        priority: 1,
        tone: "gold",
        titleKey: "player.levelTitle",
        bodyKey: "player.levelBody",
        params: { level: state.shared.playerLevel },
        icon: feedbackText("player.levelIcon"),
        dedupeKey: `level:${state.shared.playerLevel}`,
      });
    }

    if (state.shared.stamina < previous.shared.stamina && state.shared.stamina <= 3) {
      feedback.toast({
        priority: 2,
        tone: "cinnabar",
        titleKey: "system.toastWarning",
        bodyKey: "player.staminaLow",
        params: { value: state.shared.stamina },
        icon: feedbackText("player.staminaIcon"),
        dedupeKey: `stamina-low:${state.shared.stamina}`,
      });
    }

    for (const [characterId, currentValue] of Object.entries(state.romance.relationships)) {
      const previousValue = previous.romance.relationships[characterId] ?? 0;
      const stage = crossedStage(previousValue, currentValue);
      if (!stage) continue;
      const character = CHARACTERS.find((entry) => entry.id === characterId);
      const definition = character?.relationshipStages?.find((entry) => entry.min === stage.min);
      feedback.publish({
        variant: "relationship-reveal",
        priority: 1,
        titleKey: "relationship.stageTitle",
        bodyKey: "relationship.stageBody",
        params: { name: character?.name ?? characterId, stage: definition?.name ?? feedbackText(stage.textKey), description: definition?.description ?? "" },
        icon: feedbackText("relationship.icon"),
        imageSrc: character?.image,
        dedupeKey: `relationship:${characterId}:${stage.min}`,
      });
    }

    for (const [key, active] of Object.entries(state.shared.globalKeys)) {
      if (!active || previous.shared.globalKeys[key]) continue;
      const definition = GLOBAL_KEYS.find((entry) => entry.id === key);
      feedback.publish({
        variant: "world-announcement",
        priority: 0,
        titleKey: "world.changeTitle",
        bodyKey: definition?.announcement?.message ? "world.changeBody" : "world.keyChanged",
        params: { name: definition?.name ?? key, message: definition?.announcement?.message ?? definition?.description ?? key },
        icon: feedbackText("world.icon"),
        dedupeKey: `world:${key}`,
      });
    }

    const project = state.romance.medicineShortage;
    const previousProject = previous.romance.medicineShortage;
    if (project.status !== previousProject.status) {
      const completed = project.status === "completed";
      feedback.publish({
        variant: "project-milestone",
        priority: completed ? 0 : 1,
        tone: completed ? "gold" : "jade",
        titleKey: completed ? "projects.completedTitle" : "projects.title",
        bodyKey: completed ? "projects.completedBody" : "projects.accepted",
        params: { name: feedbackText("projects.medicineName") },
        icon: feedbackText("projects.icon"),
        dedupeKey: `project:medicine-shortage:${project.status}`,
      });
    } else if (project.route && project.route !== previousProject.route) {
      const routeNames = { production: feedbackText("projects.routeProduction"), relationship: feedbackText("projects.routeRelationship"), battle: feedbackText("projects.routeBattle") } as const;
      feedback.publish({
        variant: "project-milestone",
        priority: 1,
        titleKey: "projects.title",
        bodyKey: "projects.route",
        params: { route: routeNames[project.route] },
        icon: feedbackText("projects.icon"),
        dedupeKey: `project:medicine-shortage:route:${project.route}`,
      });
    }

    const gainedItems = Object.values(state.shared.items).filter((item) => item.amount > (previous.shared.items[item.itemId]?.amount ?? 0));
    for (const item of gainedItems.slice(0, 3)) {
      const amount = item.amount - (previous.shared.items[item.itemId]?.amount ?? 0);
      feedback.toast({
        priority: item.rarity >= 5 ? 1 : 3,
        tone: item.rarity >= 5 ? "gold" : "jade",
        titleKey: item.rarity >= 5 ? "items.rareTitle" : "items.gainedTitle",
        bodyKey: item.rarity >= 5 ? "items.rareBody" : "items.gainedBody",
        params: { name: item.itemId, amount },
        icon: feedbackText(item.rarity >= 5 ? "items.rareIcon" : "items.gainedIcon"),
        dedupeKey: `item:${item.itemId}:${item.amount}`,
      });
    }
  }, [feedback, hydrated, state]);

  return children;
}
