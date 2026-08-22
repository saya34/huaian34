import { InventorySize, RunResult, TreasureItem, placeItems, treasureById } from "./expedition";
import {
  BASE_HERO_ATTRIBUTES,
  CARDS,
  EQUIPMENT,
  EquipmentItem,
  EquipmentSlot,
  HeroAttributes,
  AttributeAllocation,
  addAttributes,
  attributeAllocationBonus,
  cardById,
  equipmentById,
  passiveAttributeBonuses,
} from "./progression";
import { DEFAULT_WM_CONFIG, WMConfig, cloneWMConfig, managedTreasureDefinition, mergeWMConfig } from "./weaponManager";
import {
  MAX_SKILL_MASTERY_LEVEL,
  SKILL_BOOK_EXP,
  SKILL_MANUALS,
  SkillMasteryMap,
  defaultSkillMastery,
  normalizeSkillMastery,
  skillMasteryExpToNext,
  skillUnlockReady,
} from "./skillMastery";

export interface MetaProgress {
  version: 4;
  spiritStones: number;
  backpackLevel: number;
  safeLevel: number;
  warehouseLevel: number;
  warehouse: TreasureItem[];
  discovered: string[];
  baseAttributes: HeroAttributes;
  equipmentBag: EquipmentItem[];
  equipped: Partial<Record<EquipmentSlot, string>>;
  ownedCards: string[];
  cardSlots: Array<string | null>;
  cardSlotCount: number;
  playerLevel: number;
  playerExp: number;
  highestUnlockedWave: number;
  attributeAllocation: AttributeAllocation;
  passiveRanks: Record<string, number>;
  skillBooks: number;
  skillMastery: SkillMasteryMap;
  wmDraft: WMConfig;
  wmPublished: WMConfig;
  wmPublishedAt: number;
}

const STORAGE_KEY = "blcx-expedition-meta-v1";

const STARTER_EQUIPMENT = EQUIPMENT.map((item) => ({ uid: `gear-${item.id}`, equipmentId: item.id }));

export const DEFAULT_META: MetaProgress = {
  version: 4,
  spiritStones: 0,
  backpackLevel: 0,
  safeLevel: 0,
  warehouseLevel: 0,
  warehouse: [],
  discovered: [],
  baseAttributes: { ...BASE_HERO_ATTRIBUTES },
  equipmentBag: STARTER_EQUIPMENT,
  equipped: {},
  ownedCards: [],
  cardSlots: [null, null, null],
  cardSlotCount: 1,
  playerLevel: 1,
  playerExp: 0,
  highestUnlockedWave: 1,
  attributeAllocation: { health: 0, defense: 0, damage: 0, dodge: 0, moveSpeed: 0, attackSpeed: 0 },
  passiveRanks: {},
  skillBooks: 24,
  skillMastery: defaultSkillMastery(),
  wmDraft: cloneWMConfig(DEFAULT_WM_CONFIG),
  wmPublished: cloneWMConfig(DEFAULT_WM_CONFIG),
  wmPublishedAt: 0,
};

export function backpackSize(level: number): InventorySize {
  return { columns: Math.min(6, 4 + Math.floor(level / 2)), rows: Math.min(5, 4 + Math.ceil(level / 2)) };
}

export function safeSize(level: number): InventorySize {
  return level >= 2 ? { columns: 3, rows: 3 } : level >= 1 ? { columns: 3, rows: 2 } : { columns: 2, rows: 2 };
}

export function warehouseSize(level: number): InventorySize {
  return { columns: Math.min(10, 6 + level), rows: Math.min(8, 6 + Math.floor(level / 2)) };
}

export function upgradeCost(kind: "backpack" | "safe" | "warehouse", level: number) {
  const base = kind === "safe" ? 2200 : kind === "backpack" ? 900 : 650;
  return Math.round(base * (level + 1) ** 1.55);
}

