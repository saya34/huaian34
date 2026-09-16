import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const main = JSON.parse(readFileSync(resolve(root, "app/game/quests/content/main.json"), "utf8"));
const side = JSON.parse(readFileSync(resolve(root, "app/game/quests/content/side.json"), "utf8"));
const ui = JSON.parse(readFileSync(resolve(root, "app/game/quests/content/ui.json"), "utf8"));
const chapterOne = JSON.parse(readFileSync(resolve(root, "app/game/chapter-one/content.json"), "utf8"));
const medicineShortage = JSON.parse(readFileSync(resolve(root, "app/game/projects/content/medicine-shortage.json"), "utf8"));
const battlePreparation = JSON.parse(readFileSync(resolve(root, "app/game/battle/content/preparation.json"), "utf8"));
const expeditionSource = readFileSync(resolve(root, "app/game/battle/expedition.ts"), "utf8");
const decodeRef = (raw) => (raw.v ?? []).map((row) => Object.fromEntries(row.map((source, index) => {
  const key = raw.k[index];
  let entry = source;
  if (typeof entry === "string" && entry.startsWith(">}")) entry = (raw.sv ?? [])[Number(entry.slice(2))];
  if (raw.vk?.[key]?.length && Array.isArray(entry)) entry = Object.fromEntries(raw.vk[key].map((nestedKey, nestedIndex) => [nestedKey, entry[nestedIndex]]));
  return [key, entry];
})));
const waveDefinitions = decodeRef(JSON.parse(readFileSync(resolve(root, "public/blcx-assets/ref/battleWaveRef.json"), "utf8")));
const waveRows = decodeRef(JSON.parse(readFileSync(resolve(root, "public/blcx-assets/ref/battleWaveNumRef.json"), "utf8")));
const monsterDefinitions = decodeRef(JSON.parse(readFileSync(resolve(root, "public/blcx-assets/ref/battleMonsterRef.json"), "utf8")));
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
  if (quest.type === "main" && (!quest.chapter || !quest.phase || !quest.completion?.nextHook)) throw new Error(`main quest missing chapter presentation: ${quest.id}`);
  if (quest.startsProject && quest.startsProject !== "medicine-shortage") throw new Error(`unknown project hook: ${quest.id}`);
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

if (!ids.has(chapterOne.completionQuestId)) throw new Error("chapter one completion quest does not exist");
if (!Array.isArray(chapterOne.outcomes) || chapterOne.outcomes.length < 3) throw new Error("chapter one needs at least three outcome tiers");
const outcomeIds = new Set();
const allowedBonusTypes = new Set(["currency", "experience", "relationship", "item"]);
for (const outcome of chapterOne.outcomes) {
  if (!outcome.id || outcomeIds.has(outcome.id)) throw new Error(`invalid or duplicate outcome id: ${outcome.id}`);
  outcomeIds.add(outcome.id);
  if (!(outcome.minimumScore >= 0) || !outcome.eyebrow || !outcome.title || !outcome.body || !outcome.nextHook) throw new Error(`invalid chapter outcome: ${outcome.id}`);
  if (!Array.isArray(outcome.bonus) || outcome.bonus.length === 0) throw new Error(`chapter outcome needs a bonus: ${outcome.id}`);
  for (const reward of outcome.bonus) {
    if (!allowedBonusTypes.has(reward.type) || !(reward.amount > 0) || !reward.label) throw new Error(`invalid chapter outcome reward: ${outcome.id}`);
    if (reward.type === "relationship" && !reward.characterId) throw new Error(`chapter outcome relationship needs characterId: ${outcome.id}`);
    if (reward.type === "item" && (!reward.itemId || !reward.itemType || !reward.rarity)) throw new Error(`chapter outcome item metadata missing: ${outcome.id}`);
  }
}
if (!chapterOne.outcomes.some((outcome) => outcome.minimumScore === 0)) throw new Error("chapter outcomes need a zero-score fallback");
for (const routeId of ["production", "relationship", "battle", "none"]) {
  if (!chapterOne.routeNames?.[routeId] || !chapterOne.routeReflections?.[routeId]) throw new Error(`chapter route copy missing: ${routeId}`);
}

