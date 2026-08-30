import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const targetRoot = path.join(projectRoot, "public", "blcx-assets");
const sourceRoot = path.resolve(process.argv[2] ?? "");
if (!sourceRoot || !fs.existsSync(path.join(sourceRoot, "asset-manifest.json"))) {
  throw new Error("请传入原割草项目 public/blcx-assets 目录");
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const decode = (raw) => raw?.c !== 1 ? raw : raw.v.map((row) => Object.fromEntries(row.map((source, index) => {
  let value = source;
  if (typeof value === "string" && value.startsWith(">}")) value = raw.sv[Number(value.slice(2))];
  const nested = raw.vk?.[raw.k[index]];
  if (nested?.length && Array.isArray(value)) value = Object.fromEntries(nested.map((key, i) => [key, value[i]]));
  return [raw.k[index], value];
})));
const readRef = (name) => decode(readJson(path.join(targetRoot, "ref", `${name}.json`)));
const normalize = (value) => String(value ?? "")
  .replace(/^百恋_(怪物|英雄|技能|章节地图|活动地图)_/, "")
  .replace(/^百恋_/, "")
  .replace(/[·_\-\s（）()]/g, "")
  .toLowerCase();
const scoreName = (candidate, query) => {
  const a = normalize(candidate); const b = normalize(query);
  if (!a || !b) return -1;
  if (a === b) return 1000;
  if (a.startsWith(b) || b.startsWith(a)) return 700 - Math.abs(a.length - b.length);
  if (a.includes(b) || b.includes(a)) return 500 - Math.abs(a.length - b.length);
  return (b.match(/[\u4e00-\u9fa5]{2,}|[a-z0-9]+/g) ?? []).reduce((sum, token) => sum + (a.includes(token) ? 20 : 0), 0);
};
const list = (value) => Array.isArray(value) ? value : value == null ? [] : [value];

const sourceManifest = readJson(path.join(sourceRoot, "asset-manifest.json"));
const targetManifest = readJson(path.join(targetRoot, "asset-manifest.json"));
const waves = readRef("battleWaveRef").filter((row) => Number(row.id) >= 1 && Number(row.id) <= 21);
const monsters = readRef("battleMonsterRef");
const monsterSkills = readRef("battleSkillMonster");
const bullets = readRef("battleBullet");
const skillLevels = readRef("battleSkillLevel");
const usedMonsterIds = new Set(waves.flatMap((wave) => list(wave.monster)).map(Number));
const usedMonsters = monsters.filter((monster) => usedMonsterIds.has(Number(monster.resId)));

const monsterAliases = {
  "百恋_怪物_青蛙武士": "武士青蛙",
  "百恋_怪物_黑无常": "尸管黑无常",
  "百恋_怪物_妖道僵尸": "紫色僵尸",
  "百恋_怪物_嗜血尸王": "旱魃尸王_行走",
};
const skillAliases = [
  [/孔雀翎/, "千机环_高级"], [/千机弩/, "千机环_低级"], [/噬魂修罗/, "技能-恶修罗"],
  [/弑神八荒/, "S刀万魂波动"], [/修罗刀|太刀刀光/, "太刀刀光"],
  [/黑曲弓觉醒/, "黑曲弓觉醒新"], [/黑曲弓/, "黑曲弓新"],
  [/百鸟归巢/, "回旋镖-燕返术_高级"], [/燕返术/, "回旋镖-燕返术_低级"],
  [/冥蛇咒/, "火药瓶-灵蛇咒_高级"], [/灵蛇咒/, "火药瓶-灵蛇咒_低级"],
  [/佛怒莲华/, "技能_红莲业火"], [/护体金光/, "立场发生器-护体金光_低级"],
  [/降魔杵/, "砖头-降魔杵_低级"], [/炎雀焚天/, "技能_炎雀焚天"],
  [/火灵咒/, "技能_火灵咒_飞行"], [/断魂剑/, "最新邪剑"], [/无邪剑/, "最新天剑"],
  [/龙神伏魔咒/, "白龙珠"], [/驱魔法盘/, "足球-法盘_高级"], [/阴阳盘/, "足球-法盘_低级"],
  [/诛天斩魂/, "S刀万魂波动"], [/破煞刀/, "远程剑气（紫色刀）"],
  [/天罚惊雷/, "雷电-天雷咒_高级2"], [/天雷咒/, "雷电-天雷咒_低级"],
  [/冰凌雪女/, "技能-冰凌雪女1"], [/雪童子/, "雪童子"],
  [/皎月罗刹/, "S刀万魂波动"], [/玄刀阵/, "S刀修炼领域"],
];
const atlasQuery = (model) => skillAliases.find(([pattern]) => pattern.test(model))?.[1] ?? model;

const usedMonsterSkillIds = new Set(usedMonsters.flatMap((monster) => list(monster.skill)).map(Number));
const usedBulletIds = new Set([
  ...skillLevels.flatMap((level) => list(level.bullet)).map(Number),
  ...monsterSkills.filter((skill) => usedMonsterSkillIds.has(Number(skill.id))).flatMap((skill) => list(skill.bullet)).map(Number),
]);
const usedBullets = bullets.filter((bullet) => usedBulletIds.has(Number(bullet.id)));
const bulletModels = [...new Set(usedBullets.flatMap((bullet) => list(bullet.model)).filter(Boolean).map(String))];

const selectedAtlases = new Map(targetManifest.atlases.map((entry) => [entry.image, entry]));
const selectAtlas = (query, movement = false) => sourceManifest.atlases
  .filter((entry) => entry.plist)
  .map((entry) => {
    const baseScore = scoreName(entry.name, query);
    return { entry, baseScore, score: baseScore + (movement && baseScore > 0 && /行走|待机|move|walk|idle/i.test(entry.name) ? 30 : 0) };
  })
  .sort((a, b) => b.score - a.score)[0];

for (const model of new Set(usedMonsters.map((monster) => monster.model).filter(Boolean))) {
  const match = selectAtlas(monsterAliases[model] ?? model, true);
  if (match?.baseScore >= 498) selectedAtlases.set(match.entry.image, match.entry);
}
for (const model of bulletModels) {
  const match = selectAtlas(atlasQuery(model));
  if (match?.baseScore > 0) selectedAtlases.set(match.entry.image, match.entry);
}

const selectedEffects = new Map(targetManifest.effects.map((entry) => [entry.path, entry]));
for (const model of bulletModels) {
  const match = sourceManifest.effects
    .map((entry) => ({ entry, score: Math.max(scoreName(entry.folder, model), scoreName(entry.name, model), scoreName(entry.path, model)) }))
    .sort((a, b) => b.score - a.score)[0];
  if (match?.score > 0) selectedEffects.set(match.entry.path, match.entry);
}

const copyAsset = (relative) => {
  if (!relative) return;
  const source = path.join(sourceRoot, relative);
  const target = path.join(targetRoot, relative);
  if (!fs.existsSync(source) || fs.existsSync(target)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
};
for (const entry of selectedAtlases.values()) { copyAsset(entry.image); copyAsset(entry.plist); }
for (const entry of selectedEffects.values()) copyAsset(entry.path);

const runtimeManifest = {
  ...targetManifest,
  generated: new Date().toISOString(),
  atlases: [...selectedAtlases.values()],
  effects: [...selectedEffects.values()],
};
fs.writeFileSync(path.join(targetRoot, "asset-manifest.json"), JSON.stringify(runtimeManifest));
const bytes = [...selectedAtlases.values(), ...selectedEffects.values()].reduce((sum, entry) => {
  return sum + [entry.image, entry.plist, entry.path].filter(Boolean).reduce((part, relative) => part + (fs.existsSync(path.join(targetRoot, relative)) ? fs.statSync(path.join(targetRoot, relative)).size : 0), 0);
}, 0);
console.log(JSON.stringify({ atlases: runtimeManifest.atlases.length, effects: runtimeManifest.effects.length, bulletModels: bulletModels.length, runtimeAssetMB: Math.round(bytes / 1024 / 1024 * 10) / 10 }, null, 2));
