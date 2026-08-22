"use client";

import { useMemo, useState } from "react";
import { GIFTS } from "../content";
import { ITEM_TABLE } from "../alchemy/item-data";
import { equipmentById, SLOT_META } from "../battle/progression";
import { RARITY_META, treasureById } from "../battle/expedition";
import { SKILL_MANUALS } from "../battle/skillMastery";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import type { UnifiedItemStack, UnifiedItemType } from "../core/types";

export type FusionPanelId = "inventory" | "cards" | "skills" | "equipment";

const RARITY = ["", "凡品", "良品", "珍品", "绝品", "灵品", "仙品", "神品"];
const TYPE_LABEL: Record<UnifiedItemType, string> = { gift: "礼物甜品", material: "炼丹灵材", pill: "丹药", equipment: "装备", card: "人物卡", treasure: "秘境宝物", quest: "剧情物品" };
const FILTERS: Array<[string, UnifiedItemType | "all"]> = [["全部", "all"], ["礼物", "gift"], ["灵材", "material"], ["丹药", "pill"], ["装备", "equipment"], ["宝物", "treasure"], ["剧情", "quest"]];

function itemPresentation(stack: UnifiedItemStack) {
  const alchemy = ITEM_TABLE.find((item) => item.id === stack.itemId);
  if (alchemy) return { name: alchemy.name, image: alchemy.image, description: alchemy.effect, detail: `${alchemy.element} · ${alchemy.category} · ${alchemy.trait}`, position: "center" };
  const gift = GIFTS.find((item) => item.id === stack.itemId);
  if (gift) return { name: gift.name, image: gift.image, description: gift.description, detail: gift.tags.join(" · "), position: gift.imagePosition ?? "center" };
  if (stack.itemId.startsWith("treasure:")) {
    const treasure = treasureById(stack.itemId.slice(9));
    return { name: treasure.name, image: treasure.art, description: treasure.description, detail: `${treasure.width}×${treasure.height} 格 · 秘境带回`, position: "center" };
  }
  return { name: stack.itemId, image: "/assets/xuanhuo-furnace.webp", description: "尚未录入万物志的特殊物品。", detail: TYPE_LABEL[stack.itemType], position: "center" };
}

