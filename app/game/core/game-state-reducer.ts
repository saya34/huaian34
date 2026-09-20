import { MATERIALS } from "../alchemy/item-data";
import { findEquipmentPosition } from "../battle/inventorySystem";
import { learnMetaSkill } from "../battle/meta";
import type { GearRarity } from "../battle/progression";
import { gatheringItemById } from "../gathering/content";
import { ACTION_COSTS } from "./action-service";
import { upsertCard } from "./card-service";
import { inventoryProjection } from "./inventory-service";
import { grantPlayerExperience, type PlayerGrowth } from "./progression-service";
import type { GameEffect, UnifiedGameState } from "./types";

export function projectGrowth(state: UnifiedGameState, growth: PlayerGrowth): UnifiedGameState {
  const shared = { ...state.shared, ...growth };
  return {
    ...state,
    shared,
    romance: {
      ...state.romance,
      playerLevel: growth.playerLevel,
      experience: growth.playerExperience,
      spiritStones: shared.spiritStones,
      stamina: shared.stamina,
      teacherSkillRanks: state.battle.passiveRanks,
      learnedSkillIds: shared.learnedSkills,
      ownedCardIds: shared.cards.map((card) => card.id),
      completedDungeons: state.dungeons.completed,
      alchemyResults: Object.values(state.alchemy.productStacks).filter((stack) => stack.count > 0).map((stack) => stack.productId),
      inventoryRarities: Object.fromEntries(Object.entries(shared.items).map(([id, item]) => [id, item.rarity])),
      inventoryItems: inventoryProjection(shared.items),
    },
    battle: { ...state.battle, spiritStones: shared.spiritStones, playerLevel: growth.playerLevel, playerExp: growth.playerExperience },
  };
}

