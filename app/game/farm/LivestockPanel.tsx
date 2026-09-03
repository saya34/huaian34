"use client";

import { useState } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import type { Period } from "../types";
import { farmLevel, gameTick } from "./farm";
import { beastLevelProgress, collectSpiritBeast, feedMaterialFor, feedSpiritBeast, livestockCapacity, loveSpiritBeast, sellSpiritBeast, spiritBeastById, syncLivestock, type SpiritBeastId } from "./livestock";

type Props = { day: number; period: Period; onBack: () => void; onClose?: () => void; onNotice: (message: string) => void };

export const BEAST_SPRITES: Record<SpiritBeastId, { src: string; layout: "vertical" | "horizontal" }> = {
  "moonfeather-hen": { src: "/blcx-assets/atlas/不导出/风灵鸟.png", layout: "vertical" },
  "cloudwool-sheep": { src: "/blcx-assets/atlas/不导出/羊羊.png", layout: "vertical" },
  "jade-antler-deer": { src: "/blcx-assets/atlas/不导出/野猪.png", layout: "vertical" },
  "jade-frog": { src: "/blcx-assets/atlas/不导出/小青蛙-待机.png", layout: "vertical" },
  "spirit-moth": { src: "/blcx-assets/atlas/不导出/粉蛾.png", layout: "vertical" },
  "cloud-hairball": { src: "/blcx-assets/atlas/不导出/毛球-待机.png", layout: "vertical" },
};

export function BeastSprite({ speciesId, large = false }: { speciesId: SpiritBeastId; large?: boolean }) {
  const sprite = BEAST_SPRITES[speciesId];
  return <span className={`beast-sprite beast-${speciesId} ${sprite.layout} ${large ? "large" : ""}`} style={{ "--beast-sheet": `url('${sprite.src}')` } as React.CSSProperties} aria-hidden="true" />;
}

