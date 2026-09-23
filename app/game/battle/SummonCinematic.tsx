"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { PartnerDefinition } from "./expedition";
import { summonEffectDuration, type SummonEffectDefinition, type SummonParticleShape } from "./summon-effects";

type CinematicStyle = CSSProperties & Record<`--${string}`, string | number>;
type Particle = { angle: number; distance: number; drift: number; phase: number; size: number; spin: number; speed: number; x: number; y: number };

const TAU = Math.PI * 2;

function hashSeed(input: string) {
  let value = 1779033703 ^ input.length;
  for (let index = 0; index < input.length; index += 1) value = Math.imul(value ^ input.charCodeAt(index), 3432918353);
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

function clamp(value: number, min = 0, max = 1) { return Math.min(max, Math.max(min, value)); }
function smooth(from: number, to: number, value: number) { const x = clamp((value - from) / Math.max(0.0001, to - from)); return x * x * (3 - 2 * x); }
function outCubic(value: number) { return 1 - Math.pow(1 - clamp(value), 3); }

function rgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
  const number = Number.parseInt(normalized, 16);
  return `rgba(${(number >> 16) & 255},${(number >> 8) & 255},${number & 255},${alpha})`;
}

function createParticles(effect: SummonEffectDefinition, reducedMotion: boolean) {
  const random = seeded(hashSeed(effect.id));
  const count = reducedMotion ? Math.min(20, effect.particleCount) : effect.particleCount;
  return Array.from({ length: count }, () => ({
    x: random(), y: random(), angle: random() * TAU, distance: 0.18 + random() * 0.72,
    drift: random() * 2 - 1, phase: random(), size: 1.2 + random() * 5.8,
    spin: (random() * 2 - 1) * 5, speed: 0.45 + random() * 1.1,
  } satisfies Particle));
}

function glowStroke(context: CanvasRenderingContext2D, color: string, width: number, blur: number, alpha = 1) {
  context.strokeStyle = rgba(color, alpha);
  context.lineWidth = width;
  context.shadowColor = color;
  context.shadowBlur = blur;
  context.lineCap = "round";
  context.lineJoin = "round";
}

function drawRing(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number, width = 2, broken = false) {
  glowStroke(context, color, width, 15, alpha);
  context.beginPath();
  if (broken) {
    for (let segment = 0; segment < 12; segment += 1) {
      const start = segment / 12 * TAU;
      context.arc(x, y, radius, start, start + 0.12 + (segment % 3) * 0.035);
    }
  } else context.arc(x, y, radius, 0, TAU);
  context.stroke();
}

function drawRuneWheel(context: CanvasRenderingContext2D, x: number, y: number, radius: number, rotation: number, color: string, alpha: number) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  drawRing(context, 0, 0, radius, color, alpha, 1.5, true);
  drawRing(context, 0, 0, radius * 0.72, color, alpha * 0.75, 1);
  glowStroke(context, color, 1.4, 8, alpha * 0.82);
  for (let index = 0; index < 8; index += 1) {
    context.rotate(TAU / 8);
    context.beginPath();
    context.moveTo(radius * 0.76, 0);
    context.lineTo(radius * 0.9, -radius * 0.07);
    context.lineTo(radius, 0);
    context.lineTo(radius * 0.9, radius * 0.07);
    context.closePath();
    context.stroke();
  }
  context.restore();
}

function drawSlash(context: CanvasRenderingContext2D, x: number, y: number, length: number, angle: number, color: string, alpha: number, width: number) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  const gradient = context.createLinearGradient(-length / 2, 0, length / 2, 0);
  gradient.addColorStop(0, "transparent");
  gradient.addColorStop(0.35, rgba(color, alpha * 0.52));
  gradient.addColorStop(0.57, rgba(color, alpha));
  gradient.addColorStop(1, "transparent");
  context.strokeStyle = gradient;
  context.shadowColor = color;
  context.shadowBlur = 22;
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(-length / 2, length * 0.09);
  context.quadraticCurveTo(0, -length * 0.16, length / 2, 0);
  context.stroke();
  context.lineWidth = Math.max(1, width * 0.24);
  context.strokeStyle = rgba("#ffffff", alpha * 0.9);
  context.stroke();
  context.restore();
}

