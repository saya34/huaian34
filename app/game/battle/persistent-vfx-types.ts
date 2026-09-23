export type PersistentParticleKind = "shard" | "spark" | "rune" | "petal" | "feather" | "ember" | "mist" | "leaf" | "star" | "drop" | "ink" | "snow";

export type PersistentVfxProfile = {
  effectId: string;
  effectText: string;
  mechanicText: string;
  glyph: string;
  particleKind: PersistentParticleKind;
  particleCount: number;
  fieldClass: string;
  centerDurationMs: number;
  cardDurationMs: number;
};

export type PersistentDrawFrame = {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number;
  progress: number;
  primary: string;
  secondary: string;
  accent: string;
  reducedMotion: boolean;
};

export type PersistentDrawHandler = (effectId: string, frame: PersistentDrawFrame) => boolean;
