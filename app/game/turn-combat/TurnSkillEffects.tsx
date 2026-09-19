"use client";

import type { CSSProperties, ReactNode } from "react";
import { TURN_SKILL_MAP, TURN_SKILL_VISUALS } from "./content";
import type { TurnBattleState, TurnSkillVisualDefinition } from "./types";

function pieces(className: string, count: number) {
  return Array.from({ length: count }, (_, index) => <i key={index} className={`${className} part-${index + 1}`}/>);
}

function EffectShape({ visual }: { visual: TurnSkillVisualDefinition }): ReactNode {
  switch (visual.family) {
    case "ink-slash":
      return <><span className="fx-ink-brush">{pieces("fx-ink-stroke", 3)}</span><span className="fx-ink-splash">{pieces("fx-drop", 6)}</span></>;
    case "barrier":
      return <><span className="fx-jade-shield"><i/><b/></span>{pieces("fx-ward-rune", 4)}</>;
    case "breath":
      return <><span className="fx-breath-stream">{pieces("fx-breath-orb", 5)}</span><span className="fx-breath-ring"/></>;
    case "flying-sword":
      return <><span className="fx-flying-sword"><i/><b/></span><span className="fx-sword-wake"/>{pieces("fx-sword-spark", 4)}</>;
    case "bolt-rain":
      return <span className="fx-bolt-rain">{pieces("fx-bolt", 7)}</span>;
    case "shadow-arrow":
      return <><span className="fx-shadow-bow"><i/></span><span className="fx-shadow-arrow"><i/><b/></span><span className="fx-arrow-target"/></>;
    case "blood-blade":
      return <><span className="fx-blood-crescent"/><span className="fx-blood-spray">{pieces("fx-blood-drop", 6)}</span></>;
    case "swallow":
      return <><span className="fx-swallow-flight">{pieces("fx-swallow", 2)}</span><span className="fx-swallow-wake">{pieces("fx-wind-thread", 3)}</span></>;
    case "serpent":
      return <span className="fx-serpent">{pieces("fx-serpent-segment", 8)}<b className="fx-serpent-head"/></span>;
    case "golden-dome":
      return <><span className="fx-golden-dome"><i/><b/></span><span className="fx-dome-runes">{pieces("fx-dome-rune", 6)}</span></>;
    case "buddha":
      return <><span className="fx-buddha-halo">{pieces("fx-halo-ring", 3)}</span><span className="fx-lotus">{pieces("fx-lotus-petal", 8)}</span><span className="fx-buddha-palm"/></>;
    case "fire-lotus":
      return <><span className="fx-fire-lotus">{pieces("fx-flame-petal", 8)}</span><span className="fx-fire-embers">{pieces("fx-ember", 7)}</span></>;
    case "staff":
      return <><span className="fx-falling-staff"><i/><b/></span><span className="fx-staff-impact">{pieces("fx-impact-ring", 3)}</span><span className="fx-ground-crack">{pieces("fx-crack", 4)}</span></>;
    case "frost":
      return <><span className="fx-frost-seal"><i/><b/><em/></span><span className="fx-ice-shards">{pieces("fx-ice-shard", 7)}</span></>;
    case "void-cleave":
      return <><span className="fx-void-rift"><i/><b/></span><span className="fx-void-cracks">{pieces("fx-void-crack", 5)}</span></>;
    case "heaven-sword":
      return <><span className="fx-heaven-sword"><i/><b/></span><span className="fx-heaven-rays">{pieces("fx-heaven-ray", 6)}</span><span className="fx-cloud-ring"/></>;
    case "demon-pierce":
      return <><span className="fx-demon-spears">{pieces("fx-demon-spear", 3)}</span><span className="fx-demon-eye"/></>;
    case "dragon":
      return <span className="fx-dragon-orbit">{pieces("fx-dragon-scale", 9)}<b className="fx-dragon-head"><i/><em/></b></span>;
    case "yin-yang":
      return <><span className="fx-yinyang-disc"><i/><b/></span><span className="fx-yinyang-orbit">{pieces("fx-yinyang-spark", 6)}</span></>;
    case "ghost-blade":
      return <><span className="fx-ghost-blades">{pieces("fx-ghost-blade", 3)}</span><span className="fx-ghost-smoke">{pieces("fx-smoke-wisp", 4)}</span></>;
    case "thunder":
      return <><span className="fx-thunder-core"/><span className="fx-thunder-branches">{pieces("fx-thunder-branch", 4)}</span><span className="fx-thunder-ring"/></>;
    case "blade-array":
      return <><span className="fx-blade-array">{pieces("fx-array-blade", 8)}</span><span className="fx-array-seal"/></>;
    case "orbs":
      return <><span className="fx-six-orbs">{pieces("fx-orb", 6)}</span><span className="fx-orb-core"/></>;
    case "quick-cut":
      return <><span className="fx-quick-cuts">{pieces("fx-quick-line", 3)}</span><span className="fx-quick-flash"/></>;
    case "shield-bash":
      return <><span className="fx-iron-shield"><i/><b/></span><span className="fx-bash-rings">{pieces("fx-bash-ring", 2)}</span></>;
    case "iron-wall":
      return <><span className="fx-iron-wall">{pieces("fx-wall-plate", 3)}</span><span className="fx-wall-rivets">{pieces("fx-rivet", 6)}</span><span className="fx-wall-dust">{pieces("fx-dust", 4)}</span></>;
    case "heavy-cleave":
      return <><span className="fx-heavy-cleave"><i/><b/></span><span className="fx-heavy-dust">{pieces("fx-dust", 6)}</span></>;
    case "war-cry":
      return <><span className="fx-war-mask"/><span className="fx-war-waves">{pieces("fx-war-wave", 3)}</span></>;
    case "wood-impact":
      return <><span className="fx-wood-arm"><i/><b/></span><span className="fx-wood-splinters">{pieces("fx-splinter", 7)}</span></>;
    default:
      return <><span className="fx-ink-brush">{pieces("fx-ink-stroke", 3)}</span><span className="fx-ink-splash">{pieces("fx-drop", 5)}</span></>;
  }
}

export function TurnSkillEffectLayer({ state }: { state: TurnBattleState }) {
  const event = state.lastEvents.find((entry) => entry.type === "turn" && entry.skillId);
  const skill = event?.skillId ? TURN_SKILL_MAP[event.skillId] : undefined;
  const visual = event?.skillId ? TURN_SKILL_VISUALS[event.skillId] : undefined;
  if (!event || !skill || !visual) return null;
  const actor = state.combatants.find((unit) => unit.id === event.actorId);
  const style = {
    "--fx-primary": visual.primary,
    "--fx-accent": visual.accent,
  } as CSSProperties;
  return <div key={event.id} className={`turn-skill-cinematic family-${visual.family} intensity-${visual.intensity} from-${actor?.team ?? "player"}`} style={style} aria-hidden="true">
    <div className="fx-stage"><EffectShape visual={visual}/></div>
    <span className="fx-sigil">{visual.sigil}</span>
    <span className="fx-technique-name">{skill.name}</span>
  </div>;
}
