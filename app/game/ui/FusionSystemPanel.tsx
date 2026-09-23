"use client";

import { useEffect, useMemo, useState } from "react";
import * as React from "react";
import { EVENTS, GIFTS } from "../content";
import { ITEM_TABLE } from "../alchemy/item-data";
import { availableAttributePoints, discardEquipment, experienceToNextLevel, identifyEquipment, moveEquipment, sortEquipment, tryEquipItem, tryUnequipItem, type MetaProgress } from "../battle/meta";
import { EquipmentBodySlot, canUseEquipment, equipmentAttributeBonus, equipmentById, equipmentRequirements, equipmentSize, equipmentValue, formatBonus, SLOT_META, type AttributeAllocation } from "../battle/progression";
import { AttributeAllocationPanel } from "../battle/AttributeAllocationPanel";
import { RARITY_META, treasureById } from "../battle/expedition";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import type { UnifiedItemStack, UnifiedItemType } from "../core/types";
import { fishById } from "../fishing/fishing";
import { livestockProductById } from "../farm/livestock";
import { useFeedback } from "../feedback/FeedbackProvider";
import { feedbackText } from "../feedback/texts";
import { gatheringItemById } from "../gathering/content";
import { computeFinalAttributes } from "../core/attributes-service";
import { itemTemplateId } from "../core/inventory-service";
import { CARD_QUALITY_NAMES } from "../core/card-service";
import CultivationArtsPanel from "../skills/CultivationArtsPanel";
import { manualItemById } from "../skills/manual-items";
import { kitchenRecipeByItemId } from "../kitchen/content";
import { eatDish } from "../kitchen/service";
import { easterEggPresentationById } from "../easter-eggs/content";
import { isEasterEggItem, revealEligibleEasterEggNotes } from "../easter-eggs/system";
import { getCalendarDate } from "../calendar-engine";

export type FusionPanelId = "profile" | "inventory" | "cards" | "skills" | "equipment";

const RARITY = ["", ...Object.values(CARD_QUALITY_NAMES)];
const TYPE_LABEL: Record<UnifiedItemType, string> = { gift: "礼物甜品", material: "炼丹灵材", pill: "丹药", food: "烟火灵膳", equipment: "装备", card: "人物卡", treasure: "秘境宝物", quest: "剧情物品", fish: "灵鱼渔获", manual: "功法玉简" };
type InventoryFilter = UnifiedItemType | "all" | "easter";
type InventoryRarityFilter = UnifiedItemStack["rarity"] | "all";
const FILTERS: Array<[string, InventoryFilter]> = [["全部", "all"], ["藏珍", "easter"], ["礼物", "gift"], ["灵材", "material"], ["丹药", "pill"], ["灵膳", "food"], ["功法", "manual"], ["装备", "equipment"], ["宝物", "treasure"], ["渔获", "fish"], ["剧情", "quest"]];

type ItemPresentation = { name: string; image: string; description: string; detail: string; position: string; atlas?: boolean; atlasSize?: string };

function itemPresentation(stack: UnifiedItemStack): ItemPresentation {
  const dish = kitchenRecipeByItemId(stack.itemId);
  if (dish) return { name: dish.name, image: dish.art, description: dish.description, detail: `灵膳 · 体力 +${dish.effects.stamina} · 修为 +${dish.effects.experience}${dish.effects.luckCharges ? ` · 食运 ${dish.effects.luckBonus}阶×${dish.effects.luckCharges}次` : ""}`, position: "center" };
  const manualItem = manualItemById(stack.itemId);
  if (manualItem) return { name: manualItem.name, image: manualItem.art, description: manualItem.description, detail: manualItem.tags.join(" · "), position: "center" };
  const alchemy = ITEM_TABLE.find((item) => item.id === itemTemplateId(stack));
  if (alchemy) return { name: stack.displayName ?? alchemy.name, image: alchemy.image, description: alchemy.effect, detail: `${stack.quality ?? alchemy.quality} · ${stack.mutation ?? "常相"} · ${alchemy.element} · ${alchemy.trait}`, position: "center" };
  const gift = GIFTS.find((item) => item.id === stack.itemId);
  if (gift) return { name: gift.name, image: gift.image, description: gift.description, detail: gift.tags.join(" · "), position: gift.imagePosition ?? "center", atlas: gift.image.includes("gift-atlas") };
  const quest = EVENTS.map((event) => event.exploration?.rewardItem).find((item) => item?.id === stack.itemId);
  if (quest) return { name: quest.name, image: quest.image, description: quest.description, detail: "藏珍录 · 剧情见证", position: quest.imagePosition ?? "center", atlas: quest.image.includes("easter-egg-atlas"), atlasSize: "500% 400%" };
  if (stack.itemId.startsWith("treasure:")) {
    const treasure = treasureById(stack.itemId.slice(9));
    return { name: treasure.name, image: treasure.art, description: treasure.description, detail: `${treasure.width}×${treasure.height} 格 · 秘境带回`, position: "center" };
  }
  const fish = stack.itemType === "fish" ? fishById(stack.itemId) : null;
  if (fish) return { name: fish.name, image: fish.art, description: fish.description, detail: `灵鱼图鉴 · 估值 ${fish.value} 灵石`, position: "center" };
  const livestock = livestockProductById(stack.itemId);
  if (livestock) return { name: livestock.productName, image: livestock.productArt, description: livestock.productDescription, detail: `灵兽苑产物 · 估值 ${livestock.productValue} 灵石`, position: "center" };
  const gathering = gatheringItemById(stack.itemId);
  if (gathering) return { name:gathering.name,image:gathering.art,description:gathering.description,detail:`${gathering.tags.join(" · ")} · 估值 ${gathering.value || "不可交易"}`,position:"center" };
  return { name: stack.itemId, image: "/assets/xuanhuo-furnace.webp", description: "尚未录入万物志的特殊物品。", detail: TYPE_LABEL[stack.itemType], position: "center" };
}

