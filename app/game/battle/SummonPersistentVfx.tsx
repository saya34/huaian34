"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { PartnerDefinition } from "./expedition";
import type { PersistentDrawFrame, PersistentParticleKind, PersistentVfxProfile } from "./persistent-vfx-types";
import { persistentProfiles01To06, drawPersistentVfx01To06 } from "./persistent-vfx/group-01-06";
import { persistentProfiles07To12, drawPersistentVfx07To12 } from "./persistent-vfx/group-07-12";
import { persistentProfiles13To18, drawPersistentVfx13To18 } from "./persistent-vfx/group-13-18";
import { persistentProfiles19To24, drawPersistentVfx19To24 } from "./persistent-vfx/group-19-24";
import { persistentProfiles25To30, drawPersistentVfx25To30 } from "./persistent-vfx/group-25-30";
import { summonEffectDuration, type SummonEffectDefinition } from "./summon-effects";
import uiText from "./content/persistent-vfx-ui.json";

type PersistentStyle = CSSProperties & Record<`--${string}`, string | number>;
type ParticleSeed = { x: number; y: number; phase: number; speed: number; size: number; drift: number; angle: number };

const TAU = Math.PI * 2;
const PROFILES = [
  ...persistentProfiles01To06,
  ...persistentProfiles07To12,
  ...persistentProfiles13To18,
  ...persistentProfiles19To24,
  ...persistentProfiles25To30,
] satisfies PersistentVfxProfile[];
const PROFILE_BY_ID = new Map(PROFILES.map((profile) => [profile.effectId, profile]));
const DRAW_HANDLERS = [drawPersistentVfx01To06, drawPersistentVfx07To12, drawPersistentVfx13To18, drawPersistentVfx19To24, drawPersistentVfx25To30];

