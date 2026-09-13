"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { CharacterDefinition, GiftDefinition, RelationshipStageDefinition, SceneDefinition } from "../types";
import { characterLedgerText as text } from "./character-ledger-text";

type CharacterLedgerProps = {
  characters: CharacterDefinition[];
  relationships: Record<string, number>;
  discoveredPreferences: Record<string, string[]>;
  giftMap: Record<string, GiftDefinition>;
  sceneMap: Record<string, SceneDefinition>;
  presentIds: string[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onVisit: (character: CharacterDefinition) => void;
  onClose: () => void;
  getStage: (character: CharacterDefinition, value: number) => RelationshipStageDefinition;
};

type Filter = "all" | "present" | "known";

function stagesFor(character: CharacterDefinition, current: RelationshipStageDefinition) {
  const stages = character.relationshipStages?.length ? character.relationshipStages : [current];
  return [...stages].sort((a, b) => a.min - b.min);
}

function bondProgress(stages: RelationshipStageDefinition[], value: number) {
  const finalThreshold = Math.max(1, stages.at(-1)?.min ?? 65);
  return Math.min(100, Math.max(0, value / finalThreshold * 100));
}

export default function CharacterLedger(props: CharacterLedgerProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const selected = props.selectedId ? props.characters.find((item) => item.id === props.selectedId) : undefined;
  const knownCount = Object.values(props.discoveredPreferences).reduce((sum, ids) => sum + ids.length, 0);
  const filtered = useMemo(() => props.characters.filter((item) => filter === "all" || filter === "present" ? filter === "all" || props.presentIds.includes(item.id) : (props.discoveredPreferences[item.id]?.length ?? 0) > 0), [filter, props.characters, props.discoveredPreferences, props.presentIds]);

  function knownPreferences(character: CharacterDefinition) {
    return (props.discoveredPreferences[character.id] ?? []).map((giftId) => {
      const preference = character.giftPreferences?.find((entry) => entry.giftId === giftId);
      const tier = preference?.tier ?? (character.lovedGift === giftId ? "loved" : "neutral");
      return text("knownPreference", { gift: props.giftMap[giftId]?.name ?? giftId, tier: text(`preferenceTier.${tier}`) });
    });
  }

  if (selected) {
    const relationship = props.relationships[selected.id] ?? 4;
    const currentStage = props.getStage(selected, relationship);
    const stages = stagesFor(selected, currentStage);
    const nextStage = stages.find((stage) => stage.min > relationship);
    const sceneName = props.sceneMap[selected.sceneId]?.name;
    const preferences = knownPreferences(selected);
    const style = { "--character-accent": selected.accent, "--bond-progress": `${bondProgress(stages, relationship)}%` } as CSSProperties;
    return <div className="character-codex-detail" style={style}>
      <button type="button" className="character-codex-back" onClick={() => props.onSelect(null)}>{text("back")}</button>
      <button type="button" className="character-codex-close" onClick={props.onClose} aria-label={text("close")}>×</button>
      <div className="character-codex-portrait"><img src={selected.image} alt={text("portraitAlt", { name: selected.name })}/><i/><span>{props.presentIds.includes(selected.id) ? text("presentNow") : sceneName ? text("atLocation", { scene: sceneName }) : text("unknownLocation")}</span></div>
      <div className="character-codex-profile">
        <header><small>{selected.role}</small><h2>{selected.name}</h2><p>{selected.courtesy}</p></header>
        <div className="character-bond-summary"><span><small>{text("bond")}</small><strong>{relationship}</strong></span><p><b>{currentStage.name}</b><em>{nextStage ? text("nextStage", { stage: nextStage.name, amount: nextStage.min - relationship }) : text("maxStage")}</em></p></div>
        <div className="character-bond-track" aria-label={`${text("bond")} ${relationship}`}><i><b/></i><div>{stages.map((stage) => <span key={stage.id} className={relationship >= stage.min ? "reached" : ""}><u/><small>{stage.name}</small></span>)}</div></div>
        <blockquote>{text("addressing", { name: currentStage.addressing })}</blockquote>
        <section><h3>{text("biography")}</h3><p>{selected.bio}</p></section>
        <section><h3>{text("preferences")}</h3><div className="character-preference-ribbons">{preferences.length ? preferences.map((label) => <span key={label}>✦ {label}</span>) : <em>{text("unknownPreference")}</em>}</div></section>
        <footer><span><small>{text("location")}</small><b>{sceneName ?? text("unknownLocation")}</b></span><button type="button" onClick={() => props.onVisit(selected)}>{text("visit")}</button></footer>
      </div>
    </div>;
  }

  return <div className="character-codex-roster">
    <header className="character-codex-heading"><span aria-hidden="true">缘</span><div><small>{text("eyebrow")}</small><h2>{text("title")}</h2><p>{text("subtitle")}</p></div><button type="button" onClick={props.onClose} aria-label={text("close")}>×</button></header>
    <div className="character-codex-stats"><span><b>{props.characters.length}</b>{text("total", { count: props.characters.length })}</span><span><b>{props.presentIds.length}</b>{text("present", { count: props.presentIds.length })}</span><span><b>{knownCount}</b>{text("known", { count: knownCount })}</span></div>
    <nav className="character-codex-filters" aria-label={text("title")}>{(["all", "present", "known"] as Filter[]).map((id) => <button type="button" key={id} className={filter === id ? "active" : ""} aria-pressed={filter === id} onClick={() => setFilter(id)}>{text(`filter.${id}`)}</button>)}</nav>
    <div className="character-codex-grid">{filtered.map((item, index) => {
      const relationship = props.relationships[item.id] ?? 4;
      const stage = props.getStage(item, relationship);
      const stages = stagesFor(item, stage);
      const preferences = knownPreferences(item);
      const sceneName = props.sceneMap[item.sceneId]?.name;
      const style = { "--character-accent": item.accent, "--bond-progress": `${bondProgress(stages, relationship)}%` } as CSSProperties;
      return <button type="button" key={item.id} className={`character-codex-card ${props.presentIds.includes(item.id) ? "is-present" : ""}`} style={style} onClick={() => props.onSelect(item.id)}>
        <span className="character-card-art"><img src={item.image} alt={text("portraitAlt", { name: item.name })}/><i/><em>{String(index + 1).padStart(2, "0")}</em><b>{props.presentIds.includes(item.id) ? text("presentNow") : sceneName ? text("atLocation", { scene: sceneName }) : text("unknownLocation")}</b></span>
        <span className="character-card-copy"><small>{item.role}</small><strong>{item.name}</strong><em>{item.courtesy}</em><span className="character-card-bond"><i><b/></i><u>{text("bond")} {relationship} · {stage.name}</u></span><p>{preferences[0] ?? text("unknownPreference")}</p><b>{text("view")} ›</b></span>
      </button>;
    })}{filtered.length === 0 && <p className="character-codex-empty">{text("empty")}</p>}</div>
  </div>;
}
