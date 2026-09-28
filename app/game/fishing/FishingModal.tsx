"use client";

import { useEffect, useMemo, useState } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { MATERIALS } from "../alchemy/item-data";
import FishingEncounter from "./FishingEncounter";
import type { FishingReelResult } from "./FishingReelGame";
import RareCatchReveal from "./RareCatchReveal";
import {
  BAITS,
  CHUMS,
  addExtraFishingAttempts,
  FISH,
  abandonFishingEscape,
  castFishing,
  collectAgedFish,
  extraReelPackPrice,
  fishById,
  fishingAttemptLimit,
  fishingLocationById,
  processFishIntoBait,
  reelFishing,
  remainingFishingAttempts,
  resetFishingDay,
  retryFishing,
  startFishAging,
  weightedPool,
  type BaitId,
  type ChumId,
  type FishDefinition,
  type FishingLocationId,
  type FishingLinkToolId,
} from "./fishing";
import { useFeedback } from "../feedback/FeedbackProvider";
import { itemAcquiredFeedback } from "../feedback/item-acquired";
import { feedbackText } from "../feedback/texts";
import GatheringCareerPanel from "../gathering/GatheringCareerPanel";
import { gatheringCopy } from "../gathering/content";
import { resolveGatheringOutcome, selectedTool } from "../gathering/engine";
import reelUi from "./content/reel-ui.json";
import { createActivityReceipt } from "../core/activity-receipt";
import RotarySelector from "../ui/RotarySelector";
import { FISHING_SECOND_CATCH_MANUAL } from "../skills/manual-items";
import { FISHING_LINK_CONTENT, chumRecipe, fishingTool, fishingToolMaterials, resolveFishingLinkDiscovery, type FishingLinkDiscovery } from "../cross-system/fishing-links";

type Props = {
  locationId: FishingLocationId;
  randomSpotId?: string;
  day: number;
  period: string;
  onClose: () => void;
  onNotice: (message: string) => void;
};

type Phase = "ready" | "reeling" | "success" | "failed";
type MobileDrawer = "codex" | "kit" | null;
const RARITY_LABELS = ["凡品", "灵品", "珍品", "玄品", "仙品"];