function hashSeed(input: string) {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) value = Math.imul(value ^ input.charCodeAt(index), 16777619);
  return value >>> 0;
}

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function formatText(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

function makeParticles(effectId: string, count: number) {
  const random = seeded(hashSeed(effectId));
  return Array.from({ length: count }, () => ({
    x: random(), y: random(), phase: random(), speed: .55 + random() * 1.15,
    size: 1.3 + random() * 4.7, drift: random() * 2 - 1, angle: random() * TAU,
  } satisfies ParticleSeed));
}

function drawPetal(context: CanvasRenderingContext2D, size: number) {
  context.beginPath();
  context.moveTo(0, -size * 1.8);
  context.bezierCurveTo(size, -size * .6, size * .8, size * 1.1, 0, size * 1.8);
  context.bezierCurveTo(-size * .8, size * 1.1, -size, -size * .6, 0, -size * 1.8);
  context.fill();
}

function drawParticle(context: CanvasRenderingContext2D, particle: ParticleSeed, kind: PersistentParticleKind, time: number, width: number, height: number, primary: string, accent: string) {
  const cycle = (particle.phase + time * particle.speed * .14) % 1;
  let x = particle.x * width;
  let y = particle.y * height;
  if (["petal", "leaf", "feather", "snow", "drop"].includes(kind)) {
    x = ((particle.x + time * particle.drift * .018 + Math.sin(time * .7 + particle.phase * TAU) * .035) % 1.2 + 1.2) % 1.2 * width - width * .1;
    y = (-.08 + cycle * 1.18) * height;
  } else if (kind === "ember") {
    x += Math.sin(time * 1.8 + particle.phase * TAU) * width * .045;
    y = (1.05 - cycle * 1.14) * height;
  } else if (kind === "mist" || kind === "ink") {
    x = (-.12 + cycle * 1.24) * width;
    y += Math.sin(time * .55 + particle.phase * TAU) * height * .12;
  } else {
    const radius = Math.min(width, height) * (.18 + particle.x * .5);
    const angle = particle.angle + time * (.18 + particle.speed * .08) * (particle.drift < 0 ? -1 : 1);
    x = width * .5 + Math.cos(angle) * radius;
    y = height * .52 + Math.sin(angle) * radius * .72;
  }
  const alpha = (.38 + Math.sin((cycle + particle.phase) * Math.PI) * .62) * (kind === "mist" ? .46 : .96);
  const size = particle.size * 1.42;
  context.save();
  context.translate(x, y);
  context.rotate(particle.angle + time * particle.drift);
  context.globalAlpha = Math.max(.08, alpha);
  context.fillStyle = particle.phase > .46 ? primary : accent;
  context.strokeStyle = particle.phase > .46 ? accent : primary;
  context.shadowColor = primary;
  context.shadowBlur = kind === "mist" || kind === "ink" ? 7 : 13;
  if (kind === "spark" || kind === "star") {
    context.beginPath();
    for (let point = 0; point < 8; point += 1) {
      const radius = point % 2 ? size * .26 : size * (kind === "star" ? 1.85 : 1.22);
      const angle = point / 8 * TAU;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (!point) context.moveTo(px, py); else context.lineTo(px, py);
    }
    context.closePath(); context.fill();
  } else if (kind === "shard" || kind === "rune") {
    context.beginPath(); context.moveTo(0, -size * 1.8); context.lineTo(size * .5, 0); context.lineTo(0, size * 1.8); context.lineTo(-size * .5, 0); context.closePath();
    if (kind === "rune") { context.lineWidth = 1; context.stroke(); } else context.fill();
  } else if (kind === "snow") {
    context.lineWidth = 1; context.beginPath(); for (let arm = 0; arm < 3; arm += 1) { context.moveTo(-size, 0); context.lineTo(size, 0); context.rotate(Math.PI / 3); } context.stroke();
  } else if (kind === "mist" || kind === "ink") {
    context.beginPath(); context.ellipse(0, 0, size * 3.4, size, 0, 0, TAU); context.fill();
  } else if (kind === "drop") {
    context.beginPath(); context.moveTo(0, -size * 1.8); context.quadraticCurveTo(size * 1.2, 0, 0, size * 1.5); context.quadraticCurveTo(-size * 1.2, 0, 0, -size * 1.8); context.fill();
  } else drawPetal(context, kind === "feather" ? size * 1.2 : size);
  context.restore();
}

export function persistentSummonVfxAudit() {
  return { profiles: PROFILES.length, unique: new Set(PROFILES.map((profile) => profile.effectId)).size };
}

export function SummonPersistentVfx({ partner, resonance, effect }: { partner: PartnerDefinition; resonance: boolean; effect: SummonEffectDefinition }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const introDuration = summonEffectDuration(effect, resonance);
  const profile = PROFILE_BY_ID.get(effect.id);
  const durationMs = Math.max(4200, effect.gameplay.durationSeconds * 1000);
  const particles = useMemo(() => makeParticles(effect.id, profile?.particleCount ?? 48), [effect.id, profile?.particleCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !profile) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const introDelay = Math.max(900, introDuration - 260);
    const started = performance.now();
    let width = 1;
    let height = 1;
    let frame = 0;
    let active = true;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = reducedMotion ? 1 : Math.min(window.devicePixelRatio || 1, 1.35);
      width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const render = (now: number) => {
      if (!active) return;
      const elapsed = now - started - introDelay;
      context.clearRect(0, 0, width, height);
      if (elapsed >= 0) {
        const progress = Math.min(1, elapsed / durationMs);
        const drawFrame: PersistentDrawFrame = { context, width, height, time: elapsed / 1000, progress, primary: effect.palette.primary, secondary: effect.palette.secondary, accent: effect.palette.accent, reducedMotion };
        for (const handler of DRAW_HANDLERS) if (handler(effect.id, drawFrame)) break;
        context.save();
        context.globalCompositeOperation = "lighter";
        const count = reducedMotion ? Math.min(18, particles.length) : particles.length;
        for (let index = 0; index < count; index += 1) drawParticle(context, particles[index], profile.particleKind, elapsed / 1000, width, height, effect.palette.primary, effect.palette.accent);
        context.restore();
        if (progress >= 1) return;
      }
      frame = window.requestAnimationFrame(render);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    frame = window.requestAnimationFrame(render);
    return () => { active = false; observer.disconnect(); window.cancelAnimationFrame(frame); context.clearRect(0, 0, canvas.width, canvas.height); };
  }, [durationMs, effect, introDuration, particles, profile]);

  if (!profile) return null;
  const style = {
    "--persistent-primary": effect.palette.primary,
    "--persistent-secondary": effect.palette.secondary,
    "--persistent-accent": effect.palette.accent,
    "--persistent-shadow": effect.palette.shadow,
    "--persistent-delay": `${Math.max(900, introDuration - 260)}ms`,
    "--persistent-duration": `${durationMs}ms`,
    "--persistent-callout-duration": `${profile.centerDurationMs}ms`,
    "--persistent-card-duration": `${Math.min(durationMs, Math.max(profile.cardDurationMs, 5600))}ms`,
  } as PersistentStyle;

  return <section className={`summon-persistent-vfx effect-${effect.id} field-${profile.fieldClass} ${resonance ? "resonance" : ""}`} style={style} role="status" aria-label={`${profile.effectText}：${profile.mechanicText}`}>
    <div className="summon-persistent-field" aria-hidden="true"><i /><i /><i /><b>{profile.glyph}</b></div>
    <canvas ref={canvasRef} className="summon-persistent-canvas" aria-hidden="true" />
    <div className="summon-effect-callout">
      <small>{resonance ? uiText.resonanceLabel : formatText(uiText.normalLabel, { seconds: effect.gameplay.durationSeconds })}</small>
      <strong>{profile.effectText}</strong>
      <p>{profile.mechanicText}</p>
    </div>
    <aside className="summon-persistent-card" aria-hidden="true">
      <figure><img src={partner.art} alt="" /><i>{profile.glyph}</i></figure>
      <div><small>{formatText(uiText.cardLabel, { name: partner.name })}</small><strong>{effect.name}</strong><p>{profile.mechanicText}</p><em>{formatText(uiText.durationLabel, { seconds: effect.gameplay.durationSeconds })}</em></div>
    </aside>
    <span className="summon-persistent-progress" aria-hidden="true" />
  </section>;
}
