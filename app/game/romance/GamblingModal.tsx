"use client";

import { useEffect, useRef, useState } from "react";

type GameKind = "bigsmall" | "cups" | "flower";
type Phase = "intro" | "menu" | "playing" | "round-dialogue" | "pleading" | "result";
type Motion = "idle" | "rolling" | "reveal" | "win" | "lose" | "draw";
type CupStage = "preview" | "shuffling" | "choosing" | "revealed";

const ROUND_LINES = [
  "第一局便敢押得这样稳？客官今日的眼神，比骰盅还会骗人。",
  "又赢了。现在收手，尚算你知进退；再往前，可就要我心疼了。",
  "三局连胜……你究竟是听得见骰声，还是只顾看我？",
  "第四局。再赢一次，今夜醉月楼的账本可真要为你改写了。",
  "五局全胜。罢了罢了，你当真一点情面也不给我留？",
];

const DIE_PIPS: Record<number, number[]> = { 1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9] };

function randomValue() { return Math.random(); }

function DiceFace({ value, small=false }: { value: number; small?: boolean }) {
  return <i className={`game-die ${small?"small":""}`} aria-label={`${value}点`}>{DIE_PIPS[value].map((position)=><b key={position} style={{gridArea:`${Math.ceil(position/3)} / ${((position-1)%3)+1}`}}/>)}</i>;
}

