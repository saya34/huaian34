"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { availableSkillPoints, feedSkillExperience } from "../battle/meta";
import { MAX_SKILL_MASTERY_LEVEL, SKILL_BOOK_EXP, skillMasteryDamageMultiplier, skillMasteryExpToNext } from "../battle/skillMastery";
import { BLESSING_META, PASSIVE_SKILLS, passiveSkillUnlocked, type BlessingPage, type PassiveSkillDefinition } from "../battle/progression";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { useFeedback } from "../feedback/FeedbackProvider";
import { MANUAL_COPY, MANUAL_RARITY_NAMES, MANUALS } from "./manual-service";
import { SKILL_TREE_COPY, nextTreeMilestone, skillsForTree, treeById } from "./tree-service";

type ArtsView = "manuals" | "meridians";
type ManualFilter = "all" | "剑诀" | "器术" | "术法" | "护御";

const FILTERS: Array<{ id: ManualFilter; label: string; schools?: string[] }> = [
  { id: "all", label: "全卷" },
  { id: "剑诀", label: "剑刀", schools: ["剑诀", "刀法"] },
  { id: "器术", label: "器御", schools: ["器术", "御灵"] },
  { id: "术法", label: "咒阵", schools: ["灵咒", "阵法"] },
  { id: "护御", label: "护法", schools: ["护法"] },
];

function manualEffect(level: number) {
  return `${Math.round((skillMasteryDamageMultiplier(level) - 1) * 100)}%`;
}

function nodeState(ranks: Record<string, number>, node: PassiveSkillDefinition) {
  const rank = ranks[node.id] ?? 0;
  const unlocked = passiveSkillUnlocked(ranks, node);
  return { rank, unlocked, maxed: rank >= node.maxRank };
}

