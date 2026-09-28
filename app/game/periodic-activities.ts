import { getCalendarDate, toAbsoluteDay } from "./calendar-engine";
import monthlyMarketContent from "./content/monthly-market.json";
import type { CharacterMessageDefinition, GameState, SceneId } from "./types";

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

export function getNextMonthlyMarket(absoluteDay: number) {
  const date = getCalendarDate(absoluteDay);
  const thisMonth = toAbsoluteDay(date.year, date.month, 15);
  const targetAbsoluteDay = absoluteDay <= thisMonth
    ? thisMonth
    : date.month === 12
      ? toAbsoluteDay(date.year + 1, 1, 15)
      : toAbsoluteDay(date.year, date.month + 1, 15);
  const target = getCalendarDate(targetAbsoluteDay);
  return { ...target, daysUntil: targetAbsoluteDay - absoluteDay };
}

export function marketReminderLeadDays(absoluteDay: number) {
  const day = getCalendarDate(absoluteDay).day;
  return day === 12 ? 3 : day === 14 ? 1 : null;
}

export function marketReminderKey(absoluteDay: number) {
  const next = getNextMonthlyMarket(absoluteDay);
  const leadDays = marketReminderLeadDays(absoluteDay) ?? next.daysUntil;
  return `market-reminder-${next.year}-${next.month}-${leadDays}`;
}

export function isMarketReminderDay(absoluteDay: number) {
  return marketReminderLeadDays(absoluteDay) !== null;
}

export function getMarketReminder(absoluteDay: number): CharacterMessageDefinition | null {
  const leadDays = marketReminderLeadDays(absoluteDay);
  if (leadDays === null) return null;
  const copy = monthlyMarketContent.reminders[String(leadDays) as keyof typeof monthlyMarketContent.reminders];
  if (!copy) return null;
  return {
    id: marketReminderKey(absoluteDay),
    senderCharacterId: "hua",
    title: copy.title,
    body: copy.body,
    signature: "花照影",
    conditions: [],
  };
}

export function restoreMarketReminder(reminderId: string): CharacterMessageDefinition | null {
  const match = /^market-reminder-(\d+)-(\d+)(?:-(1|3))?$/.exec(reminderId);
  if (!match) return null;
  const leadDays = (match[3] ?? "1") as keyof typeof monthlyMarketContent.reminders;
  const copy = monthlyMarketContent.reminders[leadDays];
  if (!copy) return null;
  return {
    id: reminderId,
    senderCharacterId: "hua",
    title: copy.title,
    body: copy.body,
    signature: "花照影",
    conditions: [],
  };
}