export default function FishingModal({ locationId, randomSpotId, day, period, onClose, onNotice }: Props) {
  const { state, setFishing, setFarm, setAlchemy, setGathering, applyEffects } = useUnifiedGame();
  const feedback = useFeedback();
  const location = fishingLocationById(locationId)!;
  const progress = resetFishingDay(state.fishing, day);
  const periods=["清晨","上午","午后","黄昏","夜晚","深夜"];
  const tick = (Math.max(1, day) - 1) * periods.length + Math.max(0, periods.indexOf(period));
  const resumedCast = progress.pendingCast?.locationId === locationId ? progress.pendingCast : null;
  const [baitId, setBaitId] = useState<BaitId>("spirit-worm");
  const [chumId, setChumId] = useState<ChumId>(resumedCast?.chumId ?? "none");
  const [phase, setPhase] = useState<Phase>(resumedCast ? "reeling" : "ready");
  const [target, setTarget] = useState<FishDefinition | null>(resumedCast ? fishById(resumedCast.fishId) ?? null : null);
  const [castRound, setCastRound] = useState(0);
  const [showRareReveal, setShowRareReveal] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState<MobileDrawer>(null);
  const [failureReason, setFailureReason] = useState<FishingReelResult["failureReason"]>("escaped");
  const [linkDiscovery, setLinkDiscovery] = useState<FishingLinkDiscovery | null>(null);
  const fishingCareer = state.gathering.careers.fishing;
  const activeRod = selectedTool("fishing", fishingCareer);
  const mealLuckBonus = state.shared.luck.charges > 0 ? state.shared.luck.bonus : 0;
  const pool = useMemo(() => weightedPool(location, baitId, chumId, fishingCareer, mealLuckBonus, progress.links.activeToolId), [baitId, chumId, location, fishingCareer, mealLuckBonus, progress.links.activeToolId]);
  const attemptLimit = fishingAttemptLimit(progress);
  const attemptsLeft = remainingFishingAttempts(progress, day);
  useEffect(() => {
    const busy = phase === "reeling" || showRareReveal;
    feedback.setBusy("fishing", busy);
    return () => feedback.setBusy("fishing", false);
  }, [feedback, phase, showRareReveal]);

  function buyBait(id: BaitId) {
    const price = BAITS[id].price;
    if (state.shared.spiritStones < price) { onNotice(`灵石不足，购买${BAITS[id].name}需要 ${price} 枚。`); return; }
    applyEffects([{ type: "add_currency", amount: -price }]);
    setFishing((current) => ({ ...current, baits: { ...current.baits, [id]: (current.baits[id] ?? 0) + 1 } }));
    onNotice(`购得${BAITS[id].name} ×1`);
  }

  function prepareCropChum(id: ChumId) {
    const recipe = chumRecipe(id); if (!recipe) { onNotice("请选择一种灵植诱鱼散。 "); return; }
    const material = MATERIALS.find((item) => item.name === recipe.materialName)!;
    if ((state.shared.items[material.id]?.amount ?? 0) < 1) { onNotice(`缺少${recipe.materialName}，请先在灵田培育。`); return; }
    applyEffects([{ type:"remove_item", itemId:material.id, amount:1 }]);
    setFishing((current)=>({...current,links:{...current.links,preparedChums:{...current.links.preparedChums,[id]:(current.links.preparedChums[id]??0)+recipe.servings}}}));
    feedback.publish({variant:"item-acquired",level:"L1",tone:"jade",titleKey:"system.dynamicMessage",bodyKey:"system.dynamicMessage",params:{message:`${recipe.label} · 可用 ${recipe.servings} 竿`},icon:CHUMS[id].icon,imageSrc:material.image,rewards:[`${CHUMS[id].name} ×${recipe.servings}`],impacts:["抛竿时优先消耗熟饵，不再消耗原料"],dedupeKey:`prepared-chum:${id}:${progress.totalCaught}`});
  }

  function selectOrCraftLinkTool(id: FishingLinkToolId) {
    if (progress.links.craftedToolIds.includes(id)) { setFishing((current)=>({...current,links:{...current.links,activeToolId:id}})); onNotice(`已换用${fishingTool(id).name}`); return; }
    const requirements=fishingToolMaterials(id);
    const missing=requirements.find((entry)=>(state.shared.items[entry.item.id]?.amount??0)<entry.amount);
    if(missing){onNotice(`锻制${fishingTool(id).name}还缺${missing.materialName} ×${missing.amount}`);return;}
    applyEffects(requirements.map((entry)=>({type:"remove_item" as const,itemId:entry.item.id,amount:entry.amount})));
    setFishing((current)=>({...current,links:{...current.links,craftedToolIds:[...new Set([...current.links.craftedToolIds,id])],activeToolId:id}}));
    feedback.publish({variant:"progression-milestone",level:"L2",tone:"gold",titleKey:"system.dynamicMessage",bodyKey:"system.dynamicMessage",params:{message:`矿材钓具锻成 · ${fishingTool(id).name}`},icon:fishingTool(id).icon,rewards:[fishingTool(id).description],costs:requirements.map((entry)=>`${entry.materialName} -${entry.amount}`),dedupeKey:`fishing-tool:${id}`});
  }

  function buyExtraReels() {
    const price = extraReelPackPrice(progress.reelPacksBought);
    if (state.shared.spiritStones < price) { onNotice(`补充五次定力需要 ${price} 灵石。`); return; }
    applyEffects([{ type: "add_currency", amount: -price }]);
    setFishing((current) => addExtraFishingAttempts(current, day));
    onNotice(`追加五次垂钓定力 · 灵石 -${price}`);
  }

  function castRod() {
    const chum = CHUMS[chumId];
    const chumMaterial = chum.materialName ? MATERIALS.find((item) => item.name === chum.materialName) : null;
    const preparedChum=(progress.links.preparedChums[chumId]??0)>0;
    if (chumMaterial && !preparedChum && (state.shared.items[chumMaterial.id]?.amount ?? 0) < 1) { onNotice(`缺少${chum.materialName}，请先在灵田培育或制成饵团。`); return; }
    const cast = castFishing(progress, { day, tick, location, baitId, chumId, randomSpotId, career:fishingCareer, luckBonus: mealLuckBonus, linkToolId:progress.links.activeToolId, consumePreparedChum:preparedChum });
    if (!cast.ok) { onNotice(cast.message); return; }
    const fish = fishById(cast.catch.fishId)!;
    setTarget(fish); setMobileDrawer(null); setFailureReason(undefined);
    setPhase("reeling"); setCastRound((value) => value + 1);
    setFishing(cast.progress);
    applyEffects([
      ...(chumMaterial && !preparedChum ? [{ type: "remove_item" as const, itemId: chumMaterial.id, amount: 1 }] : []),
      ...(mealLuckBonus > 0 ? [{ type: "consume_luck_charge" as const }] : []),
    ]);
    // The fish shadow and water pattern carry the rarity hint in-scene. Do not
    // name or celebrate the catch before the reel result is known.
  }

  function finishReeling(result: FishingReelResult) {
    if (!target) return;
    if (result.success) {
      setPhase("success");
      const firstObtain = (progress.records[target.id] ?? 0) === 0;
      setShowRareReveal(target.rarity >= 4 && firstObtain);
      const reel = reelFishing(progress.pendingCast ? progress : state.fishing, true);
      const linked = reel.ok ? resolveFishingLinkDiscovery({ links:reel.progress.links, catchNumber:reel.progress.totalCaught, fish:target, locationId:location.id, seed:reel.progress.lastEscape?.seed ?? `${day}:${tick}:${target.id}:${reel.progress.totalCaught}` }) : { links:progress.links, discovery:null };
      let nextLinks=linked.links;
      const careerResult=resolveGatheringOutcome(state.gathering,{professionId:"fishing",itemId:target.id,name:target.name,rarity:target.rarity,art:target.art,location:location.name,tick,seed:`fish:${day}:${tick}:${target.id}:${progress.totalCaught}`,tags:["水产",location.kind === "random" ? "游光钓点" : "常驻钓点"]});
      setGathering(careerResult.progress);
      const rewards = [
        { type: "add_item", item: { itemId: target.id, itemType: "fish", rarity: target.rarity, amount: 1, sourceTags: [location.name,"水产", location.kind === "random" ? "游光钓点" : "常驻钓点"] } },
        { type: "add_player_exp", amount: target.rarity * 3 },
      ] as Parameters<typeof applyEffects>[0];
      if(careerResult.companion)rewards.push({type:"add_item",item:{itemId:careerResult.companion.id,itemType:careerResult.companion.itemType,rarity:careerResult.companion.rarity as 1|2|3|4|5,amount:1,sourceTags:["钓鱼伴生",...careerResult.companion.tags],locked:careerResult.companion.locked}});
      if (reel.ok && reel.mapFragment) rewards.push({ type: "add_item", item: { itemId: "river-map-fragment", itemType: "quest", rarity: 4, amount: 1, sourceTags: ["钓鱼", "河图残片"] } });
      const isSecondSuccessfulCatch = progress.totalCaught + 1 === 2;
      if (isSecondSuccessfulCatch && !state.shared.learnedSkills.includes(FISHING_SECOND_CATCH_MANUAL.skillId) && !state.shared.items[FISHING_SECOND_CATCH_MANUAL.itemId]?.amount) {
        rewards.push({ type: "add_item", item: { itemId: FISHING_SECOND_CATCH_MANUAL.itemId, itemType: "manual", rarity: FISHING_SECOND_CATCH_MANUAL.rarity, amount: 1, sourceTags: [location.name, "第二次垂钓奇遇", "功法玉简"] } });
        nextLinks={...nextLinks,discoveredIds:[...new Set([...nextLinks.discoveredIds,FISHING_LINK_CONTENT.fullManual.discoveryId])]};
      }
      if(linked.discovery?.item)rewards.push({type:"add_item",item:linked.discovery.item});
      if(linked.discovery?.seed)setFarm((current)=>({...current,seeds:{...current.seeds,[linked.discovery!.seed!.cropId]:(current.seeds[linked.discovery!.seed!.cropId]??0)+linked.discovery!.seed!.amount}}));
      if(linked.discovery?.recipeId)setAlchemy((current)=>({...current,discoveredRecipes:[...new Set([...current.discoveredRecipes,linked.discovery!.recipeId!])]}));
      setFishing({...reel.progress,links:nextLinks});
      setLinkDiscovery(linked.discovery);
      const receipt=createActivityReceipt({ kind: "fishing", title: `钓得 · ${target.name}`, summary: `${location.name}的鱼获已完整收入乾坤行囊。`, rewards: [`${target.name} ×1`, careerResult.companion ? `${careerResult.companion.name} ×1` : reel.ok && reel.mapFragment ? "河图残片 ×1" : `修为 +${target.rarity * 3}`], impacts: [`听澜师经验 +${careerResult.experience}`, "任务与配方进度已同步"], nextStep: { target: "inventory", label: "查看鱼获与可用配方" } });
      rewards.push({ type: "record_activity", receipt });
      applyEffects(rewards);
      if (target.rarity >= 4 && firstObtain) feedback.publish({
        variant: "rare-reward", level: "L0", priority: 1, tone: "gold",
        titleKey: "items.rareTitle", bodyKey: "items.rareBody", params: { name: target.name, amount: 1 },
        icon: target.icon, imageSrc: target.art, receiptId: receipt.id, presentationOwner: "fishing",
        firstObtain, record: true, rewards: receipt.rewards, impacts: receipt.impacts,
      });
      else feedback.publish(itemAcquiredFeedback({
        name: target.name,
        amount: 1,
        description: target.description,
        imageSrc: target.art,
        rarity: target.rarity,
        eventId: receipt.id,
        presentationOwner: "fishing",
      }));
      return;
    }
    setPhase("failed");
    setFailureReason(result.failureReason ?? "escaped");
    setFishing((current) => reelFishing(current, false).progress);
    // Failure reason remains on the fishing stage; a second global toast would
    // cover the retry/leave decision and repeat the same information.
  }

  function retryEscaped() {
    const cost = 1000;
    if (state.shared.spiritStones < cost) { onNotice(`追回鱼影需要 ${cost} 灵石。`); return; }
    const result = retryFishing(state.fishing);
    if (!result.ok) { onNotice(result.message); return; }
    applyEffects([{ type: "add_currency", amount: -cost }]);
    setFishing(result.progress); setTarget(fishById(result.catch.fishId) ?? null); setPhase("reeling"); setCastRound((value) => value + 1); onNotice(`${result.message} · 灵石 -${cost}`);
  }

  function leaveFishing() {
    if (phase === "failed") setFishing((current) => abandonFishingEscape(current));
    onClose();
  }

  function continueFishing() {
    if (phase === "failed") setFishing((current) => abandonFishingEscape(current));
    setShowRareReveal(false); setLinkDiscovery(null); setPhase("ready"); setTarget(null);
  }

  function ageCatch() {
    if (!target || (state.shared.items[target.id]?.amount ?? 0) < 1) { onNotice("这尾灵鱼已经不在行囊中。"); return; }
    const result = startFishAging(state.fishing, target.id, tick); if (!result.ok) { onNotice(result.message); return; }
    setFishing(result.progress); applyEffects([{ type: "remove_item", itemId: target.id, amount: 1 }]); onNotice(result.message); setTarget(null); setPhase("ready");
  }

  function processCatch() {
    if (!target || (state.shared.items[target.id]?.amount ?? 0) < 1) { onNotice("这尾灵鱼已经不在行囊中。"); return; }
    const result = processFishIntoBait(state.fishing, target.id); if (!result.ok) { onNotice(result.message); return; }
    setFishing(result.progress); applyEffects([{ type: "remove_item", itemId: target.id, amount: 1 }]); onNotice(result.message); setTarget(null); setPhase("ready");
  }

  function collectAged(slotId: string) {
    const result = collectAgedFish(state.fishing, slotId, tick); if (!result.ok) { onNotice(result.message); return; }
    setFishing(result.progress); applyEffects([{ type: "add_item", item: { itemId: `aged-${result.fish.id}`, itemType: "fish", rarity: Math.min(5, result.fish.rarity + 1) as 1|2|3|4|5, amount: 1, sourceTags: ["听澜陈化", result.fish.name] } }]); onNotice(`${result.message} · 已收入行囊`);
  }

  return <div className="fishing-backdrop" role="presentation" onMouseDown={leaveFishing}>
    <section className={`fishing-window chum-${chumId} link-tool-${progress.links.activeToolId}`} role="dialog" aria-modal="true" aria-label={`${location.name}钓鱼`} onMouseDown={(event) => event.stopPropagation()}>
      <header className="fishing-heading">
        <div className="fishing-location-heading" role="button" tabIndex={0} onClick={() => feedback.inspect({titleKey:"fishing.pointTitle",bodyKey:"world.changeBody",params:{message:location.subtitle},icon:"钓",details:[{labelKey:"world.locationLabel",value:location.name,emphasis:true},{labelKey:"fishing.kindLabel",value:feedbackText(location.kind === "random" ? "fishing.kindRandom" : "fishing.kindResident")},{labelKey:"fishing.periodLabel",value:period},{labelKey:"fishing.poolLabel",value:pool.map((entry)=>FISH.find((fish)=>fish.id===entry.fishId)?.name).filter(Boolean).join(feedbackText("system.listSeparator"))},{labelKey:"fishing.baitLabel",value:BAITS[baitId].name}],dedupeKey:`fishing:location:${location.id}:${day}:${period}`})} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" ")event.currentTarget.click()}}><small>SPIRIT ANGLING · {feedbackText(location.kind === "random" ? "fishing.kindRandom" : "fishing.kindResident")}</small><h2>{location.name}</h2><p>{location.subtitle} · 第 {day} 日 {period}</p></div>
        <div className="fishing-attempts"><span>今日抛竿</span><strong>{attemptsLeft}<small> / {attemptLimit}</small></strong><em>{activeRod.name} · {fishingCareer.toolTier}阶</em></div>
        <div className="fishing-mobile-vitals" aria-label={`${location.name}，${period}，体力 ${state.romance.stamina}，灵石 ${state.shared.spiritStones}`}><span><small>{location.name}</small><b>{period}</b></span><i>{reelUi.staminaShort} {state.romance.stamina}</i><i>{reelUi.currencyShort} {state.shared.spiritStones.toLocaleString()}</i>{state.shared.luck.charges>0&&<i className="meal-luck-vital">福 {state.shared.luck.bonus}阶×{state.shared.luck.charges}</i>}</div>
        <button type="button" onClick={leaveFishing} aria-label="离开钓点">×</button>
      </header>

      <div className={`fishing-content fishing-phase-${phase} ${phase === "reeling" ? "fishing-content-active" : ""} ${mobileDrawer ? "has-mobile-drawer" : ""}`}>
        <aside className={`fish-pool-panel mobile-game-drawer ${mobileDrawer === "codex" ? "drawer-open" : ""}`}>
          <header><span>本地鱼谱</span><small>鱼饵会改变咬钩权重</small><button type="button" className="mobile-drawer-close" onClick={() => setMobileDrawer(null)}>{reelUi.drawerClose}</button></header>
          <div className="fish-pool-list">{pool.map((entry) => { const fish = FISH.find((item) => item.id === entry.fishId)!; const known=Boolean(progress.records[fish.id]); return <article key={fish.id} role="button" tabIndex={0} onClick={() => feedback.inspect({titleKey:"fishing.codexTitle",bodyKey:known?"fishing.codexBody":"fishing.codexUnknown",params:{name:known?fish.name:"?",description:known?fish.description:"",probability:`${(entry.probability*100).toFixed(entry.probability<.1?1:0)}%`},icon:known?fish.icon:"?",imageSrc:known?fish.art:undefined,details:[{labelKey:"items.rarityLabel",value:known?RARITY_LABELS[fish.rarity-1]:feedbackText("shop.unidentifiedLabel")},{labelKey:"items.valueLabel",value:known?fish.value:feedbackText("system.none")},{labelKey:"fishing.catchChance",value:`${(entry.probability*100).toFixed(entry.probability<.1?1:0)}%`},{labelKey:"items.countLabel",value:progress.records[fish.id]??0}],dedupeKey:`fish-codex:${fish.id}:${known}`})} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" ")event.currentTarget.click()}} className={known ? "caught" : "unknown"}>
            <div className="fish-token" style={{ backgroundImage: `url(${fish.art})` }}><b>{progress.records[fish.id] ? fish.icon : "?"}</b></div>
            <div><strong>{progress.records[fish.id] ? fish.name : "未录灵鱼"}</strong><small>{RARITY_LABELS[fish.rarity - 1]} · {(entry.probability * 100).toFixed(entry.probability < .1 ? 1 : 0)}%</small></div>
            <em>×{progress.records[fish.id] ?? 0}</em>
          </article>; })}</div>
          <footer>鱼获总数 <b>{progress.totalCaught}</b> · 已识 {Object.keys(progress.records).length}/{FISH.length}</footer>
        </aside>

        <main className="fishing-stage-panel">
          {phase === "ready" && <div className="fishing-ready">
            <div className="fishing-ready-scene"><div className="fishing-cast-rig" aria-hidden="true"><i /><b /><u /><span /></div><div className="fishing-ready-waterlife" aria-hidden="true"><i/><i/><i/></div><div className="fishing-water-orb"><i /><span>{fishingTool(progress.links.activeToolId).icon}</span><b /></div><h3>{chumId === "none" ? "择饵听澜" : `${CHUMS[chumId].name}已化入水脉`}</h3><p>{chumId === "none" ? (location.kind === "random" ? "这处游光只容一次抛竿；无论得失，收线后光点都会散去。" : "水面灵息平稳，可以反复垂钓，直到今日定力耗尽。") : `水色与鱼影已经改变 · 当前钓组「${fishingTool(progress.links.activeToolId).name}」`}</p></div>
            <div className="fishing-ready-controls"><div className="fishing-tackle-wheels">
              <RotarySelector direction="horizontal" className="fishing-bait-wheel" items={(Object.keys(BAITS) as BaitId[]).map((id) => ({ id, name: BAITS[id].name, glyph: BAITS[id].icon, meta: gatheringCopy(reelUi.heldCount, { count: progress.baits[id] ?? 0 }), disabled: (progress.baits[id] ?? 0) <= 0 }))} value={baitId} onChange={(id) => setBaitId(id as BaitId)} ariaLabel={reelUi.baitWheelAria} caption={reelUi.baitWheelCaption} previousLabel={reelUi.previousBait} nextLabel={reelUi.nextBait} activateLabel={reelUi.selectBait} />
              <RotarySelector direction="horizontal" className="fishing-chum-wheel" items={(Object.keys(CHUMS) as ChumId[]).map((id) => { const chum = CHUMS[id]; const material = chum.materialName ? MATERIALS.find((item) => item.name === chum.materialName) : null; const prepared=progress.links.preparedChums[id]??0;return { id, name: chum.name, glyph: chum.icon, image: material?.image, meta: material ? `熟饵 ${prepared} · 灵材 ${state.shared.items[material.id]?.amount ?? 0}` : "无需材料" }; })} value={chumId} onChange={(id) => setChumId(id as ChumId)} ariaLabel={reelUi.chumWheelAria} caption={reelUi.chumWheelCaption} previousLabel={reelUi.previousChum} nextLabel={reelUi.nextChum} activateLabel={reelUi.selectChum} />
            </div>
            <div className="fish-aging-rack">{progress.aging.map((slot) => { const fish = fishById(slot.fishId)!; const ready = slot.readyAtTick <= tick; return <button type="button" key={slot.id} className={ready ? "ready" : ""} onClick={() => collectAged(slot.id)}><span style={{backgroundImage:`url(${fish.art})`}}/><b>{ready ? "收" : slot.readyAtTick - tick}</b><small>{ready ? `${fish.name}陈化完成` : `${fish.name} · 听澜陈化中`}</small></button>; })}{Array.from({length: Math.max(0, 3 - progress.aging.length)},(_,index)=><i key={index}>空篓</i>)}</div>
            <div className="fishing-mobile-career"><GatheringCareerPanel professionId="fishing" onNotice={onNotice}/></div>
            <button className="cast-rod-button mobile-thumb-action" type="button" disabled={attemptsLeft <= 0 || (progress.baits[baitId] ?? 0) <= 0} onClick={castRod}><span>{activeRod.name} · {BAITS[baitId].name} -1</span><strong>{reelUi.castAction}</strong></button></div>
          </div>}

          {phase === "reeling" && target && <FishingEncounter key={`${target.id}-${castRound}`} fishId={target.id} rarity={target.rarity} config={{ maxAttempts: 6 + target.rarity, targetScore: 6 + target.rarity * 2, difficultyLevel: Math.max(1,Math.min(9, target.rarity * 2 + (location.kind === "random" ? 1 : 0)-(activeRod.trait==="stable"?1:0))), difficultyName: `${RARITY_LABELS[target.rarity - 1]}鱼影`, rarity:target.rarity }} onFinish={finishReeling} />}

          {(phase === "success" || phase === "failed") && <div className={`fishing-result ${phase} failure-${failureReason ?? "escaped"}`}>
            {phase === "success" && target ? <><div className="catch-art" style={{ backgroundImage: `url(${target.art})` }}><b>{target.icon}</b></div><small>{RARITY_LABELS[target.rarity - 1]} · 估值 {target.value} 灵石</small><h3>{target.name}</h3><p>{target.description}</p><strong>已收入乾坤行囊</strong><div className="catch-processing"><button type="button" onClick={ageCatch}>收入听澜篓陈化</button><button type="button" onClick={processCatch}>就地制成鱼饵</button></div></> : <><div className="catch-art escaped"><b>{failureReason === "line-break" ? "断" : failureReason === "missed-bite" ? "迟" : "澜"}</b></div><small>灵线已静</small><h3>{failureReason === "line-break" ? reelUi.failureBreakTitle : failureReason === "missed-bite" ? reelUi.failureMissedTitle : reelUi.failureEscapeTitle}</h3><p>{failureReason === "line-break" ? reelUi.failureBreakBody : failureReason === "missed-bite" ? reelUi.failureMissedBody : reelUi.failureEscapeBody}</p></>}
            {phase === "failed" && <button type="button" className="retry-fish" onClick={retryEscaped}>循波追回 · ◉ 1000</button>}
            <button type="button" onClick={() => location.kind === "resident" ? continueFishing() : leaveFishing()}>{location.kind === "resident" ? "放弃鱼影 · 再听一竿" : "放弃鱼影 · 返回山河图"}</button>
          </div>}
          {linkDiscovery&&<div className={`fishing-link-discovery link-${linkDiscovery.kind}`} role="dialog" aria-label={`联动发现：${linkDiscovery.name}`}><button type="button" onClick={()=>setLinkDiscovery(null)} aria-label="收起联动发现">×</button><div className="link-discovery-ripples"><i/><i/><i/></div><img src={linkDiscovery.image} alt=""/><span><small>跨系统奇遇 · {linkDiscovery.kind === "seed" ? "灵田" : linkDiscovery.kind === "mining-clue" ? "矿洞" : linkDiscovery.kind === "alchemy-recipe" || linkDiscovery.kind === "pearl" ? "炼丹" : "人物"}</small><h3>{linkDiscovery.name}</h3><p>{linkDiscovery.description}</p><b>{linkDiscovery.kind === "seed" ? "灵种已进入灵田种匣" : linkDiscovery.kind === "alchemy-recipe" ? "丹方已录入玄火丹炉" : linkDiscovery.kind === "mining-clue" ? "可在矿洞循纹寻路" : linkDiscovery.kind === "relic" ? "可向关联人物出示" : "已进入炼丹灵材库存"}</b></span></div>}
          {showRareReveal && target && <RareCatchReveal fish={target} firstObtain onClose={() => setShowRareReveal(false)} />}
        </main>

        <aside className={`bait-shop-panel mobile-game-drawer ${mobileDrawer === "kit" ? "drawer-open" : ""}`}>
          <header><span>行脚渔篓</span><small>补充灵饵与垂钓定力</small><button type="button" className="mobile-drawer-close" onClick={() => setMobileDrawer(null)}>{reelUi.drawerClose}</button></header>
          <GatheringCareerPanel professionId="fishing" onNotice={onNotice}/>
          {(Object.keys(BAITS) as BaitId[]).map((id) => <article key={id}><b>{BAITS[id].icon}</b><div><strong>{BAITS[id].name}</strong><p>{BAITS[id].description}</p><small>现有 {progress.baits[id] ?? 0}</small></div><button type="button" onClick={() => buyBait(id)}>◉ {BAITS[id].price}</button></article>)}
          <section className="crop-chum-workbench"><header><span>灵植制饵</span><small>一份作物制成三竿熟饵</small></header>{FISHING_LINK_CONTENT.preparedChums.map((recipe)=>{const material=MATERIALS.find((item)=>item.name===recipe.materialName)!;return <button type="button" key={recipe.chumId} onClick={()=>prepareCropChum(recipe.chumId)}><img src={material.image} alt=""/><span><b>{CHUMS[recipe.chumId].name}</b><small>熟饵 {progress.links.preparedChums[recipe.chumId]??0} · 灵材 {state.shared.items[material.id]?.amount??0}</small></span><i>制</i></button>})}</section>
          <section className="fishing-link-tools"><header><span>矿锻钓组</span><small>点击已锻钓组切换</small></header>{FISHING_LINK_CONTENT.fishingTools.map((tool)=>{const owned=progress.links.craftedToolIds.includes(tool.id);const active=progress.links.activeToolId===tool.id;const costs=tool.materials.map((entry)=>`${entry.materialName}×${entry.amount}`).join(" · ");return <button type="button" key={tool.id} className={`${owned?"owned":"locked"} ${active?"active":""}`} onClick={()=>selectOrCraftLinkTool(tool.id)}><i>{tool.icon}</i><span><b>{tool.name}</b><small>{active?"正在使用":owned?tool.description:costs||"初始钓组"}</small></span><em>{active?"已装":owned?"换":"锻"}</em></button>})}</section>
          <footer><span>当前灵石</span><strong>◉ {state.shared.spiritStones.toLocaleString()}</strong></footer>
          <button type="button" className="extra-reel-pack" onClick={buyExtraReels}>追加五次定力 · ◉ {extraReelPackPrice(progress.reelPacksBought)}</button>
        </aside>
        {phase !== "reeling" && <nav className="fishing-mobile-drawer-tabs" aria-label="垂钓次级功能"><button type="button" className={mobileDrawer === "codex" ? "active" : ""} onClick={() => setMobileDrawer((value) => value === "codex" ? null : "codex")}><i>谱</i><span>{reelUi.drawerCodex}</span></button><button type="button" className={mobileDrawer === "kit" ? "active" : ""} onClick={() => setMobileDrawer((value) => value === "kit" ? null : "kit")}><i>篓</i><span>{reelUi.drawerKit}</span></button></nav>}
      </div>
    </section>
  </div>;
}
