import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contentPath = path.join(root, "app/game/scene-objects/scene-objects.json");
const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
const requiredScenes = [
  "lingxiao", "tavern", "market", "bedroom", "spirit-farm", "kitchen",
  "intelligence-bureau", "treasure-shop", "senior-sister-home",
  "junior-sister-home", "forest-cabin", "field-cottage", "shen-estate",
];
const ids = new Set();
const customRewards = new Set(content.rewardCatalog.map((reward) => reward.id));
const errors = [];

for (const definition of content.objects) {
  if (ids.has(definition.id)) errors.push(`duplicate object id: ${definition.id}`);
  ids.add(definition.id);
  if (!Array.isArray(definition.cell) || definition.cell[0] < 0 || definition.cell[0] > 3 || definition.cell[1] < 0 || definition.cell[1] > 1) errors.push(`${definition.id}: invalid atlas cell`);
  if (definition.layout.x > 25 && definition.layout.x < 70) errors.push(`${definition.id}: placed in protected center x-zone`);
  if (definition.layout.y < 18 || definition.layout.y > 80) errors.push(`${definition.id}: unsafe vertical placement`);
  if (!definition.production.commonPool.length) errors.push(`${definition.id}: missing common reward pool`);
  if (!definition.production.rarePool.length) errors.push(`${definition.id}: missing bound rare reward pool`);
  for (const entry of [...definition.production.commonPool, ...definition.production.rarePool]) {
    if (!customRewards.has(entry.id) && !/^(mat|prd)-\d+/.test(entry.id)) errors.push(`${definition.id}: unknown reward ${entry.id}`);
  }
  const asset = path.join(root, "public", definition.atlas.replace(/^\//, ""));
  if (!fs.existsSync(asset)) errors.push(`${definition.id}: missing atlas ${definition.atlas}`);
}

for (const sceneId of requiredScenes) {
  const count = content.objects.filter((definition) => definition.sceneId === sceneId).length;
  if (count < 2 || count > 3) errors.push(`${sceneId}: expected 2-3 props, got ${count}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Scene objects OK: ${content.objects.length} props across ${requiredScenes.length} scenes, ${content.rewardCatalog.length} exclusive rewards.`);
