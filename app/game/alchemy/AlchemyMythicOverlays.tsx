import { cardQualityName } from "../core/card-service";
import { CHARACTER_PROFILES, MYTHIC_MATERIAL, type CharacterProfile } from "./item-data";
import {
  isMythicCardRecord,
  MYTHIC_CARD_OPTIONS,
  MYTHIC_MAX_OPTIONS,
  MYTHIC_OPTION_PAGES,
  MYTHIC_RARE_MAX_USES,
  mythicTierLabel,
  visibleMythicOptions,
  type CharacterCardRecord,
  type FatedCharacterCardRecord,
  type MythicCardRecord,
  type MythicOptionPage,
} from "./advanced-card";

export function MythicCreatorOverlay({ open, tab, selections, rareUses, mythicCardCount, onClose, onTab, onToggle, onPrepare }: {
  open: boolean;
  tab: MythicOptionPage;
  selections: string[];
  rareUses: Record<string, number>;
  mythicCardCount: number;
  onClose: () => void;
  onTab: (tab: MythicOptionPage) => void;
  onToggle: (optionId: string) => void;
  onPrepare: () => void;
}) {
  if (!open) return null;
  const selectedOptions = MYTHIC_CARD_OPTIONS.filter((option) => selections.includes(option.id));
  const selectedCharacter = selectedOptions.find((option) => option.page === "character");
  const selectedProfile = CHARACTER_PROFILES.find((profile) => profile.id === selectedCharacter?.characterId);
  const selectedScene = selectedOptions.find((option) => option.page === "scene");
  return <div className="mythic-creator-overlay" role="dialog" aria-modal="true" aria-label="太初命卷高级人物卡定制">
    <div className="mythic-void" aria-hidden="true" />
    <div className="mythic-cloud cloud-a" aria-hidden="true" /><div className="mythic-cloud cloud-b" aria-hidden="true" /><div className="mythic-cloud cloud-c" aria-hidden="true" />
    <section className="mythic-scroll-panel">
      <button className="mythic-close" onClick={onClose} aria-label="收起太初命卷">×</button>
      <header className="mythic-heading"><div><span>鸿 蒙 初 判 · 诸 天 命 刻</span><h2>太初命卷</h2></div><p>择一命主，以衣、势、境共铸神话人物卡</p><div className="mythic-counter"><small>太初铭刻</small><strong>{mythicCardCount}</strong><span>卷</span></div></header>
      <div className={`mythic-preview is-sealed ${selectedProfile ? "has-character" : ""}`}>
        <div className="mythic-preview-rings" aria-hidden="true"><i /><i /><i /></div>
        <div className="mythic-character-stage"><div className={`mythic-sealed-figure ${selectedProfile ? "is-bound" : ""}`} aria-label={selectedProfile ? "人物命格已封存，真容尚未揭晓" : "尚未选择人物"}><i /><strong>{selectedProfile ? "命" : "?"}</strong><span>{selectedProfile ? "真容封印" : "待择命主"}</span></div><span className="mythic-scene-name">{selectedScene ? "场景命纹已封存" : "混沌未定"}</span></div>
        <div className="mythic-preview-copy"><span className="mythic-preview-kicker">MYTHIC · SEALED DESTINY</span><h3>{selectedProfile ? "命主已定 · 真容未显" : "无字命格"}</h3><p>{selectedProfile ? "人物与诸般词条已封入卷中，需经十息玄火方可照见神话真容。" : "命卷尚待一位人物落笔"}</p><div className="mythic-selected-terms" aria-label="已选择的全部词条">{selectedOptions.map((option) => <span key={option.id} className={`term-${option.tier}`}>{option.label}<i>{mythicTierLabel(option.tier)}</i></span>)}{selectedOptions.length === 0 && <em>所选词条将在此显现</em>}</div></div>
        <div className="mythic-selection-count"><strong>{selections.length}</strong><span>/{MYTHIC_MAX_OPTIONS}</span><small>命纹</small></div>
        {selectedProfile && <div className="mythic-bound-seal"><span>已封</span><strong>十息后揭晓</strong></div>}
      </div>
      <div className="mythic-form">
        <nav className="mythic-tabs" aria-label="命卷词条分页">{MYTHIC_OPTION_PAGES.map((page) => <button key={page.id} className={tab === page.id ? "active" : ""} onClick={() => onTab(page.id)}><i>{page.seal}</i><span>{page.label}</span><small>{page.id === "character" ? "单选" : "多选"}</small></button>)}</nav>
        <div className="mythic-options" role="group" aria-label={`${MYTHIC_OPTION_PAGES.find((page) => page.id === tab)?.label}词条`}>{visibleMythicOptions(tab).map((option) => { const selected = selections.includes(option.id); const remaining = rareUses[option.id] ?? MYTHIC_RARE_MAX_USES; return <button key={option.id} className={`mythic-term term-${option.tier} ${selected ? "selected" : ""} ${option.tier === "rare" && remaining <= 0 ? "exhausted" : ""}`} onClick={() => onToggle(option.id)} disabled={option.tier === "rare" && remaining <= 0 && !selected} aria-pressed={selected}><span className="term-corner tl" /><span className="term-corner tr" /><span className="term-corner bl" /><span className="term-corner br" /><small>{mythicTierLabel(option.tier)}</small><strong>{option.label}</strong><em>{option.subtitle}</em>{option.tier === "rare" && <b className="rare-uses" aria-label={`剩余${remaining}次`}>{remaining}/{MYTHIC_RARE_MAX_USES}</b>}{selected && <b className="term-selected">✓</b>}</button>; })}</div>
        <footer className="mythic-actions"><div><span className="legend permanent">常驻词条</span><span className="legend unlocked">解锁词条</span><span className="legend rare">稀有解锁 · 5次</span></div><p>{tab === "character" ? "人物页仅可择一命主" : `本页可多选 · 全卡至多 ${MYTHIC_MAX_OPTIONS} 条`}</p><button onClick={onPrepare}>封 卷 入 炉 · 炼 制 十 息</button></footer>
      </div>
    </section>
  </div>;
}