function ItemArtwork({ item, className = "" }: { item: ItemPresentation; className?: string }) {
  if (item.atlas) return <span className={`cropped-item-atlas ${className}`} style={{ backgroundImage: `url(${item.image})`, backgroundPosition: item.position, backgroundSize: item.atlasSize ?? "500% 100%" }} aria-hidden="true" />;
  return <img className={className} src={item.image} alt="" style={{ objectPosition: item.position }} />;
}

type FusionSystemPanelProps = {
  panel: FusionPanelId;
  onClose: () => void;
  giftTargetName?: string;
  onUseGift?: (giftId: string) => void;
  onEatGift?: (giftId: string) => void;
};

export default function FusionSystemPanel({ panel, onClose, giftTargetName, onUseGift, onEatGift }: FusionSystemPanelProps) {
  const { state, setRomance, setBattle, applyEffects, transact } = useUnifiedGame();
  const feedback = useFeedback();
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [rarityFilter, setRarityFilter] = useState<InventoryRarityFilter>("all");
  const [profileView, setProfileView] = useState<"allocation" | "summary">("allocation");
  const allItems = useMemo(() => Object.values(state.shared.items).filter((item) => item.amount > 0).sort((a, b) => (b.lastAcquiredAt??0)-(a.lastAcquiredAt??0) || b.rarity - a.rarity || b.amount - a.amount), [state.shared.items]);
  const categoryItems = filter === "all" ? allItems : filter === "easter" ? allItems.filter(isEasterEggItem) : allItems.filter((item) => item.itemType === filter);
  const availableRarities=useMemo(()=>[...new Set(categoryItems.map((item)=>item.rarity))].sort((a,b)=>b-a),[categoryItems]);
  const items = rarityFilter === "all" ? categoryItems : categoryItems.filter((item)=>item.rarity===rarityFilter);
  const [selectedItemId, setSelectedItemId] = useState(() => allItems[0]?.itemId ?? "");
  const [itemInspectorOpen, setItemInspectorOpen] = useState(false);
  const [noteReveal, setNoteReveal] = useState<{ itemId: string; noteIds: string[] } | null>(null);
  const selectedStack = items.find((item) => item.itemId === selectedItemId) ?? items[0];
  const selected = selectedStack ? itemPresentation(selectedStack) : null;
  const selectedManual = selectedStack ? manualItemById(selectedStack.itemId) : undefined;
  const selectedDish = selectedStack ? kitchenRecipeByItemId(selectedStack.itemId) : undefined;
  const selectedGift = selectedStack ? GIFTS.find((gift)=>gift.id===selectedStack.itemId) : undefined;
  const selectedEasterEgg = selectedStack ? easterEggPresentationById(selectedStack.itemId) : undefined;
  const selectedEasterProgress = selectedStack ? state.romance.easterEggProgress[selectedStack.itemId] : undefined;
  const acquiredDate = selectedEasterProgress ? getCalendarDate(selectedEasterProgress.acquiredDay) : null;
  const selectedManualLearned = selectedManual ? state.shared.learnedSkills.includes(selectedManual.skillId) : false;
  const learnSelectedManual = () => {
    if (!selectedStack || !selectedManual || selectedManualLearned) return;
    applyEffects([{ type: "remove_item", itemId: selectedStack.itemId, amount: 1 }, { type: "learn_skill", skillId: selectedManual.skillId }]);
  };
  const useSelectedDish=()=>{
    if(!selectedDish)return;
    const result=eatDish(state,selectedDish.id);
    if(!result.ok){feedback.toast({titleKey:"system.toastWarning",bodyKey:"world.changeBody",params:{message:result.message},icon:"盒",tone:"muted",dedupeKey:`inventory-eat-missing:${selectedDish.id}`});return}
    transact(()=>result.state);
    const staminaGain=Math.max(0,result.state.shared.stamina-state.shared.stamina);
    const levelGain=Math.max(0,result.state.shared.playerLevel-state.shared.playerLevel);
    const effects=[staminaGain?`体力 +${staminaGain}`:"",selectedDish.effects.experience?levelGain?`修为 +${selectedDish.effects.experience} · 境界 +${levelGain}`:`修为 +${selectedDish.effects.experience}`:"",selectedDish.effects.luckCharges?`食运 ${selectedDish.effects.luckBonus}阶×${selectedDish.effects.luckCharges}次`:""].filter(Boolean).join(" · ");
    feedback.publish({variant:"action-toast",level:"L1",priority:2,tone:selectedDish.effects.luckCharges?"gold":"jade",titleKey:"system.toastSuccess",bodyKey:"world.changeBody",params:{message:effects},icon:selectedDish.effects.luckCharges?"福":"炁",imageSrc:selectedDish.art,eventId:`inventory-eat:${selectedDish.id}:${state.updatedAt}`,presentationOwner:"inventory"});
  };
  const passiveBonusCount = state.shared.cards.filter((card) => card.mode === "passive").length;
  const attributes = computeFinalAttributes(state);
  const profileAttributePoints = availableAttributePoints(state.battle);
  const nextLevelExperience = experienceToNextLevel(state.shared.playerLevel);
  const panelTitle = panel === "profile" ? "修士属性" : panel === "inventory" ? "乾坤行囊" : panel === "cards" ? "太虚名册" : panel === "skills" ? "万法谱" : "法器阁";
  useEffect(()=>{if(!noteReveal)return;const timer=window.setTimeout(()=>setNoteReveal(null),1900);return()=>window.clearTimeout(timer)},[noteReveal]);
  const filterCount=(id:InventoryFilter)=>id==="all"?allItems.length:id==="easter"?allItems.filter(isEasterEggItem).length:allItems.filter((item)=>item.itemType===id).length;
  const selectCategory=(id:InventoryFilter)=>{const next=id==="all"?allItems:id==="easter"?allItems.filter(isEasterEggItem):allItems.filter((item)=>item.itemType===id);setFilter(id);setRarityFilter("all");setItemInspectorOpen(false);setSelectedItemId(next[0]?.itemId??"")};
  const selectRarity=(rarity:InventoryRarityFilter)=>{const next=rarity==="all"?categoryItems:categoryItems.filter((item)=>item.rarity===rarity);setRarityFilter(rarity);setItemInspectorOpen(false);setSelectedItemId(next[0]?.itemId??"")};
  const latestAcquisition=allItems[0]?.lastAcquiredAt??0;
  const inspectItem=(itemId:string)=>{
    setSelectedItemId(itemId);setItemInspectorOpen(true);
    const definition=easterEggPresentationById(itemId);if(!definition)return;
    const preview=revealEligibleEasterEggNotes(state.romance,definition);
    if(preview.newlyUnlocked.length){setNoteReveal({itemId,noteIds:preview.newlyUnlocked});setRomance((current)=>revealEligibleEasterEggNotes(current,definition).state)}
  };
  const allocateProfileAttribute = (key: keyof AttributeAllocation) => {
    setBattle((current) => {
      if (availableAttributePoints(current) <= 0) return current;
      return {
        ...current,
        attributeAllocation: {
          ...current.attributeAllocation,
          [key]: current.attributeAllocation[key] + 1,
        },
      };
    });
  };

  return <div className="fusion-system-backdrop" role="presentation" onMouseDown={onClose}>
    <section className={`fusion-system-panel panel-${panel}`} role="dialog" aria-modal="true" aria-label={panelTitle} onMouseDown={(event) => event.stopPropagation()}>
      <header className="fusion-panel-heading"><div><small>HUAIAN DREAM · 同一世界资产</small><h2>{panelTitle}</h2><p>{panel === "profile" ? "主世界修为、秘境永久属性与装备加成都在此汇总。" : panel === "inventory" ? "恋爱所得、炼丹灵材、剧情珍藏与秘境战利品皆归于一处。" : panel === "cards" ? "剧情定契、丹炉显化与秘境偶得，共用同一人物卡体系。" : panel === "skills" ? "万法谱决定入境候选术法；天衍道脉塑造永久流派。" : "战前在此整备法器，入境后属性以快照锁定。"}</p></div><div className="fusion-panel-wallet"><span>灵石 <b>{state.shared.spiritStones.toLocaleString()}</b></span><span>体力 <b>{state.shared.stamina}/10</b></span></div><button type="button" onClick={onClose} aria-label="关闭">×</button></header>
      {(panel==="profile"||panel==="skills"||panel==="cards")&&<button type="button" className="fusion-panel-inspect" onClick={()=>feedback.inspect({titleKey:panel==="profile"?"player.profileTitle":panel==="skills"?"player.skillsTitle":"player.cardsTitle",bodyKey:panel==="profile"?"player.profileBody":panel==="skills"?"player.skillsBody":"player.cardsBody",icon:panel==="profile"?"修":panel==="skills"?"法":"契",details:panel==="profile"?[{labelKey:"player.levelLabel",value:state.shared.playerLevel,emphasis:true},{labelKey:"player.expLabel",value:`${state.shared.playerExperience}/${nextLevelExperience||"圆满"}`},{labelKey:"player.staminaLabel",value:`${state.shared.stamina}/10`},{labelKey:"player.attributeSummary",value:`生命 ${Math.round(attributes.health)} · 防御 ${Math.round(attributes.defense)} · 伤害 ${Math.round(attributes.damage*100)}%`}]:panel==="skills"?[{labelKey:"player.learnedCount",value:state.shared.learnedSkills.length,emphasis:true},{labelKey:"player.masterySummary",value:Object.values(state.battle.skillMastery).filter(skill=>skill.learned).map(skill=>`${skill.level}重`).join(" · ")||feedbackText("system.none")},{labelKey:"player.nextEffect",value:"外修等级提升伤害；入境候选流派由已习术法决定"}]:[{labelKey:"player.cardSource",value:"剧情定契 · 玄火显化 · 秘境偶得"},{labelKey:"player.cardActive",value:state.shared.cards.filter(card=>card.mode==="active").map(card=>card.name).join(" · ")||feedbackText("system.none")},{labelKey:"player.cardPassive",value:state.shared.cards.filter(card=>card.mode==="passive").map(card=>card.name).join(" · ")||feedbackText("system.none")}],dedupeKey:`fusion-summary:${panel}:${state.updatedAt}`})}>{feedbackText("system.details")}</button>}

      {panel === "profile" && <div className="player-profile-panel">
        <section className="profile-identity"><div className="profile-avatar"><img src="/game-assets/heroes/young-male-cultivator.webp" alt="主角立绘" /></div><small>槐安入梦者 · 云州修士</small><h3>无名剑修</h3><p>修士等级 <b>Lv.{state.shared.playerLevel}</b></p><div className="profile-exp"><span><i style={{ width: `${nextLevelExperience ? Math.min(100, state.shared.playerExperience / nextLevelExperience * 100) : 100}%` }} /></span><small>修为 {state.shared.playerExperience.toLocaleString()} / {nextLevelExperience ? nextLevelExperience.toLocaleString() : "圆满"}</small></div><footer><span>体力 <b>{state.shared.stamina}/10</b></span><span>灵石 <b>{state.shared.spiritStones.toLocaleString()}</b></span></footer></section>
        <div className="profile-growth-stack">
          <nav className="profile-growth-tabs" aria-label="人物属性分页">
            <button type="button" className={profileView === "allocation" ? "active" : ""} onClick={() => setProfileView("allocation")}><i>根</i><span><strong>根基分配</strong><small>{profileAttributePoints > 0 ? `${profileAttributePoints} 点待分配` : "本级已分配"}</small></span></button>
            <button type="button" className={profileView === "summary" ? "active" : ""} onClick={() => setProfileView("summary")}><i>览</i><span><strong>属性总览</strong><small>查看最终战斗数值</small></span></button>
          </nav>
          {profileView === "allocation"
            ? <AttributeAllocationPanel variant="profile" meta={state.battle} onAllocate={allocateProfileAttribute} />
            : <section className="profile-attributes"><header><small>PERMANENT ATTRIBUTES</small><h3>永久属性总览</h3><p>已计入根基、授业、法器和被动人物卡；入境后临时强化另行叠加。</p></header><div><article><small>生命</small><strong>{Math.round(attributes.health)}</strong><span>承伤上限</span></article><article><small>防御</small><strong>{Math.round(attributes.defense)}</strong><span>减免妖物伤害</span></article><article><small>伤害</small><strong>{Math.round(attributes.damage * 100)}%</strong><span>所有法术倍率</span></article><article><small>闪避</small><strong>{Math.round(attributes.dodge * 100)}%</strong><span>规避直接伤害</span></article><article><small>移动</small><strong>{Math.round(attributes.moveSpeed)}</strong><span>秘境身法速度</span></article><article><small>攻速</small><strong>{Math.round(attributes.attackSpeed * 100)}%</strong><span>法器施放频率</span></article><article><small>弹速</small><strong>{Math.round(attributes.projectileSpeed * 100)}%</strong><span>飞行法术速度</span></article><article><small>悟性</small><strong>{Math.round(attributes.expGain * 100)}%</strong><span>局内修为获取</span></article></div><footer><span>已习功法 <b>{state.shared.learnedSkills.length}</b></span><span>人物命契 <b>{state.shared.cards.length}</b></span><span>已装备法器 <b>{Object.values(state.battle.equipped).filter(Boolean).length}/6</b></span><span>镇压秘境 <b>{state.dungeons.completed.length}/21</b></span></footer></section>}
        </div>
      </div>}

      {panel === "inventory" && <div className="professional-inventory">
        <div className="inventory-filter-deck"><nav className="inventory-filters" aria-label="行囊分类">{FILTERS.map(([label, id]) => <button key={id} className={filter === id ? "active" : ""} onClick={() => selectCategory(id)}>{label}<b>{filterCount(id)}</b></button>)}</nav><nav className="inventory-rarity-filter" aria-label="按稀有度筛选"><span>灵韵</span><button type="button" className={rarityFilter==="all"?"active":""} onClick={()=>selectRarity("all")}>全品阶 <b>{categoryItems.length}</b></button>{availableRarities.map((rarity)=><button type="button" key={rarity} data-rarity={rarity} className={rarityFilter===rarity?"active":""} onClick={()=>selectRarity(rarity)}><i/>{RARITY[rarity]} <b>{categoryItems.filter((item)=>item.rarity===rarity).length}</b></button>)}</nav></div>
        <div className={`inventory-workspace ${itemInspectorOpen ? "inspector-open" : ""}`}><div className="inventory-art-grid">{items.map((stack) => { const meta = itemPresentation(stack); const egg=isEasterEggItem(stack); const recent=Boolean(stack.lastAcquiredAt&&stack.lastAcquiredAt===latestAcquisition); return <button type="button" key={stack.itemId} className={`${selectedStack?.itemId === stack.itemId ? "selected" : ""} ${egg?"easter-inventory-item":""} ${recent?"recently-acquired":""}`} data-rarity={stack.rarity} onMouseEnter={() => setSelectedItemId(stack.itemId)} onFocus={() => setSelectedItemId(stack.itemId)} onClick={() => inspectItem(stack.itemId)} aria-label={`${meta.name}，${RARITY[stack.rarity]}，数量${stack.amount}`}><span className="item-art"><ItemArtwork item={meta} /><i>{egg?"藏珍":RARITY[stack.rarity]}</i></span>{recent&&<em className="inventory-new-badge">新入</em>}<strong>{meta.name}</strong><b>×{stack.amount}</b></button>; })}{items.length === 0 && <div className="fusion-empty">此筛选下尚无物品。调整品阶或前往玩法获取新物。</div>}</div>
          <aside className={`item-inspector ${selectedManual ? "manual-inspector" : ""} ${selectedEasterEgg?"easter-inspector":""}`}><button type="button" className="item-inspector-close" onClick={() => setItemInspectorOpen(false)} aria-label={feedbackText("system.close")}>×</button>{selected && selectedStack ? <><div className="inspector-art" data-rarity={selectedStack.rarity}><ItemArtwork item={selected} /><span>{selectedEasterEgg?"藏珍":RARITY[selectedStack.rarity]}</span></div><small>{TYPE_LABEL[selectedStack.itemType]} · {selectedStack.sourceTags.join(" / ")}</small><h3>{selected.name}</h3><p>{selected.description}</p><div className="inspector-tags"><span>{selected.detail}</span><span>持有 ×{selectedStack.amount}</span>{selectedStack.locked && <span>剧情锁定</span>}</div>{selectedEasterEgg&&<section className="easter-egg-ledger"><header><small>ACQUIRED · 获取日期</small><strong>{acquiredDate?`${acquiredDate.eraYear} · ${acquiredDate.monthName}${acquiredDate.dayName}`:"旧档藏珍"}</strong><span>已向 {selectedEasterProgress?.shownTo.length??0} 位关联人物展示</span></header><div>{selectedEasterEgg.notes.map((note,index)=>{const unlocked=selectedEasterProgress?.unlockedNoteIds.includes(note.id);const revealing=noteReveal?.itemId===selectedStack.itemId&&noteReveal.noteIds.includes(note.id);return <article key={note.id} className={`${unlocked?"unlocked":"masked"} ${revealing?"revealing":""}`}><i>{String(index+1).padStart(2,"0")}</i><p>{unlocked?note.text:"这段补注尚被旧忆遮住"}</p><span>{unlocked?"已解明":"与关联人物交谈后，回来查看"}</span></article>})}</div></section>}{selectedManual && <div className="manual-learn-row"><small>{selectedManualLearned ? "此诀已收入万法谱" : "研读会消耗一卷玉简"}</small><button type="button" disabled={selectedManualLearned} onClick={learnSelectedManual}>{selectedManualLearned ? "已习得" : `研读 · 习得${selectedManual.name.replace(/[《》]/g, "")}`}</button></div>}<footer><span>可用于 {selectedStack.itemType === "material" ? "玄火丹炉" : selectedStack.itemType === "gift" ? giftTargetName?`赠予当前人物 · ${giftTargetName}`:"靠近人物后可直接赠予" : selectedStack.itemType === "food" ? "恢复体力、增长修为与获取食运" : selectedStack.itemType === "treasure" ? "收藏与交易" : selectedStack.itemType === "fish" ? "鱼获图鉴与商店交易" : selectedStack.itemType === "manual" ? "研读并收入万法谱" : selectedEasterEgg ? "向关联人物展示，不会被消耗" : selectedStack.itemType === "quest" ? "剧情回顾与世界线索" : "对应玩法"}</span><div className="inventory-inspector-actions"><button type="button" className="secondary" onClick={()=>feedback.inspect({titleKey:"items.nameLabel",bodyKey:"world.changeBody",params:{message:selected.description},icon:"鉴",imageSrc:selected.image,details:[{labelKey:"items.nameLabel",value:selected.name,emphasis:true},{labelKey:"items.rarityLabel",value:RARITY[selectedStack.rarity]},{labelKey:"items.countLabel",value:selectedStack.amount},{labelKey:"items.sourceLabel",value:selectedStack.sourceTags.join(" · ")},{labelKey:"items.tagsLabel",value:selected.detail},{labelKey:"items.lockedLabel",value:feedbackText(selectedStack.locked?"system.yes":"system.no")}],dedupeKey:`inventory:inspect:${selectedStack.itemId}:${selectedStack.amount}`})}>{feedbackText("system.details")}</button>{selectedDish&&<button type="button" className="primary" onClick={useSelectedDish}>享用灵膳</button>}{selectedGift&&giftTargetName&&onUseGift&&<button type="button" className="primary" onClick={()=>onUseGift(selectedGift.id)}>赠予 · {giftTargetName}</button>}{selectedGift?.energyRestore&&onEatGift&&<button type="button" className="primary eat" onClick={()=>onEatGift(selectedGift.id)}>食用 · 体力 +{selectedGift.energyRestore}</button>}</div></footer></> : <div className="fusion-empty">行囊尚空</div>}</aside></div>
      </div>}

      {panel === "cards" && <div className="card-codex-layout"><aside><div><small>主动人物卡</small><strong>{state.shared.cards.filter((card) => card.mode === "active").length}</strong><span>元气满时随机展示至多三张</span></div><div><small>被动人物卡</small><strong>{passiveBonusCount}</strong><span>全部自动叠加，不占卡槽</span></div></aside><div className="professional-card-grid">{state.shared.cards.map((card) => <article key={card.id} data-rarity={card.rarity}><div className="card-art"><img src={card.art} alt="" /><span>{RARITY[card.rarity]}</span><i>{card.mode === "active" ? "主动" : "被动"}</i></div><small>{card.source === "story" ? "人物剧情·固定命契" : card.source === "alchemy" ? "玄火丹炉·星命显化" : "秘境·偶得命契"}</small><h3>{card.name}</h3><p>{card.mode === "active" ? `元气满时进入三选一，召唤后释放「${card.activeEffect === "healing" ? "青囊回春" : card.activeEffect === "ward" ? "护道金光" : card.activeEffect === "frost" ? "霜天封境" : "剑意横空"}」。` : `持有即生效：${Object.entries(card.bonuses ?? {}).map(([key, value]) => `${key} +${value}`).join(" · ") || "命格加护"}。`}</p><footer><span>{card.mode === "active" ? "进入主动候选池" : "已计入永久属性"}</span><b>◆{card.rarity}</b></footer></article>)}{state.shared.cards.length === 0 && <div className="fusion-empty">名册尚空。人物关系事件、星命神花与高阶秘境均可获得完整人物卡。</div>}</div></div>}

      {panel === "skills" && <CultivationArtsPanel />}

      {panel === "equipment" && <MainEquipmentPanel meta={state.battle} onChange={setBattle} />}
    </section>
  </div>;
}

