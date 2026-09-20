"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCalendarDate } from "../calendar-engine";
import { DAYBREAK_CONTENT, type DaybreakStory } from "./content";

export type DaybreakPresentation = {
  day: number;
  story?: DaybreakStory;
};

type StoryLine = { kind: "narrator" | "thought"; text: string };

export function NightfallNotice({ onSleep, onDismiss }: { onSleep: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 5200);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return <aside className="nightfall-notice" role="status" aria-live="polite">
    <div className="nightfall-moon" aria-hidden="true"><i/><b>月</b></div>
    <div className="nightfall-copy">
      <small>{DAYBREAK_CONTENT.nightfall.kicker}</small>
      <strong>{DAYBREAK_CONTENT.nightfall.title}</strong>
      <p>{DAYBREAK_CONTENT.nightfall.message}</p>
    </div>
    <div className="nightfall-actions">
      <button type="button" onClick={onSleep}>{DAYBREAK_CONTENT.nightfall.sleepAction}</button>
      <button type="button" className="ghost" onClick={onDismiss}>{DAYBREAK_CONTENT.nightfall.laterAction}</button>
    </div>
  </aside>;
}

export default function DaybreakTransition({ presentation, onComplete }: { presentation: DaybreakPresentation; onComplete: () => void }) {
  const [phase, setPhase] = useState<"veil" | "dawn" | "story" | "leaving">("veil");
  const [lineIndex, setLineIndex] = useState(0);
  const exitTimer = useRef<number | null>(null);
  const date = getCalendarDate(presentation.day);
  const copy = DAYBREAK_CONTENT.daybreak;
  const lines = useMemo<StoryLine[]>(() => presentation.story ? [
    ...presentation.story.narration.map((text) => ({ kind: "narrator" as const, text })),
    ...presentation.story.thoughts.map((text) => ({ kind: "thought" as const, text })),
  ] : [], [presentation.story]);

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase("dawn"), 760);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => () => {
    if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
  }, []);

  const leave = () => {
    setPhase("leaving");
    exitTimer.current = window.setTimeout(onComplete, 620);
  };

  const advance = () => {
    if (phase === "dawn") {
      if (lines.length) setPhase("story");
      else leave();
      return;
    }
    if (phase !== "story") return;
    if (lineIndex < lines.length - 1) setLineIndex((value) => value + 1);
    else leave();
  };

  const activeLine = lines[lineIndex];
  const showStory = phase === "story" || (phase === "leaving" && lines.length > 0);
  return <div className={`daybreak-transition phase-${phase}`} role="dialog" aria-modal="true" aria-label={copy.title}>
    <div className="daybreak-night-curtain" aria-hidden="true"><i/><i/><i/></div>
    <div className="daybreak-window" aria-hidden="true"><span/><b/><i/><i/></div>
    <section className="daybreak-card daybreak-dialogue-box">
      {!showStory ? <>
        <div className="event-kicker daybreak-kicker">
          <span>{copy.kicker}</span><i/><span>{date.eraYear} · {date.monthName}{date.dayName}</span>
        </div>
        <button type="button" className="dialogue-advance daybreak-dialogue-advance" onClick={advance}>
          <div className="speaker-row"><strong>{copy.title}</strong><span>{copy.location} · {date.weekdayName} · 第 {presentation.day} 日</span></div>
          <p>{presentation.story ? presentation.story.omen : copy.quietMorning}</p>
          <span className="continue-mark">{presentation.story ? copy.listenAction : copy.openAction} ···</span>
        </button>
      </> : activeLine && <button
        type="button"
        className={`dialogue-advance daybreak-dialogue-advance line-${activeLine.kind}`}
        key={`${presentation.story?.id}-${lineIndex}`}
        onClick={advance}
      >
        <div className="event-kicker daybreak-kicker"><span>{presentation.story?.chapter}</span><i/><span>{presentation.story?.title}</span></div>
        <div className="speaker-row"><strong>{activeLine.kind === "narrator" ? copy.narratorLabel : copy.thoughtLabel}</strong><span>{lineIndex + 1} / {lines.length}</span></div>
        <p>{activeLine.text}</p>
        <span className="continue-mark">{lineIndex === lines.length - 1 ? copy.finishAction : copy.continueAction} ···</span>
      </button>}
    </section>
  </div>;
}
