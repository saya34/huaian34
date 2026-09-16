import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const manuals = readJson("../app/game/skills/content/manuals.json");
const trees = readJson("../app/game/skills/content/trees.json");

assert.equal(trees.trees.length, 3, "技能树必须保留伤害、防御、寻宝三个入口");
assert.deepEqual(trees.trees.map((tree) => tree.id), ["damage", "defense", "treasure"]);

const ids = new Set();
for (const tree of trees.trees) {
  assert.ok(tree.root?.id, `${tree.name} 缺少根节点`);
  assert.equal(tree.branches.length, 2, `${tree.name} 必须保留两条选择分支`);
  assert.ok(!ids.has(tree.root.id), `重复节点 ${tree.root.id}`);
  ids.add(tree.root.id);

  for (const branch of tree.branches) {
    assert.ok(branch.nodes.length >= 12, `${tree.name}·${branch.name} 根至叶不足 13 节`);
    branch.nodes.forEach((node, index) => {
      assert.ok(!ids.has(node.id), `重复节点 ${node.id}`);
      ids.add(node.id);
      const tier = index + 1;
      if (tier % 3 === 0) assert.equal(node.milestone, true, `${tree.name}·${branch.name} 第 ${tier} 节不是强力节点`);
      assert.ok(node.attribute || node.attributes || node.trait || node.traits, `${node.name} 没有真实效果`);
    });
  }
}

const manualIds = new Set();
for (const manual of manuals.manuals) {
  assert.ok(!manualIds.has(manual.baseId), `重复功法 ${manual.baseId}`);
  manualIds.add(manual.baseId);
  assert.ok(manual.name && manual.source && manual.art && manual.description, `${manual.baseId} 缺少功法元数据`);
}
assert.ok(manuals.manuals.length >= 20, "万法谱内容不足 20 本");
assert.ok(manuals.manuals.some((manual) => !manual.starter), "需要存在剧情、随机或商店获得的功法");

const allNodes = trees.trees.flatMap((tree) => [tree.root, ...tree.branches.flatMap((branch) => branch.nodes)]);
const hasTrait = (key) => allNodes.some((node) => node.trait?.key === key || node.traits?.some((trait) => trait.key === key));
assert.ok(hasTrait("reviveCount"), "防御树缺少致命伤复活能力");
assert.ok(hasTrait("forceExtractCount"), "寻宝树缺少强制撤离能力");
assert.ok(hasTrait("rerollBonus"), "寻宝树缺少三选一重选能力");

console.log(`功法系统校验通过：${manuals.manuals.length} 本功法，${trees.trees.length} 条道脉，${ids.size} 个技能节点。`);
