"use client";

import { useEffect, useMemo, useState, type CSSProperties, type DragEvent } from "react";
import { RARITY_META } from "./battle/expedition";
import { CULTIVATOR_PACK_SIZE, canPlaceEquipment, findEquipmentPosition, moveOrSwapEquipment, organizeEquipment } from "./battle/inventorySystem";
import { identifyEquipment } from "./battle/meta";
import { equipmentAttributeBonus, equipmentById, equipmentRequirements, equipmentSize, equipmentValue, formatBonus, type EquipmentItem, type EquipmentPosition } from "./battle/progression";
import { ensureWeeklyWeaponShop, nextWeaponShopRefreshDay, publicWeaponRarity, WEAPON_SHOP_GRID_SIZE, weaponGridPositions, weaponPurchasePrice, weaponSellPrice, weaponShopWeekNumber } from "./battle/weaponShop";
import { useUnifiedGame } from "./core/UnifiedGameProvider";

type DragPayload = { source: "store" | "player" | "identify"; uid: string };
type Selection = DragPayload | null;

function writeDrag(event: DragEvent, payload: DragPayload) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-huaian-weapon-shop", JSON.stringify(payload));
  event.dataTransfer.setData("text/plain", payload.uid);
}

function readDrag(event: DragEvent): DragPayload | null {
  try { return JSON.parse(event.dataTransfer.getData("application/x-huaian-weapon-shop")) as DragPayload; } catch { return null; }
}

function fitBuyback(items: EquipmentItem[]) {
  const kept = [...items];
  while (kept.length && !organizeEquipment(kept, WEAPON_SHOP_GRID_SIZE)) kept.pop();
  return kept;
}

function identificationCost(item: EquipmentItem) {
  return Math.max(80, Math.round(equipmentValue(item) * .08));
}

