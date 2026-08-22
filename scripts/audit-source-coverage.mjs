import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const assetRoot = path.join(projectRoot, "public", "blcx-assets");

function decode(raw) {
  if (!raw || raw.c !== 1 || !Array.isArray(raw.k) || !Array.isArray(raw.v)) return Array.isArray(raw) ? raw : [];
  return raw.v.map((row) => {
    const value = {};
    row.forEach((source, index) => {
      let entry = source;
      if (typeof entry === "string" && entry.startsWith(">}")) entry = raw.sv?.[Number(entry.slice(2))];
      const nestedKeys = raw.vk?.[raw.k[index]];
      if (nestedKeys?.length && Array.isArray(entry)) entry = Object.fromEntries(nestedKeys.map((key, i) => [key, entry[i]]));
      value[raw.k[index]] = entry;
    });
    return value;
  });
}

function readRef(name) {
  return decode(parseJson(path.join(assetRoot, "ref", `${name}.json`)));
}

function parseJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function normalize(value) {
  return String(value ?? "")
    .replace(/^百恋_(怪物|英雄|技能|章节地图|活动地图)_/, "")
    .replace(/^百恋_/, "")
    .replace(/[·_\-\s（）()]/g, "")
    .toLowerCase();
}

function scoreName(candidate, query) {
  const a = normalize(candidate);
  const b = normalize(query);
  if (!a || !b) return -1;
  if (a === b) return 1000;
  if (a.startsWith(b) || b.startsWith(a)) return 700 - Math.abs(a.length - b.length);
  if (a.includes(b) || b.includes(a)) return 500 - Math.abs(a.length - b.length);
  const tokens = b.match(/[\u4e00-\u9fa5]{2,}|[a-z0-9]+/g) ?? [];
  return tokens.reduce((score, token) => score + (a.includes(token) ? 20 : 0), 0);
}

const manifest = parseJson(path.join(assetRoot, "asset-manifest.json"));
const modelAliases = {
  "百恋_怪物_青蛙武士": "武士青蛙",
  "百恋_怪物_妖道僵尸": "紫色僵尸",
  "百恋_怪物_嗜血尸王": "旱魃尸王_行走",
};
const monsters = readRef("battleMonsterRef");
const monsterSkills = readRef("battleSkillMonster");
const monsterSkillTypes = readRef("battleSkillTypeMonster");
const bullets = readRef("battleBullet");
const skills = readRef("battleSkillRef");
const skillLevels = readRef("battleSkillLevel");
const evolutions = readRef("battleSkillEvolutionRef");
const supplies = readRef("battleSupplyRef");
const waves = readRef("battleWaveRef");
const wavePlans = readRef("battleWavePlanRef");
const waveNums = readRef("battleWaveNumRef");
const heroes = readRef("hero");

const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const monsterIds = new Set(monsters.map((row) => Number(row.resId)));
const bulletIds = new Set(bullets.map((row) => Number(row.id)));
const skillIds = new Set(skills.map((row) => Number(row.resId)));
const supplyIds = new Set(supplies.map((row) => Number(row.resId)));
const waveNumIds = new Set(waveNums.map((row) => Number(row.id)));

const mainWaves = waves.filter((row) => Number(row.id) >= 1 && Number(row.id) <= 21);
for (const wave of mainWaves) {
  for (const monsterId of wave.monster ?? []) assert(monsterIds.has(Number(monsterId)), `关卡 ${wave.id} 引用了缺失怪物 ${monsterId}`);
  const plan = wavePlans.find((row) => Number(row.id) === Number(wave.wavePlanId));
  assert(Boolean(plan), `关卡 ${wave.id} 缺少波次计划 ${wave.wavePlanId}`);
  for (const waveNumId of plan?.waveId ?? []) assert(waveNumIds.has(Number(waveNumId)), `波次计划 ${plan.id} 引用了缺失波次 ${waveNumId}`);
}

for (const level of skillLevels) {
  assert(skillIds.has(Number(level.skillId)), `技能等级 ${level.id} 引用了缺失技能 ${level.skillId}`);
  for (const bulletId of level.bullet ?? []) assert(bulletIds.has(Number(bulletId)), `技能 ${level.skillId} 引用了缺失子弹 ${bulletId}`);
}
for (const monsterSkill of monsterSkills) {
  assert(monsterSkillTypes.some((row) => Number(row.resId) === Number(monsterSkill.skillId)), `怪物技能 ${monsterSkill.id} 引用了未知类型 ${monsterSkill.skillId}`);
  for (const bulletId of monsterSkill.bullet ?? []) assert(bulletIds.has(Number(bulletId)), `怪物技能 ${monsterSkill.id} 引用了缺失子弹 ${bulletId}`);
}
for (const evolution of evolutions) {
  assert(skillIds.has(Number(evolution.skillId)), `进化 ${evolution.id} 的结果技能 ${evolution.skillId} 缺失`);
  for (const need of evolution.need ?? []) assert(skillIds.has(Number(need.resId)) || supplyIds.has(Number(need.resId)), `进化 ${evolution.id} 的前置 ${need.resId} 缺失`);
}
for (const hero of heroes) assert(skillIds.has(Number(hero.weapon)), `英雄 ${hero.name} 的武器 ${hero.weapon} 缺失`);

