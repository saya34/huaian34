"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import reelUi from "./content/reel-ui.json";

export type FishingReelConfig = {
  maxAttempts: number;
  targetScore: number;
  targetPoints?: number;
  nearPoints?: number;
  targetWidth?: number;
  nearWidth?: number;
  minSpeed?: number;
  maxSpeed?: number;
  difficultyLevel?: number;
  difficultyName?: string;
  rarity?: number;
};

export type FishingReelHit = {
  zone: "target" | "near" | "miss";
  points: number;
  score: number;
  attempts: number;
};

export type FishingReelResult = {
  success: boolean;
  score: number;
  attempts: number;
};

type Pace = "slow" | "steady" | "fast";

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const fillText = (template: string, values: Record<string, string | number>) => Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template);

export default function FishingReelGame({ config, children, onHit, onFinish }: {
  config: FishingReelConfig;
  children?: ReactNode;
  onHit?: (hit: FishingReelHit) => void;
  onFinish: (result: FishingReelResult) => void;
}) {
  const difficulty = Math.max(1, Math.min(9, Math.round(config.difficultyLevel ?? 4)));
  const focusWidth = config.targetWidth ?? Math.max(13, 25 - (difficulty - 1) * 1.35);
  const nearWidth = Math.max(focusWidth + 11, config.nearWidth ?? Math.max(34, 56 - (difficulty - 1) * 2));
  const targetPoints = config.targetPoints ?? 3;
  const nearPoints = config.nearPoints ?? 1;
  const minSpeed = config.minSpeed ?? (12 + difficulty * 1.8);
  const maxSpeed = config.maxSpeed ?? (27 + difficulty * 3.1);
  const rarity = config.rarity ?? 1;
  const rare = rarity >= 4;

  const [fishX, setFishX] = useState(() => randomBetween(8, 92));
  const [fishY, setFishY] = useState(52);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [combo, setCombo] = useState(0);
  const [tension, setTension] = useState(44);
  const [pace, setPace] = useState<Pace>("steady");
  const [lastHit, setLastHit] = useState<FishingReelHit["zone"] | null>(null);
  const [burst, setBurst] = useState(0);
  const fishXRef = useRef(fishX);
  const directionRef = useRef(Math.random() > .5 ? 1 : -1);
  const speedRef = useRef(randomBetween(minSpeed, maxSpeed));
  const targetSpeedRef = useRef(speedRef.current);
  const nextShiftRef = useRef(0);
  const lastTimeRef = useRef(0);
  const finishedRef = useRef(false);
  const clearHitRef = useRef<number | null>(null);

  useEffect(() => {
    let frame = 0;
    const choosePace = (time: number) => {
      const next = randomBetween(minSpeed, maxSpeed);
      targetSpeedRef.current = next;
      const ratio = (next - minSpeed) / Math.max(1, maxSpeed - minSpeed);
      setPace(ratio < .34 ? "slow" : ratio > .68 ? "fast" : "steady");
      nextShiftRef.current = time + randomBetween(Math.max(250, 900 - difficulty * 48), Math.max(620, 1600 - difficulty * 65));
      if (difficulty >= 5 && Math.random() < .22) directionRef.current *= -1;
    };
    const move = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = Math.min(.04, (time - lastTimeRef.current) / 1000);
      lastTimeRef.current = time;
      if (!nextShiftRef.current || time >= nextShiftRef.current) choosePace(time);
      speedRef.current += (targetSpeedRef.current - speedRef.current) * Math.min(1, delta * (2.5 + difficulty * .35));
      let next = fishXRef.current + directionRef.current * speedRef.current * delta;
      if (next >= 95 || next <= 5) {
        next = Math.max(5, Math.min(95, next));
        directionRef.current *= -1;
        choosePace(time);
      }
      fishXRef.current = next;
      setFishX(next);
      setFishY(52 + Math.sin(time / (440 - difficulty * 18)) * 10 + Math.sin(time / 970) * 5);
      frame = requestAnimationFrame(move);
    };
    frame = requestAnimationFrame(move);
    return () => {
      cancelAnimationFrame(frame);
      if (clearHitRef.current) window.clearTimeout(clearHitRef.current);
    };
  }, [difficulty, maxSpeed, minSpeed]);

  const finish = (success: boolean, nextScore: number, nextAttempts: number) => {
    finishedRef.current = true;
    window.setTimeout(() => onFinish({ success, score: nextScore, attempts: nextAttempts }), 780);
  };

  const strike = () => {
    if (finishedRef.current) return;
    const distance = Math.abs(fishXRef.current - 50);
    const zone: FishingReelHit["zone"] = distance <= focusWidth / 2 ? "target" : distance <= nearWidth / 2 ? "near" : "miss";
    const points = zone === "target" ? targetPoints : zone === "near" ? nearPoints : 0;
    const nextScore = score + points;
    const nextAttempts = attempts + 1;
    const nextTension = Math.max(8, Math.min(100, tension + (zone === "target" ? -9 : zone === "near" ? 4 : 22)));
    const hit = { zone, points, score: nextScore, attempts: nextAttempts };
    setScore(nextScore);
    setAttempts(nextAttempts);
    setTension(nextTension);
    setCombo((value) => zone === "target" ? value + 1 : zone === "near" ? Math.max(0, value) : 0);
    setLastHit(zone);
    setBurst((value) => value + 1);
    onHit?.(hit);
    if (clearHitRef.current) window.clearTimeout(clearHitRef.current);
    clearHitRef.current = window.setTimeout(() => setLastHit(null), 540);
    if (nextScore >= config.targetScore) finish(true, nextScore, nextAttempts);
    else if (nextAttempts >= config.maxAttempts || nextTension >= 100) finish(false, nextScore, nextAttempts);
    else {
      directionRef.current *= zone === "miss" ? -1 : 1;
      targetSpeedRef.current = randomBetween(minSpeed, maxSpeed);
      nextShiftRef.current = 0;
    }
  };

  const handlePointer = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    strike();
  };
  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      strike();
    }
  };

  const fishStrength = Math.max(0, 100 - score / config.targetScore * 100);
  const focusStart = 50 - focusWidth / 2;
  const focusEnd = 50 + focusWidth / 2;
  const inFocus = fishX >= focusStart && fishX <= focusEnd;
  const attemptsLeft = Math.max(0, config.maxAttempts - attempts);
  const hitCopy = lastHit === "target" ? fillText(reelUi.perfectHit, { points: targetPoints }) : lastHit === "near" ? fillText(reelUi.nearHit, { points: nearPoints }) : lastHit === "miss" ? reelUi.missHit : "";
  const instruction = lastHit === "target" ? reelUi.instructionPerfect : lastHit === "near" ? reelUi.instructionNear : lastHit === "miss" ? reelUi.instructionMiss : reelUi.instructionIdle;
  const fishCopy = fishStrength > 66 ? reelUi.fishStrong : fishStrength > 28 ? reelUi.fishWeak : reelUi.fishFading;
  const tensionCopy = tension > 82 ? reelUi.tensionDanger : tension < 24 ? reelUi.tensionLoose : reelUi.tensionSafe;
  const paceCopy = pace === "fast" ? reelUi.paceFast : pace === "slow" ? reelUi.paceSlow : reelUi.paceSteady;
  const stageStyle = { "--fish-x": `${fishX}%`, "--fish-y": `${fishY}%`, "--focus-width": `${focusWidth}%`, "--near-width": `${nearWidth}%`, "--fish-facing": directionRef.current > 0 ? "1" : "-1", "--tension": `${tension * 3.6}deg`, "--fish-energy": `${fishStrength * 3.6}deg` } as CSSProperties;

  return <div className={`fishing-reel-game hit-${lastHit ?? "none"} pace-${pace} ${rare ? `rare-fish rarity-${rarity}` : ""}`} style={stageStyle} role="button" tabIndex={0} aria-label={reelUi.ariaLabel} onPointerDown={handlePointer} onKeyDown={handleKey}>
    <div className="fishing-reel-art" aria-hidden="true" />
    <div className="fishing-reel-mist mist-a" aria-hidden="true" /><div className="fishing-reel-mist mist-b" aria-hidden="true" />
    <header className="fishing-reel-hud">
      <section className="reel-orb fish-orb"><i style={{ "--orb-fill": `${fishStrength * 3.6}deg` } as CSSProperties}><b>{Math.ceil(fishStrength)}</b><small>%</small></i><span><strong>{reelUi.fishSpirit}</strong><small>{fishCopy}</small></span></section>
      <div className="reel-attempts"><small>{reelUi.chanceLeft}</small><span>{Array.from({ length: config.maxAttempts }, (_, index) => <i key={index} className={index < attemptsLeft ? "live" : "spent"} />)}</span><b>{attemptsLeft}</b></div>
      <section className={`reel-orb tension-orb ${tension > 82 ? "danger" : ""}`}><span><strong>{reelUi.lineTension}</strong><small>{tensionCopy}</small></span><i style={{ "--orb-fill": `${tension * 3.6}deg` } as CSSProperties}><b>{tension}</b><small>%</small></i></section>
    </header>
    {rare && <div className="reel-rare-omen"><i /><span>{rarity === 5 ? reelUi.rareTitle5 : reelUi.rareTitle4}</span><strong>{rarity === 5 ? reelUi.rareBody5 : reelUi.rareBody4}</strong><b>{reelUi.rareBadge}</b></div>}
    <div className={`reel-water-playfield ${inFocus ? "fish-in-focus" : ""}`}>
      <div className="reel-judgement-bar"><small>{reelUi.barTitle}</small><i><u /><b /></i><span>{reelUi.barHint}</span></div>
      <div className="reel-focus-zone"><i /><i /><b>{inFocus ? reelUi.focusReady : reelUi.focusWaiting}</b><span>{reelUi.focusTitle}</span></div>
      <div className="reel-fish-shadow"><i /><b /><span>{paceCopy}</span></div>
      <div className="reel-hook"><i /><b /></div>
      {lastHit && <div className={`reel-hit-burst ${lastHit}`} key={burst}><i /><i /><i /><b>{hitCopy}</b></div>}
      <div className="reel-ripples"><i /><i /><i /></div>
      {children}
    </div>
    <footer className="fishing-reel-command">
      <div><small>{reelUi.instructionEyebrow}</small><strong>{instruction}</strong><span>{fillText(reelUi.difficulty, { level: difficulty, name: config.difficultyName ?? paceCopy })}</span></div>
      {combo >= 2 && <div className="reel-combo" key={combo}><small>{reelUi.combo}</small><b>×{combo}</b></div>}
      <button type="button" onPointerDown={(event) => { event.stopPropagation(); strike(); }}><i /><strong>{reelUi.tapAction}</strong><small>{reelUi.keyboardHint}</small></button>
    </footer>
  </div>;
}
