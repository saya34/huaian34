"use client";

import { useState } from "react";
import FishingBar, { type FishingBarHit, type FishingBarResult } from "./FishingBar";
import { DIFFICULTY_NAMES, getProficiencyProfile, resolveMinigameDifficulty, type ResolvedMinigameDifficulty } from "./proficiency-engine";
import type { CharacterDefinition, DrinkingInteractionDefinition } from "./types";

const WIN_LINES=[
  "这一杯接得漂亮。酒未入口，你的眼神倒先醉了。",
  "第二回仍这样稳？看来你今晚不是来消愁，是来赢我的。",
  "三杯之后还能分清月色与灯影，我便当你说的都是真话。",
  "酒量不错。再这样下去，我可要怀疑你一直在藏拙。",
];
const MISS_LINES=[
  "杯沿都没扶稳。慢些，我又不会催你把今夜喝完。",
  "酒意乱了心神？还是坐在你对面的人更扰人？",
  "这一杯算我替你挡下。欠下的人情，改日记得还。",
];

export default function DrinkingModal({ character, config, stamina, initialWins, sceneDifficulty, proficiencyExperience, specialCompleted, onClose, onSpendStamina, onPractice, onWin, onSpecial }: {
  character: CharacterDefinition;
  config: DrinkingInteractionDefinition;
  stamina: number;
  initialWins: number;
  sceneDifficulty:number;
  proficiencyExperience:number;
  specialCompleted:boolean;
  onClose:()=>void;
  onSpendStamina:(amount:number,label:string)=>boolean;
  onPractice:(amount:number)=>void;
  onWin:(wins:number)=>void;
  onSpecial:(wins:number)=>void;
}){
  const [phase,setPhase]=useState<"intro"|"game"|"dialogue">("intro");
  const [round,setRound]=useState(1);
  const [wins,setWins]=useState(initialWins);
  const [message,setMessage]=useState("");
  const [success,setSuccess]=useState(false);
  const [specialReady,setSpecialReady]=useState(!specialCompleted&&initialWins>=config.specialWinCount);
  const [lastHit,setLastHit]=useState<FishingBarHit["zone"]|null>(null);
  const [skillExperience,setSkillExperience]=useState(proficiencyExperience);
  const [skillNotice,setSkillNotice]=useState("");
  const [roundDifficulty,setRoundDifficulty]=useState<ResolvedMinigameDifficulty>(()=>resolveMinigameDifficulty(sceneDifficulty,1,getProficiencyProfile(proficiencyExperience).level));
  const proficiency=getProficiencyProfile(skillExperience);

  function startRound(roundNumber=round){
    if(stamina<1||!onSpendStamina(1,"与她共饮")){setMessage("体力已尽。今夜的酒先温着，待下个时辰再来。");return}
    setRoundDifficulty(resolveMinigameDifficulty(sceneDifficulty,roundNumber,getProficiencyProfile(skillExperience).level));
    setLastHit(null);setMessage("");setSkillNotice("");setPhase("game");
  }
  function finish(result:FishingBarResult){
    const nextWins=result.success?wins+1:wins;
    if(result.success){setWins(nextWins);onWin(nextWins)}
    const gained=result.success?2:1;
    const before=getProficiencyProfile(skillExperience),nextExperience=skillExperience+gained,after=getProficiencyProfile(nextExperience);
    setSkillExperience(nextExperience);onPractice(gained);
    setSkillNotice(before.level===after.level?`喝酒熟练度 +${gained}`:`熟练度突破 · ${after.level}阶「${after.name}」`);
    const ready=!specialCompleted&&nextWins>=config.specialWinCount;
    setSuccess(result.success);setSpecialReady(ready);
    const lines=result.success?WIN_LINES:MISS_LINES;
    setMessage(`${lines[(nextWins+round)%lines.length]}（本轮 ${result.score} 分）`);setPhase("dialogue");
  }
  function continueRound(){const nextRound=round+1;setRound(nextRound);startRound(nextRound)}

  return <div className="activity-modal-backdrop drinking-backdrop"><section className="activity-phone drinking-phone" role="dialog" aria-modal="true" aria-label={`与${character.name}共饮`}>
    <header><div><small>NIGHT INTERACTION · 夜酌</small><h2>月下共饮</h2></div><span className="activity-wallet">体力 <b>{stamina}</b> · 酒兴 <b>{wins}</b></span><button type="button" onClick={onClose}>×</button></header>
    {phase==="intro"&&<div className="drinking-intro"><div className="drinking-portrait"><img src={character.image} alt=""/><i/></div><div><small>{character.name} · 夜晚限定</small><blockquote>“夜色正好。若不急着回山，陪我饮一杯？”</blockquote><div className="drinking-rank-card"><span>喝酒熟练度<strong>{proficiency.level}阶 · {proficiency.name}</strong></span><span>场景酒局<strong>{Math.max(1,Math.min(9,Math.round(sceneDifficulty)))}阶 · {DIFFICULTY_NAMES[Math.max(1,Math.min(9,Math.round(sceneDifficulty)))-1]}</strong></span><i><b style={{width:`${proficiency.progress*100}%`}}/></i></div><p>每轮消耗 1 点体力。浮标会持续忽快忽慢；从第三轮起运动与红区会明显变难，高熟练度有机会随机抵消部分难度。</p>{message&&<em>{message}</em>}<button type="button" onClick={()=>startRound()}>斟酒入席</button><button type="button" className="ghost" onClick={onClose}>改日再饮</button></div></div>}
    {phase==="game"&&<FishingBar key={round} config={{maxAttempts:config.maxAttempts,targetScore:config.targetScore,difficultyLevel:roundDifficulty.effectiveLevel,difficultyName:roundDifficulty.name}} onHit={(hit)=>setLastHit(hit.zone)} onFinish={finish}>
      <div className={`drinking-cup-scene cup-hit-${lastHit??"none"}`}><div className="moon-disc"/><div className="wine-table"/><div className="jade-wine-cup"><i/><b/></div><div className="wine-ripples"><i/><i/><i/></div><div className="petal-drift">{Array.from({length:8},(_,index)=><i key={index}/>)}</div><small>第 {round} 轮 · {roundDifficulty.effectiveLevel}阶{roundDifficulty.skillRelief?` · 熟练化解 ${roundDifficulty.skillRelief}阶`:" · 凝神落杯"}</small><strong>{lastHit==="target"?"酣":lastHit==="near"?"稳":lastHit==="miss"?"散":"饮"}</strong></div>
    </FishingBar>}
    {phase==="dialogue"&&<div className={`drinking-dialogue ${success?"success":"miss"}`}><div className="wine-result-seal">{success?"成":"失"}</div><img src={character.image} alt=""/><small>{character.name} · 酒兴 {wins}</small><blockquote>“{message}”</blockquote><div className="skill-gain-toast">{skillNotice}</div><p>{success?`共饮成功，累计酒兴 +1。${specialReady?"她的目光停在你身上，似乎终于准备说出藏了很久的话。":"夜色尚长，还可再饮一轮。"}`:"虽未赢下此轮，你仍从失手中积累了少许熟练度。"}</p>{specialReady?<button type="button" onClick={()=>onSpecial(wins)}>酒至深处 · 进入特殊事件</button>:<button type="button" onClick={continueRound}>再斟一杯</button>}<button type="button" className="ghost" onClick={onClose}>今夜尽兴</button></div>}
  </section></div>;
}
