"use client";

import { useEffect, useState } from "react";
import type { EventDefinition, SceneDefinition } from "./types";

export default function InspectionModal({ scene, event, onClose, onEnterEvent }: {
  scene: SceneDefinition;
  event: EventDefinition | null;
  onClose: () => void;
  onEnterEvent: (event: EventDefinition) => void;
}) {
  const [revealed,setRevealed]=useState(false);
  useEffect(()=>{const timer=window.setTimeout(()=>setRevealed(true),1250);return()=>window.clearTimeout(timer)},[]);
  return <div className={`inspection-backdrop ${revealed?"revealed":"searching"}`}><section className="inspection-modal" role="dialog" aria-modal="true" aria-label={`检视${scene.name}`} style={{backgroundImage:`url(${scene.image})`}}>
    <div className="inspection-shade"/><div className="inspection-fog fog-a"/><div className="inspection-fog fog-b"/><div className="inspection-fog fog-c"/>
    {!revealed?<div className="inspection-search"><span>眼</span><small>云识外放 · 检视中</small><h2>{scene.name}</h2></div>:<div className="inspection-result"><p>NIGHT INSPECTION · 夜间检视</p><h2>{event?event.title:"夜色如常"}</h2><blockquote>{event?event.subtitle:"此场景和往常一样"}</blockquote>{event?<button type="button" onClick={()=>onEnterEvent(event)}>循迹而入 · 触发剧情</button>:<button type="button" onClick={onClose}>收回神识</button>}</div>}
  </section></div>;
}
