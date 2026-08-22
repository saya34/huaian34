export interface HeroAttributes {
  health: number;
  defense: number;
  damage: number;
  dodge: number;
  moveSpeed: number;
  expGain: number;
  attackSpeed: number;
  projectileSpeed: number;
}

export const BASE_HERO_ATTRIBUTES: Readonly<HeroAttributes> = {
  health: 1000,
  defense: 100,
  damage: 1,
  dodge: .03,
  moveSpeed: 250,
  expGain: 1,
  attackSpeed: 1,
  projectileSpeed: 1,
};

export type AttributeBonus = Partial<HeroAttributes>;
export type AttributeAllocation = Record<"health" | "defense" | "damage" | "dodge" | "moveSpeed" | "attackSpeed", number>;
export const ATTRIBUTE_POINT_BONUS: Record<keyof AttributeAllocation, number> = {
  health: 30, defense: 4, damage: .015, dodge: .0025, moveSpeed: 1.5, attackSpeed: .01,
};

export type BlessingPage = "sister" | "master" | "junior";
export interface PassiveSkillDefinition {
  id: string; page: BlessingPage; branch: number; tier: number; requires?: string; name: string; description: string; maxRank: number; icon: string;
  attribute?: { key: keyof HeroAttributes; value: number };
  trait?: { key: keyof CombatTraits; value: number };
}

export const BLESSING_META: Record<BlessingPage, { name: string; subtitle: string; mark: string }> = {
  sister: { name: "苏晚棠授业", subtitle: "身法、攻速与灵巧", mark: "巧" },
  master: { name: "沈清霜授业", subtitle: "剑道、暴击与杀伐", mark: "剑" },
  junior: { name: "柳知意授业", subtitle: "丹医、恢复与护命", mark: "生" },
};

