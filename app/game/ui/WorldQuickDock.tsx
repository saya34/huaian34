"use client";

import quickContent from "../world/content/quick-destinations.json";

export type QuickDestination = (typeof quickContent.destinations)[number];

type Props = {
  currentSceneId: string;
  currentFarmModule?: "field" | "livestock" | null;
  period: string;
  nextPeriod: string;
  onDestination: (destination: QuickDestination) => void;
  onAdvanceTime: () => void;
};

export default function WorldQuickDock({ currentSceneId, currentFarmModule, period, nextPeriod, onDestination, onAdvanceTime }: Props) {
  return <nav className="world-quick-dock" aria-label={quickContent.aria}>
    <div className="world-quick-destinations">
      {quickContent.destinations.map((destination) => {
        const active = destination.kind === "scene"
          ? currentSceneId === destination.sceneId
          : destination.kind === "farm" && currentSceneId === "spirit-farm" && currentFarmModule === destination.module;
        return <button key={destination.id} type="button" className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={() => onDestination(destination)}>
          <i>{destination.short}</i><span>{destination.label}</span>
        </button>;
      })}
    </div>
    <button type="button" className="world-time-advance" onClick={onAdvanceTime} aria-label={`${quickContent.timeLabel}，从${period}到${nextPeriod}`}>
      <i><b>{period.slice(0, 1)}</b><u>›</u><b>{nextPeriod.slice(0, 1)}</b></i>
      <span><strong>{quickContent.timeLabel}</strong><small>{period} → {nextPeriod}</small></span>
    </button>
  </nav>;
}
