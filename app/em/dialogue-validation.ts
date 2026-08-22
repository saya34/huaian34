import type { DialogueProfileDefinition, Period } from "../game/types";

const PERIODS: Period[] = ["清晨", "黄昏", "夜晚"];
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

export function validateDialogueProfile(input: unknown) {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["对话档案必须是一个对象"] };
  if (typeof input.id !== "string" || !/^[a-z0-9][a-z0-9._-]{1,60}$/i.test(input.id)) errors.push("档案 ID 格式无效");
  if (typeof input.characterId !== "string" || !input.characterId.trim()) errors.push("缺少 characterId");
  if (!Array.isArray(input.rules) || !input.rules.length) errors.push("至少需要一条分阶段对话规则");
  const ranges = new Map<string, Array<[number, number]>>();
  if (Array.isArray(input.rules)) input.rules.forEach((raw, index) => {
    if (!isRecord(raw)) { errors.push(`第 ${index + 1} 条规则格式无效`); return; }
    if (typeof raw.id !== "string" || !raw.id.trim()) errors.push(`第 ${index + 1} 条规则缺少 ID`);
    const min = Number(raw.minRelationship); const max = Number(raw.maxRelationship);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 100 || min > max) errors.push(`第 ${index + 1} 条规则的好感区间无效`);
    if (!PERIODS.includes(raw.period as Period)) errors.push(`第 ${index + 1} 条规则的时间段无效`);
    if (!Array.isArray(raw.lines) || !raw.lines.length || !raw.lines.every((line) => typeof line === "string" && line.trim())) errors.push(`第 ${index + 1} 条规则至少需要一条日常对白`);
    if (!Number.isInteger(raw.closingAfter) || Number(raw.closingAfter) < 1) errors.push(`第 ${index + 1} 条规则的结束语阈值必须大于 0`);
    if (typeof raw.closingLine !== "string" || !raw.closingLine.trim()) errors.push(`第 ${index + 1} 条规则缺少结束语`);
    const key = String(raw.period); const prior = ranges.get(key) ?? [];
    if (Number.isInteger(min) && Number.isInteger(max) && prior.some(([a, b]) => min <= b && max >= a)) errors.push(`${key}存在重叠的好感度区间`);
    prior.push([min, max]); ranges.set(key, prior);
  });
  return { valid: !errors.length, errors, profile: errors.length ? undefined : input as DialogueProfileDefinition };
}