export const PASSIVE_SKILLS: PassiveSkillDefinition[] = [
  { id: "fleet-foot", page: "sister", branch: 0, tier: 0, name: "踏风诀", description: "每级移动速度提高5%。", maxRank: 3, icon: "风", attribute: { key: "moveSpeed", value: 12.5 } },
  { id: "cloud-tread", page: "sister", branch: 0, tier: 1, requires: "fleet-foot", name: "踏云无痕", description: "每级提高3%闪避率。", maxRank: 3, icon: "云", attribute: { key: "dodge", value: .03 } },
  { id: "phantom-step", page: "sister", branch: 0, tier: 2, requires: "cloud-tread", name: "幻影步", description: "每级提高7%移动速度。", maxRank: 3, icon: "影", attribute: { key: "moveSpeed", value: 17.5 } },
  { id: "void-step", page: "sister", branch: 0, tier: 3, requires: "phantom-step", name: "虚空挪移", description: "每级提高4%闪避率与少量移动速度。", maxRank: 2, icon: "虚", attribute: { key: "dodge", value: .04 } },
  { id: "celestial-flight", page: "sister", branch: 0, tier: 4, requires: "void-step", name: "扶摇九天", description: "身法圆满，移动速度提高12%。", maxRank: 1, icon: "翔", attribute: { key: "moveSpeed", value: 30 } },
  { id: "swift-shot", page: "sister", branch: 1, tier: 0, name: "流光御器", description: "每级子弹飞行速度提高8%。", maxRank: 3, icon: "矢", attribute: { key: "projectileSpeed", value: .08 } },
  { id: "wind-guidance", page: "sister", branch: 1, tier: 1, requires: "swift-shot", name: "御风引", description: "每级提高5%攻速。", maxRank: 3, icon: "引", attribute: { key: "attackSpeed", value: .05 } },
  { id: "split-focus", page: "sister", branch: 1, tier: 2, requires: "wind-guidance", name: "分念御物", description: "每级提高4%伤害与6%弹速。", maxRank: 3, icon: "念", attribute: { key: "damage", value: .04 } },
  { id: "star-chaser", page: "sister", branch: 1, tier: 3, requires: "split-focus", name: "追星逐月", description: "每级提高9%攻速。", maxRank: 2, icon: "星", attribute: { key: "attackSpeed", value: .09 } },
  { id: "spirit-clone", page: "sister", branch: 1, tier: 4, requires: "star-chaser", name: "灵身化影", description: "进入副本时有35%概率获得分身，复制全部技能与伤害。", maxRank: 1, icon: "双", trait: { key: "cloneChance", value: .35 } },
  { id: "insight", page: "sister", branch: 2, tier: 0, name: "悟性通明", description: "每级提高8%经验获取。", maxRank: 3, icon: "悟", attribute: { key: "expGain", value: .08 } },
  { id: "treasure-sense", page: "sister", branch: 2, tier: 1, requires: "insight", name: "寻宝灵觉", description: "每级提高宝物品质权重。", maxRank: 3, icon: "宝", trait: { key: "lootLuck", value: 1 } },
  { id: "keen-perception", page: "sister", branch: 2, tier: 2, requires: "treasure-sense", name: "灵台澄明", description: "每级提高10%经验获取。", maxRank: 3, icon: "明", attribute: { key: "expGain", value: .1 } },
  { id: "fortune-gathering", page: "sister", branch: 2, tier: 3, requires: "keen-perception", name: "聚宝纳福", description: "每级显著提高宝物品质权重。", maxRank: 2, icon: "福", trait: { key: "lootLuck", value: 1.5 } },
  { id: "heaven-favored", page: "sister", branch: 2, tier: 4, requires: "fortune-gathering", name: "天眷之人", description: "气运加身，提高15%经验获取与宝物机缘。", maxRank: 1, icon: "缘", attribute: { key: "expGain", value: .15 } },

  { id: "battle-might", page: "master", branch: 0, tier: 0, name: "杀伐真意", description: "每级提高8%最终伤害。", maxRank: 3, icon: "刃", attribute: { key: "damage", value: .08 } },
  { id: "sword-heart", page: "master", branch: 0, tier: 1, requires: "battle-might", name: "剑心通明", description: "每级提高7%伤害。", maxRank: 3, icon: "剑", attribute: { key: "damage", value: .07 } },
  { id: "rapid-casting", page: "master", branch: 0, tier: 2, requires: "sword-heart", name: "御法无隙", description: "每级提高6%攻击速度。", maxRank: 3, icon: "速", attribute: { key: "attackSpeed", value: .06 } },
  { id: "sunfire-will", page: "master", branch: 0, tier: 3, requires: "rapid-casting", name: "大日战意", description: "每级提高12%伤害。", maxRank: 2, icon: "日", attribute: { key: "damage", value: .12 } },
  { id: "heavenly-sword", page: "master", branch: 0, tier: 4, requires: "sunfire-will", name: "天剑荡魔", description: "攻击有1.5%概率对全图敌人造成范围天剑伤害。", maxRank: 1, icon: "天", trait: { key: "globalChance", value: .015 } },
  { id: "critical-eye", page: "master", branch: 1, tier: 0, name: "破绽洞察", description: "每级获得6%暴击率。", maxRank: 3, icon: "破", trait: { key: "critChance", value: .06 } },
  { id: "keen-edge", page: "master", branch: 1, tier: 1, requires: "critical-eye", name: "锋芒毕露", description: "每级提高5%伤害。", maxRank: 3, icon: "锋", attribute: { key: "damage", value: .05 } },
  { id: "critical-mastery", page: "master", branch: 1, tier: 2, requires: "keen-edge", name: "会心一击", description: "每级再提高5%暴击率。", maxRank: 3, icon: "会", trait: { key: "critChance", value: .05 } },
  { id: "death-mark", page: "master", branch: 1, tier: 3, requires: "critical-mastery", name: "死兆印", description: "每级对精英与首领提高12%伤害。", maxRank: 2, icon: "印", trait: { key: "eliteDamage", value: .12 } },
  { id: "dao-execution", page: "master", branch: 1, tier: 4, requires: "death-mark", name: "大道裁决", description: "暴击伤害倍率额外提高50%。", maxRank: 1, icon: "决", trait: { key: "critMultiplier", value: .5 } },
  { id: "chain-force", page: "master", branch: 2, tier: 0, name: "雷霆连锁", description: "每级有5%概率将伤害传导给附近敌人。", maxRank: 3, icon: "链", trait: { key: "chainChance", value: .05 } },
  { id: "thunder-pulse", page: "master", branch: 2, tier: 1, requires: "chain-force", name: "震雷脉", description: "每级提高6%攻速。", maxRank: 3, icon: "雷", attribute: { key: "attackSpeed", value: .06 } },
  { id: "storm-link", page: "master", branch: 2, tier: 2, requires: "thunder-pulse", name: "万象雷网", description: "每级再提高4%连锁触发率。", maxRank: 3, icon: "网", trait: { key: "chainChance", value: .04 } },
  { id: "heavenly-wrath", page: "master", branch: 2, tier: 3, requires: "storm-link", name: "九霄天罚", description: "每级提高1%全图天威触发率。", maxRank: 2, icon: "罚", trait: { key: "globalChance", value: .01 } },
  { id: "boss-slayer", page: "master", branch: 2, tier: 4, requires: "heavenly-wrath", name: "斩王", description: "对精英与首领额外造成25%伤害。", maxRank: 1, icon: "王", trait: { key: "eliteDamage", value: .25 } },

  { id: "vital-source", page: "junior", branch: 0, tier: 0, name: "生生不息", description: "每级提高8%最大生命。", maxRank: 3, icon: "命", attribute: { key: "health", value: 80 } },
  { id: "jade-bone", page: "junior", branch: 0, tier: 1, requires: "vital-source", name: "玉骨", description: "每级提高45点防御。", maxRank: 3, icon: "甲", attribute: { key: "defense", value: 45 } },
  { id: "tortoise-body", page: "junior", branch: 0, tier: 2, requires: "jade-bone", name: "玄武真身", description: "每级提高120点生命与35点防御。", maxRank: 3, icon: "玄", attribute: { key: "health", value: 120 } },
  { id: "mountain-soul", page: "junior", branch: 0, tier: 3, requires: "tortoise-body", name: "不动山魂", description: "每级提高75点防御。", maxRank: 2, icon: "岳", attribute: { key: "defense", value: 75 } },
  { id: "nirvana", page: "junior", branch: 0, tier: 4, requires: "mountain-soul", name: "涅槃命火", description: "每次副本可复活一次并恢复半数生命。", maxRank: 1, icon: "生", trait: { key: "reviveCount", value: 1 } },
  { id: "spring-rain", page: "junior", branch: 1, tier: 0, name: "春雨诀", description: "每级每秒恢复最大生命的0.15%。", maxRank: 3, icon: "愈", trait: { key: "regenPercent", value: .0015 } },
  { id: "healing-heart", page: "junior", branch: 1, tier: 1, requires: "spring-rain", name: "回春道心", description: "每级提高10%所有治疗效果。", maxRank: 3, icon: "泉", trait: { key: "healingBonus", value: .1 } },
  { id: "spirit-well", page: "junior", branch: 1, tier: 2, requires: "healing-heart", name: "灵泉涌动", description: "每级提高140点最大生命。", maxRank: 3, icon: "灵", attribute: { key: "health", value: 140 } },
  { id: "evergreen", page: "junior", branch: 1, tier: 3, requires: "spirit-well", name: "长青不衰", description: "每级额外提高0.25%每秒恢复。", maxRank: 2, icon: "青", trait: { key: "regenPercent", value: .0025 } },
  { id: "rebirth-breath", page: "junior", branch: 1, tier: 4, requires: "evergreen", name: "造化生息", description: "所有治疗效果提高30%。", maxRank: 1, icon: "化", trait: { key: "healingBonus", value: .3 } },
  { id: "blood-return", page: "junior", branch: 2, tier: 0, name: "噬灵归元", description: "每级将伤害的0.15%转化为生命。", maxRank: 3, icon: "吸", trait: { key: "lifeSteal", value: .0015 } },
  { id: "blood-coagulation", page: "junior", branch: 2, tier: 1, requires: "blood-return", name: "凝血诀", description: "每级提高90点生命。", maxRank: 3, icon: "血", attribute: { key: "health", value: 90 } },
  { id: "spirit-ward", page: "junior", branch: 2, tier: 2, requires: "blood-coagulation", name: "护心灵障", description: "每级提高55点防御。", maxRank: 3, icon: "护", attribute: { key: "defense", value: 55 } },
  { id: "reverse-flow", page: "junior", branch: 2, tier: 3, requires: "spirit-ward", name: "逆脉归元", description: "每级额外获得0.3%吸血。", maxRank: 2, icon: "归", trait: { key: "lifeSteal", value: .003 } },
  { id: "undying-lotus", page: "junior", branch: 2, tier: 4, requires: "reverse-flow", name: "不灭心莲", description: "提高220点生命与20%治疗效果。", maxRank: 1, icon: "莲", attribute: { key: "health", value: 220 } },
];

