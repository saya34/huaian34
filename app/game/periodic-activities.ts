import { getCalendarDate } from "./calendar-engine";
import type { GameState, SceneId } from "./types";

export type PeriodicActivityId = "tavern-gambling" | "monthly-market" | "daily-divination";

export type PeriodicActivityDefinition = {
  id: PeriodicActivityId;
  name: string;
  subtitle: string;
  icon: string;
  sceneId: SceneId;
  accent: "gold" | "cinnabar";
  scheduleLabel: string;
  matchesDay: (absoluteDay: number) => boolean;
};

export const PERIODIC_ACTIVITIES: PeriodicActivityDefinition[] = [
  {
    id: "daily-divination",
    name: "悬壶问卦",
    subtitle: "医师替你问今日气运",
    icon: "卦",
    sceneId: "tavern",
    accent: "gold",
    scheduleLabel: "现实每日一次",
    matchesDay: () => true,
  },
  {
    id: "tavern-gambling",
    name: "醉月赌局",
    subtitle: "与花老板试试手气",
    icon: "骰",
    sceneId: "tavern",
    accent: "cinnabar",
    scheduleLabel: "每周周二",
    matchesDay: (day) => getCalendarDate(day).weekday === 2,
  },
  {
    id: "monthly-market",
    name: "云州市集",
    subtitle: "竞拍、开石与尝鲜",
    icon: "市",
    sceneId: "market",
    accent: "gold",
    scheduleLabel: "每月十五",
    matchesDay: (day) => getCalendarDate(day).day === 15,
  },
];

export function getActivitiesForDay(absoluteDay: number) {
  return PERIODIC_ACTIVITIES.filter((activity) => activity.matchesDay(absoluteDay));
}

export function getAvailableActivities(state: GameState) {
  return getActivitiesForDay(state.day).filter((activity) => activity.sceneId === state.sceneId);
}

export function marketReminderKey(absoluteDay: number) {
  const date = getCalendarDate(absoluteDay);
  return `market-reminder-${date.year}-${date.month}`;
}

export function isMarketReminderDay(absoluteDay: number) {
  return getCalendarDate(absoluteDay).day === 14;
}
