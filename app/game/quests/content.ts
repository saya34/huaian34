import main from "./content/main.json";
import side from "./content/side.json";
import ui from "./content/ui.json";
import type { QuestDefinition } from "./types";

export const QUESTS = [...main, ...side] as QuestDefinition[];

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, source);
}

export function questText(key: string, params: Record<string, string | number> = {}) {
  const value = readPath(ui, key);
  const template = typeof value === "string" ? value : key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