export interface CombatTraits {
  lootLuck: number; critChance: number; critMultiplier: number; chainChance: number; chainRatio: number;
  globalChance: number; globalRatio: number; eliteDamage: number; regenPercent: number; lifeSteal: number;
  healingBonus: number; reviveCount: number; cloneChance: number;
}

export const DEFAULT_COMBAT_TRAITS: CombatTraits = {
  lootLuck: 0, critChance: 0, critMultiplier: 2, chainChance: 0, chainRatio: .55, globalChance: 0,
  globalRatio: .3, eliteDamage: 0, regenPercent: 0, lifeSteal: 0, healingBonus: 0, reviveCount: 0, cloneChance: 0,
};

export function passiveRank(ranks: Record<string, number>, id: string) { return ranks[id] ?? 0; }

export function passiveAttributeBonuses(ranks: Record<string, number>): AttributeBonus[] {
  return PASSIVE_SKILLS.flatMap((skill) => skill.attribute
    ? [{ [skill.attribute.key]: skill.attribute.value * passiveRank(ranks, skill.id) }]
    : []);
}

export function computeCombatTraits(ranks: Record<string, number>): CombatTraits {
  const result = { ...DEFAULT_COMBAT_TRAITS };
  for (const skill of PASSIVE_SKILLS) if (skill.trait) {
    const key = skill.trait.key;
    result[key] += skill.trait.value * passiveRank(ranks, skill.id);
  }
  return result;
}

