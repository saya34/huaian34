import { InventorySize, PlacedTreasure, RunResult, TreasureItem, firstTreasurePosition, organizeTreasures, placeItems } from "./expedition";
import {
  BASE_HERO_ATTRIBUTES,
  CARDS,
  EquipmentItem,
  EquipmentPosition,
  EquipmentBodySlot,
  HeroAttributes,
  AttributeAllocation,
  addAttributes,
  attributeAllocationBonus,
  cardById,
  equipmentById,
  canUseEquipment,
  equipmentAttributeBonus,
  equipmentValue,
  passiveAttributeBonuses,
} from "./progression";
import { CULTIVATOR_PACK_SIZE, PERSONAL_STASH_SIZE, findEquipmentPosition, moveOrSwapEquipment, organizeEquipment } from "./inventorySystem";
import { DEFAULT_WM_CONFIG, WMConfig, cloneWMConfig, managedTreasureDefinition, mergeWMConfig } from "./weaponManager";
import { EMPTY_WEAPON_SHOP, normalizeWeaponShop, type WeaponShopState } from "./weaponShop";
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
  version: 5;
  spiritStones: number;
  backpackLevel: number;
  safeLevel: number;
  warehouseLevel: number;
  personalBackpack: PlacedTreasure[];
  warehouse: PlacedTreasure[];
  discovered: string[];
  baseAttributes: HeroAttributes;
  equipmentBag: EquipmentItem[];
  equipmentPositions: Record<string, EquipmentPosition>;
  equipped: Partial<Record<EquipmentBodySlot, string>>;
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
  weaponShop: WeaponShopState;
}

const STORAGE_KEY = "blcx-expedition-meta-v1";

const STARTER_IDS = ["iron-crown", "linen-robe", "leather-bracers", "traveler-trousers", "straw-sandals", "iron-sabre"];
const STARTER_EQUIPMENT: EquipmentItem[] = STARTER_IDS.map((id) => ({ uid: `gear-${id}`, equipmentId: id, identified: true }));
const STARTER_POSITIONS = organizeEquipment(STARTER_EQUIPMENT, CULTIVATOR_PACK_SIZE) ?? {};

export const DEFAULT_META: MetaProgress = {
  version: 5,
  spiritStones: 0,
  backpackLevel: 0,
  safeLevel: 0,
  warehouseLevel: 0,
  personalBackpack: [],
  warehouse: [],
  discovered: [],
  baseAttributes: { ...BASE_HERO_ATTRIBUTES },
  equipmentBag: STARTER_EQUIPMENT,
  equipmentPositions: STARTER_POSITIONS,
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
  weaponShop: { ...EMPTY_WEAPON_SHOP, stock: [], buyback: [] },
};

export function backpackSize(level: number): InventorySize {
  void level;
  return CULTIVATOR_PACK_SIZE;
}

export function safeSize(level: number): InventorySize {
  return level >= 2 ? { columns: 3, rows: 3 } : level >= 1 ? { columns: 3, rows: 2 } : { columns: 2, rows: 2 };
}

export function warehouseSize(level: number, items: TreasureItem[] = []): InventorySize {
  let size = { columns: PERSONAL_STASH_SIZE.columns, rows: PERSONAL_STASH_SIZE.rows + Math.max(0, Math.min(6, level)) * 2 };
  while (size.rows < 60 && items.length && !placeItems(items, size)) size = { ...size, rows: size.rows + 2 };
  return size;
}

export function upgradeCost(kind: "backpack" | "safe" | "warehouse", level: number) {
  const base = kind === "safe" ? 2200 : kind === "backpack" ? 900 : 650;
  return Math.round(base * (level + 1) ** 1.55);
}

function normalizeTreasureGrid(value: unknown, size: InventorySize): PlacedTreasure[] {
  if (!Array.isArray(value)) return [];
  const items = value.filter((item): item is TreasureItem => Boolean(item && typeof item === "object" && typeof (item as TreasureItem).uid === "string" && typeof (item as TreasureItem).treasureId === "string"));
  return organizeTreasures(items, size) ?? [];
}

