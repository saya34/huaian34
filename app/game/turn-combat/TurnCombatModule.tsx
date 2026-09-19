"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TURN_COMBAT_SYSTEM, TURN_COMBAT_UI, TURN_ENCOUNTERS, TURN_ENEMY_MAP, TURN_SKILL_MAP, turnEncounterById } from "./content";
import { createTurnBattle, fleeChance, resolveConsumableAction, resolveEnemyTurn, resolveFleeAction, resolveStealAction, resolveTurnAction, theftChance } from "./engine";
import { ActionCommandPanel, Battlefield, QiTimeline } from "./TurnCombatHud";
import type { CombatInventoryStack, PlayerTurnProfile, TheftLoot, TurnBattleState, TurnCombatResult } from "./types";

type Props = {
  encounterId?: string;
  player: PlayerTurnProfile;
  inventory: CombatInventoryStack[];
  onClose: () => void;
  onComplete: (result: TurnCombatResult) => void;
  onConsumeItem: (itemId: string) => void;
  onGainLoot: (loot: TheftLoot) => void;
};

export default function TurnCombatModule({ encounterId, player, inventory, onClose, onComplete, onConsumeItem, onGainLoot }: Props) {
  const [currentEncounterId, setCurrentEncounterId] = useState(encounterId ?? "");
  const encounter = currentEncounterId ? turnEncounterById(currentEncounterId) : null;
  const [screen, setScreen] = useState<"picker" | "briefing" | "battle">(encounterId ? "briefing" : "picker");
  const [battle, setBattle] = useState<TurnBattleState | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>();
  const [selectedSkillId, setSelectedSkillId] = useState(player.skillIds[0] ?? "basic-attack");
  const [locked, setLocked] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pillWheelOpen, setPillWheelOpen] = useState(false);
  const [selectedPillId, setSelectedPillId] = useState(inventory[0]?.itemId ?? "");
  const [lootReveal, setLootReveal] = useState<TheftLoot | null>(null);
  const completionRef = useRef(false);

  const activeUnit = battle?.combatants.find((unit) => unit.id === battle.activeId);
  const firstLivingEnemy = battle?.combatants.find((unit) => unit.team === "enemy" && !unit.defeated);
  const selectedEnemy = battle?.combatants.find((unit) => unit.id === selectedTargetId && unit.team === "enemy" && !unit.defeated);

  useEffect(() => {
    if (!selectedTargetId && firstLivingEnemy) setSelectedTargetId(firstLivingEnemy.id);
    if (selectedTargetId && battle?.combatants.find((unit) => unit.id === selectedTargetId)?.defeated && firstLivingEnemy) setSelectedTargetId(firstLivingEnemy.id);
  }, [battle, firstLivingEnemy, selectedTargetId]);

  useEffect(() => {
    if (!battle || battle.phase !== "active" || activeUnit?.team !== "enemy") return;
    setLocked(true);
    const timer = window.setTimeout(() => {
      setBattle((current) => current ? resolveEnemyTurn(current) : current);
      setLocked(false);
    }, reducedMotion ? 180 : TURN_COMBAT_SYSTEM.enemyThinkDelayMs);
    return () => window.clearTimeout(timer);
  }, [activeUnit?.id, activeUnit?.team, battle?.actionCount, battle?.phase, reducedMotion]);

  useEffect(() => {
    if (!battle?.lastEvents.length || reducedMotion) return;
    setLocked(true);
    const timer = window.setTimeout(() => setLocked(false), TURN_COMBAT_SYSTEM.impactDurationMs);
    return () => window.clearTimeout(timer);
  }, [battle?.actionCount, battle?.lastEvents.length, reducedMotion]);

  useEffect(() => {
    if (!lootReveal) return;
    const timer = window.setTimeout(() => setLootReveal(null), reducedMotion ? 500 : 1800);
    return () => window.clearTimeout(timer);
  }, [lootReveal, reducedMotion]);

  useEffect(() => {
    if (!inventory.some((item) => item.itemId === selectedPillId && item.amount > 0)) setSelectedPillId(inventory.find((item) => item.amount > 0)?.itemId ?? "");
  }, [inventory, selectedPillId]);

  const practiceEncounters = useMemo(() => TURN_ENCOUNTERS.filter((entry) => entry.kind === "practice"), []);

  function chooseEncounter(id: string) {
    setCurrentEncounterId(id);
    setScreen("briefing");
  }

  function startBattle() {
    if (!encounter) return;
    completionRef.current = false;
    setLocked(false);
    const next = createTurnBattle(encounter, player);
    setBattle(next);
    setSelectedTargetId(next.combatants.find((unit) => unit.team === "enemy")?.id);
    setSelectedSkillId(player.skillIds[0] ?? "basic-attack");
    setScreen("battle");
  }

  function confirmAction() {
    if (!battle || battle.phase !== "active" || battle.activeId !== "player" || locked) return;
    const skill = TURN_SKILL_MAP[selectedSkillId];
    if (!skill) return;
    setLocked(true);
    setBattle((current) => current ? resolveTurnAction(current, selectedSkillId, selectedTargetId) : current);
  }

  function finish() {
    if (!battle || !encounter || completionRef.current) return;
    completionRef.current = true;
    onComplete({ encounter, outcome: battle.phase === "victory" ? "victory" : battle.phase === "defeat" ? "defeat" : "retreated", actionCount: battle.actionCount });
  }

  function attemptFlee() {
    if (!battle || !encounter?.allowRetreat || locked) return;
    const result = resolveFleeAction(battle);
    setBattle(result.state);
  }

  function attemptSteal() {
    if (!battle || locked || !selectedEnemy) return;
    const result = resolveStealAction(battle, selectedEnemy.id);
    setBattle(result.state);
    if (result.success && result.loot) {
      onGainLoot(result.loot);
      setLootReveal(result.loot);
    }
  }

  function consumePill() {
    if (!battle || locked) return;
    const stack = inventory.find((item) => item.itemId === selectedPillId && item.amount > 0);
    if (!stack) return;
    const result = resolveConsumableAction(battle, stack.definition);
    if (!result.success) return;
    onConsumeItem(stack.itemId);
    setBattle(result.state);
    setPillWheelOpen(false);
  }

  if (screen === "picker") return <div className="turn-module-backdrop" role="presentation"><section className="turn-practice-picker" role="dialog" aria-modal="true" aria-label={TURN_COMBAT_UI.choosePractice}>
    <header><button type="button" onClick={onClose} aria-label="关闭">‹</button><div><small>{TURN_COMBAT_UI.systemSubtitle}</small><h2>{TURN_COMBAT_UI.practiceEntry}</h2><p>{TURN_COMBAT_UI.practiceHint}</p></div><i>演</i></header>
    <div className="practice-dummy-stage"><span className="large-wooden-dummy"><i/><b/><em/></span><div><small>听云居 · 试招无损</small><strong>{TURN_COMBAT_UI.choosePractice}</strong><p>从木人单桩开始，熟悉行动顺序；再挑战铁骨重桩和三才桩阵。</p></div></div>
    <div className="practice-choice-list">{practiceEncounters.map((entry, index) => <button type="button" key={entry.id} onClick={() => chooseEncounter(entry.id)}><i>{String(index + 1).padStart(2, "0")}</i><span><strong>{entry.name}</strong><small>{entry.subtitle}</small><p>{entry.objective}</p></span><b>›</b></button>)}</div>
  </section></div>;

  if (!encounter) return null;

  if (screen === "briefing") return <div className="turn-module-backdrop" role="presentation"><section className={`turn-briefing kind-${encounter.kind}`} role="dialog" aria-modal="true" aria-label={encounter.name} style={{ "--battle-bg": `url(${encounter.background})` } as React.CSSProperties}>
    {(encounter.kind === "practice" || encounter.allowRetreat) && <button type="button" className="turn-close" onClick={encounterId ? onClose : () => setScreen("picker")} aria-label="返回">‹</button>}
    <div className="briefing-mist"/>
    <header><small>{encounter.subtitle}</small><h2>{encounter.name}</h2><p>{encounter.kind === "story" ? TURN_COMBAT_UI.invasionAlertBody : encounter.briefing}</p></header>
    <div className="briefing-objective"><i>令</i><span><small>{TURN_COMBAT_UI.battleObjective}</small><strong>{encounter.objective}</strong><p>{encounter.briefing}</p></span></div>
    <div className="briefing-enemies">{encounter.enemyIds.map((id, index) => { const enemy = TURN_ENEMY_MAP[id]; return <span key={`${id}-${index}`}>{enemy?.art ? <img src={enemy.art} alt={`${enemy.name}立绘`}/> : <i>桩</i>}<b>{enemy?.name ?? "演武傀儡"}<small>{enemy?.title ?? "基础演武"}</small></b></span>; })}</div>
    <footer><button type="button" onClick={startBattle}><i>剑</i><span><b>{encounter.kind === "story" ? TURN_COMBAT_UI.invasionStart : "入阵试招"}</b><small>战前配置已锁定 · 已习功法 {player.skillIds.length} 门</small></span></button></footer>
  </section></div>;

  if (!battle) return null;
  const playerUnit = battle.combatants.find((unit) => unit.team === "player")!;
  const resultTitle = battle.phase === "victory"
    ? (encounter.kind === "practice" ? TURN_COMBAT_UI.practiceComplete : TURN_COMBAT_UI.victory)
    : battle.phase === "retreated" ? "收势离阵" : TURN_COMBAT_UI.defeat;
  const resultBody = battle.phase === "retreated"
    ? "你保住了此刻的气血与判断，也放弃了本轮尚未取得的战果。"
    : encounter.kind === "practice" ? TURN_COMBAT_UI.practiceBody : battle.phase === "victory" ? TURN_COMBAT_UI.victoryBody : TURN_COMBAT_UI.defeatBody;

  return <div className={`turn-module-backdrop ${reducedMotion ? "reduce-motion" : ""}`} role="presentation"><section className={`turn-combat-shell phase-${battle.phase}`} role="dialog" aria-modal="true" aria-label={encounter.name} style={{ "--battle-bg": `url(${encounter.background})` } as React.CSSProperties}>
    <header className="turn-combat-topbar">
      <button type="button" onClick={encounter.allowRetreat ? attemptFlee : undefined} disabled={!encounter.allowRetreat} aria-label={encounter.allowRetreat ? "尝试逃跑，会消耗一个回合" : "本场战斗不可逃跑"}>‹</button>
      <div><small>{encounter.subtitle}</small><strong>{encounter.name}</strong></div>
      <span><i>{TURN_COMBAT_UI.health}</i><b>{Math.round(playerUnit.health)}</b><em>/ {playerUnit.stats.health}</em></span>
      <span><i>{TURN_COMBAT_UI.mana}</i><b>{Math.round(playerUnit.mana)}</b><em>/ {playerUnit.stats.mana}</em></span>
      <button type="button" className="motion-toggle" onClick={() => setReducedMotion((value) => !value)}>{reducedMotion ? "动效简" : "动效满"}</button>
    </header>
    <QiTimeline state={battle}/>
    <main className="turn-combat-scene">
      <div className="scene-paper-grain"/><div className="scene-cloud cloud-a"/><div className="scene-cloud cloud-b"/>
      <Battlefield state={battle} selectedTargetId={selectedTargetId} onSelectTarget={setSelectedTargetId}/>
      <aside className="turn-battle-log">{battle.history.slice(0, 3).map((event) => <span key={event.id} className={`tone-${event.tone}`}>{event.text}</span>)}</aside>
    </main>
    <ActionCommandPanel state={battle} selectedSkillId={selectedSkillId} selectedTargetId={selectedTargetId} locked={locked} allowRetreat={encounter.allowRetreat} fleeProbability={fleeChance(battle)} stealProbability={theftChance(battle, selectedEnemy?.id)} theftUsed={selectedEnemy ? battle.theftAttemptedIds.includes(selectedEnemy.id) : true} onSelectSkill={setSelectedSkillId} onConfirm={confirmAction} onOpenPills={() => setPillWheelOpen(true)} onFlee={attemptFlee} onSteal={attemptSteal}/>
    {pillWheelOpen && <div className="pill-wheel-backdrop" onMouseDown={() => setPillWheelOpen(false)}><section className="pill-wheel" role="dialog" aria-modal="true" aria-label="战斗丹药轮盘" onMouseDown={(event) => event.stopPropagation()}><header><span><small>乾坤丹匣 · 每次服用占一回合</small><h3>滑动选择丹药</h3></span><button type="button" onClick={() => setPillWheelOpen(false)}>×</button></header><div className="pill-wheel-track">{inventory.map((stack) => <button type="button" key={stack.itemId} className={selectedPillId === stack.itemId ? "selected" : ""} disabled={stack.amount <= 0} onClick={() => setSelectedPillId(stack.itemId)}><span data-rarity={stack.rarity}><img src={stack.art} alt=""/><b>×{stack.amount}</b></span><small>{stack.definition.role === "health" ? "回命" : stack.definition.role === "mana" ? "回元" : "增益"}</small><strong>{stack.name}</strong></button>)}</div>{inventory.length ? (() => { const selected = inventory.find((item) => item.itemId === selectedPillId) ?? inventory[0]; return <div className="pill-wheel-detail"><span><small>{selected.quality ?? "丹药"}{selected.mutation ? ` · ${selected.mutation}` : ""}</small><strong>{selected.definition.label}</strong><p>{selected.definition.summary}</p></span><button type="button" disabled={!selected.amount || battle.activeId !== "player" || locked} onClick={consumePill}>服用 · 占用此回合</button></div>; })() : <p className="pill-wheel-empty">丹匣中没有可在战斗中服用的丹药。</p>}</section></div>}
    {lootReveal && <div className={`turn-loot-reveal rarity-${lootReveal.rarity}`}><i>{lootReveal.kind === "currency" ? "石" : lootReveal.kind === "manual" ? "诀" : "宝"}</i><span><small>妙手所得</small><strong>{lootReveal.name}{lootReveal.amount > 1 ? ` ×${lootReveal.amount}` : ""}</strong><p>{lootReveal.description}</p></span></div>}
    {battle.phase !== "active" && <div className={`turn-settlement outcome-${battle.phase}`}>
      <div className="settlement-rays"><i/><i/><i/></div><span className="settlement-seal">{battle.phase === "victory" ? "定" : battle.phase === "retreated" ? "退" : "败"}</span><small>{encounter.subtitle}</small><h2>{resultTitle}</h2><p>{resultBody}</p>
      <div className="settlement-summary"><span><small>行动</small><b>{battle.actionCount}式</b></span><span><small>剩余气血</small><b>{Math.max(0, Math.round(playerUnit.health))}</b></span>{battle.phase === "victory" && encounter.kind === "story" && <><span><small>修为</small><b>+{encounter.rewards.experience}</b></span><span><small>灵石</small><b>+{encounter.rewards.spiritStones}</b></span></>}</div>
      <button type="button" onClick={battle.phase === "defeat" ? startBattle : finish}>{battle.phase === "defeat" ? TURN_COMBAT_UI.retry : TURN_COMBAT_UI.continue}</button>
      {battle.phase === "defeat" && <button type="button" className="turn-settlement-exit" onClick={finish}>{encounter.kind === "practice" ? "返回听云居" : "暂退内院"}</button>}
    </div>}
  </section></div>;
}

export function TurnCombatPracticeEntry({ onOpen }: { onOpen: () => void }) {
  return <button type="button" className="turn-practice-entry" onClick={onOpen}>
    <span className="entry-dummy"><i/><b/><em/></span><span><small>{TURN_COMBAT_UI.systemSubtitle}</small><strong>{TURN_COMBAT_UI.practiceEntry}</strong><p>{TURN_COMBAT_UI.practiceHint}</p></span><i className="entry-arrow">›</i>
  </button>;
}
