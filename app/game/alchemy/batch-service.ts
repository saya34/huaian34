import { CHARACTER_PROFILES, MATERIALS, MYTHIC_MATERIAL, PRODUCTS, isFatedFlower, isMythicScroll, selectAlchemyResult, selectCharacterOutcome, type RecipeRule } from "./item-data";
import { MYTHIC_CARD_OPTIONS, MYTHIC_MAX_OPTIONS, MYTHIC_RARE_MAX_USES, isMythicCardRecord, type CharacterCardRecord } from "./advanced-card";
import { MUTATIONS, mutationDisplayName, productStackKey, rollMutation, type MutationId } from "./commissions";
import { checkActionAdmission } from "../core/action-service";
import { withAlchemyState } from "../core/alchemy-projection";
import { normalizeCardName } from "../core/card-service";
import { reduceGameEffects } from "../core/game-state-reducer";
import type { UnifiedCardInstance, UnifiedGameState } from "../core/types";

export type AlchemyBatch = {
  id: string;
  startedAt: number;
  readyAt: number;
  ingredientIds: string[];
  productId: string;
  mutation: MutationId;
  card: CharacterCardRecord | null;
};

/** Random results are rolled once, before dispatch; retries never reroll a paid batch. */
export function prepareAlchemyBatch(ingredientIds: string[], rules: RecipeRule[], sequence: number, now: number, optionIds: string[] = []): AlchemyBatch {
  const ingredients = ingredientIds.map((id) => MATERIALS.find((item) => item.id === id) ?? null);
  const mythic = ingredients.some(isMythicScroll);
  const outcome = mythic ? null : selectCharacterOutcome(ingredients, sequence);
  const id = `brew-${now}-${sequence}`;
  const card: CharacterCardRecord | null = mythic
    ? { id, createdAt: now, optionIds: [...optionIds], quality: "神品" }
    : outcome ? { id, createdAt: now, origin: "fated", profileId: outcome.id, image: outcome.image, chance: outcome.chance, targeted: outcome.targeted, quality: "仙品" } : null;
  return { id, startedAt: now, readyAt: now + (mythic || ingredients.some(isFatedFlower) ? 10000 : 8000),
    ingredientIds: mythic ? [MYTHIC_MATERIAL.id] : ingredientIds,
    productId: selectAlchemyResult(ingredients, rules).id, mutation: rollMutation().id, card };
}

export function startAlchemyBatch(state: UnifiedGameState, batch: AlchemyBatch): UnifiedGameState {
  const admission = checkActionAdmission("alchemy", state.shared);
  if (state.alchemy.pendingBatch || !admission.ok || !normalizeAlchemyBatch(batch)) return state;
  const needs: Record<string, number> = {};
  for (const id of batch.ingredientIds) needs[id] = (needs[id] ?? 0) + 1;
  if (Object.entries(needs).some(([id, count]) => (state.alchemy.materialCounts[id] ?? 0) < count)) return state;
  const rareUses = { ...state.alchemy.mythicRareUses };
  if (batch.card && isMythicCardRecord(batch.card)) {
    const options = MYTHIC_CARD_OPTIONS.filter((option) => batch.card && isMythicCardRecord(batch.card) && batch.card.optionIds.includes(option.id));
    if (!options.some((option) => option.page === "character") || options.length > MYTHIC_MAX_OPTIONS || options.some((option) => !option.unlocked)) return state;
    for (const option of options.filter((entry) => entry.tier === "rare")) {
      if ((rareUses[option.id] ?? MYTHIC_RARE_MAX_USES) <= 0) return state;
      rareUses[option.id] = (rareUses[option.id] ?? MYTHIC_RARE_MAX_USES) - 1;
    }
  } else if (batch.ingredientIds.length < 2) return state;
  const materialCounts = { ...state.alchemy.materialCounts };
  for (const [id, count] of Object.entries(needs)) materialCounts[id] -= count;
  return withAlchemyState(reduceGameEffects(state, [{ type: "spend_stamina", amount: admission.cost.stamina }]), {
    ...state.alchemy, materialCounts, mythicRareUses: rareUses, pendingBatch: batch, brewSequence: (state.alchemy.brewSequence ?? 0) + 1,
  });
}

