"use client";

import { useMemo, useState } from "react";
import { ITEM_TABLE } from "./alchemy/item-data";
import { treasureById } from "./battle/expedition";
import { discardEquipment } from "./battle/meta";
import { equipmentById, equipmentValue } from "./battle/progression";
import { useUnifiedGame } from "./core/UnifiedGameProvider";
import type { UnifiedItemStack } from "./core/types";
import { SHOP_GIFTS, SHOP_OFFERS } from "./shop-content";
import type { EventDefinition, GiftDefinition } from "./types";

type ShopModalProps = {
  gifts: GiftDefinition[];
  events: EventDefinition[];
  relationship: number;
  onClose: () => void;
  onNotice: (message: string) => void;
};

const TYPE_LABELS: Record<UnifiedItemStack["itemType"], string> = {
  gift: "礼物", material: "灵材", pill: "丹药", equipment: "法器", card: "人物卡", treasure: "宝物", quest: "剧情物品",
};
const RARITY_COLORS = ["#aab5ad", "#7ebf8b", "#5faed0", "#a889ce", "#d59b54", "#e8c56c", "#f2df9b"];

export default function ShopModal({ gifts, events, relationship, onClose, onNotice }: ShopModalProps) {
  const { state, applyEffects, setBattle } = useUnifiedGame();
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [message, setMessage] = useState("万物有价，也总有人愿意给它第二个去处。");
  const giftMap = useMemo(() => Object.fromEntries(gifts.map((item) => [item.id, item])), [gifts]);
  const itemMap = useMemo(() => Object.fromEntries(ITEM_TABLE.map((item) => [item.id, item])), []);
  const questMap = useMemo(() => Object.fromEntries(events.flatMap((event) => event.exploration?.rewardItem ? [[event.exploration.rewardItem.id, event.exploration.rewardItem]] : [])), [events]);
  const shopGiftMap = useMemo(() => Object.fromEntries(SHOP_GIFTS.map((item) => [item.id, item])), []);
  const discount = relationship >= 65 ? .82 : relationship >= 35 ? .88 : relationship >= 15 ? .94 : 1;

  const sellableStacks = Object.values(state.shared.items).filter((item) => item.amount > 0 && !item.locked && item.itemType !== "card");
  const equippedIds = new Set(Object.values(state.battle.equipped));
  const sellableEquipment = state.battle.equipmentBag.filter((item) => !equippedIds.has(item.uid));

  function artStyle(gift: GiftDefinition) {
    return { backgroundImage: `url(${gift.image})`, backgroundPosition: gift.imagePosition ?? "center", backgroundSize: gift.image.includes("ning-shop-goods") ? "300% 200%" : gift.image.includes("gift-atlas") ? "500% 100%" : "cover" };
  }

  function buy(itemId: string, basePrice: number) {
    const gift = shopGiftMap[itemId];
    const price = Math.max(1, Math.round(basePrice * discount));
    if (!gift || state.shared.spiritStones < price) { setMessage(`灵石不足，还差 ${Math.max(0, price - state.shared.spiritStones)} 枚。`); return; }
    applyEffects([
      { type: "add_currency", amount: -price },
      { type: "add_item", item: { itemId, itemType: "gift", rarity: itemId === "jadeAbacusCharm" ? 4 : 2, amount: 1, sourceTags: ["栖珍阁", "购入"] } },
    ]);
    const copy = `购得「${gift.name}」· ${price} 灵石`;
    setMessage(relationship >= 15 ? `${copy}。宁砚书悄悄抹去了账尾的零头。` : `${copy}。宁砚书将物件仔细包好。`);
    onNotice(copy);
  }

  function stackDefinition(stack: UnifiedItemStack) {
    const gift = giftMap[stack.itemId];
    const alchemy = itemMap[stack.itemId];
    const treasureId = stack.itemId.startsWith("treasure:") ? stack.itemId.slice(9) : stack.itemId;
    const treasure = stack.itemType === "treasure" ? treasureById(treasureId) : null;
    const quest = questMap[stack.itemId];
    const name = gift?.name ?? alchemy?.name ?? treasure?.name ?? quest?.name ?? stack.itemId;
    const image = gift?.image ?? alchemy?.image ?? treasure?.art ?? quest?.image ?? "/assets/shop/ning-shop-goods.jpg";
    const position = gift?.imagePosition;
    const baseValue = alchemy?.value ?? alchemy?.price ?? treasure?.value ?? (stack.rarity * stack.rarity * 45);
    return { name, image, position, value: Math.max(1, Math.floor(baseValue * .58)) };
  }

  function sellStack(stack: UnifiedItemStack, amount: number) {
    const quantity = Math.max(1, Math.min(amount, stack.amount));
    const definition = stackDefinition(stack);
    if (quantity > 1 && !window.confirm(`确认将「${definition.name}」全部出售，共 ${quantity} 件？`)) return;
    const gain = definition.value * quantity;
    if (stack.itemType === "treasure") {
      const treasureId = stack.itemId.startsWith("treasure:") ? stack.itemId.slice(9) : stack.itemId;
      setBattle((current) => {
        let remaining = quantity;
        const filter = <T extends { treasureId: string }>(items: T[]) => items.filter((item) => item.treasureId !== treasureId || remaining-- <= 0);
        return { ...current, personalBackpack: filter(current.personalBackpack), warehouse: filter(current.warehouse) };
      });
    }
    applyEffects([{ type: "remove_item", itemId: stack.itemId, amount: quantity }, { type: "add_currency", amount: gain }]);
    const copy = `售出「${definition.name}」×${quantity} · 获得 ${gain.toLocaleString()} 灵石`;
    setMessage(`${copy}。旧物离柜，也算有了新的缘法。`); onNotice(copy);
  }

  function sellEquipment(uid: string) {
    const item = state.battle.equipmentBag.find((entry) => entry.uid === uid);
    if (!item || equippedIds.has(uid)) return;
    const name = item.name ?? equipmentById(item.equipmentId).name;
    const gain = Math.max(1, Math.floor(equipmentValue(item) * .55));
    setBattle((current) => {
      const result = discardEquipment(current, uid);
      return result.ok ? { ...result.meta, spiritStones: current.spiritStones + gain } : current;
    });
    const copy = `售出法器「${name}」· 获得 ${gain.toLocaleString()} 灵石`;
    setMessage(`${copy}。宁砚书重新系好封签，答应替它寻个好主人。`); onNotice(copy);
  }

  return <div className="shop-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="shop-window" role="dialog" aria-modal="true" aria-label="栖珍阁交易" onMouseDown={(event) => event.stopPropagation()}>
      <header className="shop-heading">
        <div><small>QIZHEN TREASURE HOUSE · 云州常设商铺</small><h2>栖珍阁</h2><p>宁砚书 · 万物皆收，童叟无欺</p></div>
        <div className="shop-wallet"><small>持有灵石</small><strong>◉ {state.shared.spiritStones.toLocaleString()}</strong><span>{discount < 1 ? `缘分折扣 · ${Math.round(discount * 100)} 折` : "当前为原价"}</span></div>
        <button type="button" onClick={onClose} aria-label="离开栖珍阁">×</button>
      </header>
      <div className="shop-body">
        <aside className="shopkeeper-panel">
          <img src="/assets/shop/ning-yanshu.svg" alt="栖珍阁老板娘宁砚书" />
          <div><small>掌柜寄语</small><p>“{message}”</p></div>
        </aside>
        <main className="shop-counter">
          <nav className="shop-tabs"><button className={tab === "buy" ? "active" : ""} onClick={() => setTab("buy")}><i>买</i><span><strong>购入常货</strong><small>行旅所需 · 明码标价</small></span></button><button className={tab === "sell" ? "active" : ""} onClick={() => setTab("sell")}><i>卖</i><span><strong>出售所有物品</strong><small>行囊、宝物与法器统一估价</small></span></button></nav>
          {tab === "buy" ? <div className="shop-goods-grid">{SHOP_OFFERS.map((offer) => { const gift = shopGiftMap[offer.itemId]!; const price = Math.max(1, Math.round(offer.price * discount)); return <article key={offer.itemId}>
            <div className="shop-goods-art" style={artStyle(gift)}><span>{gift.icon}</span><b>{offer.stock}</b></div>
            <small>{gift.tags.join(" · ")}</small><h3>{gift.name}</h3><p>{gift.description}</p><div><span><del>{discount < 1 ? offer.price : ""}</del><strong>◉ {price}</strong></span><button onClick={() => buy(offer.itemId, offer.price)} disabled={state.shared.spiritStones < price}>购入</button></div>
          </article>; })}</div> : <div className="shop-sell-area">
            <section><header><div><small>TRAVEL PACK · 可出售</small><h3>乾坤行囊</h3></div><span>{sellableStacks.length} 类物品</span></header><div className="shop-sell-list">{sellableStacks.map((stack) => { const definition = stackDefinition(stack); const isAtlas = definition.image.includes("atlas") || definition.image.includes("ning-shop-goods"); return <article key={stack.itemId}>
              <div className="shop-sell-art" style={isAtlas ? { backgroundImage: `url(${definition.image})`, backgroundPosition: definition.position ?? "center", backgroundSize: definition.image.includes("ning-shop-goods") ? "300% 200%" : "500% 100%" } : undefined}>{!isAtlas && <img src={definition.image} alt="" />}</div>
              <div><small>{TYPE_LABELS[stack.itemType]} · <i style={{ color: RARITY_COLORS[stack.rarity - 1] }}>◆{stack.rarity}</i></small><strong>{definition.name}</strong><p>持有 {stack.amount} · 单价 ◉ {definition.value}</p></div>
              <span><button onClick={() => sellStack(stack, 1)}>卖出 1</button>{stack.amount > 1 && <button onClick={() => sellStack(stack, stack.amount)}>全部出售</button>}</span>
            </article>; })}{!sellableStacks.length && <p className="shop-empty">行囊中暂无可出售物品。剧情物品会被自动保护。</p>}</div></section>
            <section><header><div><small>ARTIFACT PACK · 未佩戴</small><h3>法器行囊</h3></div><span>{sellableEquipment.length} 件法器</span></header><div className="shop-sell-list">{sellableEquipment.map((item) => { const base = equipmentById(item.equipmentId); const price = Math.max(1, Math.floor(equipmentValue(item) * .55)); return <article key={item.uid}><div className="shop-sell-art"><img src={base.art} alt="" /></div><div><small>法器 · {item.identified === false ? "未鉴定" : "已鉴定"}</small><strong>{item.name ?? base.name}</strong><p>估值 {equipmentValue(item).toLocaleString()} · 收购 ◉ {price}</p></div><span><button onClick={() => sellEquipment(item.uid)}>售予掌柜</button></span></article>; })}{!sellableEquipment.length && <p className="shop-empty">没有未佩戴的法器可出售；佩戴中的法器不会出现在此处。</p>}</div></section>
          </div>}
        </main>
      </div>
      <footer><span>剧情物品锁定保护</span><i /> <span>已佩戴法器不会误售</span><i /> <span>缘分越深，购买折扣越高</span></footer>
    </section>
  </div>;
}