function normalizeEquipmentGrid(
  items: EquipmentItem[],
  equipped: Partial<Record<EquipmentBodySlot, string>> | undefined,
  saved: Record<string, EquipmentPosition> | undefined,
) {
  const equippedIds = new Set(Object.values(equipped ?? {}).filter(Boolean));
  const stored = items.filter((item) => !equippedIds.has(item.uid));
  const organized = organizeEquipment(stored, CULTIVATOR_PACK_SIZE);
  if (organized) return organized;
  const positions: Record<string, EquipmentPosition> = {};
  const placed: EquipmentItem[] = [];
  for (const item of stored) {
    const previous = saved?.[item.uid];
    const position = previous ?? findEquipmentPosition(placed, positions, item, CULTIVATOR_PACK_SIZE);
    if (!position) continue;
    positions[item.uid] = position;
    placed.push(item);
  }
  return positions;
}

export function loadMetaProgress(): MetaProgress {
  if (typeof window === "undefined") return cloneDefaultMeta();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "") as Partial<MetaProgress>;
    return normalizeMetaProgress(parsed);
  } catch {
    return cloneDefaultMeta();
  }
}

export function normalizeMetaProgress(parsed: Partial<MetaProgress> | null | undefined): MetaProgress {
  const value = parsed ?? {};
  const warehouseItems = Array.isArray(value.warehouse) ? value.warehouse : [];
  const legacyStarterCatalog = value.version !== 5 && Array.isArray(value.equipmentBag) && value.equipmentBag.length > 20 && value.equipmentBag.every((item) => item.uid.startsWith("gear-"));
  const equipmentBag = legacyStarterCatalog ? STARTER_EQUIPMENT : Array.isArray(value.equipmentBag) ? value.equipmentBag : STARTER_EQUIPMENT;
  const equipped = legacyStarterCatalog ? {} : value.equipped && typeof value.equipped === "object" ? value.equipped : {};
  return {
    ...cloneDefaultMeta(), ...value, version: 5,
    personalBackpack: normalizeTreasureGrid(value.personalBackpack, CULTIVATOR_PACK_SIZE),
    warehouse: normalizeTreasureGrid(warehouseItems, warehouseSize(Number(value.warehouseLevel) || 0, warehouseItems)),
    discovered: Array.isArray(value.discovered) ? value.discovered : [],
    baseAttributes: { ...BASE_HERO_ATTRIBUTES, ...(value.baseAttributes ?? {}) },
    equipmentBag,
    equipmentPositions: normalizeEquipmentGrid(equipmentBag, equipped, value.equipmentPositions),
    equipped,
    ownedCards: Array.isArray(value.ownedCards) ? value.ownedCards.filter((id) => CARDS.some((card) => card.id === id)) : [],
    cardSlots: normalizeCardSlots(value.cardSlots),
    cardSlotCount: Math.max(1, Math.min(3, Number(value.cardSlotCount) || 1)),
    playerLevel: Math.max(1, Math.min(60, Number(value.playerLevel) || 1)),
    playerExp: Math.max(0, Number(value.playerExp) || 0),
    highestUnlockedWave: Math.max(1, Math.min(21, Number(value.highestUnlockedWave) || 1)),
    attributeAllocation: { ...DEFAULT_META.attributeAllocation, ...(value.attributeAllocation ?? {}) },
    passiveRanks: value.passiveRanks && typeof value.passiveRanks === "object" ? value.passiveRanks : {},
    skillBooks: value.skillBooks === undefined ? DEFAULT_META.skillBooks : Math.max(0, Number(value.skillBooks) || 0),
    skillMastery: normalizeSkillMastery(value.skillMastery), wmDraft: mergeWMConfig(value.wmDraft), wmPublished: mergeWMConfig(value.wmPublished), wmPublishedAt: Math.max(0, Number(value.wmPublishedAt) || 0), weaponShop: normalizeWeaponShop(value.weaponShop),
  };
}