export default function LivestockPanel({ day, period, onBack, onClose, onNotice }: Props) {
  const { state, setFarm, applyEffects } = useUnifiedGame();
  const [selectedUid, setSelectedUid] = useState(state.farm.livestock.animals[0]?.uid ?? "");
  const [beastFx, setBeastFx] = useState<{ uid: string; text: string; kind: "feed" | "love" | "collect" | "info" } | null>(null);
  const [message, setMessage] = useState("投喂会启动生产并让灵兽入睡；睡眠中的下一时辰可抚灵，计时完成后唤醒收取产物。");
  const level = farmLevel(state.farm.experience);
  const tick = gameTick(day, period);
  const livestock = syncLivestock(state.farm.livestock, tick);
  const selected = livestock.animals.find((animal) => animal.uid === selectedUid) ?? livestock.animals[0];

  function announce(copy: string) { setMessage(copy); onNotice(copy); }
  function floatBeast(uid: string, text: string, kind: "feed" | "love" | "collect" | "info") { setBeastFx({ uid, text, kind }); window.setTimeout(() => setBeastFx((current) => current?.uid === uid ? null : current), 1200); }

  function feed(uid: string) {
    const animal = livestock.animals.find((entry) => entry.uid === uid); if (!animal) return;
    const material = feedMaterialFor(animal.speciesId);
    const amount = state.shared.items[material.id]?.amount ?? 0;
    if (amount < 1) { announce(`缺少${material.name}，请先在灵田种植并收获。`); return; }
    const result = feedSpiritBeast(livestock, uid, tick);
    if (!result.ok) { announce(result.message); return; }
    setFarm((current) => ({ ...current, livestock: result.progress }));
    applyEffects([{ type: "remove_item", itemId: material.id, amount: 1 }]); floatBeast(uid, `饱食 · ${material.name} -1`, "feed"); announce(`${result.message} · ${material.name} -1`);
  }

  function love(uid: string) { const result = loveSpiritBeast(livestock, uid, tick); if (!result.ok) { announce(result.message); return; } setFarm((current) => ({ ...current, livestock: result.progress })); floatBeast(uid, "♥ 亲和 +8", "love"); announce(result.message); }
  function collect(uid: string) { const result = collectSpiritBeast(livestock, uid, tick); if (!result.ok) { announce(result.message); return; } setFarm((current) => ({ ...current, livestock: result.progress })); applyEffects([{ type: "add_item", item: result.reward }, { type: "add_player_exp", amount: result.reward.rarity * 2 }]); floatBeast(uid, `+${spiritBeastById(livestock.animals.find((item) => item.uid === uid)?.speciesId ?? "")?.productName} ×${result.reward.amount}`, "collect"); announce(`${result.message} · 已收入乾坤行囊`); }
  function sell(uid: string) { const result = sellSpiritBeast(livestock, uid); if (!result.ok) return; const definition = spiritBeastById(livestock.animals.find((entry) => entry.uid === uid)?.speciesId ?? "")!; if (!window.confirm(`确认将${definition.name}托付给仙庄，换取 ${result.gain} 灵石？`)) return; setFarm((current) => ({ ...current, livestock: result.progress })); applyEffects([{ type: "add_currency", amount: result.gain }]); setSelectedUid(result.progress.animals[0]?.uid ?? ""); announce(`${result.message} · 获得 ${result.gain} 灵石`); }

  return <section className="spirit-farm-panel livestock-panel" aria-label="云岫灵兽苑">
    <header className="farm-status-bar livestock-status-bar">
      <div><small>SPIRIT HUSBANDRY · 云岫灵圃</small><h3>灵田 · 灵兽苑</h3></div>
      <nav className="farm-scene-tabs"><button type="button" onClick={onBack}>灵田十二畦</button><button type="button" className="active">灵兽苑</button></nav>
      <div className="livestock-capacity"><small>栏舍容量</small><strong>{livestock.animals.length}<i> / {livestockCapacity(level)}</i></strong><span>灵圃 {level} 阶</span></div>
      {onClose && <button type="button" className="farm-panel-close" onClick={onClose} aria-label="返回灵圃场景">×</button>}
    </header>

    <div className="livestock-workspace">
      <aside className="livestock-list">
        <header><span>苑中灵兽</span><small>迎养请找宁绾秋</small></header>
        <div className="livestock-roster">{livestock.animals.map((animal, index) => { const beast = spiritBeastById(animal.speciesId)!; const profile = beastLevelProgress(animal.experience); const ready = animal.state === "ready"; return <button type="button" key={animal.uid} className={`${selected?.uid === animal.uid ? "active" : ""} ${ready ? "ready" : ""}`} onClick={() => setSelectedUid(animal.uid)}><BeastSprite speciesId={animal.speciesId} /><div><strong>{beast.name} · {index + 1}</strong><small>{ready ? "产物已凝成" : animal.state === "sleeping" ? animal.mood === "happy" ? "亲和睡眠中" : "饱食睡眠中" : "等待投喂"}</small><i><u style={{ width: `${profile.percent}%` }} /></i></div><b>Lv.{profile.level}</b></button>; })}{!livestock.animals.length && <div className="livestock-empty"><b>苑</b><p>栏舍尚空。点击“迎灵”，选择第一只灵兽入住。</p></div>}</div>
      </aside>

      <main className="livestock-yard">{selected ? (() => { const beast = spiritBeastById(selected.speciesId)!; const productReady = selected.state === "ready"; const canLove = selected.state === "sleeping" && tick > selected.asleepAtTick && selected.lovedAtTick < selected.asleepAtTick; const remaining = selected.state === "sleeping" ? Math.max(0, selected.readyAtTick - tick) : 0; return <>
        <div className={`livestock-beast-portrait mood-${selected.mood} state-${selected.state}`} onClick={() => { const copy = selected.state === "ready" ? "灵息圆满 · 可以唤醒收取" : selected.state === "sleeping" ? `吐纳中 · 尚余 ${remaining} 时辰` : "它抬头望向你，等待照料"; floatBeast(selected.uid, copy, "info"); }}><div className="beast-aura" /><BeastSprite speciesId={selected.speciesId} large /><i>{selected.mood === "happy" ? "♥" : selected.state === "sleeping" ? "眠" : selected.state === "ready" ? "成" : "息"}</i>{selected.state === "sleeping" && <div className="beast-sleep-particles"><b>z</b><b>z</b><b>灵</b></div>}{beastFx?.uid === selected.uid && <span className={`beast-floating-info ${beastFx.kind}`}>{beastFx.text}</span>}</div>
        <small>{beast.role} · {selected.state === "ready" ? "灵物凝成" : selected.state === "sleeping" ? "吐纳睡眠" : "等待照料"}</small><h2>{beast.name}</h2><p>投喂「{beast.feedMaterialName}」后进入生产睡眠；睡眠期间可抚灵一次，醒来时会增加「{beast.productName}」产量。</p>
        <div className="livestock-cycle"><span className={selected.state !== "idle" ? "done" : ""}><b>{selected.state === "idle" ? "待投喂" : "已饱食"}</b><small>消耗饲料</small></span><i>›</i><span className={selected.state === "sleeping" ? "active" : ""}><b>{selected.state === "sleeping" ? `${remaining} 时辰` : selected.mood === "happy" ? "已抚灵" : "生产睡眠"}</b><small>计时与亲和</small></span><i>›</i><span className={productReady ? "ready" : ""}><b>{productReady ? "点击唤醒" : "等待凝成"}</b><small>收取产物</small></span></div>
        <div className="livestock-actions"><button type="button" disabled={selected.state !== "idle"} onClick={() => feed(selected.uid)}><b>饲</b><span><strong>投喂{beast.feedMaterialName}</strong><small>持有 {state.shared.items[feedMaterialFor(selected.speciesId).id]?.amount ?? 0}</small></span></button><button type="button" disabled={!canLove} onClick={() => love(selected.uid)}><b>抚</b><span><strong>睡眠抚灵</strong><small>{selected.state !== "sleeping" ? "需先投喂" : canLove ? "本轮可抚灵" : "下一时辰开放"}</small></span></button><button type="button" className={productReady ? "ready" : ""} disabled={!productReady} onClick={() => collect(selected.uid)}><b>醒</b><span><strong>唤醒并收取</strong><small>{beast.productName}收入行囊</small></span></button></div>
      </>; })() : <div className="livestock-yard-empty"><span>苑</span><h3>灵兽苑静候有缘</h3><p>迎入灵兽后，可在此投喂、睡眠抚灵并在生产结束后唤醒收取。</p></div>}</main>

      <aside className="livestock-detail">{selected ? (() => { const beast = spiritBeastById(selected.speciesId)!; const profile = beastLevelProgress(selected.experience); return <><header><span>灵兽名牒</span><small>第 {day} 日 · {period}</small></header><div className="livestock-product"><img src={beast.productArt} alt=""/><span><small>生产产物</small><strong>{beast.productName}</strong><em>估值 ◉ {beast.productValue}</em></span></div><section><span>灵兽等级</span><strong>Lv.{profile.level}</strong><i><u style={{ width: `${profile.percent}%` }} /></i><small>{profile.current}/{profile.needed} 成长经验</small></section><section><span>饲料需求</span><strong>{beast.feedMaterialName}</strong><small>由同场景灵田种植获得</small></section><section><span>累计收取</span><strong>{livestock.totalCollected}</strong><small>所有灵兽总产物</small></section><button type="button" className="sell-spirit-beast" onClick={() => sell(selected.uid)}>托付仙庄</button></>; })() : <div className="livestock-tip"><b>饲</b><p>栏舍容量随灵圃等级增加，最多可同时照料八只灵兽。</p></div>}</aside>
    </div>
    <footer className="farm-message"><span>兽</span><p>{message}</p><b>生产时序 {tick + 1} · 只随游戏时间推进</b></footer>
  </section>;
}
