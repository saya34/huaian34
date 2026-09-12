"use client";

import { useEffect, useMemo, useState } from "react";
import copy from "./content/preparation.json";
import type { DungeonDefinition } from "../core/dungeons";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { ITEM_TABLE, type GameItem } from "../alchemy/item-data";
import { computePermanentAttributes } from "./meta";
import { equipmentById } from "./progression";

export type BattlePreparationPanelId = "profile" | "skills" | "equipment" | "cards";

export type BattlePreparationRecord = {
  waveId: number;
  dungeonId: string;
  dungeonName: string;
  supplyId: string | null;
  savedAt: number;
};

export type BattleReturnReceipt = {
  kind: "victory" | "extracted" | "defeat";
  waveId: number;
  dungeonName: string;
  accepted: number;
  experience: number;
  skillBooks: number;
  attributePoints: number;
  skillPoints: number;
  equippedCount: number;
  learnedCount: number;
  cardCount: number;
  supplyName?: string;
};

export const BATTLE_PREPARATION_STORAGE_KEY = "huaian:battle-preparation:v1";

export function readBattlePreparation(waveId: number): BattlePreparationRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(BATTLE_PREPARATION_STORAGE_KEY);
    const record = value ? JSON.parse(value) as BattlePreparationRecord : null;
    return record?.waveId === waveId ? record : null;
  } catch {
    return null;
  }
}

export function preparationSupplyBonus(rarity: number) {
  return { health: 70 + rarity * 35, damage: .02 + rarity * .012 };
}

function formatTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((result, [key, value]) => result.replace(`{${key}}`, String(value)), template);
}

function estimatePower(attributes: ReturnType<typeof computePermanentAttributes>) {
  return Math.round(attributes.health * .08 + attributes.defense * .45 + attributes.damage * 420 + attributes.weaponMaxDamage * 1.7 + attributes.hitChance * 90 + attributes.dodge * 300);
}

function regionMechanics(dungeon: DungeonDefinition) {
  const region = copy.regionMechanics[dungeon.regionId] ?? copy.regionMechanics.yunzhou;
  const tier = Math.min(2, Math.floor((dungeon.waveId - 1) / 7));
  return [region[(dungeon.waveId - 1) % region.length], copy.difficultyMechanics[tier]];
}

type Props = {
  dungeon: DungeonDefinition;
  mapImage: string;
  rewards: GameItem[];
  heroName?: string;
  maxWave?: number;
  onChangeWave?: (waveId: number) => void;
  onOpenPanel: (panel: BattlePreparationPanelId) => void;
  onStart: () => void;
  onClose?: () => void;
  onHelp?: () => void;
};

