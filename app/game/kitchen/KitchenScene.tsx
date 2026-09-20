"use client";

import { useState } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { useFeedback } from "../feedback/FeedbackProvider";
import { KITCHEN_COPY } from "./content";
import { searchWarmStove } from "./service";

export default function KitchenScene({ day, onOpen, onNotice: _onNotice }: { day: number; onOpen: () => void; onNotice: (message: string) => void }) {
  const { state, transact } = useUnifiedGame();
  const feedback = useFeedback();
  const [stoveMessage, setStoveMessage] = useState("");
  const searched = state.kitchen.lastStoveSearchDay === day;

  function searchStove() {
    const result = searchWarmStove(state, day);
    if (!result.ok) { setStoveMessage(result.message); return; }
    transact(() => result.state);
    setStoveMessage(result.message);
    if (result.found && result.recipe) feedback.publish({
      variant: "progression-milestone",
      level:"L2",
      priority: 2,
      tone: "gold",
      titleKey: "items.rareTitle",
      bodyKey: "world.changeBody",
      params: { message: result.message },
      icon: "膳",
      imageSrc: result.recipe.art,
      eventId: `kitchen-stove:${day}`,
    });
  }

  return <div className="kitchen-scene-hub" aria-label="烟火小灶玩法入口">
    <div className="kitchen-scene-smoke" aria-hidden="true"><i /><i /><i /></div>
    <div className="kitchen-scene-copy">
      <small>{KITCHEN_COPY.subtitle}</small>
      <h3>{KITCHEN_COPY.name}</h3>
      <p>{KITCHEN_COPY.description}</p>
    </div>
    <div className="kitchen-scene-actions">
      <button type="button" className="kitchen-scene-primary" onClick={onOpen}><i>炊</i><span><small>八方食材入一灶</small><strong>{KITCHEN_COPY.openKitchen}</strong></span></button>
      <button type="button" className={`kitchen-stove-search ${searched ? "searched" : ""}`} onClick={searchStove} disabled={searched}><i>{searched ? "✓" : "揭"}</i><span><strong>{KITCHEN_COPY.searchStove}</strong><small>{searched ? KITCHEN_COPY.stoveSearched : KITCHEN_COPY.stoveIdle}</small></span></button>
    </div>
    {stoveMessage && <div className="kitchen-stove-message" role="status">{stoveMessage}</div>}
  </div>;
}