export default function WeaponMerchantPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const { state, setBattle } = useUnifiedGame();
  const [shelf, setShelf] = useState<"weekly" | "buyback" | "identify">("weekly");
  const [selection, setSelection] = useState<Selection>(null);
  const [message, setMessage] = useState("左边是本周兵架，右边是你的法器背包。拖过去，买卖就算成了。");

  useEffect(() => {
    setBattle((current) => {
      const weaponShop = ensureWeeklyWeaponShop(current.weaponShop, current.wmPublished, current.highestUnlockedWave, current.playerLevel, state.romance.day);
      return weaponShop === current.weaponShop ? current : { ...current, weaponShop };
    });
  }, [setBattle, state.romance.day]);

  const battle = state.battle;
  const unidentifiedItems = useMemo(() => battle.equipmentBag.filter((item) => battle.equipmentPositions[item.uid] && item.identified === false), [battle.equipmentBag, battle.equipmentPositions]);
  const shopItems = shelf === "weekly" ? battle.weaponShop.stock : shelf === "buyback" ? battle.weaponShop.buyback : unidentifiedItems;
  const shopPositions = useMemo(() => weaponGridPositions(shopItems), [shopItems]);
  const equippedIds = useMemo(() => new Set(Object.values(battle.equipped).filter(Boolean)), [battle.equipped]);
  const playerItems = useMemo(() => battle.equipmentBag.filter((item) => battle.equipmentPositions[item.uid]), [battle.equipmentBag, battle.equipmentPositions]);
  const selected = selection?.source === "store"
    ? shopItems.find((item) => item.uid === selection.uid)
    : battle.equipmentBag.find((item) => item.uid === selection?.uid);
  const selectedIsBuyback = selection?.source === "store" && shelf === "buyback";

  function buy(uid: string, target?: EquipmentPosition) {
    if (shelf === "identify") return;
    const isBuyback = shelf === "buyback";
    const item = (isBuyback ? battle.weaponShop.buyback : battle.weaponShop.stock).find((entry) => entry.uid === uid);
    if (!item) return;
    const price = weaponPurchasePrice(item, isBuyback);
    if (battle.spiritStones < price) { setMessage(`灵石不足，还差 ${(price - battle.spiritStones).toLocaleString()} 枚。`); return; }
    const purchased = { ...item, identified: isBuyback ? item.identified : true };
    const point = target
      ? canPlaceEquipment(playerItems, battle.equipmentPositions, purchased, CULTIVATOR_PACK_SIZE, target.x, target.y) ? target : null
      : findEquipmentPosition(playerItems, battle.equipmentPositions, purchased, CULTIVATOR_PACK_SIZE);
    if (!point) { setMessage("你的 10×4 法器背包没有足够的连续空格，交易未发生。"); return; }
    setBattle((current) => {
      const source = isBuyback ? current.weaponShop.buyback : current.weaponShop.stock;
      if (!source.some((entry) => entry.uid === uid) || current.spiritStones < price) return current;
      return {
        ...current,
        spiritStones: current.spiritStones - price,
        equipmentBag: [...current.equipmentBag, purchased],
        equipmentPositions: { ...current.equipmentPositions, [purchased.uid]: point },
        weaponShop: {
          ...current.weaponShop,
          [isBuyback ? "buyback" : "stock"]: source.filter((entry) => entry.uid !== uid),
        },
      };
    });
    const base = equipmentById(item.equipmentId);
    const revealed = item.identified === false && !isBuyback;
    const copy = revealed ? `买下封匣，揭出「${purchased.name ?? base.name}」` : `购得「${purchased.name ?? base.name}」`;
    setSelection({ source: "player", uid: purchased.uid });
    setMessage(`${copy}，花费 ${price.toLocaleString()} 灵石。`);
    onNotice(copy);
  }

  function sell(uid: string) {
    const item = battle.equipmentBag.find((entry) => entry.uid === uid);
    if (!item || !battle.equipmentPositions[uid]) return;
    const base = equipmentById(item.equipmentId);
    if (base.slot !== "weapon") { setMessage("霍青翎只收兵刃；护具请交给宁砚书处理。"); return; }
    if (equippedIds.has(uid)) { setMessage("正在佩戴的兵刃不能出售，请先在法器阁卸下。"); return; }
    const gain = weaponSellPrice(item);
    setBattle((current) => {
      const equipmentPositions = { ...current.equipmentPositions };
      delete equipmentPositions[uid];
      return {
        ...current,
        spiritStones: current.spiritStones + gain,
        equipmentBag: current.equipmentBag.filter((entry) => entry.uid !== uid),
        equipmentPositions,
        weaponShop: { ...current.weaponShop, buyback: fitBuyback([item, ...current.weaponShop.buyback.filter((entry) => entry.uid !== uid)]) },
      };
    });
    const copy = `售出「${item.name ?? base.name}」，获得 ${gain.toLocaleString()} 灵石`;
    setShelf("buyback");
    setSelection({ source: "store", uid });
    setMessage(`${copy}；在本周结束前可按原收购价赎回。`);
    onNotice(copy);
  }

  function identify(uid: string) {
    const item = battle.equipmentBag.find((entry) => entry.uid === uid);
    if (!item || item.identified !== false) { setMessage("这件法器的灵纹已经清楚，无需重复鉴定。"); return; }
    const cost = identificationCost(item);
    const result = identifyEquipment(battle, uid);
    if (!result.ok) { setMessage(result.message); return; }
    setBattle(result.meta);
    const base = equipmentById(item.equipmentId);
    const copy = `鉴定「${item.name ?? base.name}」，花费 ${cost.toLocaleString()} 灵石`;
    setSelection({ source: "player", uid });
    setMessage(`${result.message}。霍青翎以灵火照出法器的全部词条。`);
    onNotice(copy);
  }

  function movePlayerItem(uid: string, x: number, y: number) {
    const next = moveOrSwapEquipment(playerItems, battle.equipmentPositions, uid, x, y, CULTIVATOR_PACK_SIZE);
    if (!next) { setMessage("目标区域发生重叠，且被交换的法器无法完整放回原位。"); return; }
    setBattle((current) => ({ ...current, equipmentPositions: next }));
    setMessage("法器已重新归位。");
  }

  function handlePlayerCellDrop(event: DragEvent, x: number, y: number) {
    event.preventDefault();
    const payload = readDrag(event);
    if (!payload) return;
    if (payload.source === "store") buy(payload.uid, { x, y });
    else if (payload.source === "player") movePlayerItem(payload.uid, x, y);
  }

  function handleShopDrop(event: DragEvent) {
    event.preventDefault();
    const payload = readDrag(event);
    if (payload?.source === "player") shelf === "identify" ? identify(payload.uid) : sell(payload.uid);
  }

  function itemStyle(item: EquipmentItem, point: EquipmentPosition | undefined) {
    const size = equipmentSize(item);
    const rarity = publicWeaponRarity(item);
    return {
      gridColumn: `${(point?.x ?? 0) + 1} / span ${size.width}`,
      gridRow: `${(point?.y ?? 0) + 1} / span ${size.height}`,
      "--weapon-rarity": rarity ? RARITY_META[rarity].color : "#9c8f73",
    } as CSSProperties;
  }

  function ItemCard({ item, source, point }: { item: EquipmentItem; source: "store" | "player" | "identify"; point: EquipmentPosition }) {
    const base = equipmentById(item.equipmentId);
    const rarity = publicWeaponRarity(item);
    const size = equipmentSize(item);
    const unknown = item.identified === false;
    const price = source === "store" ? weaponPurchasePrice(item, shelf === "buyback") : source === "identify" ? identificationCost(item) : weaponSellPrice(item);
    return <button
      type="button"
      draggable={source !== "identify"}
      className={`weapon-grid-item ${unknown ? "is-unidentified" : ""} ${selection?.source === source && selection.uid === item.uid ? "selected" : ""} ${source === "player" && base.slot !== "weapon" ? "not-sellable" : ""}`}
      style={itemStyle(item, point)}
      onDragStart={(event) => writeDrag(event, { source, uid: item.uid })}
      onClick={(event) => { event.stopPropagation(); setSelection({ source, uid: item.uid }); }}
      onDoubleClick={() => source === "store" ? buy(item.uid) : source === "identify" ? identify(item.uid) : sell(item.uid)}
      aria-label={unknown && source === "store" ? `未鉴定的${base.name}，${size.width}乘${size.height}格，价格${price}灵石` : `${item.name ?? base.name}，${size.width}乘${size.height}格`}
    >
      <img src={base.art} alt="" />
      <span>{unknown ? "未鉴定" : rarity ? RARITY_META[rarity].name : "凡品"}</span>
      {source !== "player" && <b>{source === "identify" ? "鉴 " : "◉ "}{price.toLocaleString()}</b>}
      <i>{size.width}×{size.height}</i>
    </button>;
  }

  const gameWeek = weaponShopWeekNumber(state.romance.day);
  const nextRefreshDay = nextWeaponShopRefreshDay(state.romance.day);
  return <div className="weapon-merchant-workspace">
    <header className="weapon-merchant-toolbar">
      <div><small>XUANFENG WEEKLY ARMS · 暗黑式占格交易</small><h3>玄锋号兵器行</h3><p>霍青翎每七个游戏日换一批兵刃；封匣购入后才揭示稀有度，也可付费鉴定背包中的未知法器。</p></div>
      <div className="weapon-week-mark"><span>槐安历 · 当前批次</span><strong>第 {gameWeek} 周</strong><small>下次刷新 · 第 {nextRefreshDay} 日清晨</small></div>
    </header>
    <div className="weapon-trade-board">
      <section className="weapon-grid-panel vendor-grid-panel" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={handleShopDrop}>
        <header><div><small>LEFT · 玄锋号货架</small><h4>{shelf === "weekly" ? "本周兵器" : shelf === "buyback" ? "近期回购物" : "待鉴法器清单"}</h4></div><nav><button className={shelf === "weekly" ? "active" : ""} onClick={() => { setShelf("weekly"); setSelection(null); }}>周货 <b>{battle.weaponShop.stock.length}</b></button><button className={shelf === "buyback" ? "active" : ""} onClick={() => { setShelf("buyback"); setSelection(null); }}>回购 <b>{battle.weaponShop.buyback.length}</b></button><button className={shelf === "identify" ? "active" : ""} onClick={() => { setShelf("identify"); setSelection(null); }}>鉴定 <b>{unidentifiedItems.length}</b></button></nav></header>
        <div className="weapon-grid vendor-weapon-grid" aria-label="商店十乘十法器网格">
          {Array.from({ length: 100 }, (_, index) => <i key={index} />)}
          {shopItems.map((item) => shopPositions[item.uid] && <ItemCard key={item.uid} item={item} source={shelf === "identify" ? "identify" : "store"} point={shopPositions[item.uid]} />)}
          {!shopItems.length && <p className="weapon-grid-empty">{shelf === "weekly" ? "本周兵架已售罄" : shelf === "buyback" ? "尚未向霍青翎出售兵刃" : "背包中没有待鉴定法器"}</p>}
        </div>
        <footer>{shelf === "identify" ? <><span>双击：付费鉴定</span><span>也可从右侧拖入</span><span>费用随法器价值变化</span></> : <><span>双击：购买</span><span>拖到右侧：指定格购买</span><span>接收右侧拖入：出售</span></>}</footer>
      </section>
      <section className="weapon-grid-panel player-grid-panel">
        <header><div><small>RIGHT · 我的法器背包</small><h4>乾坤兵囊</h4></div><span>10×4 · {playerItems.length} 件</span></header>
        <div className="weapon-grid player-weapon-grid" aria-label="玩家十乘四法器背包">
          {Array.from({ length: 40 }, (_, index) => { const x = index % 10; const y = Math.floor(index / 10); return <i key={index} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => handlePlayerCellDrop(event, x, y)} onClick={() => selection?.source === "store" && buy(selection.uid, { x, y })} />; })}
          {playerItems.map((item) => <ItemCard key={item.uid} item={item} source="player" point={battle.equipmentPositions[item.uid]} />)}
        </div>
        <footer><span>双击兵刃：出售</span><span>拖动：整理或交易</span><span>护具只占格，不会被误售</span></footer>
      </section>
    </div>
    <section className="weapon-trade-inspector">
      <div className="weapon-merchant-quote"><span>霍</span><p>“{message}”</p></div>
      {selected ? (() => {
        const base = equipmentById(selected.equipmentId);
        const rarity = publicWeaponRarity(selected);
        const unknown = selected.identified === false;
        const requirement = equipmentRequirements(selected);
        const action = selection?.source === "store" ? () => buy(selected.uid) : selection?.source === "identify" ? () => identify(selected.uid) : () => sell(selected.uid);
        return <div className={`weapon-selected-detail ${unknown ? "unknown" : ""}`}>
          <img src={base.art} alt="" />
          <div><small>{unknown ? "SEALED LOT · 封匣待鉴" : `${RARITY_META[rarity ?? base.rarity].name} · ${base.slot === "weapon" ? "兵刃" : "护具"}`}</small><h4>{unknown ? `未鉴定的${base.name}` : selected.name ?? base.name}</h4><p>{unknown ? "器型、尺寸与价格可见；真正稀有度、前后缀及魔法词条会在购入后揭封。" : base.description}</p></div>
          <div className="weapon-secret-stats">{unknown ? <><span>稀有度：？？</span><span>前缀：？？</span><span>后缀：？？</span></> : formatBonus(equipmentAttributeBonus(selected)).slice(0, 5).map((line) => <span key={line}>{line}</span>)}</div>
          <div className="weapon-requirements"><span>体魄 {requirement.strength ?? 0}</span><span>身法 {requirement.dexterity ?? 0}</span><span>神识 {requirement.magic ?? 0}</span></div>
          <button onClick={action} disabled={selection?.source === "player" && base.slot !== "weapon"}>{selection?.source === "store" ? selectedIsBuyback ? `赎回 · ◉${weaponPurchasePrice(selected, true).toLocaleString()}` : `购入 · ◉${weaponPurchasePrice(selected).toLocaleString()}` : selection?.source === "identify" ? `鉴定 · ◉${identificationCost(selected).toLocaleString()}` : base.slot === "weapon" ? `出售 · ◉${weaponSellPrice(selected).toLocaleString()}` : "仅武器可售"}</button>
        </div>;
      })() : <div className="weapon-detail-empty">点选任意兵刃查看器型、占格与交易信息</div>}
    </section>
  </div>;
}