/** Exactly one claim: consuming the pending batch and granting its result are indivisible. */
export function claimAlchemyBatch(state: UnifiedGameState, id: string, now: number): UnifiedGameState {
  const batch = state.alchemy.pendingBatch;
  if (!batch || batch.id !== id || now < batch.readyAt) return state;
  const alchemy = { ...state.alchemy, pendingBatch: null, productStacks: { ...state.alchemy.productStacks }, characterCards: [...state.alchemy.characterCards] };
  const product = PRODUCTS.find((entry) => entry.id === batch.productId)!;
  let card: UnifiedCardInstance | undefined;
  if (batch.card) {
    const record = batch.card;
    if (alchemy.characterCards.some((entry) => entry.id === record.id)) return state;
    alchemy.characterCards.push(record);
    const mythic = isMythicCardRecord(record);
    const profileId = mythic ? MYTHIC_CARD_OPTIONS.find((option) => record.optionIds.includes(option.id) && option.page === "character")?.characterId : record.profileId;
    const profile = CHARACTER_PROFILES.find((entry) => entry.id === profileId);
    card = { id: record.id, characterId: profileId ?? "taichu", name: mythic ? `太初·${profile?.name ?? "人物卡"}` : normalizeCardName(`${profile?.title ?? "命定"}·${profile?.name ?? "人物卡"}`),
      rarity: mythic ? 7 : 6, mode: state.alchemy.characterCards.length % 2 === 0 ? "active" : "passive",
      source: "alchemy", art: mythic ? profile?.images[0] ?? "/assets/mythic-scroll-backdrop.webp" : record.image,
      activeEffect: mythic ? "ward" : "sword", bonuses: mythic ? { damage: .08, health: 80, defense: 20 } : { damage: .035, health: 35 }, alchemyRecord: record };
  } else {
    const key = productStackKey(batch.productId, batch.mutation);
    alchemy.productStacks[key] = { productId: batch.productId, mutation: batch.mutation, count: (alchemy.productStacks[key]?.count ?? 0) + 1 };
    alchemy.completedBrews = (alchemy.completedBrews ?? 0) + 1;
  }
  const name = card?.name ?? mutationDisplayName(product, batch.mutation);
  return reduceGameEffects(withAlchemyState(state, alchemy), [
    ...(card ? [{ type: "add_card" as const, card }] : []),
    { type: "record_activity", receipt: { id: batch.id, kind: "alchemy", title: `炼成 · ${name}`, summary: "本炉成果已收入行囊，炉次已结算。", rewards: [`${name} ×1`], impacts: ["品质与异变已同步", "亲手炼制记录已更新"], nextStep: { target: "tasks", label: "查看可推进的任务" }, createdAt: now } },
  ]);
}

export function normalizeAlchemyBatch(value: unknown): AlchemyBatch | null {
  if (!value || typeof value !== "object") return null;
  const b = value as AlchemyBatch;
  if (typeof b.id !== "string" || !b.id || !Number.isFinite(b.startedAt) || b.startedAt < 0 || !Number.isFinite(b.readyAt) || b.readyAt < b.startedAt || b.readyAt - b.startedAt > 10000) return null;
  if (!Array.isArray(b.ingredientIds) || b.ingredientIds.length < 1 || b.ingredientIds.length > 3 || b.ingredientIds.some((id) => !MATERIALS.some((item) => item.id === id))) return null;
  if (!PRODUCTS.some((item) => item.id === b.productId) || !Object.values(MUTATIONS).some((mutation) => mutation.id === b.mutation)) return null;
  let card: CharacterCardRecord | null = null;
  if (b.card) {
    const c = b.card;
    if (c.id !== b.id || c.createdAt !== b.startedAt) return null;
    if (isMythicCardRecord(c)) {
      if (!Array.isArray(c.optionIds) || c.optionIds.length > MYTHIC_MAX_OPTIONS || new Set(c.optionIds).size !== c.optionIds.length ||
        c.optionIds.some((id) => !MYTHIC_CARD_OPTIONS.some((o) => o.id === id && o.unlocked)) ||
        MYTHIC_CARD_OPTIONS.filter((o) => o.page === "character" && c.optionIds.includes(o.id)).length !== 1) return null;
      card = { id: c.id, createdAt: c.createdAt, optionIds: [...c.optionIds], quality: "神品" };
    } else {
      const profile = CHARACTER_PROFILES.find((entry) => entry.id === c.profileId);
      if (!profile || !profile.images.includes(c.image) || !Number.isFinite(c.chance)) return null;
      card = { id: c.id, createdAt: c.createdAt, origin: "fated", profileId: profile.id, image: c.image, chance: Math.max(0, Math.min(100, c.chance)), targeted: c.targeted === true, quality: "仙品" };
    }
  }
  return { id: b.id, startedAt: b.startedAt, readyAt: b.readyAt, ingredientIds: [...b.ingredientIds], productId: b.productId, mutation: b.mutation, card };
}
