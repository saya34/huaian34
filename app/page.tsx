"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ITEM_TABLE } from "./game/alchemy/item-data";
import { treasureById } from "./game/battle/expedition";
import { useUnifiedGame } from "./game/core/UnifiedGameProvider";
import { DUNGEONS, REGIONS, type RegionId } from "./game/core/dungeons";
import { GIFTS } from "./game/content";

type Panel = "inventory" | "cards" | "skills" | null;
const navItems = ["地图", "人物谱", "乾坤行囊", "太虚名册", "万法谱"];

export default function Home() {
  const router = useRouter();
  const { state } = useUnifiedGame();
  const [mapOpen, setMapOpen] = useState(false);
  const [regionId, setRegionId] = useState<RegionId>("yunzhou");
  const [panel, setPanel] = useState<Panel>(null);
  const region = REGIONS.find((item) => item.id === regionId) ?? REGIONS[0];
  const regionDungeons = DUNGEONS.filter((item) => item.regionId === regionId);
  const visibleItems = Object.values(state.shared.items).filter((item) => item.amount > 0).sort((a, b) => b.rarity - a.rarity || b.amount - a.amount);
  const itemNames = useMemo(() => new Map([...ITEM_TABLE.map((item) => [item.id, item.name] as const), ...GIFTS.map((item) => [item.id, item.name] as const)]), []);
  const day = state.romance.day;

  const randomVisible = (dungeon: (typeof DUNGEONS)[number]) => {
    const localIndex = (dungeon.waveId - 1) % 7 - 4;
    if (dungeon.kind === "permanent") return true;
    if (state.dungeons.randomVisible.includes(dungeon.id)) return true;
    if (localIndex === 0) return state.shared.cards.length >= 2;
    if (localIndex === 1) return state.alchemy.characterCards.length > 0;
    return state.dungeons.completed.includes(dungeon.waveId - 3);
  };

  const openNavigation = (index: number) => {
    if (index === 0) return setMapOpen(true);
    if (index === 1) return router.push("/romance");
    setPanel(index === 2 ? "inventory" : index === 3 ? "cards" : "skills");
  };

  return <main className="dream-shell">
    <div className="scene-wash" />
    <header className="top-bar">
      <button className="brand" onClick={() => { setMapOpen(false); setPanel(null); }} aria-label="返回凌霄殿"><span className="brand-seal">槐</span><span><strong>槐安一梦</strong><small>云州 · 凌霄殿</small></span></button>
      <div className="day-state"><span>景和元年 · 第{day}日</span><b>{state.romance.period}</b></div>
      <div className="player-state"><span>体力 <b>{state.shared.stamina}/10</b></span><span>灵石 <b>{state.shared.spiritStones.toLocaleString()}</b></span></div>
    </header>

    <section className="scene-stage">
      <div className="mist mist-a" /><div className="mist mist-b" />
      <article className="character-card"><img src="/assets/characters/shen-qingshuang.webp" alt="沈清霜立绘" /><div className="dialogue"><span className="speaker">沈清霜 · 剑道授业</span><p>灵脉近日有异。若要探那云外秘境，先随我温一遍剑诀。</p><button onClick={() => router.push("/romance")}>与她交谈</button></div></article>
      <aside className="today-panel"><span className="eyebrow">今日行程</span><h2>山河初醒</h2><p>丹炉火候正好，城外秘境也显出了入口。</p><button className="quest" onClick={() => setMapOpen(true)}><i>!</i><span>查看云州地图<small>丹炉与秘境已标记</small></span></button></aside>
    </section>

    <nav className="bottom-nav" aria-label="游戏功能">{navItems.map((item, index) => <button key={item} className={index === 0 && mapOpen ? "active" : ""} onClick={() => openNavigation(index)}><span>{["山", "缘", "囊", "契", "法"][index]}</span>{item}</button>)}</nav>

    {mapOpen && <section className="map-modal region-map" role="dialog" aria-modal="true" aria-label={`${region.name}地图`}>
      <button className="close" onClick={() => setMapOpen(false)} aria-label="关闭地图">×</button>
      <div className="region-tabs">{REGIONS.map((entry) => { const firstWave = REGIONS.findIndex((item) => item.id === entry.id) * 7 + 1; const locked = firstWave > state.dungeons.highestUnlocked; return <button key={entry.id} className={entry.id === regionId ? "active" : ""} disabled={locked} onClick={() => setRegionId(entry.id)}>{entry.name}<small>{locked ? "主线未启" : entry.subtitle}</small></button>; })}</div>
      <div className="map-copy"><span className="eyebrow">{REGIONS.findIndex((item) => item.id === regionId) + 1 === 1 ? "第一域" : REGIONS.findIndex((item) => item.id === regionId) + 1 === 2 ? "第二域" : "第三域"}</span><h1>{region.name}</h1><p>四处常驻秘境沿灵脉递进，三处异闻秘境随关系、物品与事件浮现。</p></div>
      <img className="map-image" src={region.image} alt={`${region.name}地图`} />
      {regionId === "yunzhou" && <button className="map-pin furnace" onClick={() => router.push("/alchemy")}><img src="/assets/xuanhuo-furnace.webp" alt="" /><span>玄火丹炉<small>炼丹 · 每炉消耗1体力</small></span></button>}
      {regionDungeons.filter(randomVisible).map((dungeon) => { const locked = dungeon.waveId > state.dungeons.highestUnlocked && dungeon.kind === "permanent"; return <button key={dungeon.id} className={`dungeon-pin ${dungeon.kind} ${locked ? "locked" : ""}`} style={{ left: `${dungeon.x}%`, top: `${dungeon.y}%` }} disabled={locked} onClick={() => router.push(`/battle?wave=${dungeon.waveId}`)}><i>{dungeon.kind === "random" ? "?" : dungeon.waveId}</i><span>{dungeon.name}<small>{locked ? "前置秘境未镇压" : `推荐战力 ${dungeon.recommendedPower}`}</small></span></button>; })}
    </section>}

    {panel && <section className="shared-panel" role="dialog" aria-modal="true"><button className="close" onClick={() => setPanel(null)}>×</button>
      {panel === "inventory" && <><header><span className="eyebrow">唯一资产层</span><h2>乾坤行囊</h2><p>礼物、灵材、丹药、装备与秘境宝物均归于此处。</p></header><div className="inventory-grid">{visibleItems.slice(0, 80).map((item) => <article key={item.itemId} data-rarity={item.rarity}><b>{itemNames.get(item.itemId) ?? (item.itemId.startsWith("treasure:") ? treasureById(item.itemId.slice(9)).name : item.itemId)}</b><span>{item.itemType} · {item.sourceTags[0]}</span><strong>×{item.amount}</strong></article>)}</div></>}
      {panel === "cards" && <><header><span className="eyebrow">命契皆归一册</span><h2>太虚名册</h2><p>主动卡元气满时三选一，被动卡持有即叠加。</p></header><div className="shared-card-grid">{state.shared.cards.map((card) => <article key={card.id} data-rarity={card.rarity}><img src={card.art} alt="" /><div><b>{card.name}</b><span>{card.mode === "active" ? "主动召唤" : "被动常驻"} · {card.source}</span></div></article>)}</div></>}
      {panel === "skills" && <><header><span className="eyebrow">随机流派与授业长存</span><h2>万法谱</h2><p>局内三选一仍会重置；已习得技能、场外等级与老师树永久保存。</p></header><div className="skill-summary"><article><b>{Object.values(state.battle.skillMastery).filter((skill) => skill.learned).length}</b><span>已学随机流派</span></article><article><b>{state.battle.skillBooks}</b><span>悟道残卷</span></article><article><b>{Object.values(state.battle.passiveRanks).reduce((sum, rank) => sum + rank, 0)}</b><span>老师树节点投入</span></article></div><button className="panel-action" onClick={() => router.push("/battle")}>进入战前修行界面</button></>}
    </section>}
  </main>;
}
