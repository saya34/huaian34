"use client";

import type { CSSProperties } from "react";
import revealCopy from "./data/card-reveal.json";

type DivineCardBirthFxProps = {
  tier: "fated" | "mythic";
};

type BirthFxStyle = CSSProperties & Record<`--birth-${string}`, string>;

const CELESTIAL_GLYPHS = ["乾", "坎", "艮", "震", "巽", "离", "坤", "兑"];
const PARTICLE_COUNT = 26;
const FRAGMENT_COUNT = 12;

export function DivineCardBirthFx({ tier }: DivineCardBirthFxProps) {
  const copy = revealCopy[tier];

  return <>
    <div className={`divine-birth-backdrop divine-birth-${tier}`} aria-hidden="true">
      <div className="divine-birth-aurora" />
      <div className="divine-birth-rays">{Array.from({ length: 8 }).map((_, index) => <i key={index} style={{ "--birth-ray": `${index * 45}deg` } as BirthFxStyle} />)}</div>
      <div className="divine-birth-seal">
        <span className="seal-ring seal-ring-outer" />
        <span className="seal-ring seal-ring-inner" />
        <div className="seal-glyphs">{CELESTIAL_GLYPHS.map((glyph, index) => <i key={glyph} style={{ "--birth-glyph": `${index * 45}deg` } as BirthFxStyle}>{glyph}</i>)}</div>
        <b>{tier === "mythic" ? "神" : "命"}</b>
      </div>
      <div className="divine-birth-shockwaves"><i /><i /><i /></div>
    </div>

    <div className={`divine-birth-foreground divine-birth-${tier}`} aria-hidden="true">
      <div className="divine-birth-gates"><i /><i /></div>
      <div className="divine-birth-flash" />
      <div className="divine-birth-proclamation">
        <small>{copy.eyebrow}</small>
        <strong>{copy.title}</strong>
        <span>{copy.subtitle}</span>
      </div>
      <div className="divine-birth-particles">{Array.from({ length: PARTICLE_COUNT }).map((_, index) => {
        const angle = (index * 137.5) % 360;
        const distance = 29 + (index % 6) * 7;
        const size = 2 + (index % 4);
        const delay = (index % 7) * 35;
        return <i key={index} style={{ "--birth-angle": `${angle}deg`, "--birth-distance": `${distance}vmin`, "--birth-size": `${size}px`, "--birth-delay": `${delay}ms` } as BirthFxStyle} />;
      })}</div>
      <div className="divine-birth-fragments">{Array.from({ length: FRAGMENT_COUNT }).map((_, index) => <i key={index} style={{ "--birth-fragment-x": `${7 + ((index * 29) % 86)}%`, "--birth-fragment-tilt": `${-34 + (index % 7) * 11}deg`, "--birth-fragment-delay": `${(index % 5) * 80}ms` } as BirthFxStyle} />)}</div>
    </div>
  </>;
}
