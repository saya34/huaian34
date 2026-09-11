import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const main = JSON.parse(readFileSync(resolve(root, "app/game/quests/content/main.json"), "utf8"));
const side = JSON.parse(readFileSync(resolve(root, "app/game/quests/content/side.json"), "utf8"));
const ui = JSON.parse(readFileSync(resolve(root, "app/game/quests/content/ui.json"), "utf8"));
const quests = [...main, ...side];
const ids = new Set();
const statuses = new Set(["unaccepted", "in_progress", "completed", "claimable", "claimed"]);
const objectiveTypes = new Set(["play", "acquire", "reach"]);
const destinations = new Set(["story", "alchemy", "farm", "battle", "equipment", "characters", "path-project"]);

for (const quest of quests) {
  if (!quest.id || ids.has(quest.id)) throw new Error(`invalid or duplicate quest id: ${quest.id}`);
  ids.add(quest.id);
  if (!quest.name || !quest.summary || !["main", "side"].includes(quest.type)) throw new Error(`invalid quest copy: ${quest.id}`);
  if (!statuses.has(quest.initialStatus)) throw new Error(`invalid initial status: ${quest.id}`);
  if (!destinations.has(quest.destination?.kind)) throw new Error(`invalid destination: ${quest.id}`);
  if (!Array.isArray(quest.objectives) || quest.objectives.length === 0) throw new Error(`missing objectives: ${quest.id}`);
  if (!Array.isArray(quest.rewards) || quest.rewards.length === 0) throw new Error(`missing rewards: ${quest.id}`);
  for (const objective of quest.objectives) if (!objective.id || !objective.description || !objectiveTypes.has(objective.type) || !(objective.required > 0)) throw new Error(`invalid objective: ${quest.id}`);
  for (const reward of quest.rewards) if (!reward.label || !(reward.amount > 0) || !["currency", "experience", "item"].includes(reward.type)) throw new Error(`invalid reward: ${quest.id}`);
}

if (main.filter((quest) => quest.initialStatus === "in_progress").length !== 1) throw new Error("exactly one main quest must start in progress");
for (const key of ["panelTitle", "mainTab", "sideTab", "currentObjective", "viewAll", "accept", "go", "claim", "claimed", "rewardTitle", "continue"]) if (!ui[key]) throw new Error(`missing ui text: ${key}`);

console.log(`quest content check passed: ${quests.length} quests, ${quests.reduce((sum, quest) => sum + quest.objectives.length, 0)} objectives, ${quests.reduce((sum, quest) => sum + quest.rewards.length, 0)} rewards`);
