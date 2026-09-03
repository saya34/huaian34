"use client";

import { useMemo, useState } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { PICKAXE_PRICE, mineNode, miningLocationById, miningMaterialByName, miningNodes, miningPool, nodeUpgradeCost, pickaxeUpgradeCost, resetMiningDay, upgradePickaxe, upgradeResidentNode, type MiningLocationId } from "./mining";

type Props = { locationId: MiningLocationId; randomSpotId?: string; day: number; period: string; onClose: () => void; onNotice: (message: string) => void };
const RARITY = ["凡品", "良品", "珍品", "极品", "神品", "神话"];

export default function MiningModal({ locationId, randomSpotId, day, period, onClose, onNotice }: Props) {
  const { state, setMining, applyEffects } = useUnifiedGame();
  const location = miningLocationById(locationId)!;
  const mining = resetMiningDay(state.mining, day);
  const tick = (Math.max(1, day) - 1) * 3 + Math.max(0, ["清晨", "黄昏", "夜晚"].indexOf(period));
  const nodes = miningNodes(mining, location, randomSpotId);
  const available = nodes.filter((node) => location.kind === "resident" ? node.readyAtTick <= tick : node.minedAtTick < 0).length;
  const pool = useMemo(() => miningPool(location), [location]);
  const [message, setMessage] = useState(location.kind === "resident" ? "点击真实矿点挥镐；每次消耗一柄矿镐，矿点会按自己的游戏时辰复原。" : "逐个开采游光矿点；最后一块采尽后，矿脉会从山河图消失。");
  const [result, setResult] = useState<{ name: string; image: string; amount: number; critical: boolean } | null>(null);
  const [struckNode, setStruckNode] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0]?.id ?? "");
  const exhausted = available <= 0;

  function buyPickaxes(quantity: number) { const cost = PICKAXE_PRICE * quantity; if (state.shared.spiritStones < cost) { setMessage(`灵石不足，还差 ${cost - state.shared.spiritStones} 枚。`); return; } applyEffects([{ type: "add_currency", amount: -cost }]); setMining((current) => ({ ...current, pickaxes: current.pickaxes + quantity })); setMessage(`购得灵木矿镐 ×${quantity} · 灵石 -${cost}`); }
  function strike(nodeId: string) {
    setSelectedNodeId(nodeId);
    if (exhausted) { setMessage(location.kind === "resident" ? "当前矿点都在复原，推进一个游戏时辰后再来。" : "这道游光矿脉已经耗尽。 "); return; }
    if (mining.pickaxes <= 0) { setMessage("灵木矿镐已经用尽，可在矿务箱补购。 "); return; }
    const strikeResult = mineNode(mining, { day, tick, location, nodeId, randomSpotId });
    if (!strikeResult.ok) { setMessage(strikeResult.message); return; }
    const { material, amount, critical } = strikeResult;
    setMining(strikeResult.progress);
    applyEffects([{ type: "add_item", item: { itemId: material.id, itemType: "material", rarity: Math.max(1, Math.min(7, material.rarity)) as 1|2|3|4|5|6|7, amount, sourceTags: [location.name, location.kind === "resident" ? "常驻矿洞" : "游光矿脉"] } }, { type: "add_player_exp", amount: material.rarity * amount }]);
    setStruckNode(nodeId); setResult({ name: material.name, image: material.image, amount, critical }); setMessage(strikeResult.message); onNotice(`${strikeResult.message}，已收入乾坤行囊。`); window.setTimeout(() => setStruckNode(null), 650);
  }

  function improvePickaxe() {
    const cost = pickaxeUpgradeCost(mining.pickaxeLevel);
    const material = miningMaterialByName(cost.materialName);
    const held = state.shared.items[material.id]?.amount ?? 0;
    if (mining.pickaxeLevel >= 3) { setMessage("玄铁灵镐已经淬炼至最高阶。"); return; }
    if (state.shared.spiritStones < cost.stones || held < cost.materialAmount) { setMessage(`淬炼需要灵石 ${cost.stones} 与${cost.materialName} ×${cost.materialAmount}`); return; }
    const upgraded = upgradePickaxe(mining); if (!upgraded.ok) { setMessage(upgraded.message); return; }
    setMining(upgraded.progress); applyEffects([{ type: "add_currency", amount: -cost.stones }, { type: "remove_item", itemId: material.id, amount: cost.materialAmount }]); setMessage(upgraded.message); onNotice(upgraded.message);
  }

  function improveVein() {
    if (location.kind !== "resident") { setMessage("游光矿脉无法长久凝炼。"); return; }
    const node = mining.residentNodes.find((entry) => entry.id === selectedNodeId) ?? mining.residentNodes[0];
    if (!node || node.tier >= 3) { setMessage("先点选一处尚可凝炼的常驻矿点。"); return; }
    const cost = nodeUpgradeCost(node.tier); const material = miningMaterialByName(cost.materialName); const held = state.shared.items[material.id]?.amount ?? 0;
    if (state.shared.spiritStones < cost.stones || held < cost.materialAmount) { setMessage(`凝炼矿脉需要灵石 ${cost.stones} 与${cost.materialName} ×${cost.materialAmount}`); return; }
    const upgraded = upgradeResidentNode(mining, node.id); if (!upgraded.ok) { setMessage(upgraded.message); return; }
    setMining(upgraded.progress); applyEffects([{ type: "add_currency", amount: -cost.stones }, { type: "remove_item", itemId: material.id, amount: cost.materialAmount }]); setMessage(upgraded.message); onNotice(upgraded.message);
  }

  return <div className="mining-backdrop" role="presentation" onMouseDown={onClose}><section className="mining-window" role="dialog" aria-modal="true" aria-label={`${location.name}挖矿`} onMouseDown={(event) => event.stopPropagation()}>
    <header className="mining-heading"><div><small>SPIRIT MINING · {location.kind === "resident" ? "常驻矿务" : "游光勘探"}</small><h2>{location.name}</h2><p>{location.subtitle} · 第 {day} 日 {period}</p></div><div className="mining-tools"><span>{mining.pickaxeLevel}阶玄铁灵镐</span><strong>{mining.pickaxes}</strong><button type="button" onClick={() => buyPickaxes(3)}>补购 ×3 · ◉ {PICKAXE_PRICE * 3}</button></div><button type="button" onClick={onClose}>×</button></header>
    <div className="mining-layout">
      <aside className="mining-codex"><header><span>此地矿谱</span><small>区域权重</small></header>{pool.map((entry) => <article key={entry.material.id}><img src={entry.material.image} alt=""/><div><strong>{entry.material.name}</strong><small>{RARITY[entry.material.rarity - 1]} · {(entry.probability * 100).toFixed(0)}%</small></div><b>×{mining.records[entry.material.id] ?? 0}</b></article>)}<footer>累计开采 <strong>{mining.totalMined}</strong> 份</footer></aside>
      <main className="mining-face"><div className="mining-cave-scenery" aria-hidden="true"><i className="cave-mouth"/><i className="cave-track"/><i className="cave-cart"/><span className="cave-torches"><b/><b/></span><span className={`cave-miner ${struckNode ? "swing" : ""}`}><i/><b/></span></div><div className="vein-status"><span>可开采矿点</span><strong>{available} / {nodes.length}</strong><i><u style={{ width: `${nodes.length ? Math.max(0, available / nodes.length * 100) : 0}%` }} /></i></div>{result && <div className={`mining-loot-toast ${result.critical ? "critical" : ""}`}><img src={result.image} alt=""/><span><small>{result.critical ? "灵脉共振" : "收入行囊"}</small><strong>{result.name} ×{result.amount}</strong></span></div>}
        {nodes.length ? <><div className="ore-node-field"><div className="ore-cave-glow" />{nodes.map((node, index) => { const material = miningMaterialByName(node.materialName); const ready = location.kind === "resident" ? node.readyAtTick <= tick : node.minedAtTick < 0; const remaining = Math.max(0, node.readyAtTick - tick); return <button type="button" key={node.id} disabled={!ready} className={`${ready ? "ready" : "recovering"} ${struckNode === node.id ? "struck" : ""} ${selectedNodeId === node.id ? "selected" : ""} tier-${node.tier}`} style={{ "--node-delay": `${index * .12}s`, "--ore-x": `${18 + (index * 27) % 71}%`, "--ore-y": `${27 + (index * 23) % 49}%` } as React.CSSProperties} onClick={() => strike(node.id)}><span className="ore-node-rock"><img src={material.image} alt=""/><i /></span><strong>{ready ? material.name : `复原 ${remaining}`}</strong><small>{node.tier}阶 · {ready ? "点击挥镐" : "凝结中"}</small>{struckNode === node.id && <em>✦ ×{result?.amount ?? 1}</em>}</button>; })}</div><div className="mining-cave-dock"><button type="button" onClick={improvePickaxe} disabled={mining.pickaxeLevel >= 3}><b>镐</b><span>淬炼矿镐<small>当前 {mining.pickaxeLevel} 阶</small></span></button>{location.kind === "resident" && <button type="button" onClick={improveVein}><b>脉</b><span>凝炼所选矿脉<small>提升产量与复原阶位</small></span></button>}<button type="button" onClick={() => buyPickaxes(3)}><b>具</b><span>补充矿镐<small>×3 · ◉ {PICKAXE_PRICE * 3}</small></span></button></div></> : <div className="mine-exhausted"><span>尽</span><h3>{location.kind === "resident" ? "矿点正在复原" : "游光矿脉已消散"}</h3><p>{location.kind === "resident" ? "推进游戏内时辰后，常明矿窟会逐块重新凝结。" : "该光点已从山河图移除，新的矿脉会在后续游戏日出现。"}</p></div>}
      </main>
      <aside className="mining-result-panel"><header><span>本次所得</span><small>直接归入炼丹材料</small></header>{result ? <><div className={`mining-result-art ${result.critical ? "critical" : ""}`}><img src={result.image} alt=""/><b>×{result.amount}</b></div><small>{result.critical ? "灵脉共振 · 双倍产出" : "常规开采"}</small><h3>{result.name}</h3><p>已同步收入乾坤行囊及玄火丹炉材料库存。</p></> : <div className="mining-empty-result"><b>矿</b><p>落镐后，此处会展示本次矿物与产量。</p></div>}<footer><p>{message}</p><button type="button" onClick={onClose}>{exhausted ? "返回山河图" : "暂离矿脉"}</button></footer></aside>
    </div>
  </section></div>;
}
