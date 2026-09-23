"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ITEM_TABLE } from "./alchemy/item-data";
import { treasureById } from "./battle/expedition";
import { discardEquipment } from "./battle/meta";
import { equipmentById, equipmentValue } from "./battle/progression";
import { useUnifiedGame } from "./core/UnifiedGameProvider";
import type { UnifiedItemStack } from "./core/types";
import { SHOP_GIFTS, SHOP_OFFERS } from "./shop-content";
import type { EventDefinition, GiftDefinition } from "./types";
import WeaponMerchantPanel from "./WeaponMerchantPanel";
import { fishById } from "./fishing/fishing";
import { livestockProductById } from "./farm/livestock";
import { useFeedback } from "./feedback/FeedbackProvider";
import { manualItemById, SHOP_MANUAL } from "./skills/manual-items";
import { buyShopItem, itemSellValue, sellShopItem, shopBuyPrice, shopDiscount, shopStockRemaining } from "./core/trading-service";
import { kitchenRecipeByItemId } from "./kitchen/content";
import qizhenUi from "./content/qizhen-shop-ui.json";

type ShopModalProps = {
  gifts: GiftDefinition[];
  events: EventDefinition[];
  relationship: number;
  initialDepartment?: "treasure" | "weapons";
  onClose: () => void;
  onNotice: (message: string) => void;
};

const TYPE_LABELS: Record<UnifiedItemStack["itemType"], string> = {
  gift: "礼物", material: "灵材", pill: "丹药", food: "灵膳", equipment: "法器", card: "人物卡", treasure: "宝物", quest: "剧情物品", fish: "灵鱼", manual: "功法玉简",
};
const RARITY_COLORS = ["#aab5ad", "#7ebf8b", "#5faed0", "#a889ce", "#d59b54", "#e8c56c", "#f2df9b"];
const RARITY_LABELS = ["凡品", "良品", "珍品", "绝品", "灵品", "仙品", "神品"];

function QizhenArtwork({ image, position = "center", className = "" }: { image?: string; position?: string; className?: string }) {
  if (!image) return <span className={`qizhen-art-placeholder ${className}`} aria-hidden="true">器</span>;
  const atlas = image.includes("atlas") || image.includes("ning-shop-goods");
  if (atlas) return <span className={`qizhen-atlas-art ${className}`} style={{ backgroundImage: `url(${image})`, backgroundPosition: position, backgroundSize: image.includes("ning-shop-goods") ? "300% 200%" : "500% 100%" }} aria-hidden="true" />;
  return <img className={className} src={image} alt="" />;
}

const qizhenRarityStyle=(rarity:number)=>({"--qizhen-rarity":RARITY_COLORS[Math.max(0,Math.min(RARITY_COLORS.length-1,rarity-1))]} as CSSProperties);

