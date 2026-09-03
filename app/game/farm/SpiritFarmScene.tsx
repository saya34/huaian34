"use client";

import { useMemo, useState } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import type { Period } from "../types";
import SpiritFarmPanel from "./SpiritFarmPanel";
import { BeastSprite } from "./LivestockPanel";
import { HERB_CROPS, cropMaterial, farmLevel, gameTick, getFarmWeather, halfMonthCycle, nextHalfMonthDay, plotGrowth, rotatingHerbStock, type HerbCropDefinition } from "./farm";
import { SPIRIT_BEASTS, buySpiritBeast, livestockCapacity, rotatingBeastStock, syncLivestock, type SpiritBeastDefinition } from "./livestock";

type Props = { day: number; period: Period; onNotice: (message: string) => void };
type FarmModule = "field" | "livestock";
type MerchantKind = "seed" | "ranch";

const NPCS = {
  seed: {
    name: "叶青禾",
    role: "司圃灵植师",
    image: "/assets/commission-npcs/shen-qingluo.webp",
    greeting: "每一粒种子都有自己的时辰。你若肯常来，我便把压箱底的灵种也交给你。",
    talk: ["今晨东畦的露水最清，水行仙草会格外舒展。", "别只盯着成熟的花叶，根须安不安稳，也要听土说话。", "你来得正好，我刚从行脚商手里换到一批异种灵籽。"],
  },
  ranch: {
    name: "宁绾秋",
    role: "灵兽苑主",
    image: "/assets/commission-npcs/su-yeli.webp",
    greeting: "灵兽认的不是契书，是照料它的人。先让它吃饱，再慢慢学会信你。",
    talk: ["睡着的灵兽也听得见脚步，轻一些，它们会记住你的气息。", "灵兽的性情各不相同，亲和够了，产物也会更有灵性。", "本期有几只远道而来的小家伙，过了半月便随商队离开。"],
  },
} as const;

function bondTitle(value: number) {
  if (value >= 35) return "生死知交";
  if (value >= 20) return "倾心相许";
  if (value >= 10) return "相熟相知";
  if (value >= 5) return "渐生信赖";
  return "初次相识";
}

