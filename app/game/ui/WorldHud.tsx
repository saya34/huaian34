"use client";

import hudText from "./content/world-hud.json";

type WorldHudProps = {
  location: string;
  date: string;
  period: string;
  level: number;
  experience: number;
  nextExperience: number;
  stamina: number;
  maxStamina?: number;
  spiritStones: number;
  onOpenCalendar?: () => void;
};

export default function WorldHud({ location, date, period, level, experience, nextExperience, stamina, maxStamina = 10, spiritStones, onOpenCalendar }: WorldHudProps) {
  const progress = nextExperience > 0 ? Math.min(100, Math.round(experience / nextExperience * 100)) : 100;
  return (
    <section className="mobile-world-hud" aria-label={hudText.aria}>
      <div className="mobile-world-hud-level" aria-label={`${hudText.levelShort} ${level}`}>
        <small>{hudText.levelShort}</small><strong>{level}</strong>
      </div>
      <button type="button" className="mobile-world-hud-place" onClick={onOpenCalendar} aria-label={`${location}，${date}，${period}，打开云和历`}>
        <strong>{location}</strong>
        <span>{date} · {period}</span>
        <div className="mobile-world-hud-exp" aria-label={`${hudText.experience} ${experience}/${nextExperience || experience}`}>
          <i style={{ transform: `scaleX(${progress / 100})` }} />
          <small>{hudText.experience} {nextExperience > 0 ? `${experience}/${nextExperience}` : "圆满"}</small>
        </div>
      </button>
      <div className="mobile-world-hud-resources">
        <b><i>息</i>{stamina}<small>/{maxStamina}</small></b>
        <b><i>石</i>{spiritStones.toLocaleString()}</b>
      </div>
    </section>
  );
}
