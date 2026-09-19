import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const system = read("app/game/turn-combat/content/system.json");
const skills = read("app/game/turn-combat/content/skills.json").skills;
const statuses = read("app/game/turn-combat/content/statuses.json").statuses;
const enemies = read("app/game/turn-combat/content/enemies.json").enemies;
const encounters = read("app/game/turn-combat/content/encounters.json").encounters;
const actions = read("app/game/turn-combat/content/actions.json");
const visuals = read("app/game/turn-combat/content/visuals.json").skillVisuals;
const manuals = read("app/game/skills/content/manuals.json").manuals;
const manualItems = read("app/game/skills/content/manual-items.json").items;

const errors = [];
const visualFamilies = new Set();
const unique = (entries, label) => {
  const seen = new Set();
  for (const entry of entries) {
    if (!entry.id) errors.push(`${label} 存在无 id 条目`);
    if (seen.has(entry.id)) errors.push(`${label} id 重复：${entry.id}`);
    seen.add(entry.id);
  }
  return seen;
};

const skillIds = unique(skills, "技能");
const statusIds = unique(statuses, "状态");
const enemyIds = unique(enemies, "敌人");
unique(encounters, "遭遇");

for (const skill of skills) {
  if (!Array.isArray(skill.effects) || !skill.effects.length) errors.push(`技能没有效果：${skill.id}`);
  const visual = visuals[skill.id];
  if (!visual) errors.push(`技能缺少视觉标识：${skill.id}`);
  else {
    if (!visual.key || !visual.family || !visual.sigil || !visual.primary || !visual.accent || !visual.intensity) errors.push(`技能视觉元数据不完整：${skill.id}`);
    visualFamilies.add(visual.family);
  }
  for (const effect of skill.effects ?? []) {
    if (effect.kind === "status" && !statusIds.has(effect.statusId)) errors.push(`技能 ${skill.id} 引用了未知状态 ${effect.statusId}`);
  }
}

if (actions.consumables?.length !== 8) errors.push(`战斗丹药应为 8 种，当前为 ${actions.consumables?.length ?? 0}`);
if (actions.flee?.minimumChance >= 0.5 || actions.flee?.maximumChance <= 0.5) errors.push("逃跑概率配置未覆盖等速 50% 基准");
if (!manualItems.some((item) => item.itemId === "manual-eight-wastes" && item.skillId === 10008)) errors.push("断岳魁特殊功法掉落未接入可研读玉简");

for (const enemy of enemies) {
  for (const skillId of enemy.skills ?? []) if (!skillIds.has(skillId)) errors.push(`敌人 ${enemy.id} 引用了未知技能 ${skillId}`);
  if (!fs.existsSync(path.join(root, "public", enemy.art.replace(/^\//, "")))) errors.push(`敌人 ${enemy.id} 缺少美术 ${enemy.art}`);
}

for (const encounter of encounters) {
  for (const enemyId of encounter.enemyIds ?? []) if (!enemyIds.has(enemyId)) errors.push(`遭遇 ${encounter.id} 引用了未知敌人 ${enemyId}`);
  if (!fs.existsSync(path.join(root, "public", encounter.background.replace(/^\//, "")))) errors.push(`遭遇 ${encounter.id} 缺少背景 ${encounter.background}`);
}

for (const manual of manuals) {
  if (!skillIds.has(`manual-${manual.baseId}`)) errors.push(`万法谱 ${manual.baseId} ${manual.name} 尚未映射到回合制技能`);
}

if (!encounters.some((entry) => entry.id === "invasion-day-five" && entry.kind === "story")) errors.push("缺少第五日山门入侵遭遇");
if (encounters.filter((entry) => entry.kind === "practice").length < 3) errors.push("听云居练习遭遇少于三种");
if (!system.invasion?.resolvedFlag || !system.defaultLoadout?.length) errors.push("系统配置缺少入侵标记或默认功法");
if (visualFamilies.size < skills.length) errors.push(`技能视觉家族辨识度不足：${skills.length} 个技能仅 ${visualFamilies.size} 类`);

if (errors.length) {
  console.error(`回合制资源校验失败（${errors.length} 项）`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`回合制资源校验通过：${skills.length} 技能、${visualFamilies.size} 类独立视觉、${statuses.length} 状态、${enemies.length} 敌人、${encounters.length} 遭遇、${manuals.length} 项万法谱映射。`);
