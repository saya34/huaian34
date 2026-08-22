import { checkCondition } from "./event-engine";
import type { EventDefinition, GameState, TriggerContext } from "./types";

export const CALENDAR_MONTHS = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月"] as const;
export const CALENDAR_WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;
export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;

const CHINESE_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

export function chineseNumber(value: number) {
  if (value <= 0) return "零";
  if (value < 10) return CHINESE_DIGITS[value];
  if (value === 10) return "十";
  if (value < 20) return `十${CHINESE_DIGITS[value - 10]}`;
  if (value < 100) return `${CHINESE_DIGITS[Math.floor(value / 10)]}十${value % 10 ? CHINESE_DIGITS[value % 10] : ""}`;
  return String(value).split("").map((digit) => CHINESE_DIGITS[Number(digit)]).join("");
}

export function lunarDayName(day: number) {
  if (day <= 10) return day === 10 ? "初十" : `初${CHINESE_DIGITS[day]}`;
  if (day < 20) return `十${CHINESE_DIGITS[day - 10]}`;
  if (day === 20) return "二十";
  if (day < 30) return `廿${CHINESE_DIGITS[day - 20]}`;
  return "三十";
}

export function getCalendarDate(absoluteDay: number) {
  const safeDay = Math.max(1, Math.floor(absoluteDay));
  const zero = safeDay - 1;
  const year = Math.floor(zero / (DAYS_PER_MONTH * MONTHS_PER_YEAR)) + 1;
  const withinYear = zero % (DAYS_PER_MONTH * MONTHS_PER_YEAR);
  const month = Math.floor(withinYear / DAYS_PER_MONTH) + 1;
  const day = (withinYear % DAYS_PER_MONTH) + 1;
  const weekday = (zero % 7) + 1;
  return {
    absoluteDay: safeDay,
    year,
    month,
    day,
    weekday,
    eraYear: `云和${year === 1 ? "元" : chineseNumber(year)}年`,
    monthName: CALENDAR_MONTHS[month - 1],
    dayName: lunarDayName(day),
    weekdayName: CALENDAR_WEEKDAYS[weekday - 1],
  };
}

export function toAbsoluteDay(year: number, month: number, day: number) {
  return (Math.max(1, year) - 1) * DAYS_PER_MONTH * MONTHS_PER_YEAR + (Math.max(1, month) - 1) * DAYS_PER_MONTH + Math.max(1, day);
}

export function calendarEventMatches(event: EventDefinition, absoluteDay: number) {
  const config = event.calendarEvent;
  if (event.trigger !== "calendar_event" || !config) return false;
  const date = getCalendarDate(absoluteDay);
  if (config.mode === "fixed") return config.month === date.month && config.day === date.day;
  if (config.mode === "weekly") return config.weekday === date.weekday;
  const everyDays = Math.max(1, Math.floor(config.everyDays ?? 1));
  const offset = Math.max(1, Math.floor(config.offsetDay ?? 1));
  return absoluteDay >= offset && (absoluteDay - offset) % everyDays === 0;
}

export function calendarOccurrenceKey(event: EventDefinition, absoluteDay: number) {
  const date = getCalendarDate(absoluteDay);
  return event.calendarEvent?.mode === "fixed" ? `${date.year}-${date.month}-${date.day}` : `day-${absoluteDay}`;
}

export function getCalendarEventsForDay(definitions: EventDefinition[], absoluteDay: number) {
  return definitions.filter((event) => calendarEventMatches(event, absoluteDay)).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

export function getDueCalendarEvents(state: GameState, definitions: EventDefinition[]) {
  return getCalendarEventsForDay(definitions, state.day).filter((event) => {
    if (event.once && state.completedEvents.includes(event.id)) return false;
    const occurrence = calendarOccurrenceKey(event, state.day);
    if ((state.calendarEventRuns?.[event.id] ?? []).includes(occurrence)) return false;
    const context: TriggerContext = { trigger: "calendar_event", sceneId: event.sceneId, characterId: event.characterId };
    return event.conditions.every((condition) => checkCondition(condition, state, context));
  });
}

export function markCalendarEventCompleted(state: GameState, event: EventDefinition, absoluteDay: number): GameState {
  if (event.trigger !== "calendar_event") return state;
  const key = calendarOccurrenceKey(event, absoluteDay);
  const previous = state.calendarEventRuns?.[event.id] ?? [];
  if (previous.includes(key)) return state;
  return { ...state, calendarEventRuns: { ...(state.calendarEventRuns ?? {}), [event.id]: [...previous, key] } };
}
