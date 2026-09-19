"use client";

import { type CSSProperties, type ReactNode, useState } from "react";
import { type AnyRow, assetUrl, type GameData } from "./data";
import { findEffect } from "./assets";
import { RARITY_META, treasureById } from "./expedition";
import {
  type MetaProgress,
  availableAttributePoints,
  availableSkillPoints,
  feedSkillExperience,
  identifyEquipment,
  moveEquipment,
  sortEquipment,
  tryEquipItem,
  tryUnequipItem,
} from "./meta";
import {
  ATTRIBUTE_POINT_BONUS,
  type AttributeAllocation,
  BLESSING_META,
  type BlessingPage,
  type EquipmentBodySlot,
  PASSIVE_SKILLS,
  SLOT_META,
  canUseEquipment,
  equipmentAttributeBonus,
  equipmentById,
  equipmentRequirements,
  equipmentSize,
  equipmentValue,
  formatBonus,
  passiveSkillUnlocked,
} from "./progression";
import { DEFAULT_WM_CONFIG, type WMAttributeKey, type WMConfig, type WMEquipmentRule, cloneWMConfig, validateWMConfig } from "./weaponManager";
import {
  MAX_SKILL_MASTERY_LEVEL,
  SKILL_BOOK_EXP,
  SKILL_MANUALS,
  skillMasteryDamageMultiplier,
  skillMasteryExpToNext,
} from "./skillMastery";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { computeFinalAttributes } from "../core/attributes-service";
import type { UnifiedCardInstance } from "../core/types";
import { CARD_QUALITY_NAMES } from "../core/card-service";
import { feedbackText } from "../feedback/texts";

const WM_STAT_LABELS: Record<WMAttributeKey, string> = { health: "生命", mana: "灵力", defense: "护甲", damage: "伤害", weaponMinDamage: "武伤下限", weaponMaxDamage: "武伤上限", hitChance: "命中", strength: "体魄", dexterity: "身法", magic: "神识", fireResist: "离火抗性", lightningResist: "玄雷抗性", magicResist: "术法抗性", dodge: "闪避", moveSpeed: "移速", expGain: "经验", attackSpeed: "攻速", projectileSpeed: "弹速" };

function skillArtById(data: GameData, skillId: number) {
  const level = data.skillLevels.find((row) => Number(row.skillId) === skillId && Number(row.level) === 1)
    ?? data.skillLevels.find((row) => Number(row.skillId) === skillId);
  const bullet = data.bullets.find((row) => Number(row.id) === Number(level?.bullet?.[0]));
  const path = findEffect(data.manifest, bullet?.model);
  return path ? assetUrl(path) : null;
}

