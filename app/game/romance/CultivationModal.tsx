"use client";

import { useEffect, useRef, useState } from "react";
import { drawCultivationEntry, type CultivationEntry } from "./cultivation-engine";

export default function CultivationModal({ stamina, experience, onClose, onComplete }: {
  stamina: number;
  experience: number;
  onClose: () => void;
  onComplete: (results: CultivationEntry[]) => void;
}) {
  const maximum = Math.floor(stamina / 2);
  const [count, setCount] = useState(Math.max(1, Math.min(1, maximum)));
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<CultivationEntry[]>([]);
  const timer = useRef<number | null>(null);
  const planned=Math.min(count,maximum);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  function begin() {
    if (running || maximum < 1) return;
    setRunning(true); setResults([]); setStep(1);
    const collected: CultivationEntry[] = [];
    const practice = (index: number) => {
      timer.current = window.setTimeout(() => {
        const result = drawCultivationEntry(); collected.push(result); setResults([...collected]);
        if (index + 1 < planned) { setStep(index + 2); practice(index + 1); }
        else { setRunning(false); onComplete(collected); }
      }, 1000);
    };
    practice(0);
  }

  const gained = results.reduce((sum, result) => sum + result.experience, 0);
  return <div className="cultivation-backdrop"><section className={`cultivation-modal ${running ? "is-running" : ""}`} role="dialog" aria-modal="true" aria-label="静室练功">
    <button type="button" className="cultivation-close" disabled={running} onClick={onClose}>×</button>
    <div className="cultivation-scene"><div className="moon-window"/><div className="incense-smoke"/><div className="spirit-formation"><i/><i/><i/><span>静</span></div><div className="meditation-silhouette"/><div className="qi-orbs">{Array.from({length:9},(_,index)=><i key={index}/>)}</div></div>
    <div className="cultivation-panel"><p>PRIVATE CULTIVATION · 听云居</p><h2>凝神运气</h2><div className="cultivation-stats"><span>体力 <b>{stamina}/10</b></span><span>修为 <b>{experience + gained}</b></span></div>
      {!running && <><label>本次练功 <strong>{maximum ? planned : 0}</strong> 次 · 消耗 {maximum ? planned * 2 : 0} 点体力<input type="range" min="1" max={Math.max(1, maximum)} value={Math.min(count, Math.max(1, maximum))} disabled={maximum < 1} onChange={(event)=>setCount(Number(event.target.value))}/><small>上限由当前体力决定，每次练功耗时一息（1 秒）</small></label><button type="button" className="cultivation-start" disabled={maximum < 1} onClick={begin}>{maximum < 1 ? "体力不足 · 至少需要 2 点" : `运转 ${planned} 次周天`}</button></>}
      {running && <div className="cultivation-progress"><div><i key={step}/></div><strong>第 {step} / {planned} 次 · 灵气正在归脉</strong><small>请凝神片刻……</small></div>}
      {results.length > 0 && <div className="cultivation-results">{results.map((result,index)=><article key={`${result.id}-${index}`}><span>{index+1}</span><p>你今天感到{result.text}，经验值上涨 <b>{result.experience}</b> 点。</p></article>)}</div>}
    </div>
  </section></div>;
}