export function passiveSkillUnlocked(ranks: Record<string, number>, skill: PassiveSkillDefinition, relationships: Record<string, number> = {}) {
  const characterId: Record<BlessingPage, string> = { sister: "su", master: "shen", junior: "liu" };
  const requiredBond = skill.tier >= 4 ? 45 : skill.tier >= 3 ? 25 : 0;
  if ((relationships[characterId[skill.page]] ?? 0) < requiredBond) return false;
  if (!skill.requires) return true;
  const prerequisite = PASSIVE_SKILLS.find((entry) => entry.id === skill.requires);
  return Boolean(prerequisite && passiveRank(ranks, prerequisite.id) >= prerequisite.maxRank);
}

export function attributeAllocationBonus(allocation: AttributeAllocation): AttributeBonus {
  return Object.fromEntries(Object.entries(allocation).map(([key, points]) => [key, points * ATTRIBUTE_POINT_BONUS[key as keyof AttributeAllocation]])) as AttributeBonus;
}
export type EquipmentSlot = "head" | "chest" | "hands" | "legs" | "feet" | "weapon";
export type GearRarity = "common" | "fine" | "rare" | "epic" | "immortal";

export interface EquipmentDefinition {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: GearRarity;
  price: number;
  bonuses: AttributeBonus;
  art: string;
  description: string;
}

export interface EquipmentItem {
  uid: string; equipmentId: string; name?: string; rarity?: GearRarity; price?: number; bonuses?: AttributeBonus; affixes?: string[];
}

export const SLOT_META: Record<EquipmentSlot, { name: string; mark: string }> = {
  head: { name: "头盔", mark: "冠" }, chest: { name: "上衣", mark: "衣" }, hands: { name: "护腕", mark: "腕" },
  legs: { name: "下装", mark: "裳" }, feet: { name: "鞋履", mark: "履" }, weapon: { name: "武器", mark: "兵" },
};