export function reduceGameEffect(next: UnifiedGameState, effect: GameEffect): UnifiedGameState {
  if (effect.type === "add_currency") {
    const spiritStones = Math.max(0, next.shared.spiritStones + effect.amount);
    return { ...next, shared: { ...next.shared, spiritStones }, romance: { ...next.romance, spiritStones }, battle: { ...next.battle, spiritStones } };
  }
  if (effect.type === "spend_stamina") {
    const stamina = Math.max(0, next.shared.stamina - effect.amount);
    return { ...next, shared: { ...next.shared, stamina }, romance: { ...next.romance, stamina } };
  }
  if (effect.type === "restore_stamina") {
    const stamina = Math.min(10, Math.max(0, next.shared.stamina + effect.amount));
    return { ...next, shared: { ...next.shared, stamina }, romance: { ...next.romance, stamina } };
  }
  if (effect.type === "add_luck") {
    const current = next.shared.luck;
    const luck = {
      bonus: Math.max(current.bonus, effect.bonus),
      charges: Math.min(9, current.charges + Math.max(0, effect.charges)),
      source: effect.source,
    };
    return { ...next, shared: { ...next.shared, luck } };
  }
  if (effect.type === "consume_luck_charge") {
    if (next.shared.luck.charges <= 0) return next;
    const charges = next.shared.luck.charges - 1;
    return { ...next, shared: { ...next.shared, luck: { ...next.shared.luck, charges, bonus: charges > 0 ? next.shared.luck.bonus : 0, source: charges > 0 ? next.shared.luck.source : "" } } };
  }
  if (effect.type === "add_item") {
    const previous = next.shared.items[effect.item.itemId];
    const item = { ...effect.item, amount: (previous?.amount ?? 0) + effect.item.amount };
    const isAlchemyMaterial = MATERIALS.some((entry) => entry.id === item.itemId);
    const romance = item.itemType === "gift" ? { ...next.romance, inventory: { ...next.romance.inventory, [item.itemId]: (next.romance.inventory[item.itemId] ?? 0) + effect.item.amount } } : next.romance;
    let battle = next.battle;
    const gatheringEquipment = item.itemType === "equipment" ? gatheringItemById(item.itemId) : undefined;
    if (gatheringEquipment?.equipmentId && effect.item.amount > 0) {
      const rarityByTier: GearRarity[] = ["common", "common", "fine", "rare", "epic", "immortal"];
      for (let index = 0; index < effect.item.amount; index += 1) {
        const equipment = { uid: `gathering-${gatheringEquipment.id}-${next.updatedAt}-${battle.equipmentBag.length}-${index}`, equipmentId: gatheringEquipment.equipmentId, name: gatheringEquipment.name, description: gatheringEquipment.description, art: gatheringEquipment.art, price: gatheringEquipment.value, rarity: rarityByTier[gatheringEquipment.rarity] ?? "common", identified: true };
        const position = findEquipmentPosition(battle.equipmentBag, battle.equipmentPositions, equipment);
        if (position) battle = { ...battle, equipmentBag: [...battle.equipmentBag, equipment], equipmentPositions: { ...battle.equipmentPositions, [equipment.uid]: position } };
      }
    }
    const items = { ...next.shared.items, [item.itemId]: item };
    return { ...next, romance: { ...romance, inventoryItems: inventoryProjection(items), inventoryRarities: Object.fromEntries(Object.entries(items).map(([id, entry]) => [id, entry.rarity])) }, battle, shared: { ...next.shared, items }, alchemy: isAlchemyMaterial ? { ...next.alchemy, materialCounts: { ...next.alchemy.materialCounts, [item.itemId]: (next.alchemy.materialCounts[item.itemId] ?? 0) + effect.item.amount } } : next.alchemy };
  }
  if (effect.type === "remove_item") {
    const previous = next.shared.items[effect.itemId];
    if (!previous) return next;
    const amount = Math.max(0, previous.amount - effect.amount);
    const isAlchemyMaterial = MATERIALS.some((entry) => entry.id === effect.itemId);
    let alchemy = isAlchemyMaterial ? { ...next.alchemy, materialCounts: { ...next.alchemy.materialCounts, [effect.itemId]: amount } } : next.alchemy;
    if (previous.sourceTags.includes("alchemy-product") && effect.itemId.startsWith("alchemy:")) {
      const stackKey = effect.itemId.slice("alchemy:".length);
      const stack = alchemy.productStacks[stackKey];
      if (stack) alchemy = { ...alchemy, productStacks: { ...alchemy.productStacks, [stackKey]: { ...stack, count: amount } } };
    }
    const items = { ...next.shared.items, [effect.itemId]: { ...previous, amount } };
    const romance = previous.itemType === "gift" ? { ...next.romance, inventory: { ...next.romance.inventory, [effect.itemId]: amount } } : next.romance;
    return { ...next, romance: { ...romance, inventoryItems: inventoryProjection(items), inventoryRarities: Object.fromEntries(Object.entries(items).map(([id, entry]) => [id, entry.rarity])) }, shared: { ...next.shared, items }, alchemy };
  }
  if (effect.type === "add_card") {
    const cards = upsertCard(next.shared.cards, effect.card);
    return { ...next, shared: { ...next.shared, cards }, romance: { ...next.romance, ownedCardIds: cards.map((card) => card.id) } };
  }
  if (effect.type === "learn_skill") {
    const battle = learnMetaSkill(next.battle, effect.skillId, true);
    const learnedSkills = Object.entries(battle.skillMastery).filter(([, value]) => value.learned).map(([id]) => Number(id));
    return { ...next, battle, shared: { ...next.shared, learnedSkills }, romance: { ...next.romance, learnedSkillIds: learnedSkills } };
  }
  if (effect.type === "add_relationship") return { ...next, romance: { ...next.romance, relationships: { ...next.romance.relationships, [effect.characterId]: Math.max(0, Math.min(100, (next.romance.relationships[effect.characterId] ?? 0) + effect.amount)) } } };
  if (effect.type === "add_player_exp") return projectGrowth(next, grantPlayerExperience(next.shared, effect.amount));
  if (effect.type === "set_global_key") return { ...next, shared: { ...next.shared, globalKeys: { ...next.shared.globalKeys, [effect.key]: effect.value } }, romance: { ...next.romance, flags: { ...next.romance.flags, [effect.key]: effect.value } } };
  if (effect.type === "reveal_dungeon") return { ...next, dungeons: { ...next.dungeons, randomVisible: [...new Set([...next.dungeons.randomVisible, effect.dungeonId])] } };
  if (effect.type === "complete_dungeon") {
    const settled = effect.result !== "defeat";
    const completed = effect.result === "victory" ? [...new Set([...next.dungeons.completed, effect.waveId])] : next.dungeons.completed;
    const highestUnlocked = effect.result === "victory" ? Math.max(next.dungeons.highestUnlocked, Math.min(21, effect.waveId + 1)) : next.dungeons.highestUnlocked;
    const periods = ["清晨", "上午", "午后", "黄昏", "夜晚", "深夜"] as const;
    const currentPeriodIndex = Math.max(0, periods.indexOf(next.romance.period));
    const wrapsToNextDay = currentPeriodIndex === periods.length - 1;
    const period = settled ? periods[(currentPeriodIndex + ACTION_COSTS.battle.timeStages) % periods.length] : next.romance.period;
    const day = next.romance.day + (settled && wrapsToNextDay ? 1 : 0);
    const stamina = settled ? Math.max(0, next.shared.stamina - ACTION_COSTS.battle.stamina) : next.shared.stamina;
    return {
      ...next,
      dungeons: { ...next.dungeons, completed, highestUnlocked, lastSettlement: effect.result },
      shared: { ...next.shared, stamina },
      romance: { ...next.romance, day, period, stamina, completedDungeons: completed, medicineShortage: effect.result === "victory" && next.romance.medicineShortage.status === "active" ? { ...next.romance.medicineShortage, battleVictories: next.romance.medicineShortage.battleVictories + 1 } : next.romance.medicineShortage },
      battle: { ...next.battle, highestUnlockedWave: highestUnlocked },
    };
  }
  if (effect.type === "record_activity") {
    const history = [effect.receipt, ...next.activity.history.filter((receipt) => receipt.id !== effect.receipt.id)].slice(0, 40);
    return { ...next, activity: { last: effect.receipt, history } };
  }
  if (effect.type === "clear_activity") return { ...next, activity: { history: next.activity.history } };
  return next;
}

export function reduceGameEffects(state: UnifiedGameState, effects: GameEffect[]) {
  return effects.reduce(reduceGameEffect, state);
}
