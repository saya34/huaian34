"use client";

import { useMemo, useState } from "react";
import { CALENDAR_MONTHS, CALENDAR_WEEKDAYS, DAYS_PER_MONTH, getCalendarDate, getCalendarEventsForDay, toAbsoluteDay } from "./calendar-engine";
import { getActivitiesForDay } from "./periodic-activities";
import type { CalendarDoodle, EventDefinition, GameState } from "./types";

const DOODLE_LABELS: Record<CalendarDoodle, string> = { birthday: "寿辰", auction: "竞拍", festival: "佳节", meeting: "相会", story: "异闻" };

export default function CalendarModal({ state, events, onClose }: { state: GameState; events: EventDefinition[]; onClose: () => void }) {
  const today = getCalendarDate(state.day);
  const [view, setView] = useState({ year: today.year, month: today.month });
  const [selectedDay, setSelectedDay] = useState(today.day);
  const firstAbsolute = toAbsoluteDay(view.year, view.month, 1);
  const firstWeekday = getCalendarDate(firstAbsolute).weekday;
  const selectedAbsolute = toAbsoluteDay(view.year, view.month, selectedDay);
  const selectedEvents = useMemo(() => getCalendarEventsForDay(events, selectedAbsolute), [events, selectedAbsolute]);
  const selectedActivities = useMemo(() => getActivitiesForDay(selectedAbsolute), [selectedAbsolute]);

  function changeMonth(delta: number) {
    const zero = (view.year - 1) * 12 + (view.month - 1) + delta;
    if (zero < 0) return;
    setView({ year: Math.max(1, Math.floor(zero / 12) + 1), month: ((zero % 12) + 12) % 12 + 1 });
    setSelectedDay(1);
  }

  return <div className="calendar-backdrop" role="presentation" onMouseDown={onClose}><section className="calendar-shell" role="dialog" aria-modal="true" aria-label="云和历" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><small>YUNHE ALMANAC · 云和历</small><h2>{getCalendarDate(firstAbsolute).eraYear} · {CALENDAR_MONTHS[view.month - 1]}</h2><p>今日：{today.monthName}{today.dayName} · {today.weekdayName}</p></div><button type="button" onClick={onClose} aria-label="关闭日历">×</button></header>
    <div className="calendar-toolbar"><button type="button" onClick={() => changeMonth(-1)}>‹ 上月</button><button type="button" className="calendar-today" onClick={() => { setView({ year: today.year, month: today.month }); setSelectedDay(today.day); }}>回到今日</button><button type="button" onClick={() => changeMonth(1)}>下月 ›</button></div>
    <div className="calendar-week-row">{CALENDAR_WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
    <div className="calendar-grid">{Array.from({ length: firstWeekday - 1 }, (_, index) => <i key={`blank-${index}`} />)}{Array.from({ length: DAYS_PER_MONTH }, (_, index) => {
      const day = index + 1; const absolute = toAbsoluteDay(view.year, view.month, day); const dateEvents = getCalendarEventsForDay(events, absolute); const dateActivities = getActivitiesForDay(absolute); const markers = [...dateEvents.map((event) => ({ id: event.id, title: event.title, doodle: event.calendarEvent?.doodle ?? "story", label: DOODLE_LABELS[event.calendarEvent?.doodle ?? "story"].slice(0, 1) })), ...dateActivities.map((activity) => ({ id: activity.id, title: activity.name, doodle: activity.id === "tavern-gambling" ? "gambling" : "market", label: activity.icon }))]; const isToday = absolute === state.day; const selected = day === selectedDay;
      return <button type="button" key={day} className={`${isToday ? "today" : ""} ${selected ? "selected" : ""}`} onClick={() => setSelectedDay(day)}><span><b>{day}</b><small>{getCalendarDate(absolute).dayName}</small></span><div className="calendar-day-doodles">{markers.slice(0, 3).map((marker) => <i key={marker.id} className={`calendar-doodle ${marker.doodle}`} title={marker.title}><b>{marker.label}</b></i>)}</div>{markers.length > 3 && <em>+{markers.length - 3}</em>}</button>;
    })}</div>
    <footer><div className="calendar-selected-date"><span>{selectedDay}</span><div><small>{getCalendarDate(selectedAbsolute).weekdayName}</small><strong>{CALENDAR_MONTHS[view.month - 1]}{getCalendarDate(selectedAbsolute).dayName}</strong></div></div><div className="calendar-event-list">{selectedActivities.map((activity) => <article key={activity.id} className="calendar-activity-item"><i className={`calendar-doodle ${activity.id === "tavern-gambling" ? "gambling" : "market"}`}><b>{activity.icon}</b></i><div><small>周期活动 · {activity.scheduleLabel}</small><strong>{activity.name}</strong><p>{activity.subtitle} · 前往对应场景参加</p></div></article>)}{selectedEvents.map((event) => <article key={event.id}><i className={`calendar-doodle ${event.calendarEvent?.doodle ?? "story"}`}><b>{DOODLE_LABELS[event.calendarEvent?.doodle ?? "story"].slice(0, 1)}</b></i><div><small>{DOODLE_LABELS[event.calendarEvent?.doodle ?? "story"]} · {event.calendarEvent?.mode === "weekly" ? `每${CALENDAR_WEEKDAYS[(event.calendarEvent.weekday ?? 1) - 1]}` : event.calendarEvent?.mode === "interval" ? `每隔 ${event.calendarEvent.everyDays} 日` : "固定日期"}</small><strong>{event.title}</strong><p>{event.subtitle}</p></div></article>)}{!selectedEvents.length && !selectedActivities.length && <p className="calendar-empty">此日无预定事项，宜随心而行。</p>}</div></footer>
  </section></div>;
}
