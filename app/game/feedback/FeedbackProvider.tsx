"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FeedbackViewport } from "./FeedbackViewport";
import { feedbackText } from "./texts";
import type { FeedbackApi, FeedbackHistoryItem, FeedbackInput, FeedbackItem, FeedbackTone } from "./types";

const FeedbackContext = createContext<FeedbackApi | null>(null);
const CENTER_VARIANTS = new Set([
  "world-announcement",
  "progression-milestone",
  "relationship-reveal",
  "day-opening",
  "project-milestone",
  "rare-reward",
  "identification-reveal",
]);
const FEEDBACK_HISTORY_KEY = "huaian-feedback-history-v1";

function compactCenterQueue(items: FeedbackItem[]) {
  if (items.length <= 5) return items;
  const kept=items.slice(0,4),rest=items.slice(4),last=rest.at(-1)!;
  return [...kept,{...last,id:`${last.id}-summary`,variant:"project-milestone" as const,priority:2,titleKey:"world.phaseSummaryTitle",bodyKey:"world.phaseSummaryBody",params:{count:rest.length},icon:"录",count:1,dedupeKey:`phase-summary:${last.createdAt}`}];
}

function defaultTone(input: FeedbackInput): FeedbackTone {
  if (input.tone) return input.tone;
  if (input.variant === "rare-reward" || input.variant === "identification-reveal") return "gold";
  if (input.variant === "relationship-reveal") return "cinnabar";
  if (input.variant === "decision-dialog") return "danger";
  return "jade";
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const idRef = useRef(0);
  const dedupeRef = useRef(new Map<string, number>());
  const combatBusyRef = useRef(false);
  const resolveConfirmRef = useRef<((answer: boolean) => void) | null>(null);
  const [center, setCenter] = useState<FeedbackItem | null>(null);
  const [queue, setQueue] = useState<FeedbackItem[]>([]);
  const [toasts, setToasts] = useState<FeedbackItem[]>([]);
  const [floats, setFloats] = useState<FeedbackItem[]>([]);
  const [sheet, setSheet] = useState<FeedbackItem | null>(null);
  const [popoverItem, setPopoverItem] = useState<FeedbackItem | null>(null);
  const [decision, setDecision] = useState<FeedbackItem | null>(null);
  const [history, setHistory] = useState<FeedbackHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(FEEDBACK_HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved));
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(FEEDBACK_HISTORY_KEY, JSON.stringify(history.slice(0, 60))); } catch { /* History is optional. */ }
  }, [history]);

  const archive = useCallback((item: FeedbackItem) => {
    const record: FeedbackHistoryItem = {
      id: item.id,
      createdAt: item.createdAt,
      variant: item.variant,
      tone: defaultTone(item),
      title: feedbackText(item.titleKey, item.params),
      body: item.bodyKey ? feedbackText(item.bodyKey, item.params) : "",
    };
    setHistory((current) => [record, ...current.filter((entry) => entry.id !== record.id)].slice(0, 60));
  }, []);

  const publish = useCallback<FeedbackApi["publish"]>((input) => {
    const now = Date.now();
    const dedupeKey = input.dedupeKey ?? `${input.variant}:${input.titleKey}:${JSON.stringify(input.params ?? {})}`;
    const lastTime = dedupeRef.current.get(dedupeKey) ?? 0;
    if (now - lastTime < 500) {
      setToasts((current) => current.map((item) => item.dedupeKey === dedupeKey ? { ...item, count: item.count + 1, createdAt: now } : item));
      return null;
    }
    dedupeRef.current.set(dedupeKey, now);
    const item: FeedbackItem = {
      ...input,
      id: `feedback-${now}-${++idRef.current}`,
      createdAt: now,
      count: 1,
      priority: input.priority ?? 2,
      tone: defaultTone(input),
      dedupeKey,
    };
    archive(item);
    if (CENTER_VARIANTS.has(item.variant)) {
      if (combatBusyRef.current && item.scope !== "combat" && (item.priority ?? 2) > 0) {
        setQueue((queued) => compactCenterQueue([...queued, item].sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2) || a.createdAt - b.createdAt)));
        return item.id;
      }
      setCenter((current) => {
        if (!current) return item;
        setQueue((queued) => compactCenterQueue([...queued, item].sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2) || a.createdAt - b.createdAt)));
        return current;
      });
    } else if (item.variant === "action-toast") {
      setToasts((current) => [...current.slice(-3), item]);
    } else if (item.variant === "floating-text") {
      setFloats((current) => [...current.slice(-5), item]);
    } else if (item.variant === "decision-dialog") {
      setDecision(item);
    } else if (item.variant === "info-popover") {
      setPopoverItem(item);
    } else {
      setSheet(item);
    }
    return item.id;
  }, [archive]);

  const dismiss = useCallback((id?: string) => {
    setCenter((current) => {
      if (id && current?.id !== id) return current;
      return null;
    });
    setToasts((current) => id ? current.filter((item) => item.id !== id) : []);
    setFloats((current) => id ? current.filter((item) => item.id !== id) : []);
    setSheet((current) => !id || current?.id === id ? null : current);
    setPopoverItem((current) => !id || current?.id === id ? null : current);
    setDecision((current) => !id || current?.id === id ? null : current);
  }, []);

  useEffect(() => {
    if (center || queue.length === 0 || combatBusyRef.current) return;
    const [next, ...rest] = queue;
    setCenter(next);
    setQueue(rest);
  }, [center, queue]);

  useEffect(() => {
    if (!center) return;
    const duration = center.durationMs ?? (center.priority === 0 ? 5200 : 3600);
    const timer = window.setTimeout(() => dismiss(center.id), duration);
    return () => window.clearTimeout(timer);
  }, [center, dismiss]);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((item) => window.setTimeout(() => dismiss(item.id), item.durationMs ?? 3000));
    return () => timers.forEach(window.clearTimeout);
  }, [dismiss, toasts]);

  useEffect(() => {
    if (!floats.length) return;
    const timers = floats.map((item) => window.setTimeout(() => dismiss(item.id), item.durationMs ?? 1800));
    return () => timers.forEach(window.clearTimeout);
  }, [dismiss, floats]);

  const toast = useCallback<FeedbackApi["toast"]>((input) => publish({ ...input, variant: "action-toast" }), [publish]);
  const float = useCallback<FeedbackApi["float"]>((input) => publish({ ...input, variant: "floating-text" }), [publish]);
  const inspect = useCallback<FeedbackApi["inspect"]>((input) => publish({ ...input, variant: "inspector-sheet" }), [publish]);
  const popover = useCallback<FeedbackApi["popover"]>((input) => publish({ ...input, variant: "info-popover" }), [publish]);
  const compare = useCallback<FeedbackApi["compare"]>((input) => publish({ ...input, variant: "equipment-compare" }), [publish]);
  const confirm = useCallback<FeedbackApi["confirm"]>((input) => new Promise<boolean>((resolve) => {
    resolveConfirmRef.current?.(false);
    resolveConfirmRef.current = resolve;
    publish({
      ...input,
      variant: "decision-dialog",
      actions: [
        { labelKey: "system.cancel", tone: "secondary", onSelect: () => { resolveConfirmRef.current?.(false); resolveConfirmRef.current = null; setDecision(null); } },
        { labelKey: "system.confirm", tone: "primary", onSelect: () => { resolveConfirmRef.current?.(true); resolveConfirmRef.current = null; setDecision(null); } },
      ],
    });
  }), [publish]);

  const setCombatBusy = useCallback((busy: boolean) => {
    combatBusyRef.current = busy;
    if (!busy) setQueue((current) => [...current]);
  }, []);
  const api = useMemo<FeedbackApi>(() => ({ publish, toast, float, inspect, popover, compare, confirm, dismiss, openHistory: () => setHistoryOpen(true), setCombatBusy }), [compare, confirm, dismiss, float, inspect, popover, publish, setCombatBusy, toast]);

  return <FeedbackContext.Provider value={api}>
    {children}
    <FeedbackViewport center={center} toasts={toasts} floats={floats} sheet={sheet} popoverItem={popoverItem} decision={decision} history={history} historyOpen={historyOpen} onCloseHistory={() => setHistoryOpen(false)} onDismiss={dismiss} />
  </FeedbackContext.Provider>;
}

export function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error("useFeedback must be used within FeedbackProvider");
  return value;
}