const usedMonsterIds = new Set(mainWaves.flatMap((wave) => wave.monster ?? []).map(Number));
const usedModels = [...new Set(monsters.filter((monster) => usedMonsterIds.has(Number(monster.resId))).map((monster) => monster.model).filter(Boolean))];
const unmatchedModels = usedModels.filter((model) => {
  const query = modelAliases[model] ?? model;
  const best = manifest.atlases.reduce((score, entry) => Math.max(score, scoreName(entry.name, query)), -1);
  return best <= 0;
});

const playerBulletIds = new Set(skillLevels.flatMap((level) => level.bullet ?? []).map(Number));
const playerBullets = bullets.filter((bullet) => playerBulletIds.has(Number(bullet.id)));
const skillAtlasAliases = [
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
const atlasQuery = (model) => skillAtlasAliases.find(([pattern]) => pattern.test(model))?.[1] ?? model;
const playerEffectAudit = playerBullets.map((bullet) => {
  const models = (Array.isArray(bullet.model) ? bullet.model : [bullet.model]).filter(Boolean);
  const matches = models.map((model) => manifest.effects
    .map((effect) => ({
      model,
      path: effect.path,
      score: Math.max(scoreName(effect.folder, model), scoreName(effect.name, model), scoreName(effect.path, model)),
    }))
    .sort((a, b) => b.score - a.score)[0])
    .filter(Boolean);
  const best = matches.sort((a, b) => b.score - a.score)[0];
  const atlas = models.map((model) => {
    const query = atlasQuery(model);
    return manifest.atlases
      .filter((entry) => entry.plist)
      .map((entry) => ({ name: entry.name, score: scoreName(entry.name, query) }))
      .sort((a, b) => b.score - a.score)[0];
  }).sort((a, b) => b.score - a.score)[0];
  return {
    bulletId: Number(bullet.id),
    model: models.join(" | ") || null,
    matched: best?.path ?? null,
    score: best?.score ?? -1,
    atlas: atlas?.score > 0 ? atlas.name : null,
    atlasScore: atlas?.score ?? -1,
  };
});
const unmatchedPlayerEffects = playerEffectAudit.filter((entry) => !entry.model || entry.score <= 0);
const weakPlayerEffects = playerEffectAudit.filter((entry) => entry.score > 0 && entry.score < 500);
const unmatchedPlayerVisuals = playerEffectAudit.filter((entry) => entry.score <= 0 && entry.atlasScore <= 0);

for (const group of [manifest.atlases, manifest.effects, manifest.scenes, manifest.ui]) {
  for (const entry of group) {
    const relative = entry.image ?? entry.path;
    assert(relative && fs.existsSync(path.join(assetRoot, relative)), `素材文件缺失: ${relative ?? "unknown"}`);
    if (entry.plist) assert(fs.existsSync(path.join(assetRoot, entry.plist)), `图集描述缺失: ${entry.plist}`);
  }
}

const report = {
  mainStages: mainWaves.length,
  configuredMonsters: monsters.length,
  stageMonsterVariants: usedMonsterIds.size,
  stageMonsterModels: usedModels.length,
  matchedStageMonsterModels: usedModels.length - unmatchedModels.length,
  playerSkills: skills.length,
  playerSkillLevels: skillLevels.length,
  skillEvolutions: evolutions.length,
  supplies: supplies.length,
  monsterSkills: monsterSkills.length,
  monsterSkillTypes: monsterSkillTypes.length,
  atlasImages: manifest.atlases.length,
  battleImages: manifest.effects.length,
  sceneImages: manifest.scenes.length,
  uiAtlases: manifest.ui.length,
  playerBullets: playerBullets.length,
  matchedPlayerEffects: playerEffectAudit.length - unmatchedPlayerEffects.length,
  matchedPlayerVisuals: playerEffectAudit.length - unmatchedPlayerVisuals.length,
  unmatchedPlayerVisuals,
  unmatchedPlayerEffects,
  weakPlayerEffects,
  unmatchedModels,
  failures,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length || unmatchedModels.length) process.exitCode = 1;
