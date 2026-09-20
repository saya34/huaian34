import { readFileSync } from "node:fs";

const file = new URL("../app/game/vfx/effects-content.json", import.meta.url);
const content = JSON.parse(readFileSync(file, "utf8"));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(content.sceneEffects.length === 10, `场景动效应为 10 个，当前 ${content.sceneEffects.length} 个`);
assert(content.storyEffects.length === 5, `剧情动效应为 5 个，当前 ${content.storyEffects.length} 个`);

const sceneIds = new Set(content.sceneEffects.map((effect) => effect.id));
const storyIds = new Set(content.storyEffects.map((effect) => effect.id));
assert(sceneIds.size === content.sceneEffects.length, "场景动效 ID 存在重复");
assert(storyIds.size === content.storyEffects.length, "剧情动效 ID 存在重复");
content.sceneRules.forEach((rule) => assert(sceneIds.has(rule.effectId), `未知场景动效规则：${rule.effectId}`));
content.storyRules.forEach((rule) => assert(storyIds.has(rule.effectId), `未知剧情动效规则：${rule.effectId}`));

const periods = ["清晨", "上午", "午后", "黄昏", "夜晚", "深夜"];
const weatherCycle = ["wood-breeze", "spirit-rain", "sun-warm", "star-dew"];
const scenes = [...new Set(content.sceneRules.flatMap((rule) => rule.sceneIds ?? []))];
const definitions = new Map(content.sceneEffects.map((effect) => [effect.id, effect]));
const reached = new Set();

for (let day = 1; day <= 72; day += 1) {
  const weatherId = weatherCycle[(day - 1) % weatherCycle.length];
  for (const period of periods) {
    for (const sceneId of scenes) {
      const matches = content.sceneRules
        .filter((rule) => !rule.sceneIds || rule.sceneIds.includes(sceneId))
        .filter((rule) => !rule.periods || rule.periods.includes(period))
        .filter((rule) => !rule.weatherIds || rule.weatherIds.includes(weatherId))
        .filter((rule) => !rule.excludedWeatherIds?.includes(weatherId))
        .filter((rule) => !rule.dayModulo || day % rule.dayModulo.divisor === rule.dayModulo.remainder)
        .sort((a, b) => b.priority - a.priority);
      const groups = new Set();
      for (const rule of matches) {
        const effect = definitions.get(rule.effectId);
        if (groups.has(effect.group)) continue;
        groups.add(effect.group);
        reached.add(effect.id);
        if (groups.size === 2) break;
      }
    }
  }
}

assert(reached.size === content.sceneEffects.length, `以下场景动效在 72 日内不可达：${[...sceneIds].filter((id) => !reached.has(id)).join("、")}`);
assert(new Set(content.storyRules.map((rule) => rule.effectId)).size === content.storyEffects.length, "存在未绑定触发规则的剧情动效");

console.log(`VFX content OK: ${content.sceneEffects.length} scene effects, ${content.storyEffects.length} story effects, all reachable.`);
