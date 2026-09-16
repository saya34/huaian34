import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const content = JSON.parse(readFileSync(new URL("../app/game/content/shen-qingshuang-story.json", import.meta.url), "utf8"));
const events = content.events;

assert.equal(events.length, 10, "沈清霜人物篇章必须恰好包含十段");
assert.equal(new Set(events.map((event) => event.id)).size, events.length, "人物剧情事件 ID 不可重复");
assert.ok(new Set(events.map((event) => event.trigger)).size >= 6, "十段剧情至少需要六种触发方式");

const profileLines = content.dialogueProfile.rules.flatMap((rule) => [...rule.lines, rule.closingLine]);
const storyLines = events.flatMap((event) => Object.values(event.nodes))
  .filter((node) => node.type === "line" && node.speaker === "shen")
  .map((node) => node.text);
const uniqueShenLines = new Set([...content.character.ambientLines, ...profileLines, ...storyLines]);
assert.ok(uniqueShenLines.size >= 30, `沈清霜独立台词不足 30 条，当前 ${uniqueShenLines.size} 条`);

events.forEach((event, index) => {
  assert.ok(event.nodes[event.start], `${event.title} 的起始节点不存在`);
  for (const node of Object.values(event.nodes)) {
    if (node.type === "line") assert.ok(event.nodes[node.next], `${event.title}/${node.id} 指向不存在的节点 ${node.next}`);
    if (node.type === "choice") {
      assert.ok(node.options.length >= 2, `${event.title}/${node.id} 的选择不足两个`);
      node.options.forEach((option) => assert.ok(event.nodes[option.next], `${event.title}/${node.id} 指向不存在的节点 ${option.next}`));
    }
  }
  if (index > 0) {
    const previousId = events[index - 1].id;
    assert.ok(event.conditions.some((condition) => condition.type === "event_completed" && condition.eventId === previousId), `${event.title} 未以前一章作为条件`);
  }
});

const finalEffects = events.at(-1).nodes.end.effects ?? [];
assert.ok(finalEffects.some((effect) => effect.type === "learn_skill" && effect.skillId === 10023), "终章必须真实解锁天剑·无邪");

console.log(`沈清霜剧情校验通过：${events.length} 段剧情、${new Set(events.map((event) => event.trigger)).size} 种触发、${uniqueShenLines.size} 条独立台词。`);
