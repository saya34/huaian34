"use client";

import { useMemo, useState } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import type { Period } from "../types";
import {
  HERB_CROPS,
  FERTILIZERS,
  craftFertilizer,
  cropById,
  cropMaterial,
  farmLevel,
  farmLevelProgress,
  fertilizePlot,
  gameTick,
  getFarmWeather,
  getFarmEvent,
  harvestPlot,
  plantPlot,
  plotGrowth,
  supportedPlotCount,
  unlockedPlotCount,
  upgradeSpiritWell,
  upgradeFarmTool,
  waterPlot,
  type FertilizerId,
  type HerbCropId,
} from "./farm";
import LivestockPanel from "./LivestockPanel";
import { SPIRIT_BEASTS } from "./livestock";

type Props = { day: number; period: Period; onNotice: (message: string) => void; initialView?: "field" | "livestock"; onClose?: () => void };

export default function SpiritFarmPanel({ day, period, onNotice, initialView = "field", onClose }: Props) {
  const { state, setFarm, applyEffects } = useUnifiedGame();
  const [selectedCropId, setSelectedCropId] = useState<HerbCropId>("frost-heart");
  const [message, setMessage] = useState("选中灵种后直接点击空田播种；成熟后再次点击即可收获。仙草只随游戏内时辰成长。");
  const [plotFx, setPlotFx] = useState<{ id: string; kind: "plant" | "harvest" | "fertilize" } | null>(null);
  const [floatingInfo, setFloatingInfo] = useState<{ id: string; text: string; tone: "green" | "gold" | "blue" } | null>(null);
  const [toolMode, setToolMode] = useState<"inspect" | "water" | "fertilize">("inspect");
  const [selectedFertilizer, setSelectedFertilizer] = useState<FertilizerId>("rapid-root");
  const [livestockOpen, setLivestockOpen] = useState(initialView === "livestock");
  const tick = gameTick(day, period);
  const weather = getFarmWeather(day);
  const farmEvent = getFarmEvent(day);
  const farm = state.farm;
  const levelProfile = farmLevelProgress(farm.experience);
  const level = levelProfile.level;
  const unlockedPlots = unlockedPlotCount(level);
  const supportedPlots = supportedPlotCount(farm.wellLevel);
  const selectedCrop = cropById(selectedCropId);
  const visibleCrops = HERB_CROPS.filter((crop) => crop.stockType === "resident" || (farm.seeds[crop.id] ?? 0) > 0);

  const readyCount = useMemo(() => farm.plots.filter((plot) => plotGrowth(plot, tick, weather).ready).length, [farm.plots, tick, weather]);
  const growingCount = farm.plots.filter((plot) => plot.cropId && !plotGrowth(plot, tick, weather).ready).length;

  function announce(copy: string) {
    setMessage(copy);
    onNotice(copy);
  }

  function pulsePlot(id: string, kind: "plant" | "harvest" | "fertilize") {
    setPlotFx({ id, kind });
    window.setTimeout(() => setPlotFx((current) => current?.id === id ? null : current), 720);
  }

  function floatPlot(id: string, text: string, tone: "green" | "gold" | "blue") {
    setFloatingInfo({ id, text, tone });
    window.setTimeout(() => setFloatingInfo((current) => current?.id === id ? null : current), 1150);
  }

  function plant(plotId: string) {
    const result = plantPlot(farm, plotId, selectedCropId, tick);
    if (!result.ok) { setMessage(result.message); return; }
    setFarm(result.farm); pulsePlot(plotId, "plant"); floatPlot(plotId, `播种 · ${selectedCrop.materialName}`, "green"); announce(`${result.message} · ${selectedCrop.growTicks} 时辰内成熟`);
  }

  function fertilize(plotId: string) {
    const result = fertilizePlot(farm, plotId, selectedFertilizer);
    if (!result.ok) { setMessage(result.message); return; }
    setFarm(result.farm); pulsePlot(plotId, "fertilize"); floatPlot(plotId, `${FERTILIZERS[selectedFertilizer].name} -1`, "blue"); announce(result.message);
  }

  function water(plotId: string) {
    const result = waterPlot(farm, plotId, day);
    if (!result.ok) { setMessage(result.message); return; }
    setFarm(result.farm); pulsePlot(plotId, "fertilize"); floatPlot(plotId, "灵泉润畦 · 生长加速", "blue"); announce(result.message);
  }

  function harvest(plotId: string) {
    const result = harvestPlot(farm, plotId, tick, day);
    if (!result.ok) { setMessage(result.message); return; }
    setFarm(result.farm); pulsePlot(plotId, "harvest"); floatPlot(plotId, result.message, "gold");
    applyEffects([{ type: "add_item", item: result.reward }, { type: "add_player_exp", amount: Math.max(1, Math.floor(result.experience / 2)) }]);
    announce(`${result.message} · 灵圃经验 +${result.experience}`);
  }

  function interactPlot(plotId: string) {
    const plot = farm.plots.find((entry) => entry.id === plotId);
    if (!plot?.cropId) { plant(plotId); return; }
    if (plotGrowth(plot, tick, weather).ready) { harvest(plotId); return; }
    if (toolMode === "water") { water(plotId); return; }
    if (toolMode === "fertilize") { fertilize(plotId); return; }
    const growth = plotGrowth(plot, tick, weather);
    const copy = `成长 ${Math.round(growth.progress)}% · 尚余 ${growth.remaining} 时辰`;
    setMessage(`这畦正在生长，尚余 ${growth.remaining} 个游戏时辰。`); floatPlot(plotId, copy, "green");
  }

  function bulkPlant() {
    let next = farm;
    let count = 0;
    for (const plot of farm.plots.slice(0, unlockedPlots)) {
      if (plot.cropId) continue;
      const result = plantPlot(next, plot.id, selectedCropId, tick);
      if (!result.ok) break;
      next = result.farm; count += 1;
    }
    if (!count) { setMessage(`${selectedCrop.seedName}不足，或暂无空田。`); return; }
    setFarm(next); announce(`连作完成 · 种下${selectedCrop.materialName} ${count} 畦`);
  }

  function upgradeWell() {
    const cost = farm.wellLevel * 160;
    if (state.shared.spiritStones < cost) { setMessage(`疏浚灵泉需要 ${cost} 灵石。`); return; }
    const result = upgradeSpiritWell(farm, day);
    if (!result.ok) { setMessage(result.message); return; }
    setFarm(result.farm); applyEffects([{ type: "add_currency", amount: -cost }]); announce(`${result.message} · 灵石 -${cost}`);
  }

  function improveFarmTool() {
    const cost = farm.toolLevel * 220;
    if (state.shared.spiritStones < cost) { setMessage(`蕴养青木灵锄需要 ${cost} 灵石。`); return; }
    const result = upgradeFarmTool(farm); if (!result.ok) { setMessage(result.message); return; }
    setFarm(result.farm); applyEffects([{ type: "add_currency", amount: -cost }]); announce(`${result.message} · 灵石 -${cost}`);
  }

  function bulkHarvest() {
    let next = farm;
    let count = 0;
    let experience = 0;
    const rewards = new Map<string, ReturnType<typeof harvestPlot> & { ok: true }>();
    for (const plot of farm.plots) {
      const result = harvestPlot(next, plot.id, tick, day);
      if (!result.ok) continue;
      next = result.farm; count += result.reward.amount; experience += result.experience;
      const previous = rewards.get(result.reward.itemId);
      rewards.set(result.reward.itemId, previous ? { ...result, reward: { ...result.reward, amount: previous.reward.amount + result.reward.amount } } : result);
    }
    if (!count) { setMessage("目前没有已经成熟的仙草。"); return; }
    setFarm(next);
    applyEffects([...rewards.values().map((result) => ({ type: "add_item" as const, item: result.reward })), { type: "add_player_exp", amount: Math.max(1, Math.floor(experience / 2)) }]);
    announce(`一键收获 · 仙草 ${count} 株 · 灵圃经验 +${experience}`);
  }

  function gatherDew() {
    if (farm.lastDewDay === day) { setMessage("今日已经凝露培土，明日再来。 "); return; }
    if (state.shared.stamina < 1) { setMessage("凝露培土需要 1 点体力。 "); return; }
    setFarm((current) => ({ ...current, spiritSoil: current.spiritSoil + 2, lastDewDay: day }));
    applyEffects([{ type: "spend_stamina", amount: 1 }]);
    announce("凝露培土完成 · 灵壤 +2 · 体力 -1");
  }

  function refineFertilizer(id: FertilizerId) {
    const result = craftFertilizer(farm, id);
    if (!result.ok) { setMessage(result.message); return; }
    setFarm(result.farm); setSelectedFertilizer(id); setToolMode("fertilize"); announce(result.message);
  }

  function compostBeastProduce() {
    const product = SPIRIT_BEASTS.map((beast) => ({ beast, stack: state.shared.items[beast.productId] })).find((entry) => (entry.stack?.amount ?? 0) > 0);
    if (!product?.stack) { setMessage("需要一份灵兽产物才能调制丰穗灵壤。 "); return; }
    applyEffects([{ type: "remove_item", itemId: product.beast.productId, amount: 1 }]);
    setFarm((current) => ({ ...current, fertilizers: { ...current.fertilizers, "bounty-soil": current.fertilizers["bounty-soil"] + 2 } }));
    setSelectedFertilizer("bounty-soil"); setToolMode("fertilize"); announce(`${product.beast.productName}化入沃土 · 丰穗灵壤 +2`);
  }

  if (livestockOpen) return <LivestockPanel day={day} period={period} onBack={() => setLivestockOpen(false)} onClose={onClose} onNotice={onNotice} />;

  return <section className="spirit-farm-panel" aria-label="云岫灵圃">
    <header className="farm-status-bar">
      <div><small>HERBAL CULTIVATION · 云岫灵圃</small><h3>灵田 · 灵兽苑</h3></div>
      <nav className="farm-scene-tabs"><button type="button" className="active">灵田十二畦</button><button type="button" onClick={() => setLivestockOpen(true)}>灵兽苑</button></nav>
      <div className="farm-weather"><i>{weather.icon}</i><span><small>{farmEvent.icon} {farmEvent.name}</small><strong>{weather.name}</strong><em>{farmEvent.description}</em></span></div>
      <div className="farm-level"><span>灵圃 {level} 阶</span><b>{farm.experience} 修圃经验</b><i><u style={{ width: `${levelProfile.percentage}%` }} /></i><small>下阶 {levelProfile.current}/{levelProfile.needed}</small></div>
      {onClose && <button type="button" className="farm-panel-close" onClick={onClose} aria-label="返回灵圃场景">×</button>}
    </header>

    <div className="farm-main-grid farm-world-layout">
      <aside className="farm-seed-rack">
        <header><span>种匣</span><small>灵种请向叶青禾购买</small></header>
        <div className="farm-seed-list">{visibleCrops.map((crop) => {
          const material = cropMaterial(crop); const locked = level < crop.unlockLevel;
          return <button type="button" key={crop.id} className={`${selectedCropId === crop.id ? "active" : ""} ${locked ? "locked" : ""}`} disabled={locked} onClick={() => setSelectedCropId(crop.id)}>
            <img src={material.image} alt="" /><span><strong>{crop.seedName}</strong><small>{locked ? `${crop.unlockLevel}阶解锁` : `${crop.growTicks}时辰 · ${crop.element}行`}</small></span><b>{farm.seeds[crop.id]}</b>
          </button>;
        })}</div>
      </aside>

      <div className="farm-field-wrap">
        <div className="farm-world-decor" aria-hidden="true"><i className="farm-mountain"/><i className="farm-stream"/><i className="farm-pavilion"/><span className="farm-fireflies"><b/><b/><b/><b/></span></div>
        <div className="farm-field-head"><span>已成熟 <b>{readyCount}</b></span><span>生长中 <b>{growingCount}</b></span><span>灵泉润养 <b>{supportedPlots}/{unlockedPlots} 畦</b></span><span>灵壤 <b>{farm.spiritSoil}</b></span></div>
        <div className="farm-tool-dock" aria-label="灵田工具">
          <button type="button" className={toolMode === "inspect" ? "active" : ""} onClick={() => setToolMode("inspect")}><i>察</i><span>察看与收获</span></button>
          <button type="button" className={toolMode === "water" ? "active" : ""} onClick={() => setToolMode("water")}><i>泉</i><span>引灵泉浇灌</span></button>
          <button type="button" className={toolMode === "fertilize" ? "active" : ""} onClick={() => setToolMode("fertilize")}><i>{FERTILIZERS[selectedFertilizer].icon}</i><span>{FERTILIZERS[selectedFertilizer].name}</span></button>
          <button type="button" disabled={farm.toolLevel >= 3} onClick={improveFarmTool}><i>锄</i><span>{farm.toolLevel}阶 · 蕴养</span></button>
        </div>
        <div className="farm-plots">{farm.plots.map((plot, index) => {
          const locked = index >= unlockedPlots;
          const unsupported = !locked && index >= supportedPlots;
          const crop = plot.cropId ? cropById(plot.cropId) : null;
          const material = crop ? cropMaterial(crop) : null;
          const growth = plotGrowth(plot, tick, weather);
          const stage = growth.ready ? "ready" : growth.progress >= 65 ? "almost" : growth.progress >= 25 ? "sprout" : "seedling";
          return <button type="button" key={plot.id} className={`farm-plot ${locked ? "locked" : ""} ${unsupported ? "unsupported" : ""} ${plot.cropId ? stage : "empty"} ${plot.watered ? "watered" : ""} ${plot.fertilized ? "fertilized" : ""} ${plotFx?.id === plot.id ? `fx-${plotFx.kind}` : ""}`} disabled={locked || unsupported} onClick={() => interactPlot(plot.id)} aria-label={locked ? `第${index + 1}畦未解锁` : unsupported ? `第${index + 1}畦等待灵泉覆盖` : crop ? `${crop.materialName}，${growth.ready ? "已成熟" : `还需${growth.remaining}时辰`}` : `第${index + 1}畦空田`}>
            <span className="farm-soil-lines" />
            {locked ? <span className="farm-lock"><b>封</b><small>{farmLevel(farm.experience) + 1}阶拓地</small></span> : crop && material ? <>
              <img src={material.image} alt="" style={{ "--crop-progress": Math.max(24, growth.progress), "--crop-color": crop.color } as React.CSSProperties} />
              <span className="farm-crop-label"><strong>{crop.materialName}</strong><small>{growth.ready ? "灵光盈枝 · 可收获" : `${stage === "seedling" ? "初芽" : stage === "sprout" ? "抽叶" : "将熟"} · 尚余 ${growth.remaining} 时辰`}</small></span>
              <span className="farm-crop-progress"><i style={{ width: `${growth.progress}%` }} /></span>
              <span className="farm-plot-buffs">{plot.watered && <i>泉</i>}{plot.fertilized && <i>{plot.fertilizerId ? FERTILIZERS[plot.fertilizerId].icon : "沃"}</i>}</span>
              {floatingInfo?.id === plot.id && <span className={`farm-floating-info ${floatingInfo.tone}`}>{floatingInfo.text}</span>}
            </> : unsupported ? <span className="farm-lock"><b>涸</b><small>疏浚灵泉后覆盖</small></span> : <><span className="farm-empty-mark"><b>＋</b><small>播种{selectedCrop.materialName}</small></span>{floatingInfo?.id === plot.id && <span className={`farm-floating-info ${floatingInfo.tone}`}>{floatingInfo.text}</span>}</>}
          </button>;
        })}</div>
      </div>

      <aside className="farm-actions">
        <div className="farm-selected-crop"><img src={cropMaterial(selectedCrop).image} alt="" /><span><small>当前灵种</small><strong>{selectedCrop.materialName}</strong><em>{selectedCrop.lore}</em></span></div>
        <button type="button" onClick={bulkPlant}><i>耕</i><span><strong>连作空田</strong><small>按现有种子连续播种</small></span></button>
        <button type="button" disabled={farm.wellLevel >= 3 || farm.wellUpgradedDay === day} onClick={upgradeWell}><i>泉</i><span><strong>疏浚灵泉 · {farm.wellLevel}阶</strong><small>{farm.wellLevel >= 3 ? "已覆盖全部灵田" : `◉ ${farm.wellLevel * 160} · 扩展润养容量`}</small></span></button>
        <button type="button" className={readyCount ? "harvest-ready" : ""} onClick={bulkHarvest}><i>收</i><span><strong>一键收获</strong><small>{readyCount ? `${readyCount} 畦已成熟` : "暂无成熟仙草"}</small></span></button>
        <button type="button" disabled={farm.lastDewDay === day} onClick={gatherDew}><i>露</i><span><strong>凝露培土</strong><small>{farm.lastDewDay === day ? "今日已完成" : "体力 -1 · 灵壤 +2"}</small></span></button>
        <div className="fertilizer-wheel" aria-label="灵壤炼制">{(Object.keys(FERTILIZERS) as FertilizerId[]).map((id) => <button type="button" key={id} className={selectedFertilizer === id ? "active" : ""} onClick={() => { if (selectedFertilizer === id && toolMode === "fertilize") refineFertilizer(id); else { setSelectedFertilizer(id); setToolMode("fertilize"); } }}><i>{FERTILIZERS[id].icon}</i><strong>{FERTILIZERS[id].name}</strong><small>持有 {farm.fertilizers[id]} · 再点炼制</small></button>)}<button type="button" onClick={compostBeastProduce}><i>融</i><strong>灵兽沃土</strong><small>消耗产物 · 丰穗灵壤 +2</small></button></div>
      </aside>
    </div>

    <footer className="farm-message"><span>圃</span><p>{message}</p><b>第 {day} 日 · {period} · 时序 {tick + 1}</b></footer>
  </section>;
}
