"use client";

import type { CSSProperties } from "react";
import { cardQualityName } from "../core/card-service";
import { COMMISSION_NPCS, type CommissionNpc } from "./commission-npcs";
import { MUTATIONS, getMutationValue, mutationDisplayName, type MutationId } from "./commissions";
import { selectCharacterOutcome, type GameItem } from "./item-data";

type CharacterOutcome = NonNullable<ReturnType<typeof selectCharacterOutcome>>;

export function CommissionNpcDock({ commissionCount, onOpenNpc, onOpenBoard }: { commissionCount: number; onOpenNpc: (npc: CommissionNpc) => void; onOpenBoard: () => void }) {
  return <section className="commission-npc-dock" aria-label="仙门委托来客">
    <header><div><span>仙 门 来 客</span><h2>有人携委托登门</h2></div><p>点击人物交谈，听取委托后前往收购榜</p><button onClick={onOpenBoard}>直入委托榜 <b>{commissionCount}</b></button></header>
    <div className="commission-npc-list">{COMMISSION_NPCS.map((npc, index) => <button key={npc.id} className={`commission-npc-card npc-element-${npc.element}`} style={{ "--npc-delay": `${index * -0.7}s` } as CSSProperties} onClick={() => onOpenNpc(npc)}><span className="npc-portrait"><img src={npc.portrait} alt={npc.name} /><i /></span><span className="npc-identity"><small>{npc.organization}</small><strong>{npc.name}</strong><em>{npc.title}</em></span><span className="npc-whisper">“{npc.greeting}”</span><span className="npc-talk-mark">访</span></button>)}</div>
  </section>;
}

export function NpcDialogueOverlay({ npc, step, onClose, onAdvance }: { npc: CommissionNpc | null; step: number; onClose: () => void; onAdvance: () => void }) {
  if (!npc) return null;
  return <div className="npc-dialogue-overlay" role="dialog" aria-modal="true" aria-label={`与${npc.name}交谈`}>
    <button className="npc-dialogue-backdrop" onClick={onClose} aria-label="结束交谈" />
    <div className={`npc-dialogue-card npc-element-${npc.element}`}><div className="npc-dialogue-portrait"><img src={npc.portrait} alt={npc.name} /><span /></div><div className="npc-dialogue-copy"><small>{npc.organization} · {npc.title}</small><h2>{npc.name}</h2><p>“{npc.dialogue[step]}”</p><div className="npc-dialogue-progress">{npc.dialogue.map((_, index) => <i key={index} className={index <= step ? "active" : ""} />)}</div><button onClick={onAdvance}>{step < npc.dialogue.length - 1 ? "继 续" : "查 看 委 托"}</button></div></div>
  </div>;
}

export function FatedCharacterOverlay({ character, fromCodex, onCollect }: { character: CharacterOutcome | null; fromCodex: boolean; onCollect: () => void }) {
  if (!character) return null;
  return <div className="character-overlay" role="dialog" aria-modal="true" aria-label="命定炉灵人物卡">
    <div className="character-portal" aria-hidden="true" /><div className="xian-cloud-curtain fated-curtain" aria-hidden="true"><i /><i /></div><div className="xian-reveal-mist mist-back" aria-hidden="true"><i /><i /><i /><i /></div>
    <div className="character-card xian-card-frame xian-card-fated"><div className="character-halo" aria-hidden="true" /><div className="character-runes" aria-hidden="true">乾 · 坎 · 艮 · 震 · 巽 · 离 · 坤 · 兑</div><div className="character-image xian-portrait-mask"><img src={character.image} alt={character.title} /><span /></div><div className="character-copy"><span className="character-kicker">{cardQualityName(6)} · 灵 契 人 物 卡 · {character.targeted ? `缘物定向 ${character.chance}%` : "星命随机"}</span><h2>灵契·{character.name}</h2><p>{character.targeted ? "人物缘物在十息丹火中显化，星命神花循着熟悉气息找到了她。" : "未有缘物指引，星命神花自万千命轨中随机照见了她。"}</p><div className="character-stats"><span>人物关系<strong>{character.relation}</strong></span><span>本炉概率<strong>{character.chance}%</strong></span><span>命格特性<strong>{character.trait}</strong></span></div><button onClick={onCollect}>{fromCodex ? "返 回 太 虚 名 册" : "收 入 太 虚 名 册"}</button></div>{Array.from({ length: 12 }).map((_, index) => <i key={index} className={`card-particle particle-${index + 1}`} aria-hidden="true" />)}</div>
    <div className="xian-reveal-mist mist-front" aria-hidden="true"><i /><i /><i /><i /><i /></div>
  </div>;
}

export function AlchemyResultOverlay({ open, item, mutation, onCollect, onReset }: { open: boolean; item: GameItem; mutation: MutationId; onCollect: () => void; onReset: () => void }) {
  if (!open) return null;
  return <div className="result-overlay" role="dialog" aria-modal="true" aria-label="炼丹结果"><div className="result-rays" aria-hidden="true" /><div className="result-card"><div className="card-art product-card-art"><span className="result-item-aura" aria-hidden="true" /><img className="result-item-icon" src={item.image} alt={mutationDisplayName(item, mutation)} /><span className="legendary-tag">{mutation === "normal" ? `${item.quality}·${item.category}` : `${MUTATIONS[mutation].prefix}·异变词缀`}</span></div><div className="card-copy"><span className="first-acquired">◈ 炼成物 · 成品库独立记录</span><h2 className={`mutation-name mutation-${mutation}`}>{mutationDisplayName(item, mutation)}</h2><p>{MUTATIONS[mutation].note}。{item.effect}。五行属 <b>{item.element}</b>，实际估值 <b>{getMutationValue(item, mutation).toLocaleString()}</b> 灵石。</p>{mutation !== "normal" && <div className={`mutation-banner mutation-${mutation}`}><span>炼丹异变</span><strong>{MUTATIONS[mutation].prefix}</strong><small>价值倍率 ×{MUTATIONS[mutation].valueMultiplier}</small></div>}<div className="result-value"><span>灵韵稀有</span><strong>{"◆".repeat(item.rarity)}</strong></div><div className="card-actions"><button onClick={onCollect}>收 下</button><button onClick={onReset}>再炼一炉</button></div></div></div><div className="result-title"><span>天地同贺</span><strong>灵 变 成 丹</strong></div></div>;
}
