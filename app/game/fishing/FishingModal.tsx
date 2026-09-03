"use client";

import { useMemo, useState } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { MATERIALS } from "../alchemy/item-data";
import FishingBar, { type FishingBarHit, type FishingBarResult } from "../FishingBar";
import {
  BAITS,
  CHUMS,
  DAILY_CAST_LIMIT,
  FISH,
  abandonFishingEscape,
  castFishing,
  collectAgedFish,
  extraReelPackPrice,
  fishById,
  fishingLocationById,
  processFishIntoBait,
  reelFishing,
  resetFishingDay,
  retryFishing,
  startFishAging,
  weightedPool,
  type BaitId,
  type ChumId,
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
  const [chumId, setChumId] = useState<ChumId>(resumedCast?.chumId ?? "none");
  const [phase, setPhase] = useState<Phase>(resumedCast ? "reeling" : "ready");
  const [target, setTarget] = useState<FishDefinition | null>(resumedCast ? fishById(resumedCast.fishId) ?? null : null);
  const [castRound, setCastRound] = useState(0);
  const [lastHit, setLastHit] = useState<FishingBarHit["zone"] | null>(null);
  const pool = useMemo(() => weightedPool(location, baitId, chumId), [baitId, chumId, location]);
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

  function buyExtraReels() {
    const price = extraReelPackPrice(progress.reelPacksBought);
    if (state.shared.spiritStones < price) { onNotice(`补充五次定力需要 ${price} 灵石。`); return; }
    applyEffects([{ type: "add_currency", amount: -price }]);
    setFishing((current) => ({ ...current, dailyAttempts: Math.max(0, current.dailyAttempts - 5), reelPacksBought: current.reelPacksBought + 1 }));
    onNotice(`追加五次垂钓定力 · 灵石 -${price}`);
  }

  function castRod() {
    const chum = CHUMS[chumId];
    const chumMaterial = chum.materialName ? MATERIALS.find((item) => item.name === chum.materialName) : null;
    if (chumMaterial && (state.shared.items[chumMaterial.id]?.amount ?? 0) < 1) { onNotice(`缺少${chum.materialName}，请先在灵田培育。`); return; }
    const cast = castFishing(progress, { day, tick, location, baitId, chumId, randomSpotId });
    if (!cast.ok) { onNotice(cast.message); return; }
    const fish = fishById(cast.catch.fishId)!;
    setTarget(fish);
    setPhase("reeling"); setCastRound((value) => value + 1); setLastHit(null);
    setFishing(cast.progress);
    if (chumMaterial) applyEffects([{ type: "remove_item", itemId: chumMaterial.id, amount: 1 }]);
    onNotice(`抛竿入水 · 消耗钓竿、${BAITS[baitId].name}${chumMaterial ? `与${chum.materialName}` : ""}`);
  }

  function finishReeling(result: FishingBarResult) {
    if (!target) return;
    if (result.success) {
      setPhase("success");
      const reel = reelFishing(progress.pendingCast ? progress : state.fishing, true);
      setFishing((current) => reelFishing(current, true).progress);
      const rewards = [
        { type: "add_item", item: { itemId: target.id, itemType: "fish", rarity: target.rarity, amount: 1, sourceTags: [location.name, location.kind === "random" ? "游光钓点" : "常驻钓点"] } },
        { type: "add_player_exp", amount: target.rarity * 3 },
      ] as Parameters<typeof applyEffects>[0];
      if (reel.ok && reel.mapFragment) rewards.push({ type: "add_item", item: { itemId: "river-map-fragment", itemType: "quest", rarity: 4, amount: 1, sourceTags: ["钓鱼", "河图残片"] } });
      applyEffects(rewards);
      onNotice(`收杆成功 · 获得${target.name}${reel.ok && reel.mapFragment ? "与河图残片" : ""}，已收入乾坤行囊。`);
      return;
    }
    setPhase("failed");
    setFishing((current) => reelFishing(current, false).progress);
    onNotice("灵线失衡，鱼影挣脱了。 ");
  }

  function retryEscaped() {
    const cost = 1000;
    if (state.shared.spiritStones < cost) { onNotice(`追回鱼影需要 ${cost} 灵石。`); return; }
    const result = retryFishing(state.fishing);
    if (!result.ok) { onNotice(result.message); return; }
    applyEffects([{ type: "add_currency", amount: -cost }]);
    setFishing(result.progress); setTarget(fishById(result.catch.fishId) ?? null); setPhase("reeling"); setCastRound((value) => value + 1); setLastHit(null); onNotice(`${result.message} · 灵石 -${cost}`);
  }

  function leaveFishing() {
    if (phase === "failed") setFishing((current) => abandonFishingEscape(current));
    onClose();
  }

  function continueFishing() {
    if (phase === "failed") setFishing((current) => abandonFishingEscape(current));
    setPhase("ready"); setTarget(null); setLastHit(null);
  }

  function ageCatch() {
    if (!target || (state.shared.items[target.id]?.amount ?? 0) < 1) { onNotice("这尾灵鱼已经不在行囊中。"); return; }
    const result = startFishAging(state.fishing, target.id, tick); if (!result.ok) { onNotice(result.message); return; }
    setFishing(result.progress); applyEffects([{ type: "remove_item", itemId: target.id, amount: 1 }]); onNotice(result.message); setTarget(null); setPhase("ready");
  }

  function processCatch() {
    if (!target || (state.shared.items[target.id]?.amount ?? 0) < 1) { onNotice("这尾灵鱼已经不在行囊中。"); return; }
    const result = processFishIntoBait(state.fishing, target.id); if (!result.ok) { onNotice(result.message); return; }
    setFishing(result.progress); applyEffects([{ type: "remove_item", itemId: target.id, amount: 1 }]); onNotice(result.message); setTarget(null); setPhase("ready");
  }

  function collectAged(slotId: string) {
    const result = collectAgedFish(state.fishing, slotId, tick); if (!result.ok) { onNotice(result.message); return; }
    setFishing(result.progress); applyEffects([{ type: "add_item", item: { itemId: `aged-${result.fish.id}`, itemType: "fish", rarity: Math.min(5, result.fish.rarity + 1) as 1|2|3|4|5, amount: 1, sourceTags: ["听澜陈化", result.fish.name] } }]); onNotice(`${result.message} · 已收入行囊`);
  }

  return <div className="fishing-backdrop" role="presentation" onMouseDown={leaveFishing}>
    <section className="fishing-window" role="dialog" aria-modal="true" aria-label={`${location.name}钓鱼`} onMouseDown={(event) => event.stopPropagation()}>
      <header className="fishing-heading">
        <div><small>SPIRIT ANGLING · {location.kind === "random" ? "游光灵泉" : "常驻鱼场"}</small><h2>{location.name}</h2><p>{location.subtitle} · 第 {day} 日 {period}</p></div>
        <div className="fishing-attempts"><span>今日抛竿</span><strong>{attemptsLeft}<small> / {DAILY_CAST_LIMIT}</small></strong><em>钓竿 {progress.rods}</em></div>
        <button type="button" onClick={leaveFishing} aria-label="离开钓点">×</button>
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
            <div className="chum-selector">{(Object.keys(CHUMS) as ChumId[]).map((id) => { const chum = CHUMS[id]; const material = chum.materialName ? MATERIALS.find((item) => item.name === chum.materialName) : null; return <button type="button" key={id} className={chumId === id ? "active" : ""} onClick={() => setChumId(id)}><b>{chum.icon}</b><span><strong>{chum.name}</strong><small>{material ? `持有 ${state.shared.items[material.id]?.amount ?? 0}` : "不消耗仙草"}</small></span></button>; })}</div>
            <div className="fish-aging-rack">{progress.aging.map((slot) => { const fish = fishById(slot.fishId)!; const ready = slot.readyAtTick <= tick; return <button type="button" key={slot.id} className={ready ? "ready" : ""} onClick={() => collectAged(slot.id)}><span style={{backgroundImage:`url(${fish.art})`}}/><b>{ready ? "收" : slot.readyAtTick - tick}</b><small>{ready ? `${fish.name}陈化完成` : `${fish.name} · 听澜陈化中`}</small></button>; })}{Array.from({length: Math.max(0, 3 - progress.aging.length)},(_,index)=><i key={index}>空篓</i>)}</div>
            <button className="cast-rod-button" type="button" disabled={attemptsLeft <= 0 || progress.rods <= 0 || (progress.baits[baitId] ?? 0) <= 0} onClick={castRod}><span>消耗钓竿与{BAITS[baitId].name}各 1</span><strong>抛 竿 入 境</strong></button>
          </div>}

          {phase === "reeling" && target && <FishingBar key={`${target.id}-${castRound}`} theme="fish" config={{ maxAttempts: 6 + target.rarity, targetScore: 6 + target.rarity * 2, difficultyLevel: Math.min(9, target.rarity * 2 + (location.kind === "random" ? 1 : 0)), difficultyName: `${RARITY_LABELS[target.rarity - 1]}鱼影`, rarity:target.rarity }} onHit={(hit) => setLastHit(hit.zone)} onFinish={finishReeling}>
            <div className={`fishing-reel-scene reel-${lastHit ?? "waiting"} ${target.rarity>=4?`rare-water rarity-${target.rarity}`:""}`}>
              <div className="fishing-night-sky"><i /><i /><i /></div>
              <div className="fishing-far-bank"><i /><i /><i /></div>
              <div className="fishing-water-stage"><span className="water-current current-one" /><span className="water-current current-two" /><span className="water-current current-three" />{target.rarity>=4&&<span className="rare-water-runes"><i/><i/><i/><b>{target.rarity===5?"星":"玄"}</b></span>}<div className={`fish-shadow rarity-${target.rarity}`}><i /><b /></div><div className="hook-ripple"><i /><i /><b /></div></div>
              <div className="fishing-angler"><span className="angler-head" /><span className="angler-body" /><i className="angler-rod" /><b className="angler-line" /></div>
              <div className="reel-instruction"><small>灵线已动 · 不要让鱼影挣脱</small><strong>{lastHit === "target" ? "绝佳收线！" : lastHit === "near" ? "顺势拉扯" : lastHit === "miss" ? "鱼影反扑" : "看准红区 · 点击水面收线"}</strong><span>鱼影越稀有，游速与变向越难预测</span></div>
            </div>
          </FishingBar>}

          {(phase === "success" || phase === "failed") && <div className={`fishing-result ${phase}`}>
            {phase === "success" && target ? <><div className="catch-art" style={{ backgroundImage: `url(${target.art})` }}><b>{target.icon}</b></div><small>{RARITY_LABELS[target.rarity - 1]} · 估值 {target.value} 灵石</small><h3>{target.name}</h3><p>{target.description}</p><strong>已收入乾坤行囊</strong><div className="catch-processing"><button type="button" onClick={ageCatch}>收入听澜篓陈化</button><button type="button" onClick={processCatch}>就地制成鱼饵</button></div></> : <><div className="catch-art escaped"><b>澜</b></div><small>灵线已静</small><h3>鱼影脱钩</h3><p>水纹判断失误，鱼影潜回了深处。常驻鱼场仍可再试，游光钓点则已随波消散。</p></>}
            {phase === "failed" && <button type="button" className="retry-fish" onClick={retryEscaped}>循波追回 · ◉ 1000</button>}
            <button type="button" onClick={() => location.kind === "resident" ? continueFishing() : leaveFishing()}>{location.kind === "resident" ? "放弃鱼影 · 再听一竿" : "放弃鱼影 · 返回山河图"}</button>
          </div>}
        </main>

        <aside className="bait-shop-panel">
          <header><span>行脚渔篓</span><small>补充钓竿与鱼饵</small></header>
          <article className="rod-supply"><b>竿</b><div><strong>灵木钓竿</strong><p>每次抛竿消耗一柄</p><small>现有 {progress.rods}</small></div><button type="button" onClick={() => buyRods(3)}>◉ 84</button></article>
          {(Object.keys(BAITS) as BaitId[]).map((id) => <article key={id}><b>{BAITS[id].icon}</b><div><strong>{BAITS[id].name}</strong><p>{BAITS[id].description}</p><small>现有 {progress.baits[id] ?? 0}</small></div><button type="button" onClick={() => buyBait(id)}>◉ {BAITS[id].price}</button></article>)}
          <footer><span>当前灵石</span><strong>◉ {state.shared.spiritStones.toLocaleString()}</strong></footer>
          <button type="button" className="extra-reel-pack" onClick={buyExtraReels}>追加五次定力 · ◉ {extraReelPackPrice(progress.reelPacksBought)}</button>
        </aside>
      </div>
    </section>
  </div>;
}
