"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { useFeedback } from "../feedback/FeedbackProvider";
import { QUESTS, questText } from "./content";
import { isQuestVisible, questRewardEffects, questSortRank, questView, synchronizeQuestProgress } from "./engine";
import type { QuestDefinition, QuestNavigate, QuestStatus, QuestType } from "./types";

const ART = "/assets/quests/quest-dossier-v1.png";
const QUEST_CARD_STORAGE_KEY = "huaian:quest-card-collapsed:v1";

function firstObjectiveLine(definition: QuestDefinition, state: ReturnType<typeof useUnifiedGame>["state"], statuses: ReturnType<typeof useUnifiedGame>["state"]["quests"]) {
  const view = questView(definition, statuses, state);
  const objective = view.objectives[0];
  return objective ? `${objective.description} ${questText("progress", { current: objective.current, required: objective.required })}` : questText("doneProgress");
}

function primaryLabel(status: QuestStatus, definition?: QuestDefinition) {
  if (status === "unaccepted") return definition?.giver ? questText("meetGiver") : questText("accept");
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
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem(QUEST_CARD_STORAGE_KEY);
    setCollapsed(stored === null ? window.matchMedia("(max-width: 760px)").matches : stored === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(QUEST_CARD_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const definition = QUESTS.find((quest) => quest.id === state.quests.trackedQuestId);
  const toggle = <button type="button" className="quest-card-toggle" aria-expanded={!collapsed} aria-label={collapsed ? questText("expandCard") : questText("collapseCard")} title={collapsed ? questText("expandCard") : questText("collapseCard")} onClick={toggleCollapsed}><span aria-hidden="true">{collapsed ? "任" : "收"}</span></button>;
  if (!definition) return <section className={`current-quest-card is-free ${collapsed ? "is-collapsed" : ""}`} aria-label={questText("freeExplore")}>
    {toggle}<img className="quest-hud-art" src={ART} alt=""/>
    <span className="quest-hud-crest" aria-hidden="true"><b>游</b><i>{questText("freeExploreTag")}</i></span>
    <div className="current-quest-copy"><header><small>{questText("hudTitle")}</small><em>{questText("freeExplore")}</em></header><h3>{questText("freeExplore")}</h3><p>{questText("freeExploreBody")}</p><footer><button type="button" className="quest-link" onClick={onOpen}><span aria-hidden="true">卷</span>{questText("viewAll")}</button></footer></div>
  </section>;
  const view = questView(definition, state.quests, state);
  const objective = view.objectives[0];
  const awaitingDialogue = view.status === "unaccepted" && definition.giver;
  const claimable = view.status === "claimable" || view.status === "completed";
  const progressPercent = objective && !awaitingDialogue ? Math.min(100, objective.required > 0 ? objective.current / objective.required * 100 : 100) : 0;
  const taskType = definition.type === "main" ? questText("currentMain") : questText("currentSide");
  const cardStyle = { "--quest-progress": `${progressPercent}%` } as CSSProperties;
  return <section className={`current-quest-card type-${definition.type} status-${view.status} ${collapsed ? "is-collapsed" : ""}`} style={cardStyle} aria-label={questText("hudAria", { type: taskType, name: definition.name })}>
    {toggle}
    <img className="quest-hud-art" src={ART} alt=""/>
    <span className="quest-hud-crest" aria-hidden="true"><b>任</b><i>{definition.type === "main" ? questText("mainShort") : questText("sideShort")}</i></span>
    <div className="current-quest-copy">
      <header><small>{taskType}</small><em>{questText(`status.${view.status}`)}</em></header>
      <h3>{definition.name}</h3>
      {objective && <div className="current-quest-objective"><span aria-hidden="true">◆</span><strong>{awaitingDialogue ? questText("meetObjective", { name: definition.giver!.name }) : objective.description}</strong><em>{awaitingDialogue ? questText("status.unaccepted") : questText("progress", { current: objective.current, required: objective.required })}</em><i aria-hidden="true"><b/></i></div>}
      <footer><button type="button" className="quest-primary" onClick={() => claimable ? onOpen() : onNavigate(definition, awaitingDialogue ? "giver" : "objective")}>{primaryLabel(view.status, definition)}</button><button type="button" className="quest-link" onClick={onOpen}><span aria-hidden="true">卷</span>{questText("viewAll")}</button></footer>
    </div>
    <span className="quest-status-pip" aria-hidden="true">{claimable ? "!" : definition.type === "main" ? "主" : "支"}</span>
  </section>;
}

export function QuestOfferDialogue({ definition, onClose }: { definition: QuestDefinition; onClose: () => void }) {
  const { state, setQuests, setRomance } = useUnifiedGame();
  const feedback = useFeedback();
  const [result, setResult] = useState<"accepted" | "declined" | null>(null);
  const giver = definition.giver;
  if (!giver) return null;

  function accept() {
    setQuests((current) => ({ ...current, statuses: { ...current.statuses, [definition.id]: "in_progress" }, trackedQuestId: definition.type === "main" ? definition.id : current.trackedQuestId }));
    if (definition.id === "side-medicine-shortage" && state.romance.medicineShortage.status === "offered") setRomance((current) => ({ ...current, medicineShortage: { status: "active", acceptedDay: current.day, deadlineDay: current.day + 2, battleVictories: 0, farmHarvestsAtAccept: state.farm.totalHarvests } }));
    feedback.toast({ titleKey: "system.dynamicMessage", params: { message: questText("notice.accepted", { name: definition.name }) }, icon: "任", tone: "gold", dedupeKey: `quest-dialogue-accepted:${definition.id}` });
    setResult("accepted");
  }

  function decline() {
    feedback.toast({ titleKey: "system.dynamicMessage", params: { message: questText("notice.declined", { name: definition.name }) }, icon: "言", dedupeKey: `quest-dialogue-declined:${definition.id}` });
    setResult("declined");
  }

  return <div className="quest-offer-backdrop" onMouseDown={onClose}><section className={`quest-offer-dialogue ${result ? `result-${result}` : ""}`} role="dialog" aria-modal="true" aria-label={definition.name} onMouseDown={(event) => event.stopPropagation()}>
    <div className="quest-offer-portrait"><img src={giver.portrait} alt={`${giver.name}人物立绘`}/><i/><span>任</span></div>
    <div className="quest-offer-copy"><small>{result === "accepted" ? questText("offerAccepted") : result === "declined" ? questText("offerDeclined") : questText("offerEyebrow")}</small><h3>{giver.name}<em>{giver.role}</em></h3><h2>{definition.name}</h2><blockquote>{result === "accepted" ? giver.acceptedText : result === "declined" ? giver.declinedText : giver.offerText}</blockquote>
      {!result && <><div className="quest-offer-objective"><span>{questText("currentObjective")}</span><strong>{definition.objectives[0]?.description}</strong><em>{questText("offerPrompt")}</em></div><div className="quest-offer-rewards"><span>{questText("rewards")}</span>{definition.rewards.map((reward, index) => <b key={`${reward.type}-${reward.label}-${index}`}>{reward.label} ×{reward.amount}</b>)}</div></>}
      {!result ? <div className="quest-offer-actions"><button type="button" className="quest-primary" onClick={accept}>{giver.acceptLabel}</button><button type="button" onClick={decline}>{giver.declineLabel}</button></div> : <button type="button" className="quest-primary quest-offer-continue" onClick={onClose}>{questText("offerContinue")}</button>}
    </div>
  </section></div>;
}

export default function QuestPanel({ onClose, onNavigate }: { onClose: () => void; onNavigate: QuestNavigate }) {
  const { state, setQuests, setRomance, applyEffects } = useUnifiedGame();
  const feedback = useFeedback();
  const initial = QUESTS.find((quest) => quest.id === state.quests.trackedQuestId) ?? QUESTS[0];
  const [tab, setTab] = useState<QuestType>(initial?.type ?? "main");
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [receipt, setReceipt] = useState<QuestDefinition | null>(null);
  const allVisible = useMemo(() => QUESTS.filter((quest) => isQuestVisible(quest, state.quests)).map((definition) => questView(definition, state.quests, state)), [state]);
  const visible = useMemo(() => QUESTS.filter((quest) => quest.type === tab && isQuestVisible(quest, state.quests)).map((definition) => questView(definition, state.quests, state)).sort((a, b) => questSortRank[a.status] - questSortRank[b.status] || a.definition.order - b.definition.order), [state, tab]);
  const selectedDefinition = QUESTS.find((quest) => quest.id === selectedId && quest.type === tab) ?? visible[0]?.definition;
  const selected = selectedDefinition ? questView(selectedDefinition, state.quests, state) : null;
  const activeCount = allVisible.filter((view) => view.status === "in_progress").length;
  const claimableCount = allVisible.filter((view) => view.status === "claimable" || view.status === "completed").length;
  const typeCount = (type: QuestType) => allVisible.filter((view) => view.definition.type === type).length;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

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
        if (next) return { statuses, trackedQuestId: next.id };
      }
      const fallback = QUESTS.filter((quest) => quest.type === "main").sort((a, b) => a.order - b.order).find((quest) => statuses[quest.id] === "in_progress" || statuses[quest.id] === "claimable");
      return { statuses, trackedQuestId: current.trackedQuestId === definition.id ? fallback?.id ?? null : current.trackedQuestId };
    });
    setReceipt(definition);
    notify("notice.claimed", definition.name);
  }

  function act(definition: QuestDefinition, status: QuestStatus) {
    if (status === "unaccepted" && definition.giver) { onClose(); onNavigate(definition, "giver"); }
    else if (status === "unaccepted") accept(definition);
    else if (status === "claimable" || status === "completed") claim(definition);
    else if (status === "in_progress") { onClose(); onNavigate(definition); }
  }

  return <div className="quest-panel-backdrop" onMouseDown={onClose}><section className="quest-panel quest-journal-v2" role="dialog" aria-modal="true" aria-label={questText("panelTitle")} onMouseDown={(event) => event.stopPropagation()}>
    <header className="quest-panel-heading"><span className="quest-journal-seal" aria-hidden="true">任</span><div><small>{questText("panelEyebrow")}</small><h2>{questText("panelTitle")}</h2><p>{questText("panelSubtitle")}</p></div><aside><span>{questText("activeCount", { count: activeCount })}</span><span className={claimableCount ? "has-reward" : ""}>{questText("claimableCount", { count: claimableCount })}</span></aside><button type="button" onClick={onClose} aria-label={questText("close")}>×</button></header>
    <nav className="quest-tabs" aria-label={questText("panelTitle")}><button type="button" className={tab === "main" ? "active" : ""} aria-pressed={tab === "main"} onClick={() => setTab("main")}><i>主</i><span>{questText("mainTab")}<small>{typeCount("main")}</small></span></button><button type="button" className={tab === "side" ? "active" : ""} aria-pressed={tab === "side"} onClick={() => setTab("side")}><i>支</i><span>{questText("sideTab")}<small>{typeCount("side")}</small></span></button></nav>
    <div className="quest-workspace">
      <aside className="quest-list">{visible.map((view, index) => { const objective = view.objectives[0]; const progress = objective ? Math.min(100, objective.required > 0 ? objective.current / objective.required * 100 : 100) : 100; return <button type="button" key={view.definition.id} className={`${selected?.definition.id === view.definition.id ? "selected" : ""} status-${view.status}`} aria-current={selected?.definition.id === view.definition.id ? "true" : undefined} onClick={() => setSelectedId(view.definition.id)} style={{ "--list-progress": `${progress}%` } as CSSProperties}><i>{String(index + 1).padStart(2, "0")}</i><span><small>{questText("questNumber", { number: String(index + 1).padStart(2, "0") })}</small><strong>{view.definition.name}</strong><em>{objective ? objective.description : questText("doneProgress")}</em><u aria-hidden="true"><b/></u></span><aside><em>{questText(`status.${view.status}`)}</em>{view.tracked && <b>{questText("trackedShort")}</b>}</aside></button>})}{visible.length === 0 && <p>{questText("emptyList")}</p>}</aside>
      {selected && <main className={`quest-detail status-${selected.status}`}><div className="quest-detail-hero"><span className="quest-detail-seal" aria-hidden="true">{selected.definition.type === "main" ? "主" : "支"}</span><div className="quest-detail-title"><span>{questText(`type.${selected.definition.type}`)} · {selected.tracked ? questText("tracked") : questText(`status.${selected.status}`)}</span><h3>{selected.definition.name}</h3><em>{questText(`status.${selected.status}`)}</em></div>{selected.definition.giver && <div className="quest-giver-row"><img src={selected.definition.giver.portrait} alt=""/><span><small>{questText("questGiver")}</small><strong>{selected.definition.giver.name}</strong><em>{selected.definition.giver.role}</em></span></div>}</div><section className="quest-background"><h4>{questText("background")}</h4><p>{selected.definition.summary}</p></section><section><h4>{questText("objectives")}</h4><div className="quest-objectives">{selected.objectives.map((objective) => { const progress = Math.min(100, objective.required > 0 ? objective.current / objective.required * 100 : 100); return <div className={objective.done ? "done" : ""} key={objective.id} style={{ "--objective-progress": `${progress}%` } as CSSProperties}><i>{objective.done ? "✓" : "◇"}</i><span><strong>{objective.description}</strong><small>{questText("progressLabel")} · {questText("progress", { current: objective.current, required: objective.required })}</small><u aria-hidden="true"><b/></u></span><em>{objective.done ? questText("doneProgress") : ""}</em></div>})}</div></section><section><h4>{questText("rewards")}</h4><div className="quest-rewards">{selected.definition.rewards.map((reward, index) => <span key={`${reward.type}-${reward.label}-${index}`}><i>{reward.type === "currency" ? "石" : reward.type === "experience" ? "修" : reward.type === "relationship" ? "缘" : "物"}</i><b>{reward.label}</b><em>×{reward.amount}</em></span>)}</div></section><footer>{selected.status !== "unaccepted" && selected.status !== "claimed" && !selected.tracked && <button type="button" className="quest-track" onClick={() => track(selected.definition)}>{questText("track")}</button>}<small>{selected.status === "unaccepted" ? questText("notAcceptedHint") : selected.definition.type === "main" ? questText("mainCannotAbandon") : questText("sideTrackHint")}</small><button type="button" className="quest-primary" disabled={selected.status === "claimed"} onClick={() => act(selected.definition, selected.status)}>{primaryLabel(selected.status, selected.definition)}</button></footer></main>}
    </div>
    {receipt && <div className="quest-reward-backdrop"><section className="quest-reward-modal" role="dialog" aria-modal="true"><img src={ART} alt=""/><span>成</span><small>{questText("rewardTitle")}</small><h3>{receipt.name}</h3><p>{questText("rewardObtained")}</p><div>{receipt.rewards.map((reward, index) => <b key={`${reward.type}-${index}`}>{reward.label} ×{reward.amount}</b>)}</div><button type="button" className="quest-primary" onClick={() => setReceipt(null)}>{questText("continue")}</button></section></div>}
  </section></div>;
}
