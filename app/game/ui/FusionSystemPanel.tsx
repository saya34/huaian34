"use client";

import { useMemo, useState } from "react";
import * as React from "react";
import { EVENTS, GIFTS } from "../content";
import { ITEM_TABLE } from "../alchemy/item-data";
import { computePermanentAttributes, experienceToNextLevel, identifyEquipment, moveEquipment, sortEquipment, tryEquipItem, tryUnequipItem, type MetaProgress } from "../battle/meta";
import { addAttributes } from "../battle/progression";
import { EquipmentBodySlot, canUseEquipment, equipmentAttributeBonus, equipmentById, equipmentRequirements, equipmentSize, equipmentValue, formatBonus, SLOT_META } from "../battle/progression";
import { RARITY_META, treasureById } from "../battle/expedition";
import { SKILL_MANUALS } from "../battle/skillMastery";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import type { UnifiedItemStack, UnifiedItemType } from "../core/types";

export type FusionPanelId = "profile" | "inventory" | "cards" | "skills" | "equipment";

const RARITY = ["", "凡品", "良品", "珍品", "绝品", "灵品", "仙品", "神品"];
const TYPE_LABEL: Record<UnifiedItemType, string> = { gift: "礼物甜品", material: "炼丹灵材", pill: "丹药", equipment: "装备", card: "人物卡", treasure: "秘境宝物", quest: "剧情物品" };
const FILTERS: Array<[string, UnifiedItemType | "all"]> = [["全部", "all"], ["礼物", "gift"], ["灵材", "material"], ["丹药", "pill"], ["装备", "equipment"], ["宝物", "treasure"], ["剧情", "quest"]];

type ItemPresentation = { name: string; image: string; description: string; detail: string; position: string; atlas?: boolean };

function itemPresentation(stack: UnifiedItemStack): ItemPresentation {
  const alchemy = ITEM_TABLE.find((item) => item.id === stack.itemId);
  if (alchemy) return { name: alchemy.name, image: alchemy.image, description: alchemy.effect, detail: `${alchemy.element} · ${alchemy.category} · ${alchemy.trait}`, position: "center" };
  const gift = GIFTS.find((item) => item.id === stack.itemId);
  if (gift) return { name: gift.name, image: gift.image, description: gift.description, detail: gift.tags.join(" · "), position: gift.imagePosition ?? "center", atlas: gift.image.includes("gift-atlas") };
  const quest = EVENTS.map((event) => event.exploration?.rewardItem).find((item) => item?.id === stack.itemId);
  if (quest) return { name: quest.name, image: quest.image, description: quest.description, detail: "藏珍录 · 剧情见证", position: "center" };
  if (stack.itemId.startsWith("treasure:")) {
    const treasure = treasureById(stack.itemId.slice(9));
    return { name: treasure.name, image: treasure.art, description: treasure.description, detail: `${treasure.width}×${treasure.height} 格 · 秘境带回`, position: "center" };
  }
  return { name: stack.itemId, image: "/assets/xuanhuo-furnace.webp", description: "尚未录入万物志的特殊物品。", detail: TYPE_LABEL[stack.itemType], position: "center" };
}

function ItemArtwork({ item, className = "" }: { item: ItemPresentation; className?: string }) {
  if (item.atlas) return <span className={`cropped-item-atlas ${className}`} style={{ backgroundImage: `url(${item.image})`, backgroundPosition: item.position, backgroundSize: "500% 100%" }} aria-hidden="true" />;
  return <img className={className} src={item.image} alt="" style={{ objectPosition: item.position }} />;
}

