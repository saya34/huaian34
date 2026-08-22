"use client";

import { useEffect, useRef, useState } from "react";
import type { GiftId } from "./types";

type MarketView = "home" | "auction" | "stones" | "sweets";
type AtlasItem = { id: string; name: string; description: string; position: string };
type Stone = AtlasItem & { cost: number; weights: number[] };
type StoneOffer = { offerId: string; stone: Stone };
type MarketResult = { item?: AtlasItem; title: string; text: string; atlas?: "goods" | "treasure"; rarity: "waste" | "normal" | "legendary" | "auction" };
type AuctionMotion = "idle" | "presenting" | "bidding" | "player" | "rival" | "hammer";
type StonePhase = "idle" | "cracking" | "burst";

function randomValue() { return Math.random(); }

const AUCTION_LOTS: Array<AtlasItem & { base: number }> = [
  { id: "moon-jade-tablet", name: "月华玉牒", description: "可映照一段被遗忘的旧梦。", position: "0% 0%", base: 80 },
  { id: "spirit-bell", name: "镇灵古铃", description: "铃声能使躁动灵气暂归平静。", position: "50% 0%", base: 110 },
  { id: "beast-token", name: "瑞兽令", description: "不知属于哪座失落仙府。", position: "100% 0%", base: 140 },
];

const TREASURES: AtlasItem[] = [
  { id: "spirit-crystal", name: "虹光灵晶", description: "纯净灵气凝成的晶簇。", position: "0% 0%" },
  { id: "jade-pendant", name: "同心玉佩", description: "玉色温润，似能回应心念。", position: "50% 0%" },
  { id: "sword-fragment", name: "古剑残锋", description: "断口仍萦绕未散的剑意。", position: "100% 0%" },
  { id: "phoenix-feather", name: "赤鸾灵羽", description: "在掌心燃起而不灼人。", position: "0% 100%" },
  { id: "star-pearl", name: "星河珠", description: "珠中有一线微缩星河。", position: "50% 100%" },
  { id: "immortal-ring", name: "蟠龙仙戒", description: "传说曾属于一位飞升者。", position: "100% 100%" },
];

const STONES: Stone[] = [
  { id: "green", name: "青皮原石", description: "石皮细密，价格最为亲和。", position: "0% 0%", cost: 18, weights: [70, 22, 6, 1, 1, 0] },
  { id: "purple", name: "紫纹原石", description: "紫线如脉，偶见罕有宝材。", position: "50% 0%", cost: 38, weights: [43, 35, 14, 5, 2, 1] },
  { id: "redgold", name: "赤金原矿", description: "火性浓郁，常藏灵羽残兵。", position: "100% 0%", cost: 62, weights: [22, 24, 24, 20, 7, 3] },
  { id: "star", name: "星髓原石", description: "夜色流转，珍宝权重最高。", position: "0% 100%", cost: 100, weights: [8, 16, 22, 18, 24, 12] },
];

const SWEETS: Array<AtlasItem & { cost: number; giftId: GiftId }> = [
  { id: "osmanthus", name: "桂花云片糕", description: "软糯清甜，适合与人分食。", position: "0% 100%", cost: 12, giftId: "osmanthusCake" },
  { id: "peach", name: "桃花酥", description: "花瓣酥皮一碰便碎。", position: "50% 100%", cost: 16, giftId: "peachWine" },
  { id: "snow", name: "雪茶糖", description: "入口微凉，附一小罐雪芽灵茶。", position: "100% 100%", cost: 20, giftId: "snowTea" },
];

function weightedTreasure(weights: number[]) {
  let cursor = randomValue() * weights.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < weights.length; index += 1) { cursor -= weights[index]; if (cursor <= 0) return TREASURES[index]; }
  return TREASURES[0];
}

function shuffled<T>(items:T[]){
  const copy=[...items];
  for(let index=copy.length-1;index>0;index-=1){const target=Math.floor(randomValue()*(index+1));[copy[index],copy[target]]=[copy[target],copy[index]]}
  return copy;
}

function createStoneOffer():StoneOffer[]{
  const picks:Stone[]=[...shuffled(STONES).slice(0,3)];
  while(picks.length<7)picks.push(STONES[Math.floor(randomValue()*STONES.length)]);
  return shuffled(picks).map((stone,index)=>({offerId:`${stone.id}-${index}-${Math.floor(randomValue()*1_000_000)}`,stone}));
}

