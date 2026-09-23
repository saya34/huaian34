"use client";

import { useEffect, useRef } from "react";
import { EVENTS } from "../content";
import { getCalendarEventsForDay } from "../calendar-engine";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import type { UnifiedGameState } from "../core/types";
import { useFeedback } from "./FeedbackProvider";
import { feedbackText } from "./texts";
import { manualById } from "../skills/manual-service";

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
      const special=getCalendarEventsForDay(EVENTS,state.romance.day).find(event=>event.calendarEvent?.doodle==="festival"||event.calendarEvent?.doodle==="birthday");
      feedback.publish(special ? {
        variant:"day-opening",level:"L2",priority:1,record:true,
        tone:special.calendarEvent?.doodle==="birthday"?"cinnabar":"gold",
        titleKey:"calendar.festivalTitle",bodyKey:"calendar.festivalBody",
        params:{name:special.title},icon:special.calendarEvent?.doodle==="birthday"?"寿":"节",
        eventId:`calendar:${state.romance.day}`,
      } : {
        variant: "day-opening", level:"L1", priority: 2,
        titleKey: "calendar.dayTitle", bodyKey: "calendar.dayBody",
        params: { day: state.romance.day, period: state.romance.period },
        icon: feedbackText("calendar.dayIcon"), eventId: `calendar:${state.romance.day}`,
      });
    }

    if (state.shared.playerLevel > previous.shared.playerLevel) {
      feedback.publish({
        variant: "progression-milestone",
        level: "L2",
        priority: 1,
        tone: "gold",
        titleKey: "player.levelTitle",
        bodyKey: "player.levelBody",
        params: { level: state.shared.playerLevel, points: (state.shared.playerLevel - previous.shared.playerLevel) * 5 },
        icon: feedbackText("player.levelIcon"),
        dedupeKey: `level:${state.shared.playerLevel}`,
      });
    }

    if(state.dungeons.highestUnlocked>previous.dungeons.highestUnlocked)feedback.publish({variant:"world-announcement",level:"L2",priority:1,record:true,titleKey:"world.sceneUnlockedTitle",bodyKey:"world.sceneUnlockedBody",params:{name:feedbackText("world.dungeonName",{wave:state.dungeons.highestUnlocked})},icon:"境",eventId:`dungeon-unlock:${state.dungeons.highestUnlocked}`});

    if (state.shared.stamina <= 3 && previous.shared.stamina > 3) {
      feedback.toast({
        priority: 2,
        tone: "cinnabar",
        titleKey: "system.toastWarning",
        bodyKey: "player.staminaLow",
        params: { value: state.shared.stamina },
        icon: feedbackText("player.staminaIcon"),
        dedupeKey: `stamina-low:${state.romance.day}`,
      });
    }
    // Relationship gain and stage changes are authored by GameDemo from each
    // character's relationshipStages. Keeping that projection here caused a
    // second card based on obsolete hard-coded thresholds.

    const announceSpotChanges = (kind: "fishing" | "mining", current: Array<{ id: string; mapId: string }>, before: Array<{ id: string; mapId: string }>) => {
      const appeared=current.filter((entry) => !before.some((old) => old.id === entry.id));
      const vanished=before.filter((entry) => !current.some((next) => next.id === entry.id));
      if(appeared.length) feedback.toast({priority:2,titleKey:"world.randomPointTitle",bodyKey:"world.randomPointSummary",params:{count:appeared.length,kind:feedbackText(kind === "fishing" ? "world.fishingPoint" : "world.miningPoint")},icon:kind === "fishing" ? "澜":"矿",dedupeKey:`${kind}:spawn:${state.romance.day}`});
      if(vanished.length) feedback.toast({priority:3,titleKey:"world.randomPointGone",params:{scene:vanished.length>1?`${vanished.length}处`:vanished[0].mapId,kind:feedbackText(kind === "fishing" ? "world.fishingPoint" : "world.miningPoint")},icon:"隐",dedupeKey:`${kind}:gone:${state.romance.day}`});
    };
    announceSpotChanges("fishing", state.fishing.randomSpots, previous.fishing.randomSpots);
    announceSpotChanges("mining", state.mining.randomSpots, previous.mining.randomSpots);

    if (state.romance.receivedMessages.length > previous.romance.receivedMessages.length) feedback.publish({variant:"relationship-reveal",level:"L2",priority:1,tone:"cinnabar",titleKey:"relationship.messageTitle",bodyKey:"relationship.messageBody",icon:"笺",eventId:`message:${state.romance.receivedMessages.at(-1)}`});
    // Transient events are already shown in the dialogue layer. Announcing
    // them here would mislabel daily conversations and effect-free story
    // previews as a new, unnamed canonical relationship event.
    // Entering the authored dialogue is already the feedback for a story trigger.

    const newlyLearnedSkills = state.shared.learnedSkills
      .filter((id) => !previous.shared.learnedSkills.includes(id))
      // The battle mastery projection contains the built-in starter manuals.
      // They may enter the shared projection together with the first genuinely
      // learned manual, but should not masquerade as the newly studied reward.
      .map((id) => manualById(id))
      .filter((manual) => !manual.starter);
    for (const manual of newlyLearnedSkills) feedback.publish({ variant: "progression-milestone",level:"L2", priority: 1, tone: "gold", titleKey: "player.skillLearned", bodyKey: "player.skillLearnedBody", params: { name: manual.name }, icon: "悟", eventId: `skill:${manual.baseId}` });

    if (state.fishing.dailyAttempts >= 6 && previous.fishing.dailyAttempts < 6) feedback.toast({ priority: 2, titleKey: "system.toastWarning", bodyKey: "fishing.limit", icon: "竿", dedupeKey: `fishing-limit:${state.romance.day}` });
    for (const slot of state.fishing.aging.filter((entry) => !previous.fishing.aging.some((old) => old.id === entry.id))) feedback.toast({ priority: 2, titleKey: "fishing.agingTitle", bodyKey: "fishing.agingBody", icon: "藏", dedupeKey: `fish-aging:${slot.id}` });

    if (state.mining.residentFloor > previous.mining.residentFloor) feedback.toast({ priority: 2, titleKey: "mining.depthTitle", bodyKey: "mining.depthBody", params: { depth: state.mining.residentFloor }, icon: "深", dedupeKey: `mine-floor:${state.mining.residentFloor}` });
    if (state.mining.pickaxeDurability <= 12 && previous.mining.pickaxeDurability > 12) feedback.toast({ priority: 1, tone: "danger", titleKey: "mining.pickaxeDanger", bodyKey: "mining.pickaxeDangerBody", params: { value: state.mining.pickaxeDurability }, icon: "裂", dedupeKey: `pickaxe-danger:${state.mining.pickaxeDurability}` });
    if (state.mining.treasureMapAssembled && !previous.mining.treasureMapAssembled) feedback.publish({ variant: "rare-reward",level:"L3", priority: 0, tone: "gold", firstObtain:true,titleKey: "mining.mapReady", bodyKey: "mining.mapReadyBody", icon: "图", eventId: "treasure-map-ready" });

    const project = state.romance.medicineShortage;
    const previousProject = previous.romance.medicineShortage;
    // The task panel owns accept, route and completion presentation. The bridge
    // only contributes a deadline warning when the project is not on screen.
    if (project.status === "active" && project.deadlineDay !== undefined) {
      const remaining = project.deadlineDay - state.romance.day;
      const beforeRemaining = (previousProject.deadlineDay ?? 999) - previous.romance.day;
      if (remaining <= 1 && remaining < beforeRemaining) feedback.publish({ variant: "project-milestone",level:"L2", priority: 0, tone: "danger", titleKey: "calendar.deadlineTitle", bodyKey: "calendar.deadlineBody", params: { name: feedbackText("projects.medicineName"), remaining: Math.max(0, remaining) }, icon: "急", eventId: `project-deadline:${state.romance.day}:${remaining}` });
    }
    // Inventory deltas are recorded by their originating receipt. Watching the
    // shared bag here produced a second, context-free "obtained" toast.
  }, [feedback, hydrated, state]);

  return children;
}
