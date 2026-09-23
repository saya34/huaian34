import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cardsFile = new URL("../app/game/battle/content/summon-showcase-cards.json", import.meta.url);
const effectsFile = new URL("../app/game/battle/content/summon-effects.json", import.meta.url);
const gameplayFile = new URL("../app/game/battle/content/summon-gameplay-effects.json", import.meta.url);
const cards = JSON.parse(readFileSync(cardsFile, "utf8")).cards;
const effects = JSON.parse(readFileSync(effectsFile, "utf8")).variants;
const gameplayEffects = JSON.parse(readFileSync(gameplayFile, "utf8")).effects;
const effectIds = new Set(effects.map((effect) => effect.id));
const gameplayIds = new Set(gameplayEffects.map((effect) => effect.effectId));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(cards.length === 30, `召灵试炼应包含 30 张人物卡，当前 ${cards.length} 张`);
assert(new Set(cards.map((card) => card.id)).size === 30, "召灵人物卡 ID 存在重复");
assert(new Set(cards.map((card) => card.effectId)).size === 30, "30 张人物卡没有一对一绑定不同特效");
assert(new Set(cards.map((card) => card.art)).size === 30, "30 张人物卡没有使用不同图片");
assert(gameplayEffects.length === 30, `召灵战斗效果应包含 30 项，当前 ${gameplayEffects.length} 项`);
assert(gameplayIds.size === 30, "召灵战斗效果 ID 存在重复");

for (const card of cards) {
  assert(effectIds.has(card.effectId), `${card.name} 绑定了未知特效 ${card.effectId}`);
  assert(gameplayIds.has(card.effectId), `${card.name} 缺少真实战斗效果 ${card.effectId}`);
  const image = new URL(`../public${card.art}`, import.meta.url);
  assert(existsSync(fileURLToPath(image)), `${card.name} 缺少图片 ${card.art}`);
}

for (const effect of gameplayEffects) {
  assert(effect.durationSeconds >= 8, `${effect.effectId} 的持续时间过短`);
  assert(effect.damage || effect.heal || effect.buff || effect.control, `${effect.effectId} 没有真实战斗机制`);
}

console.log("Summon showcase OK: 30 cards, 30 unique images, 30 visual effects, 30 battle effects.");