if (medicineShortage.taskId !== "main-medicine-shortage") throw new Error("medicine shortage route content is not linked to its task");
const routeIds = new Set(medicineShortage.routes?.map((route) => route.id));
for (const routeId of ["production", "relationship", "battle"]) if (!routeIds.has(routeId)) throw new Error(`medicine shortage route missing: ${routeId}`);
const destinationTypes = new Set(["farm", "alchemy", "character", "market", "battle"]);
for (const route of medicineShortage.routes ?? []) {
  if (!route.name || !route.description || !route.result || !Array.isArray(route.requirements) || route.requirements.length < 2) throw new Error(`invalid medicine shortage route: ${route.id}`);
  if (!Array.isArray(route.actions) || route.actions.length === 0) throw new Error(`medicine shortage route has no direct action: ${route.id}`);
  for (const requirement of route.requirements) {
    if (!requirement.kind || !requirement.label || !(requirement.required > 0)) throw new Error(`invalid route requirement: ${route.id}`);
    if (requirement.kind === "item" && (!requirement.templateId || !requirement.itemType)) throw new Error(`route item requirement lacks inventory query: ${route.id}`);
  }
  for (const action of route.actions) if (!destinationTypes.has(action.target) || !action.label) throw new Error(`invalid route action: ${route.id}`);
}
const actionTargets = Object.fromEntries(medicineShortage.routes.map((route) => [route.id, new Set(route.actions.map((action) => action.target))]));
if (!actionTargets.production.has("farm") || !actionTargets.production.has("alchemy")) throw new Error("production route must lead to farm and alchemy");
if (!actionTargets.relationship.has("character") || !actionTargets.relationship.has("market")) throw new Error("relationship route must lead to character and market");
if (!actionTargets.battle.has("battle")) throw new Error("battle route must lead to battle preparation");
if (!battlePreparation.timelineValue.includes("4 分钟")) throw new Error("chapter-one battle preparation must promise the four-minute runtime");
if (!/waveId\s*===\s*1\)\s*return\s+240/.test(expeditionSource)) throw new Error("chapter-one battle runtime must reach its 240-second boss row");
const chapterWave = waveDefinitions.find((wave) => Number(wave.id) === 1);
const chapterBossRows = waveRows.filter((row) => Number(row.groupId) === Number(chapterWave?.wavePlanId) && [99, 999].includes(Number(row.typeId)));
const finalBossRow = chapterBossRows.sort((left, right) => Number(right.point) - Number(left.point))[0];
const finalBossId = chapterWave?.monster?.[Number(finalBossRow?.monster)];
const finalBoss = monsterDefinitions.find((monster) => Number(monster.resId) === Number(finalBossId));
if (!chapterWave || !finalBossRow || Number(finalBossRow.point) !== 240 || Number(finalBoss?.type) !== 3) throw new Error("chapter-one wave must spawn a valid final boss at 240 seconds");
const productionRoute = medicineShortage.routes.find((route) => route.id === "production");
if (!productionRoute?.alchemyRecipe) throw new Error("production route must provide a data-driven alchemy recipe");
if (productionRoute.alchemyRecipe.resultTemplateId !== "prd-39") throw new Error("production recipe must create the required remedy");
if (!Array.isArray(productionRoute.alchemyRecipe.ingredients) || productionRoute.alchemyRecipe.ingredients.length < 2) throw new Error("production recipe must define at least two ingredients");
for (const ingredient of productionRoute.alchemyRecipe.ingredients) {
  if (!ingredient.templateId || !Number.isInteger(ingredient.quantity) || ingredient.quantity <= 0) throw new Error("invalid production recipe ingredient");
}
const productionHerbRequirement = productionRoute.requirements.find((requirement) => requirement.kind === "item" && requirement.templateId === "mat-03");
const consumedProductionHerbs = productionRoute.alchemyRecipe.ingredients.find((ingredient) => ingredient.templateId === "mat-03")?.quantity ?? 0;
if (!productionHerbRequirement || productionHerbRequirement.required + consumedProductionHerbs > 3) throw new Error("production route cannot be completed from its three-herb onboarding budget");

console.log(`quest content check passed: ${quests.length} quests, ${quests.filter((quest) => quest.giver).length} dialogue offers, ${quests.reduce((sum, quest) => sum + quest.objectives.length, 0)} objectives, ${quests.reduce((sum, quest) => sum + quest.rewards.length, 0)} rewards, ${chapterOne.outcomes.length} chapter outcomes, ${medicineShortage.routes.length} executable routes, boss ${finalBoss.name}@${finalBossRow.point}s`);