export function loadMetaProgress(): MetaProgress {
  if (typeof window === "undefined") return cloneDefaultMeta();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "") as Partial<MetaProgress>;
    return {
      ...cloneDefaultMeta(),
      ...parsed,
      version: 4,
      warehouse: Array.isArray(parsed.warehouse) ? parsed.warehouse : [],
      discovered: Array.isArray(parsed.discovered) ? parsed.discovered : [],
      baseAttributes: { ...BASE_HERO_ATTRIBUTES, ...(parsed.baseAttributes ?? {}) },
      equipmentBag: Array.isArray(parsed.equipmentBag) ? parsed.equipmentBag : STARTER_EQUIPMENT,
      equipped: parsed.equipped && typeof parsed.equipped === "object" ? parsed.equipped : {},
      ownedCards: Array.isArray(parsed.ownedCards) ? parsed.ownedCards.filter((id) => CARDS.some((card) => card.id === id)) : [],
      cardSlots: normalizeCardSlots(parsed.cardSlots),
      cardSlotCount: Math.max(1, Math.min(3, Number(parsed.cardSlotCount) || 1)),
      playerLevel: Math.max(1, Math.min(60, Number(parsed.playerLevel) || 1)),
      playerExp: Math.max(0, Number(parsed.playerExp) || 0),
      highestUnlockedWave: Math.max(1, Math.min(21, Number(parsed.highestUnlockedWave) || 1)),
      attributeAllocation: { ...DEFAULT_META.attributeAllocation, ...(parsed.attributeAllocation ?? {}) },
      passiveRanks: parsed.passiveRanks && typeof parsed.passiveRanks === "object" ? parsed.passiveRanks : {},
      skillBooks: parsed.skillBooks === undefined ? DEFAULT_META.skillBooks : Math.max(0, Number(parsed.skillBooks) || 0),
      skillMastery: normalizeSkillMastery(parsed.skillMastery),
      wmDraft: mergeWMConfig(parsed.wmDraft),
      wmPublished: mergeWMConfig(parsed.wmPublished),
      wmPublishedAt: Math.max(0, Number(parsed.wmPublishedAt) || 0),
    };
  } catch {
    return cloneDefaultMeta();
  }
}

function cloneDefaultMeta(): MetaProgress {
  return {
    ...DEFAULT_META,
    baseAttributes: { ...DEFAULT_META.baseAttributes },
    equipmentBag: DEFAULT_META.equipmentBag.map((item) => ({ ...item })),
    equipped: { ...DEFAULT_META.equipped },
    ownedCards: [...DEFAULT_META.ownedCards],
    cardSlots: [...DEFAULT_META.cardSlots],
    attributeAllocation: { ...DEFAULT_META.attributeAllocation },
    passiveRanks: { ...DEFAULT_META.passiveRanks },
    skillMastery: normalizeSkillMastery(DEFAULT_META.skillMastery),
    wmDraft: cloneWMConfig(DEFAULT_META.wmDraft),
    wmPublished: cloneWMConfig(DEFAULT_META.wmPublished),
  };
}

function normalizeCardSlots(value: unknown): Array<string | null> {
  const slots = Array.isArray(value) ? value.slice(0, 3) : [];
  while (slots.length < 3) slots.push(null);
  return slots.map((id) => typeof id === "string" && CARDS.some((card) => card.id === id && card.type === "insert") ? id : null);
}

export function computePermanentAttributes(meta: MetaProgress): HeroAttributes {
  const equipmentBonuses = Object.values(meta.equipped).map((uid) => {
    const item = meta.equipmentBag.find((entry) => entry.uid === uid);
    return item ? item.bonuses ?? equipmentById(item.equipmentId).bonuses : undefined;
  });
  const passiveBonuses = meta.ownedCards
    .map(cardById)
    .filter((card) => card.type === "passive")
    .map((card) => card.bonuses);
  const insertedBonuses = meta.cardSlots
    .slice(0, meta.cardSlotCount)
    .filter((id): id is string => Boolean(id))
    .map((id) => cardById(id).bonuses);
  return addAttributes(
    meta.baseAttributes,
    attributeAllocationBonus(meta.attributeAllocation),
    ...passiveAttributeBonuses(meta.passiveRanks),
    ...equipmentBonuses,
    ...passiveBonuses,
    ...insertedBonuses,
  );
}

export const MAX_PLAYER_LEVEL = 60;

export function stageClearExperience(waveId: number) {
  return Math.round(100 * 1.18 ** Math.max(0, Math.min(20, waveId - 1)));
}

export function experienceToNextLevel(level: number) {
  if (level >= MAX_PLAYER_LEVEL) return 0;
  const matchingWave = 1 + Math.round((level - 1) * 20 / (MAX_PLAYER_LEVEL - 2));
  const desiredClears = 1 + 9 * (level - 1) / (MAX_PLAYER_LEVEL - 2);
  return Math.round(stageClearExperience(matchingWave) * desiredClears);
}

export function awardClearExperience(meta: MetaProgress, waveId: number) {
  const gained = Math.round(stageClearExperience(waveId) * computePermanentAttributes(meta).expGain);
  let playerLevel = meta.playerLevel;
  let playerExp = meta.playerExp + gained;
  let levelsGained = 0;
  while (playerLevel < MAX_PLAYER_LEVEL) {
    const needed = experienceToNextLevel(playerLevel);
    if (playerExp < needed) break;
    playerExp -= needed;
    playerLevel++;
    levelsGained++;
  }
  if (playerLevel >= MAX_PLAYER_LEVEL) playerExp = 0;
  return {
    meta: { ...meta, playerLevel, playerExp, highestUnlockedWave: Math.max(meta.highestUnlockedWave, Math.min(21, waveId + 1)) },
    gained,
    levelsGained,
  };
}

export function availableAttributePoints(meta: MetaProgress) {
  return meta.playerLevel * 5 - Object.values(meta.attributeAllocation).reduce((sum, value) => sum + value, 0);
}

