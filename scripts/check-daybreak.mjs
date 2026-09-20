import { readFileSync } from "node:fs";

const file = new URL("../app/game/daybreak/daybreak-content.json", import.meta.url);
const content = JSON.parse(readFileSync(file, "utf8"));
const stories = Array.isArray(content.stories) ? content.stories : [];
const ids = new Set();
let previousDay = 0;

if (content.homeSceneId !== "bedroom") throw new Error("跨日醒来地点必须是 bedroom");
if (stories.length < 8) throw new Error("首月晨间剧情数量不足");

for (const story of stories) {
  if (!story.id || ids.has(story.id)) throw new Error(`晨间剧情 ID 无效或重复：${story.id}`);
  ids.add(story.id);
  if (!Number.isInteger(story.day) || story.day < 1 || story.day > 30 || story.day <= previousDay) throw new Error(`晨间剧情日期无效：${story.id}`);
  if (previousDay && story.day - previousDay < 2) throw new Error(`晨间剧情过密：${story.id}`);
  if (previousDay && story.day - previousDay > 5) throw new Error(`晨间剧情间隔超过 5 天：${story.id}`);
  if (!Array.isArray(story.narration) || story.narration.length < 2) throw new Error(`缺少旁白：${story.id}`);
  if (!Array.isArray(story.thoughts) || story.thoughts.length < 2) throw new Error(`缺少主人公心声：${story.id}`);
  previousDay = story.day;
}

console.log(`Daybreak content OK: ${stories.length} stories, day ${stories[0].day}-${stories.at(-1).day}.`);
