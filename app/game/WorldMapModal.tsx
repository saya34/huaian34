"use client";

import { useMemo, useState } from "react";
import { WORLD_MAP_BY_ID, WORLD_MAPS, type WorldMapId } from "./world-maps";
import type { EventDefinition, Period, SceneId } from "./types";
import { DUNGEONS, type DungeonDefinition } from "./core/dungeons";
import { useUnifiedGame } from "./core/UnifiedGameProvider";
import { ITEM_TABLE, MATERIALS } from "./alchemy/item-data";

type Props = {
  sceneId: SceneId;
  sceneEventHints: Set<SceneId>;
  mapEvents: EventDefinition[];
  period: Period;
  day: number;
  inspectionHints: Set<SceneId>;
  inspectionDays: Record<SceneId, number>;
  onClose: () => void;
  onEnterScene: (sceneId: SceneId) => void;
  onTriggerMapEvent: (eventId: string) => void;
  onInspectScene: (sceneId: SceneId) => void;
  onEnterDungeon?: (dungeon: DungeonDefinition) => void;
  onEnterAlchemy?: () => void;
};

export default function WorldMapModal({ sceneId, sceneEventHints, mapEvents, period, day, inspectionHints, inspectionDays, onClose, onEnterScene, onTriggerMapEvent, onInspectScene, onEnterDungeon, onEnterAlchemy }: Props) {
  const { state } = useUnifiedGame();
  const [currentMapId, setCurrentMapId] = useState<WorldMapId>("yunzhou");
  const [notice, setNotice] = useState("");
  const [inspectionMode,setInspectionMode]=useState(false);
  const [selectedDungeon, setSelectedDungeon] = useState<DungeonDefinition | null>(null);
  const map = WORLD_MAP_BY_ID[currentMapId];
  const visibleMapEvents = mapEvents.filter((event) => event.mapEvent?.mapId === currentMapId);
  const mapDungeons = DUNGEONS.filter((dungeon) => dungeon.regionId === currentMapId);
  const rewardPool = useMemo(() => MATERIALS.slice(0, 36), []);

  function dungeonIsVisible(dungeon: DungeonDefinition) {
    if (dungeon.kind === "permanent") return true;
    const localIndex = (dungeon.waveId - 1) % 7;
    if (state.dungeons.randomVisible.includes(dungeon.id)) return true;
    if (localIndex === 4) return state.shared.cards.length >= 2;
    if (localIndex === 5) return state.alchemy.characterCards.length > 0;
    return state.dungeons.completed.includes(Math.max(1, dungeon.waveId - 3));
  }

  function dungeonRewards(dungeon: DungeonDefinition) {
    return [0, 9, 19].map((offset) => rewardPool[(dungeon.waveId * 3 + offset) % rewardPool.length] ?? ITEM_TABLE[0]);
  }

  function choose(location: (typeof map.locations)[number]) {
    if (location.targetMapId) {
      const firstWave = WORLD_MAPS.findIndex((entry) => entry.id === location.targetMapId) * 7 + 1;
      if (firstWave > state.dungeons.highestUnlocked) { setNotice(`${WORLD_MAP_BY_ID[location.targetMapId].name}尚被灵障封锁，请先推进区域主线。`); return; }
      setCurrentMapId(location.targetMapId); setNotice(""); return;
    }
    if (!location.unlocked || !location.sceneId) { setNotice(`${location.name}尚未解锁，待后续章节开放。`); return; }
    if(inspectionMode){
      if(period!=="夜晚"){setNotice("检视只能在夜晚进行。请先推移到夜晚。");return}
      if(inspectionDays[location.sceneId]===day){setNotice(`${location.name}今日已经检视过了。`);return}
      onClose();onInspectScene(location.sceneId);return;
    }
    onClose(); onEnterScene(location.sceneId);
  }

  return <div className="world-map-backdrop" role="presentation" onMouseDown={onClose}><section className="world-map-shell" role="dialog" aria-modal="true" aria-label="山河地图" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><small>WORLD ATLAS · 山河图</small><h2>{map.name}</h2><p>{map.subtitle}</p></div><button type="button" onClick={onClose} aria-label="关闭地图">×</button></header>
    <div className="world-map-canvas" style={{ backgroundImage: `url(${map.image})` }}>
      <div className="world-map-shade" />
      {map.locations.filter((location) => !inspectionMode || Boolean(location.sceneId && inspectionHints.has(location.sceneId))).map((location) => {
        const active = Boolean(location.sceneId && location.sceneId === sceneId);
        const hasSceneEvent = Boolean(location.sceneId && sceneEventHints.has(location.sceneId));
        const hasInspectionHint=Boolean(location.sceneId&&inspectionHints.has(location.sceneId));
        const inspected=Boolean(location.sceneId&&inspectionDays[location.sceneId]===day);
        return <button type="button" key={location.id} className={`map-location ${location.unlocked ? "unlocked" : "locked"} ${location.targetMapId ? "map-gate" : ""} ${active ? "current" : ""} ${inspectionMode?"inspection-mode":""} ${inspected?"inspected":""}`} style={{ left: `${location.x}%`, top: `${location.y}%` }} onClick={() => choose(location)}>
          <span className="map-location-pulse"><b>{location.unlocked ? location.icon : "锁"}</b></span>
          {hasSceneEvent && <span className="map-scene-event-signal" title="此处有可触发事件" aria-label="此处有可触发事件">?</span>}
          {hasInspectionHint&&<span className="map-inspection-signal" title="此处有可提示的检视事件" aria-label="此处有检视线索">眼</span>}
          <em><strong>{location.name}</strong><small>{active ? "当前所在" : location.subtitle}</small></em>
        </button>;
      })}
      {!inspectionMode && currentMapId === "yunzhou" && <button type="button" className="map-system-location alchemy-location" style={{ left: "79%", top: "24%" }} onClick={() => onEnterAlchemy?.()}>
        <span className="system-location-art"><img src="/assets/xuanhuo-furnace.webp" alt="" /></span>
        <em><strong>玄火丹炉</strong><small>炼丹 · 委托 · 太虚显化</small></em><b>炉</b>
      </button>}
      {!inspectionMode && mapDungeons.filter(dungeonIsVisible).map((dungeon) => {
        const locked = dungeon.kind === "permanent" && dungeon.waveId > state.dungeons.highestUnlocked;
        return <button type="button" key={dungeon.id} className={`map-dungeon-location ${dungeon.kind} ${locked ? "locked" : ""}`} style={{ left: `${dungeon.x}%`, top: `${dungeon.y}%` }} disabled={locked} onClick={() => setSelectedDungeon(dungeon)}>
          <span><b>{dungeon.kind === "random" ? "?" : dungeon.waveId}</b><i /></span>
          <em><strong>{dungeon.name}</strong><small>{locked ? "前置秘境未镇压" : dungeon.kind === "random" ? "异闻秘境 · 本轮显现" : `常驻秘境 · 战力 ${dungeon.recommendedPower}`}</small></em>
        </button>;
      })}
      {!inspectionMode && visibleMapEvents.map((event, index) => <button type="button" key={event.id} className="map-event-cursor" style={{ left: `${event.mapEvent!.x}%`, top: `${event.mapEvent!.y}%`, "--event-delay": `${index * .18}s` } as React.CSSProperties} onClick={() => { onClose(); onTriggerMapEvent(event.id); }} aria-label={`触发地图事件：${event.title}`}>
        <span className="map-event-flare"><b>!</b><i /></span><em><strong>{event.title}</strong><small>待解异闻 · 完成前持续驻留</small></em>
      </button>)}
      <div className="map-compass"><i>北</i><span>✦</span><i>南</i></div>
    </div>
    {!inspectionMode && selectedDungeon && <aside className="dungeon-brief" aria-label={`${selectedDungeon.name}战前情报`}>
      <button className="dungeon-brief-close" type="button" onClick={() => setSelectedDungeon(null)} aria-label="收起秘境情报">×</button>
      <div className="dungeon-brief-visual" style={{ backgroundImage: `url(${map.image})` }}><span>{selectedDungeon.kind === "random" ? "异闻" : `第${selectedDungeon.waveId}境`}</span><b>{selectedDungeon.kind === "random" ? "?" : selectedDungeon.waveId}</b></div>
      <div className="dungeon-brief-copy">
        <small>{map.name} · 灵脉重叠区</small><h3>{selectedDungeon.name}</h3>
        <p>{selectedDungeon.kind === "random" ? "入口只在本轮异象中短暂显现，安全带回的线索可能牵动人物旧事。" : "妖潮沿灵脉分作数阵，镇压后可继续深入本域，并将时辰推进至下一阶段。"}</p>
        <div className="dungeon-facts"><span><small>推荐战力</small><strong>{selectedDungeon.recommendedPower}</strong></span><span><small>预计历练</small><strong>约 4 分钟</strong></span><span><small>结算代价</small><strong>推进时辰</strong></span></div>
        <section className="dungeon-loadout"><header><span>本次战斗快照</span><b>入境后锁定</b></header><div><span>主角 Lv.{state.shared.playerLevel}</span><span>已习 {state.shared.learnedSkills.length} 法</span><span>人物卡 {state.shared.cards.length} 张</span><span>体力 {state.shared.stamina}/10</span></div></section>
        <section className="dungeon-rewards"><header><span>可能带回</span><small>失败时仅保险匣物品保留</small></header><div>{dungeonRewards(selectedDungeon).map((item) => <article key={item.id}><img src={item.image} alt="" /><span><strong>{item.name}</strong><small>{item.category} · {item.quality}</small></span></article>)}</div></section>
        <button type="button" className="enter-dungeon-button" onClick={() => onEnterDungeon?.(selectedDungeon)}><span>确认战斗配置</span><strong>踏 入 秘 境</strong></button>
      </div>
    </aside>}
    <footer><div className="world-map-tabs">{WORLD_MAPS.map((item, index) => { const locked = index * 7 + 1 > state.dungeons.highestUnlocked; return <button type="button" key={item.id} className={item.id === currentMapId ? "active" : ""} disabled={locked} onClick={() => { setCurrentMapId(item.id); setNotice(""); }}><span>{item.id === "yunzhou" ? "壹" : item.id === "canglan" ? "贰" : "叁"}</span>{locked ? `${item.name}·未启` : item.name}</button>; })}</div><button type="button" className={`inspection-toggle ${inspectionMode?"active":""}`} onClick={()=>{if(period!=="夜晚"){setNotice("检视只能在夜晚进行。请先推移到夜晚。");return}setSelectedDungeon(null);setInspectionMode(value=>!value);setNotice(inspectionMode?"已退出检视模式":"检视模式已开启：地图仅显现本夜确有异动之处")}}><span>眼</span>{inspectionMode?"退出检视":"夜间检视"}</button><p>{notice || (inspectionMode?(inspectionHints.size ? `神识捕捉到 ${inspectionHints.size} 处异动；其余地点本夜不再显示。` : "本夜山河寂静，未发现可检视事件。") : visibleMapEvents.length ? `此域有 ${visibleMapEvents.length} 处待完成异闻，完成剧情前不会消失。` : map.description)}</p></footer>
  </section></div>;
}
