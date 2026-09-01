"use client";

import { useMemo, useState } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { PICKAXE_PRICE, criticalStrikeIndex, miningLocationById, miningPool, resetMiningDay, resolveMiningStrike, rollMiningMaterial, type MiningLocationId } from "./mining";

type Props = { locationId: MiningLocationId; randomSpotId?: string; day: number; period: string; onClose: () => void; onNotice: (message: string) => void };
const RARITY = ["凡品", "良品", "珍品", "极品", "神品", "神话"];

export default function MiningModal({ locationId, randomSpotId, day, period, onClose, onNotice }: Props) {
  const { state, setMining, applyEffects } = useUnifiedGame();
  const location = miningLocationById(locationId)!;
  const mining = resetMiningDay(state.mining, day);
  const spot = randomSpotId ? mining.randomSpots.find((entry) => entry.id === randomSpotId) : null;
  const durability = location.kind === "resident" ? mining.residentDurability : spot?.durability ?? 0;
  const maxDurability = location.kind === "resident" ? mining.residentMaxDurability : spot?.maxDurability ?? 1;
  const pool = useMemo(() => miningPool(location), [location]);
  const [message, setMessage] = useState(location.kind === "resident" ? "常明矿窟每日恢复矿面；每次挥镐消耗一柄灵木矿镐。" : "游光矿脉会在耐久耗尽后从山河图消失。找到灵光最盛的裂隙可触发双倍产出。");
  const [result, setResult] = useState<{ name: string; image: string; amount: number; critical: boolean } | null>(null);
  const [revealedStrike, setRevealedStrike] = useState<number | null>(null);
  const exhausted = durability <= 0;
  const seed = `${day}:${period}:${location.id}:${randomSpotId ?? "resident"}:${mining.strikeSerial}`;
  const criticalIndex = criticalStrikeIndex(seed);

  function buyPickaxes(quantity: number) { const cost = PICKAXE_PRICE * quantity; if (state.shared.spiritStones < cost) { setMessage(`灵石不足，还差 ${cost - state.shared.spiritStones} 枚。`); return; } applyEffects([{ type: "add_currency", amount: -cost }]); setMining((current) => ({ ...current, pickaxes: current.pickaxes + quantity })); setMessage(`购得灵木矿镐 ×${quantity} · 灵石 -${cost}`); }
  function strike(index: number) {
    if (exhausted) { setMessage(location.kind === "resident" ? "今日矿面已经采尽，明日恢复。" : "这道游光矿脉已经耗尽。 "); return; }
    if (mining.pickaxes <= 0) { setMessage("灵木矿镐已经用尽，可在矿务箱补购。 "); return; }
    const critical = index === criticalIndex;
    const material = rollMiningMaterial(location, `${seed}:${index}`); const amount = critical ? 2 : 1;
    setMining((current) => resolveMiningStrike(current, day, location, material.id, critical, randomSpotId));
    applyEffects([{ type: "add_item", item: { itemId: material.id, itemType: "material", rarity: Math.max(1, Math.min(7, material.rarity)) as 1|2|3|4|5|6|7, amount, sourceTags: [location.name, location.kind === "resident" ? "常驻矿洞" : "游光矿脉"] } }, { type: "add_player_exp", amount: material.rarity * amount }]);
    setRevealedStrike(index); setResult({ name: material.name, image: material.image, amount, critical }); const copy = `${critical ? "灵脉共振 · " : "开采成功 · "}${material.name} ×${amount}`; setMessage(copy); onNotice(`${copy}，已收入乾坤行囊。`); window.setTimeout(() => setRevealedStrike(null), 650);
  }

  return <div className="mining-backdrop" role="presentation" onMouseDown={onClose}><section className="mining-window" role="dialog" aria-modal="true" aria-label={`${location.name}挖矿`} onMouseDown={(event) => event.stopPropagation()}>
    <header className="mining-heading"><div><small>SPIRIT MINING · {location.kind === "resident" ? "常驻矿务" : "游光勘探"}</small><h2>{location.name}</h2><p>{location.subtitle} · 第 {day} 日 {period}</p></div><div className="mining-tools"><span>灵木矿镐</span><strong>{mining.pickaxes}</strong><button type="button" onClick={() => buyPickaxes(3)}>补购 ×3 · ◉ {PICKAXE_PRICE * 3}</button></div><button type="button" onClick={onClose}>×</button></header>
    <div className="mining-layout">
      <aside className="mining-codex"><header><span>此地矿谱</span><small>区域权重</small></header>{pool.map((entry) => <article key={entry.material.id}><img src={entry.material.image} alt=""/><div><strong>{entry.material.name}</strong><small>{RARITY[entry.material.rarity - 1]} · {(entry.probability * 100).toFixed(0)}%</small></div><b>×{mining.records[entry.material.id] ?? 0}</b></article>)}<footer>累计开采 <strong>{mining.totalMined}</strong> 份</footer></aside>
      <main className="mining-face"><div className="vein-status"><span>矿脉耐久</span><strong>{durability} / {maxDurability}</strong><i><u style={{ width: `${Math.max(0, durability / maxDurability * 100)}%` }} /></i></div>
        {!exhausted ? <><div className="ore-rock-face"><div className="ore-core" /><span>脉</span>{[0,1,2].map((index) => <button type="button" key={index} className={revealedStrike === index ? index === criticalIndex ? "critical" : "struck" : ""} style={{ "--strike-x": `${24 + index * 26}%`, "--strike-y": `${index === 1 ? 27 : 58}%` } as React.CSSProperties} onClick={() => strike(index)}><i /><b>{revealedStrike === index ? index === criticalIndex ? "共振" : "得矿" : "裂"}</b></button>)}</div><p>观察三处裂隙，选择一处落镐。每次挥镐都会让矿脉耐久降低一点。</p></> : <div className="mine-exhausted"><span>尽</span><h3>{location.kind === "resident" ? "今日矿面已采尽" : "游光矿脉已消散"}</h3><p>{location.kind === "resident" ? "待游戏时间进入明日，常明矿窟会重新凝结矿层。" : "该光点已从山河图移除，新的矿脉会在后续游戏日出现。"}</p></div>}
      </main>
      <aside className="mining-result-panel"><header><span>本次所得</span><small>直接归入炼丹材料</small></header>{result ? <><div className={`mining-result-art ${result.critical ? "critical" : ""}`}><img src={result.image} alt=""/><b>×{result.amount}</b></div><small>{result.critical ? "灵脉共振 · 双倍产出" : "常规开采"}</small><h3>{result.name}</h3><p>已同步收入乾坤行囊及玄火丹炉材料库存。</p></> : <div className="mining-empty-result"><b>矿</b><p>落镐后，此处会展示本次矿物与产量。</p></div>}<footer><p>{message}</p><button type="button" onClick={onClose}>{exhausted ? "返回山河图" : "暂离矿脉"}</button></footer></aside>
    </div>
  </section></div>;
}