function cloneDefaultMeta(): MetaProgress {
  return {
    ...DEFAULT_META,
    baseAttributes: { ...DEFAULT_META.baseAttributes },
    equipmentBag: DEFAULT_META.equipmentBag.map((item) => ({ ...item })),
    equipmentPositions: { ...DEFAULT_META.equipmentPositions },
    personalBackpack: DEFAULT_META.personalBackpack.map((item) => ({ ...item })),
    warehouse: DEFAULT_META.warehouse.map((item) => ({ ...item })),
    equipped: { ...DEFAULT_META.equipped },
    ownedCards: [...DEFAULT_META.ownedCards],
    cardSlots: [...DEFAULT_META.cardSlots],
    attributeAllocation: { ...DEFAULT_META.attributeAllocation },
    passiveRanks: { ...DEFAULT_META.passiveRanks },
    skillMastery: normalizeSkillMastery(DEFAULT_META.skillMastery),
    wmDraft: cloneWMConfig(DEFAULT_META.wmDraft),
    wmPublished: cloneWMConfig(DEFAULT_META.wmPublished),
    weaponShop: { ...DEFAULT_META.weaponShop, stock: DEFAULT_META.weaponShop.stock.map((item) => ({ ...item })), buyback: DEFAULT_META.weaponShop.buyback.map((item) => ({ ...item })) },
  };
}

function normalizeCardSlots(value: unknown): Array<string | null> {
  const slots = Array.isArray(value) ? value.slice(0, 3) : [];
  while (slots.length < 3) slots.push(null);
  return slots.map((id) => typeof id === "string" && CARDS.some((card) => card.id === id && card.type === "insert") ? id : null);
}