export default function FusionSystemPanel({ panel, onClose }: { panel: FusionPanelId; onClose: () => void }) {
  const { state, setBattle } = useUnifiedGame();
  const [filter, setFilter] = useState<UnifiedItemType | "all">("all");
  const allItems = useMemo(() => Object.values(state.shared.items).filter((item) => item.amount > 0).sort((a, b) => b.rarity - a.rarity || b.amount - a.amount), [state.shared.items]);
  const items = filter === "all" ? allItems : allItems.filter((item) => item.itemType === filter);
  const [selectedItemId, setSelectedItemId] = useState(() => allItems[0]?.itemId ?? "");
  const selectedStack = allItems.find((item) => item.itemId === selectedItemId) ?? items[0] ?? allItems[0];
  const selected = selectedStack ? itemPresentation(selectedStack) : null;
  const passiveBonusCount = state.shared.cards.filter((card) => card.mode === "passive").length;
  const passiveCardBonuses = state.shared.cards.filter((card) => card.mode === "passive").map((card) => card.bonuses);
  const attributes = addAttributes(computePermanentAttributes(state.battle), ...passiveCardBonuses);
  const nextLevelExperience = experienceToNextLevel(state.shared.playerLevel);
  const panelTitle = panel === "profile" ? "修士属性" : panel === "inventory" ? "乾坤行囊" : panel === "cards" ? "太虚名册" : panel === "skills" ? "万法谱" : "法器阁";

  return <div className="fusion-system-backdrop" role="presentation" onMouseDown={onClose}>
    <section className={`fusion-system-panel panel-${panel}`} role="dialog" aria-modal="true" aria-label={panelTitle} onMouseDown={(event) => event.stopPropagation()}>
      <header className="fusion-panel-heading"><div><small>HUAIAN DREAM · 同一世界资产</small><h2>{panelTitle}</h2><p>{panel === "profile" ? "主世界修为、秘境永久属性与装备加成都在此汇总。" : panel === "inventory" ? "恋爱所得、炼丹灵材、剧情珍藏与秘境战利品皆归于一处。" : panel === "cards" ? "剧情定契、丹炉显化与秘境偶得，共用同一人物卡体系。" : panel === "skills" ? "所学决定秘境中的候选流派；授业树提供永久被动。" : "战前在此整备法器，入境后属性以快照锁定。"}</p></div><div className="fusion-panel-wallet"><span>灵石 <b>{state.shared.spiritStones.toLocaleString()}</b></span><span>体力 <b>{state.shared.stamina}/10</b></span></div><button type="button" onClick={onClose} aria-label="关闭">×</button></header>

      {panel === "profile" && <div className="player-profile-panel">
        <section className="profile-identity"><div className="profile-avatar"><img src="/game-assets/heroes/young-male-cultivator.webp" alt="主角立绘" /></div><small>槐安入梦者 · 云州修士</small><h3>无名剑修</h3><p>修士等级 <b>Lv.{state.shared.playerLevel}</b></p><div className="profile-exp"><span><i style={{ width: `${nextLevelExperience ? Math.min(100, state.shared.playerExperience / nextLevelExperience * 100) : 100}%` }} /></span><small>修为 {state.shared.playerExperience.toLocaleString()} / {nextLevelExperience ? nextLevelExperience.toLocaleString() : "圆满"}</small></div><footer><span>体力 <b>{state.shared.stamina}/10</b></span><span>灵石 <b>{state.shared.spiritStones.toLocaleString()}</b></span></footer></section>
        <section className="profile-attributes"><header><small>PERMANENT ATTRIBUTES</small><h3>永久属性总览</h3><p>已计入根基、授业、法器和被动人物卡；入境后临时强化另行叠加。</p></header><div><article><small>生命</small><strong>{Math.round(attributes.health)}</strong><span>承伤上限</span></article><article><small>防御</small><strong>{Math.round(attributes.defense)}</strong><span>减免妖物伤害</span></article><article><small>伤害</small><strong>{Math.round(attributes.damage * 100)}%</strong><span>所有法术倍率</span></article><article><small>闪避</small><strong>{Math.round(attributes.dodge * 100)}%</strong><span>规避直接伤害</span></article><article><small>移动</small><strong>{Math.round(attributes.moveSpeed)}</strong><span>秘境身法速度</span></article><article><small>攻速</small><strong>{Math.round(attributes.attackSpeed * 100)}%</strong><span>法器施放频率</span></article><article><small>弹速</small><strong>{Math.round(attributes.projectileSpeed * 100)}%</strong><span>飞行法术速度</span></article><article><small>悟性</small><strong>{Math.round(attributes.expGain * 100)}%</strong><span>局内修为获取</span></article></div><footer><span>已习功法 <b>{state.shared.learnedSkills.length}</b></span><span>人物命契 <b>{state.shared.cards.length}</b></span><span>已装备法器 <b>{Object.values(state.battle.equipped).filter(Boolean).length}/6</b></span><span>镇压秘境 <b>{state.dungeons.completed.length}/21</b></span></footer></section>
      </div>}

      {panel === "inventory" && <div className="professional-inventory">
        <nav className="inventory-filters" aria-label="行囊分类">{FILTERS.map(([label, id]) => <button key={id} className={filter === id ? "active" : ""} onClick={() => { setFilter(id); const first = id === "all" ? allItems[0] : allItems.find((item) => item.itemType === id); if (first) setSelectedItemId(first.itemId); }}>{label}<b>{id === "all" ? allItems.length : allItems.filter((item) => item.itemType === id).length}</b></button>)}</nav>
        <div className="inventory-workspace"><div className="inventory-art-grid">{items.map((stack) => { const meta = itemPresentation(stack); return <button type="button" key={stack.itemId} className={selectedStack?.itemId === stack.itemId ? "selected" : ""} data-rarity={stack.rarity} onMouseEnter={() => setSelectedItemId(stack.itemId)} onFocus={() => setSelectedItemId(stack.itemId)} onClick={() => setSelectedItemId(stack.itemId)} aria-label={`${meta.name}，${RARITY[stack.rarity]}，数量${stack.amount}`}><span className="item-art"><ItemArtwork item={meta} /><i>{RARITY[stack.rarity]}</i></span><strong>{meta.name}</strong><b>×{stack.amount}</b></button>; })}{items.length === 0 && <div className="fusion-empty">此分类尚无物品。秘境、赠礼与炼丹都会将所得送入这里。</div>}</div>
          <aside className="item-inspector">{selected && selectedStack ? <><div className="inspector-art" data-rarity={selectedStack.rarity}><ItemArtwork item={selected} /><span>{RARITY[selectedStack.rarity]}</span></div><small>{TYPE_LABEL[selectedStack.itemType]} · {selectedStack.sourceTags.join(" / ")}</small><h3>{selected.name}</h3><p>{selected.description}</p><div className="inspector-tags"><span>{selected.detail}</span><span>持有 ×{selectedStack.amount}</span>{selectedStack.locked && <span>剧情锁定</span>}</div><footer><span>可用于 {selectedStack.itemType === "material" ? "玄火丹炉" : selectedStack.itemType === "gift" ? "人物赠礼" : selectedStack.itemType === "treasure" ? "收藏与交易" : selectedStack.itemType === "quest" ? "剧情回顾与世界线索" : "对应玩法"}</span><button type="button">查看来源</button></footer></> : <div className="fusion-empty">行囊尚空</div>}</aside></div>
      </div>}

      {panel === "cards" && <div className="card-codex-layout"><aside><div><small>主动人物卡</small><strong>{state.shared.cards.filter((card) => card.mode === "active").length}</strong><span>元气满时随机展示至多三张</span></div><div><small>被动人物卡</small><strong>{passiveBonusCount}</strong><span>全部自动叠加，不占卡槽</span></div></aside><div className="professional-card-grid">{state.shared.cards.map((card) => <article key={card.id} data-rarity={card.rarity}><div className="card-art"><img src={card.art} alt="" /><span>{RARITY[card.rarity]}</span><i>{card.mode === "active" ? "主动" : "被动"}</i></div><small>{card.source === "story" ? "人物剧情·固定命契" : card.source === "alchemy" ? "玄火丹炉·星命显化" : "秘境·偶得命契"}</small><h3>{card.name}</h3><p>{card.mode === "active" ? `元气满时进入三选一，召唤后释放「${card.activeEffect === "healing" ? "青囊回春" : card.activeEffect === "ward" ? "护道金光" : card.activeEffect === "frost" ? "霜天封境" : "剑意横空"}」。` : `持有即生效：${Object.entries(card.bonuses ?? {}).map(([key, value]) => `${key} +${value}`).join(" · ") || "命格加护"}。`}</p><footer><span>{card.mode === "active" ? "进入主动候选池" : "已计入永久属性"}</span><b>◆{card.rarity}</b></footer></article>)}{state.shared.cards.length === 0 && <div className="fusion-empty">名册尚空。人物关系事件、星命神花与高阶秘境均可获得完整人物卡。</div>}</div></div>}

      {panel === "skills" && <div className="manual-layout"><aside className="manual-summary"><div><small>悟道残卷</small><strong>{state.battle.skillBooks}</strong></div><div><small>已习流派</small><strong>{Object.values(state.battle.skillMastery).filter((skill) => skill.learned).length}<i>/20</i></strong></div><p>局内仍采用升级三选一、六主动＋六补给；离境后单局等级重置，场外修习永久保留。</p></aside><div className="manual-grid">{SKILL_MANUALS.map((manual, index) => { const mastery = state.battle.skillMastery[String(manual.baseId)]; const learned = Boolean(mastery?.learned); return <article key={manual.baseId} className={learned ? "learned" : "locked"}><span className="manual-sigil"><b>{manual.element.slice(0, 1)}</b><i>{String(index + 1).padStart(2, "0")}</i></span><div><small>{manual.school} · {learned ? `外修 ${mastery.level} 重` : `主角 ${manual.unlockLevel ?? 1} 级 / 第 ${manual.unlockWave ?? 1} 境`}</small><h3>{manual.verse.split("，")[0]}</h3><p>{manual.verse}</p></div><em>{learned ? "已习" : "未悟"}</em></article>; })}</div></div>}

      {panel === "equipment" && <MainEquipmentPanel meta={state.battle} onChange={setBattle} />}
    </section>
  </div>;
}

