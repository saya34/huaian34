"use client";

import { useMemo, useState } from "react";
import { checkCondition } from "../event-engine";
import type { Condition, EventDefinition, GameState, TriggerContext } from "../types";

type Props = {
  events: EventDefinition[];
  game: GameState;
  onClose: () => void;
  onPreview: (event: EventDefinition) => void;
};

function previewContext(event: EventDefinition): TriggerContext {
  const gift = event.conditions.find((condition) => condition.type === "gift");
  return {
    trigger: event.trigger,
    sceneId: event.sceneId,
    characterId: event.characterId,
    giftId: gift?.type === "gift" ? gift.value : undefined,
    interactionId: event.interactionId,
  };
}

function conditionLabel(condition: Condition) {
  switch (condition.type) {
    case "scene": return `地点 · ${condition.value}`;
    case "character": return `人物 · ${condition.value}`;
    case "gift": return `赠礼 · ${condition.value}`;
    case "period": return `时辰 · ${condition.value}`;
    case "relationship": return `缘分 · ${condition.min}以上`;
    case "event_completed": return `前置 · ${condition.eventId}`;
    case "flag": return `记忆 · ${condition.key}=${condition.value ? "是" : "否"}`;
    case "player_level": return `等级 · ${condition.min}以上`;
    case "teacher_skill": return `命格 · ${condition.skillId} ${condition.minRank}重`;
    case "learned_skill": return `已习功法 · ${condition.skillId}`;
    case "card_owned": return `持有人物卡 · ${condition.cardId}`;
    case "item_rarity": return `${condition.itemType}品质 · ${condition.minRarity}以上`;
    case "dungeon_complete": return `秘境通关 · ${condition.waveId}`;
    case "alchemy_result": return `炼丹所得 · ${condition.itemId}`;
  }
}

/**
 * Build an effect-free transient clone. It deliberately cannot grant affinity,
 * flags, skills or rewards, and it never enters the normal completion journal.
 */
export function createShenStoryPreview(event: EventDefinition): EventDefinition {
  const nodes = Object.fromEntries(Object.entries(event.nodes).map(([id, node]) => {
    if (node.type === "choice") {
      return [id, { ...node, options: node.options.map(({ effects: _effects, ...option }) => option) }];
    }
    const { effects: _effects, ...safeNode } = node;
    return [id, safeNode];
  })) as EventDefinition["nodes"];
  return {
    ...event,
    id: `debug.${event.id}`,
    title: `校验 · ${event.title}`,
    trigger: "talk",
    once: false,
    journal: false,
    interactionId: undefined,
    conditions: [],
    nodes,
  };
}

export default function ShenStoryDebugPanel({ events, game, onClose, onPreview }: Props) {
  const stories = useMemo(
    () => events.filter((event) => event.characterId === "shen" && event.id.startsWith("shen.arc."))
      .sort((a, b) => (a.debugOrder ?? 0) - (b.debugOrder ?? 0)),
    [events],
  );
  const phases = useMemo(() => [...new Set(stories.map((event) => event.storyPhase ?? "未分章"))], [stories]);
  const [phase, setPhase] = useState("全部");
  const [selectedId, setSelectedId] = useState(stories[0]?.id ?? "");
  const visible = phase === "全部" ? stories : stories.filter((event) => event.storyPhase === phase);
  const selected = stories.find((event) => event.id === selectedId) ?? visible[0] ?? stories[0];
  const context = selected ? previewContext(selected) : null;
  const checks = selected && context
    ? selected.conditions.map((condition) => ({ condition, pass: checkCondition(condition, game, context) }))
    : [];
  const naturallyReady = checks.every((entry) => entry.pass) && Boolean(selected && (!selected.once || !game.completedEvents.includes(selected.id)));

  return (
    <div className="shen-debug-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="shen-debug-panel" role="dialog" aria-modal="true" aria-label="沈清霜剧情校验" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><small>LOCAL STORY VERIFIER</small><h2>沈清霜 · 渐进剧情校验</h2><p>共 {stories.length} 段；预览不会改变好感、奖励或完成状态。</p></div>
          <button type="button" onClick={onClose} aria-label="关闭剧情校验">×</button>
        </header>
        <nav className="shen-debug-phases" aria-label="剧情阶段">
          {["全部", ...phases].map((entry) => <button type="button" key={entry} className={phase === entry ? "active" : ""} onClick={() => setPhase(entry)}>{entry}</button>)}
        </nav>
        <div className="shen-debug-body">
          <div className="shen-debug-list" role="listbox" aria-label="剧情列表">
            {visible.map((event) => {
              const completed = game.completedEvents.includes(event.id);
              return <button type="button" key={event.id} role="option" aria-selected={selected?.id === event.id} className={`${selected?.id === event.id ? "selected" : ""} ${completed ? "completed" : ""}`} onClick={() => setSelectedId(event.id)}>
                <i>{String(event.debugOrder ?? 0).padStart(2, "0")}</i><span><small>{event.storyPhase}</small><strong>{event.title}</strong><em>{event.authoredRoundCount ?? "?"}轮 · {completed ? "已体验" : "未体验"}</em></span>
              </button>;
            })}
          </div>
          {selected && <article className="shen-debug-detail">
            <div className="shen-debug-title"><span>{String(selected.debugOrder ?? 0).padStart(2, "0")}</span><div><small>{selected.storyPhase} · {selected.trigger}</small><h3>{selected.title}</h3><p>{selected.subtitle}</p></div></div>
            <section><small>自然触发线索</small><p>{selected.clue}</p></section>
            <section><small>触发条件 · 当前存档</small><div className="shen-debug-checks">{checks.length ? checks.map(({ condition, pass }, index) => <span key={`${selected.id}:${index}`} className={pass ? "pass" : "fail"}><i>{pass ? "✓" : "×"}</i>{conditionLabel(condition)}</span>) : <span className="pass"><i>✓</i>无额外条件</span>}</div></section>
            <section className="shen-debug-meta"><span><small>轮数</small><b>{selected.authoredRoundCount}</b></span><span><small>类型</small><b>{selected.type}</b></span><span><small>自然状态</small><b>{naturallyReady ? "可触发" : "未满足"}</b></span></section>
            <footer><p>直接预览会绕过条件，但使用无效果副本，不写入正常剧情进度。</p><button type="button" onClick={() => onPreview(selected)}>直接进入此剧情</button></footer>
          </article>}
        </div>
      </section>
    </div>
  );
}