export function MainEquipmentPanel({ meta, onChange, compact = false }: { meta: MetaProgress; onChange: (next: MetaProgress) => void; compact?: boolean }) {
  const { state } = useUnifiedGame();
  const feedback = useFeedback();
  const [selectedUid, setSelectedUid] = useState(meta.equipmentBag[0]?.uid ?? "");
  const [heldUid, setHeldUid] = useState<string | null>(null);
  const [notice, setNotice] = useState("点击法器查看详情；再次点击拿起，再点目标格放置");
  React.useEffect(()=>{if(!notice)return;feedback.toast({titleKey:"system.dynamicMessage",params:{message:notice},icon:notice.includes("失败")||notice.includes("不足")||notice.includes("冲突")?"阻":"器",tone:notice.includes("失败")||notice.includes("不足")||notice.includes("冲突")?"danger":"jade",dedupeKey:`equipment-notice:${notice}`});},[feedback,notice]);
  const attributes = computeFinalAttributes({ ...state, battle: meta });
  const stored = meta.equipmentBag.filter((item) => meta.equipmentPositions[item.uid]);
  const selected = meta.equipmentBag.find((item) => item.uid === selectedUid) ?? stored[0];
  const slots: EquipmentBodySlot[] = ["head", "chest", "hands", "legs", "feet", "weapon", "offhand"];
  const equip = (uid: string) => { const result = tryEquipItem(meta, uid); onChange(result.meta); setNotice(result.message); if (result.ok) setHeldUid(null); };
  const unequip = (slot: EquipmentBodySlot) => { const result = tryUnequipItem(meta, slot); onChange(result.meta); setNotice(result.message); };
  const place = (uid: string, x: number, y: number) => { const next = moveEquipment(meta, uid, x, y); if (next === meta) setNotice("目标位置冲突：交换后的法器也必须能完整放回原位"); else { onChange(next); setHeldUid(null); setNotice("法器已归位"); } };
  const discard = async (uid: string) => {
    const item = meta.equipmentBag.find((entry) => entry.uid === uid);
    const name = item ? item.name ?? equipmentById(item.equipmentId).name : "这件法器";
    if (!await feedback.confirm({titleKey:"items.discardTitle",bodyKey:"items.discardBody",params:{name},icon:"弃",tone:"cinnabar",dedupeKey:`equipment:discard:${uid}`})) return;
    const result = discardEquipment(meta, uid);
    onChange(result.meta);
    setNotice(result.message);
    if (result.ok) { setSelectedUid(""); setHeldUid(null); }
  };
  return <div className={`main-gear-workbench ${compact ? "compact-field-gear" : ""}`}>
    <aside className="main-body-slots"><div className="main-cultivator"><img src="/game-assets/heroes/young-male-cultivator.webp" alt="修士立绘" /></div><div className="main-slot-ring">{slots.map((slot) => { const uid = meta.equipped[slot]; const instance = meta.equipmentBag.find((item) => item.uid === uid); const base = instance ? equipmentById(instance.equipmentId) : null; const label = slot === "offhand" ? "副手" : SLOT_META[slot].name; return <button key={slot} className={instance ? "filled" : ""} onClick={() => uid && unequip(slot)}><span>{base ? <img src={base.art} alt="" /> : label.slice(0, 1)}</span><small>{label}</small>{instance?.twoHanded && <em>双手</em>}</button>; })}</div><div className="main-core-stats"><span>体魄 <b>{Math.floor(attributes.strength)}</b></span><span>身法 <b>{Math.floor(attributes.dexterity)}</b></span><span>神识 <b>{Math.floor(attributes.magic)}</b></span></div></aside>
    <section className="main-pack-section"><header><div><small>DEVILUTION GRID LOGIC · 仙侠化迁移</small><h3>乾坤行囊</h3><p>40 格、多格占位、交换与属性失效共用副本内核。</p></div><button onClick={() => { onChange(sortEquipment(meta)); setNotice("已按高度、宽度压缩空隙"); }}>自动整理</button></header><div className="main-pack-grid" aria-label="十乘四装备行囊">{Array.from({ length: 40 }).map((_, index) => { const x = index % 10; const y = Math.floor(index / 10); return <i key={index} onClick={() => heldUid && place(heldUid, x, y)} />; })}{stored.map((item) => { const base = equipmentById(item.equipmentId); const point = meta.equipmentPositions[item.uid]; const size = equipmentSize(item); const rarity = item.rarity ?? base.rarity; return <button key={item.uid} className={`${heldUid === item.uid ? "held" : ""} ${item.identified === false ? "unknown" : ""}`} style={{ gridColumn: `${point.x + 1}/span ${size.width}`, gridRow: `${point.y + 1}/span ${size.height}`, "--rarity": RARITY_META[rarity].color } as React.CSSProperties} onClick={(event) => { event.stopPropagation(); setSelectedUid(item.uid); setHeldUid(heldUid === item.uid ? null : item.uid); }} onDoubleClick={() => equip(item.uid)}><img src={base.art} alt="" /><span>{item.identified === false ? "?" : item.twoHanded ? "双" : RARITY_META[rarity].name.slice(0, 1)}</span></button>; })}</div><p className="main-pack-notice" role="status">{notice}</p></section>
    <aside className="main-gear-detail">{selected ? (() => { const base = equipmentById(selected.equipmentId); const req = equipmentRequirements(selected); const usable = canUseEquipment(selected, attributes); const displayName=selected.identified === false ? `未鉴定的${base.name}` : selected.name ?? base.name; const simulated=usable&&selected.identified!==false?tryEquipItem(meta,selected.uid).meta:meta; const after=computeFinalAttributes({ ...state, battle: simulated }); const comparisons=[{label:feedbackText("items.statHealth"),before:Math.round(attributes.health),after:Math.round(after.health)},{label:feedbackText("items.statDamage"),before:Math.round(attributes.damage*100),after:Math.round(after.damage*100),unit:"%"},{label:feedbackText("items.statDefense"),before:Math.round(attributes.defense),after:Math.round(after.defense)},{label:feedbackText("items.statHit"),before:Math.round(attributes.hitChance*100),after:Math.round(after.hitChance*100),unit:"%"}]; return <><div className="detail-gear-art" style={{ "--rarity": RARITY_META[selected.rarity ?? base.rarity].color } as React.CSSProperties}><img src={base.art} alt="" /><span>{selected.identified === false ? "未鉴定" : RARITY_META[selected.rarity ?? base.rarity].name}</span></div><small>{SLOT_META[base.slot].name}{selected.twoHanded ? " · 双手法器" : ""}</small><h3>{displayName}</h3><p>{base.description}</p><div className="gear-compare-strip"><small>{feedbackText("items.compareAfter")}</small>{comparisons.map((entry)=>{const delta=entry.after-entry.before;return <span key={entry.label} className={delta>0?"up":delta<0?"down":"same"}><b>{entry.label}</b><em>{entry.before}{entry.unit} → {entry.after}{entry.unit}</em><i>{delta===0?feedbackText("items.statSame"):`${delta>0?"+":""}${delta}${entry.unit??""}`}</i></span>})}</div><div className="detail-gear-stats">{formatBonus(equipmentAttributeBonus(selected)).map((line) => <span key={line}>{line}</span>)}</div><div className={usable ? "detail-requirements met" : "detail-requirements failed"}><b>驱使要求</b><span>体魄 {req.strength ?? 0}</span><span>身法 {req.dexterity ?? 0}</span><span>神识 {req.magic ?? 0}</span></div><footer><b>估值 {equipmentValue(selected).toLocaleString()} 灵石</b><span className="gear-detail-actions"><button onClick={()=>feedback.compare({titleKey:"items.compareTitle",bodyKey:"world.changeBody",params:{message:base.description},icon:"器",imageSrc:base.art,details:[{labelKey:"items.nameLabel",value:displayName,emphasis:true},{labelKey:"items.slotLabel",value:SLOT_META[base.slot].name},{labelKey:"items.rarityLabel",value:RARITY_META[selected.rarity ?? base.rarity].name},{labelKey:"items.gridLabel",value:`${equipmentSize(selected).width}×${equipmentSize(selected).height}`},{labelKey:"items.identifiedLabel",value:feedbackText(selected.identified===false?"items.identifiedNo":"items.identifiedYes")},{labelKey:"items.requirementLabel",value:feedbackText("items.requirementValue",{strength:req.strength??0,dexterity:req.dexterity??0,magic:req.magic??0})},{labelKey:"items.bonusLabel",value:formatBonus(equipmentAttributeBonus(selected)).join(feedbackText("system.listSeparator"))||feedbackText("system.none")},{labelKey:"items.valueLabel",value:equipmentValue(selected).toLocaleString()}],dedupeKey:`equipment:compare:${selected.uid}`})}>{feedbackText("system.details")}</button>{selected.identified === false ? <button onClick={() => { const result = identifyEquipment(meta, selected.uid); onChange(result.meta); setNotice(result.message); }}>鉴定</button> : <button disabled={!usable} onClick={() => equip(selected.uid)}>{usable ? "装备" : "装备失效"}</button>}<button className="discard-gear" onClick={() => discard(selected.uid)}>丢弃</button></span></footer></>; })() : <div className="fusion-empty">尚无法器</div>}</aside>
  </div>;
}