function drawLightning(context: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number, color: string, alpha: number, seed: number, branches = true) {
  const random = seeded(seed);
  const points = [{ x: startX, y: startY }];
  const segments = 12;
  for (let index = 1; index < segments; index += 1) {
    const progress = index / segments;
    points.push({
      x: startX + (endX - startX) * progress + (random() - 0.5) * 42 * (1 - Math.abs(progress - 0.5)),
      y: startY + (endY - startY) * progress + (random() - 0.5) * 30,
    });
  }
  points.push({ x: endX, y: endY });
  for (const [width, opacity] of [[10, 0.14], [4, 0.6], [1.4, 1]] as const) {
    glowStroke(context, width < 2 ? "#ffffff" : color, width, width * 1.8, alpha * opacity);
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.stroke();
  }
  if (!branches) return;
  points.slice(3, 10).filter((_, index) => index % 3 === 0).forEach((point, index) => {
    glowStroke(context, color, 1.2, 8, alpha * 0.55);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + (index % 2 ? -1 : 1) * (28 + random() * 32), point.y + 24 + random() * 34);
    context.stroke();
  });
}

function drawPetal(context: CanvasRenderingContext2D, x: number, y: number, length: number, width: number, rotation: number, fill: string, alpha: number) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.fillStyle = rgba(fill, alpha);
  context.shadowColor = fill;
  context.shadowBlur = 10;
  context.beginPath();
  context.moveTo(0, -length / 2);
  context.bezierCurveTo(width, -length * 0.15, width * 0.72, length * 0.32, 0, length / 2);
  context.bezierCurveTo(-width * 0.72, length * 0.32, -width, -length * 0.15, 0, -length / 2);
  context.fill();
  context.restore();
}

