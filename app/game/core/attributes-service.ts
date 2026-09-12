import type { AttributeBonus,HeroAttributes } from "../battle/progression";
import { addAttributes } from "../battle/progression";
import { computePermanentAttributes } from "../battle/meta";
import type { UnifiedGameState } from "./types";

export type FinalAttributeContext={temporaryBonuses?:AttributeBonus[];stageModifiers?:AttributeBonus[]};

/** 统一顺序：基础/根基/功法/法器由 meta 计算，再叠被动命格、临时丹药与关卡修正。 */
export function computeFinalAttributes(state:Pick<UnifiedGameState,"battle"|"shared">,context:FinalAttributeContext={}):HeroAttributes{
  const passiveCards=state.shared.cards.filter(card=>card.mode==="passive").map(card=>card.bonuses);
  return addAttributes(computePermanentAttributes(state.battle),...passiveCards,...(context.temporaryBonuses??[]),...(context.stageModifiers??[]));
}
