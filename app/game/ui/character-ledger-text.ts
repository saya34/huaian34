import copy from "./content/character-ledger.json";

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, source);
}

export function characterLedgerText(key: string, params: Record<string, string | number> = {}) {
  const value = readPath(copy, key);
  const template = typeof value === "string" ? value : key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