function FarmMerchant({ kind, day, period, onClose, onNotice }: { kind: MerchantKind; day: number; period: Period; onClose: () => void; onNotice: (message: string) => void }) {
  const { state, setFarm, applyEffects } = useUnifiedGame();
  const [tab, setTab] = useState<"talk" | "shop">("shop");
  const [message, setMessage] = useState(NPCS[kind].greeting);
  const npc = NPCS[kind];
  const level = farmLevel(state.farm.experience);
  const bond = state.farm.npcBonds[kind];
  const cycle = halfMonthCycle(day);
  const nextRefresh = nextHalfMonthDay(day);
  const permanent = kind === "seed" ? HERB_CROPS.filter((entry) => entry.stockType === "resident") : SPIRIT_BEASTS.filter((entry) => entry.stockType === "resident");
  const rotating = kind === "seed" ? rotatingHerbStock(day) : rotatingBeastStock(day);

  function announce(copy: string) { setMessage(copy); onNotice(copy); }

  function talk() {
    const alreadyTalked = state.farm.npcTalkDays[kind] === day;
    const copy = npc.talk[(day + cycle + (kind === "ranch" ? 1 : 0)) % npc.talk.length];
    if (alreadyTalked) { setMessage(copy); return; }
    setFarm((current) => ({ ...current, npcBonds: { ...current.npcBonds, [kind]: current.npcBonds[kind] + 2 }, npcTalkDays: { ...current.npcTalkDays, [kind]: day } }));
    announce(`${copy} · ${npc.name}好感 +2`);
  }

  function buySeed(crop: HerbCropDefinition, quantity: number) {
    const locked = level < crop.unlockLevel || (crop.stockType === "resident" && bond < crop.bondRequired);
    const cost = crop.seedPrice * quantity;
    if (locked) { announce(`还需灵圃 ${crop.unlockLevel} 阶、与${npc.name}好感 ${crop.bondRequired} 才能购买。`); return; }
    if (state.shared.spiritStones < cost) { announce(`灵石不足，还差 ${cost - state.shared.spiritStones} 枚。`); return; }
    setFarm((current) => ({ ...current, seeds: { ...current.seeds, [crop.id]: (current.seeds[crop.id] ?? 0) + quantity } }));
    applyEffects([{ type: "add_currency", amount: -cost }]);
    announce(`购得${crop.seedName} ×${quantity} · 灵石 -${cost}`);
  }

  function buyBeast(beast: SpiritBeastDefinition) {
    const locked = level < beast.unlockLevel || (beast.stockType === "resident" && bond < beast.bondRequired);
    if (locked) { announce(`还需灵圃 ${beast.unlockLevel} 阶、与${npc.name}好感 ${beast.bondRequired} 才能迎养。`); return; }
    if (state.shared.spiritStones < beast.price) { announce(`迎养${beast.name}还缺 ${beast.price - state.shared.spiritStones} 灵石。`); return; }
    const livestock = syncLivestock(state.farm.livestock, gameTick(day, period));
    const result = buySpiritBeast(livestock, beast.id, gameTick(day, period), level);
    if (!result.ok) { announce(result.message); return; }
    setFarm((current) => ({ ...current, livestock: result.progress }));
    applyEffects([{ type: "add_currency", amount: -beast.price }]);
    announce(`${result.message} · 灵石 -${beast.price}`);
  }

  function renderSeed(crop: HerbCropDefinition, rotatingItem = false) {
    const locked = level < crop.unlockLevel || (!rotatingItem && bond < crop.bondRequired);
    const material = cropMaterial(crop);
    return <article key={crop.id} className={`farm-goods-card ${locked ? "locked" : ""}`}>
      <div className="goods-art"><img src={material.image} alt="" /><i>{crop.element}</i>{rotatingItem && <b>限</b>}</div>
      <div><strong>{crop.seedName}</strong><small>{crop.growTicks} 时辰 · 产出 {crop.materialName}</small><em>{locked ? `需${crop.unlockLevel}阶 · 好感${crop.bondRequired}` : crop.lore}</em></div>
      <span><b>◉ {crop.seedPrice}</b><button type="button" disabled={locked} onClick={() => buySeed(crop, 1)}>买 1</button><button type="button" disabled={locked} onClick={() => buySeed(crop, 5)}>买 5</button></span>
    </article>;
  }

  function renderBeast(beast: SpiritBeastDefinition, rotatingItem = false) {
    const locked = level < beast.unlockLevel || (!rotatingItem && bond < beast.bondRequired);
    return <article key={beast.id} className={`farm-goods-card beast-goods ${locked ? "locked" : ""}`}>
      <div className="goods-art"><BeastSprite speciesId={beast.id} />{rotatingItem && <b>限</b>}</div>
      <div><strong>{beast.name}</strong><small>{beast.role} · {beast.productionTicks} 时辰生产</small><em>{locked ? `需${beast.unlockLevel}阶 · 好感${beast.bondRequired}` : `投喂${beast.feedMaterialName}，产出${beast.productName}`}</em></div>
      <span><b>◉ {beast.price}</b><button type="button" disabled={locked || state.farm.livestock.animals.length >= livestockCapacity(level)} onClick={() => buyBeast(beast)}>迎养</button></span>
    </article>;
  }

  return <div className={`farm-merchant-backdrop merchant-${kind}`} role="dialog" aria-modal="true" aria-label={`${npc.name}的货架`}>
    <section className="farm-merchant-window">
      <aside className="farm-merchant-character"><img src={npc.image} alt={`${npc.name}立绘`} /><div><small>{npc.role}</small><h2>{npc.name}</h2><span>{bondTitle(bond)} · 好感 {bond}</span></div></aside>
      <main>
        <header><div><small>{kind === "seed" ? "SPIRIT SEED EMPORIUM" : "SPIRIT BEAST HOUSE"}</small><h3>{kind === "seed" ? "青禾灵种铺" : "绾秋灵兽苑"}</h3></div><div className="merchant-tabs"><button className={tab === "shop" ? "active" : ""} onClick={() => setTab("shop")}>货架</button><button className={tab === "talk" ? "active" : ""} onClick={() => setTab("talk")}>交谈</button></div><button className="merchant-close" onClick={onClose}>×</button></header>
        {tab === "talk" ? <div className="farm-npc-talk"><div className="talk-seal">{npc.name.slice(0, 1)}</div><p>{message}</p><button type="button" onClick={talk}>{state.farm.npcTalkDays[kind] === day ? "再聊一会" : "请教今日心得"}</button><small>每日首次交谈提升 2 点好感；好感与灵圃等阶共同解锁常驻货品。</small></div> : <div className="farm-merchant-stock">
          <div className="merchant-ledger"><span>持有灵石 <b>◉ {state.shared.spiritStones}</b></span><span>灵圃 <b>{level} 阶</b></span><span>往来 <b>{bondTitle(bond)}</b></span><span>栏舍 <b>{state.farm.livestock.animals.length}/{livestockCapacity(level)}</b></span></div>
          <section><header><div><b>常驻货架</b><small>随灵圃等阶与好感逐步扩充</small></div><em>{permanent.length} 种</em></header><div className="farm-goods-list">{kind === "seed" ? (permanent as HerbCropDefinition[]).map((item) => renderSeed(item)) : (permanent as SpiritBeastDefinition[]).map((item) => renderBeast(item))}</div></section>
          <section className="rotating-stock"><header><div><b>流光异货 · 第 {cycle + 1} 期</b><small>游戏内每十五日随商队轮换</small></div><em>第 {nextRefresh} 日刷新</em></header><div className="farm-goods-list">{kind === "seed" ? (rotating as HerbCropDefinition[]).map((item) => renderSeed(item, true)) : (rotating as SpiritBeastDefinition[]).map((item) => renderBeast(item, true))}</div></section>
        </div>}
        <footer><i>{kind === "seed" ? "禾" : "苑"}</i><p>{message}</p><b>第 {day} 日 · {period}</b></footer>
      </main>
    </section>
  </div>;
}

