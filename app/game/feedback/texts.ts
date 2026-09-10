import alchemy from "./content/alchemy.json";
import battle from "./content/battle.json";
import calendar from "./content/calendar.json";
import farm from "./content/farm.json";
import fishing from "./content/fishing.json";
import forum from "./content/forum.json";
import items from "./content/items.json";
import livestock from "./content/livestock.json";
import mining from "./content/mining.json";
import player from "./content/player.json";
import projects from "./content/projects.json";
import relationship from "./content/relationship.json";
import shop from "./content/shop.json";
import system from "./content/system.json";
import world from "./content/world.json";
import type { FeedbackTextParams } from "./types";

const TEXT_INDEX: Record<string, string> = {
  ...system,
  ...world,
  ...calendar,
  ...player,
  ...relationship,
  ...items,
  ...battle,
  ...farm,
  ...livestock,
  ...fishing,
  ...mining,
  ...alchemy,
  ...shop,
  ...projects,
  ...forum,
};

export function feedbackText(key: string, params: FeedbackTextParams = {}) {
  const source = TEXT_INDEX[key] ?? TEXT_INDEX["system.missingText"];
  const merged = { key, ...params };
  return source.replace(/\{([\w.]+)\}/g, (token, name: string) => {
    const value = merged[name];
    return value === undefined ? token : String(value);
  });
}

export function hasFeedbackText(key: string) {
  return Object.prototype.hasOwnProperty.call(TEXT_INDEX, key);
}
