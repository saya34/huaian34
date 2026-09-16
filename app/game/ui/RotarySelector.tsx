"use client";

import { useRef } from "react";

export type RotarySelectorItem = {
  id: string;
  name: string;
  glyph: string;
  image?: string;
  meta?: string;
  disabled?: boolean;
};

type Props = {
  items: RotarySelectorItem[];
  value: string;
  onChange: (id: string) => void;
  onActivate?: (id: string) => void;
  ariaLabel: string;
  previousLabel: string;
  nextLabel: string;
  activateLabel?: string;
  caption?: string;
  direction?: "vertical" | "horizontal";
  className?: string;
};

export default function RotarySelector({ items, value, onChange, onActivate, ariaLabel, previousLabel, nextLabel, activateLabel, caption, direction = "vertical", className = "" }: Props) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === value));
  const wrap = (index: number) => (index + items.length) % items.length;
  const itemAt = (offset: number) => items[wrap(currentIndex + offset)];
  const move = (offset: number) => {
    if (!items.length) return;
    onChange(itemAt(offset).id);
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current) return;
    const delta = direction === "vertical" ? event.clientY - pointerStart.current.y : event.clientX - pointerStart.current.x;
    if (Math.abs(delta) > 24) move(delta > 0 ? -1 : 1);
    pointerStart.current = null;
  };
  if (!items.length) return null;
  const current = itemAt(0);
  return <div
    className={`rotary-selector rotary-${direction} ${className}`}
    role="group"
    aria-label={ariaLabel}
    tabIndex={0}
    onWheel={(event) => { event.preventDefault(); move(event.deltaY > 0 ? 1 : -1); }}
    onKeyDown={(event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowRight") { event.preventDefault(); move(1); }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
      if ((event.key === "Enter" || event.key === " ") && onActivate && !current.disabled) { event.preventDefault(); onActivate(current.id); }
    }}
    onPointerDown={(event) => { pointerStart.current = { x: event.clientX, y: event.clientY }; }}
    onPointerUp={onPointerUp}
  >
    {caption && <span className="rotary-caption" aria-hidden="true">{caption}</span>}
    <button type="button" className="rotary-step rotary-previous" onClick={() => move(-1)} aria-label={previousLabel}><span aria-hidden="true">⌃</span></button>
    <button type="button" className="rotary-preview rotary-preview-before" onClick={() => move(-1)} tabIndex={-1} aria-hidden="true"><RotaryItem item={itemAt(-1)} /></button>
    <button type="button" className="rotary-current" onClick={() => onActivate?.(current.id)} disabled={current.disabled && Boolean(onActivate)} aria-label={activateLabel ? `${activateLabel}：${current.name}` : current.name}>
      <RotaryItem item={current} />
      <i className="rotary-focus-ring" aria-hidden="true" />
    </button>
    <button type="button" className="rotary-preview rotary-preview-after" onClick={() => move(1)} tabIndex={-1} aria-hidden="true"><RotaryItem item={itemAt(1)} /></button>
    <button type="button" className="rotary-step rotary-next" onClick={() => move(1)} aria-label={nextLabel}><span aria-hidden="true">⌄</span></button>
  </div>;
}

function RotaryItem({ item }: { item: RotarySelectorItem }) {
  return <span className={`rotary-item ${item.disabled ? "is-disabled" : ""}`}>
    <b className="rotary-art" style={item.image ? { backgroundImage: `url(${item.image})` } : undefined}>{item.image ? "" : item.glyph}</b>
    <span><strong>{item.name}</strong>{item.meta && <small>{item.meta}</small>}</span>
  </span>;
}
