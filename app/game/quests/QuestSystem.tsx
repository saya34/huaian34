"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { useFeedback } from "../feedback/FeedbackProvider";
import { QUESTS, questText } from "./content";
import { questRewardEffects, questSortRank, questView, synchronizeQuestProgress } from "./engine";
import type { QuestDefinition, QuestNavigate, QuestStatus, QuestType } from "./types";

const ART = "/assets/quests/quest-dossier-v1.png";

function firstObjectiveLine(definition: QuestDefinition, state: ReturnType<typeof useUnifiedGame>["state"], statuses: ReturnType<typeof useUnifiedGame>["state"]["quests"]) {
  const view = questView(definition, statuses, state);
  const objective = view.objectives[0];
  return objective ? `${objective.description} ${questText("progress", { current: objective.current, required: objective.required })}` : questText("doneProgress");
}

function primaryLabel(status: QuestStatus) {
  if (status === "unaccepted") return questText("accept");
  if (status === "claimable" || status === "completed") return questText("claim");
  if (status === "claimed") return questText("claimed");
  return questText("go");
}

export function QuestStateSynchronizer() {
  const { state, hydrated, setQuests } = useUnifiedGame();
  const feedback = useFeedback();
  const previousStatuses = useRef(state.quests.statuses);

  useEffect(() => {
    if (!hydrated) return;
    setQuests((current) => synchronizeQuestProgress(current, state));
  }, [hydrated, setQuests, state]);

  useEffect(() => {
    if (!hydrated) return;
    for (const quest of QUESTS) {
      if (previousStatuses.current[quest.id] !== "claimable" && state.quests.statuses[quest.id] === "claimable") {
        feedback.publish({ variant: "project-milestone", priority: 1, tone: "gold", titleKey: "system.dynamicMessage", params: { message: questText("notice.claimable", { name: quest.name }) }, icon: "任", imageSrc: ART, dedupeKey: `quest-claimable:${quest.id}` });
      }
    }
    previousStatuses.current = state.quests.statuses;
  }, [feedback, hydrated, state.quests.statuses]);
  return null;
}

export function CurrentQuestCard({ onOpen, onNavigate }: { onOpen: () => void; onNavigate: QuestNavigate }) {
  const { state } = useUnifiedGame();
  const definition = QUESTS.find((quest) => quest.id === state.quests.trackedQuestId);
  if (!definition) return <section className="current-quest-card is-free"><img src={ART} alt=""/><div><small>{questText("freeExplore")}</small><h3>{questText("freeExplore")}</h3><p>{questText("freeExploreBody")}</p><button type="button" onClick={onOpen}>{questText("viewAll")}</button></div></section>;
  const view = questView(definition, state.quests, state);
  const objective = view.objectives[0];
  const claimable = view.status === "claimable" || view.status === "completed";
  return <section className={`current-quest-card type-${definition.type} status-${view.status}`}>
    <img src={ART} alt=""/>
    <div className="current-quest-copy"><small>{definition.type === "main" ? questText("currentMain") : questText("currentSide")}</small><h3>{definition.name}</h3>{objective && <div className="current-quest-objective"><span>{questText("currentObjective")}</span><strong>{objective.description}</strong><em>{questText("progress", { current: objective.current, required: objective.required })}</em><i><b style={{ width: `${Math.min(100, objective.current / objective.required * 100)}%` }}/></i></div>}<footer><button type="button" className="quest-primary" onClick={() => claimable ? onOpen() : onNavigate(definition)}>{primaryLabel(view.status)}</button><button type="button" className="quest-link" onClick={onOpen}>{questText("viewAll")}</button></footer></div>
    <span className="quest-corner-seal">任</span>
  </section>;
}

