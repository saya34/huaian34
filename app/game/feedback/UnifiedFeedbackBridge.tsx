"use client";

import { useEffect, useRef } from "react";
import { CHARACTERS, EVENTS, GLOBAL_KEYS } from "../content";
import { getCalendarEventsForDay } from "../calendar-engine";
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
      const special=getCalendarEventsForDay(EVENTS,state.romance.day).find(event=>event.calendarEvent?.doodle==="festival"||event.calendarEvent?.doodle==="birthday");
      if(special)feedback.publish({variant:"day-opening",priority:0,tone:special.calendarEvent?.doodle==="birthday"?"cinnabar":"gold",titleKey:"calendar.festivalTitle",bodyKey:"calendar.festivalBody",params:{name:special.title},icon:special.calendarEvent?.doodle==="birthday"?"寿":"节",dedupeKey:`calendar-special:${special.id}:${state.romance.day}`});
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

    if(state.dungeons.highestUnlocked>previous.dungeons.highestUnlocked)feedback.publish({variant:"world-announcement",priority:0,titleKey:"world.sceneUnlockedTitle",bodyKey:"world.sceneUnlockedBody",params:{name:feedbackText("world.dungeonName",{wave:state.dungeons.highestUnlocked})},icon:"境",dedupeKey:`dungeon-unlock:${state.dungeons.highestUnlocked}`});

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
      const character = CHARACTERS.find((entry) => entry.id === characterId);
      if (!stage && currentValue > previousValue) {
        feedback.float({ titleKey: "relationship.gain", params: { name: character?.name ?? characterId, amount: currentValue - previousValue }, tone: "cinnabar", dedupeKey: `relationship-gain:${characterId}` });
        continue;
      }
      if (!stage) continue;
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

    const announceSpotChanges = (kind: "fishing" | "mining", current: Array<{ id: string; mapId: string }>, before: Array<{ id: string; mapId: string }>) => {
      for (const spot of current.filter((entry) => !before.some((old) => old.id === entry.id))) feedback.publish({ variant: "world-announcement", priority: 2, titleKey: "world.randomPointTitle", bodyKey: "world.randomPointBody", params: { scene: spot.mapId, kind: feedbackText(kind === "fishing" ? "world.fishingPoint" : "world.miningPoint") }, icon: kind === "fishing" ? "澜" : "矿", dedupeKey: `${kind}:spawn:${spot.id}` });
      for (const spot of before.filter((entry) => !current.some((next) => next.id === entry.id))) feedback.toast({ priority: 2, titleKey: "world.randomPointGone", params: { scene: spot.mapId, kind: feedbackText(kind === "fishing" ? "world.fishingPoint" : "world.miningPoint") }, icon: "隐", dedupeKey: `${kind}:gone:${spot.id}` });
    };
    announceSpotChanges("fishing", state.fishing.randomSpots, previous.fishing.randomSpots);
    announceSpotChanges("mining", state.mining.randomSpots, previous.mining.randomSpots);

    if (state.romance.receivedMessages.length > previous.romance.receivedMessages.length) feedback.toast({ priority: 1, tone: "cinnabar", titleKey: "relationship.messageTitle", bodyKey: "relationship.messageBody", icon: "笺", dedupeKey: `message:${state.romance.receivedMessages.at(-1)}` });
    if (state.romance.activeEvent?.eventId !== previous.romance.activeEvent?.eventId && state.romance.activeEvent) feedback.toast({ priority: 1, titleKey: "relationship.storyTitle", bodyKey: "relationship.storyBody", params: { name: state.romance.activeEvent.eventId }, icon: "缘", dedupeKey: `story:${state.romance.activeEvent.eventId}` });

    for (const skillId of state.shared.learnedSkills.filter((id) => !previous.shared.learnedSkills.includes(id))) feedback.publish({ variant: "progression-milestone", priority: 1, tone: "gold", titleKey: "player.skillLearned", bodyKey: "player.skillLearnedBody", params: { id: skillId }, icon: "悟", dedupeKey: `skill:${skillId}` });

    if (state.fishing.dailyAttempts >= 6 && previous.fishing.dailyAttempts < 6) feedback.toast({ priority: 2, titleKey: "system.toastWarning", bodyKey: "fishing.limit", icon: "竿", dedupeKey: `fishing-limit:${state.romance.day}` });
    for (const slot of state.fishing.aging.filter((entry) => !previous.fishing.aging.some((old) => old.id === entry.id))) feedback.toast({ priority: 2, titleKey: "fishing.agingTitle", bodyKey: "fishing.agingBody", icon: "藏", dedupeKey: `fish-aging:${slot.id}` });

    if (state.mining.residentFloor > previous.mining.residentFloor) feedback.publish({ variant: "progression-milestone", priority: 1, titleKey: "mining.depthTitle", bodyKey: "mining.depthBody", params: { depth: state.mining.residentFloor }, icon: "深", dedupeKey: `mine-floor:${state.mining.residentFloor}` });
    if (state.mining.pickaxeDurability <= 12 && previous.mining.pickaxeDurability > 12) feedback.toast({ priority: 1, tone: "danger", titleKey: "mining.pickaxeDanger", bodyKey: "mining.pickaxeDangerBody", params: { value: state.mining.pickaxeDurability }, icon: "裂", dedupeKey: `pickaxe-danger:${state.mining.pickaxeDurability}` });
    if (state.mining.pickaxeDurability === 0 && previous.mining.pickaxeDurability > 0) feedback.publish({ variant: "world-announcement", priority: 0, tone: "danger", titleKey: "mining.pickaxeBroken", bodyKey: "mining.pickaxeBrokenBody", icon: "断", dedupeKey: "pickaxe-broken" });
    if (state.mining.treasureMapAssembled && !previous.mining.treasureMapAssembled) feedback.publish({ variant: "rare-reward", priority: 0, tone: "gold", titleKey: "mining.mapReady", bodyKey: "mining.mapReadyBody", icon: "图", dedupeKey: "treasure-map-ready" });

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
    if (project.status === "active" && project.deadlineDay !== undefined) {
      const remaining = project.deadlineDay - state.romance.day;
      const beforeRemaining = (previousProject.deadlineDay ?? 999) - previous.romance.day;
      if (remaining <= 1 && remaining < beforeRemaining) feedback.publish({ variant: "project-milestone", priority: 0, tone: "danger", titleKey: "calendar.deadlineTitle", bodyKey: "calendar.deadlineBody", params: { name: feedbackText("projects.medicineName"), remaining: Math.max(0, remaining) }, icon: "急", dedupeKey: `project-deadline:${remaining}` });
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
