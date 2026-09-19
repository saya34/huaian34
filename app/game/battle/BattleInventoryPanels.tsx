"use client";

import type { CSSProperties, DragEvent as ReactDragEvent } from "react";
import { CULTIVATOR_PACK_SIZE, organizeEquipment } from "./inventorySystem";
import { ContainerKind, PlacedTreasure, RARITY_META, TreasureItem, placeItems, treasureById } from "./expedition";
import { EquipmentItem, equipmentById, equipmentSize } from "./progression";

export type HeldTreasure = { uid: string; source: ContainerKind | "loot"; treasureId: string };

export function RunEquipmentGrid({ items }: { items: EquipmentItem[] }) {
  const positions = organizeEquipment(items, CULTIVATOR_PACK_SIZE) ?? {};
  return <section className="inventory-section run-gear-pack"><h3>法器战利品<small>{items.length} 件 · 共用 10×4 容量规则</small></h3><div className="gear-tetris-grid">{Array.from({ length: 40 }).map((_, index) => <i key={index} />)}{items.map((item) => { const base = equipmentById(item.equipmentId); const point = positions[item.uid]; const size = equipmentSize(item); const rarity = item.rarity ?? base.rarity; if (!point) return null; return <article key={item.uid} style={{ gridColumn: `${point.x + 1}/span ${size.width}`, gridRow: `${point.y + 1}/span ${size.height}`, "--rarity": RARITY_META[rarity].color } as CSSProperties}><img src={base.art} alt="" /><small>{item.identified === false ? "未鉴定" : item.twoHanded ? "双手" : RARITY_META[rarity].name}</small></article>; })}</div></section>;
}

export function InventoryGrid({ title, items, size, actionLabel, onAction, secondaryActionLabel, onSecondaryAction, onSort, container, onPlace, held, onHeldChange }: {
  title: string; items: TreasureItem[]; size: { columns: number; rows: number };
  actionLabel?: string; onAction?: (uid: string) => void; secondaryActionLabel?: string; onSecondaryAction?: (uid: string) => void;
  onSort?: () => void; container?: ContainerKind; onPlace?: (uid: string, source: ContainerKind | "loot", x: number, y: number) => boolean | undefined;
  held?: HeldTreasure | null; onHeldChange?: (held: HeldTreasure | null) => void;
}) {
  const cellSize = size.columns >= 10 ? 40 : 58, cellGap = 3, gridPadding = 5;
  const hasSavedPositions = items.every((item) => "x" in item && "y" in item);
  const placed = hasSavedPositions ? items as PlacedTreasure[] : placeItems(items, size) ?? [];
  return <section className="inventory-section">
    <h3>{title}<small>{items.length} 件 · {size.columns}×{size.rows}</small>{onSort && <button type="button" onClick={onSort}>整理</button>}</h3>
    <div className={`treasure-grid ${onPlace ? "droppable" : ""}`} style={{ "--columns": size.columns, "--rows": size.rows, "--cell-size": `${cellSize}px`, width: size.columns * cellSize + (size.columns - 1) * cellGap + gridPadding * 2, height: size.rows * cellSize + (size.rows - 1) * cellGap + gridPadding * 2 } as CSSProperties}>
      {Array.from({ length: size.columns * size.rows }).map((_, index) => { const x = index % size.columns, y = Math.floor(index / size.columns); return <i key={index} data-cell={`${x}-${y}`} style={{ left: gridPadding + x * (cellSize + cellGap), top: gridPadding + y * (cellSize + cellGap) }} onDragOver={(event) => { if (onPlace) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={(event) => { if (!onPlace) return; event.preventDefault(); const payload = readTreasureDrag(event); if (payload && onPlace(payload.uid, payload.source, x, y)) onHeldChange?.(null); }} onClick={() => { if (held && onPlace?.(held.uid, held.source, x, y)) onHeldChange?.(null); }} />; })}
      {placed.map((item) => { const treasure = treasureById(item.treasureId); return <article key={item.uid} draggable={Boolean(container && onPlace)} onDragStart={(event) => container && writeTreasureDrag(event, item.uid, container)} onClick={(event) => { event.stopPropagation(); if (!container || !onHeldChange) return; if (held) { if (held.uid === item.uid && held.source === container) onHeldChange(null); else if (onPlace?.(held.uid, held.source, item.x, item.y)) onHeldChange(null); return; } onHeldChange({ uid: item.uid, source: container, treasureId: item.treasureId }); }} onDoubleClick={(event) => { event.stopPropagation(); onAction?.(item.uid); onHeldChange?.(null); }} onDragOver={(event) => { if (onPlace) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={(event) => { if (!onPlace) return; event.preventDefault(); event.stopPropagation(); const payload = readTreasureDrag(event); if (payload && onPlace(payload.uid, payload.source, item.x, item.y)) onHeldChange?.(null); }} className={`inventory-item rarity-${treasure.rarity} ${held?.uid === item.uid && held.source === container ? "is-held" : ""}`} data-grid-x={item.x} data-grid-y={item.y} style={{ left: gridPadding + item.x * (cellSize + cellGap), top: gridPadding + item.y * (cellSize + cellGap), width: treasure.width * cellSize + (treasure.width - 1) * cellGap, height: treasure.height * cellSize + (treasure.height - 1) * cellGap, "--rarity": RARITY_META[treasure.rarity].color } as CSSProperties} title={`${treasure.name} · ${treasure.value} 灵石`}><img src={treasure.art} alt="" /><aside className="inventory-tooltip"><strong>{treasure.name}</strong><small>{RARITY_META[treasure.rarity].name} · {treasure.width}×{treasure.height}</small><p>{treasure.description}</p><b>价值 {treasure.value.toLocaleString()} 灵石</b>{onAction && <em>双击：{actionLabel}</em>}</aside>{(onAction || onSecondaryAction) && <span className="inventory-item-actions">{onAction && <button type="button" onClick={(event) => { event.stopPropagation(); onAction(item.uid); }}>{actionLabel}</button>}{onSecondaryAction && <button type="button" onClick={(event) => { event.stopPropagation(); onSecondaryAction(item.uid); }}>{secondaryActionLabel}</button>}</span>}</article>; })}
    </div>
  </section>;
}

export function writeTreasureDrag(event: ReactDragEvent<HTMLElement>, uid: string, source: ContainerKind | "loot") {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-blcx-treasure", JSON.stringify({ uid, source }));
  event.dataTransfer.setData("text/plain", uid);
}

function readTreasureDrag(event: ReactDragEvent<HTMLElement>) {
  try { return JSON.parse(event.dataTransfer.getData("application/x-blcx-treasure")) as { uid: string; source: ContainerKind | "loot" }; }
  catch { return null; }
}
