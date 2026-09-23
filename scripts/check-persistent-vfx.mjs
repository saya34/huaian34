import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const groupFiles = ["01-06", "07-12", "13-18", "19-24", "25-30"]
  .map((range) => `app/game/battle/content/persistent-vfx-group-${range}.json`);
const profiles = groupFiles.flatMap((file) => {
  const content = readJson(file);
  return Array.isArray(content) ? content : content.profiles;
});
const cards = readJson("app/game/battle/content/summon-showcase-cards.json").cards;
const gameplay = readJson("app/game/battle/content/summon-gameplay-effects.json").effects;
const expected = new Set(cards.map((card) => card.effectId));
const profileIds = new Set(profiles.map((profile) => profile.effectId));
const gameplayIds = new Set(gameplay.map((effect) => effect.effectId));

const failures = [];
if (profiles.length !== 30) failures.push(`expected 30 profiles, found ${profiles.length}`);
if (profileIds.size !== profiles.length) failures.push("persistent profile ids must be unique");
for (const effectId of expected) if (!profileIds.has(effectId)) failures.push(`missing profile: ${effectId}`);
for (const profile of profiles) {
  if (!expected.has(profile.effectId)) failures.push(`unknown profile: ${profile.effectId}`);
  if (!gameplayIds.has(profile.effectId)) failures.push(`missing gameplay effect: ${profile.effectId}`);
  if (!profile.effectText || !profile.mechanicText || !profile.glyph) failures.push(`incomplete copy: ${profile.effectId}`);
  if (profile.particleCount < 38 || profile.particleCount > 76) failures.push(`particle budget out of range: ${profile.effectId}`);
  if (profile.centerDurationMs < 1800) failures.push(`center reveal too short: ${profile.effectId}`);
  if (profile.cardDurationMs < 5600) failures.push(`card reveal too short: ${profile.effectId}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`persistent summon VFX OK: ${profiles.length} profiles, ${profileIds.size} unique bindings`);
