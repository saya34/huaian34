"use client";

import { useMemo, useState } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import FishingBar, { type FishingBarHit, type FishingBarResult } from "../FishingBar";
import {
  BAITS,
  DAILY_CAST_LIMIT,
  FISH,
  castFishing,
  fishById,
  fishingLocationById,
  reelFishing,
  resetFishingDay,
  weightedPool,
  type BaitId,
  type FishDefinition,
  type FishingLocationId,
} from "./fishing";

type Props = {
  locationId: FishingLocationId;
  randomSpotId?: string;
  day: number;
  period: string;
  onClose: () => void;
  onNotice: (message: string) => void;
};

type Phase = "ready" | "reeling" | "success" | "failed";
const RARITY_LABELS = ["凡品", "灵品", "珍品", "玄品", "仙品"];

export default function FishingModal({ locationId, randomSpotId, day, period, onClose, onNotice }: Props) {
  const { state, setFishing, applyEffects } = useUnifiedGame();
  const location = fishingLocationById(locationId)!;
  const progress = resetFishingDay(state.fishing, day);
  const tick = (Math.max(1, day) - 1) * 3 + Math.max(0, ["清晨", "黄昏", "夜晚"].indexOf(period));
  const resumedCast = progress.pendingCast?.locationId === locationId ? progress.pendingCast : null;
  const [baitId, setBaitId] = useState<BaitId>("spirit-worm");
  const [phase, setPhase] = useState<Phase>(resumedCast ? "reeling" : "ready");
  const [target, setTarget] = useState<FishDefinition | null>(resumedCast ? fishById(resumedCast.fishId) ?? null : null);
  const [castRound, setCastRound] = useState(0);
  const [lastHit, setLastHit] = useState<FishingBarHit["zone"] | null>(null);
  const pool = useMemo(() => weightedPool(location, baitId), [baitId, location]);
  const attemptsLeft = Math.max(0, DAILY_CAST_LIMIT - progress.dailyAttempts);

  function buyBait(id: BaitId) {
    const price = BAITS[id].price;
    if (state.shared.spiritStones < price) { onNotice(`灵石不足，购买${BAITS[id].name}需要 ${price} 枚。`); return; }
    applyEffects([{ type: "add_currency", amount: -price }]);
    setFishing((current) => ({ ...current, baits: { ...current.baits, [id]: (current.baits[id] ?? 0) + 1 } }));
    onNotice(`购得${BAITS[id].name} ×1`);
  }

  function buyRods(quantity: number) {
    const cost = quantity * 28;
    if (state.shared.spiritStones < cost) { onNotice(`灵石不足，补充钓竿需要 ${cost} 枚。`); return; }
    applyEffects([{ type: "add_currency", amount: -cost }]);
    setFishing((current) => ({ ...current, rods: current.rods + quantity }));
    onNotice(`补充灵木钓竿 ×${quantity}`);
  }

  function castRod() {
    const cast = castFishing(progress, { day, tick, location, baitId, randomSpotId });
    if (!cast.ok) { onNotice(cast.message); return; }
    const fish = fishById(cast.catch.fishId)!;
    setTarget(fish);
    setPhase("reeling"); setCastRound((value) => value + 1); setLastHit(null);
    setFishing(cast.progress);
    onNotice(`抛竿入水 · 消耗灵木钓竿与${BAITS[baitId].name}各 1`);
  }

  function finishReeling(result: FishingBarResult) {
    if (!target) return;
    if (result.success) {
      setPhase("success");
      setFishing((current) => reelFishing(current, true).progress);
      applyEffects([
        { type: "add_item", item: { itemId: target.id, itemType: "fish", rarity: target.rarity, amount: 1, sourceTags: [location.name, location.kind === "random" ? "游光钓点" : "常驻钓点"] } },
        { type: "add_player_exp", amount: target.rarity * 3 },
      ]);
      onNotice(`收杆成功 · 获得${target.name}，已收入乾坤行囊。`);
      return;
    }
    setPhase("failed");
    setFishing((current) => reelFishing(current, false).progress);
    onNotice("灵线失衡，鱼影挣脱了。 ");
  }

  return <div className="fishing-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="fishing-window" role="dialog" aria-modal="true" aria-label={`${location.name}钓鱼`} onMouseDown={(event) => event.stopPropagation()}>
      <header className="fishing-heading">
        <div><small>SPIRIT ANGLING · {location.kind === "random" ? "游光灵泉" : "常驻鱼场"}</small><h2>{location.name}</h2><p>{location.subtitle} · 第 {day} 日 {period}</p></div>
        <div className="fishing-attempts"><span>今日抛竿</span><strong>{attemptsLeft}<small> / {DAILY_CAST_LIMIT}</small></strong><em>钓竿 {progress.rods}</em></div>
        <button type="button" onClick={onClose} aria-label="离开钓点">×</button>
      </header>

      <div className={`fishing-content ${phase === "reeling" ? "fishing-content-active" : ""}`}>
        <aside className="fish-pool-panel">
          <header><span>本地鱼谱</span><small>鱼饵会改变咬钩权重</small></header>
          <div className="fish-pool-list">{pool.map((entry) => { const fish = FISH.find((item) => item.id === entry.fishId)!; return <article key={fish.id} className={progress.records[fish.id] ? "caught" : "unknown"}>
            <div className="fish-token" style={{ backgroundImage: `url(${fish.art})` }}><b>{progress.records[fish.id] ? fish.icon : "?"}</b></div>
            <div><strong>{progress.records[fish.id] ? fish.name : "未录灵鱼"}</strong><small>{RARITY_LABELS[fish.rarity - 1]} · {(entry.probability * 100).toFixed(entry.probability < .1 ? 1 : 0)}%</small></div>
            <em>×{progress.records[fish.id] ?? 0}</em>
          </article>; })}</div>
          <footer>鱼获总数 <b>{progress.totalCaught}</b> · 已识 {Object.keys(progress.records).length}/{FISH.length}</footer>
        </aside>

        <main className="fishing-stage-panel">
          {phase === "ready" && <div className="fishing-ready">
            <div className="fishing-water-orb"><i /><span>钓</span><b /></div>
            <h3>择饵听澜</h3><p>{location.kind === "random" ? "这处游光只容一次抛竿；无论得失，收线后光点都会散去。" : "水面灵息平稳，可以反复垂钓，直到今日定力耗尽。"}</p>
            <div className="bait-selector">{(Object.keys(BAITS) as BaitId[]).map((id) => <button key={id} className={baitId === id ? "active" : ""} onClick={() => setBaitId(id)}><b>{BAITS[id].icon}</b><span><strong>{BAITS[id].name}</strong><small>持有 {progress.baits[id] ?? 0}</small></span></button>)}</div>
            <button className="cast-rod-button" type="button" disabled={attemptsLeft <= 0 || progress.rods <= 0 || (progress.baits[baitId] ?? 0) <= 0} onClick={castRod}><span>消耗钓竿与{BAITS[baitId].name}各 1</span><strong>抛 竿 入 境</strong></button>
          </div>}

          {phase === "reeling" && target && <FishingBar key={`${target.id}-${castRound}`} theme="fish" config={{ maxAttempts: 6 + target.rarity, targetScore: 6 + target.rarity * 2, difficultyLevel: Math.min(9, target.rarity * 2 + (location.kind === "random" ? 1 : 0)), difficultyName: `${RARITY_LABELS[target.rarity - 1]}鱼影` }} onHit={(hit) => setLastHit(hit.zone)} onFinish={finishReeling}>
            <div className={`fishing-reel-scene reel-${lastHit ?? "waiting"}`}>
              <div className="fishing-night-sky"><i /><i /><i /></div>
              <div className="fishing-far-bank"><i /><i /><i /></div>
              <div className="fishing-water-stage"><span className="water-current current-one" /><span className="water-current current-two" /><span className="water-current current-three" /><div className={`fish-shadow rarity-${target.rarity}`}><i /><b /></div><div className="hook-ripple"><i /><i /><b /></div></div>
              <div className="fishing-angler"><span className="angler-head" /><span className="angler-body" /><i className="angler-rod" /><b className="angler-line" /></div>
              <div className="reel-instruction"><small>灵线已动 · 不要让鱼影挣脱</small><strong>{lastHit === "target" ? "绝佳收线！" : lastHit === "near" ? "顺势拉扯" : lastHit === "miss" ? "鱼影反扑" : "看准红区 · 点击水面收线"}</strong><span>鱼影越稀有，游速与变向越难预测</span></div>
            </div>
          </FishingBar>}

          {(phase === "success" || phase === "failed") && <div className={`fishing-result ${phase}`}>
            {phase === "success" && target ? <><div className="catch-art" style={{ backgroundImage: `url(${target.art})` }}><b>{target.icon}</b></div><small>{RARITY_LABELS[target.rarity - 1]} · 估值 {target.value} 灵石</small><h3>{target.name}</h3><p>{target.description}</p><strong>已收入乾坤行囊</strong></> : <><div className="catch-art escaped"><b>澜</b></div><small>灵线已静</small><h3>鱼影脱钩</h3><p>水纹判断失误，鱼影潜回了深处。常驻鱼场仍可再试，游光钓点则已随波消散。</p></>}
            <button type="button" onClick={() => location.kind === "resident" ? setPhase("ready") : onClose()}>{location.kind === "resident" ? "再听一竿" : "返回山河图"}</button>
          </div>}
        </main>

        <aside className="bait-shop-panel">
          <header><span>行脚渔篓</span><small>补充钓竿与鱼饵</small></header>
          <article className="rod-supply"><b>竿</b><div><strong>灵木钓竿</strong><p>每次抛竿消耗一柄</p><small>现有 {progress.rods}</small></div><button type="button" onClick={() => buyRods(3)}>◉ 84</button></article>
          {(Object.keys(BAITS) as BaitId[]).map((id) => <article key={id}><b>{BAITS[id].icon}</b><div><strong>{BAITS[id].name}</strong><p>{BAITS[id].description}</p><small>现有 {progress.baits[id] ?? 0}</small></div><button type="button" onClick={() => buyBait(id)}>◉ {BAITS[id].price}</button></article>)}
          <footer><span>当前灵石</span><strong>◉ {state.shared.spiritStones.toLocaleString()}</strong></footer>
        </aside>
      </div>
    </section>
  </div>;
}