export default function ShopModal({ gifts, events, relationship, initialDepartment = "treasure", onClose, onNotice }: ShopModalProps) {
  const { state, transact, setBattle } = useUnifiedGame();
  const feedback = useFeedback();
  const [department, setDepartment] = useState<"treasure" | "weapons">(initialDepartment);
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [sellShelf, setSellShelf] = useState<"items" | "equipment">("items");
  const [selectedOfferId, setSelectedOfferId] = useState<string>(SHOP_OFFERS[0]?.itemId ?? SHOP_MANUAL.itemId);
  const [selectedSellItemId, setSelectedSellItemId] = useState("");
  const [selectedEquipmentUid, setSelectedEquipmentUid] = useState("");
  const [tradePulse, setTradePulse] = useState<{ kind: "buy" | "sell"; id: string; serial: number } | null>(null);
  const [message, setMessage] = useState("万物有价，也总有人愿意给它第二个去处。");
  const giftMap = useMemo(() => Object.fromEntries(gifts.map((item) => [item.id, item])), [gifts]);
  const itemMap = useMemo(() => Object.fromEntries(ITEM_TABLE.map((item) => [item.id, item])), []);
  const questMap = useMemo(() => Object.fromEntries(events.flatMap((event) => event.exploration?.rewardItem ? [[event.exploration.rewardItem.id, event.exploration.rewardItem]] : [])), [events]);
  const shopGiftMap = useMemo(() => Object.fromEntries(SHOP_GIFTS.map((item) => [item.id, item])), []);
  const supplyRestored=Boolean(state.shared.globalKeys.medicine_supply_restored);
  const discount = shopDiscount(state);
  void onNotice;

  const treasureOffers = [...SHOP_OFFERS.map((offer) => ({ ...offer, itemType: "gift" as const, definition: shopGiftMap[offer.itemId]! })), { itemId: SHOP_MANUAL.itemId, price: SHOP_MANUAL.price, stock: "秘藏", note: "研读后习得功法", itemType: "manual" as const, definition: SHOP_MANUAL }];

  const sellableStacks = Object.values(state.shared.items).filter((item) => item.amount > 0 && !item.locked && !["card", "quest", "equipment"].includes(item.itemType));
  const equippedIds = new Set(Object.values(state.battle.equipped));
  const sellableEquipment = state.battle.equipmentBag.filter((item) => !equippedIds.has(item.uid) && equipmentById(item.equipmentId).slot !== "weapon");
  const selectedOffer = treasureOffers.find((offer) => offer.itemId === selectedOfferId) ?? treasureOffers[0];
  const selectedSellStack = sellableStacks.find((stack) => stack.itemId === selectedSellItemId) ?? sellableStacks[0];
  const selectedEquipment = sellableEquipment.find((item) => item.uid === selectedEquipmentUid) ?? sellableEquipment[0];

  useEffect(()=>{if(!tradePulse)return;const timer=window.setTimeout(()=>setTradePulse(null),620);return()=>window.clearTimeout(timer)},[tradePulse]);
  const playTradePulse=(kind:"buy"|"sell",id:string)=>setTradePulse({kind,id,serial:Date.now()});

  function buy(itemId: string, _basePrice: number, itemType: "gift" | "manual" = "gift") {
    const gift = shopGiftMap[itemId];
    const manual = manualItemById(itemId);
    const definition = itemType === "manual" ? manual : gift;
    const price = shopBuyPrice(state, itemId);
    if (shopStockRemaining(state, itemId) <= 0) { setMessage("本日已售罄，明日补货。"); return; }
    if (!definition || state.shared.spiritStones < price) { setMessage(`灵石不足，还差 ${Math.max(0, price - state.shared.spiritStones)} 枚。`); return; }
    transact((current) => buyShopItem(current, itemId));
    const copy = `购得「${definition.name}」· ${price} 灵石`;
    setMessage(relationship >= 15 ? `${copy}。宁砚书悄悄抹去了账尾的零头。` : `${copy}。宁砚书将物件仔细包好。`);
    playTradePulse("buy",itemId);
    feedback.toast({titleKey:"shop.purchaseTitle",bodyKey:"shop.purchaseBody",params:{name:definition.name,value:price},icon:"购",dedupeKey:`shop-buy:${itemId}:${state.romance.day}`});
  }

  function stackDefinition(stack: UnifiedItemStack) {
    const gift = giftMap[stack.itemId];
    const alchemy = itemMap[stack.templateId ?? stack.itemId];
    const treasureId = stack.itemId.startsWith("treasure:") ? stack.itemId.slice(9) : stack.itemId;
    const treasure = stack.itemType === "treasure" ? treasureById(treasureId) : null;
    const quest = questMap[stack.itemId];
    const fish = stack.itemType === "fish" ? fishById(stack.itemId) : null;
    const livestock = livestockProductById(stack.itemId);
    const manual = manualItemById(stack.itemId);
    const dish = kitchenRecipeByItemId(stack.itemId);
    const name = gift?.name ?? alchemy?.name ?? treasure?.name ?? quest?.name ?? fish?.name ?? livestock?.productName ?? manual?.name ?? dish?.name ?? stack.itemId;
    const image = gift?.image ?? alchemy?.image ?? treasure?.art ?? quest?.image ?? fish?.art ?? livestock?.productArt ?? manual?.art ?? dish?.art ?? "/assets/shop/ning-shop-goods.jpg";
    const position = gift?.imagePosition;
    const description = gift?.description ?? alchemy?.effect ?? treasure?.description ?? quest?.description ?? fish?.description ?? livestock?.productDescription ?? manual?.description ?? dish?.description ?? "云州坊市常见之物，宁砚书愿按今日行情收下。";
    return { name: stack.displayName ?? name, image, position, description, value: itemSellValue(stack) };
  }

  async function sellStack(stack: UnifiedItemStack, amount: number) {
    const quantity = Math.max(1, Math.min(amount, stack.amount));
    const definition = stackDefinition(stack);
    if (quantity > 1 && !(await feedback.confirm({titleKey:"shop.bulkSellTitle",bodyKey:"shop.bulkSellBody",params:{count:quantity,value:definition.value*quantity},icon:"售",tone:"cinnabar",dedupeKey:`shop-bulk:${stack.itemId}:${quantity}`}))) return;
    const gain = definition.value * quantity;
    transact((current) => sellShopItem(current, stack.itemId, quantity));
    const copy = `售出「${definition.name}」×${quantity} · 获得 ${gain.toLocaleString()} 灵石`;
    playTradePulse("sell",stack.itemId);
    setMessage(`${copy}。旧物离柜，也算有了新的缘法。`); feedback.toast({titleKey:"shop.saleTitle",bodyKey:"shop.saleBody",params:{name:definition.name,value:gain.toLocaleString()},icon:"售",tone:"gold",dedupeKey:`shop-sell:${stack.itemId}:${quantity}:${state.shared.spiritStones}`});
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
    playTradePulse("sell",uid);
    setMessage(`${copy}。宁砚书重新系好封签，答应替它寻个好主人。`); feedback.toast({titleKey:"shop.saleTitle",bodyKey:"shop.saleBody",params:{name,value:gain.toLocaleString()},icon:"售",tone:"gold",dedupeKey:`shop-sell-equipment:${uid}`});
  }

  const selectedOfferItem=selectedOffer.definition;
  const selectedOfferPrice=shopBuyPrice(state,selectedOffer.itemId);
  const selectedOfferRemaining=shopStockRemaining(state,selectedOffer.itemId);
  const selectedOfferImage="image" in selectedOfferItem?selectedOfferItem.image:selectedOfferItem.art;
  const selectedOfferPosition="imagePosition" in selectedOfferItem?selectedOfferItem.imagePosition:"center";
  const selectedOfferRarity=selectedOffer.itemType==="manual"?SHOP_MANUAL.rarity:selectedOffer.itemId==="jadeAbacusCharm"?4:2;
  const selectedStackPresentation=selectedSellStack?stackDefinition(selectedSellStack):null;
  const selectedEquipmentBase=selectedEquipment?equipmentById(selectedEquipment.equipmentId):null;

  return <div className="shop-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="shop-window" role="dialog" aria-modal="true" aria-label="栖珍阁交易" onMouseDown={(event) => event.stopPropagation()}>
      <header className="shop-heading">
        <div className="shop-title-block"><small>QIZHEN TREASURE HOUSE · 云州常设商铺</small><h2>栖珍阁</h2><nav className="shop-departments" aria-label="选择掌柜"><button className={department === "treasure" ? "active" : ""} onClick={() => setDepartment("treasure")}><b>宁砚书</b><span>百宝柜</span></button><button className={department === "weapons" ? "active" : ""} onClick={() => setDepartment("weapons")}><b>霍青翎</b><span>玄锋号</span></button></nav></div>
        <div className="shop-wallet"><small>持有灵石</small><strong>◉ {state.shared.spiritStones.toLocaleString()}</strong><span>{department === "treasure" ? discount < 1 ? `缘分折扣 · ${Math.round(discount * 100)} 折` : "当前为原价" : "兵刃周货 · 每周一刷新"}</span></div>
        <button type="button" onClick={onClose} aria-label="离开栖珍阁">×</button>
      </header>
      <div className={`shop-body ${department === "weapons" ? "weapon-department" : ""}`}>
        <aside className={`shopkeeper-panel ${department === "weapons" ? "weapon-merchant-portrait" : "refreshed-merchant-portrait"}`} role="button" tabIndex={0} onClick={() => feedback.inspect({titleKey:"shop.merchantTitle",bodyKey:"shop.merchantBody",params:{name:department==="weapons"?"霍青翎":"宁砚书"},icon:"商",imageSrc:department==="weapons"?"/assets/shop/huo-qingling.webp":"/assets/characters/portrait-refresh/ning-yanshu.png",details:[{labelKey:"relationship.roleLabel",value:department==="weapons"?"玄锋号兵器商 · 可攻略":"栖珍阁掌柜 · 可攻略"},{labelKey:"relationship.valueLabel",value:relationship},{labelKey:"shop.discountLabel",value:`${Math.round(discount*100)} 折`},{labelKey:"shop.merchantService",value:department==="weapons"?"周货、回购、鉴定":"常货、全品类售卖、剧情物品保护"}],dedupeKey:`merchant:${department}:${relationship}`})}>
          <img src={department === "weapons" ? "/assets/shop/huo-qingling.webp" : "/assets/characters/portrait-refresh/ning-yanshu.png"} alt={department === "weapons" ? "玄锋号女商人霍青翎" : "栖珍阁老板娘宁砚书"} />
          <div><small>{department === "weapons" ? "铸兵行商 · 霍青翎" : "掌柜寄语"}</small><p>“{department === "weapons" ? "兵刃占几格、值几钱，都写在明处；匣中锋芒，买下才与你相见。" : message}”</p></div>
        </aside>
        {department === "weapons" ? <main className="shop-counter weapon-shop-counter"><WeaponMerchantPanel onNotice={onNotice} /></main> : <main className={`shop-counter qizhen-counter ${tradePulse?`trade-${tradePulse.kind}-pulse`:""}`}>
          {tradePulse&&<span key={tradePulse.serial} className="qizhen-coin-flare" aria-hidden="true"><i/><i/><i/><b>石</b></span>}
          <div className="qizhen-counter-top">
            {supplyRestored&&<div className="medicine-supply-banner"><i>药</i><span><small>主线任务结果 · 已生效</small><strong>医馆药路重开，基础补给额外减免</strong></span><b>供给恢复</b></div>}
            <nav className="shop-tabs qizhen-trade-tabs"><button className={tab === "buy" ? "active" : ""} onClick={() => setTab("buy")}><i>买</i><span><strong>百宝上柜</strong><small>挑选 · 鉴赏 · 收入行囊</small></span></button><button className={tab === "sell" ? "active" : ""} onClick={() => setTab("sell")}><i>卖</i><span><strong>掌柜鉴价</strong><small>选物 · 估值 · 当面易主</small></span></button></nav>
          </div>
          {tab === "buy" ? <section className="qizhen-trade-stage qizhen-buy-stage" key="qizhen-buy">
            <header className="qizhen-stage-heading"><span><small>{qizhenUi.buy.eyebrow}</small><strong>{qizhenUi.buy.title}</strong></span><em>{qizhenUi.buy.hint}</em></header>
            <div className="qizhen-shelf-frame"><div className="qizhen-item-shelf">{treasureOffers.map((offer)=>{const item=offer.definition;const price=shopBuyPrice(state,offer.itemId);const remaining=shopStockRemaining(state,offer.itemId);const image="image" in item?item.image:item.art;const position="imagePosition" in item?item.imagePosition:"center";const rarity=offer.itemType==="manual"?SHOP_MANUAL.rarity:offer.itemId==="jadeAbacusCharm"?4:2;const selected=offer.itemId===selectedOffer.itemId;return <button type="button" key={offer.itemId} className={`qizhen-item-token ${selected?"selected":""} ${remaining<=0?"sold-out":""}`} style={qizhenRarityStyle(rarity)} aria-pressed={selected} onClick={()=>setSelectedOfferId(offer.itemId)}><span className="qizhen-token-art"><QizhenArtwork image={image} position={position}/><i>{remaining>0?`余 ${remaining}`:"售罄"}</i></span><small>{RARITY_LABELS[rarity-1]} · {item.tags[0]}</small><strong>{item.name}</strong><em>◉ {price.toLocaleString()}</em></button>})}</div></div>
            <aside className="qizhen-item-inspector" style={qizhenRarityStyle(selectedOfferRarity)}>
              <div className="qizhen-inspector-art"><QizhenArtwork image={selectedOfferImage} position={selectedOfferPosition}/><i>{selectedOfferItem.icon}</i><span>{RARITY_LABELS[selectedOfferRarity-1]}</span></div>
              <div className="qizhen-inspector-copy"><small>{qizhenUi.buy.inspectorEyebrow}</small><h3>{selectedOfferItem.name}</h3><p>{selectedOfferItem.description}</p><div>{selectedOfferItem.tags.map((tag)=><span key={tag}>{tag}</span>)}</div><dl><dt>柜上余量</dt><dd>{selectedOfferRemaining}</dd><dt>掌柜开价</dt><dd>{discount<1&&<del>◉ {selectedOffer.price}</del>}<b>◉ {selectedOfferPrice}</b></dd></dl></div>
              <button type="button" className="qizhen-primary-action" disabled={state.shared.spiritStones<selectedOfferPrice||selectedOfferRemaining<=0} onClick={()=>buy(selectedOffer.itemId,selectedOffer.price,selectedOffer.itemType)}><i>{selectedOfferRemaining>0?"取":"空"}</i><span><strong>{selectedOfferRemaining>0?qizhenUi.buy.action:qizhenUi.buy.soldOut}</strong><small>{selectedOfferRemaining>0?`支付 ${selectedOfferPrice} 灵石 · 余 ${selectedOfferRemaining}`:"待明日重新补货"}</small></span></button>
            </aside>
          </section> : <section className="qizhen-trade-stage qizhen-sell-stage" key="qizhen-sell">
            <header className="qizhen-stage-heading"><span><small>{qizhenUi.sell.eyebrow}</small><strong>{qizhenUi.sell.title}</strong></span><nav aria-label="选择估价货架"><button type="button" className={sellShelf==="items"?"active":""} onClick={()=>setSellShelf("items")}>{qizhenUi.sell.bag}<b>{sellableStacks.length}</b></button><button type="button" className={sellShelf==="equipment"?"active":""} onClick={()=>setSellShelf("equipment")}>{qizhenUi.sell.equipment}<b>{sellableEquipment.length}</b></button></nav></header>
            <div className="qizhen-shelf-frame qizhen-sell-shelf"><div className="qizhen-item-shelf">{sellShelf==="items"?sellableStacks.map((stack)=>{const item=stackDefinition(stack);const selected=selectedSellStack?.itemId===stack.itemId;return <button type="button" key={stack.itemId} className={`qizhen-item-token ${selected?"selected":""}`} style={qizhenRarityStyle(stack.rarity)} aria-pressed={selected} onClick={()=>setSelectedSellItemId(stack.itemId)}><span className="qizhen-token-art"><QizhenArtwork image={item.image} position={item.position}/><i>×{stack.amount}</i></span><small>{RARITY_LABELS[stack.rarity-1]} · {TYPE_LABELS[stack.itemType]}</small><strong>{item.name}</strong><em>收 ◉ {item.value}</em></button>}):sellableEquipment.map((item)=>{const base=equipmentById(item.equipmentId);const rarity=Math.max(1,Math.min(7,["common","fine","rare","epic","immortal"].indexOf(item.rarity??"common")+1));const selected=selectedEquipment?.uid===item.uid;return <button type="button" key={item.uid} className={`qizhen-item-token ${selected?"selected":""}`} style={qizhenRarityStyle(rarity)} aria-pressed={selected} onClick={()=>setSelectedEquipmentUid(item.uid!)}><span className="qizhen-token-art"><QizhenArtwork image={base.art}/><i>{item.identified===false?"未鉴":"法器"}</i></span><small>{RARITY_LABELS[rarity-1]} · 闲置法器</small><strong>{item.name??base.name}</strong><em>收 ◉ {Math.max(1,Math.floor(equipmentValue(item)*.55))}</em></button>})}{sellShelf==="items"&&!sellableStacks.length&&<p className="shop-empty">行囊中暂无可出售物品。剧情物品已经自动保护。</p>}{sellShelf==="equipment"&&!sellableEquipment.length&&<p className="shop-empty">没有闲置法器；佩戴中的法器不会出现在柜前。</p>}</div></div>
            {sellShelf==="items"&&selectedSellStack&&selectedStackPresentation?<aside className="qizhen-item-inspector" style={qizhenRarityStyle(selectedSellStack.rarity)}><div className="qizhen-inspector-art"><QizhenArtwork image={selectedStackPresentation.image} position={selectedStackPresentation.position}/><i>鉴</i><span>{RARITY_LABELS[selectedSellStack.rarity-1]}</span></div><div className="qizhen-inspector-copy"><small>{qizhenUi.sell.inspectorEyebrow}</small><h3>{selectedStackPresentation.name}</h3><p>{selectedStackPresentation.description}</p><div><span>{TYPE_LABELS[selectedSellStack.itemType]}</span><span>持有 ×{selectedSellStack.amount}</span></div><dl><dt>单件收价</dt><dd><b>◉ {selectedStackPresentation.value}</b></dd><dt>全部托售</dt><dd><b>◉ {(selectedStackPresentation.value*selectedSellStack.amount).toLocaleString()}</b></dd></dl></div><div className="qizhen-sell-actions"><button type="button" onClick={()=>sellStack(selectedSellStack,1)}>{qizhenUi.sell.sellOne}<b>+{selectedStackPresentation.value}</b></button>{selectedSellStack.amount>1&&<button type="button" className="all" onClick={()=>sellStack(selectedSellStack,selectedSellStack.amount)}>{qizhenUi.sell.sellAll}<b>+{(selectedStackPresentation.value*selectedSellStack.amount).toLocaleString()}</b></button>}</div></aside>:sellShelf==="equipment"&&selectedEquipment&&selectedEquipmentBase?<aside className="qizhen-item-inspector" style={qizhenRarityStyle(Math.max(1,["common","fine","rare","epic","immortal"].indexOf(selectedEquipment.rarity??"common")+1))}><div className="qizhen-inspector-art"><QizhenArtwork image={selectedEquipmentBase.art}/><i>器</i><span>{selectedEquipment.identified===false?"未鉴定":"已鉴定"}</span></div><div className="qizhen-inspector-copy"><small>{qizhenUi.sell.inspectorEyebrow}</small><h3>{selectedEquipment.name??selectedEquipmentBase.name}</h3><p>{selectedEquipmentBase.description}</p><div><span>{selectedEquipmentBase.slot}</span><span>闲置法器</span></div><dl><dt>坊间估值</dt><dd>◉ {equipmentValue(selectedEquipment).toLocaleString()}</dd><dt>掌柜收价</dt><dd><b>◉ {Math.max(1,Math.floor(equipmentValue(selectedEquipment)*.55)).toLocaleString()}</b></dd></dl></div><button type="button" className="qizhen-primary-action sell" onClick={()=>sellEquipment(selectedEquipment.uid!)}><i>易</i><span><strong>售予掌柜</strong><small>法器离柜后无法赎回</small></span></button></aside>:<aside className="qizhen-item-inspector empty"><span>鉴</span><p>{qizhenUi.sell.hint}</p></aside>}
          </section>}
        </main>}
      </div>
      <footer>{department === "weapons" ? <><span>周一零点随机换货</span><i /><span>未鉴定商品购入后揭示</span><i /><span>暗黑式多格交易与回购</span></> : <><span>剧情物品锁定保护</span><i /><span>已佩戴法器不会误售</span><i /><span>缘分越深，购买折扣越高</span></>}</footer>
    </section>
  </div>;
}