export function availableSkillPoints(meta: MetaProgress) {
  return meta.playerLevel - Object.values(meta.passiveRanks).reduce((sum, value) => sum + value, 0);
}

export function learnMetaSkill(meta: MetaProgress, skillId: number): MetaProgress {
  const manual = SKILL_MANUALS.find((entry) => entry.baseId === skillId);
  const current = meta.skillMastery[String(skillId)];
  if (!manual || current?.learned || !skillUnlockReady(meta.playerLevel, meta.highestUnlockedWave, manual)) return meta;
  return {
    ...meta,
    skillMastery: {
      ...meta.skillMastery,
      [String(skillId)]: { ...current, learned: true, level: Math.max(1, current?.level ?? 1), exp: Math.max(0, current?.exp ?? 0) },
    },
  };
}

export function feedSkillExperience(meta: MetaProgress, skillId: number, requestedBooks = 1): MetaProgress {
  const key = String(skillId);
  const current = meta.skillMastery[key];
  if (!current?.learned || current.level >= MAX_SKILL_MASTERY_LEVEL || meta.skillBooks <= 0) return meta;
  const usedBooks = Math.max(0, Math.min(meta.skillBooks, Math.floor(requestedBooks)));
  if (!usedBooks) return meta;
  let level = current.level;
  let exp = current.exp + usedBooks * SKILL_BOOK_EXP;
  while (level < MAX_SKILL_MASTERY_LEVEL) {
    const needed = skillMasteryExpToNext(level);
    if (exp < needed) break;
    exp -= needed;
    level++;
  }
  if (level >= MAX_SKILL_MASTERY_LEVEL) exp = 0;
  return {
    ...meta,
    skillBooks: meta.skillBooks - usedBooks,
    skillMastery: { ...meta.skillMastery, [key]: { ...current, level, exp } },
  };
}

export function awardSkillBooks(meta: MetaProgress, result: RunResult, waveId: number) {
  const gained = result === "victory" ? 2 + Math.ceil(Math.max(1, waveId) / 4) : result === "extracted" ? 1 : 0;
  return { meta: gained ? { ...meta, skillBooks: meta.skillBooks + gained } : meta, gained };
}

export function equipItem(meta: MetaProgress, uid: string): MetaProgress {
  const item = meta.equipmentBag.find((entry) => entry.uid === uid);
  if (!item) return meta;
  const slot = equipmentById(item.equipmentId).slot;
  return { ...meta, equipped: { ...meta.equipped, [slot]: uid } };
}

export function unequipItem(meta: MetaProgress, slot: EquipmentSlot): MetaProgress {
  const equipped = { ...meta.equipped };
  delete equipped[slot];
  return { ...meta, equipped };
}

export function equipCard(meta: MetaProgress, cardId: string, slotIndex: number): MetaProgress {
  if (slotIndex < 0 || slotIndex >= meta.cardSlotCount || !meta.ownedCards.includes(cardId) || cardById(cardId).type !== "insert") return meta;
  const cardSlots = meta.cardSlots.map((id) => id === cardId ? null : id);
  cardSlots[slotIndex] = cardId;
  return { ...meta, cardSlots };
}

export function unequipCard(meta: MetaProgress, slotIndex: number): MetaProgress {
  if (slotIndex < 0 || slotIndex >= meta.cardSlotCount) return meta;
  const cardSlots = [...meta.cardSlots];
  cardSlots[slotIndex] = null;
  return { ...meta, cardSlots };
}

export function saveMetaProgress(meta: MetaProgress) {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

export function settleExpedition(
  meta: MetaProgress,
  result: RunResult,
  backpack: TreasureItem[],
  safeBox: TreasureItem[],
  runEquipment: EquipmentItem[] = [],
) {
  const broughtOut = result === "defeat" ? safeBox : [...backpack, ...safeBox];
  const size = warehouseSize(meta.warehouseLevel);
  const accepted: TreasureItem[] = [];
  for (const item of broughtOut) {
    const normalized = { uid: item.uid, treasureId: item.treasureId };
    if (placeItems([...meta.warehouse, ...accepted, normalized], size)) accepted.push(normalized);
  }
  const discovered = new Set(meta.discovered);
  accepted.forEach((item) => discovered.add(item.treasureId));
  const keptEquipment = result === "defeat" ? [] : runEquipment;
  return {
    meta: { ...meta, warehouse: [...meta.warehouse, ...accepted], discovered: [...discovered], equipmentBag: [...meta.equipmentBag, ...keptEquipment] },
    accepted,
    overflow: broughtOut.filter((item) => !accepted.includes(item)),
  };
}

export function sellTreasure(meta: MetaProgress, uid: string) {
  const item = meta.warehouse.find((entry) => entry.uid === uid);
  if (!item) return meta;
  return {
    ...meta,
    spiritStones: meta.spiritStones + managedTreasureDefinition(meta.wmPublished, item.treasureId).value,
    warehouse: meta.warehouse.filter((entry) => entry.uid !== uid),
  };
}