function MainEquipmentPanel({ meta, onChange }: { meta: MetaProgress; onChange: (next: MetaProgress) => void }) {
  const [selectedUid, setSelectedUid] = useState(meta.equipmentBag[0]?.uid ?? "");
  const [heldUid, setHeldUid] = useState<string | null>(null);
  const [notice, setNotice] = useState("点击法器查看详情；再次点击拿起，再点目标格放置");
  const attributes = computePermanentAttributes(meta);
  const stored = meta.equipmentBag.filter((item) => meta.equipmentPositions[item.uid]);
  const selected = meta.equipmentBag.find((item) => item.uid === selectedUid) ?? stored[0];
  const slots: EquipmentBodySlot[] = ["head", "chest", "hands", "legs", "feet", "weapon", "offhand"];
  const equip = (uid: string) => { const result = tryEquipItem(meta, uid); onChange(result.meta); setNotice(result.message); if (result.ok) setHeldUid(null); };
  const unequip = (slot: EquipmentBodySlot) => { const result = tryUnequipItem(meta, slot); onChange(result.meta); setNotice(result.message); };
  const place = (uid: string, x: number, y: number) => { const next = moveEquipment(meta, uid, x, y); if (next === meta) setNotice("目标位置冲突：交换后的法器也必须能完整放回原位"); else { onChange(next); setHeldUid(null); setNotice("法器已归位"); } };
  return <div className="main-gear-workbench">
    <aside className="main-body-slots"><div className="main-cultivator"><img src="/game-assets/heroes/young-male-cultivator.webp" alt="修士立绘" /></div><div className="main-slot-ring">{slots.map((slot) => { const uid = meta.equipped[slot]; const instance = meta.equipmentBag.find((item) => item.uid === uid); const base = instance ? equipmentById(instance.equipmentId) : null; const label = slot === "offhand" ? "副手" : SLOT_META[slot].name; return <button key={slot} className={instance ? "filled" : ""} onClick={() => uid && unequip(slot)}><span>{base ? <img src={base.art} alt="" /> : label.slice(0, 1)}</span><small>{label}</small>{instance?.twoHanded && <em>双手</em>}</button>; })}</div><div className="main-core-stats"><span>体魄 <b>{Math.floor(attributes.strength)}</b></span><span>身法 <b>{Math.floor(attributes.dexterity)}</b></span><span>神识 <b>{Math.floor(attributes.magic)}</b></span></div></aside>
    <section className="main-pack-section"><header><div><small>DEVILUTION GRID LOGIC · 仙侠化迁移</small><h3>乾坤行囊</h3><p>40 格、多格占位、交换与属性失效共用副本内核。</p></div><button onClick={() => { onChange(sortEquipment(meta)); setNotice("已按高度、宽度压缩空隙"); }}>自动整理</button></header><div className="main-pack-grid" aria-label="十乘四装备行囊">{Array.from({ length: 40 }).map((_, index) => { const x = index % 10; const y = Math.floor(index / 10); return <i key={index} onClick={() => heldUid && place(heldUid, x, y)} />; })}{stored.map((item) => { const base = equipmentById(item.equipmentId); const point = meta.equipmentPositions[item.uid]; const size = equipmentSize(item); const rarity = item.rarity ?? base.rarity; return <button key={item.uid} className={`${heldUid === item.uid ? "held" : ""} ${item.identified === false ? "unknown" : ""}`} style={{ gridColumn: `${point.x + 1}/span ${size.width}`, gridRow: `${point.y + 1}/span ${size.height}`, "--rarity": RARITY_META[rarity].color } as React.CSSProperties} onClick={(event) => { event.stopPropagation(); setSelectedUid(item.uid); setHeldUid(heldUid === item.uid ? null : item.uid); }} onDoubleClick={() => equip(item.uid)}><img src={base.art} alt="" /><span>{item.identified === false ? "?" : item.twoHanded ? "双" : RARITY_META[rarity].name.slice(0, 1)}</span></button>; })}</div><p className="main-pack-notice" role="status">{notice}</p></section>
    <aside className="main-gear-detail">{selected ? (() => { const base = equipmentById(selected.equipmentId); const req = equipmentRequirements(selected); const usable = canUseEquipment(selected, attributes); return <><div className="detail-gear-art" style={{ "--rarity": RARITY_META[selected.rarity ?? base.rarity].color } as React.CSSProperties}><img src={base.art} alt="" /><span>{selected.identified === false ? "未鉴定" : RARITY_META[selected.rarity ?? base.rarity].name}</span></div><small>{SLOT_META[base.slot].name}{selected.twoHanded ? " · 双手法器" : ""}</small><h3>{selected.identified === false ? `未鉴定的${base.name}` : selected.name ?? base.name}</h3><p>{base.description}</p><div className="detail-gear-stats">{formatBonus(equipmentAttributeBonus(selected)).map((line) => <span key={line}>{line}</span>)}</div><div className={usable ? "detail-requirements met" : "detail-requirements failed"}><b>驱使要求</b><span>体魄 {req.strength ?? 0}</span><span>身法 {req.dexterity ?? 0}</span><span>神识 {req.magic ?? 0}</span></div><footer><b>估值 {equipmentValue(selected).toLocaleString()} 灵石</b>{selected.identified === false ? <button onClick={() => { const result = identifyEquipment(meta, selected.uid); onChange(result.meta); setNotice(result.message); }}>鉴定</button> : <button disabled={!usable} onClick={() => equip(selected.uid)}>{usable ? "装备" : "装备失效"}</button>}</footer></>; })() : <div className="fusion-empty">尚无法器</div>}</aside>
  </div>;
}
