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
  for (const reward of quest.rewards) {
    if (!reward.label || !(reward.amount > 0) || !["currency", "experience", "item", "relationship"].includes(reward.type)) throw new Error(`invalid reward: ${quest.id}`);
    if (reward.type === "relationship" && !reward.characterId) throw new Error(`relationship reward needs characterId: ${quest.id}`);
  }
  if (quest.giver) {
    for (const key of ["characterId", "sceneId", "name", "role", "portrait", "offerText", "acceptedText", "declinedText", "acceptLabel", "declineLabel"]) if (!quest.giver[key]) throw new Error(`invalid quest giver ${key}: ${quest.id}`);
  }
}

for (const quest of quests) if (quest.prerequisiteQuestId && !ids.has(quest.prerequisiteQuestId)) throw new Error(`unknown prerequisite: ${quest.id}`);
if (quests.filter((quest) => quest.giver).length < Math.ceil(quests.length / 2)) throw new Error("most quests must be issued through character dialogue");
if (main.some((quest) => quest.initialStatus !== "unaccepted")) throw new Error("main quests must wait for character dialogue acceptance");
for (const key of ["panelTitle", "mainTab", "sideTab", "currentObjective", "viewAll", "accept", "meetGiver", "offerEyebrow", "offerPrompt", "go", "claim", "claimed", "rewardTitle", "continue"]) if (!ui[key]) throw new Error(`missing ui text: ${key}`);

console.log(`quest content check passed: ${quests.length} quests, ${quests.filter((quest) => quest.giver).length} dialogue offers, ${quests.reduce((sum, quest) => sum + quest.objectives.length, 0)} objectives, ${quests.reduce((sum, quest) => sum + quest.rewards.length, 0)} rewards`);
