import type { ActiveEvent, Effect, EventDefinition, TriggerContext } from "../types";

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string";
function validEffect(raw: unknown) {
  const e = object(raw);
  const amount = typeof e.amount === "number" && Number.isFinite(e.amount);
  switch (e.type as Effect["type"]) {
    case "relationship": return text(e.characterId) && amount;
    case "set_flag": return text(e.key) && typeof e.value === "boolean";
    case "consume_gift": return text(e.giftId) && amount;
    case "add_item": return text(e.itemId) && ["gift","material","pill","equipment","treasure","quest"].includes(String(e.itemType)) && amount && Number.isInteger(e.rarity) && Number(e.rarity) >= 1 && Number(e.rarity) <= 7;
    case "add_card": return text(e.cardId) && text(e.characterId) && text(e.name) && text(e.art) && ["active","passive"].includes(String(e.mode)) && Number.isInteger(e.rarity) && Number(e.rarity) >= 1 && Number(e.rarity) <= 7;
    case "learn_skill": return Number.isInteger(e.skillId);
    case "add_currency": case "add_player_exp": return amount;
    case "trigger_map_event": return text(e.eventId);
    default: return false;
  }
}
function validSnapshot(raw: unknown): raw is EventDefinition {
  const e = object(raw), nodes = object(e.nodes);
  const effects = (value: unknown) => value === undefined || (Array.isArray(value) && value.every(validEffect));
  if (!text(e.id) || !text(e.title) || !text(e.sceneId) || !text(e.characterId) || !text(e.start) || !nodes[String(e.start)] || !Array.isArray(e.conditions)) return false;
  return Object.values(nodes).length > 0 && Object.values(nodes).every((rawNode) => {
    const n = object(rawNode);
    if (!text(n.id) || !effects(n.effects)) return false;
    if (n.type === "end") return true;
    if (n.type === "line") return text(n.text) && text(n.speaker) && text(n.next) && Boolean(nodes[String(n.next)]);
    if (n.type === "choice") return Array.isArray(n.options) && n.options.every((rawOption) => {
      const o = object(rawOption); return text(o.id) && text(o.label) && text(o.next) && Boolean(nodes[String(o.next)]) && effects(o.effects);
    });
    return false;
  });
}

/** Restore the exact next node, never the beginning of an already rewarded dialogue. */
export function restoreDialogue(raw: unknown, rawContext: unknown, completed: string[], definitions: EventDefinition[]): { activeEvent: ActiveEvent | null; lastContext: TriggerContext | null } {
  const active = object(raw);
  const none = { activeEvent: null, lastContext: null };
  if (!text(active.eventId) || !text(active.nodeId)) return none;
  const definition = definitions.find((event) => event.id === active.eventId)
    ?? (validSnapshot(active.transient) && active.transient.id === active.eventId ? active.transient : null);
  if (!definition || !definition.nodes[String(active.nodeId)] || (definition.once && completed.includes(definition.id))) return none;
  const context = object(rawContext);
  return {
    activeEvent: { eventId: definition.id, nodeId: String(active.nodeId), ...(active.transient ? { transient: definition } : {}) },
    lastContext: { trigger: definition.trigger, sceneId: definition.sceneId, characterId: definition.characterId,
      ...(text(context.giftId) ? { giftId: String(context.giftId) } : {}),
      ...(text(context.interactionId) ? { interactionId: String(context.interactionId) } : {}) },
  };
}
