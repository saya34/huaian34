"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { TURN_COMBAT_UI, TURN_SKILL_MAP, TURN_STATUS_MAP } from "./content";
import { actionPreview, timelineForecast } from "./engine";
import { TurnSkillEffectLayer } from "./TurnSkillEffects";
import type { CombatantState, TurnBattleState } from "./types";

const percent = (value: number, max: number) => `${Math.max(0, Math.min(100, max > 0 ? value / max * 100 : 0))}%`;

function UnitFigure({ unit, active, selected, lastEvents, onSelect }: {
  unit: CombatantState;
  active: boolean;
  selected: boolean;
  lastEvents: TurnBattleState["lastEvents"];
  onSelect?: () => void;
}) {
  const hit = lastEvents.some((event) => event.targetId === unit.id && event.type === "attack");
  const healed = lastEvents.some((event) => event.targetId === unit.id && event.type === "heal");
  const broken = unit.statuses.some((status) => status.id === "broken");
  const fortified = unit.statuses.some((status) => status.id === "fortified");
  const [artFailed, setArtFailed] = useState(false);
  const numbers = lastEvents.filter((event) => event.targetId === unit.id && (event.amount || event.posture));
  return <button
    type="button"
    className={`turn-unit team-${unit.team} ${active ? "is-active" : ""} ${selected ? "is-selected" : ""} ${hit ? "is-hit" : ""} ${healed ? "is-healed" : ""} ${broken ? "is-broken" : ""} ${unit.defeated ? "is-defeated" : ""}`}
    onClick={onSelect}
    disabled={!onSelect || unit.defeated}
    aria-label={`${unit.name}，气血${Math.round(unit.health)}，架势${Math.round(unit.posture)}`}
  >
    <span className="turn-unit-title"><small>{unit.title}</small><strong>{unit.name}</strong></span>
    <span className="turn-unit-vitals">
      <i className="health" style={{ "--fill": percent(unit.health, unit.stats.health) } as CSSProperties}><b/></i>
      <i className="posture" style={{ "--fill": percent(unit.posture, unit.stats.posture) } as CSSProperties}><b/></i>
    </span>
    <span className="turn-unit-art">
      {unit.art && !artFailed ? <img src={unit.art} alt="" draggable={false} onError={() => setArtFailed(true)}/> : <span className={unit.templateId.includes("dummy") ? "wooden-dummy" : "turn-art-fallback"} aria-hidden="true"><i/><b/><em/></span>}
      <i className="turn-unit-aura"/>
      {fortified && <span className="persistent-golden-dome" aria-label="护体金光生效中"><i/><b/></span>}
      {broken && <em className="broken-seal">破</em>}
      {hit && <span className="impact-brush"><i/><i/><i/></span>}
      {healed && <span className="healing-runes"><i/><i/><i/></span>}
      <span className="floating-values">{numbers.map((event) => <b key={event.id} className={event.type}>{event.amount ? `${event.type === "heal" ? "+" : "−"}${event.amount}` : `势−${event.posture}`}</b>)}</span>
    </span>
    <span className="turn-status-row">{unit.statuses.slice(0, 4).map((instance) => {
      const status = TURN_STATUS_MAP[instance.id];
      return <i key={instance.id} className={`tone-${status?.tone ?? "danger"}`} title={`${status?.name ?? instance.id}：${status?.description ?? ""}`}>{status?.icon ?? "印"}<small>{instance.remaining}</small></i>;
    })}</span>
    {unit.team === "enemy" && unit.intentSkillId && !unit.defeated && <span className={`enemy-intent ${TURN_SKILL_MAP[unit.intentSkillId]?.telegraph ? "danger" : ""}`}><i>{TURN_SKILL_MAP[unit.intentSkillId]?.telegraph ? "!" : "意"}</i><b>{TURN_SKILL_MAP[unit.intentSkillId]?.name}</b></span>}
  </button>;
}

export function QiTimeline({ state }: { state: TurnBattleState }) {
  const forecast = timelineForecast(state);
  return <div className="qi-timeline" aria-label="未来行动顺序">
    <span><small>{TURN_COMBAT_UI.timeline}</small><b>先</b></span>
    <ol>{forecast.map((entry, index) => <li key={`${entry.unit.id}-${index}`} className={`team-${entry.unit.team} ${index === 0 ? "current" : ""}`}>
      <i>{entry.unit.name.slice(0, 1)}</i><small>{index === 0 ? "此刻" : `+${Math.max(1, Math.round(entry.at - state.clock))}`}</small>
    </li>)}</ol>
  </div>;
}