export default function SpiritFarmScene({ day, period, onNotice }: Props) {
  const { state } = useUnifiedGame();
  const [module, setModule] = useState<FarmModule | null>(null);
  const [merchant, setMerchant] = useState<MerchantKind | null>(null);
  const tick = gameTick(day, period);
  const weather = getFarmWeather(day);
  const level = farmLevel(state.farm.experience);
  const readyCrops = useMemo(() => state.farm.plots.filter((plot) => plotGrowth(plot, tick, weather).ready).length, [state.farm.plots, tick, weather]);
  const growingCrops = state.farm.plots.filter((plot) => plot.cropId && !plotGrowth(plot, tick, weather).ready).length;
  const livestock = syncLivestock(state.farm.livestock, tick);
  const readyBeasts = livestock.animals.filter((animal) => animal.state === "ready").length;

  return <div className="farm-scene-hub" aria-label="云岫灵圃场景">
    <div className="farm-hub-heading"><small>CLOUD-CREST SPIRIT FARM</small><h2>云岫灵圃</h2><p>山泉穿过十二畦灵田，东坡药香与西苑兽铃在薄雾间相和。</p><span><i>{weather.icon}</i>{weather.name} · 第 {day} 日 {period}</span></div>
    <button type="button" className="farm-landmark field-landmark" onClick={() => setModule("field")}>
      <span className="landmark-rings"><i /><i /><b>田</b></span><div><small>十二畦灵田</small><strong>进入灵田劳作</strong><em>{readyCrops ? `${readyCrops} 畦灵光盈枝，可收获` : growingCrops ? `${growingCrops} 畦仙草正在生长` : "翻土、播种与培育炼丹仙草"}</em></div><u>进入 ›</u>
    </button>
    <button type="button" className="farm-landmark ranch-landmark" onClick={() => setModule("livestock")}>
      <span className="landmark-rings"><i /><i /><b>兽</b></span><div><small>云栖灵兽苑</small><strong>进入栏舍照料</strong><em>{readyBeasts ? `${readyBeasts} 只灵兽产物已经凝成` : livestock.animals.length ? `${livestock.animals.length} 只灵兽栖居苑中` : "投喂、抚灵与收取珍稀产物"}</em></div><u>进入 ›</u>
    </button>
    <button type="button" className="farm-scene-npc npc-seed" onClick={() => setMerchant("seed")}><img src={NPCS.seed.image} alt="叶青禾" /><span><small>{NPCS.seed.role}</small><strong>{NPCS.seed.name}</strong><em>{bondTitle(state.farm.npcBonds.seed)} · 灵种交易</em></span><b>交谈</b></button>
    <button type="button" className="farm-scene-npc npc-ranch" onClick={() => setMerchant("ranch")}><img src={NPCS.ranch.image} alt="宁绾秋" /><span><small>{NPCS.ranch.role}</small><strong>{NPCS.ranch.name}</strong><em>{bondTitle(state.farm.npcBonds.ranch)} · 灵兽迎养</em></span><b>交谈</b></button>
    <div className="farm-hub-overview"><span><small>灵圃等阶</small><b>{level} 阶</b></span><span><small>成熟灵草</small><b>{readyCrops}</b></span><span><small>苑中灵兽</small><b>{livestock.animals.length}</b></span><span><small>异货刷新</small><b>第 {nextHalfMonthDay(day)} 日</b></span></div>
    {module && <SpiritFarmPanel key={module} day={day} period={period} initialView={module} onClose={() => setModule(null)} onNotice={onNotice} />}
    {merchant && <FarmMerchant kind={merchant} day={day} period={period} onClose={() => setMerchant(null)} onNotice={onNotice} />}
  </div>;
}
