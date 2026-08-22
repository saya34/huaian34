"use client";

import { useState } from "react";
import { fortuneEffectLabel, getFortuneSign, type FortuneDrawRecord } from "./fortune-engine";

function Stars({ value }: { value: number }) { return <span className="fortune-stars" aria-label={`${value}星`}>{Array.from({length:5},(_,index)=><i key={index} className={index<value?"lit":""}>★</i>)}</span>; }

export default function FortuneModal({ dateKey, portrait, initialRecord, onClose, onDraw }: { dateKey: string; portrait: string; initialRecord?: FortuneDrawRecord; onClose: () => void; onDraw: () => FortuneDrawRecord }) {
  const [record,setRecord]=useState<FortuneDrawRecord|undefined>(initialRecord);
  const sign=getFortuneSign(record);
  const functional=Boolean(sign && sign.effect!=="none");
  return <div className="activity-modal-backdrop"><section className="activity-phone fortune-phone" role="dialog" aria-modal="true" aria-label="悬壶问卦">
    <header><div><small>REAL DAILY FORTUNE · 现实每日一次</small><h2>悬壶问卦</h2></div><span className="fortune-real-date">{dateKey}</span><button type="button" onClick={onClose}>×</button></header>
    {!record&&<div className="fortune-intro"><div className="fortune-doctor"><div className="fortune-orbit"><i/><i/><i/></div><img src={portrait} alt="柳知意"/></div><div><small>柳知意 · 悬壶谷医师</small><blockquote>“卦只问今日。你若已经想好所求，便把手放在签筒上——第一念是什么，不必告诉我。”</blockquote><p>结果将按现实日期保存，当天不可重抽；游戏内推移时辰或初始化均不会刷新次数。</p><button type="button" onClick={()=>setRecord(onDraw())}>静心问卦</button><button type="button" className="ghost" onClick={onClose}>改日再问</button></div></div>}
    {record&&sign&&<div className={`fortune-result ${functional?"functional":""}`}><div className="fortune-seal"><span>签</span><i/><b>{sign.rank}</b></div><small>{initialRecord?"今日签文 · 已问":"卦象已定 · 今日不可重抽"}</small><h3>{sign.title}</h3><blockquote>“{sign.quote}”</blockquote><div className="fortune-opening"><i>卦</i><p>{record.opening}</p></div><div className="fortune-do-dont"><div><strong>今日宜</strong><p>{record.auspicious.map((item,index)=><span key={item} className={(sign.effect==="talk_double"&&item==="访友")||(sign.effect==="gift_double"&&item==="赠礼")||(sign.effect==="social_double"&&(item==="访友"||item==="赠礼"))?"blessed":""}>{item}{index<record.auspicious.length-1?"、":""}</span>)}</p></div><div><strong>今日忌</strong><p>{record.taboo.join("、")}</p></div></div><div className="fortune-ratings"><p><span>桃花</span><Stars value={sign.peach}/></p><p><span>财运</span><Stars value={sign.wealth}/></p><p><span>机缘</span><Stars value={sign.chance}/></p></div><div className={`fortune-effect ${functional?"active":""}`}><i>✦</i><span><small>{functional?"FUNCTIONAL FORTUNE · 功能签":"DAILY GUIDANCE · 今日指引"}</small><strong>{fortuneEffectLabel(sign.effect)}</strong></span></div><p className="fortune-interpretation">“{record.interpretation}”</p><button type="button" className="fortune-close" onClick={onClose}>收下签文</button></div>}
  </section></div>;
}