export function Battlefield({ state, selectedTargetId, onSelectTarget }: {
  state: TurnBattleState;
  selectedTargetId?: string;
  onSelectTarget: (id: string) => void;
}) {
  const enemies = state.combatants.filter((unit) => unit.team === "enemy");
  const player = state.combatants.find((unit) => unit.team === "player")!;
  return <div className={`turn-battlefield phase-${state.phase}`}>
    <div className="turn-enemy-line">{enemies.map((unit) => <UnitFigure key={unit.id} unit={unit} active={state.activeId === unit.id} selected={selectedTargetId === unit.id} lastEvents={state.lastEvents} onSelect={() => onSelectTarget(unit.id)}/>)}</div>
    <div className="turn-field-focus" aria-hidden="true"><i/><i/><span>气机</span></div>
    <div className="turn-player-line"><UnitFigure unit={player} active={state.activeId === player.id} selected={false} lastEvents={state.lastEvents}/></div>
    <TurnSkillEffectLayer state={state}/>
  </div>;
}

type SkillGroup = "attack" | "defense" | "recovery";

export function ActionCommandPanel({ state, selectedSkillId, selectedTargetId, locked, allowRetreat, fleeProbability, stealProbability, theftUsed, onSelectSkill, onConfirm, onOpenPills, onFlee, onSteal }: {
  state: TurnBattleState;
  selectedSkillId: string;
  selectedTargetId?: string;
  locked: boolean;
  allowRetreat: boolean;
  fleeProbability: number;
  stealProbability: number;
  theftUsed: boolean;
  onSelectSkill: (id: string) => void;
  onConfirm: () => void;
  onOpenPills: () => void;
  onFlee: () => void;
  onSteal: () => void;
}) {
  const [activeSheet, setActiveSheet] = useState<"skills" | "tactics" | null>(null);
  const [skillGroup, setSkillGroup] = useState<SkillGroup>("attack");
  const player = state.combatants.find((unit) => unit.team === "player")!;
  const skill = TURN_SKILL_MAP[selectedSkillId] ?? TURN_SKILL_MAP["basic-attack"];
  const preview = actionPreview(state, skill.id, selectedTargetId);
  const isPlayerTurn = state.activeId === player.id && state.phase === "active";
  const groups = useMemo(() => ({
    attack: player.skillIds.filter((id) => ["attack", "debuff"].includes(TURN_SKILL_MAP[id]?.kind)),
    defense: player.skillIds.filter((id) => ["defense", "buff"].includes(TURN_SKILL_MAP[id]?.kind)),
    recovery: player.skillIds.filter((id) => TURN_SKILL_MAP[id]?.kind === "heal"),
  }), [player.skillIds]);
  const groupMeta: Array<{ id: SkillGroup; icon: string; label: string }> = [{ id: "attack", icon: "伐", label: "攻伐" }, { id: "defense", icon: "御", label: "护持" }, { id: "recovery", icon: "愈", label: "回元" }];
  const visibleSheet = isPlayerTurn ? activeSheet : null;
  const damageLabel = preview.damageMax > 0 ? `${preview.damageMin}—${preview.damageMax}` : preview.posture > 0 ? `破势 ${preview.posture}` : skill.kind === "heal" ? "回元疗伤" : "改变架势";
  const chooseBasic = (id: string) => {
    onSelectSkill(id);
    setActiveSheet(null);
  };
  const castSelected = () => {
    setActiveSheet(null);
    onConfirm();
  };

  return <section className={`turn-command-deck ${isPlayerTurn ? "ready" : "waiting"} ${visibleSheet ? "sheet-open" : ""}`}>
    <div className="turn-selected-command">
      <span className={`selected-command-art kind-${skill.kind}`}>{skill.art ? <img src={skill.art} alt=""/> : <i>{skill.shortName}</i>}</span>
      <div className="selected-command-copy">
        <small>{isPlayerTurn ? `${TURN_COMBAT_UI.currentAction} · ${preview.targetLabel}` : "静候气机流转"}</small>
        <strong>{skill.name}</strong>
        <span><b>{damageLabel}</b><i>命中 {Math.round(preview.hitChance * 100)}%</i><i>灵力 {preview.manaCost}</i></span>
      </div>
      <button type="button" className="turn-cast-button" onClick={castSelected} disabled={!isPlayerTurn || locked || !preview.affordable}>
        <i>{preview.affordable ? "诀" : "缺"}</i><b>{preview.affordable ? "施展" : "灵力不足"}</b>
      </button>
    </div>

    <nav className="turn-command-orbit" aria-label="战斗指令">
      <button type="button" className={selectedSkillId === "basic-attack" ? "selected" : ""} onClick={() => chooseBasic("basic-attack")} disabled={!isPlayerTurn || locked}><i>剑</i><b>试锋</b></button>
      <button type="button" className={selectedSkillId === "guard" ? "selected" : ""} onClick={() => chooseBasic("guard")} disabled={!isPlayerTurn || locked}><i>盾</i><b>守中</b></button>
      <button type="button" className={`command-core ${visibleSheet === "skills" ? "selected" : ""}`} aria-expanded={visibleSheet === "skills"} onClick={() => setActiveSheet((current) => current === "skills" ? null : "skills")} disabled={!isPlayerTurn || locked}><i>法</i><b>功法</b><small>{groups.attack.length + groups.defense.length + groups.recovery.length}门</small></button>
      <button type="button" className={selectedSkillId === "breathe" ? "selected" : ""} onClick={() => chooseBasic("breathe")} disabled={!isPlayerTurn || locked}><i>息</i><b>调息</b></button>
      <button type="button" className={visibleSheet === "tactics" ? "selected" : ""} aria-expanded={visibleSheet === "tactics"} onClick={() => setActiveSheet((current) => current === "tactics" ? null : "tactics")} disabled={!isPlayerTurn || locked}><i>策</i><b>战术</b></button>
    </nav>

    {visibleSheet === "skills" && <section className="turn-command-sheet turn-skill-sheet" aria-label="已习功法">
      <header><span><small>万法随心 · 当前仅展开一层</small><strong>选择功法</strong></span><button type="button" onClick={() => setActiveSheet(null)} aria-label="收起功法">×</button></header>
      <div className="turn-skill-tabs">{groupMeta.map((group) => <button type="button" key={group.id} className={skillGroup === group.id ? "selected" : ""} disabled={groups[group.id].length === 0} onClick={() => setSkillGroup(group.id)}><i>{group.icon}</i><span>{group.label}</span><small>{groups[group.id].length}</small></button>)}</div>
      <div className="turn-skill-carousel">{groups[skillGroup].map((id) => {
        const action = TURN_SKILL_MAP[id];
        if (!action) return null;
        const choicePreview = actionPreview(state, id, selectedTargetId);
        return <button type="button" key={id} className={`${selectedSkillId === id ? "selected" : ""} ${!choicePreview.affordable ? "unaffordable" : ""}`} onClick={() => onSelectSkill(id)}>
          <span>{action.art ? <img src={action.art} alt=""/> : <i>{action.shortName}</i>}<em>{action.kind === "attack" || action.kind === "debuff" ? "攻" : action.kind === "heal" ? "愈" : "御"}</em></span>
          <strong>{action.name}</strong><small>灵力 {choicePreview.manaCost}</small>
        </button>;
      })}</div>
      <div className="turn-sheet-selection">
        <span><small>{preview.notes.slice(0, 2).join(" · ") || preview.targetLabel}</small><strong>{skill.name}</strong><p>{skill.description}</p></span>
        <button type="button" onClick={castSelected} disabled={!preview.affordable || locked}><i>{preview.affordable ? "诀" : "缺"}</i><b>{preview.affordable ? `施展 · ${skill.name}` : TURN_COMBAT_UI.insufficientMana}</b><small>{damageLabel}</small></button>
      </div>
    </section>}

    {visibleSheet === "tactics" && <section className="turn-command-sheet turn-tactics-sheet" aria-label="战术选择">
      <header><span><small>非功法行动 · 每项占用一回合</small><strong>临阵权衡</strong></span><button type="button" onClick={() => setActiveSheet(null)} aria-label="收起战术">×</button></header>
      <div className="turn-tactic-cards">
        <button type="button" onClick={() => { setActiveSheet(null); onOpenPills(); }} disabled={locked}><i className="tactic-pill"><b/><em/></i><span><small>丹匣轮盘</small><strong>服用丹药</strong><p>回复气血、法力或取得增益</p></span><b>›</b></button>
        <button type="button" onClick={() => { setActiveSheet(null); onSteal(); }} disabled={locked || theftUsed || stealProbability <= 0}><i className="tactic-steal"><b/></i><span><small>{theftUsed ? "本敌已试" : `成功率 ${Math.round(stealProbability * 100)}%`}</small><strong>妙手探囊</strong><p>实力越高，所得珍宝越贵重</p></span><b>›</b></button>
        <button type="button" onClick={() => { setActiveSheet(null); onFlee(); }} disabled={locked || !allowRetreat}><i className="tactic-flee"><b/><em/></i><span><small>{allowRetreat ? `成功率 ${Math.round(fleeProbability * 100)}%` : "此阵不可退"}</small><strong>抽身遁走</strong><p>以速度判定，失败也会失去回合</p></span><b>›</b></button>
      </div>
    </section>}
  </section>;
}
