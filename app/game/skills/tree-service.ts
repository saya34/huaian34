import treeContent from "./content/trees.json";
import type { CombatTraits, HeroAttributes } from "../battle/progression";

export type BlessingPage = "damage" | "defense" | "treasure";
export type SkillNodeKind = "passive" | "keystone";

export interface PassiveSkillDefinition {
  id: string;
  page: BlessingPage;
  branch: number;
  branchId: string;
  branchName: string;
  tier: number;
  requires?: string;
  name: string;
  description: string;
  maxRank: number;
  icon: string;
  kind: SkillNodeKind;
  milestone: boolean;
  attribute?: { key: keyof HeroAttributes; value: number };
  attributes?: Array<{ key: keyof HeroAttributes; value: number }>;
  trait?: { key: keyof CombatTraits; value: number };
  traits?: Array<{ key: keyof CombatTraits; value: number }>;
}

interface RawNode {
  id: string;
  name: string;
  description: string;
  icon: string;
  kind?: SkillNodeKind;
  milestone?: boolean;
  attribute?: { key: keyof HeroAttributes; value: number };
  attributes?: Array<{ key: keyof HeroAttributes; value: number }>;
  trait?: { key: keyof CombatTraits; value: number };
  traits?: Array<{ key: keyof CombatTraits; value: number }>;
}

interface RawTree {
  id: BlessingPage;
  name: string;
  subtitle: string;
  mark: string;
  tone: string;
  root: RawNode;
  branches: Array<{ id: string; name: string; nodes: RawNode[] }>;
}

interface RawTreeContent {
  title: string;
  subtitle: string;
  trees: RawTree[];
}

const CONTENT = treeContent as RawTreeContent;

export const SKILL_TREE_COPY = { title: CONTENT.title, subtitle: CONTENT.subtitle } as const;
export const SKILL_TREES = CONTENT.trees;
export const BLESSING_META = Object.fromEntries(CONTENT.trees.map((tree) => [tree.id, {
  name: tree.name,
  subtitle: tree.subtitle,
  mark: tree.mark,
  tone: tree.tone,
}])) as Record<BlessingPage, { name: string; subtitle: string; mark: string; tone: string }>;

export const PASSIVE_SKILLS: PassiveSkillDefinition[] = CONTENT.trees.flatMap((tree) => {
  const root: PassiveSkillDefinition = {
    ...tree.root,
    page: tree.id,
    branch: 0,
    branchId: "root",
    branchName: "道基",
    tier: 0,
    maxRank: 1,
    kind: tree.root.kind ?? "passive",
    milestone: false,
  };
  const branchNodes = tree.branches.flatMap((branch, branchIndex) => branch.nodes.map((node, index): PassiveSkillDefinition => ({
    ...node,
    page: tree.id,
    branch: branchIndex,
    branchId: branch.id,
    branchName: branch.name,
    tier: index + 1,
    requires: index === 0 ? tree.root.id : branch.nodes[index - 1].id,
    maxRank: 1,
    kind: node.milestone ? "keystone" : node.kind ?? "passive",
    milestone: Boolean(node.milestone),
  })));
  return [root, ...branchNodes];
});

export function treeById(id: BlessingPage) {
  return SKILL_TREES.find((tree) => tree.id === id) ?? SKILL_TREES[0];
}

export function skillsForTree(id: BlessingPage) {
  return PASSIVE_SKILLS.filter((skill) => skill.page === id);
}

export function nextTreeMilestone(id: BlessingPage, ranks: Record<string, number>) {
  return skillsForTree(id).find((skill) => skill.milestone && (ranks[skill.id] ?? 0) < skill.maxRank) ?? null;
}

export function validateSkillTreeContent() {
  for (const tree of SKILL_TREES) {
    if (tree.branches.length < 2) throw new Error(`${tree.name} 至少需要两个分支`);
    for (const branch of tree.branches) {
      if (branch.nodes.length < 12) throw new Error(`${tree.name}·${branch.name} 的根到叶节点不足 13 个`);
      branch.nodes.forEach((node, index) => {
        const tier = index + 1;
        if (tier % 3 === 0 && !node.milestone) throw new Error(`${tree.name}·${branch.name} 第 ${tier} 层必须为强力节点`);
      });
    }
  }
  return true;
}

validateSkillTreeContent();