function drawTemplate(context: CanvasRenderingContext2D, effect: SummonEffectDefinition, time: number, width: number, height: number) {
  const { primary, secondary, accent } = effect.palette;
  const x = width * 0.5;
  const y = height * 0.54;
  const min = Math.min(width, height);
  const reveal = smooth(0.04, 0.36, time);
  const impact = smooth(0.12, 0.34, time) * (1 - smooth(0.72, 1, time));
  const pulse = 0.82 + Math.sin(time * TAU * 3.2) * 0.08;
  context.save();
  context.globalCompositeOperation = "lighter";

  if (effect.template === "sword-rift") {
    drawRuneWheel(context, x, y, min * (0.22 + reveal * 0.1), -time * 1.8, secondary, 0.55 * reveal);
    const slashReveal = smooth(0.14, 0.3, time);
    drawSlash(context, x, y, width * 1.18 * slashReveal, -0.37, primary, impact, 18 * effect.intensity);
    drawSlash(context, x - width * 0.08, y + height * 0.08, width * 0.82 * slashReveal, 0.28, accent, impact * 0.82, 8 * effect.intensity);
    drawSlash(context, x + width * 0.12, y - height * 0.06, width * 0.65 * slashReveal, -0.78, secondary, impact * 0.62, 6 * effect.intensity);
  } else if (effect.template === "thunder-seal") {
    drawRuneWheel(context, x, y, min * 0.34 * reveal, time * 2.4, primary, 0.7 * reveal);
    drawRuneWheel(context, x, y, min * 0.21 * reveal, -time * 3.1, accent, 0.48 * reveal);
    const strike = smooth(0.17, 0.26, time) * (1 - smooth(0.72, 0.95, time));
    for (let index = 0; index < 5; index += 1) {
      const angle = index / 5 * TAU - Math.PI / 2;
      drawLightning(context, x + Math.cos(angle) * width * 0.58, y + Math.sin(angle) * height * 0.68, x, y, primary, strike, hashSeed(effect.id) + index + Math.floor(time * 22), index < 3);
    }
  } else if (effect.template === "frost-lotus") {
    drawRuneWheel(context, x, y, min * 0.34 * reveal, -time * 0.8, secondary, 0.42 * reveal);
    for (let ring = 0; ring < 2; ring += 1) for (let index = 0; index < 10; index += 1) {
      const angle = index / 10 * TAU + time * (ring ? -0.35 : 0.25);
      const radius = min * (ring ? 0.14 : 0.23) * reveal;
      drawPetal(context, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, min * (ring ? 0.18 : 0.25) * reveal, min * 0.045, angle + Math.PI / 2, ring ? primary : accent, impact * (ring ? 0.7 : 0.48));
    }
    drawRing(context, x, y, min * 0.12 * pulse, accent, impact, 3);
  } else if (effect.template === "golden-ward") {
    const radius = min * 0.38 * outCubic(reveal);
    context.save();
    context.translate(x, y + min * 0.16);
    context.scale(1.25, 0.82);
    glowStroke(context, primary, 7, 28, impact * 0.78);
    context.beginPath();
    context.arc(0, 0, radius, Math.PI, TAU);
    context.stroke();
    glowStroke(context, accent, 1.5, 8, impact);
    context.stroke();
    context.restore();
    drawRuneWheel(context, x, y + min * 0.06, radius * 0.78, -time * 1.2, secondary, 0.58 * reveal);
    for (let index = 0; index < 6; index += 1) drawRing(context, x, y, radius * (0.3 + index * 0.12), primary, impact * (0.44 - index * 0.045), 1.2);
  } else if (effect.template === "healing-bloom") {
    for (let ring = 0; ring < 3; ring += 1) drawRing(context, x, y + height * 0.12, min * (0.12 + ring * 0.1) * (0.75 + reveal * 0.35), ring % 2 ? secondary : primary, impact * (0.75 - ring * 0.16), 2.5 - ring * 0.4);
    for (let index = 0; index < 12; index += 1) {
      const angle = index / 12 * TAU + time * 0.5;
      const radius = min * 0.2 * reveal;
      drawPetal(context, x + Math.cos(angle) * radius, y + height * 0.12 + Math.sin(angle) * radius * 0.55, min * 0.16, min * 0.038, angle + Math.PI / 2, index % 2 ? primary : accent, impact * 0.72);
    }
    const gradient = context.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, rgba(primary, impact * 0.48));
    gradient.addColorStop(1, "transparent");
    context.fillStyle = gradient;
    context.fillRect(width * 0.12, 0, width * 0.76, height);
  } else if (effect.template === "phoenix-descent") {
    context.save();
    context.translate(x, y);
    context.scale(reveal, reveal);
    for (const direction of [-1, 1]) {
      glowStroke(context, primary, 7, 28, impact * 0.86);
      context.beginPath();
      context.moveTo(0, min * 0.04);
      context.bezierCurveTo(direction * min * 0.12, -min * 0.22, direction * min * 0.38, -min * 0.28, direction * min * 0.44, -min * 0.05);
      context.bezierCurveTo(direction * min * 0.31, -min * 0.14, direction * min * 0.18, min * 0.03, 0, min * 0.04);
      context.stroke();
      glowStroke(context, accent, 2, 12, impact);
      context.stroke();
    }
    glowStroke(context, secondary, 9, 25, impact * 0.75);
    context.beginPath();
    context.moveTo(0, -min * 0.17);
    context.quadraticCurveTo(min * 0.035, min * 0.02, 0, min * 0.2);
    context.stroke();
    for (let index = 0; index < 5; index += 1) {
      glowStroke(context, index % 2 ? primary : secondary, 3.5, 14, impact * 0.7);
      context.beginPath();
      context.moveTo(0, min * 0.14);
      context.quadraticCurveTo((index - 2) * min * 0.065, min * 0.32, (index - 2) * min * 0.11, min * 0.43);
      context.stroke();
    }
    context.restore();
  } else if (effect.template === "shadow-assault") {
    const mist = context.createRadialGradient(x, y, 0, x, y, min * 0.44);
    mist.addColorStop(0, rgba(secondary, impact * 0.72));
    mist.addColorStop(0.58, rgba(primary, impact * 0.14));
    mist.addColorStop(1, "transparent");
    context.fillStyle = mist;
    context.fillRect(0, 0, width, height);
    for (let index = 0; index < 7; index += 1) drawSlash(context, x + (index - 3) * width * 0.045, y + Math.sin(index) * height * 0.11, width * (0.48 + index * 0.06) * reveal, index % 2 ? -0.64 : 0.62, index % 3 ? primary : accent, impact * (0.36 + index * 0.07), 3 + index * 0.8);
  } else if (effect.template === "wind-domain") {
    context.save();
    context.translate(x, y);
    context.rotate(time * 1.4);
    for (let arm = 0; arm < 5; arm += 1) {
      glowStroke(context, arm % 2 ? primary : secondary, 2 + arm * 0.5, 13, impact * (0.75 - arm * 0.08));
      context.beginPath();
      for (let point = 0; point < 38; point += 1) {
        const progress = point / 37;
        const angle = progress * TAU * 1.35 + arm / 5 * TAU;
        const radius = min * 0.04 + min * 0.36 * progress * reveal;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius * 0.58;
        if (point === 0) context.moveTo(px, py); else context.lineTo(px, py);
      }
      context.stroke();
    }
    context.restore();
    drawRing(context, x, y, min * 0.11 * pulse, accent, impact * 0.8, 2.2);
  } else if (effect.template === "starfall-array") {
    drawRuneWheel(context, x, y, min * 0.33 * reveal, time * 0.7, secondary, 0.62 * reveal);
    const random = seeded(hashSeed(effect.id));
    const stars = Array.from({ length: 7 }, (_, index) => ({ angle: index / 7 * TAU - Math.PI / 2, radius: min * (0.17 + random() * 0.16) }));
    glowStroke(context, primary, 1.5, 11, impact * 0.78);
    context.beginPath();
    stars.forEach((star, index) => {
      const px = x + Math.cos(star.angle) * star.radius * reveal;
      const py = y + Math.sin(star.angle) * star.radius * reveal;
      if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
    });
    context.closePath();
    context.stroke();
    stars.forEach((star, index) => {
      const px = x + Math.cos(star.angle) * star.radius * reveal;
      const py = y + Math.sin(star.angle) * star.radius * reveal;
      drawRing(context, px, py, 4 + (index % 3) * 2, index % 2 ? accent : primary, impact, 2);
      const fall = smooth(0.14 + index * 0.025, 0.4 + index * 0.025, time);
      drawSlash(context, px - width * 0.12 * (1 - fall), py - height * 0.72 * (1 - fall), min * 0.34, 1.02, index % 2 ? primary : secondary, impact * fall, 4);
    });
  } else if (effect.template === "ink-dragon") {
    context.save();
    context.translate(x, y);
    context.rotate(-0.2 + time * 0.35);
    for (let layer = 0; layer < 3; layer += 1) {
      glowStroke(context, layer === 2 ? accent : layer === 1 ? primary : secondary, 18 - layer * 7, 20 - layer * 5, impact * (0.2 + layer * 0.3));
      context.beginPath();
      for (let point = 0; point < 50; point += 1) {
        const progress = point / 49;
        const angle = progress * TAU * 1.65 + time * 1.8;
        const radius = min * (0.08 + progress * 0.33) * reveal;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius * 0.58 + (progress - 0.5) * min * 0.08;
        if (point === 0) context.moveTo(px, py); else context.lineTo(px, py);
      }
      context.stroke();
    }
    context.restore();
    drawRuneWheel(context, x, y, min * 0.3 * reveal, -time * 1.1, primary, 0.32 * reveal);
  }
  context.restore();
}

