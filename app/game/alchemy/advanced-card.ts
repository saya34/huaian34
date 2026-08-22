import { CharacterId } from "./item-data";

export type MythicOptionPage = "character" | "outfit" | "action" | "scene";
export type MythicOptionTier = "permanent" | "unlocked" | "rare";

export type MythicCardOption = {
  id: string;
  page: MythicOptionPage;
  label: string;
  subtitle: string;
  tier: MythicOptionTier;
  unlocked: boolean;
  characterId?: CharacterId;
};

export type MythicCardRecord = {
  id: string;
  createdAt: number;
  optionIds: string[];
};

export type FatedCharacterCardRecord = {
  id: string;
  createdAt: number;
  origin: "fated";
  profileId: CharacterId;
  image: string;
  chance: number;
  targeted: boolean;
};

export type CharacterCardRecord = MythicCardRecord | FatedCharacterCardRecord;

export function isMythicCardRecord(card: CharacterCardRecord): card is MythicCardRecord {
  return "optionIds" in card;
}

export const MYTHIC_OPTION_PAGES: Array<{ id: MythicOptionPage; label: string; seal: string }> = [
  { id: "character", label: "人物页", seal: "命" },
  { id: "outfit", label: "服装页", seal: "衣" },
  { id: "action", label: "动作页", seal: "势" },
  { id: "scene", label: "场景页", seal: "境" },
];

export const MYTHIC_CARD_OPTIONS: MythicCardOption[] = [
  { id: "char-ruoshui", page: "character", label: "师尊·若水", subtitle: "太虚守一", tier: "rare", unlocked: true, characterId: "ruoshui" },
  { id: "char-qingdai", page: "character", label: "师姐·青黛", subtitle: "静水丹心", tier: "permanent", unlocked: true, characterId: "qingdai" },
  { id: "char-mingzhu", page: "character", label: "师妹·明珠", subtitle: "灵药妙心", tier: "permanent", unlocked: true, characterId: "mingzhu" },
  { id: "char-hanyan", page: "character", label: "星命·寒烟", subtitle: "雾隐星痕", tier: "unlocked", unlocked: true, characterId: "hanyan" },
  { id: "char-lingxi", page: "character", label: "剑契·灵汐", subtitle: "剑意通明", tier: "unlocked", unlocked: true, characterId: "lingxi" },

  { id: "outfit-sect", page: "outfit", label: "仙门常服", subtitle: "青绡云纹", tier: "permanent", unlocked: true },
  { id: "outfit-sword", page: "outfit", label: "霜华剑装", subtitle: "银甲轻裘", tier: "permanent", unlocked: true },
  { id: "outfit-casual", page: "outfit", label: "月下便服", subtitle: "素纱薄袖", tier: "permanent", unlocked: true },
  { id: "outfit-maid", page: "outfit", label: "灵厨女仆装", subtitle: "墨裙雪领", tier: "unlocked", unlocked: true },
  { id: "outfit-wedding", page: "outfit", label: "朱霞婚服", subtitle: "金凤织锦", tier: "rare", unlocked: true },
  { id: "outfit-goddess", page: "outfit", label: "九天神女衣", subtitle: "星河为纱", tier: "rare", unlocked: true },
  { id: "outfit-hidden", page: "outfit", label: "太古龙袍", subtitle: "尚未解锁", tier: "unlocked", unlocked: false },

  { id: "action-stand", page: "action", label: "临风而立", subtitle: "衣袂随风", tier: "permanent", unlocked: true },
  { id: "action-sword", page: "action", label: "横剑听雪", subtitle: "剑意凝霜", tier: "permanent", unlocked: true },
  { id: "action-smile", page: "action", label: "回眸浅笑", subtitle: "眸光如月", tier: "permanent", unlocked: true },
  { id: "action-drink", page: "action", label: "月下饮酒", subtitle: "举杯问天", tier: "unlocked", unlocked: true },
  { id: "action-alchemy", page: "action", label: "拈火炼丹", subtitle: "指引玄焰", tier: "unlocked", unlocked: true },
  { id: "action-dance", page: "action", label: "踏星剑舞", subtitle: "星痕成阵", tier: "rare", unlocked: true },
  { id: "action-awaken", page: "action", label: "神格觉醒", subtitle: "万法朝宗", tier: "rare", unlocked: true },

  { id: "scene-mountain", page: "scene", label: "太虚云巅", subtitle: "万山俯首", tier: "permanent", unlocked: true },
  { id: "scene-bamboo", page: "scene", label: "月夜竹林", subtitle: "清辉碎影", tier: "permanent", unlocked: true },
  { id: "scene-chamber", page: "scene", label: "玄火丹房", subtitle: "炉光如昼", tier: "permanent", unlocked: true },
  { id: "scene-tavern", page: "scene", label: "风雪酒肆", subtitle: "一灯待归", tier: "unlocked", unlocked: true },
  { id: "scene-sea", page: "scene", label: "沧海月宫", subtitle: "潮生银阙", tier: "unlocked", unlocked: true },
  { id: "scene-stars", page: "scene", label: "九霄星河", subtitle: "诸天为幕", tier: "rare", unlocked: true },
  { id: "scene-ruins", page: "scene", label: "太古神墟", subtitle: "旧神残梦", tier: "rare", unlocked: true },
];

export const MYTHIC_MAX_OPTIONS = 10;
export const MYTHIC_RARE_MAX_USES = 5;

export function visibleMythicOptions(page: MythicOptionPage) {
  return MYTHIC_CARD_OPTIONS.filter((option) => option.page === page && option.unlocked);
}

export function mythicTierLabel(tier: MythicOptionTier) {
  return tier === "permanent" ? "常驻" : tier === "unlocked" ? "已解锁" : "稀有解锁";
}
