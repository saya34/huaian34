"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

export type FishingBarConfig = {
  maxAttempts: number;
  targetScore: number;
  targetPoints?: number;
  nearPoints?: number;
  targetWidth?: number;
  nearWidth?: number;
  minSpeed?: number;
  maxSpeed?: number;
  difficultyLevel?: number;
  difficultyName?: string;
};

export type FishingBarHit = {
  zone: "target" | "near" | "miss";
  points: number;
  score: number;
  attempts: number;
};

export type FishingBarResult = {
  success: boolean;
  score: number;
  attempts: number;
};

function randomBetween(min:number,max:number){return min+Math.random()*(max-min)}

export default function FishingBar({ config, children, onHit, onFinish, theme = "drink" }: {
  config: FishingBarConfig;
  children?: ReactNode;
  onHit?: (hit:FishingBarHit)=>void;
  onFinish: (result:FishingBarResult)=>void;
  theme?: "drink" | "fish";
}) {
  const difficulty=Math.max(1,Math.min(9,Math.round(config.difficultyLevel??4)));
  const targetWidth=config.targetWidth??Math.max(9,20-(difficulty-1)*1.35);
  const nearWidth=Math.max(targetWidth+8,config.nearWidth??Math.max(28,48-(difficulty-1)*2.15));
  const targetPoints=config.targetPoints??3;
  const nearPoints=config.nearPoints??1;
  const minSpeed=config.minSpeed??(14+difficulty*2.2);
  const maxSpeed=config.maxSpeed??(34+difficulty*4.4);
  const [targetCenter]=useState(()=>randomBetween(28,72));
  const [position,setPosition]=useState(()=>randomBetween(5,95));
  const [score,setScore]=useState(0);
  const [attempts,setAttempts]=useState(0);
  const [lastHit,setLastHit]=useState<FishingBarHit["zone"]|null>(null);
  const [pace,setPace]=useState<"slow"|"steady"|"fast">("steady");
  const positionRef=useRef(position),directionRef=useRef(1),speedRef=useRef(minSpeed),targetSpeedRef=useRef(minSpeed),nextShiftRef=useRef(0),finishedRef=useRef(false),lastTimeRef=useRef(0);

  useEffect(()=>{
    let frame=0;
    directionRef.current=Math.random()>.5?1:-1;
    speedRef.current=randomBetween(minSpeed,maxSpeed);
    targetSpeedRef.current=speedRef.current;
    const chooseNextPace=(time:number)=>{
      const next=randomBetween(minSpeed,maxSpeed);
      targetSpeedRef.current=next;
      const ratio=(next-minSpeed)/Math.max(1,maxSpeed-minSpeed);
      setPace(ratio<.34?"slow":ratio>.68?"fast":"steady");
      const shortest=Math.max(180,690-difficulty*52),longest=Math.max(shortest+180,1320-difficulty*72);
      nextShiftRef.current=time+randomBetween(shortest,longest);
      if(difficulty>=5&&Math.random()<(difficulty-4)*.035)directionRef.current*=-1;
    };
    const move=(time:number)=>{
      if(!lastTimeRef.current)lastTimeRef.current=time;
      const delta=Math.min(.04,(time-lastTimeRef.current)/1000);lastTimeRef.current=time;
      if(!nextShiftRef.current||time>=nextShiftRef.current)chooseNextPace(time);
      const acceleration=2.4+difficulty*.58;
      speedRef.current+=(targetSpeedRef.current-speedRef.current)*Math.min(1,delta*acceleration);
      let next=positionRef.current+directionRef.current*speedRef.current*delta;
      if(next>=100||next<=0){next=Math.max(0,Math.min(100,next));directionRef.current*=-1;chooseNextPace(time)}
      positionRef.current=next;setPosition(next);frame=requestAnimationFrame(move);
    };
    frame=requestAnimationFrame(move);return()=>cancelAnimationFrame(frame);
  },[difficulty,maxSpeed,minSpeed]);

  function strike(){
    if(finishedRef.current)return;
    const distance=Math.abs(positionRef.current-targetCenter);
    const zone:FishingBarHit["zone"]=distance<=targetWidth/2?"target":distance<=nearWidth/2?"near":"miss";
    const points=zone==="target"?targetPoints:zone==="near"?nearPoints:0;
    const nextScore=score+points,nextAttempts=attempts+1;
    const hit={zone,points,score:nextScore,attempts:nextAttempts};
    setScore(nextScore);setAttempts(nextAttempts);setLastHit(zone);onHit?.(hit);
    window.setTimeout(()=>setLastHit(null),420);
    if(nextScore>=config.targetScore||nextAttempts>=config.maxAttempts){
      finishedRef.current=true;
      window.setTimeout(()=>onFinish({success:nextScore>=config.targetScore,score:nextScore,attempts:nextAttempts}),650);
    } else {targetSpeedRef.current=randomBetween(minSpeed,maxSpeed);nextShiftRef.current=0}
  }

  function keyStrike(event:KeyboardEvent<HTMLDivElement>){if(event.key===" "||event.key==="Enter"){event.preventDefault();strike()}}
  const targetStart=targetCenter-targetWidth/2,targetEnd=targetCenter+targetWidth/2,nearStart=targetCenter-nearWidth/2,nearEnd=targetCenter+nearWidth/2;
  const actionCopy=theme==="fish"?lastHit==="target"?`灵线绷紧 · +${targetPoints}`:lastHit==="near"?`顺势收线 · +${nearPoints}`:lastHit==="miss"?"鱼影挣动 · MISS":"观察鱼影游速，在浮标进入红区时点击收线":lastHit==="target"?`正中酒意 · +${targetPoints}`:lastHit==="near"?`尚算稳当 · +${nearPoints}`:lastHit==="miss"?"酒意散了 · MISS":"忽快忽慢，等红区出现时落杯";
  return <div className={`fishing-bar-game bar-theme-${theme} hit-${lastHit??"none"}`} role="button" tabIndex={0} onPointerDown={strike} onKeyDown={keyStrike} aria-label={theme==="fish"?"点击收线，判定浮标位置":"点击判定浮标位置"}>
    <div className="fishing-game-content">{children}</div>
    <aside className="fishing-meter-panel">
      <div className="fishing-score"><span>得分 <b>{score}</b> / {config.targetScore}</span><span>判定 <b>{attempts}</b> / {config.maxAttempts}</span><span className={`fishing-pace ${pace}`}>{pace==="fast"?"骤疾":pace==="slow"?"忽缓":"游移"}</span></div>
      <div className="fishing-meter" style={{"--target-start":`${targetStart}%`,"--target-end":`${targetEnd}%`,"--near-start":`${nearStart}%`,"--near-end":`${nearEnd}%`} as CSSProperties}>
        <i className="fishing-float" style={{top:`${position}%`}}><b/></i>
        <span className="zone-label target-label" style={{top:`${targetCenter}%`}}>绝佳</span>
      </div>
      <div className="fishing-legend"><span><i className="red"/>目标 +{targetPoints}</span><span><i className="yellow"/>靠近 +{nearPoints}</span><span><i className="green"/>MISS +0</span></div>
      <p><b>{difficulty}阶 · {config.difficultyName??"动态"}</b>{actionCopy}</p>
    </aside>
  </div>;
}
