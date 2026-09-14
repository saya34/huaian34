"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import FishingReelGame, { type FishingReelConfig, type FishingReelResult } from "./FishingReelGame";
import { createFishingEncounter, resolveGiveTakeStep, type FishingEncounterPhase, type GiveTakeCommand } from "./encounter-engine";
import reelUi from "./content/reel-ui.json";

type Props = {
  fishId: string;
  rarity: number;
  config: FishingReelConfig;
  onFinish: (result: FishingReelResult) => void;
};

export default function FishingEncounter({ fishId, rarity, config, onFinish }: Props) {
  const encounter = useMemo(() => createFishingEncounter(fishId, rarity), [fishId, rarity]);
  const [phase, setPhase] = useState<FishingEncounterPhase>("waiting");
  const [giveTakeIndex, setGiveTakeIndex] = useState(0);
  const [balance, setBalance] = useState(0);
  const [stepResult, setStepResult] = useState<"correct" | "wrong" | null>(null);
  const [biteMissed, setBiteMissed] = useState(false);
  const finishedRef = useRef(false);
  const phaseRef = useRef<FishingEncounterPhase>(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (phase !== "waiting") return;
    const timer = window.setTimeout(() => setPhase("bite"), encounter.waitingMs);
    return () => window.clearTimeout(timer);
  }, [encounter.waitingMs, phase]);

  useEffect(() => {
    if (phase !== "bite") return;
    const timer = window.setTimeout(() => {
      if (finishedRef.current || phaseRef.current !== "bite") return;
      finishedRef.current = true;
      setBiteMissed(true);
      window.setTimeout(() => onFinish({ success: false, score: 0, attempts: 1 }), 620);
    }, encounter.biteWindowMs);
    return () => window.clearTimeout(timer);
  }, [encounter.biteWindowMs, onFinish, phase]);

  const judgeBite = () => {
    if (finishedRef.current || phaseRef.current !== "bite") return;
    setPhase("give-take");
  };

  const chooseGiveTake = (actual: GiveTakeCommand) => {
    if (finishedRef.current || phaseRef.current !== "give-take") return;
    const expected = encounter.giveTakePattern[giveTakeIndex];
    const result = resolveGiveTakeStep({ expected, actual, balance });
    setBalance(result.balance);
    setStepResult(result.correct ? "correct" : "wrong");
    window.setTimeout(() => setStepResult(null), 420);
    if (result.failed) {
      finishedRef.current = true;
      window.setTimeout(() => onFinish({ success: false, score: 0, attempts: giveTakeIndex + 1 }), 650);
      return;
    }
    if (giveTakeIndex + 1 >= encounter.giveTakePattern.length) {
      window.setTimeout(() => setPhase("bar"), 520);
      return;
    }
    setGiveTakeIndex((value) => value + 1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (phase === "bite" && (event.key === " " || event.key === "Enter")) {
      event.preventDefault(); judgeBite();
    }
    if (phase === "give-take" && (event.key === "ArrowLeft" || event.key.toLowerCase() === "a")) {
      event.preventDefault(); chooseGiveTake("reel");
    }
    if (phase === "give-take" && (event.key === "ArrowRight" || event.key.toLowerCase() === "d")) {
      event.preventDefault(); chooseGiveTake("release");
    }
  };

  if (phase === "bar") return <FishingReelGame config={config} onFinish={onFinish} />;

  const expected = encounter.giveTakePattern[giveTakeIndex];
  const phaseLabel = phase === "waiting" ? reelUi.phaseWaiting : phase === "bite" ? reelUi.phaseBite : reelUi.phaseGiveTake;
  const phaseIndex = phase === "waiting" ? 0 : phase === "bite" ? 1 : 2;
  return <div className={`fishing-encounter phase-${phase} rarity-${rarity} ${stepResult ? `step-${stepResult}` : ""} ${biteMissed ? "bite-missed" : ""}`} role="application" tabIndex={0} onKeyDown={onKeyDown} aria-label={phaseLabel}>
    <div className="fishing-reel-art" aria-hidden="true" />
    <div className="encounter-water-light" aria-hidden="true"><i /><i /><i /></div>
    <header className="encounter-phase-track">
      {[reelUi.phaseWaiting, reelUi.phaseBite, reelUi.phaseGiveTake, reelUi.phaseBar].map((label, index) => <span key={label} className={index === phaseIndex ? "active" : index < phaseIndex ? "reached" : ""}><i>{index + 1}</i><b>{label.split(" · ")[1]}</b></span>)}
    </header>
    <main className="encounter-stage">
      <div className={`encounter-float ${phase === "bite" ? "biting" : ""}`}><i /><b /><span /></div>
      <div className={`encounter-fish-shadow rarity-${rarity}`}><i /><b /><u /></div>
      {phase === "waiting" && <section className="encounter-message waiting-message"><small>{phaseLabel}</small><h3>{reelUi.waitingTitle}</h3><p>{reelUi.waitingBody}</p><div className="waiting-dots"><i /><i /><i /></div><b>{reelUi.waitingHint}</b></section>}
      {phase === "bite" && <section className="encounter-message bite-message"><small>{phaseLabel}</small><h3>{biteMissed ? reelUi.biteMiss : reelUi.biteTitle}</h3><p>{reelUi.biteBody}</p><button type="button" onClick={judgeBite}><i /><strong>{reelUi.biteAction}</strong><small>{reelUi.biteKeyboard}</small></button></section>}
      {phase === "give-take" && <section className="encounter-message give-take-message"><small>{phaseLabel}</small><h3>{reelUi.giveTakeTitle}</h3><p>{reelUi.giveTakeBody}</p><div className={`give-take-prompt command-${expected}`}><i /><strong>{expected === "reel" ? reelUi.giveTakePromptReel : reelUi.giveTakePromptRelease}</strong><span>{stepResult === "correct" ? reelUi.giveTakeCorrect : stepResult === "wrong" ? reelUi.giveTakeWrong : `${reelUi.giveTakeBalance} ${balance >= 0 ? "+" : ""}${balance}`}</span></div><div className="give-take-actions"><button type="button" onClick={() => chooseGiveTake("reel")}><b>{reelUi.giveTakeReel}</b><span>{reelUi.giveTakeReelHint}</span></button><button type="button" onClick={() => chooseGiveTake("release")}><b>{reelUi.giveTakeRelease}</b><span>{reelUi.giveTakeReleaseHint}</span></button></div><div className="give-take-progress">{encounter.giveTakePattern.map((_, index) => <i key={index} className={index < giveTakeIndex ? "done" : index === giveTakeIndex ? "active" : ""} />)}</div></section>}
    </main>
  </div>;
}