export const EQUIPMENT: EquipmentDefinition[] = [
  { id: "cloud-crown", name: "流云道冠", slot: "head", rarity: "fine", price: 420, bonuses: { health: 90, defense: 28 }, art: "/game-assets/equipment/cloud-crown.webp", description: "云纹护住灵台，兼顾气血与防御。" },
  { id: "jade-robe", name: "青玉玄袍", slot: "chest", rarity: "rare", price: 980, bonuses: { health: 180, defense: 72 }, art: "/game-assets/equipment/jade-robe.webp", description: "以灵蚕丝织成的护身法袍。" },
  { id: "thunder-bracers", name: "惊雷护腕", slot: "hands", rarity: "rare", price: 860, bonuses: { damage: .12, defense: 24 }, art: "/game-assets/equipment/thunder-bracers.webp", description: "雷纹沿经脉流转，强化出手威力。" },
  { id: "wind-greaves", name: "御风云裳", slot: "legs", rarity: "fine", price: 560, bonuses: { moveSpeed: 18, dodge: .025 }, art: "/game-assets/equipment/wind-greaves.webp", description: "衣摆轻若云气，使身法更为飘忽。" },
  { id: "moon-boots", name: "踏月履", slot: "feet", rarity: "epic", price: 1650, bonuses: { moveSpeed: 28, dodge: .045 }, art: "/game-assets/equipment/moon-boots.webp", description: "踏月无痕，大幅强化移动与闪避。" },
  { id: "spirit-sword", name: "玄霄灵剑", slot: "weapon", rarity: "epic", price: 2200, bonuses: { damage: .24, expGain: .08 }, art: "/game-assets/equipment/spirit-sword.webp", description: "剑意反哺修为，兼具杀伐与悟道之能。" },
  { id: "iron-crown", name: "镇岳铁冠", slot: "head", rarity: "common", price: 180, bonuses: { defense: 42 }, art: "/game-assets/equipment/iron-crown.webp", description: "沉重但可靠的护额。" },
  { id: "sage-gloves", name: "悟道手套", slot: "hands", rarity: "immortal", price: 3600, bonuses: { damage: .18, expGain: .18 }, art: "/game-assets/equipment/sage-gloves.webp", description: "每次出手都能印证大道。" },
  { id: "bamboo-crown", name: "青竹束发冠", slot: "head", rarity: "common", price: 210, bonuses: { defense: 24, health: 45 }, art: "/game-assets/equipment/bamboo-crown.webp", description: "青竹编成的轻冠，残留山林清气。" },
  { id: "star-diadem", name: "星辉法冠", slot: "head", rarity: "rare", price: 920, bonuses: { defense: 48, expGain: .07 }, art: "/game-assets/equipment/star-diadem.webp", description: "冠上星砂可牵引周天灵光。" },
  { id: "sun-crown", name: "大日金冠", slot: "head", rarity: "epic", price: 1880, bonuses: { defense: 76, damage: .11 }, art: "/game-assets/equipment/sun-crown.webp", description: "一轮大日法纹镇守灵台。" },
  { id: "heaven-crown", name: "太清无极冠", slot: "head", rarity: "immortal", price: 4200, bonuses: { defense: 115, health: 180, expGain: .12 }, art: "/game-assets/equipment/heaven-crown.webp", description: "太清道韵凝成的无上冠冕。" },
  { id: "linen-robe", name: "纳气布袍", slot: "chest", rarity: "common", price: 240, bonuses: { health: 110, defense: 18 }, art: "/game-assets/equipment/linen-robe.webp", description: "初入仙途的修士常穿此袍。" },
  { id: "mist-robe", name: "烟霞云纹袍", slot: "chest", rarity: "fine", price: 590, bonuses: { health: 155, dodge: .018 }, art: "/game-assets/equipment/mist-robe.webp", description: "烟霞流转，使身形若隐若现。" },
  { id: "dragon-robe", name: "蟠龙镇岳袍", slot: "chest", rarity: "epic", price: 2050, bonuses: { health: 280, defense: 92 }, art: "/game-assets/equipment/dragon-robe.webp", description: "蟠龙法相护持周身经脉。" },
  { id: "lotus-vestment", name: "净世莲华衣", slot: "chest", rarity: "immortal", price: 4550, bonuses: { health: 360, defense: 125, damage: .08 }, art: "/game-assets/equipment/lotus-vestment.webp", description: "莲华不染尘劫，万法难侵。" },
  { id: "leather-bracers", name: "伏妖皮护腕", slot: "hands", rarity: "common", price: 230, bonuses: { damage: .055, defense: 12 }, art: "/game-assets/equipment/leather-bracers.webp", description: "以低阶妖皮制成，坚韧实用。" },
  { id: "jade-bracers", name: "青玉御灵腕", slot: "hands", rarity: "fine", price: 540, bonuses: { damage: .075, attackSpeed: .045 }, art: "/game-assets/equipment/jade-bracers.webp", description: "温玉稳定灵力，使御器更加顺畅。" },
  { id: "flame-bracers", name: "离火焚天腕", slot: "hands", rarity: "epic", price: 1920, bonuses: { damage: .15, projectileSpeed: .1 }, art: "/game-assets/equipment/flame-bracers.webp", description: "腕间离火令法器破空如焰。" },
  { id: "void-bracers", name: "虚空摘星手", slot: "hands", rarity: "immortal", price: 4380, bonuses: { damage: .2, attackSpeed: .13, projectileSpeed: .12 }, art: "/game-assets/equipment/void-bracers.webp", description: "抬手可摘星，翻掌可断流。" },
  { id: "traveler-trousers", name: "远行束腿", slot: "legs", rarity: "common", price: 190, bonuses: { moveSpeed: 9, health: 45 }, art: "/game-assets/equipment/traveler-trousers.webp", description: "适合长途历练的轻便下装。" },
  { id: "crane-greaves", name: "白鹤凌云裳", slot: "legs", rarity: "fine", price: 610, bonuses: { moveSpeed: 16, dodge: .018 }, art: "/game-assets/equipment/crane-greaves.webp", description: "白鹤云纹引导灵巧身法。" },
  { id: "mountain-greaves", name: "玄岳护元裳", slot: "legs", rarity: "rare", price: 1080, bonuses: { health: 170, defense: 58, moveSpeed: 10 }, art: "/game-assets/equipment/mountain-greaves.webp", description: "稳若山岳，动时仍不失轻灵。" },
  { id: "galaxy-greaves", name: "星河万象裳", slot: "legs", rarity: "immortal", price: 4100, bonuses: { moveSpeed: 30, dodge: .055, health: 210 }, art: "/game-assets/equipment/galaxy-greaves.webp", description: "衣褶间似有一条星河流转。" },
  { id: "straw-sandals", name: "踏云草履", slot: "feet", rarity: "common", price: 160, bonuses: { moveSpeed: 10, dodge: .012 }, art: "/game-assets/equipment/straw-sandals.webp", description: "草叶浸过灵泉，轻便耐用。" },
  { id: "spirit-boots", name: "逐风灵靴", slot: "feet", rarity: "fine", price: 520, bonuses: { moveSpeed: 19, dodge: .022 }, art: "/game-assets/equipment/spirit-boots.webp", description: "靴底风纹能减轻落地之势。" },
  { id: "thunder-boots", name: "奔雷掠影靴", slot: "feet", rarity: "rare", price: 1150, bonuses: { moveSpeed: 25, dodge: .033, attackSpeed: .045 }, art: "/game-assets/equipment/thunder-boots.webp", description: "每一步都伴随细碎雷鸣。" },
  { id: "kunpeng-boots", name: "鲲鹏九霄履", slot: "feet", rarity: "immortal", price: 4680, bonuses: { moveSpeed: 42, dodge: .07, attackSpeed: .08 }, art: "/game-assets/equipment/kunpeng-boots.webp", description: "扶摇而起，一步已越九霄。" },
  { id: "iron-sabre", name: "镇妖铁刀", slot: "weapon", rarity: "common", price: 260, bonuses: { damage: .09, defense: 10 }, art: "/game-assets/equipment/iron-sabre.webp", description: "百炼铁铸成的斩妖兵刃。" },
  { id: "frost-bow", name: "寒螭灵弓", slot: "weapon", rarity: "rare", price: 1280, bonuses: { damage: .15, projectileSpeed: .12 }, art: "/game-assets/equipment/frost-bow.webp", description: "弓弦震动时有寒螭虚影游走。" },
  { id: "thunder-halberd", name: "九霆破军戟", slot: "weapon", rarity: "epic", price: 2450, bonuses: { damage: .23, attackSpeed: .08 }, art: "/game-assets/equipment/thunder-halberd.webp", description: "九道雷纹汇于戟锋，专破妖阵。" },
  { id: "chaos-blade", name: "混元开天刃", slot: "weapon", rarity: "immortal", price: 5200, bonuses: { damage: .34, attackSpeed: .12, expGain: .1 }, art: "/game-assets/equipment/chaos-blade.webp", description: "混元初分时遗落世间的开天锋芒。" },
  { id: "azure-dragon-crown", name: "青龙衔珠冠", slot: "head", rarity: "fine", price: 480, bonuses: { health: 105, defense: 32 }, art: "/game-assets/equipment/azure-dragon-crown.webp", description: "青龙衔珠，护持神识与心脉。" },
  { id: "blood-moon-crown", name: "血月魔冠", slot: "head", rarity: "rare", price: 1120, bonuses: { damage: .09, defense: 54 }, art: "/game-assets/equipment/blood-moon-crown.webp", description: "血月之力令杀意更加凝练。" },
  { id: "phoenix-crown", name: "赤鸾凤羽冠", slot: "head", rarity: "epic", price: 2280, bonuses: { health: 135, damage: .13, dodge: .025 }, art: "/game-assets/equipment/phoenix-crown.webp", description: "赤鸾真羽织成的灼灼冠饰。" },
  { id: "imperial-crown", name: "九霄帝冕", slot: "head", rarity: "immortal", price: 5450, bonuses: { health: 230, defense: 138, damage: .09 }, art: "/game-assets/equipment/imperial-crown.webp", description: "九霄威仪镇压一切邪念。" },
  { id: "silkworm-robe", name: "天蚕流光袍", slot: "chest", rarity: "fine", price: 680, bonuses: { health: 175, defense: 38 }, art: "/game-assets/equipment/silkworm-robe.webp", description: "天蚕丝随灵力流转而生辉。" },
  { id: "tortoise-robe", name: "玄武镇海衣", slot: "chest", rarity: "rare", price: 1380, bonuses: { health: 245, defense: 84, moveSpeed: -4 }, art: "/game-assets/equipment/tortoise-robe.webp", description: "厚重玄甲可化去大半冲势。" },
  { id: "crimson-robe", name: "赤霞战袍", slot: "chest", rarity: "epic", price: 2580, bonuses: { health: 260, defense: 76, damage: .12 }, art: "/game-assets/equipment/crimson-robe.webp", description: "赤霞如火，愈战愈勇。" },
  { id: "celestial-vestment", name: "天羽无尘衣", slot: "chest", rarity: "immortal", price: 5680, bonuses: { health: 390, defense: 110, dodge: .045 }, art: "/game-assets/equipment/celestial-vestment.webp", description: "天羽不沾凡尘，轻灵而坚韧。" },
  { id: "vine-bracers", name: "灵藤缚妖腕", slot: "hands", rarity: "fine", price: 520, bonuses: { damage: .065, defense: 26 }, art: "/game-assets/equipment/vine-bracers.webp", description: "灵藤缠腕，出手沉稳有力。" },
  { id: "ice-bracers", name: "冰魄玉腕", slot: "hands", rarity: "rare", price: 1260, bonuses: { damage: .1, attackSpeed: .07, projectileSpeed: .08 }, art: "/game-assets/equipment/ice-bracers.webp", description: "冰魄清心，使御器疾而不乱。" },
  { id: "vajra-bracers", name: "金刚伏魔腕", slot: "hands", rarity: "epic", price: 2360, bonuses: { damage: .16, defense: 66 }, art: "/game-assets/equipment/vajra-bracers.webp", description: "伏魔金刚力贯通双臂。" },
  { id: "samsara-gloves", name: "轮回摘星手", slot: "hands", rarity: "immortal", price: 5350, bonuses: { damage: .23, attackSpeed: .14, expGain: .08 }, art: "/game-assets/equipment/samsara-gloves.webp", description: "掌中轮回生灭，星辰亦可摘取。" },
  { id: "cloud-trousers", name: "云纹行者裳", slot: "legs", rarity: "fine", price: 570, bonuses: { moveSpeed: 17, health: 85 }, art: "/game-assets/equipment/cloud-trousers.webp", description: "云纹消解旅途疲惫。" },
  { id: "flame-trousers", name: "赤焰战裳", slot: "legs", rarity: "rare", price: 1220, bonuses: { moveSpeed: 20, damage: .08, dodge: .018 }, art: "/game-assets/equipment/flame-trousers.webp", description: "烈焰随步伐卷起，进退皆可攻。" },
  { id: "tortoise-greaves", name: "玄武重裳", slot: "legs", rarity: "epic", price: 2450, bonuses: { health: 270, defense: 95, moveSpeed: 8 }, art: "/game-assets/equipment/tortoise-greaves.webp", description: "重甲护住下盘，稳如玄武。" },
  { id: "taiji-trousers", name: "太极阴阳裳", slot: "legs", rarity: "immortal", price: 5200, bonuses: { moveSpeed: 33, dodge: .06, defense: 72 }, art: "/game-assets/equipment/taiji-trousers.webp", description: "阴阳相生，动静无隙。" },
  { id: "leaf-boots", name: "青叶轻履", slot: "feet", rarity: "fine", price: 460, bonuses: { moveSpeed: 18, dodge: .02 }, art: "/game-assets/equipment/leaf-boots.webp", description: "足下青叶托身，落地无声。" },
  { id: "ice-boots", name: "冰蝉踏雪履", slot: "feet", rarity: "rare", price: 1180, bonuses: { moveSpeed: 26, dodge: .032, projectileSpeed: .06 }, art: "/game-assets/equipment/ice-boots.webp", description: "踏雪无痕，寒气助法器破空。" },
  { id: "star-boots", name: "逐星雷履", slot: "feet", rarity: "epic", price: 2380, bonuses: { moveSpeed: 34, dodge: .045, attackSpeed: .065 }, art: "/game-assets/equipment/star-boots.webp", description: "雷光逐星，瞬息已至敌后。" },
  { id: "void-lotus-boots", name: "虚空莲步履", slot: "feet", rarity: "immortal", price: 5520, bonuses: { moveSpeed: 46, dodge: .075, expGain: .08 }, art: "/game-assets/equipment/void-lotus-boots.webp", description: "步步生莲，可渡虚空。" },
  { id: "bamboo-sword", name: "青竹灵剑", slot: "weapon", rarity: "fine", price: 620, bonuses: { damage: .12, attackSpeed: .045 }, art: "/game-assets/equipment/bamboo-sword.webp", description: "青竹藏锋，剑势绵长。" },
  { id: "blood-spear", name: "血月魔枪", slot: "weapon", rarity: "rare", price: 1480, bonuses: { damage: .19, health: 90 }, art: "/game-assets/equipment/blood-spear.webp", description: "血月映枪锋，一击贯穿妖躯。" },
  { id: "phoenix-fan", name: "赤鸾天火扇", slot: "weapon", rarity: "epic", price: 2780, bonuses: { damage: .25, attackSpeed: .09, projectileSpeed: .1 }, art: "/game-assets/equipment/phoenix-fan.webp", description: "扇动之间，赤鸾天火席卷而出。" },
  { id: "galaxy-blade", name: "天河斩仙刀", slot: "weapon", rarity: "immortal", price: 6100, bonuses: { damage: .38, attackSpeed: .1, expGain: .13 }, art: "/game-assets/equipment/galaxy-blade.webp", description: "刀中天河倒悬，可斩仙魔。" },
];

