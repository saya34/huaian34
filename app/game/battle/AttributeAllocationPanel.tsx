"use client";

import { availableAttributePoints, type MetaProgress } from "./meta";
import { ATTRIBUTE_POINT_BONUS, type AttributeAllocation } from "./progression";

const ALLOCATION_META: Array<{ key: keyof AttributeAllocation; mark: string; name: string; description: string }> = [
  { key: "health", mark: "体", name: "体魄", description: `生命 +${ATTRIBUTE_POINT_BONUS.health}` },
  { key: "defense", mark: "御", name: "护体", description: `防御 +${ATTRIBUTE_POINT_BONUS.defense}` },
  { key: "damage", mark: "法", name: "道法", description: `伤害 +${ATTRIBUTE_POINT_BONUS.damage * 100}%` },
  { key: "attackSpeed", mark: "器", name: "御器", description: `攻速 +${ATTRIBUTE_POINT_BONUS.attackSpeed * 100}%` },
  { key: "dodge", mark: "身", name: "身法", description: `闪避 +${ATTRIBUTE_POINT_BONUS.dodge * 100}%` },
  { key: "moveSpeed", mark: "行", name: "疾行", description: `移速 +${ATTRIBUTE_POINT_BONUS.moveSpeed}` },
];

export function AttributeAllocationPanel({
  meta,
  onAllocate,
  variant = "paper",
}: {
  meta: MetaProgress;
  onAllocate: (key: keyof AttributeAllocation) => void;
  variant?: "paper" | "profile";
}) {
  const available = availableAttributePoints(meta);
  const spent = Object.values(meta.attributeAllocation).reduce((sum, value) => sum + value, 0);
  const earned = meta.playerLevel * 5;

  return <section className={`attribute-allocation allocation-${variant}`}>
    <div className="point-heading">
      <div><small>可用属性点</small><b>{available}</b></div>
      <span><strong>每次升级 +5</strong><small>已投入 {spent} / 累计 {earned}</small></span>
    </div>
    <div className="attribute-list">
      {ALLOCATION_META.map((entry) => (
        <article key={entry.key} data-attribute={entry.key}>
          <i aria-hidden="true">{entry.mark}</i>
          <div><strong>{entry.name}</strong><small>每点 {entry.description}</small></div>
          <b aria-label={`${entry.name}已投入${meta.attributeAllocation[entry.key]}点`}>{meta.attributeAllocation[entry.key]}</b>
          <button type="button" disabled={available <= 0} onClick={() => onAllocate(entry.key)} aria-label={`为${entry.name}投入1点属性`}>＋</button>
        </article>
      ))}
    </div>
    <p>{available > 0 ? `尚有 ${available} 点未分配，投入后立即计入人物、战前整备与战斗属性。` : "本级属性点已分配完毕，人物、战前整备与战斗会读取同一结果。"}</p>
  </section>;
}
