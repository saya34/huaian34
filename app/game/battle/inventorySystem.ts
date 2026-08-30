import type { InventorySize } from "./expedition";
import {
  type EquipmentItem,
  type EquipmentPosition,
  equipmentSize,
} from "./progression";

export const CULTIVATOR_PACK_SIZE: InventorySize = { columns: 10, rows: 4 };
export const PERSONAL_STASH_SIZE: InventorySize = { columns: 10, rows: 8 };

export function canPlaceEquipment(
  items: EquipmentItem[],
  positions: Record<string, EquipmentPosition>,
  item: EquipmentItem,
  size: InventorySize,
  x: number,
  y: number,
  ignoreUids: string[] = [],
) {
  const own = equipmentSize(item);
  if (x < 0 || y < 0 || x + own.width > size.columns || y + own.height > size.rows) return false;
  const ignored = new Set(ignoreUids);
  return items.every((other) => {
    if (other.uid === item.uid || ignored.has(other.uid)) return true;
    const position = positions[other.uid];
    if (!position) return true;
    const dimensions = equipmentSize(other);
    return x + own.width <= position.x
      || position.x + dimensions.width <= x
      || y + own.height <= position.y
      || position.y + dimensions.height <= y;
  });
}

export function findEquipmentPosition(
  items: EquipmentItem[],
  positions: Record<string, EquipmentPosition>,
  item: EquipmentItem,
  size: InventorySize = CULTIVATOR_PACK_SIZE,
  ignoreUids: string[] = [],
) {
  const dimensions = equipmentSize(item);
  const rows = Array.from({ length: size.rows - dimensions.height + 1 }, (_, index) => index);
  if (dimensions.height === 1 && size.rows === 4) rows.unshift(...rows.splice(rows.indexOf(3), 1));
  for (const y of rows) for (let x = 0; x <= size.columns - dimensions.width; x++) {
    if (canPlaceEquipment(items, positions, item, size, x, y, ignoreUids)) return { x, y };
  }
  return null;
}

export function organizeEquipment(
  items: EquipmentItem[],
  size: InventorySize = CULTIVATOR_PACK_SIZE,
) {
  const sorted = [...items].sort((a, b) => {
    const aa = equipmentSize(a);
    const bb = equipmentSize(b);
    return bb.height - aa.height || bb.width - aa.width || a.uid.localeCompare(b.uid);
  });
  const positions: Record<string, EquipmentPosition> = {};
  const placed: EquipmentItem[] = [];
  for (const item of sorted) {
    const position = findEquipmentPosition(placed, positions, item, size);
    if (!position) return null;
    positions[item.uid] = position;
    placed.push(item);
  }
  return positions;
}

export function equipmentAt(
  items: EquipmentItem[],
  positions: Record<string, EquipmentPosition>,
  x: number,
  y: number,
) {
  return items.find((item) => {
    const position = positions[item.uid];
    if (!position) return false;
    const size = equipmentSize(item);
    return x >= position.x && x < position.x + size.width && y >= position.y && y < position.y + size.height;
  });
}

/** 允许与至多一件法器互换，整次操作要么全部成功，要么不改变布局。 */
export function moveOrSwapEquipment(
  items: EquipmentItem[],
  positions: Record<string, EquipmentPosition>,
  uid: string,
  x: number,
  y: number,
  size: InventorySize = CULTIVATOR_PACK_SIZE,
) {
  const moving = items.find((item) => item.uid === uid);
  const from = positions[uid];
  if (!moving || !from) return null;
  const own = equipmentSize(moving);
  if (x < 0 || y < 0 || x + own.width > size.columns || y + own.height > size.rows) return null;
  const overlaps = items.filter((other) => {
    if (other.uid === uid || !positions[other.uid]) return false;
    const point = positions[other.uid];
    const dimensions = equipmentSize(other);
    return !(x + own.width <= point.x || point.x + dimensions.width <= x || y + own.height <= point.y || point.y + dimensions.height <= y);
  });
  if (overlaps.length > 1) return null;
  const next = { ...positions };
  if (overlaps.length === 1) {
    const displaced = overlaps[0];
    if (!canPlaceEquipment(items, positions, displaced, size, from.x, from.y, [uid, displaced.uid])) return null;
    next[displaced.uid] = from;
  }
  next[uid] = { x, y };
  return next;
}