export default function MarketModal({ stones, stamina, treasures, onClose, onSpend, onSpendStamina, onTreasure, onBuyGift }: {
  stones: number;
  stamina: number;
  treasures: Record<string, number>;
  onClose: () => void;
  onSpend: (amount: number) => boolean;
  onSpendStamina: (amount:number,label:string)=>boolean;
  onTreasure: (item: AtlasItem, source: string) => void;
  onBuyGift: (giftId: GiftId, name: string) => void;
}) {
  const [view, setView] = useState<MarketView>("home");
  const [lot, setLot] = useState<(typeof AUCTION_LOTS)[number] | null>(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [bidRound, setBidRound] = useState(0);
  const [auctionMotion,setAuctionMotion]=useState<AuctionMotion>("idle");
  const [stoneOffers,setStoneOffers]=useState<StoneOffer[]>(()=>createStoneOffer());
  const [selectedOffer,setSelectedOffer]=useState<string|null>(null);
  const [stonePhase,setStonePhase]=useState<StonePhase>("idle");
  const [stoneOutcome,setStoneOutcome]=useState<"waste"|"normal"|"legendary"|null>(null);
  const [purchasedSweet,setPurchasedSweet]=useState<string|null>(null);
  const [result, setResult] = useState<MarketResult | null>(null);
  const [notice, setNotice] = useState("");
  const timers=useRef<number[]>([]);

  function clearTimers(){timers.current.forEach((timer)=>window.clearTimeout(timer));timers.current=[]}
  function later(action:()=>void,delay:number){const timer=window.setTimeout(()=>{timers.current=timers.current.filter((item)=>item!==timer);action()},delay);timers.current.push(timer)}
  useEffect(()=>()=>timers.current.forEach((timer)=>window.clearTimeout(timer)),[]);

  function enterView(next: MarketView) {
    clearTimers();setView(next);setLot(null);setResult(null);setNotice("");setAuctionMotion("idle");setStonePhase("idle");setSelectedOffer(null);setStoneOutcome(null);
    if(next==="stones")setStoneOffers(createStoneOffer());
  }

  function selectLot(next: (typeof AUCTION_LOTS)[number]) {
    if(stamina<1||!onSpendStamina(1,"参加拍卖")){setNotice("体力已耗尽，无法参与拍卖。");return}
    setLot(next); setCurrentBid(next.base); setBidRound(0);setAuctionMotion("presenting");setNotice("拍卖师揭开防尘灵纱，藏品正缓缓升上主玉台。");
    later(()=>{setAuctionMotion("bidding");setNotice("底价已报。三轮竞价后无人追价，拍卖师便会落槌。")},850);
  }

  function bid() {
    if (!lot||auctionMotion!=="bidding") return;
    const yourBid = currentBid + 20 + bidRound * 10;
    if (stones < yourBid) { setNotice(`至少需要 ${yourBid} 枚灵石才能举牌。`); return; }
    const finalRound=bidRound>=2;
    if(finalRound&&!onSpend(yourBid))return;
    setCurrentBid(yourBid);setAuctionMotion("player");setNotice(`你举起青玉牌，将价格推至 ${yourBid}。`);
    later(()=>{
      if(finalRound){setAuctionMotion("hammer");setNotice("一息、两息、三息——无人再举牌。拍卖槌破风落下！");onTreasure(lot,"云州拍卖行");later(()=>{setResult({item:lot,atlas:"goods",rarity:"auction",title:"落槌成交",text:`你以 ${yourBid} 枚灵石拍得「${lot.name}」。玉台灵纹亮起，藏品正式归入你的收藏。`});setLot(null);setAuctionMotion("idle")},1050);return}
      const rival=yourBid+(randomValue()>.5?10:20);setAuctionMotion("rival");setCurrentBid(rival);setBidRound((value)=>value+1);setNotice(`屏风后亮起赤玉牌，对方追至 ${rival}。灯火已燃至下一格。`);later(()=>setAuctionMotion("bidding"),700);
    },650);
  }

  function openStone(offer:StoneOffer) {
    if(stonePhase!=="idle")return;
    if(stones<offer.stone.cost){setNotice(`灵石不足，需要 ${offer.stone.cost} 枚。`);return}
    if(stamina<1||!onSpendStamina(1,"赌石开宝")){setNotice("体力已耗尽，无法继续开石。");return}
    if (!onSpend(offer.stone.cost)) { setNotice(`灵石不足，需要 ${offer.stone.cost} 枚。`); return; }
    const waste=randomValue()<.5;
    const treasure=waste?null:weightedTreasure(offer.stone.weights);
    const legendary=Boolean(treasure&&(treasure.id==="star-pearl"||treasure.id==="immortal-ring"));
    const outcome=waste?"waste":legendary?"legendary":"normal";
    setSelectedOffer(offer.offerId);setStoneOutcome(outcome);setStonePhase("cracking");setNotice(`鉴石刀落在「${offer.stone.name}」的灵脉上，石皮开始松动……`);
    later(()=>setStonePhase("burst"),900);
    later(()=>{
      if(!treasure){setResult({rarity:"waste",title:"顽石无华",text:"石皮崩落，内里灰白干涩，半点灵气也无。这是一块废石。"})}
      else {onTreasure(treasure,offer.stone.name);setResult({item:treasure,atlas:"treasure",rarity:legendary?"legendary":"normal",title:legendary?"极品现世":"灵光破石",text:`石心之中显出「${treasure.name}」。${treasure.description}`})}
      setStonePhase("idle");
    },1700);
  }

  function closeResult(){
    if(view==="stones"&&selectedOffer){setStoneOffers((offers)=>{const remaining=offers.filter((offer)=>offer.offerId!==selectedOffer);return remaining.length?remaining:createStoneOffer()});setSelectedOffer(null);setStoneOutcome(null)}
    setResult(null);setNotice("");
  }

  function buySweet(item: (typeof SWEETS)[number],displayId:string) {
    if (!onSpend(item.cost)) { setNotice(`灵石不足，需要 ${item.cost} 枚。`); return; }
    onBuyGift(item.giftId, item.name);setPurchasedSweet(displayId);setNotice(`纸包折好，买下的「${item.name}」已作为礼物收入行囊。`);later(()=>setPurchasedSweet(null),850);
  }

  const sweetDisplay=[...SWEETS,...SWEETS];
  return <div className="activity-modal-backdrop"><section className="activity-phone market-phone immersive-market" role="dialog" aria-modal="true" aria-label="云州市集">
    <header><div><small>MONTHLY FAIR · 每月十五</small><h2>{view === "home" ? "云州市集" : view === "auction" ? "云舟拍卖" : view === "stones" ? "灵石开宝" : "云糕铺"}</h2></div><span className="activity-wallet">体力 <b>{stamina}</b> · 灵石 <b>{stones}</b></span><button type="button" onClick={onClose}>×</button></header>
    {view !== "home" && <button type="button" className="market-back" onClick={() => enterView("home")}>‹ 返回市集</button>}
    {view === "home" && <div className="market-home"><div className="market-banner"><span>十五</span><div><small>云门大开 · 百宝同市</small><strong>今日限定活动</strong><p>入阁听槌、鉴石寻珍，也可在云糕架前挑一份伴手礼。</p></div></div><div className="market-entrances"><button type="button" onClick={() => enterView("auction")}><i>拍</i><span><strong>云舟拍卖</strong><small>玉台展宝 · 三轮竞价 · 落槌成交</small></span></button><button type="button" onClick={() => enterView("stones")}><i>石</i><span><strong>灵石开宝</strong><small>七席随机原石 · 五成可能为废石</small></span></button><button type="button" onClick={() => enterView("sweets")}><i>糕</i><span><strong>云糕铺</strong><small>六盘糕架 · 指引光点直接购买</small></span></button></div><div className="treasure-count"><span>已收藏市集宝物</span><b>{Object.values(treasures).reduce((sum, value) => sum + value, 0)}</b></div></div>}
    {view === "auction" && !lot && !result && <div className="auction-hall lot-picker"><div className="scene-vignette"/><div className="hall-caption"><small>YUNZHOU AUCTION · 今夜三珍</small><strong>触碰灵光，验看拍品</strong></div>{AUCTION_LOTS.map((item,index)=><button type="button" key={item.id} className={`auction-lot-slot slot-${index+1}`} onClick={()=>selectLot(item)}><i className="market-sprite goods" style={{backgroundPosition:item.position}}/><span className="market-guide-point"/><em><strong>{item.name}</strong><small>底价 {item.base}</small></em></button>)}</div>}
    {view === "auction" && lot && <div className={`auction-hall auction-live ${auctionMotion}`}><div className="scene-vignette"/><div className="auction-lot-focus"><i className="market-sprite goods" style={{backgroundPosition:lot.position}}/><span className="lot-aura"/></div><div className="bidder-signal player-signal"><i>青</i><span>你的玉牌</span></div><div className="bidder-signal rival-signal"><i>赤</i><span>屏风来客</span></div><div className="auction-hammer"><i/><b/></div><div className="auction-live-panel"><small>{lot.name} · 第 {Math.min(3,bidRound+1)} / 3 轮</small><div className="auction-round-lamps">{[0,1,2].map((index)=><i key={index} className={index<=bidRound?"lit":""}/>)}</div><p>{notice}</p><div className="auction-price"><span>当前叫价</span><strong>{currentBid}</strong><small>灵石</small></div><button type="button" disabled={auctionMotion!=="bidding"} onClick={bid}>{bidRound>=2?"最后举牌 · 等候落槌":"举起青玉竞价牌"}</button><button type="button" className="ghost" disabled={auctionMotion!=="bidding"} onClick={()=>{setLot(null);setAuctionMotion("idle");setNotice("你在价格失控前离开了竞拍席。");}}>收牌离席</button></div></div>}
    {view === "stones" && !result && <div className={`stone-appraisal-scene ${stonePhase} outcome-${stoneOutcome??"none"}`}><div className="scene-vignette"/><div className="stone-scene-caption"><small>七席随机原石 · 可重复出现</small><strong>{stonePhase==="idle"?"循光择石，一刀问灵":stonePhase==="cracking"?"鉴石刀已落":"石心即将显露"}</strong></div>{stoneOffers.map((offer,index)=><button type="button" key={offer.offerId} className={`stone-offer stone-slot-${index+1} ${selectedOffer===offer.offerId?"selected":""}`} disabled={stonePhase!=="idle"} onClick={()=>openStone(offer)}><i className="market-sprite stones" style={{backgroundPosition:offer.stone.position}}/><span className="market-guide-point"/><em><strong>{offer.stone.name}</strong><small>{offer.stone.cost} 灵石</small></em><b className="stone-cracks"/><b className="stone-burst"/></button>)}<div className="appraisal-fx"/></div>}
    {view === "sweets" && <div className="pastry-shop-scene"><div className="scene-vignette"/><div className="sweet-shop-caption"><small>云糕现蒸 · 可反复购买</small><strong>触碰灵光，唤伙计包起</strong></div>{sweetDisplay.map((item,index)=>{const displayId=`${item.id}-${index}`;return <button type="button" key={displayId} className={`sweet-shelf-item sweet-slot-${index+1} ${purchasedSweet===displayId?"purchased":""}`} onClick={()=>buySweet(item,displayId)}><i className="market-sprite goods" style={{backgroundPosition:item.position}}/><span className="market-guide-point"/><em><strong>{item.name}</strong><small>{item.cost} 灵石</small></em><b>已包好</b></button>})}</div>}
    {result && <div className={`market-reveal cinematic-reveal ${result.rarity}`}><div className="reveal-rays"/><div className="reveal-particles">{Array.from({length:14},(_,index)=><i key={index}/>)}</div>{result.item?<i className={`market-sprite ${result.atlas}`} style={{backgroundPosition:result.item.position}}/>:<i className="waste-stone"/>}<small>{result.rarity==="waste"?"EMPTY STONE · 灵气尽失":result.rarity==="legendary"?"SUPREME TREASURE · 极品现世":result.rarity==="auction"?"HAMMER SOLD · 落槌成交":"SPIRIT TREASURE · 开石得宝"}</small><h3>{result.title}</h3><p>{result.text}</p><button type="button" onClick={closeResult}>{view === "stones" ? "收起石屑 · 继续择石" : "返回拍卖阁"}</button></div>}
    {notice && !lot && !result && <div className="market-toast">{notice}</div>}
  </section></div>;
}
