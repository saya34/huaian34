import fs from "node:fs";
import path from "node:path";

const root = path.resolve("public/blcx-assets");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
const decodeRef = (raw) => raw?.c !== 1 ? raw : raw.v.map((row) => Object.fromEntries(row.map((source, index) => {
  let value = source;
  if (typeof value === "string" && value.startsWith(">}")) value = raw.sv[Number(value.slice(2))];
  const nested = raw.vk?.[raw.k[index]];
  if (nested?.length && Array.isArray(value)) value = Object.fromEntries(nested.map((key, i) => [key, value[i]]));
  return [raw.k[index], value];
})));
const normalize = (value) => String(value ?? "").replace(/^百恋_(怪物|英雄|技能|章节地图|活动地图)_/, "").replace(/^百恋_/, "").replace(/[·_\-\s（）()]/g, "").toLowerCase();
const score = (candidate, query) => {
  const a = normalize(candidate); const b = normalize(query);
  if (!a || !b) return -1;
  if (a === b) return 1000;
  if (a.startsWith(b) || b.startsWith(a)) return 700 - Math.abs(a.length - b.length);
  if (a.includes(b) || b.includes(a)) return 500 - Math.abs(a.length - b.length);
  return (b.match(/[\u4e00-\u9fa5]{2,}|[a-z0-9]+/g) ?? []).reduce((total, token) => total + (a.includes(token) ? 20 : 0), 0);
};

const manifest = readJson("asset-manifest.json");
const waves = decodeRef(readJson("ref/battleWaveRef.json")).filter((row) => Number(row.id) >= 1 && Number(row.id) <= 21);
const monsters = decodeRef(readJson("ref/battleMonsterRef.json"));
const heroes = decodeRef(readJson("ref/hero.json"));
const maps = decodeRef(readJson("ref/mapRef.json")).filter((row) => Number(row.id) >= 1000 && Number(row.id) <= 1020);
const monsterIds = new Set(waves.flatMap((wave) => wave.monster ?? []).map(Number));
const queries = new Set(monsters.filter((monster) => monsterIds.has(Number(monster.resId))).map((monster) => monster.model).filter(Boolean));
const heroAliases = { "陆天涯": "酒剑侠-陆天涯-行走", "弥勒": "云游僧-天乐和尚-行走", "玉兔": "玉兔精-卜卜兔-行走", "迦楼罗": "暗夜射手-迦楼罗-行走-武器", "恶修罗": "修罗刀客-恶修罗-行走" };
heroes.forEach((hero) => queries.add(heroAliases[hero.name] ?? hero.name ?? hero.modelBattle));
[
  "武士青蛙", "紫色僵尸", "旱魃尸王_行走", "千机环_高级", "千机环_低级", "技能-恶修罗", "S刀万魂波动", "S刀修炼领域", "太刀刀光", "黑曲弓觉醒新", "黑曲弓新", "回旋镖-燕返术_高级", "回旋镖-燕返术_低级", "冥蛇咒-低高级毒蛇", "技能_红莲业火", "立场发生器-护体金光_低级", "砖头-降魔杵_低级", "技能_炎雀焚天", "技能_火灵咒_飞行", "最新邪剑", "最新天剑", "白龙珠", "足球-法盘_高级", "足球-法盘_低级", "远程剑气（紫色刀）", "雷电-天雷咒_高级2", "雷电-天雷咒_低级", "技能-冰凌雪女1", "雪童子",
].forEach((query) => queries.add(query));

const selectedAtlases = new Map();
for (const query of queries) {
  const candidate = manifest.atlases.map((entry) => ({ entry, score: score(entry.name, query) + (/行走|move|walk/i.test(entry.name) ? 30 : 0) })).sort((a, b) => b.score - a.score)[0];
  if (candidate?.score > 0) selectedAtlases.set(candidate.entry.image, candidate.entry);
}
const selectedScenes = new Map();
for (const map of maps) {
  const query = map.model ?? map.name;
  const candidate = manifest.scenes.map((entry) => ({ entry, score: Math.max(score(entry.scene, query), score(entry.name, query)) })).sort((a, b) => b.score - a.score)[0];
  if (candidate) selectedScenes.set(candidate.entry.path, candidate.entry);
}

const runtimeManifest = { ...manifest, atlases: [...selectedAtlases.values()], scenes: [...selectedScenes.values()], ui: manifest.ui.filter((entry) => entry.name === "图标_技能_atlas0") };
fs.writeFileSync(path.join(root, "asset-manifest.json"), JSON.stringify(runtimeManifest));
const requiredRefs = ["battleMonsterRef", "battleSkillMonster", "battleSkillTypeMonster", "battleBullet", "battleSkillRef", "battleSkillLevel", "battleSkillEvolutionRef", "battleSupplyRef", "battleSupplyLevelRef", "battleLevelRef", "battleWaveRef", "battleWavePlanRef", "battleWaveNumRef", "battleWaveType", "hero", "mapRef", "modelRef", "fuBenRef", "fuBenCanUseSkillGroupRef", "gameConfig"].map((name) => `ref/${name}.json`);
const keep = new Set(["asset-manifest.json", ...requiredRefs]);
[...runtimeManifest.atlases, ...runtimeManifest.effects, ...runtimeManifest.scenes, ...runtimeManifest.ui].forEach((entry) => {
  if (entry.image) keep.add(entry.image);
  if (entry.plist) keep.add(entry.plist);
  if (entry.path) keep.add(entry.path);
});
for (const file of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
  if (!file.isFile()) continue;
  const full = path.join(file.parentPath, file.name);
  const relative = path.relative(root, full).replaceAll("\\", "/");
  if (!keep.has(relative)) fs.unlinkSync(full);
}
console.log(JSON.stringify({ atlases: runtimeManifest.atlases.length, effects: runtimeManifest.effects.length, scenes: runtimeManifest.scenes.length, ui: runtimeManifest.ui.length, files: keep.size }, null, 2));
