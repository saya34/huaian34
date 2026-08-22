"use client";

import { useState } from "react";
import { WORLD_MAP_BY_ID, WORLD_MAPS, type WorldMapId } from "./world-maps";
import type { EventDefinition, Period, SceneId } from "./types";

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
};

export default function WorldMapModal({ sceneId, sceneEventHints, mapEvents, period, day, inspectionHints, inspectionDays, onClose, onEnterScene, onTriggerMapEvent, onInspectScene }: Props) {
  const [currentMapId, setCurrentMapId] = useState<WorldMapId>("yunzhou");
  const [notice, setNotice] = useState("");
  const [inspectionMode,setInspectionMode]=useState(false);
  const map = WORLD_MAP_BY_ID[currentMapId];
  const visibleMapEvents = mapEvents.filter((event) => event.mapEvent?.mapId === currentMapId);

  function choose(location: (typeof map.locations)[number]) {
    if (location.targetMapId) { setCurrentMapId(location.targetMapId); setNotice(""); return; }
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
      {map.locations.map((location) => {
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
      {visibleMapEvents.map((event, index) => <button type="button" key={event.id} className="map-event-cursor" style={{ left: `${event.mapEvent!.x}%`, top: `${event.mapEvent!.y}%`, "--event-delay": `${index * .18}s` } as React.CSSProperties} onClick={() => { onClose(); onTriggerMapEvent(event.id); }} aria-label={`触发地图事件：${event.title}`}>
        <span className="map-event-flare"><b>!</b><i /></span><em><strong>{event.title}</strong><small>待解异闻 · 完成前持续驻留</small></em>
      </button>)}
      <div className="map-compass"><i>北</i><span>✦</span><i>南</i></div>
    </div>
    <footer><div className="world-map-tabs">{WORLD_MAPS.map((item) => <button type="button" key={item.id} className={item.id === currentMapId ? "active" : ""} onClick={() => { setCurrentMapId(item.id); setNotice(""); }}><span>{item.id === "yunzhou" ? "壹" : item.id === "canglan" ? "贰" : "叁"}</span>{item.name}</button>)}</div><button type="button" className={`inspection-toggle ${inspectionMode?"active":""}`} onClick={()=>{if(period!=="夜晚"){setNotice("检视只能在夜晚进行。请先推移到夜晚。");return}setInspectionMode(value=>!value);setNotice(inspectionMode?"已退出检视模式":"检视模式已开启：选择任一未检视场景")}}><span>眼</span>{inspectionMode?"退出检视":"夜间检视"}</button><p>{notice || (inspectionMode?"选择场景放出神识；带眼睛图标处有明确线索，无图标处也可能藏有隐秘事件。":visibleMapEvents.length ? `此域有 ${visibleMapEvents.length} 处待完成异闻，完成剧情前不会消失。` : map.description)}</p></footer>
  </section></div>;
}
