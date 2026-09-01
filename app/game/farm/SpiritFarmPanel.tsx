"use client";

import { useMemo, useState } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import type { Period } from "../types";
import {
  DAILY_WATER_CHARGES,
  HERB_CROPS,
  cropById,
  cropMaterial,
  farmLevel,
  farmLevelProgress,
  fertilizePlot,
  gameTick,
  getFarmWeather,
  harvestPlot,
  plantPlot,
  plotGrowth,
  unlockedPlotCount,
  waterPlot,
  type HerbCropId,
} from "./farm";
import LivestockPanel from "./LivestockPanel";

type Props = { day: number; period: Period; onNotice: (message: string) => void };

export default function SpiritFarmPanel({ day, period, onNotice }: Props) {
  const { state, setFarm, applyEffects } = useUnifiedGame();
  const [selectedCropId, setSelectedCropId] = useState<HerbCropId>("frost-heart");
  const [message, setMessage] = useState("选中种子后点击空田播种；生长期点击田块可浇灌。仙草按游戏内时辰成长。");
  const [seedShopOpen, setSeedShopOpen] = useState(false);
  const [livestockOpen, setLivestockOpen] = useState(false);
  const tick = gameTick(day, period);
  const weather = getFarmWeather(day);
  const farm = state.farm;
  const levelProfile = farmLevelProgress(farm.experience);
  const level = levelProfile.level;
  const unlockedPlots = unlockedPlotCount(level);
  const waterUsed = farm.waterDay === day ? farm.waterUsed : 0;
  const selectedCrop = cropById(selectedCropId);

  const readyCount = useMemo(() => farm.plots.filter((plot) => plotGrowth(plot, tick, weather).ready).length, [farm.plots, tick, weather]);
  const growingCount = farm.plots.filter((plot) => plot.cropId && !plotGrowth(plot, tick, weather).ready).length;

  function announce(copy: string) {
    setMessage(copy);
    onNotice(copy);
  }

  function plant(plotId: string) {
    const result = plantPlot(farm, plotId, selectedCropId, tick);
    if (!result.ok) { setMessage(result.message); return; }
    setFarm(result.farm); announce(`${result.message} · ${selectedCrop.growTicks} 时辰内成熟`);
  }

  function water(plotId: string) {
    const result = waterPlot(farm, plotId, day);
    if (!result.ok) { setMessage(result.message); return; }
    setFarm(result.farm); announce(result.message);
  }

  function fertilize(plotId: string) {
    const result = fertilizePlot(farm, plotId);
    if (!result.ok) { setMessage(result.message); return; }
    setFarm(result.farm); announce(result.message);
  }

  function harvest(plotId: string) {
    const result = harvestPlot(farm, plotId, tick, day);
    if (!result.ok) { setMessage(result.message); return; }
    setFarm(result.farm);
    applyEffects([{ type: "add_item", item: result.reward }, { type: "add_player_exp", amount: Math.max(1, Math.floor(result.experience / 2)) }]);
    announce(`${result.message} · 灵圃经验 +${result.experience}`);
  }

  function interactPlot(plotId: string) {
    const plot = farm.plots.find((entry) => entry.id === plotId);
    if (!plot?.cropId) { plant(plotId); return; }
    if (plotGrowth(plot, tick, weather).ready) { harvest(plotId); return; }
    water(plotId);
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

  function bulkWater() {
    let next = farm;
    let count = 0;
    for (const plot of farm.plots.slice(0, unlockedPlots)) {
      if (!plot.cropId || plot.watered || plotGrowth(plot, tick, weather).ready) continue;
      const result = waterPlot(next, plot.id, day);
      if (!result.ok) break;
      next = result.farm; count += 1;
    }
    if (!count) { setMessage("没有可浇灌的作物，或今日灵泉水已经用尽。"); return; }
    setFarm(next); announce(`引泉成渠 · 一次浇灌 ${count} 畦`);
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

  function buySeeds(cropId: HerbCropId, quantity: number) {
    const crop = cropById(cropId);
    const cost = crop.seedPrice * quantity;
    if (level < crop.unlockLevel) { setMessage(`灵圃达到 ${crop.unlockLevel} 阶后开放${crop.seedName}`); return; }
    if (state.shared.spiritStones < cost) { setMessage(`灵石不足，还差 ${cost - state.shared.spiritStones} 枚。`); return; }
    setFarm((current) => ({ ...current, seeds: { ...current.seeds, [cropId]: current.seeds[cropId] + quantity } }));
    applyEffects([{ type: "add_currency", amount: -cost }]);
    announce(`购得${crop.seedName} ×${quantity} · 灵石 -${cost}`);
  }

  function gatherDew() {
    if (farm.lastDewDay === day) { setMessage("今日已经凝露培土，明日再来。 "); return; }
    if (state.shared.stamina < 1) { setMessage("凝露培土需要 1 点体力。 "); return; }
    setFarm((current) => ({ ...current, spiritSoil: current.spiritSoil + 2, lastDewDay: day }));
    applyEffects([{ type: "spend_stamina", amount: 1 }]);
    announce("凝露培土完成 · 灵壤 +2 · 体力 -1");
  }

  if (livestockOpen) return <LivestockPanel day={day} period={period} onBack={() => setLivestockOpen(false)} onNotice={onNotice} />;

  return <section className="spirit-farm-panel" aria-label="云岫灵圃">
    <header className="farm-status-bar">
      <div><small>HERBAL CULTIVATION · 云岫灵圃</small><h3>灵田 · 灵兽苑</h3></div>
      <nav className="farm-scene-tabs"><button type="button" className="active">灵田十二畦</button><button type="button" onClick={() => setLivestockOpen(true)}>灵兽苑</button></nav>
      <div className="farm-weather"><i>{weather.icon}</i><span><small>今日天时</small><strong>{weather.name}</strong><em>{weather.description}</em></span></div>
      <div className="farm-level"><span>灵圃 {level} 阶</span><b>{farm.experience} 修圃经验</b><i><u style={{ width: `${levelProfile.percentage}%` }} /></i><small>下阶 {levelProfile.current}/{levelProfile.needed}</small></div>
    </header>

    <div className="farm-main-grid">
      <aside className="farm-seed-rack">
        <header><span>种匣</span><button type="button" onClick={() => setSeedShopOpen((value) => !value)}>{seedShopOpen ? "收起" : "购种"}</button></header>
        <div className="farm-seed-list">{HERB_CROPS.map((crop) => {
          const material = cropMaterial(crop); const locked = level < crop.unlockLevel;
          return <button type="button" key={crop.id} className={`${selectedCropId === crop.id ? "active" : ""} ${locked ? "locked" : ""}`} disabled={locked} onClick={() => setSelectedCropId(crop.id)}>
            <img src={material.image} alt="" /><span><strong>{crop.seedName}</strong><small>{locked ? `${crop.unlockLevel}阶解锁` : `${crop.growTicks}时辰 · ${crop.element}行`}</small></span><b>{farm.seeds[crop.id]}</b>
          </button>;
        })}</div>
        {seedShopOpen && <div className="farm-seed-shop"><p>灵种铺 · 今日常备</p>{HERB_CROPS.map((crop) => <article key={crop.id}><span><strong>{crop.seedName}</strong><small>◉ {crop.seedPrice}/枚</small></span><button disabled={level < crop.unlockLevel} onClick={() => buySeeds(crop.id, 1)}>买1</button><button disabled={level < crop.unlockLevel} onClick={() => buySeeds(crop.id, 5)}>买5</button></article>)}</div>}
      </aside>

      <div className="farm-field-wrap">
        <div className="farm-field-head"><span>已成熟 <b>{readyCount}</b></span><span>生长中 <b>{growingCount}</b></span><span>灵泉 <b>{DAILY_WATER_CHARGES - waterUsed}/{DAILY_WATER_CHARGES}</b></span><span>灵壤 <b>{farm.spiritSoil}</b></span></div>
        <div className="farm-plots">{farm.plots.map((plot, index) => {
          const locked = index >= unlockedPlots;
          const crop = plot.cropId ? cropById(plot.cropId) : null;
          const material = crop ? cropMaterial(crop) : null;
          const growth = plotGrowth(plot, tick, weather);
          const stage = growth.ready ? "ready" : growth.progress >= 65 ? "almost" : growth.progress >= 25 ? "sprout" : "seedling";
          return <button type="button" key={plot.id} className={`farm-plot ${locked ? "locked" : ""} ${plot.cropId ? stage : "empty"} ${plot.watered ? "watered" : ""} ${plot.fertilized ? "fertilized" : ""}`} disabled={locked} onClick={() => interactPlot(plot.id)} aria-label={locked ? `第${index + 1}畦未解锁` : crop ? `${crop.materialName}，${growth.ready ? "已成熟" : `还需${growth.remaining}时辰`}` : `第${index + 1}畦空田`}>
            <span className="farm-soil-lines" />
            {locked ? <span className="farm-lock"><b>封</b><small>{farmLevel(farm.experience) + 1}阶拓地</small></span> : crop && material ? <>
              <img src={material.image} alt="" style={{ "--crop-scale": Math.min(1, .58 + Math.max(24, growth.progress) / 240), "--crop-saturation": Math.min(1.35, .55 + Math.max(24, growth.progress) / 130), "--crop-color": crop.color } as React.CSSProperties} />
              <span className="farm-crop-label"><strong>{crop.materialName}</strong><small>{growth.ready ? "灵光盈枝 · 可收获" : `${stage === "seedling" ? "初芽" : stage === "sprout" ? "抽叶" : "将熟"} · 尚余 ${growth.remaining} 时辰`}</small></span>
              <span className="farm-crop-progress"><i style={{ width: `${growth.progress}%` }} /></span>
              <span className="farm-plot-buffs">{(plot.watered || weather.id === "spirit-rain") && <i>润</i>}{plot.fertilized && <i>沃</i>}</span>
              {!plot.fertilized && !growth.ready && <span role="button" tabIndex={0} className="farm-fertilize" onClick={(event) => { event.stopPropagation(); fertilize(plot.id); }}>壤</span>}
            </> : <span className="farm-empty-mark"><b>＋</b><small>播种{selectedCrop.materialName}</small></span>}
          </button>;
        })}</div>
      </div>

      <aside className="farm-actions">
        <div className="farm-selected-crop"><img src={cropMaterial(selectedCrop).image} alt="" /><span><small>当前灵种</small><strong>{selectedCrop.materialName}</strong><em>{selectedCrop.lore}</em></span></div>
        <button type="button" onClick={bulkPlant}><i>耕</i><span><strong>连作空田</strong><small>按现有种子连续播种</small></span></button>
        <button type="button" onClick={bulkWater}><i>引</i><span><strong>引泉成渠</strong><small>批量浇灌生长作物</small></span></button>
        <button type="button" className={readyCount ? "harvest-ready" : ""} onClick={bulkHarvest}><i>收</i><span><strong>一键收获</strong><small>{readyCount ? `${readyCount} 畦已成熟` : "暂无成熟仙草"}</small></span></button>
        <button type="button" disabled={farm.lastDewDay === day} onClick={gatherDew}><i>露</i><span><strong>凝露培土</strong><small>{farm.lastDewDay === day ? "今日已完成" : "体力 -1 · 灵壤 +2"}</small></span></button>
      </aside>
    </div>

    <footer className="farm-message"><span>圃</span><p>{message}</p><b>第 {day} 日 · {period} · 时序 {tick + 1}</b></footer>
  </section>;
}
