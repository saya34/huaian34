import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dialogue = JSON.parse(fs.readFileSync(path.join(root, "app/game/content/shen-qingshuang-dialogue.json"), "utf8"));
const stories = JSON.parse(fs.readFileSync(path.join(root, "app/game/content/shen-qingshuang-events.json"), "utf8")).events;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const rules = dialogue.dialogueProfile.rules;
const dailyLines = rules.flatMap((rule) => rule.lines);
const ambientLines = dialogue.character.ambientLines;
const allDialogue = [...dailyLines, ...ambientLines];
const dialogueLengths = allDialogue.map((line) => [...line].length);
const periods = ["清晨", "上午", "午后", "黄昏", "夜晚", "深夜"];
const relationshipBands = [...new Set(rules.map((rule) => `${rule.minRelationship}-${rule.maxRelationship}`))];

assert(allDialogue.length > 200, `日常语料应超过200段，当前${allDialogue.length}`);
assert(new Set(allDialogue).size === allDialogue.length, "日常语料存在完全重复句");
assert(Math.min(...dialogueLengths) >= 12, `存在过短的日常对白，最短仅${Math.min(...dialogueLengths)}字`);
assert(dialogueLengths.reduce((sum, length) => sum + length, 0) / dialogueLengths.length >= 20, "日常对白平均长度不足，容易退化为短句标签");
assert(relationshipBands.length >= 5, `好感阶段不足5档，当前${relationshipBands.length}`);
assert(rules.length === relationshipBands.length * periods.length, "好感阶段与六时辰对话矩阵不完整");
for (const band of relationshipBands) {
  const [min, max] = band.split("-").map(Number);
  for (const period of periods) {
    const rule = rules.find((entry) => entry.minRelationship === min && entry.maxRelationship === max && entry.period === period);
    assert(rule, `${band}好感阶段缺少${period}对话`);
    assert(rule.lines.length >= 7, `${rule.id}语料不足7条`);
  }
}

assert(stories.length > 30, `剧情应超过30段，当前${stories.length}`);
assert(new Set(stories.map((event) => event.id)).size === stories.length, "剧情ID重复");
assert(new Set(stories.map((event) => event.title)).size === stories.length, "剧情标题重复");
assert(new Set(stories.map((event) => event.phase)).size >= 5, "剧情阶段不足5章");
assert(new Set(stories.map((event) => event.trigger)).size >= 7, "剧情触发方式不够丰富");
assert(stories.some((event) => event.script.filter((entry) => entry.kind === "choice").length >= 2), "缺少包含多次选择的剧情");
assert(stories.every((event) => event.script.some((entry) => entry.kind === "choice")), "每段剧情至少需要一次玩家选择");
assert(stories.filter((event) => event.script.filter((entry) => entry.kind === "choice").length >= 2).length >= 4, "含多次选择的剧情不足4段");

const ordered = [...stories].sort((a, b) => a.order - b.order);
let minimumRelationship = 4;
ordered.forEach((event, index) => {
  assert(event.order === index + 1, `剧情顺序在${event.id}处不连续`);
  assert(event.script.length >= 10 && event.script.length <= 30, `${event.id}应为10–30轮，当前${event.script.length}`);
  assert(event.clue?.trim(), `${event.id}缺少触发线索`);
  if (index > 0) {
    const previousId = ordered[index - 1].id;
    assert(event.conditions.some((condition) => condition.type === "event_completed" && condition.eventId === previousId), `${event.id}未以前一段${previousId}作为渐进前置`);
  }
  const requiredRelationship = event.conditions.find((condition) => condition.type === "relationship")?.min ?? 0;
  assert(minimumRelationship >= requiredRelationship, `${event.id}最低好感路线仅${minimumRelationship}，无法达到触发门槛${requiredRelationship}`);
  const endingGain = (event.endingEffects ?? []).filter((effect) => effect.type === "relationship" && effect.characterId === "shen").reduce((sum, effect) => sum + effect.amount, 0);
  const minimumChoiceGain = event.script.filter((entry) => entry.kind === "choice").reduce((total, choice) => total + Math.min(...choice.options.map((option) => (option.effects ?? []).filter((effect) => effect.type === "relationship" && effect.characterId === "shen").reduce((sum, effect) => sum + effect.amount, 0))), 0);
  minimumRelationship = Math.min(100, minimumRelationship + endingGain + minimumChoiceGain);
});

const choiceCount = stories.flatMap((event) => event.script).filter((entry) => entry.kind === "choice").length;
console.log(JSON.stringify({
  dailyDialogue: dailyLines.length,
  ambientDialogue: ambientLines.length,
  totalDialogue: allDialogue.length,
  relationshipBands: relationshipBands.length,
  periods: periods.length,
  stories: stories.length,
  storyRounds: { min: Math.min(...stories.map((event) => event.script.length)), max: Math.max(...stories.map((event) => event.script.length)) },
  choices: choiceCount,
  minimumRelationshipAfterArc: minimumRelationship,
  dialogueLength: { min: Math.min(...dialogueLengths), average: Number((dialogueLengths.reduce((sum, length) => sum + length, 0) / dialogueLengths.length).toFixed(1)), max: Math.max(...dialogueLengths) },
  phases: [...new Set(stories.map((event) => event.phase))],
  triggers: [...new Set(stories.map((event) => event.trigger))],
}, null, 2));