export function SkillStudySystem({ data, meta, onChange, notify }: { data: GameData; meta: MetaProgress; onChange: (meta: MetaProgress) => void; notify: (message: string) => void }) {
  const [selectedId, setSelectedId] = useState(SKILL_MANUALS[0].baseId);
  const [filter, setFilter] = useState<"all" | "learned" | "locked">("all");
  const selected = SKILL_MANUALS.find((manual) => manual.baseId === selectedId) ?? SKILL_MANUALS[0];
  const selectedState = meta.skillMastery[String(selected.baseId)];
  const baseSkill = data.skills.find((skill) => Number(skill.resId) === selected.baseId);
  const evolutionSkill = data.skills.find((skill) => Number(skill.resId) === selected.evolutionId);
  const baseLevel = data.skillLevels.find((level) => Number(level.skillId) === selected.baseId && Number(level.level) === 1);
  const evolutionLevel = data.skillLevels.find((level) => Number(level.skillId) === selected.evolutionId && Number(level.level) === 6);
  const evolution = data.evolutions.find((entry) => Number(entry.skillId) === selected.evolutionId);
  const maxed = selectedState.level >= MAX_SKILL_MASTERY_LEVEL;
  const nextExp = skillMasteryExpToNext(selectedState.level);
  const currentDamage = Math.round((skillMasteryDamageMultiplier(selectedState.level) - 1) * 100);
  const nextDamage = Math.round((skillMasteryDamageMultiplier(Math.min(MAX_SKILL_MASTERY_LEVEL, selectedState.level + 1)) - 1) * 100);
  const visibleManuals = SKILL_MANUALS.filter((manual) => {
    const learned = meta.skillMastery[String(manual.baseId)]?.learned;
    return filter === "all" || (filter === "learned" ? learned : !learned);
  });

  const requirementName = (id: number) => data.skills.find((skill) => Number(skill.resId) === id)?.name
    ?? data.supplies.find((supply) => Number(supply.resId) === id)?.name
    ?? `秘术 ${id}`;

  const feedBooks = (count: number) => {
    if (!meta.skillBooks) return notify("悟道残卷不足，可通过镇压秘境获得");
    const before = selectedState.level;
    const next = feedSkillExperience(meta, selected.baseId, count);
    onChange(next);
    const after = next.skillMastery[String(selected.baseId)].level;
    notify(after > before ? `${baseSkill?.name} 提升至场外 ${after} 级` : `已注入 ${Math.min(count, meta.skillBooks)} 卷悟道残卷`);
  };

  return (
    <div className="skill-study-system">
      <div className="skill-study-toolbar">
        <div><small>万法总览</small><strong>已习得 {Object.values(meta.skillMastery).filter((skill) => skill.learned).length} / {SKILL_MANUALS.length}</strong></div>
        <nav aria-label="技能筛选">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全部</button>
          <button className={filter === "learned" ? "active" : ""} onClick={() => setFilter("learned")}>已习得</button>
          <button className={filter === "locked" ? "active" : ""} onClick={() => setFilter("locked")}>未参悟</button>
        </nav>
        <div className="skill-book-counter"><i>卷</i><span><small>悟道残卷</small><b>{meta.skillBooks}</b></span></div>
      </div>

      <div className="skill-study-layout">
        <section className="skill-manual-gallery">
          <div className="gallery-rune rune-one">乾</div><div className="gallery-rune rune-two">坤</div>
          {visibleManuals.map((manual, index) => {
            const state = meta.skillMastery[String(manual.baseId)];
            const skill = data.skills.find((entry) => Number(entry.resId) === manual.baseId);
            const evolved = data.skills.find((entry) => Number(entry.resId) === manual.evolutionId);
            const art = skillArtById(data, manual.baseId);
            return (
              <button
                key={manual.baseId}
                className={`skill-manual ${selected.baseId === manual.baseId ? "selected" : ""} ${state.learned ? "learned" : "locked"}`}
                onClick={() => setSelectedId(manual.baseId)}
                style={{ "--manual-order": index } as CSSProperties}
              >
                <span className="manual-index">{String(SKILL_MANUALS.indexOf(manual) + 1).padStart(2, "0")}</span>
                <i className="manual-art" style={{ backgroundImage: art ? `url("${art}")` : "none" }}><b>{manual.element}</b></i>
                <span className="manual-copy"><small>{manual.school}</small><strong>{skill?.name}</strong><em>化境 · {evolved?.name}</em></span>
                <span className="manual-state">{state.learned ? `外修 ${state.level} 重` : "尚未获得"}</span>
              </button>
            );
          })}
          {!visibleManuals.length && <p className="skill-gallery-empty">此卷暂无秘术记载</p>}
        </section>

        <aside className={`skill-study-detail ${selectedState.learned ? "learned" : "locked"}`}>
          <div className="skill-detail-sigil"><i /><i /><span>{selected.element}</span></div>
          <div className="skill-detail-heading">
            <small>{selected.school} · {selected.element}行</small>
            <h3>{baseSkill?.name}</h3>
            <p>{selected.verse}</p>
            <span className="skill-learn-seal">{selectedState.learned ? "已习" : "未悟"}</span>
          </div>

          <div className="skill-evolution-line">
            <span><small>初境</small><b>{baseSkill?.name}</b></span><i>流转</i><span><small>化境</small><b>{evolutionSkill?.name}</b></span>
          </div>

          <div className="skill-effect-scroll">
            <article><small>副本效果</small><p>{baseLevel?.desc ?? baseSkill?.desc ?? "施展秘法攻击妖物。"}</p></article>
            <article><small>化境真意</small><p>{evolutionLevel?.desc ?? "突破极限，演化为超武。"}</p></article>
            <article className="evolution-needs"><small>进化条件</small><p>{(evolution?.need ?? []).map((need: AnyRow) => `${requirementName(Number(need.resId))} ${need.level}级`).join(" ＋ ")}</p></article>
          </div>

          {selectedState.learned ? (
            <div className="skill-mastery-altar">
              <div className="mastery-level"><small>场外修习</small><b>{selectedState.level}</b><span>/ {MAX_SKILL_MASTERY_LEVEL} 重</span></div>
              <div className="mastery-bonus"><small>本系技能伤害</small><strong>+{currentDamage}%</strong>{!maxed && <span>下一级 +{nextDamage}%</span>}</div>
              <div className="mastery-exp"><i><u style={{ width: `${maxed ? 100 : Math.min(100, selectedState.exp / nextExp * 100)}%` }} /></i><span>{maxed ? "功法圆满" : `${selectedState.exp} / ${nextExp} 技能经验`}</span></div>
              <div className="mastery-actions">
                <button disabled={maxed || meta.skillBooks < 1} onClick={() => feedBooks(1)}>注入一卷 <small>+{SKILL_BOOK_EXP} 经验</small></button>
                <button disabled={maxed || meta.skillBooks < 1} onClick={() => feedBooks(5)}>连悟五卷 <small>最多消耗5卷</small></button>
              </div>
              <p>场外修习只增强该流派的伤害，不改变局内升级、弹道与进化条件；进化技能继承同一加成。</p>
            </div>
          ) : (
            <div className="skill-unlock-inscription">
              <small>玉简线索</small>
              <p><span>{selected.source}</span></p>
              <button disabled>取得功法玉简后自动收录</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export function WeaponManager({ meta, onChange, notify }: { meta: MetaProgress; onChange: (meta: MetaProgress) => void; notify: (message: string) => void }) {
  const [tab, setTab] = useState<"equipment" | "affixes" | "treasures" | "json">("equipment");
  const [selectedId, setSelectedId] = useState(meta.wmDraft.equipment[0]?.equipmentId ?? "");
  const [json, setJson] = useState(() => JSON.stringify(meta.wmDraft, null, 2));
  const draft = meta.wmDraft;
  const updateDraft = (next: WMConfig) => onChange({ ...meta, wmDraft: next });
  const updateRule = (next: WMEquipmentRule) => updateDraft({ ...draft, equipment: draft.equipment.map((rule) => rule.equipmentId === next.equipmentId ? next : rule) });
  const selected = draft.equipment.find((rule) => rule.equipmentId === selectedId) ?? draft.equipment[0];
  const publish = () => { onChange({ ...meta, wmDraft: draft, wmPublished: cloneWMConfig(draft), wmPublishedAt: Date.now() }); notify("WM配置已发布，新副本将使用此版本"); };
  return <div className="weapon-manager">
    <nav><button className={tab === "equipment" ? "active" : ""} onClick={() => setTab("equipment")}>武器装备</button><button className={tab === "affixes" ? "active" : ""} onClick={() => setTab("affixes")}>词条池</button><button className={tab === "treasures" ? "active" : ""} onClick={() => setTab("treasures")}>物品掉落</button><button className={tab === "json" ? "active" : ""} onClick={() => { setJson(JSON.stringify(draft, null, 2)); setTab("json"); }}>结构体注入</button><button className="wm-publish" onClick={publish}>发布到游戏</button></nav>
    {tab === "equipment" && selected && <div className="wm-equipment-layout"><aside>{draft.equipment.map((rule) => { const gear = equipmentById(rule.equipmentId); return <button key={rule.equipmentId} className={selected.equipmentId === rule.equipmentId ? "active" : ""} onClick={() => setSelectedId(rule.equipmentId)}><img src={gear.art} alt="" /><span><b>{gear.name}</b><small>{SLOT_META[gear.slot].name} · {RARITY_META[rule.rarity].name}</small></span></button>; })}</aside><section className="wm-rule-editor"><div className="wm-fields"><label>启用<input type="checkbox" checked={selected.enabled} onChange={(e) => updateRule({ ...selected, enabled: e.target.checked })} /></label><label>品质<select value={selected.rarity} onChange={(e) => updateRule({ ...selected, rarity: e.target.value as typeof selected.rarity })}>{Object.entries(RARITY_META).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}</select></label><label>基础价格<input type="number" value={selected.price} onChange={(e) => updateRule({ ...selected, price: +e.target.value })} /></label><label>基础掉率<input type="range" min="0" max="1" step=".005" value={selected.dropChance} onChange={(e) => updateRule({ ...selected, dropChance: +e.target.value })} /><b>{Math.round(selected.dropChance * 1000) / 10}%</b></label><label>通用副本<input type="checkbox" checked={selected.universal} onChange={(e) => updateRule({ ...selected, universal: e.target.checked })} /></label><label>关卡列表<input value={selected.waves.join(",")} disabled={selected.universal} onChange={(e) => updateRule({ ...selected, waves: e.target.value.split(",").map(Number).filter((v) => v >= 1 && v <= 21) })} placeholder="1,2,5" /></label></div><WMStatEditor title="绑定属性（必出）" stats={selected.boundStats} onChange={(boundStats) => updateRule({ ...selected, boundStats })} /><WMStatEditor title={`选取属性（随机 ${selected.optionalPick}/${selected.optionalStats.length}）`} stats={selected.optionalStats} onChange={(optionalStats) => updateRule({ ...selected, optionalStats })} extra={<input type="number" min="0" max={selected.optionalStats.length} value={selected.optionalPick} onChange={(e) => updateRule({ ...selected, optionalPick: +e.target.value })} />} /><div className="wm-affix-picks"><h4>可用词条 <small>命中后最多截断 <input type="number" min="0" max="8" value={selected.affixCap} onChange={(e) => updateRule({ ...selected, affixCap: +e.target.value })} /> 条</small></h4>{draft.affixes.map((affix) => <label key={affix.id}><input type="checkbox" checked={selected.affixIds.includes(affix.id)} onChange={(e) => updateRule({ ...selected, affixIds: e.target.checked ? [...selected.affixIds, affix.id] : selected.affixIds.filter((id) => id !== affix.id) })} />{affix.name}<small>{Math.round(affix.chance * 100)}%</small></label>)}</div></section></div>}
    {tab === "affixes" && <div className="wm-affix-list">{draft.affixes.map((affix) => <article key={affix.id}><div><input value={affix.name} onChange={(e) => updateDraft({ ...draft, affixes: draft.affixes.map((a) => a.id === affix.id ? { ...a, name: e.target.value } : a) })} /><label>出现概率<input type="range" min="0" max="1" step=".01" value={affix.chance} onChange={(e) => updateDraft({ ...draft, affixes: draft.affixes.map((a) => a.id === affix.id ? { ...a, chance: +e.target.value } : a) })} />{Math.round(affix.chance * 100)}%</label></div><WMStatEditor title="词条属性" stats={affix.stats} onChange={(stats) => updateDraft({ ...draft, affixes: draft.affixes.map((a) => a.id === affix.id ? { ...a, stats } : a) })} /></article>)}</div>}
    {tab === "treasures" && <div className="wm-treasure-table"><header><b>物品</b><b>价格</b><b>出现权重</b><b>范围</b><b>关卡列表</b></header>{draft.treasures.map((rule) => { const item = treasureById(rule.treasureId); return <article key={rule.treasureId}><label><input type="checkbox" checked={rule.enabled} onChange={(e) => updateDraft({ ...draft, treasures: draft.treasures.map((r) => r.treasureId === rule.treasureId ? { ...r, enabled: e.target.checked } : r) })} />{item.name}<small>{RARITY_META[item.rarity].name}</small></label><input type="number" value={rule.price} onChange={(e) => updateDraft({ ...draft, treasures: draft.treasures.map((r) => r.treasureId === rule.treasureId ? { ...r, price: +e.target.value } : r) })} /><input type="number" min="0" step=".05" value={rule.dropChance} onChange={(e) => updateDraft({ ...draft, treasures: draft.treasures.map((r) => r.treasureId === rule.treasureId ? { ...r, dropChance: +e.target.value } : r) })} /><button onClick={() => updateDraft({ ...draft, treasures: draft.treasures.map((r) => r.treasureId === rule.treasureId ? { ...r, universal: !r.universal } : r) })}>{rule.universal ? "全部副本" : "指定副本"}</button><input disabled={rule.universal} value={rule.waves.join(",")} placeholder="1,2,5" onChange={(e) => updateDraft({ ...draft, treasures: draft.treasures.map((r) => r.treasureId === rule.treasureId ? { ...r, waves: e.target.value.split(",").map(Number).filter((v) => v >= 1 && v <= 21) } : r) })} /></article>; })}</div>}
    {tab === "json" && <div className="wm-json"><p>可复制当前结构体批量修改后重新注入。注入只更新草稿，仍需点击发布。</p><textarea value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} /><div><button onClick={() => { setJson(JSON.stringify(DEFAULT_WM_CONFIG, null, 2)); }}>载入默认结构</button><button onClick={() => { try { const next = validateWMConfig(JSON.parse(json)); updateDraft(next); notify("结构体已注入草稿"); } catch (error) { notify(error instanceof Error ? error.message : "结构体无效"); } }}>注入草稿</button></div></div>}
  </div>;
}

function WMStatEditor({ title, stats, onChange, extra }: { title: string; stats: WMEquipmentRule["boundStats"]; onChange: (stats: WMEquipmentRule["boundStats"]) => void; extra?: ReactNode }) {
  return <div className="wm-stat-editor"><h4>{title}{extra}</h4>{stats.map((entry, index) => <div key={`${entry.key}-${index}`}><select value={entry.key} onChange={(e) => onChange(stats.map((row, i) => i === index ? { ...row, key: e.target.value as WMAttributeKey } : row))}>{Object.entries(WM_STAT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><label>最小<input type="number" step=".005" value={entry.min} onChange={(e) => onChange(stats.map((row, i) => i === index ? { ...row, min: +e.target.value } : row))} /></label><label>最大<input type="number" step=".005" value={entry.max} onChange={(e) => onChange(stats.map((row, i) => i === index ? { ...row, max: +e.target.value } : row))} /></label><button onClick={() => onChange(stats.filter((_, i) => i !== index))}>×</button></div>)}<button onClick={() => onChange([...stats, { key: "damage", min: .03, max: .08 }])}>＋ 添加属性</button></div>;
}

const ALLOCATION_META: Array<{ key: keyof AttributeAllocation; name: string; description: string }> = [
  { key: "health", name: "体魄", description: `每点生命 +${ATTRIBUTE_POINT_BONUS.health}` },
  { key: "defense", name: "护体", description: `每点防御 +${ATTRIBUTE_POINT_BONUS.defense}` },
  { key: "damage", name: "道法", description: `每点伤害 +${ATTRIBUTE_POINT_BONUS.damage * 100}%` },
  { key: "attackSpeed", name: "御器", description: `每点攻速 +${ATTRIBUTE_POINT_BONUS.attackSpeed * 100}%` },
  { key: "dodge", name: "身法", description: `每点闪避 +${ATTRIBUTE_POINT_BONUS.dodge * 100}%` },
  { key: "moveSpeed", name: "疾行", description: `每点移速 +${ATTRIBUTE_POINT_BONUS.moveSpeed}` },
];

export function CharacterProgression({ meta, relationships, onChange }: { meta: MetaProgress; relationships: Record<string, number>; onChange: (meta: MetaProgress) => void }) {
  const [section, setSection] = useState<"attributes" | "skills">("attributes");
  const [page, setPage] = useState<BlessingPage>("damage");
  const [selectedSkill, setSelectedSkill] = useState(PASSIVE_SKILLS[0].id);
  const attrPoints = availableAttributePoints(meta);
  const skillPoints = availableSkillPoints(meta);
  const selected = PASSIVE_SKILLS.find((skill) => skill.id === selectedSkill) ?? PASSIVE_SKILLS[0];
  const addAttribute = (key: keyof AttributeAllocation) => {
    if (attrPoints <= 0) return;
    onChange({ ...meta, attributeAllocation: { ...meta.attributeAllocation, [key]: meta.attributeAllocation[key] + 1 } });
  };
  const addPassive = () => {
    const rank = meta.passiveRanks[selected.id] ?? 0;
    if (skillPoints <= 0 || rank >= selected.maxRank || !passiveSkillUnlocked(meta.passiveRanks, selected, relationships)) return;
    onChange({ ...meta, passiveRanks: { ...meta.passiveRanks, [selected.id]: rank + 1 } });
  };
  const prerequisite = selected.requires ? PASSIVE_SKILLS.find((skill) => skill.id === selected.requires) : null;
  const selectedUnlocked = passiveSkillUnlocked(meta.passiveRanks, selected, relationships);
  return (
    <div className={`character-progression page-${section}`}>
      <nav className="progression-pagination" aria-label="人物成长分页">
        <button className={section === "attributes" ? "active" : ""} onClick={() => setSection("attributes")}><small>第一页</small><b>人物属性</b><span>{attrPoints} 点可用</span></button>
        <i>‹</i><button className={section === "skills" ? "active" : ""} onClick={() => setSection("skills")}><small>第二页</small><b>赐福技能树</b><span>{skillPoints} 点可用</span></button>
        <button className="page-turn" onClick={() => setSection(section === "attributes" ? "skills" : "attributes")}>{section === "attributes" ? "下一页 · 技能树 ›" : "‹ 上一页 · 人物属性"}</button>
      </nav>
      {section === "attributes" && <section className="attribute-allocation progression-page">
        <div className="point-heading"><div><small>可用属性点</small><b>{attrPoints}</b></div><span>每级获得 5 点</span></div>
        <div className="attribute-list">
          {ALLOCATION_META.map((entry) => (
            <article key={entry.key}>
              <div><strong>{entry.name}</strong><small>{entry.description}</small></div>
              <b>{meta.attributeAllocation[entry.key]}</b>
              <button disabled={attrPoints <= 0} onClick={() => addAttribute(entry.key)}>＋</button>
            </article>
          ))}
        </div>
        <p>属性点会永久增强副本外基础属性，装备和卡片在此基础上继续加成。</p>
      </section>}
      {section === "skills" && <section className={`blessing-tree progression-page blessing-${page}`}>
        <div className="blessing-tabs">
          {(Object.keys(BLESSING_META) as BlessingPage[]).map((key) => <button key={key} className={page === key ? "active" : ""} onClick={() => { setPage(key); setSelectedSkill(PASSIVE_SKILLS.find((skill) => skill.page === key)!.id); }}><b>{BLESSING_META[key].name}</b><small>{BLESSING_META[key].subtitle}</small></button>)}
        </div>
        <div className="skill-point-line"><span>可用技能点 <b>{skillPoints}</b></span><small>每级获得 1 点</small></div>
        <div className="passive-skill-tree">
          {PASSIVE_SKILLS.filter((skill) => skill.page === page).map((skill) => {
            const rank = meta.passiveRanks[skill.id] ?? 0;
            const unlocked = passiveSkillUnlocked(meta.passiveRanks, skill, relationships);
            return <button key={skill.id} style={{ gridColumn: skill.tier + 1, gridRow: skill.branch + 1 }} className={`${selected.id === skill.id ? "selected" : ""} ${rank >= skill.maxRank ? "maxed" : ""} ${unlocked ? "unlocked" : "locked"} ${skill.tier === 0 ? "root-skill" : ""}`} onClick={() => setSelectedSkill(skill.id)}><em aria-hidden="true" /><i>{unlocked ? skill.icon : "锁"}</i><strong>{skill.name}</strong><span>{rank}/{skill.maxRank}</span></button>;
          })}
        </div>
        <article className="passive-detail">
          <i>{selectedUnlocked ? selected.icon : "锁"}</i><div><small>{BLESSING_META[selected.page].name} · 第 {selected.tier + 1} 重</small><h3>{selected.name}</h3><p>{selected.description}</p><b>{selectedUnlocked ? `当前等级 ${meta.passiveRanks[selected.id] ?? 0} / ${selected.maxRank}` : `需先升满「${prerequisite?.name ?? "前置心法"}」`}</b></div>
          <button disabled={skillPoints <= 0 || !selectedUnlocked || (meta.passiveRanks[selected.id] ?? 0) >= selected.maxRank} onClick={addPassive}>{!selectedUnlocked ? "前置未圆满" : (meta.passiveRanks[selected.id] ?? 0) >= selected.maxRank ? "已经满级" : "消耗 1 点强化"}</button>
        </article>
      </section>}
    </div>
  );
}

export function EquipmentSystem({ meta, onChange, notify }: { meta: MetaProgress; onChange: (meta: MetaProgress) => void; notify: (message: string) => void }) {
  const { state } = useUnifiedGame();
  const [heldUid, setHeldUid] = useState<string | null>(null);
  const [selectedUid, setSelectedUid] = useState(meta.equipmentBag[0]?.uid ?? null);
  const attributes = computeFinalAttributes({ ...state, battle: meta });
  const stored = meta.equipmentBag.filter((item) => meta.equipmentPositions[item.uid]);
  const selected = meta.equipmentBag.find((item) => item.uid === selectedUid) ?? stored[0];
  const bodySlots: EquipmentBodySlot[] = ["head", "chest", "hands", "legs", "feet", "weapon", "offhand"];
  const slotName = (slot: EquipmentBodySlot) => slot === "offhand" ? { name: "副手", mark: "辅" } : SLOT_META[slot];
  const equip = (uid: string) => { const result = tryEquipItem(meta, uid); onChange(result.meta); notify(result.message); if (result.ok) setHeldUid(null); };
  const unequip = (slot: EquipmentBodySlot) => { const result = tryUnequipItem(meta, slot); onChange(result.meta); notify(result.message); };
  const identify = (uid: string) => { const result = identifyEquipment(meta, uid); onChange(result.meta); notify(result.message); };
  const place = (uid: string, x: number, y: number) => { const next = moveEquipment(meta, uid, x, y); if (next === meta) notify("此处放不下，或交换后的法器无处安放"); else { onChange(next); setHeldUid(null); } };

  return (
    <div className="equipment-layout devilution-equipment">
      <section className="equipment-doll">
        <div className="doll-silhouette"><i className="doll-head" /><i className="doll-body" /><i className="doll-arms" /><i className="doll-legs" /></div>
        {bodySlots.map((slot) => {
          const uid = meta.equipped[slot];
          const item = meta.equipmentBag.find((entry) => entry.uid === uid);
          const definition = item ? equipmentById(item.equipmentId) : null;
          const enabled = item ? canUseEquipment(item, attributes) : true;
          return <button key={slot} className={`gear-slot slot-${slot} ${definition ? `rarity-${item?.rarity ?? definition.rarity}` : "empty"} ${enabled ? "" : "disabled-gear"}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const draggedUid = event.dataTransfer.getData("application/x-blcx-equipment"); if (draggedUid) equip(draggedUid); }} onClick={() => uid && unequip(slot)} title={definition ? `${item?.name ?? definition.name}（点击卸下）` : slotName(slot).name}>
            {definition ? <><img src={definition.art} alt="" />{item?.twoHanded && <em>双手</em>}{!enabled && <b>失效</b>}</> : <><b>{slotName(slot).mark}</b><small>{slotName(slot).name}</small></>}
          </button>;
        })}
        <aside className="requirement-readout"><span>体魄 <b>{Math.floor(attributes.strength)}</b></span><span>身法 <b>{Math.floor(attributes.dexterity)}</b></span><span>神识 <b>{Math.floor(attributes.magic)}</b></span></aside>
      </section>
      <section className="gear-backpack tetris-pack">
        <header><div><h3>乾坤行囊 <small>10×4 · 40 格</small></h3><p>点击拿起再点格子，或直接拖拽；可与一件法器原子交换。</p></div><button onClick={() => { onChange(sortEquipment(meta)); notify("行囊已按高度、宽度压缩整理"); }}>一键整理</button></header>
        <div className="gear-pack-workspace">
          <div className="gear-tetris-grid" aria-label="10乘4法器背包">
            {Array.from({ length: 40 }).map((_, index) => { const x = index % 10; const y = Math.floor(index / 10); return <i key={index} data-cell={`${x}-${y}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const uid = event.dataTransfer.getData("application/x-blcx-equipment"); if (uid) place(uid, x, y); }} onClick={() => heldUid && place(heldUid, x, y)} />; })}
            {stored.map((item) => {
              const definition = equipmentById(item.equipmentId); const point = meta.equipmentPositions[item.uid]; const size = equipmentSize(item); const rarity = item.rarity ?? definition.rarity;
              return <article key={item.uid} draggable onDragStart={(event) => event.dataTransfer.setData("application/x-blcx-equipment", item.uid)} onClick={(event) => { event.stopPropagation(); setSelectedUid(item.uid); setHeldUid(heldUid === item.uid ? null : item.uid); }} onDoubleClick={() => equip(item.uid)} className={`rarity-${rarity} ${heldUid === item.uid ? "is-held" : ""} ${item.identified === false ? "unidentified" : ""}`} style={{ gridColumn: `${point.x + 1} / span ${size.width}`, gridRow: `${point.y + 1} / span ${size.height}`, "--rarity": RARITY_META[rarity].color } as CSSProperties}>
                <img src={definition.art} alt="" /><small>{item.identified === false ? "未鉴定" : item.twoHanded ? "双手" : RARITY_META[rarity].name}</small>
              </article>;
            })}
          </div>
          <aside className="gear-inspector">
            {selected ? (() => { const base = equipmentById(selected.equipmentId); const req = equipmentRequirements(selected); const enabled = canUseEquipment(selected, attributes); const size = equipmentSize(selected); const simulated=enabled&&selected.identified!==false?tryEquipItem(meta,selected.uid).meta:meta; const after=computeFinalAttributes({ ...state, battle: simulated }); const comparisons=[{label:feedbackText("items.statHealth"),before:Math.round(attributes.health),after:Math.round(after.health)},{label:feedbackText("items.statDamage"),before:Math.round(attributes.damage*100),after:Math.round(after.damage*100),unit:"%"},{label:feedbackText("items.statDefense"),before:Math.round(attributes.defense),after:Math.round(after.defense)},{label:feedbackText("items.statHit"),before:Math.round(attributes.hitChance*100),after:Math.round(after.hitChance*100),unit:"%"}]; return <><div className="gear-inspector-art" style={{ "--rarity": RARITY_META[selected.rarity ?? base.rarity].color } as CSSProperties}><img src={base.art} alt="" /><span>{selected.identified === false ? "未鉴定法器" : RARITY_META[selected.rarity ?? base.rarity].name}</span></div><small>{SLOT_META[base.slot].name} · {size.width}×{size.height}{selected.twoHanded ? " · 占据双手" : ""}</small><h3>{selected.identified === false ? `未鉴定的${base.name}` : selected.name ?? base.name}</h3><p>{base.description}</p><div className="gear-compare-strip"><small>{feedbackText("items.compareAfter")}</small>{comparisons.map((entry)=>{const delta=entry.after-entry.before;return <span key={entry.label} className={delta>0?"up":delta<0?"down":"same"}><b>{entry.label}</b><em>{entry.before}{entry.unit} → {entry.after}{entry.unit}</em><i>{delta===0?feedbackText("items.statSame"):`${delta>0?"+":""}${delta}${entry.unit??""}`}</i></span>})}</div><div className="gear-stat-chips">{formatBonus(equipmentAttributeBonus(selected)).map((line) => <span key={line}>{line}</span>)}</div><div className={`gear-requirements ${enabled ? "met" : "failed"}`}><b>驱使要求</b><span>体魄 {req.strength ?? 0}</span><span>身法 {req.dexterity ?? 0}</span><span>神识 {req.magic ?? 0}</span></div><footer><b>估值 {equipmentValue(selected).toLocaleString()} 灵石</b>{selected.identified === false ? <button onClick={() => identify(selected.uid)}>鉴定并激活词缀</button> : <button disabled={!enabled} onClick={() => equip(selected.uid)}>{enabled ? "装备" : "属性不足"}</button>}</footer></>; })() : <p>行囊中暂无法器</p>}
          </aside>
        </div>
      </section>
    </div>
  );
}

const CARD_RARITY_NAMES = ["", ...Object.values(CARD_QUALITY_NAMES)];

export function CardSystem({ meta, cards, onChange }: { meta: MetaProgress; cards: UnifiedCardInstance[]; onChange: (meta: MetaProgress) => void }) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const quickEquip = (cardId: string) => {
    if (!cards.some((card) => card.id === cardId && card.mode === "active")) return;
    const open = meta.cardSlots.slice(0, meta.cardSlotCount).findIndex((id) => !id);
    const target = open >= 0 ? open : 0;
    const slots = meta.cardSlots.map((id) => id === cardId ? null : id);
    slots[target] = cardId;
    onChange({ ...meta, cardSlots: slots });
  };
  const detail = detailId ? cards.find((card) => card.id === detailId) ?? null : null;
  return (
    <div className="card-system">
      <aside className="card-slots">
        <h3>命格卡槽</h3>
        {[0, 1, 2].map((index) => {
          const unlocked = index < meta.cardSlotCount;
          const cardId = meta.cardSlots[index];
          const card = cardId ? cards.find((entry) => entry.id === cardId) ?? null : null;
          return (
            <button
              key={index}
              className={`${unlocked ? "unlocked" : "locked"} ${card ? `rarity-${Math.min(5, card.rarity)}` : ""}`}
              onDragOver={(event) => unlocked && event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("application/x-blcx-card"); if (!unlocked || !cards.some((entry) => entry.id === id && entry.mode === "active")) return; const slots = meta.cardSlots.map((value) => value === id ? null : value); slots[index] = id; onChange({ ...meta, cardSlots: slots }); }}
              onClick={() => card && onChange({ ...meta, cardSlots: meta.cardSlots.map((id, slot) => slot === index ? null : id) })}
            >
              {card ? <><img src={card.art} alt="" /><strong>{card.name}</strong><small>点击卸下</small></> : <><b>{unlocked ? "+" : "锁"}</b><span>{unlocked ? "拖入插入卡" : "尚未解锁"}</span></>}
            </button>
          );
        })}
      </aside>
      <section className="card-gallery-wrap">
        <h3>卡片展廊 <small>单击查看 · 双击插入</small></h3>
        <div className="card-gallery">
          {cards.map((card) => {
            return (
              <article
                key={card.id}
                draggable={card.mode === "active"}
                onDragStart={(event) => event.dataTransfer.setData("application/x-blcx-card", card.id)}
                onClick={() => setDetailId(card.id)}
                onDoubleClick={() => card.mode === "active" && quickEquip(card.id)}
                className={`rarity-${Math.min(5, card.rarity)}`}
              >
                <img src={card.art} alt="" />
                <i /><div><small>{card.mode === "active" ? "主动命契" : "被动命格 · 持有生效"}</small><strong>{card.name}</strong><p>{card.mode === "active" ? "元气充盈时召唤人物施展专属术法" : formatBonus(card.bonuses ?? {}).join(" · ")}</p></div>
              </article>
            );
          })}
        </div>
      </section>
      {detail && (
        <div className="card-detail-backdrop" onClick={() => setDetailId(null)}>
          <article className={`card-detail rarity-${Math.min(5, detail.rarity)}`} onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setDetailId(null)}>×</button><img src={detail.art} alt="" />
            <div><small>{CARD_RARITY_NAMES[detail.rarity]} · {detail.mode === "active" ? "主动命契" : "被动命格"}</small><h3>{detail.name}</h3><p>{detail.source === "story" ? "人物剧情中缔结的命契，人物、术法与立绘均由同一命格记录读取。" : detail.source === "alchemy" ? "由玄火丹炉显化的命格。" : "秘境中偶得的命格。"}</p><strong>{detail.mode === "active" ? "元气满时进入召唤候选" : formatBonus(detail.bonuses ?? {}).join(" · ")}</strong>{detail.mode === "active" && <button className="card-equip" onClick={() => { quickEquip(detail.id); setDetailId(null); }}>插入可用卡槽</button>}</div>
          </article>
        </div>
      )}
    </div>
  );
}