export function MythicRevealOverlay({ card, fromCodex, onCollect }: { card: MythicCardRecord | null; fromCodex: boolean; onCollect: () => void }) {
  if (!card) return null;
  const options = MYTHIC_CARD_OPTIONS.filter((option) => card.optionIds.includes(option.id));
  const character = options.find((option) => option.page === "character");
  const profile = CHARACTER_PROFILES.find((candidate) => candidate.id === character?.characterId);
  const scene = options.find((option) => option.page === "scene");
  if (!profile) return null;
  return <div className="mythic-reveal-overlay" role="dialog" aria-modal="true" aria-label={`太初神话人物卡 太初·${profile.name}`}><div className="mythic-reveal-sky" aria-hidden="true"><i /><i /><i /></div><div className="xian-cloud-curtain" aria-hidden="true"><i /><i /></div><div className="xian-reveal-mist mist-back" aria-hidden="true"><i /><i /><i /><i /></div><div className="mythic-reveal-cloud cloud-left" aria-hidden="true" /><div className="mythic-reveal-cloud cloud-right" aria-hidden="true" /><section className="mythic-reveal-card xian-card-frame xian-card-mythic"><div className="mythic-reveal-orbit" aria-hidden="true"><i /><i /><i /></div><div className="mythic-reveal-art xian-portrait-mask"><img src={profile.images[0]} alt={profile.title} /><span /></div><div className="mythic-reveal-copy"><span>{cardQualityName(7)} · 太 初 命 刻 · 诸 天 唯 一</span><h2>太初·{profile.name}</h2><p>{profile.relation} · {profile.trait}</p><div className="mythic-reveal-scene"><small>命定场景</small><strong>{scene?.label ?? "太虚云海"}</strong></div><div className="mythic-reveal-terms">{options.map((option) => <span key={option.id} className={`term-${option.tier}`}>{option.label}</span>)}</div><button onClick={onCollect}>{fromCodex ? "返 回 太 虚 名 册" : "收 入 太 虚 名 册"}</button></div><div className="mythic-reveal-title"><small>TAICHU MYTHIC · PRIME ORIGIN</small><strong>太 初 神 话</strong></div>{Array.from({ length: 16 }).map((_, index) => <i key={index} className={`mythic-reveal-particle particle-${(index % 12) + 1}`} aria-hidden="true" />)}</section><div className="xian-reveal-mist mist-front" aria-hidden="true"><i /><i /><i /><i /><i /></div></div>;
}

export function MythicCodexOverlay({ open, cards, fatedCount, mythicCount, onClose, onOpenFated, onOpenMythic }: {
  open: boolean;
  cards: CharacterCardRecord[];
  fatedCount: number;
  mythicCount: number;
  onClose: () => void;
  onOpenFated: (card: FatedCharacterCardRecord, profile: CharacterProfile) => void;
  onOpenMythic: (card: MythicCardRecord) => void;
}) {
  if (!open) return null;
  return <div className="mythic-codex-overlay" role="dialog" aria-modal="true" aria-label="太虚名册人物卡背包"><section className="mythic-codex-window"><header><div><span>诸 天 命 轨 · 灵 契 归 藏</span><h2>太虚名册</h2><p>共 {cards.length} 张人物卡 · <b>灵契 {fatedCount}</b> · <em>太初 {mythicCount}</em></p></div><button onClick={onClose} aria-label="关闭太虚名册">×</button></header><div className="mythic-codex-grid">{cards.map((card, index) => { if (!isMythicCardRecord(card)) { const profile = CHARACTER_PROFILES.find((candidate) => candidate.id === card.profileId); if (!profile) return null; return <button key={card.id} className="mythic-codex-card codex-card-fated" onClick={() => onOpenFated(card, profile)}><span className="codex-card-index">灵契 {String(index + 1).padStart(2, "0")}<b>{card.quality ?? cardQualityName(6)} · 星命神花</b></span><span className="codex-card-art xian-portrait-mask"><img src={card.image} alt={profile.title} /><i /></span><strong>灵契·{profile.name}</strong><small>{profile.relation} · {profile.trait}</small><em>查看灵契</em></button>; } const options = MYTHIC_CARD_OPTIONS.filter((option) => card.optionIds.includes(option.id)); const character = options.find((option) => option.page === "character"); const profile = CHARACTER_PROFILES.find((candidate) => candidate.id === character?.characterId); const scene = options.find((option) => option.page === "scene"); if (!profile) return null; return <button key={card.id} className="mythic-codex-card codex-card-mythic" onClick={() => onOpenMythic(card)}><span className="codex-card-index">太初 {String(index + 1).padStart(2, "0")}<b>至高神话</b></span><span className="codex-card-art xian-portrait-mask"><img src={profile.images[0]} alt={profile.title} /><i /></span><strong>太初·{profile.name}</strong><small>{scene?.label ?? "太虚云海"} · {options.length} 道命纹</small><em>展开太初命相</em></button>; })}{cards.length === 0 && <div className="mythic-codex-empty"><img src={MYTHIC_MATERIAL.image} alt="太初命卷" /><strong>名册尚空</strong><p>星命神花可唤来灵契卡；太初命卷可铭刻更高阶的太初神话卡。</p></div>}</div></section></div>;
}