export const equipmentById = (id: string) => EQUIPMENT.find((item) => item.id === id) ?? EQUIPMENT[0];

export type CardType = "insert" | "passive";
export interface CardDefinition {
  id: string; name: string; type: CardType; rarity: GearRarity; lore: string; bonuses: AttributeBonus; art: string;
}

export const CARDS: CardDefinition[] = [
  { id: "sword-intent", name: "万剑归心", type: "insert", rarity: "epic", lore: "少年于万剑崖枯坐三载，终于听见了每一柄残剑的心跳。", bonuses: { damage: .28 }, art: "/game-assets/partners/sword-sister.webp" },
  { id: "vajra-body", name: "金刚法相", type: "insert", rarity: "rare", lore: "古寺钟鸣之夜，金身法相曾替众生挡下天火。", bonuses: { health: 260, defense: 110 }, art: "/game-assets/partners/vajra-monk.webp" },
  { id: "moon-step", name: "月下无踪", type: "insert", rarity: "epic", lore: "月魅踏过霜河，身后只留下三点未散的清辉。", bonuses: { dodge: .10, moveSpeed: 32 }, art: "/game-assets/partners/moon-demon.webp" },
  { id: "pill-scripture", name: "青璃丹经", type: "passive", rarity: "fine", lore: "残缺丹经仍蕴藏温养经脉的古法，拥有即会生效。", bonuses: { health: 80, expGain: .035 }, art: "/game-assets/partners/pill-fairy.webp" },
  { id: "thunder-mark", name: "玄雷印记", type: "passive", rarity: "rare", lore: "一道未曾消散的雷痕，时刻淬炼持有者的神魂。", bonuses: { damage: .045, defense: 18 }, art: "/game-assets/partners/thunder-lord.webp" },
];

export const cardById = (id: string) => CARDS.find((card) => card.id === id) ?? CARDS[0];

export function addAttributes(base: HeroAttributes, ...bonuses: Array<AttributeBonus | undefined>): HeroAttributes {
  const result = { ...base };
  for (const bonus of bonuses) if (bonus) for (const key of Object.keys(bonus) as Array<keyof HeroAttributes>) result[key] += bonus[key] ?? 0;
  result.dodge = Math.min(.6, result.dodge);
  result.damage = Math.max(.1, result.damage);
  result.expGain = Math.max(.1, result.expGain);
  return result;
}

export function formatBonus(bonus: AttributeBonus) {
  const labels: Record<keyof HeroAttributes, string> = { health: "生命", defense: "防御", damage: "伤害", dodge: "闪避", moveSpeed: "移速", expGain: "经验", attackSpeed: "攻速", projectileSpeed: "弹速" };
  return (Object.keys(bonus) as Array<keyof HeroAttributes>).map((key) => {
    const value = bonus[key] ?? 0;
    return `${labels[key]} +${["damage", "dodge", "expGain", "attackSpeed", "projectileSpeed"].includes(key) ? `${Math.round(value * 100)}%` : Math.round(value)}`;
  });
}