export function BattlePreparation({ dungeon, mapImage, rewards, heroName = copy.defaultHeroName, maxWave, onChangeWave, onOpenPanel, onStart, onClose, onHelp }: Props) {
  const { state } = useUnifiedGame();
  const [selectedSupplyId, setSelectedSupplyId] = useState<string | null>(null);
  const attributes = useMemo(() => computePermanentAttributes(state.battle), [state.battle]);
  const power = estimatePower(attributes);
  const equipped = Object.values(state.battle.equipped).filter(Boolean).flatMap((uid) => {
    const item = state.battle.equipmentBag.find((entry) => entry.uid === uid);
    return item ? [{ item, definition: equipmentById(item.equipmentId) }] : [];
  });
  const pills = Object.values(state.shared.items).filter((item) => item.itemType === "pill" && item.amount > 0).flatMap((stack) => {
    const definition = ITEM_TABLE.find((item) => item.id === stack.itemId);
    return definition ? [{ stack, definition }] : [];
  }).slice(0, 6);

  useEffect(() => {
    setSelectedSupplyId(readBattlePreparation(dungeon.waveId)?.supplyId ?? null);
  }, [dungeon.waveId]);

  const saveAndStart = () => {
    window.sessionStorage.setItem(BATTLE_PREPARATION_STORAGE_KEY, JSON.stringify({ waveId: dungeon.waveId, dungeonId: dungeon.id, dungeonName: dungeon.name, supplyId: selectedSupplyId, savedAt: Date.now() } satisfies BattlePreparationRecord));
    onStart();
  };

  return <div className="battle-preparation">
    <header className="battle-preparation-hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(5,19,16,.98),rgba(7,24,19,.58),rgba(5,17,14,.92)),url(${mapImage})` }}>
      <div><small>{copy.eyebrow}</small><h2>{dungeon.name}</h2><p>{copy.title}</p></div>
      <span className={power >= dungeon.recommendedPower ? "ready" : "warning"}><small>{copy.powerLabel}</small><strong>{power}</strong><em>{power >= dungeon.recommendedPower ? copy.ready : copy.underpowered}</em></span>
      {onClose && <button type="button" className="battle-preparation-close" onClick={onClose} aria-label={copy.closeLabel}>×</button>}
    </header>

    <div className="battle-preparation-body">
      <section className="battle-mission-card">
        <div className="battle-mission-heading"><span>{String(dungeon.waveId).padStart(2, "0")}</span><div><small>{copy.objectiveLabel}</small><h3>{dungeon.kind === "random" ? copy.randomObjective : formatTemplate(copy.permanentObjective, { name: dungeon.name })}</h3><p>{heroName} · {dungeon.kind === "random" ? copy.randomKind : copy.permanentKind}</p></div></div>
        <div className="battle-intel-grid">
          <article><small>{copy.mechanismLabel}</small>{regionMechanics(dungeon).map((line) => <p key={line}>{line}</p>)}</article>
          <article><small>{copy.timelineLabel}</small><strong>{copy.timelineValue}</strong><small>{copy.lossLabel}</small><strong>{copy.lossValue}</strong></article>
          <article><small>{copy.costLabel}</small><strong>{copy.costValue}</strong><small>{copy.recommendedLabel}</small><strong>{dungeon.recommendedPower}</strong></article>
        </div>
        {onChangeWave && maxWave && <nav className="battle-stage-switch"><button type="button" onClick={() => onChangeWave(dungeon.waveId <= 1 ? maxWave : dungeon.waveId - 1)}>‹ {copy.stagePrevious}</button><b>{dungeon.waveId} / 21</b><button type="button" onClick={() => onChangeWave(dungeon.waveId >= maxWave ? 1 : dungeon.waveId + 1)}>{copy.stageNext} ›</button></nav>}
      </section>

      <section className="battle-loadout-card">
        <header><div><small>{copy.loadoutLabel}</small><h3>{formatTemplate(copy.loadoutSummary, { power, health: Math.round(attributes.health), damage: Math.round(attributes.damage * 100) })}</h3></div><b>{copy.loadoutLocked}</b></header>
        <div className="battle-prep-actions">{copy.prepActions.map((action) => {
          const value = action.id === "profile" ? formatTemplate(copy.levelCount, { count: state.battle.playerLevel }) : action.id === "skills" ? formatTemplate(copy.skillCount, { count: Object.values(state.battle.skillMastery).filter((skill) => skill.learned).length }) : action.id === "equipment" ? formatTemplate(copy.equipmentCount, { count: equipped.length }) : formatTemplate(copy.cardCount, { count: state.shared.cards.length });
          return <button type="button" key={action.id} onClick={() => onOpenPanel(action.id as BattlePreparationPanelId)}><i>{action.mark}</i><span><strong>{action.label}</strong><small>{action.hint}</small></span><b>{value}</b></button>;
        })}</div>
        <div className="battle-equipped-ribbon">{equipped.map(({ item, definition }) => <span key={item.uid} title={item.name ?? definition.name}><img src={definition.art} alt="" /><small>{item.name ?? definition.name}</small></span>)}{equipped.length === 0 && <p>{copy.equipmentEmpty}</p>}</div>
      </section>

      <section className="battle-supply-card">
        <header><div><small>{copy.supplyLabel}</small><h3>{copy.supplyHint}</h3></div><button type="button" className={!selectedSupplyId ? "selected" : ""} onClick={() => setSelectedSupplyId(null)}>{copy.supplyNone}</button></header>
        {pills.length ? <div className="battle-supply-list">{pills.map(({ stack, definition }) => {
          const bonus = preparationSupplyBonus(stack.rarity);
          return <button type="button" key={stack.itemId} className={selectedSupplyId === stack.itemId ? "selected" : ""} onClick={() => setSelectedSupplyId(stack.itemId)}><img src={definition.image} alt="" /><span><strong>{definition.name}</strong><small>{formatTemplate(copy.supplyEffect, { health: bonus.health, damage: Math.round(bonus.damage * 100) })}</small></span><b>{formatTemplate(copy.supplyAmount, { count: stack.amount })}</b></button>;
        })}</div> : <p className="battle-supply-empty">{copy.supplyEmpty}</p>}
      </section>

      <section className="battle-drop-card"><header><div><small>{copy.dropLabel}</small><h3>{copy.dropHint}</h3></div></header><div>{rewards.map((item) => <article key={item.id}><img src={item.image} alt="" /><span><strong>{item.name}</strong><small>{item.category} · {item.quality}</small></span></article>)}</div></section>
    </div>

    <footer className="battle-preparation-footer">{onHelp && <button type="button" className="battle-help-action" onClick={onHelp}>{copy.helpAction}</button>}<button type="button" className="battle-start-action" onClick={saveAndStart}><span>{copy.startKicker}</span><strong>{copy.startAction}</strong></button></footer>
  </div>;
}

