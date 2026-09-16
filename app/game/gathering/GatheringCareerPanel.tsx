"use client";

import { useRef, useState } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { GATHERING_RECIPES, GATHERING_UI, GATHERING_UPGRADES, gatheringCopy, gatheringProfession } from "./content";
import { gatheringLevelProgress, selectedTool } from "./engine";
import type { GatheringProfessionId } from "./types";

type Tab = "tools" | "processing" | "collection";

export default function GatheringCareerPanel({ professionId, onNotice }: { professionId: GatheringProfessionId; onNotice: (message: string) => void }) {
  const { state, setGathering, setMining, setFarm, applyEffects } = useUnifiedGame();
  const [tab, setTab] = useState<Tab>("tools");
  const definition = gatheringProfession(professionId);
  const career = state.gathering.careers[professionId];
  const level = gatheringLevelProgress(career.experience);
  const tool = selectedTool(professionId, career);
  const recipes = GATHERING_RECIPES.filter((item) => item.profession === professionId);
  const [toolIndex, setToolIndex] = useState(() => Math.max(0, definition.tools.findIndex((item) => item.id === tool.id)));
  const swipeStart = useRef<number | null>(null);
  const viewedTool = definition.tools[toolIndex] ?? definition.tools[0];
  const viewedUnlocked = career.toolTier >= viewedTool.minTier;
  const isEquipped = viewedTool.id === tool.id;
  const nextUpgrade = career.toolTier < 5 ? GATHERING_UPGRADES[career.toolTier - 1] : null;

  function chooseTool(id: string, minTier: number) {
    if (career.toolTier < minTier) { onNotice(`${definition.toolName}达到 ${minTier} 阶后解锁`); return; }
    setGathering((current) => ({ ...current, careers: { ...current.careers, [professionId]: { ...current.careers[professionId], selectedToolId: id } } }));
    onNotice(`已启用${definition.tools.find((item) => item.id === id)?.name}`);
  }

  function upgrade() {
    if (career.toolTier >= 5) { onNotice(`${definition.toolName}已达到五阶`); return; }
    const cost = GATHERING_UPGRADES[career.toolTier - 1];
    if (state.shared.spiritStones < cost.stones) { onNotice(`升阶需要 ${cost.stones} 灵石`); return; }
    const nextTier = (career.toolTier + 1) as 1 | 2 | 3 | 4 | 5;
    applyEffects([{ type: "add_currency", amount: -cost.stones }]);
    setGathering((current) => ({ ...current, careers: { ...current.careers, [professionId]: { ...current.careers[professionId], toolTier: nextTier } } }));
    if (professionId === "mining") setMining((current) => ({ ...current, pickaxeTier: nextTier, pickaxeLevel: Math.min(3, nextTier) as 1 | 2 | 3, pickaxeMaxDurability: 80 + (Math.min(3, nextTier) - 1) * 35, pickaxeDurability: 80 + (Math.min(3, nextTier) - 1) * 35 }));
    if (professionId === "farming") setFarm((current) => ({ ...current, toolLevel: Math.min(3, nextTier) }));
    onNotice(`${definition.toolName}升至 ${nextTier} 阶 · ${cost.unlock}`);
  }

  function process(recipe: (typeof recipes)[number]) {
    if (level.level < recipe.requiredLevel) { onNotice(`${definition.name} ${recipe.requiredLevel} 级后可加工`); return; }
    if (recipe.inputs.some((item) => (state.shared.items[item.itemId]?.amount ?? 0) < item.amount)) { onNotice(GATHERING_UI.missing); return; }
    applyEffects([...recipe.inputs.map((item) => ({ type: "remove_item" as const, itemId: item.itemId, amount: item.amount })), { type: "add_item", item: { itemId: recipe.output.itemId, itemType: "material", rarity: recipe.output.rarity as 1 | 2 | 3 | 4 | 5, amount: recipe.output.amount, sourceTags: [recipe.place, ...recipe.output.tags] } }]);
    setGathering((current) => ({ ...current, careers: { ...current.careers, [professionId]: { ...current.careers[professionId], experience: current.careers[professionId].experience + 5, processedCount: current.careers[professionId].processedCount + 1 } } }));
    onNotice(`加工完成 · ${recipe.output.name} ×${recipe.output.amount}`);
  }

  function displayItem(itemId: string) {
    const item = career.discoveries[itemId];
    if (!item || (state.shared.items[itemId]?.amount ?? 0) < 1) { onNotice("行囊中没有可陈列的实物"); return; }
    applyEffects([{ type: "remove_item", itemId, amount: 1 }]);
    setGathering((current) => ({ ...current, careers: { ...current.careers, [professionId]: { ...current.careers[professionId], displayed: { ...current.careers[professionId].displayed, [itemId]: item } } } }));
    onNotice(`${item.name}已陈列于${definition.collectionName}`);
  }

  function withdraw(itemId: string) {
    const item = career.displayed[itemId];
    if (!item) return;
    applyEffects([{ type: "add_item", item: { itemId, itemType: item.tags.includes("宝物") ? "treasure" : "material", rarity: item.rarity, amount: 1, sourceTags: [definition.collectionName, ...item.tags] } }]);
    setGathering((current) => {
      const displayed = { ...current.careers[professionId].displayed };
      delete displayed[itemId];
      return { ...current, careers: { ...current.careers, [professionId]: { ...current.careers[professionId], displayed } } };
    });
    onNotice(`${item.name}已取回行囊`);
  }

  function rotateTool(offset: number) {
    setToolIndex((current) => (current + offset + definition.tools.length) % definition.tools.length);
  }

  const primaryToolAction = () => {
    if (viewedUnlocked) { if (!isEquipped) chooseTool(viewedTool.id, viewedTool.minTier); return; }
    if (viewedTool.minTier === career.toolTier + 1) upgrade();
    else onNotice(gatheringCopy(GATHERING_UI.lockedUntil, { tier: viewedTool.minTier }));
  };

  return <section className="gathering-career-panel">
    <header><i>{definition.icon}</i><span><small>{GATHERING_UI.sectionTitle} · {definition.name}</small><strong>{tool.name} · {career.toolTier}阶</strong><em>{definition.description}</em></span><b>{GATHERING_UI.level} {level.level}</b></header>
    <div className="gathering-xp"><span style={{ width: `${level.percentage}%` }} /><small>{GATHERING_UI.experience} {level.current}/{level.needed || "MAX"}</small></div>
    <nav><button className={tab === "tools" ? "active" : ""} onClick={() => setTab("tools")}>{GATHERING_UI.toolTab}</button><button className={tab === "processing" ? "active" : ""} onClick={() => setTab("processing")}>{GATHERING_UI.processingTab}</button><button className={tab === "collection" ? "active" : ""} onClick={() => setTab("collection")}>{GATHERING_UI.collectionTab}</button></nav>
    {tab === "tools" && <div className="gathering-tool-stage" tabIndex={0} aria-label={GATHERING_UI.toolCarousel}
      onKeyDown={(event) => { if (event.key === "ArrowLeft") rotateTool(-1); if (event.key === "ArrowRight") rotateTool(1); }}
      onPointerDown={(event) => { swipeStart.current = event.clientX; }}
      onPointerUp={(event) => { if (swipeStart.current !== null && Math.abs(event.clientX - swipeStart.current) > 30) rotateTool(event.clientX > swipeStart.current ? -1 : 1); swipeStart.current = null; }}>
      <button type="button" className="tool-stage-arrow previous" onClick={() => rotateTool(-1)} aria-label={GATHERING_UI.previousTool}>‹</button>
      <div className={`tool-stage-focus ${viewedUnlocked ? "unlocked" : "locked"}`}>
        <div className="tool-pedestal" aria-hidden="true" />
        <div className="tool-silhouette"><b>{viewedTool.glyph}</b><i>{viewedTool.traitName}</i></div>
        <small>{viewedUnlocked ? `${viewedTool.minTier}阶灵具` : gatheringCopy(GATHERING_UI.lockedUntil, { tier: viewedTool.minTier })}</small>
        <h3>{viewedTool.name}</h3>
        <p>{viewedTool.description}</p>
        <div className="tool-stage-dots">{definition.tools.map((item, index) => <button type="button" key={item.id} className={`${index === toolIndex ? "active" : ""} ${career.toolTier < item.minTier ? "locked" : ""}`} onClick={() => setToolIndex(index)} aria-label={item.name} />)}</div>
      </div>
      <button type="button" className="tool-stage-arrow next" onClick={() => rotateTool(1)} aria-label={GATHERING_UI.nextTool}>›</button>
      <footer className="tool-stage-action">
        {viewedUnlocked ? <><span><b>{viewedTool.traitName}</b><small>{isEquipped ? GATHERING_UI.activeTool : GATHERING_UI.switchTool}</small></span><button type="button" onClick={primaryToolAction} disabled={isEquipped}>{isEquipped ? GATHERING_UI.equipped : GATHERING_UI.equip}</button></> : <><span><b>{nextUpgrade ? gatheringCopy(GATHERING_UI.upgradeCost, { stones: nextUpgrade.stones }) : GATHERING_UI.maxTier}</b><small>{nextUpgrade ? gatheringCopy(GATHERING_UI.unlockGain, { unlock: nextUpgrade.unlock }) : ""}</small></span><button type="button" onClick={primaryToolAction} disabled={!nextUpgrade || viewedTool.minTier > career.toolTier + 1}>{nextUpgrade ? gatheringCopy(GATHERING_UI.upgradeNow, { tier: career.toolTier + 1 }) : GATHERING_UI.maxTier}</button></>}
      </footer>
    </div>}
    {tab === "processing" && <div className="gathering-recipe-list">{recipes.map((recipe) => <article key={recipe.id}><span><small>{recipe.place} · {recipe.requiredLevel}级</small><strong>{recipe.name}</strong><em>{recipe.inputs.map((item) => `${item.name} ${state.shared.items[item.itemId]?.amount ?? 0}/${item.amount}`).join(" · ")}</em></span><button onClick={() => process(recipe)}>{GATHERING_UI.process}</button></article>)}</div>}
    {tab === "collection" && <div className="gathering-collection"><header><span>已识 {Object.keys(career.discoveries).length}</span><b>陈列 {Object.keys(career.displayed).length}</b></header>{Object.values(career.discoveries).length === 0 && <p>{GATHERING_UI.emptyCollection}</p>}{Object.values(career.discoveries).map((item) => <article key={item.itemId} className={`rarity-${item.rarity}`}><img src={item.art} alt="" /><span><strong>{item.name}</strong><small>{item.location} · {item.tags.join(" · ")}</small></span>{career.displayed[item.itemId] ? <button onClick={() => withdraw(item.itemId)}>{GATHERING_UI.withdraw}</button> : <button onClick={() => displayItem(item.itemId)}>{GATHERING_UI.display}</button>}</article>)}</div>}
  </section>;
}