function drawParticle(context: CanvasRenderingContext2D, shape: SummonParticleShape, particle: Particle, time: number, width: number, height: number, effect: SummonEffectDefinition) {
  const cycle = (time * particle.speed * 1.35 + particle.phase) % 1;
  const fade = Math.sin(cycle * Math.PI) * (1 - smooth(0.84, 1, time));
  const outward = outCubic(cycle) * particle.distance;
  let x = width * (0.5 + Math.cos(particle.angle) * outward * 0.55) + particle.drift * 45 * cycle;
  let y = height * (0.55 + Math.sin(particle.angle) * outward * 0.65);
  if (["petal", "leaf", "feather", "snow", "drop", "mist", "ember"].includes(shape)) {
    x = width * particle.x + Math.sin((cycle + particle.phase) * TAU) * 42 * particle.drift;
    y = shape === "ember" ? height * (1.02 - cycle * 1.08) : height * (-0.08 + cycle * 1.18);
  }
  context.save();
  context.translate(x, y);
  context.rotate(particle.angle + particle.spin * cycle);
  context.globalAlpha = fade * 0.9;
  context.fillStyle = particle.phase > 0.52 ? effect.palette.primary : effect.palette.accent;
  context.strokeStyle = effect.palette.secondary;
  context.shadowColor = effect.palette.primary;
  context.shadowBlur = 8;
  const size = particle.size * effect.intensity;
  if (shape === "spark" || shape === "star") {
    context.beginPath();
    for (let point = 0; point < 8; point += 1) {
      const radius = point % 2 ? size * 0.26 : size * (shape === "star" ? 1.8 : 1.2);
      const angle = point / 8 * TAU;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (!point) context.moveTo(px, py); else context.lineTo(px, py);
    }
    context.closePath(); context.fill();
  } else if (shape === "shard" || shape === "rune") {
    context.beginPath(); context.moveTo(0, -size * 1.8); context.lineTo(size * 0.48, 0); context.lineTo(0, size * 1.8); context.lineTo(-size * 0.48, 0); context.closePath();
    if (shape === "rune") context.stroke(); else context.fill();
  } else if (shape === "snow") {
    context.lineWidth = 1; context.beginPath(); for (let arm = 0; arm < 3; arm += 1) { context.moveTo(-size, 0); context.lineTo(size, 0); context.rotate(Math.PI / 3); } context.stroke();
  } else if (shape === "ink" || shape === "mist") {
    context.globalAlpha *= shape === "mist" ? 0.3 : 0.58;
    context.beginPath(); context.ellipse(0, 0, size * 2.2, size * 0.75, 0, 0, TAU); context.fill();
  } else if (shape === "drop") {
    context.beginPath(); context.moveTo(0, -size * 1.6); context.quadraticCurveTo(size * 1.2, 0, 0, size * 1.4); context.quadraticCurveTo(-size * 1.2, 0, 0, -size * 1.6); context.fill();
  } else {
    drawPetal(context, 0, 0, size * 3, size, 0, effect.palette.primary, 1);
  }
  context.restore();
}