export default function GamblingModal({ stones, stamina, portrait, onClose, onSpend, onSpendStamina, onPayout, onBond }: {
  stones: number;
  stamina: number;
  portrait: string;
  onClose: () => void;
  onSpend: (amount: number) => boolean;
  onSpendStamina: (amount:number,label:string)=>boolean;
  onPayout: (amount: number, message: string) => void;
  onBond: (amount: number) => void;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [kind, setKind] = useState<GameKind>("bigsmall");
  const [round, setRound] = useState(1);
  const [pot, setPot] = useState(10);
  const [dice, setDice] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [motion,setMotion]=useState<Motion>("idle");
  const [lastOutcome,setLastOutcome]=useState<"win"|"lose"|"draw">("draw");
  const [cupStage,setCupStage]=useState<CupStage>("preview");
  const [cupPlan,setCupPlan]=useState<"a"|"b"|"c">("a");
  const [selectedCup,setSelectedCup]=useState<number|null>(null);
  const [flowerTotal, setFlowerTotal] = useState(7);
  const [dealerTotal, setDealerTotal] = useState(0);
  const [dealerRevealed,setDealerRevealed]=useState(false);
  const [flowerRolls,setFlowerRolls]=useState<number[]>([]);
  const timers=useRef<number[]>([]);

  function clearTimers(){timers.current.forEach((timer)=>window.clearTimeout(timer));timers.current=[]}
  function later(action:()=>void,delay:number){const timer=window.setTimeout(()=>{timers.current=timers.current.filter((item)=>item!==timer);action()},delay);timers.current.push(timer)}
  useEffect(()=>()=>timers.current.forEach((timer)=>window.clearTimeout(timer)),[]);

  function begin(nextKind: GameKind, cost: number) {
    if(stones<cost){setMessage(`灵石不足，需要 ${cost} 枚。`);setLastOutcome("lose");setPhase("result");return}
    if(stamina<1||!onSpendStamina(1,"参与醉月赌局")){setMessage("体力已耗尽，请推移时辰或食用糕点后再来。");setLastOutcome("lose");setPhase("result");return}
    if (!onSpend(cost)) { setMessage(`灵石不足，需要 ${cost} 枚。`); setLastOutcome("lose"); setPhase("result"); return; }
    clearTimers();setKind(nextKind);setMessage("");setMotion("idle");setLastOutcome("draw");setPhase("playing");
    if (nextKind === "bigsmall") { setRound(1); setPot(cost); setDice([]); }
    if (nextKind === "cups") { setCupStage("preview");setCupPlan("a");setSelectedCup(null); }
    if (nextKind === "flower") { setFlowerTotal(5 + Math.floor(randomValue() * 4)); setDealerTotal(10 + Math.floor(randomValue() * 6));setDealerRevealed(false);setFlowerRolls([]); }
  }

  function settle(amount: number, text: string, outcome:"win"|"lose"|"draw"=amount>0?"win":"lose") {
    if (amount > 0) onPayout(amount, text);
    setMessage(text); setLastOutcome(outcome); setPhase("result");setMotion("idle");
  }

  function guessBigSmall(guess: "大" | "小") {
    if(motion!=="idle")return;
    const rolled = Array.from({ length: 3 }, () => 1 + Math.floor(randomValue() * 6));
    const total = rolled.reduce((sum, value) => sum + value, 0);
    const outcome = total >= 11 ? "大" : "小";
    const won=guess===outcome;
    setDice(rolled);setMotion("rolling");setMessage(`你押了${guess}，骰盅正在落定……`);
    later(()=>setMotion("reveal"),1150);
    later(()=>{
      if(!won){setMessage(`${rolled.join(" · ")}，合计 ${total} 点，是${outcome}。本局赌注尽归醉月楼。`);setLastOutcome("lose");setMotion("lose");later(()=>setPhase("result"),1200);return}
      const nextPot=pot*2;setPot(nextPot);setMessage(`${rolled.join(" · ")}，合计 ${total} 点——你押中了${outcome}，筹码翻至 ${nextPot}。`);setLastOutcome("win");setMotion("win");later(()=>setPhase(round===5?"pleading":"round-dialogue"),1200);
    },1650);
  }

  function continueBigSmall() { setRound((value) => value + 1); setDice([]);setMessage("");setMotion("idle"); setPhase("playing"); }

  function startCupShuffle(){
    if(cupStage!=="preview")return;
    setCupPlan((["a","b","c"] as const)[Math.floor(randomValue()*3)]);setCupStage("shuffling");setMessage("先看清灵珠——盏影将由缓至疾，沿弧线换位。");
    later(()=>{setCupStage("choosing");setMessage("盏声已停。灵珠如今藏在哪一盏下？")},3400);
  }

  function chooseCup(index: number) {
    if(cupStage!=="choosing")return;
    const won=index===1;setSelectedCup(index);setCupStage("revealed");setLastOutcome(won?"win":"lose");setMotion(won?"win":"lose");
    const text=won?"玉盏抬起，赤色灵珠正映着灯火。你循着弧线追对了它，赢得三十枚灵石。":`第${index+1}盏下空空如也。真正藏珠的玉盏泛起红光，花照影笑着叩了叩桌面。`;
    if(won)onPayout(30,text);setMessage(text);later(()=>{setMotion("idle");setPhase("result")},1600);
  }

  function drawFlower() {
    if(motion!=="idle")return;
    const value = 1 + Math.floor(randomValue() * 6);
    const total = flowerTotal + value;
    setFlowerRolls((rolls)=>[...rolls,value]);setMotion("rolling");setMessage("铜盅掠过骰道，听声辨点……");
    later(()=>{setFlowerTotal(total);setMotion("reveal");setMessage(`骰面为 ${value} 点，现在共 ${total} 点。`)},850);
    if(total>15)later(()=>{setLastOutcome("lose");setMotion("lose");setMessage(`骰面为 ${value} 点，总数 ${total}，越过十五。花照影笑着收走了筹码。`);later(()=>setPhase("result"),1200)},1500);
    else later(()=>setMotion("idle"),1450);
  }

  function stopFlower() {
    if(motion!=="idle")return;
    setMotion("rolling");setDealerRevealed(true);setMessage("你扣住骰盅。花照影也缓缓揭开自己的点数……");
    later(()=>{
      if (flowerTotal > dealerTotal){const text=`你以 ${flowerTotal} 点压过花照影的 ${dealerTotal} 点，赢得三十六枚灵石。`;onPayout(36,text);setMessage(text);setLastOutcome("win");setMotion("win")}
      else if (flowerTotal === dealerTotal){const text=`同为 ${flowerTotal} 点，这局算和，十五枚赌注原样奉还。`;onPayout(15,text);setMessage(text);setLastOutcome("draw");setMotion("draw")}
      else {setMessage(`你停在 ${flowerTotal} 点，花照影翻出 ${dealerTotal} 点。她赢得从容。`);setLastOutcome("lose");setMotion("lose")}
      later(()=>{setMotion("idle");setPhase("result")},1300);
    },900);
  }

  const outcomeWord=lastOutcome==="win"?"胜":lastOutcome==="lose"?"败":"和";
  return <div className="activity-modal-backdrop"><section className={`activity-phone gambling-phone game-motion-${motion}`} role="dialog" aria-modal="true" aria-label="醉月赌局">
    <header><div><small>WEEKLY GAME · 周二限定</small><h2>醉月赌局</h2></div><span className="activity-wallet">体力 <b>{stamina}</b> · 灵石 <b>{stones}</b></span><button type="button" onClick={onClose}>×</button></header>
    {phase === "intro" && <div className="gambling-intro"><img src={portrait} alt="花照影"/><div><small>花照影 · 老板娘</small><blockquote>“每逢周二，我都替无聊的客人开一桌小局。赌注不大——除非你舍不得走。”</blockquote><button type="button" onClick={() => setPhase("menu")}>落座 · 赌一局</button><button type="button" className="ghost" onClick={onClose}>今夜不赌</button></div></div>}
    {phase === "menu" && <div className="gambling-menu"><p>三种赌桌均有完整的藏、摇、开演出。输赢即结，可反复挑战。</p><button type="button" onClick={() => begin("bigsmall", 10)}><i>骰</i><span><strong>五局猜大小</strong><small>漆碗摇骰 · 连胜翻倍 · 可随时收手</small></span><b>推荐</b></button><button type="button" onClick={() => begin("cups", 12)}><i>盏</i><span><strong>三盏藏珠</strong><small>曲线换盏 · 由缓至疾 · 猜中赢 30</small></span></button><button type="button" onClick={() => begin("flower", 15)}><i>点</i><span><strong>花签十五点</strong><small>逐骰开点 · 抽取或停手 · 莫过十五</small></span></button></div>}
    {phase === "playing" && kind === "bigsmall" && <div className="bigsmall-game immersive-game"><div className="game-round"><span>第 {round} / 5 局</span><b>桌上筹码 {pot}</b></div><div className={`dice-bowl cinematic ${motion}`}><div className="dice-orbit">{(dice.length?dice:[1,3,5]).map((value,index)=><DiceFace value={value} key={index}/>)}</div><div className="impact-ring"/><div className="win-sparks">{Array.from({length:10},(_,index)=><i key={index}/>)}</div><strong className="outcome-flash">{motion==="win"?"押中":motion==="lose"?"失手":motion==="reveal"?"开":""}</strong></div><p>{message||"三枚骰子合计 3—10 为小，11—18 为大。落注后骰碗将自动开盅。"}</p><div className="game-choice-row"><button type="button" disabled={motion!=="idle"} onClick={() => guessBigSmall("小")}>押 小</button><button type="button" disabled={motion!=="idle"} onClick={() => guessBigSmall("大")}>押 大</button></div></div>}
    {phase === "round-dialogue" && <div className="round-dialogue"><img src={portrait} alt=""/><small>花照影 · 第 {round} 局</small><blockquote>“{ROUND_LINES[round - 1]}”</blockquote><p>{message}</p><div><button type="button" onClick={() => settle(pot, `你及时收手，带走 ${pot} 枚灵石。花照影亲自替你收好筹码。`,"win")}>见好就收 · {pot}</button><button type="button" onClick={continueBigSmall}>继续翻倍</button></div></div>}
    {phase === "pleading" && <div className="round-dialogue pleading"><img src={portrait} alt=""/><small>五局全胜 · 特别回应</small><blockquote>“好狠的心。真要把我今夜的私房钱都赢走么？给我留两分薄面……下次来，我亲自温酒赔你。”</blockquote><p>{message}</p><div><button type="button" onClick={() => { const payout = Math.floor(pot * .8); onBond(10); settle(payout, `你接受了她的求饶，奖金八折为 ${payout} 灵石。花照影好感度 +10。`,"win"); }}>接受求饶 · 八折 + 好感10</button><button type="button" onClick={() => settle(pot, `你拒绝求饶，带走全部 ${pot} 枚灵石。她眯起眼，把这笔账牢牢记下。`,"win")}>拒绝 · 全额 {pot}</button></div></div>}
    {phase === "playing" && kind === "cups" && <div className="cups-game immersive-game"><div className="game-round"><span>三盏藏珠</span><b>{cupStage==="preview"?"记住灵珠":cupStage==="shuffling"?"盏影交错":cupStage==="choosing"?"请揭一盏":"开盏"}</b></div><div className={`cups-board ${cupStage} plan-${cupPlan}`}><div className="table-art"/>{[0,1,2].map((index)=><button type="button" key={index} className={`moving-cup cup-${index} ${selectedCup===index?"selected":""} ${cupStage==="revealed"&&index===1?"correct":""}`} disabled={cupStage!=="choosing"} onClick={()=>chooseCup(index)} aria-label={`揭开第${index+1}盏`}><i className="spirit-pearl"/><span className="celadon-bowl"/><em>揭</em></button>)}<div className="shuffle-trail"/><div className="win-sparks">{Array.from({length:10},(_,index)=><i key={index}/>)}</div><strong className="outcome-flash">{motion==="win"?"寻得":motion==="lose"?"落空":""}</strong></div><p>{message||"灵珠会先显于盏下。点击开始后，三盏沿弧线换位，速度会越来越快。"}</p>{cupStage==="preview"&&<button type="button" className="game-primary-action" onClick={startCupShuffle}>凝神 · 开始换盏</button>}</div>}
    {phase === "playing" && kind === "flower" && <div className="flower-game immersive-game"><div className="game-round"><span>花签十五点</span><b>花照影 · <span className={dealerRevealed?"dealer-revealed":""}>{dealerRevealed?dealerTotal:"?"}</span> 点</b></div><div className={`fifteen-board ${motion}`}><div className="table-art"/><div className="fifteen-score"><small>你的点数</small><strong>{flowerTotal}</strong><span>/ 15</span></div><div className="flower-dice-history">{flowerRolls.map((value,index)=><DiceFace key={index} value={value} small/>)}</div><div className="rolling-die">{flowerRolls.length>0&&<DiceFace value={flowerRolls.at(-1)??1}/>}</div><div className="impact-ring"/><div className="win-sparks">{Array.from({length:10},(_,index)=><i key={index}/>)}</div><strong className="outcome-flash">{motion==="win"?"胜":motion==="lose"?"爆":motion==="draw"?"和":motion==="reveal"?`+${flowerRolls.at(-1)??0}`:""}</strong></div><p>{message || "越接近十五越好，但超过十五便立即落败。每次加点都会重新掷出一枚花骰。"}</p><div className="flower-track"><i style={{width:`${Math.min(100,flowerTotal/15*100)}%`}}/></div><div className="game-choice-row"><button type="button" disabled={motion!=="idle"} onClick={drawFlower}>掷骰加点</button><button type="button" disabled={motion!=="idle"} onClick={stopFlower}>扣盅停手</button></div></div>}
    {phase === "result" && <div className={`activity-result dramatic ${lastOutcome}`}><div className="result-rays"/><div className="result-particles">{Array.from({length:14},(_,index)=><i key={index}/>)}</div><span>{outcomeWord}</span><small>{lastOutcome==="win"?"LUCK FAVORS YOU":lastOutcome==="lose"?"THE HOUSE PREVAILS":"EVEN RESULT"}</small><h3>{lastOutcome==="win"?"灯火照彩头":lastOutcome==="lose"?"此局憾负":"此局言和"}</h3><p>{message}</p><button type="button" onClick={() => setPhase("menu")}>再选一局</button><button type="button" className="ghost" onClick={onClose}>离开赌桌</button></div>}
  </section></div>;
}