export function computePermanentAttributes(meta: MetaProgress): HeroAttributes {
  const passiveBonuses = meta.ownedCards
    .map(cardById)
    .filter((card) => card.type === "passive")
    .map((card) => card.bonuses);
  const insertedBonuses = meta.cardSlots
    .slice(0, meta.cardSlotCount)
    .filter((id): id is string => Boolean(id))
    .map((id) => cardById(id).bonuses);
  const root = addAttributes(
    meta.baseAttributes,
    attributeAllocationBonus(meta.attributeAllocation),
    ...passiveAttributeBonuses(meta.passiveRanks),
    ...passiveBonuses,
    ...insertedBonuses,
  );
  const equippedItems = [...new Set(Object.values(meta.equipped).filter((uid): uid is string => Boolean(uid)))]
    .map((uid) => meta.equipmentBag.find((entry) => entry.uid === uid))
    .filter((item): item is EquipmentItem => Boolean(item));
  // 属性要求可以被其他装备加成满足；用有限次稳定迭代还原原作的失效重算语义。
  let attributes = root;
  for (let pass = 0; pass < 4; pass++) {
    const enabled = equippedItems.filter((item) => canUseEquipment(item, attributes));
    const next = addAttributes(root, ...enabled.map(equipmentAttributeBonus));
    if (JSON.stringify(next) === JSON.stringify(attributes)) break;
    attributes = next;
  }
  return attributes;
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

export function tryEquipItem(meta: MetaProgress, uid: string): { meta: MetaProgress; ok: boolean; message: string } {
  const item = meta.equipmentBag.find((entry) => entry.uid === uid);
  if (!item) return { meta, ok: false, message: "法器不存在" };
  const attributes = computePermanentAttributes(meta);
  if (!canUseEquipment(item, attributes)) return { meta, ok: false, message: "体魄、身法或神识不足，无法驱使此法器" };
  const slot = equipmentById(item.equipmentId).slot;
  const targetSlots: EquipmentBodySlot[] = slot === "weapon" && item.twoHanded ? ["weapon", "offhand"] : [slot];
  const displaced = new Set(targetSlots.map((key) => meta.equipped[key]).filter((id): id is string => Boolean(id && id !== uid)));
  const existingAtWeapon = slot === "weapon" ? meta.equipped.weapon : undefined;
  if (existingAtWeapon && existingAtWeapon !== uid && meta.equipped.offhand === existingAtWeapon) displaced.add(existingAtWeapon);

  const inventory = meta.equipmentBag.filter((entry) => meta.equipmentPositions[entry.uid] && entry.uid !== uid && !displaced.has(entry.uid));
  const positions = { ...meta.equipmentPositions };
  delete positions[uid];
  for (const displacedUid of displaced) delete positions[displacedUid];
  const placed = [...inventory];
  for (const displacedUid of displaced) {
    const old = meta.equipmentBag.find((entry) => entry.uid === displacedUid);
    if (!old) continue;
    const position = findEquipmentPosition(placed, positions, old, CULTIVATOR_PACK_SIZE);
    if (!position) return { meta, ok: false, message: "行囊没有空间容纳换下的法器" };
    positions[old.uid] = position;
    placed.push(old);
  }

  const equipped = { ...meta.equipped };
  for (const displacedUid of displaced) for (const key of Object.keys(equipped) as EquipmentBodySlot[]) if (equipped[key] === displacedUid) delete equipped[key];
  if (slot === "weapon" && item.twoHanded) {
    equipped.weapon = uid;
    equipped.offhand = uid;
  } else equipped[slot] = uid;
  return { meta: { ...meta, equipmentPositions: positions, equipped }, ok: true, message: item.twoHanded ? "双手法器已同时占据主手与副手" : "法器已装备" };
}

export function equipItem(meta: MetaProgress, uid: string): MetaProgress {
  return tryEquipItem(meta, uid).meta;
}

export function tryUnequipItem(meta: MetaProgress, slot: EquipmentBodySlot): { meta: MetaProgress; ok: boolean; message: string } {
  const uid = meta.equipped[slot];
  const item = meta.equipmentBag.find((entry) => entry.uid === uid);
  if (!uid || !item) return { meta, ok: false, message: "此部位没有法器" };
  const stored = meta.equipmentBag.filter((entry) => meta.equipmentPositions[entry.uid]);
  const position = findEquipmentPosition(stored, meta.equipmentPositions, item, CULTIVATOR_PACK_SIZE);
  if (!position) return { meta, ok: false, message: "行囊已满，无法卸下法器" };
  const equipped = { ...meta.equipped };
  for (const key of Object.keys(equipped) as EquipmentBodySlot[]) if (equipped[key] === uid) delete equipped[key];
  return { meta: { ...meta, equipmentPositions: { ...meta.equipmentPositions, [uid]: position }, equipped }, ok: true, message: "法器已收入行囊" };
}

export function unequipItem(meta: MetaProgress, slot: EquipmentBodySlot): MetaProgress {
  return tryUnequipItem(meta, slot).meta;
}

export function moveEquipment(meta: MetaProgress, uid: string, x: number, y: number) {
  const stored = meta.equipmentBag.filter((entry) => meta.equipmentPositions[entry.uid]);
  const equipmentPositions = moveOrSwapEquipment(stored, meta.equipmentPositions, uid, x, y, CULTIVATOR_PACK_SIZE);
  return equipmentPositions ? { ...meta, equipmentPositions } : meta;
}

export function sortEquipment(meta: MetaProgress) {
  const stored = meta.equipmentBag.filter((entry) => meta.equipmentPositions[entry.uid]);
  const equipmentPositions = organizeEquipment(stored, CULTIVATOR_PACK_SIZE);
  return equipmentPositions ? { ...meta, equipmentPositions } : meta;
}

export function identifyEquipment(meta: MetaProgress, uid: string) {
  const item = meta.equipmentBag.find((entry) => entry.uid === uid);
  if (!item || item.identified !== false) return { meta, ok: false, message: "此法器无需鉴定" };
  const cost = Math.max(80, Math.round(equipmentValue(item) * .08));
  if (meta.spiritStones < cost) return { meta, ok: false, message: `鉴定需要 ${cost} 灵石` };
  return {
    meta: { ...meta, spiritStones: meta.spiritStones - cost, equipmentBag: meta.equipmentBag.map((entry) => entry.uid === uid ? { ...entry, identified: true } : entry) },
    ok: true,
    message: `鉴定完成，词缀灵力已激活（-${cost} 灵石）`,
  };
}

export function discardEquipment(meta: MetaProgress, uid: string) {
  const item = meta.equipmentBag.find((entry) => entry.uid === uid);
  if (!item) return { meta, ok: false, message: "法器不存在" };
  if (Object.values(meta.equipped).includes(uid)) return { meta, ok: false, message: "请先卸下法器，再进行丢弃" };
  const equipmentPositions = { ...meta.equipmentPositions };
  delete equipmentPositions[uid];
  return {
    meta: { ...meta, equipmentBag: meta.equipmentBag.filter((entry) => entry.uid !== uid), equipmentPositions },
    ok: true,
    message: `${item.name ?? equipmentById(item.equipmentId).name}已丢弃`,
  };
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
  const accepted: TreasureItem[] = broughtOut.map((item) => ({ uid: item.uid, treasureId: item.treasureId }));
  const allWarehouseItems = [...meta.warehouse, ...accepted];
  const size = warehouseSize(meta.warehouseLevel, allWarehouseItems);
  const organizedWarehouse = organizeTreasures(allWarehouseItems, size) ?? meta.warehouse;
  const discovered = new Set(meta.discovered);
  accepted.forEach((item) => discovered.add(item.treasureId));
  const requestedEquipment = result === "defeat" ? [] : runEquipment;
  const equipmentPositions = { ...meta.equipmentPositions };
  const storedEquipment = meta.equipmentBag.filter((entry) => equipmentPositions[entry.uid]);
  const keptEquipment: EquipmentItem[] = [];
  for (const item of requestedEquipment) {
    const position = findEquipmentPosition([...storedEquipment, ...keptEquipment], equipmentPositions, item, CULTIVATOR_PACK_SIZE);
    if (!position) continue;
    equipmentPositions[item.uid] = position;
    keptEquipment.push(item);
  }
  return {
    meta: { ...meta, warehouse: organizedWarehouse, discovered: [...discovered], equipmentBag: [...meta.equipmentBag, ...keptEquipment], equipmentPositions },
    accepted,
    overflow: [],
    equipmentOverflow: requestedEquipment.filter((item) => !keptEquipment.includes(item)),
  };
}

export function transferTreasure(meta: MetaProgress, uid: string, target: "backpack" | "warehouse") {
  const from = target === "backpack" ? meta.warehouse : meta.personalBackpack;
  const to = target === "backpack" ? meta.personalBackpack : meta.warehouse;
  const item = from.find((entry) => entry.uid === uid);
  if (!item) return { meta, ok: false, message: "宝物不存在" };
  const targetSize = target === "backpack" ? CULTIVATOR_PACK_SIZE : warehouseSize(meta.warehouseLevel, [...to, item]);
  const position = firstTreasurePosition(to, item, targetSize);
  if (!position) return { meta, ok: false, message: target === "backpack" ? "10×4 行囊已满" : "个人仓库已满" };
  const nextFrom = from.filter((entry) => entry.uid !== uid);
  const nextTo = [...to, { ...item, ...position }];
  return {
    meta: { ...meta, personalBackpack: target === "backpack" ? nextTo : nextFrom, warehouse: target === "warehouse" ? nextTo : nextFrom },
    ok: true,
    message: target === "backpack" ? "已转入随身行囊" : "已存入个人仓库",
  };
}

export function sortTreasureContainer(meta: MetaProgress, target: "backpack" | "warehouse") {
  const items = target === "backpack" ? meta.personalBackpack : meta.warehouse;
  const size = target === "backpack" ? CULTIVATOR_PACK_SIZE : warehouseSize(meta.warehouseLevel, items);
  const organized = organizeTreasures(items, size);
  if (!organized) return meta;
  return target === "backpack" ? { ...meta, personalBackpack: organized } : { ...meta, warehouse: organized };
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
