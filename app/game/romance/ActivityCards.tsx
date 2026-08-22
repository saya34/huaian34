import type { PeriodicActivityDefinition } from "./periodic-activities";

export default function ActivityCards({ activities, completedIds = [], onOpen }: { activities: PeriodicActivityDefinition[]; completedIds?: string[]; onOpen: (id: PeriodicActivityDefinition["id"]) => void }) {
  if (!activities.length) return null;
  return <div className="periodic-activity-stack" aria-label="今日周期活动">
    <p>今日活动</p>
    {activities.map((activity) => {const done=completedIds.includes(activity.id);return <button type="button" key={activity.id} className={`periodic-activity-card ${activity.accent} ${done?"completed":""}`} onClick={() => onOpen(activity.id)}>
      <i>{done?"✓":activity.icon}</i><span><small>{done?"今日已完成 · 点击查看":activity.scheduleLabel}</small><strong>{activity.name}</strong><em>{done?"签文与增益持续至现实今日结束":activity.subtitle}</em></span><b>›</b>
    </button>})}
  </div>;
}
