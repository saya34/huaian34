"use client";

import { useMemo, useState } from "react";
import { MYTHIC_CARD_OPTIONS, isMythicCardRecord } from "../alchemy/advanced-card";
import { cardAbilityDescription, cardAbilityName, cardQualityName } from "../core/card-service";
import type { UnifiedCardInstance } from "../core/types";
import { CardRaritySheen } from "./CardRaritySheen";

type CardFilter = "all" | "active" | "passive";

const SOURCE_LABELS: Record<UnifiedCardInstance["source"], string> = {
  story: "人物剧情",
  alchemy: "玄火丹炉",
  dungeon: "秘境偶得",
};

const BONUS_LABELS: Record<string, string> = {
  health: "生命",
  defense: "防御",
  damage: "伤害",
  dodge: "闪避",
  moveSpeed: "身法",
  expGain: "悟性",
  attackSpeed: "攻速",
  projectileSpeed: "弹速",
};

function bonusLines(card: UnifiedCardInstance) {
  return Object.entries(card.bonuses ?? {}).map(([key, value]) => {
    const percent = ["damage", "dodge", "expGain", "attackSpeed", "projectileSpeed"].includes(key);
    const amount = percent ? `${Math.round(Number(value) * 100)}%` : String(value);
    return `${BONUS_LABELS[key] ?? key} +${amount}`;
  });
}

function cardTerms(card: UnifiedCardInstance) {
  const record = card.alchemyRecord;
  if (!record || !isMythicCardRecord(record)) return [];
  return MYTHIC_CARD_OPTIONS.filter((option) => record.optionIds.includes(option.id)).map((option) => option.label);
}

export function UnifiedCardGallery({ cards, compact = false }: { cards: UnifiedCardInstance[]; compact?: boolean }) {
  const [filter, setFilter] = useState<CardFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visibleCards = useMemo(() => filter === "all" ? cards : cards.filter((card) => card.mode === filter), [cards, filter]);
  const selected = cards.find((card) => card.id === selectedId) ?? null;
  const activeCount = cards.filter((card) => card.mode === "active").length;
  const passiveCount = cards.length - activeCount;

  return <section className={`unified-card-codex ${compact ? "is-compact" : ""}`}>
    <header className="unified-card-toolbar">
      <div><small>同 一 命 册 · 同 一 功 能</small><strong>{cards.length} 张人物卡</strong></div>
      <nav aria-label="人物卡功能筛选">
        <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全部 <b>{cards.length}</b></button>
        <button type="button" className={filter === "active" ? "active" : ""} onClick={() => setFilter("active")}>主动 <b>{activeCount}</b></button>
        <button type="button" className={filter === "passive" ? "active" : ""} onClick={() => setFilter("passive")}>被动 <b>{passiveCount}</b></button>
      </nav>
    </header>
    <div className="unified-card-grid">
      {visibleCards.map((card) => <button type="button" key={card.id} className="unified-card-tile" data-rarity={card.rarity} onClick={() => setSelectedId(card.id)}>
        <span className="unified-card-art" data-rarity={card.rarity}><img src={card.art} alt={card.name} /><CardRaritySheen rarity={card.rarity} /><i>{card.mode === "active" ? "主动" : "被动"}</i><b>{cardQualityName(card.rarity)}</b></span>
        <span className="unified-card-copy"><small>{SOURCE_LABELS[card.source]}</small><strong>{card.name}</strong><em>{cardAbilityName(card)}</em><span>{card.mode === "active" ? "点击查看召唤效果" : "点击查看永久加成"}</span></span>
      </button>)}
      {visibleCards.length === 0 && <div className="unified-card-empty">此分类尚无人物卡。人物剧情、玄火炼制与秘境探索均会写入同一名册。</div>}
    </div>
    {selected && <CardDetailOverlay card={selected} onClose={() => setSelectedId(null)} />}
  </section>;
}

export function UnifiedCardCodexOverlay({ open, cards, onClose }: { open: boolean; cards: UnifiedCardInstance[]; onClose: () => void }) {
  if (!open) return null;
  return <div className="unified-card-codex-overlay" role="dialog" aria-modal="true" aria-label="太虚名册">
    <section className="unified-card-codex-window">
      <header><div><small>TAIXU CARD CODEX · 灵契归藏</small><h2>太虚名册</h2><p>剧情、丹炉与秘境所得皆在此处共用；点击卡面查看画面与功能。</p></div><button type="button" onClick={onClose} aria-label="返回丹炉">返回丹炉</button></header>
      <UnifiedCardGallery cards={cards} />
    </section>
  </div>;
}

function CardDetailOverlay({ card, onClose }: { card: UnifiedCardInstance; onClose: () => void }) {
  const bonuses = bonusLines(card);
  const terms = cardTerms(card);
  return <div className="unified-card-detail-backdrop" role="dialog" aria-modal="true" aria-label={`${card.name}详情`} onMouseDown={onClose}>
    <article className="unified-card-detail" data-rarity={card.rarity} onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="unified-card-detail-close" onClick={onClose} aria-label="关闭人物卡详情">×</button>
      <div className="unified-card-detail-art" data-rarity={card.rarity}><img src={card.art} alt={card.name} /><CardRaritySheen rarity={card.rarity} /><span><b>{cardQualityName(card.rarity)}</b><i>{card.mode === "active" ? "主动人物卡" : "被动人物卡"}</i></span></div>
      <div className="unified-card-detail-copy">
        <small>{SOURCE_LABELS[card.source]} · {card.source === "alchemy" ? "丹炉显化" : "命契留影"}</small>
        <h2>{card.name}</h2>
        <section><span>{card.mode === "active" ? "召唤术式" : "常驻命格"}</span><h3>{cardAbilityName(card)}</h3><p>{cardAbilityDescription(card)}</p></section>
        {bonuses.length > 0 && <div className="unified-card-bonuses">{bonuses.map((line) => <span key={line}>{line}</span>)}</div>}
        {terms.length > 0 && <div className="unified-card-terms"><small>太初命纹</small>{terms.map((term) => <span key={term}>{term}</span>)}</div>}
        <footer><span>{card.mode === "active" ? "元气满时进入人物卡候选池" : "持有即计入主世界与战斗最终属性"}</span><button type="button" onClick={onClose}>收起命相</button></footer>
      </div>
    </article>
  </div>;
}