export function BattleReturnPanel({ receipt, onOpenTasks, onOpenPanel, onClose }: { receipt: BattleReturnReceipt; onOpenTasks: () => void; onOpenPanel: (panel: "profile" | "skills") => void; onClose: () => void }) {
  return <div className="battle-return-backdrop" role="presentation"><section className={`battle-return-panel ${receipt.kind}`} role="dialog" aria-modal="true" aria-label={copy.returnTitles[receipt.kind]}>
    <span className="battle-return-seal">{receipt.kind === "victory" ? "胜" : receipt.kind === "extracted" ? "归" : "整"}</span><small>{copy.returnEyebrow}</small><h2>{copy.returnTitles[receipt.kind]}</h2>
    <div className="battle-return-summary"><article><small>{copy.returnObjective}</small><strong>{receipt.dungeonName}</strong></article><article><small>{copy.returnLoot}</small><strong>{receipt.accepted}</strong></article><article><small>{copy.returnExperience}</small><strong>+{receipt.experience}</strong></article><article><small>{copy.returnBooks}</small><strong>+{receipt.skillBooks}</strong></article></div>
    <div className="battle-return-loadout"><small>{copy.returnLoadout}</small><span>{formatTemplate(copy.returnEquipmentCount, { count: receipt.equippedCount })}</span><span>{formatTemplate(copy.returnSkillCount, { count: receipt.learnedCount })}</span><span>{formatTemplate(copy.returnCardCount, { count: receipt.cardCount })}</span>{receipt.supplyName && <span>{formatTemplate(copy.returnSupplyName, { name: receipt.supplyName })}</span>}</div>
    {(receipt.attributePoints > 0 || receipt.skillPoints > 0) && <div className="battle-return-upgrades"><small>{copy.returnUpgrades}</small>{receipt.attributePoints > 0 && <button type="button" onClick={() => onOpenPanel("profile")}>{formatTemplate(copy.returnAttributeCount, { count: receipt.attributePoints, action: copy.returnCultivateAction })}</button>}{receipt.skillPoints > 0 && <button type="button" onClick={() => onOpenPanel("skills")}>{formatTemplate(copy.returnSkillPointCount, { count: receipt.skillPoints, action: copy.returnSkillsAction })}</button>}</div>}
    <footer><button type="button" onClick={onOpenTasks}>{copy.returnTaskAction}</button><button type="button" className="primary" onClick={onClose}>{copy.returnCloseAction}</button></footer>
  </section></div>;
}
