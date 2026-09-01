"use client";

import { useState } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import type { Period } from "../types";
import { farmLevel } from "./farm";
import { SPIRIT_BEASTS, beastLevelProgress, buySpiritBeast, collectSpiritBeast, feedMaterialFor, feedSpiritBeast, livestockCapacity, loveSpiritBeast, sellSpiritBeast, spiritBeastById, type SpiritBeastId } from "./livestock";

type Props = { day: number; period: Period; onBack: () => void; onNotice: (message: string) => void };

export default function LivestockPanel({ day, period, onBack, onNotice }: Props) {
  const { state, setFarm, applyEffects } = useUnifiedGame();
  const [selectedUid, setSelectedUid] = useState(state.farm.livestock.animals[0]?.uid ?? "");
  const [marketOpen, setMarketOpen] = useState(false);
  const [message, setMessage] = useState("灵兽按游戏日生长：今日喂养并抚灵，明日即可收取更丰厚的产物。");
  const level = farmLevel(state.farm.experience);
  const livestock = state.farm.livestock;
  const selected = livestock.animals.find((animal) => animal.uid === selectedUid) ?? livestock.animals[0];

  function announce(copy: string) { setMessage(copy); onNotice(copy); }

  function buy(speciesId: SpiritBeastId) {
    const definition = spiritBeastById(speciesId)!;
    if (state.shared.spiritStones < definition.price) { announce(`灵石不足，迎入${definition.name}需要 ${definition.price} 枚。`); return; }
    const result = buySpiritBeast(livestock, speciesId, day, level);
    if (!result.ok) { announce(result.message); return; }
    setFarm((current) => ({ ...current, livestock: result.progress }));
    applyEffects([{ type: "add_currency", amount: -definition.price }]);
    setSelectedUid(result.progress.animals.at(-1)?.uid ?? ""); announce(`${result.message} · 灵石 -${definition.price}`);
  }

  function feed(uid: string) {
    const animal = livestock.animals.find((entry) => entry.uid === uid); if (!animal) return;
    const material = feedMaterialFor(animal.speciesId);
    const amount = state.shared.items[material.id]?.amount ?? 0;
    if (amount < 1) { announce(`缺少${material.name}，请先在灵田种植并收获。`); return; }
    const result = feedSpiritBeast(livestock, uid, day);
    if (!result.ok) { announce(result.message); return; }
    setFarm((current) => ({ ...current, livestock: result.progress }));
    applyEffects([{ type: "remove_item", itemId: material.id, amount: 1 }]); announce(`${result.message} · ${material.name} -1`);
  }

  function love(uid: string) { const result = loveSpiritBeast(livestock, uid, day); if (!result.ok) { announce(result.message); return; } setFarm((current) => ({ ...current, livestock: result.progress })); announce(result.message); }
  function collect(uid: string) { const result = collectSpiritBeast(livestock, uid, day); if (!result.ok) { announce(result.message); return; } setFarm((current) => ({ ...current, livestock: result.progress })); applyEffects([{ type: "add_item", item: result.reward }, { type: "add_player_exp", amount: result.reward.rarity * 2 }]); announce(`${result.message} · 已收入乾坤行囊`); }
  function sell(uid: string) { const result = sellSpiritBeast(livestock, uid); if (!result.ok) return; const definition = spiritBeastById(livestock.animals.find((entry) => entry.uid === uid)?.speciesId ?? "")!; if (!window.confirm(`确认将${definition.name}托付给仙庄，换取 ${result.gain} 灵石？`)) return; setFarm((current) => ({ ...current, livestock: result.progress })); applyEffects([{ type: "add_currency", amount: result.gain }]); setSelectedUid(result.progress.animals[0]?.uid ?? ""); announce(`${result.message} · 获得 ${result.gain} 灵石`); }

  return <section className="spirit-farm-panel livestock-panel" aria-label="云岫灵兽苑">
    <header className="farm-status-bar livestock-status-bar">
      <div><small>SPIRIT HUSBANDRY · 云岫灵圃</small><h3>灵田 · 灵兽苑</h3></div>
      <nav className="farm-scene-tabs"><button type="button" onClick={onBack}>灵田十二畦</button><button type="button" className="active">灵兽苑</button></nav>
      <div className="livestock-capacity"><small>栏舍容量</small><strong>{livestock.animals.length}<i> / {livestockCapacity(level)}</i></strong><span>灵圃 {level} 阶</span></div>
    </header>

    <div className="livestock-workspace">
      <aside className="livestock-list">
        <header><span>苑中灵兽</span><button type="button" onClick={() => setMarketOpen((value) => !value)}>{marketOpen ? "收起" : "迎灵"}</button></header>
        {marketOpen && <div className="livestock-market">{SPIRIT_BEASTS.map((beast) => <article key={beast.id} className={level < beast.unlockLevel ? "locked" : ""}><span className="beast-market-icon">{beast.icon}</span><div><strong>{beast.name}</strong><small>{beast.role} · {beast.unlockLevel}阶</small></div><button type="button" disabled={level < beast.unlockLevel} onClick={() => buy(beast.id)}>◉ {beast.price}</button></article>)}</div>}
        <div className="livestock-roster">{livestock.animals.map((animal, index) => { const beast = spiritBeastById(animal.speciesId)!; const profile = beastLevelProgress(animal.experience); const ready = animal.readyDay > 0 && animal.readyDay <= day; return <button type="button" key={animal.uid} className={`${selected?.uid === animal.uid ? "active" : ""} ${ready ? "ready" : ""}`} onClick={() => setSelectedUid(animal.uid)}><span>{beast.icon}</span><div><strong>{beast.name} · {index + 1}</strong><small>{ready ? "产物已凝成" : animal.lastFedDay === day ? animal.mood === "happy" ? "亲和吐纳中" : "饱食吐纳中" : "等待喂养"}</small><i><u style={{ width: `${profile.percent}%` }} /></i></div><b>Lv.{profile.level}</b></button>; })}{!livestock.animals.length && <div className="livestock-empty"><b>苑</b><p>栏舍尚空。点击“迎灵”，选择第一只灵兽入住。</p></div>}</div>
      </aside>

      <main className="livestock-yard">{selected ? (() => { const beast = spiritBeastById(selected.speciesId)!; const productReady = selected.readyDay > 0 && selected.readyDay <= day; return <>
        <div className={`livestock-beast-portrait mood-${selected.mood}`}><div className="beast-aura" /><span>{beast.icon}</span><i>{selected.mood === "happy" ? "♥" : selected.mood === "fed" ? "灵" : "息"}</i></div>
        <small>{beast.role} · {selected.mood === "happy" ? "心情欣悦" : selected.mood === "fed" ? "已经饱食" : "神态安宁"}</small><h2>{beast.name}</h2><p>喜食「{beast.feedMaterialName}」，翌日凝成「{beast.productName}」。等级越高产量越多，喂养后抚灵还会额外增产。</p>
        <div className="livestock-cycle"><span><b>{selected.lastFedDay === day ? "已完成" : "待完成"}</b><small>今日喂养</small></span><i>›</i><span><b>{selected.lastLovedDay === day ? "已亲近" : "可抚灵"}</b><small>亲和照料</small></span><i>›</i><span className={productReady ? "ready" : ""}><b>{productReady ? "可收取" : selected.readyDay ? `第${selected.readyDay}日` : "未开始"}</b><small>灵物凝成</small></span></div>
        <div className="livestock-actions"><button type="button" disabled={selected.lastFedDay === day || productReady} onClick={() => feed(selected.uid)}><b>饲</b><span><strong>投喂{beast.feedMaterialName}</strong><small>持有 {state.shared.items[feedMaterialFor(selected.speciesId).id]?.amount ?? 0}</small></span></button><button type="button" disabled={selected.lastFedDay !== day || selected.lastLovedDay === day} onClick={() => love(selected.uid)}><b>抚</b><span><strong>抚灵亲近</strong><small>提升经验与翌日产量</small></span></button><button type="button" className={productReady ? "ready" : ""} disabled={!productReady} onClick={() => collect(selected.uid)}><b>取</b><span><strong>收取{beast.productName}</strong><small>收入统一乾坤行囊</small></span></button></div>
      </>; })() : <div className="livestock-yard-empty"><span>苑</span><h3>灵兽苑静候有缘</h3><p>迎入灵兽后，可在此喂养、抚灵并收取每日产物。</p></div>}</main>

      <aside className="livestock-detail">{selected ? (() => { const beast = spiritBeastById(selected.speciesId)!; const profile = beastLevelProgress(selected.experience); return <><header><span>灵兽名牒</span><small>第 {day} 日 · {period}</small></header><div className="livestock-product"><img src={beast.productArt} alt=""/><span><small>每日产物</small><strong>{beast.productName}</strong><em>估值 ◉ {beast.productValue}</em></span></div><section><span>灵兽等级</span><strong>Lv.{profile.level}</strong><i><u style={{ width: `${profile.percent}%` }} /></i><small>{profile.current}/{profile.needed} 成长经验</small></section><section><span>饲料需求</span><strong>{beast.feedMaterialName}</strong><small>由同场景灵田种植获得</small></section><section><span>累计收取</span><strong>{livestock.totalCollected}</strong><small>所有灵兽总产物</small></section><button type="button" className="sell-spirit-beast" onClick={() => sell(selected.uid)}>托付仙庄</button></>; })() : <div className="livestock-tip"><b>饲</b><p>栏舍容量随灵圃等级增加，最多可同时照料八只灵兽。</p></div>}</aside>
    </div>
    <footer className="farm-message"><span>兽</span><p>{message}</p><b>以游戏日为周期 · 离线不使用现实时间</b></footer>
  </section>;
}