export default function QuestPanel({ onClose, onNavigate }: { onClose: () => void; onNavigate: QuestNavigate }) {
  const { state, setQuests, setRomance, applyEffects } = useUnifiedGame();
  const feedback = useFeedback();
  const initial = QUESTS.find((quest) => quest.id === state.quests.trackedQuestId) ?? QUESTS[0];
  const [tab, setTab] = useState<QuestType>(initial?.type ?? "main");
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [receipt, setReceipt] = useState<QuestDefinition | null>(null);
  const visible = useMemo(() => QUESTS.filter((quest) => quest.type === tab).map((definition) => questView(definition, state.quests, state)).sort((a, b) => questSortRank[a.status] - questSortRank[b.status] || a.definition.order - b.definition.order), [state, tab]);
  const selectedDefinition = QUESTS.find((quest) => quest.id === selectedId && quest.type === tab) ?? visible[0]?.definition;
  const selected = selectedDefinition ? questView(selectedDefinition, state.quests, state) : null;

  function notify(key: string, name: string) {
    feedback.toast({ titleKey: "system.dynamicMessage", params: { message: questText(key, { name }) }, icon: "任", tone: "gold", dedupeKey: `quest:${key}:${name}` });
  }

  function accept(definition: QuestDefinition) {
    setQuests((current) => ({ ...current, statuses: { ...current.statuses, [definition.id]: "in_progress" }, trackedQuestId: definition.type === "main" ? definition.id : current.trackedQuestId }));
    if (definition.id === "side-medicine-shortage" && state.romance.medicineShortage.status === "offered") setRomance((current) => ({ ...current, medicineShortage: { status: "active", acceptedDay: current.day, deadlineDay: current.day + 2, battleVictories: 0, farmHarvestsAtAccept: state.farm.totalHarvests } }));
    notify("notice.accepted", definition.name);
  }

  function track(definition: QuestDefinition) {
    setQuests((current) => ({ ...current, trackedQuestId: definition.id }));
    notify("notice.tracked", definition.name);
  }

  function claim(definition: QuestDefinition) {
    const latest = questView(definition, state.quests, state);
    if (!latest.complete || !["claimable", "completed"].includes(latest.status)) return;
    applyEffects(questRewardEffects(definition));
    setQuests((current) => {
      const statuses = { ...current.statuses, [definition.id]: "claimed" as const };
      if (definition.type === "main") {
        const next = QUESTS.filter((quest) => quest.type === "main" && quest.order > definition.order).sort((a, b) => a.order - b.order).find((quest) => statuses[quest.id] !== "claimed");
        if (next) { if (statuses[next.id] === "unaccepted") statuses[next.id] = "in_progress"; return { statuses, trackedQuestId: next.id }; }
      }
      const fallback = QUESTS.filter((quest) => quest.type === "main").sort((a, b) => a.order - b.order).find((quest) => statuses[quest.id] === "in_progress" || statuses[quest.id] === "claimable");
      return { statuses, trackedQuestId: current.trackedQuestId === definition.id ? fallback?.id ?? null : current.trackedQuestId };
    });
    setReceipt(definition);
    notify("notice.claimed", definition.name);
  }

  function act(definition: QuestDefinition, status: QuestStatus) {
    if (status === "unaccepted") accept(definition);
    else if (status === "claimable" || status === "completed") claim(definition);
    else if (status === "in_progress") { onClose(); onNavigate(definition); }
  }

  return <div className="quest-panel-backdrop" onMouseDown={onClose}><section className="quest-panel" role="dialog" aria-modal="true" aria-label={questText("panelTitle")} onMouseDown={(event) => event.stopPropagation()}>
    <header className="quest-panel-heading"><img src={ART} alt=""/><div><small>{questText("panelEyebrow")}</small><h2>{questText("panelTitle")}</h2></div><button type="button" onClick={onClose} aria-label={questText("close")}>×</button></header>
    <nav className="quest-tabs" aria-label={questText("panelTitle")}><button type="button" className={tab === "main" ? "active" : ""} onClick={() => setTab("main")}><i>主</i><span>{questText("mainTab")}</span></button><button type="button" className={tab === "side" ? "active" : ""} onClick={() => setTab("side")}><i>支</i><span>{questText("sideTab")}</span></button></nav>
    <div className="quest-workspace">
      <aside className="quest-list">{visible.map((view) => { const objective = view.objectives[0]; return <button type="button" key={view.definition.id} className={`${selected?.definition.id === view.definition.id ? "selected" : ""} status-${view.status}`} onClick={() => setSelectedId(view.definition.id)}><i>{view.definition.type === "main" ? "●" : "◇"}</i><span><strong>{view.definition.name}</strong><small>{objective ? `${objective.description} ${objective.current}/${objective.required}` : questText("doneProgress")}</small></span><em>{questText(`status.${view.status}`)}</em>{view.tracked && <b>追</b>}</button>})}{visible.length === 0 && <p>{questText("emptyList")}</p>}</aside>
      {selected && <main className={`quest-detail status-${selected.status}`}><div className="quest-detail-title"><span>{questText(`type.${selected.definition.type}`)}</span><h3>{selected.definition.name}</h3><em>{questText(`status.${selected.status}`)}</em></div><section><h4>{questText("background")}</h4><p>{selected.definition.summary}</p></section><section><h4>{questText("objectives")}</h4><div className="quest-objectives">{selected.objectives.map((objective) => <div className={objective.done ? "done" : ""} key={objective.id}><i>{objective.done ? "✓" : "◇"}</i><span><strong>{objective.description}</strong><small>{questText("progress", { current: objective.current, required: objective.required })}</small></span><em>{objective.done ? questText("doneProgress") : ""}</em></div>)}</div></section><section><h4>{questText("rewards")}</h4><div className="quest-rewards">{selected.definition.rewards.map((reward, index) => <span key={`${reward.type}-${reward.label}-${index}`}><i>{reward.type === "currency" ? "石" : reward.type === "experience" ? "修" : "物"}</i><b>{reward.label}</b><em>×{reward.amount}</em></span>)}</div></section><footer>{selected.status !== "unaccepted" && selected.status !== "claimed" && !selected.tracked && <button type="button" className="quest-track" onClick={() => track(selected.definition)}>{questText("track")}</button>}<small>{selected.definition.type === "main" ? questText("mainCannotAbandon") : questText("sideTrackHint")}</small><button type="button" className="quest-primary" disabled={selected.status === "claimed"} onClick={() => act(selected.definition, selected.status)}>{primaryLabel(selected.status)}</button></footer></main>}
    </div>
    {receipt && <div className="quest-reward-backdrop"><section className="quest-reward-modal" role="dialog" aria-modal="true"><img src={ART} alt=""/><span>成</span><small>{questText("rewardTitle")}</small><h3>{receipt.name}</h3><p>{questText("rewardObtained")}</p><div>{receipt.rewards.map((reward, index) => <b key={`${reward.type}-${index}`}>{reward.label} ×{reward.amount}</b>)}</div><button type="button" className="quest-primary" onClick={() => setReceipt(null)}>{questText("continue")}</button></section></div>}
  </section></div>;
}