export default function CultivationArtsPanel() {
  const { state, setBattle } = useUnifiedGame();
  const feedback = useFeedback();
  const [view, setView] = useState<ArtsView>("manuals");
  const [filter, setFilter] = useState<ManualFilter>("all");
  const [selectedManualId, setSelectedManualId] = useState(MANUALS[0].baseId);
  const [path, setPath] = useState<BlessingPage>("damage");
  const [selectedNodeId, setSelectedNodeId] = useState(PASSIVE_SKILLS.find((node) => node.page === "damage")!.id);
  const [awakenedId, setAwakenedId] = useState("");

  const selectedManual = MANUALS.find((manual) => manual.baseId === selectedManualId) ?? MANUALS[0];
  const mastery = state.battle.skillMastery[String(selectedManual.baseId)] ?? { learned: false, level: 1, exp: 0 };
  const nextManualExp = skillMasteryExpToNext(mastery.level);
  const visibleManuals = useMemo(() => {
    const selectedFilter = FILTERS.find((entry) => entry.id === filter);
    return selectedFilter?.schools ? MANUALS.filter((manual) => selectedFilter.schools!.includes(manual.school)) : MANUALS;
  }, [filter]);
  const learnedCount = MANUALS.filter((manual) => state.battle.skillMastery[String(manual.baseId)]?.learned).length;

  const selectedNode = PASSIVE_SKILLS.find((node) => node.id === selectedNodeId) ?? skillsForTree(path)[0];
  const selectedNodeStatus = nodeState(state.battle.passiveRanks, selectedNode);
  const prerequisite = selectedNode.requires ? PASSIVE_SKILLS.find((node) => node.id === selectedNode.requires) : null;
  const skillPoints = availableSkillPoints(state.battle);
  const activeTree = treeById(path);
  const pathSkills = skillsForTree(path);
  const investedInPath = pathSkills.reduce((sum, skill) => sum + (state.battle.passiveRanks[skill.id] ?? 0), 0);
  const milestone = nextTreeMilestone(path, state.battle.passiveRanks);

  const feedManual = (books: number) => {
    if (!mastery.learned || mastery.level >= MAX_SKILL_MASTERY_LEVEL || state.battle.skillBooks <= 0) return;
    setBattle((current) => feedSkillExperience(current, selectedManual.baseId, books));
    feedback.toast({ titleKey: "system.dynamicMessage", params: { message: `悟道残卷化作流光，「${selectedManual.name}」修习精进` }, icon: "悟", tone: "gold", dedupeKey: `manual-feed:${selectedManual.baseId}:${Date.now()}` });
  };

  const investNode = () => {
    const current = state.battle;
    const status = nodeState(current.passiveRanks, selectedNode);
    if (availableSkillPoints(current) <= 0 || !status.unlocked || status.maxed) return;
    setBattle({ ...current, passiveRanks: { ...current.passiveRanks, [selectedNode.id]: status.rank + 1 } });
    setAwakenedId(selectedNode.id);
    feedback.publish({
      variant: selectedNode.milestone ? "progression-milestone" : "action-toast",
      priority: selectedNode.milestone ? 0 : 1,
      tone: selectedNode.milestone ? "gold" : "jade",
      titleKey: "system.dynamicMessage",
      params: { message: selectedNode.milestone ? `强力道节点亮 · ${selectedNode.name}` : `悟道 · ${selectedNode.name}` },
      icon: selectedNode.icon,
      details: [{ labelKey: "player.nextEffect", value: selectedNode.description, emphasis: true }],
      dedupeKey: `skill-node:${selectedNode.id}`,
    });
  };

  const selectPath = (next: BlessingPage) => {
    setPath(next);
    setSelectedNodeId(skillsForTree(next)[0].id);
  };

  return <div className={`cultivation-arts view-${view}`}>
    <nav className="arts-primary-tabs" aria-label="功法分类">
      <button className={view === "manuals" ? "active" : ""} onClick={() => setView("manuals")}><i>卷</i><span><small>战斗三选一</small><b>万法谱</b></span><em>{learnedCount}/{MANUALS.length}</em></button>
      <button className={view === "meridians" ? "active" : ""} onClick={() => setView("meridians")}><i>脉</i><span><small>永久成长</small><b>天衍道脉</b></span><em>{skillPoints} 点</em></button>
    </nav>

    {view === "manuals" && <section className="manual-codex-v2">
      <header className="arts-scene-heading"><div><small>COMBAT ARTS · 无先后依赖</small><h3>{MANUAL_COPY.title}</h3><p>{MANUAL_COPY.subtitle}</p></div><div className="arts-resource"><i>简</i><span>悟道残卷<b>{state.battle.skillBooks}</b></span></div></header>
      <div className="manual-stage">
        <aside className="manual-school-wheel" aria-label="功法流派筛选">{FILTERS.map((entry) => <button key={entry.id} className={filter === entry.id ? "active" : ""} onClick={() => setFilter(entry.id)}><i>{entry.label.slice(0, 1)}</i><span>{entry.label}</span></button>)}</aside>
        <div className="manual-scrolls" role="list">{visibleManuals.map((manual) => {
          const stateForManual = state.battle.skillMastery[String(manual.baseId)];
          const learned = Boolean(stateForManual?.learned);
          return <button type="button" role="listitem" key={manual.baseId} className={`manual-talisman rarity-${manual.rarity} ${selectedManual.baseId === manual.baseId ? "selected" : ""} ${learned ? "learned" : "unknown"}`} onClick={() => setSelectedManualId(manual.baseId)}>
            <span className="talisman-art"><img src={manual.art} alt=""/><i>{manual.element}</i>{!learned && <b>?</b>}</span>
            <small>{manual.school} · {MANUAL_RARITY_NAMES[manual.rarity]}</small><strong>{learned ? manual.name : "未得玉简"}</strong><em>{learned ? `${stateForManual.level} 重` : manual.source}</em>
          </button>;
        })}</div>
        <article className={`manual-altar rarity-${selectedManual.rarity} ${mastery.learned ? "learned" : "unknown"}`}>
          <div className="altar-art"><img src={selectedManual.art} alt=""/><span>{selectedManual.element}</span><i/><i/></div>
          <div className="altar-copy"><small>{selectedManual.school} · {MANUAL_RARITY_NAMES[selectedManual.rarity]}</small><h3>{mastery.learned ? selectedManual.name : "玉简尚未入谱"}</h3><p>{mastery.learned ? selectedManual.verse : `线索：${selectedManual.source}`}</p><div className="manual-role"><span>{selectedManual.role}</span><b>化境 · {selectedManual.evolutionName}</b></div><p className="manual-description">{selectedManual.description}</p></div>
          {mastery.learned ? <div className="manual-mastery">
            <div><small>外修境界</small><strong>{mastery.level}<i>/ {MAX_SKILL_MASTERY_LEVEL}</i></strong><span>本系伤害 +{manualEffect(mastery.level)}</span></div>
            <div className="manual-exp-orbit"><i><b style={{ "--manual-progress": `${mastery.level >= MAX_SKILL_MASTERY_LEVEL ? 100 : Math.min(100, mastery.exp / Math.max(1, nextManualExp) * 100)}%` } as CSSProperties}/></i><span>{mastery.level >= MAX_SKILL_MASTERY_LEVEL ? "功法圆满" : `${mastery.exp} / ${nextManualExp} 悟道`}</span></div>
            <footer><button disabled={mastery.level >= MAX_SKILL_MASTERY_LEVEL || state.battle.skillBooks < 1} onClick={() => feedManual(1)}>注入一卷<small>+{SKILL_BOOK_EXP}</small></button><button disabled={mastery.level >= MAX_SKILL_MASTERY_LEVEL || state.battle.skillBooks < 1} onClick={() => feedManual(5)}>连悟五卷</button></footer>
          </div> : <div className="manual-clue"><i>缘</i><span><small>获得途径</small><b>{selectedManual.source}</b><p>功法之间没有先后关系；取得玉简后会自动进入战斗升级候选池。</p></span></div>}
        </article>
      </div>
    </section>}

    {view === "meridians" && <section className={`meridian-sanctum path-${path}`}>
      <header className="arts-scene-heading"><div><small>PERMANENT PATH · 根至叶共 13 节</small><h3>{SKILL_TREE_COPY.title}</h3><p>{SKILL_TREE_COPY.subtitle}</p></div><div className="arts-resource skill-points"><i>悟</i><span>可用悟道点<b>{skillPoints}</b></span></div></header>
      <nav className="path-gates" aria-label="选择成长方向">{(Object.keys(BLESSING_META) as BlessingPage[]).map((key) => {
        const meta = BLESSING_META[key];
        const invested = skillsForTree(key).reduce((sum, skill) => sum + (state.battle.passiveRanks[skill.id] ?? 0), 0);
        return <button key={key} className={path === key ? "active" : ""} data-tone={meta.tone} onClick={() => selectPath(key)}><i>{meta.mark}</i><span><b>{meta.name}</b><small>{meta.subtitle}</small></span><em>{invested}/25</em></button>;
      })}</nav>
      <div className="meridian-map" style={{ "--tree-depth": 13 } as CSSProperties}>
        <div className="meridian-map-backdrop" aria-hidden="true"/>
        <div className="branch-label top"><i>{activeTree.branches[0].name}</i><span>壹脉</span></div><div className="branch-label bottom"><i>{activeTree.branches[1].name}</i><span>贰脉</span></div>
        <div className="meridian-node-grid">{pathSkills.map((node) => {
          const status = nodeState(state.battle.passiveRanks, node);
          const row = node.branch + 1;
          const column = node.tier + 1;
          return <button key={node.id} className={`meridian-node ${node.tier === 0 ? "root" : ""} ${node.milestone ? "milestone" : ""} ${status.maxed ? "learned" : status.unlocked ? "available" : "locked"} ${selectedNode.id === node.id ? "selected" : ""} ${awakenedId === node.id ? "awakening" : ""}`} style={{ "--node-column": column, "--node-row": row } as CSSProperties} onClick={() => setSelectedNodeId(node.id)} onAnimationEnd={() => awakenedId === node.id && setAwakenedId("")} aria-label={`${node.name}，${status.maxed ? "已习得" : status.unlocked ? "可点亮" : "未解锁"}`}>
            <span><i>{status.maxed || status.unlocked ? node.icon : "锁"}</i>{node.milestone && <b>强</b>}</span><strong>{node.name}</strong><small>{node.tier === 0 ? "道基" : `${node.branchName} · ${node.tier}`}</small>
          </button>;
        })}</div>
      </div>
      <footer className="meridian-command">
        <div className={`selected-node-emblem ${selectedNode.milestone ? "milestone" : ""}`}><i>{selectedNodeStatus.unlocked ? selectedNode.icon : "锁"}</i><span>{selectedNode.milestone ? "强力节点" : selectedNode.kind === "passive" ? "永久被动" : "道脉奥义"}</span></div>
        <div className="selected-node-copy"><small>{BLESSING_META[selectedNode.page].name} · {selectedNode.branchName} · 第 {selectedNode.tier + 1} 节</small><h3>{selectedNode.name}</h3><p>{selectedNode.description}</p><span>{selectedNodeStatus.maxed ? "已融入根基，属性即时生效" : selectedNodeStatus.unlocked ? "前置已通，可消耗一点悟道点" : `需先习得「${prerequisite?.name ?? "前置道基"}」`}</span></div>
        <div className="node-action"><div><small>此脉已投入</small><b>{investedInPath}</b>{milestone && <span>下一强力节点 · {milestone.name}</span>}</div><button disabled={skillPoints <= 0 || !selectedNodeStatus.unlocked || selectedNodeStatus.maxed} onClick={investNode}>{selectedNodeStatus.maxed ? "已点亮" : !selectedNodeStatus.unlocked ? "道脉未通" : skillPoints <= 0 ? "升级后再悟" : "点亮此节点"}</button></div>
      </footer>
    </section>}
  </div>;
}
