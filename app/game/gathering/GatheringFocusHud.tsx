"use client";

export type GatheringFocusTheme = "farm" | "livestock" | "mining";

type Stat = { label: string; value: string | number };
type Props = {
  theme: GatheringFocusTheme;
  kicker: string;
  objective: string;
  value: string;
  hint: string;
  icon: string;
  stats: Stat[];
  meter?: number;
  attention?: boolean;
};

export default function GatheringFocusHud({ theme, kicker, objective, value, hint, icon, stats, meter, attention = false }: Props) {
  return <section className={`gathering-focus-hud theme-${theme} ${attention ? "attention" : ""}`} aria-live="polite">
    <div className="gathering-focus-sigil" aria-hidden="true"><i /><b>{icon}</b><u /></div>
    <div className="gathering-focus-copy"><small>{kicker}</small><strong>{objective}</strong><span>{value}</span>{typeof meter === "number" && <i><u style={{ width: `${Math.max(0, Math.min(100, meter))}%` }} /></i>}<p>{hint}</p></div>
    <div className="gathering-focus-stats">{stats.slice(0, 3).map((stat) => <span key={stat.label}><small>{stat.label}</small><b>{stat.value}</b></span>)}</div>
  </section>;
}
