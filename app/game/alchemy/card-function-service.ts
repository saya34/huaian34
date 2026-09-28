import cardFunctionsData from "./data/card-functions.json";
import { isMythicCardRecord, MYTHIC_CARD_OPTIONS, type CharacterCardRecord } from "./advanced-card";
import { CHARACTER_PROFILES } from "./item-data";
import { normalizeCardName } from "../core/card-service";
import type { UnifiedCardInstance } from "../core/types";

type CardFunctionDefinition = {
  characterId: string;
  mode: UnifiedCardInstance["mode"];
  abilityId: string;
  abilityName: string;
  abilityDescription: string;
  activeEffect?: UnifiedCardInstance["activeEffect"];
  bonuses?: NonNullable<UnifiedCardInstance["bonuses"]>;
};

const CARD_FUNCTIONS = cardFunctionsData as CardFunctionDefinition[];

function scaleMythicBonuses(bonuses: CardFunctionDefinition["bonuses"]) {
  if (!bonuses) return undefined;
  return Object.fromEntries(Object.entries(bonuses).map(([key, value]) => [key, typeof value === "number" ? Number((value * 1.7).toFixed(3)) : value])) as NonNullable<UnifiedCardInstance["bonuses"]>;
}
export function createAlchemyCardInstance(record: CharacterCardRecord): UnifiedCardInstance | null {
  const mythic = isMythicCardRecord(record);
  const profileId = mythic
    ? MYTHIC_CARD_OPTIONS.find((option) => record.optionIds.includes(option.id) && option.page === "character")?.characterId
    : record.profileId;
  const profile = CHARACTER_PROFILES.find((entry) => entry.id === profileId);
  if (!profile || !profileId) return null;
  const definition = CARD_FUNCTIONS.find((entry) => entry.characterId === profileId) ?? CARD_FUNCTIONS[0];
  const abilityName = mythic ? `太初·${definition.abilityName}` : definition.abilityName;
  const abilityDescription = mythic
    ? `${definition.abilityDescription} 太初命刻会强化其持续时间与效果范围。`
    : definition.abilityDescription;
  return {
    id: record.id,
    characterId: profileId,
    name: mythic ? `太初·${profile.name}` : normalizeCardName(`${profile.title}·${profile.name}`),
    rarity: mythic ? 7 : 6,
    mode: definition.mode,
    source: "alchemy",
    art: mythic ? profile.images[0] ?? "/assets/mythic-scroll-backdrop.webp" : record.image,
    activeEffect: definition.mode === "active" ? definition.activeEffect : undefined,
    bonuses: definition.mode === "passive" ? (mythic ? scaleMythicBonuses(definition.bonuses) : definition.bonuses) : undefined,
    abilityId: definition.abilityId,
    abilityName,
    abilityDescription,
    alchemyRecord: record,
  };
}