export default function FusionSystemPanel({ panel, onClose }: { panel: FusionPanelId; onClose: () => void }) {
  const { state } = useUnifiedGame();
  const [filter, setFilter] = useState<UnifiedItemType | "all">("all");
  const allItems = useMemo(() => Object.values(state.shared.items).filter((item) => item.amount > 0).sort((a, b) => b.rarity - a.rarity || b.amount - a.amount), [state.shared.items]);
  const items = filter === "all" ? allItems : allItems.filter((item) => item.itemType === filter);
  const [selectedItemId, setSelectedItemId] = useState(() => allItems[0]?.itemId ?? "");
  const selectedStack = allItems.find((item) => item.itemId === selectedItemId) ?? items[0] ?? allItems[0];
  const selected = selectedStack ? itemPresentation(selectedStack) : null;
  const passiveBonusCount = state.shared.cards.filter((card) => card.mode === "passive").length;

  return <div className="fusion-system-backdrop" role="presentation" onMouseDown={onClose}>
    <section className={`fusion-system-panel panel-${panel}`} role="dialog" aria-modal="true" aria-label={panel === "inventory" ? "乾坤行囊" : panel === "cards" ? "太虚名册" : panel === "skills" ? "万法谱" : "法器阁"} onMouseDown={(event) => event.stopPropagation()}>
      <header className="fusion-panel-heading"><div><small>HUAIAN DREAM · 同一世界资产</small><h2>{panel === "inventory" ? "乾坤行囊" : panel === "cards" ? "太虚名册" : panel === "skills" ? "万法谱" : "法器阁"}</h2><p>{panel === "inventory" ? "恋爱所得、炼丹灵材与秘境战利品皆归于一处。" : panel === "cards" ? "剧情定契、丹炉显化与秘境偶得，共用同一人物卡体系。" : panel === "skills" ? "所学决定秘境中的候选流派；授业树提供永久被动。" : "战前在此整备法器，入境后属性以快照锁定。"}</p></div><div className="fusion-panel-wallet"><span>灵石 <b>{state.shared.spiritStones.toLocaleString()}</b></span><span>体力 <b>{state.shared.stamina}/10</b></span></div><button type="button" onClick={onClose} aria-label="关闭">×</button></header>

      {panel === "inventory" && <div className="professional-inventory">
        <nav className="inventory-filters" aria-label="行囊分类">{FILTERS.map(([label, id]) => <button key={id} className={filter === id ? "active" : ""} onClick={() => { setFilter(id); const first = id === "all" ? allItems[0] : allItems.find((item) => item.itemType === id); if (first) setSelectedItemId(first.itemId); }}>{label}<b>{id === "all" ? allItems.length : allItems.filter((item) => item.itemType === id).length}</b></button>)}</nav>
        <div className="inventory-workspace"><div className="inventory-art-grid">{items.map((stack) => { const meta = itemPresentation(stack); return <button type="button" key={stack.itemId} className={selectedStack?.itemId === stack.itemId ? "selected" : ""} data-rarity={stack.rarity} onMouseEnter={() => setSelectedItemId(stack.itemId)} onFocus={() => setSelectedItemId(stack.itemId)} onClick={() => setSelectedItemId(stack.itemId)} aria-label={`${meta.name}，${RARITY[stack.rarity]}，数量${stack.amount}`}><span className="item-art"><img src={meta.image} alt="" style={{ objectPosition: meta.position }} /><i>{RARITY[stack.rarity]}</i></span><strong>{meta.name}</strong><b>×{stack.amount}</b></button>; })}{items.length === 0 && <div className="fusion-empty">此分类尚无物品。秘境、赠礼与炼丹都会将所得送入这里。</div>}</div>
          <aside className="item-inspector">{selected && selectedStack ? <><div className="inspector-art" data-rarity={selectedStack.rarity}><img src={selected.image} alt="" style={{ objectPosition: selected.position }} /><span>{RARITY[selectedStack.rarity]}</span></div><small>{TYPE_LABEL[selectedStack.itemType]} · {selectedStack.sourceTags.join(" / ")}</small><h3>{selected.name}</h3><p>{selected.description}</p><div className="inspector-tags"><span>{selected.detail}</span><span>持有 ×{selectedStack.amount}</span>{selectedStack.locked && <span>剧情锁定</span>}</div><footer><span>可用于 {selectedStack.itemType === "material" ? "玄火丹炉" : selectedStack.itemType === "gift" ? "人物赠礼" : selectedStack.itemType === "treasure" ? "收藏与交易" : "对应玩法"}</span><button type="button">查看来源</button></footer></> : <div className="fusion-empty">行囊尚空</div>}</aside></div>
      </div>}

      {panel === "cards" && <div className="card-codex-layout"><aside><div><small>主动人物卡</small><strong>{state.shared.cards.filter((card) => card.mode === "active").length}</strong><span>元气满时随机展示至多三张</span></div><div><small>被动人物卡</small><strong>{passiveBonusCount}</strong><span>全部自动叠加，不占卡槽</span></div></aside><div className="professional-card-grid">{state.shared.cards.map((card) => <article key={card.id} data-rarity={card.rarity}><div className="card-art"><img src={card.art} alt="" /><span>{RARITY[card.rarity]}</span><i>{card.mode === "active" ? "主动" : "被动"}</i></div><small>{card.source === "story" ? "人物剧情·固定命契" : card.source === "alchemy" ? "玄火丹炉·星命显化" : "秘境·偶得命契"}</small><h3>{card.name}</h3><p>{card.mode === "active" ? `元气满时进入三选一，召唤后释放「${card.activeEffect === "healing" ? "青囊回春" : card.activeEffect === "ward" ? "护道金光" : card.activeEffect === "frost" ? "霜天封境" : "剑意横空"}」。` : `持有即生效：${Object.entries(card.bonuses ?? {}).map(([key, value]) => `${key} +${value}`).join(" · ") || "命格加护"}。`}</p><footer><span>{card.mode === "active" ? "进入主动候选池" : "已计入永久属性"}</span><b>◆{card.rarity}</b></footer></article>)}{state.shared.cards.length === 0 && <div className="fusion-empty">名册尚空。人物关系事件、星命神花与高阶秘境均可获得完整人物卡。</div>}</div></div>}

      {panel === "skills" && <div className="manual-layout"><aside className="manual-summary"><div><small>悟道残卷</small><strong>{state.battle.skillBooks}</strong></div><div><small>已习流派</small><strong>{Object.values(state.battle.skillMastery).filter((skill) => skill.learned).length}<i>/20</i></strong></div><p>局内仍采用升级三选一、六主动＋六补给；离境后单局等级重置，场外修习永久保留。</p></aside><div className="manual-grid">{SKILL_MANUALS.map((manual, index) => { const mastery = state.battle.skillMastery[String(manual.baseId)]; const learned = Boolean(mastery?.learned); return <article key={manual.baseId} className={learned ? "learned" : "locked"}><span className="manual-sigil"><b>{manual.element.slice(0, 1)}</b><i>{String(index + 1).padStart(2, "0")}</i></span><div><small>{manual.school} · {learned ? `外修 ${mastery.level} 重` : `主角 ${manual.unlockLevel ?? 1} 级 / 第 ${manual.unlockWave ?? 1} 境`}</small><h3>{manual.verse.split("，")[0]}</h3><p>{manual.verse}</p></div><em>{learned ? "已习" : "未悟"}</em></article>; })}</div></div>}

      {panel === "equipment" && <div className="equipment-layout"><aside className="equipment-slots">{Object.entries(SLOT_META).map(([slot, meta]) => { const uid = state.battle.equipped[slot as keyof typeof state.battle.equipped]; const instance = state.battle.equipmentBag.find((item) => item.uid === uid); const item = instance ? equipmentById(instance.equipmentId) : null; return <article key={slot} className={item ? "filled" : ""}><span>{item ? <img src={item.art} alt="" /> : meta.name.slice(0,1)}</span><div><small>{meta.name}</small><strong>{item?.name ?? "未装备"}</strong></div></article>; })}</aside><div className="equipment-vault"><header><span>法器库存</span><small>{state.battle.equipmentBag.length} 件 · 战前可调整</small></header><div>{state.battle.equipmentBag.map((instance) => { const item = equipmentById(instance.equipmentId); const rarity = instance.rarity ?? item.rarity; return <article key={instance.uid} data-rarity={rarity}><img src={item.art} alt="" /><div><small>{SLOT_META[item.slot].name} · {RARITY_META[rarity].name}</small><strong>{instance.name ?? item.name}</strong><p>{Object.entries(instance.bonuses ?? item.bonuses).map(([key,value]) => `${key} +${value}`).join(" · ")}</p></div><b>{Object.values(state.battle.equipped).includes(instance.uid) ? "已装备" : "入库"}</b></article>; })}{state.battle.equipmentBag.length === 0 && <div className="fusion-empty">尚无法器。镇压秘境、搜寻宝箱可获得随机装备与词条。</div>}</div></div></div>}
    </section>
  </div>;
}
