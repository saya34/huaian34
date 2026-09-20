import type { CSSProperties } from "react";
import type { SceneVfxDefinition, StoryVfxDefinition } from "./content";

type VfxStyle = CSSProperties & Record<`--${string}`, string | number>;

function seeded(seed: number) {
  const value = Math.sin(seed * 9283.117) * 43758.5453;
  return value - Math.floor(value);
}

function particleStyle(index: number, count: number, salt: number): VfxStyle {
  const a = seeded(index + salt);
  const b = seeded(index * 3 + salt * 2);
  const c = seeded(index * 7 + salt * 5);
  const y = b * 78 + 8;
  const duration = 4.8 + b * 7.4;
  const drift = (c - 0.5) * 150;
  const turn = (a * 2 - 1) * 210;
  const opacity = 0.38 + b * 0.55;
  return {
    "--vfx-x": `${Math.round(((index + 0.5) / count) * 100 + (a - 0.5) * 9)}%`,
    "--vfx-y": `${Math.round(y)}%`,
    "--vfx-fog-y": `${Math.round(8 + y * 0.58)}%`,
    "--vfx-delay": `${(-a * 9.5).toFixed(2)}s`,
    "--vfx-duration": `${duration.toFixed(2)}s`,
    "--vfx-duration-snow": `${(duration * 1.35).toFixed(2)}s`,
    "--vfx-duration-rain": `${(duration * 0.22).toFixed(2)}s`,
    "--vfx-duration-storm": `${(duration * 0.115).toFixed(2)}s`,
    "--vfx-duration-fog": `${(duration * 2.4).toFixed(2)}s`,
    "--vfx-duration-ember": `${(duration * 0.78).toFixed(2)}s`,
    "--vfx-duration-half": `${(duration * 0.5).toFixed(2)}s`,
    "--vfx-duration-ink": `${(duration * 1.15).toFixed(2)}s`,
    "--vfx-drift": `${Math.round(drift)}px`,
    "--vfx-drift-mid": `${Math.round(drift * 0.55)}px`,
    "--vfx-drift-small": `${Math.round(drift * 0.35)}px`,
    "--vfx-drift-reverse": `${Math.round(drift * -0.55)}px`,
    "--vfx-drift-snow-end": `${Math.round(drift * -0.18)}px`,
    "--vfx-scale": (0.58 + c * 0.86).toFixed(2),
    "--vfx-turn": `${Math.round(turn)}deg`,
    "--vfx-turn-mid": `${Math.round(turn * 0.55)}deg`,
    "--vfx-turn-leaf": `${Math.round(turn * 0.45)}deg`,
    "--vfx-turn-small": `${Math.round(turn * 0.2)}deg`,
    "--vfx-turn-rune": `${Math.round(45 + turn)}deg`,
    "--vfx-opacity": opacity.toFixed(2),
    "--vfx-opacity-soft": (opacity * 0.52).toFixed(2),
  };
}

function ParticleField({ count, salt }: { count: number; salt: number }) {
  return <>{Array.from({ length: count }, (_, index) => <i key={index} style={particleStyle(index, count, salt)} />)}</>;
}

export function SceneEffectsLayer({ effects }: { effects: SceneVfxDefinition[] }) {
  if (!effects.length) return null;
  return <div className="scene-vfx-stack" aria-hidden="true">
    {effects.map((effect, effectIndex) => (
      <div key={effect.id} className={`scene-vfx scene-vfx-${effect.visual}`} data-vfx={effect.id}>
        <span className="vfx-atmosphere" />
        <ParticleField count={effect.particleCount} salt={(effectIndex + 1) * 29 + effect.id.length} />
      </div>
    ))}
  </div>;
}

export function StoryEffectsLayer({ effect, eventKey }: { effect: StoryVfxDefinition | null; eventKey?: string }) {
  if (!effect) return null;
  return <div key={`${eventKey ?? "story"}-${effect.id}`} className={`story-vfx story-vfx-${effect.visual}`} data-vfx={effect.id} aria-hidden="true">
    <span className="story-vfx-core" />
    <ParticleField count={effect.particleCount} salt={71 + effect.id.length} />
  </div>;
}