export function SummonCinematic({ partner, resonance, effect }: { partner: PartnerDefinition; resonance: boolean; effect: SummonEffectDefinition }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const duration = summonEffectDuration(effect, resonance);
  const framedCardArt = partner.art.includes("/assets/cards/summon-showcase/");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const particles = createParticles(effect, media.matches);
    let frame = 0;
    let active = true;
    let width = 1;
    let height = 1;
    const started = performance.now();

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const render = (now: number) => {
      if (!active) return;
      const time = clamp((now - started) / duration);
      context.clearRect(0, 0, width, height);
      drawTemplate(context, effect, media.matches ? Math.max(time, 0.42) : time, width, height);
      context.save();
      context.globalCompositeOperation = "lighter";
      particles.forEach((particle) => drawParticle(context, effect.particle, particle, time, width, height, effect));
      context.restore();
      if (time < 1) frame = window.requestAnimationFrame(render);
    };
    resize();
    window.addEventListener("resize", resize);
    frame = window.requestAnimationFrame(render);
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [duration, effect]);

  const style = {
    "--summon-primary": effect.palette.primary,
    "--summon-secondary": effect.palette.secondary,
    "--summon-accent": effect.palette.accent,
    "--summon-shadow": effect.palette.shadow,
    "--summon-duration": `${duration}ms`,
    "--summon-shake": `${Math.round(effect.shake * (resonance ? 10 : 7))}px`,
  } as CinematicStyle;

  return <section className={`summon-cinematic template-${effect.template} category-${effect.category} ${resonance ? "resonance" : ""} ${framedCardArt ? "framed-card-art" : ""}`} style={style} aria-hidden="true">
    <span className="summon-vfx-backdrop" />
    <canvas ref={canvasRef} className="summon-vfx-canvas" />
    <span className="summon-vfx-impact" />
    <div className="summon-vfx-sigil"><i /><i /><b>{effect.glyph}</b></div>
    <div className="summon-vfx-portrait"><span />{/* Game portraits retain transparent edges; the native image element avoids optimizer padding. */}{/* eslint-disable-next-line @next/next/no-img-element */}<img src={partner.art} alt="" /></div>
    <div className="summon-vfx-title">
      <small>{resonance ? `同源共鸣 · ${partner.tag}` : effect.categoryLabel}</small>
      <h3>{partner.name}</h3>
      <strong>{effect.name}</strong>
      <p>{effect.incantation}</p>
    </div>
    <div className="summon-vfx-speedlines">{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</div>
  </section>;
}
