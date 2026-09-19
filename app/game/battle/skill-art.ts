import { findEffect } from "./assets";
import { assetUrl, type GameData } from "./data";
import type { UpgradeChoice } from "./engine";

const SKILL_ART_BY_ID: Record<number, string> = {
  10000: "/game-assets/equipment/bamboo-sword.webp",
  10001: "/game-assets/equipment/spirit-sword.webp",
  10002: "/game-assets/equipment/frost-bow.webp",
  10003: "/game-assets/equipment/phoenix-fan.webp",
  10004: "/game-assets/equipment/frost-bow.webp",
  10005: "/game-assets/equipment/galaxy-blade.webp",
  10006: "/game-assets/equipment/iron-sabre.webp",
  10007: "/game-assets/equipment/chaos-blade.webp",
  10008: "/game-assets/equipment/blood-spear.webp",
  10009: "/game-assets/equipment/galaxy-blade.webp",
  10010: "/game-assets/equipment/mystic-weapon.webp",
  10011: "/game-assets/equipment/phoenix-fan.webp",
  10012: "/game-assets/spells/dragon-pill.webp",
  10013: "/game-assets/treasures/relic-pearl.webp",
  10014: "/game-assets/treasures/lotus-artifact.webp",
  10015: "/game-assets/equipment/phoenix-crown.webp",
  10016: "/game-assets/treasures/ancient-cauldron.webp",
  10017: "/game-assets/equipment/vajra-bracers.webp",
  10018: "/game-assets/equipment/phoenix-fan.webp",
  10019: "/game-assets/equipment/flame-bracers.webp",
  10020: "/game-assets/equipment/frost-bow.webp",
  10021: "/game-assets/equipment/ice-bracers.webp",
  10022: "/game-assets/equipment/heaven-crown.webp",
  10023: "/game-assets/equipment/galaxy-blade.webp",
  10024: "/game-assets/equipment/chaos-blade.webp",
  10025: "/game-assets/equipment/spirit-sword.webp",
  10026: "/game-assets/equipment/azure-dragon-crown.webp",
  10027: "/game-assets/treasures/jade-scroll.webp",
  10028: "/game-assets/equipment/mystic-weapon.webp",
  10029: "/game-assets/equipment/blood-spear.webp",
  10030: "/game-assets/equipment/blood-moon-crown.webp",
  10031: "/game-assets/partners/thunder-lord.webp",
  10032: "/game-assets/equipment/thunder-halberd.webp",
  10033: "/game-assets/treasures/relic-pearl.webp",
  10034: "/game-assets/equipment/moon-boots.webp",
  10035: "/game-assets/treasures/relic-pearl.webp",
  10036: "/game-assets/equipment/samsara-gloves.webp",
  10037: "/game-assets/equipment/thunder-halberd.webp",
  10038: "/game-assets/equipment/vajra-bracers.webp",
};

export const skillArtwork = (id: number) => SKILL_ART_BY_ID[id] ?? null;

export function skillVisual(data: GameData | null, choice: UpgradeChoice) {
  if (!data || choice.kind === "supply" || choice.kind === "heal") return null;
  const prepared = skillArtwork(choice.id);
  if (prepared) return prepared;
  const level = data.skillLevels.find((row) => Number(row.skillId) === choice.id && Number(row.level) === choice.level)
    ?? data.skillLevels.find((row) => Number(row.skillId) === choice.id);
  const bullet = data.bullets.find((row) => Number(row.id) === Number(level?.bullet?.[0]));
  const path = findEffect(data.manifest, bullet?.model);
  return path ? assetUrl(path) : null;
}
