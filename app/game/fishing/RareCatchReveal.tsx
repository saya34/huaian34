"use client";

import type { FishDefinition } from "./fishing";
import reelUi from "./content/reel-ui.json";

export default function RareCatchReveal({ fish, firstObtain, onClose }: { fish: FishDefinition; firstObtain: boolean; onClose: () => void }) {
  return <div className={`rare-catch-reveal rarity-${fish.rarity} ${firstObtain ? "first-obtain" : "repeat-obtain"}`} role="dialog" aria-modal="true" aria-label={`${reelUi.rareRevealTitle} · ${fish.name}`}>
    <div className="rare-reveal-rays" aria-hidden="true"><i /><i /><i /></div>
    <section>
      <small>{reelUi.rareRevealEyebrow}</small>
      <div className="rare-reveal-art"><i /><img src={fish.art} alt={fish.name} /><b>{fish.icon}</b></div>
      <span>{fish.rarity >= 5 ? reelUi.rareRevealRarity5 : reelUi.rareRevealRarity4}</span>
      <h2>{fish.name}</h2>
      <p>{firstObtain ? reelUi.rareRevealBody : "熟悉的灵光再次落入鱼篓，鱼获已收入行囊。"}</p>
      <button type="button" onClick={onClose}>{reelUi.rareRevealContinue}</button>
    </section>
  </div>;
}
