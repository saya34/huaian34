"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FeedbackViewport } from "./FeedbackViewport";
import { feedbackText } from "./texts";
import type { FeedbackApi, FeedbackBusyScope, FeedbackDismissPolicy, FeedbackHistoryItem, FeedbackInput, FeedbackItem, FeedbackLevel, FeedbackTone } from "./types";

const FeedbackContext = createContext<FeedbackApi | null>(null);
const FEEDBACK_HISTORY_KEY = "huaian-feedback-history-v2";
const HISTORY_LIMIT = 160;

const VARIANT_LEVEL: Record<FeedbackInput["variant"], FeedbackLevel> = {
  "world-announcement": "L2",
  "progression-milestone": "L2",
  "relationship-reveal": "L2",
  "day-opening": "L1",
  "project-milestone": "L2",
  "rare-reward": "L3",
  "identification-reveal": "L2",
  "action-toast": "L1",
  "floating-text": "L1",
  "info-popover": "D",
  "inspector-sheet": "D",
  "equipment-compare": "D",
  "decision-dialog": "D",
};

const DEFAULT_DURATION: Record<Exclude<FeedbackLevel, "L0" | "D">, number> = { L1: 1500, L2: 2800, L3: 4200 };

function defaultTone(input: FeedbackInput): FeedbackTone {
  if (input.tone) return input.tone;
  if (input.outcome === "failed" || input.outcome === "damaged") return "danger";
  if (input.variant === "rare-reward" || input.variant === "identification-reveal") return "gold";
  if (input.variant === "relationship-reveal") return "cinnabar";
  if (input.variant === "decision-dialog") return "danger";
  return "jade";
}

function defaultDismissPolicy(level: FeedbackLevel): FeedbackDismissPolicy {
  if (level === "D") return "manual";
  if (level === "L3") return "click";
  return "auto";
}

function shouldArchive(input: FeedbackItem) {
  return input.record === true || input.level === "L2" || input.level === "L3" || input.level === "D";
}

function itemEventKey(input: FeedbackInput) {
  return input.receiptId ?? input.eventId;
}

function sortQueue(items: FeedbackItem[]) {
  const rank: Record<FeedbackLevel, number> = { D: 0, L3: 1, L2: 2, L1: 3, L0: 4 };
  return [...items].sort((a, b) => rank[a.level] - rank[b.level] || (a.priority ?? 2) - (b.priority ?? 2) || a.createdAt - b.createdAt);
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const idRef = useRef(0);
  const dedupeRef = useRef(new Map<string, number>());
  const eventIdsRef = useRef(new Set<string>());
  const busyScopesRef = useRef(new Set<FeedbackBusyScope>());
  const resolveConfirmRef = useRef<((answer: boolean) => void) | null>(null);
  const [busyRevision, setBusyRevision] = useState(0);
  const [center, setCenter] = useState<FeedbackItem | null>(null);
  const [important, setImportant] = useState<FeedbackItem | null>(null);
  const [queue, setQueue] = useState<FeedbackItem[]>([]);
  const [toasts, setToasts] = useState<FeedbackItem[]>([]);
  const [floats, setFloats] = useState<FeedbackItem[]>([]);
  const [sheet, setSheet] = useState<FeedbackItem | null>(null);
  const [popoverItem, setPopoverItem] = useState<FeedbackItem | null>(null);
  const [decision, setDecision] = useState<FeedbackItem | null>(null);
  const [history, setHistory] = useState<FeedbackHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(FEEDBACK_HISTORY_KEY);
        if (saved) setHistory(JSON.parse(saved));
      } catch {
        setHistory([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(FEEDBACK_HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT))); } catch { /* History is optional. */ }
  }, [history]);

  const archive = useCallback((item: FeedbackItem) => {
    if (!shouldArchive(item)) return;
    const record: FeedbackHistoryItem = {
      id: item.id,
      createdAt: item.createdAt,
      variant: item.variant,
      level: item.level,
      tone: defaultTone(item),
      title: feedbackText(item.titleKey, item.params),
      body: item.bodyKey ? feedbackText(item.bodyKey, item.params) : "",
      eventId: item.eventId,
      receiptId: item.receiptId,
      rewards: item.rewards,
      costs: item.costs,
      impacts: item.impacts,
    };
    setHistory((current) => [record, ...current.filter((entry) => entry.id !== record.id)].slice(0, HISTORY_LIMIT));
  }, []);

  const isBlocked = useCallback((item: FeedbackItem) => {
    if (!busyScopesRef.current.size || item.level === "L0" || item.level === "L1" || item.level === "D") return false;
    const owner = item.presentationOwner as FeedbackBusyScope | undefined;
    if (owner && busyScopesRef.current.has(owner)) return false;
    if (item.scope === "combat" && busyScopesRef.current.has("combat")) return false;
    return true;
  }, []);

  const publish = useCallback<FeedbackApi["publish"]>((input) => {
    const now = Date.now();
    const level = input.level ?? VARIANT_LEVEL[input.variant];
    const eventKey = itemEventKey(input);
    if (eventKey && eventIdsRef.current.has(eventKey)) return null;
    const dedupeKey = input.dedupeKey ?? eventKey ?? `${input.variant}:${input.titleKey}:${JSON.stringify(input.params ?? {})}`;
    const lastTime = dedupeRef.current.get(dedupeKey) ?? 0;
    if (now - lastTime < 500) {
      // Keep the first expiry. New messages must never extend an old L1 indefinitely.
      setToasts((current) => current.map((item) => item.dedupeKey === dedupeKey ? { ...item, count: item.count + 1 } : item));
      setFloats((current) => current.map((item) => item.dedupeKey === dedupeKey ? { ...item, count: item.count + 1 } : item));
      return null;
    }
    dedupeRef.current.set(dedupeKey, now);
    if (eventKey) eventIdsRef.current.add(eventKey);
    const duration = level === "L0" || level === "D" ? undefined : input.durationMs ?? DEFAULT_DURATION[level];
    const dismissPolicy = input.dismissPolicy ?? defaultDismissPolicy(level);
    const item: FeedbackItem = {
      ...input,
      id: `feedback-${now}-${++idRef.current}`,
      createdAt: now,
      expiresAt: dismissPolicy === "auto" && duration ? now + duration : undefined,
      count: 1,
      level,
      dismissPolicy,
      priority: input.priority ?? 2,
      tone: defaultTone(input),
      dedupeKey,
    };
    archive(item);
    if (level === "L0") return item.id;
    if (input.variant === "decision-dialog") setDecision(item);
    else if (input.variant === "info-popover") setPopoverItem(item);
    else if (level === "D" || input.variant === "inspector-sheet" || input.variant === "equipment-compare") setSheet(item);
    else if (isBlocked(item)) setQueue((current) => sortQueue([...current, item]));
    else if (level === "L3") {
      setCenter((current) => {
        if (!current) return item;
        setQueue((queued) => sortQueue([...queued, item]));
        return current;
      });
    } else if (level === "L2") {
      setImportant((current) => {
        if (!current) return item;
        setQueue((queued) => sortQueue([...queued, item]));
        return current;
      });
    } else if (input.variant === "floating-text") setFloats([item]);
    else setToasts([item]);
    return item.id;
  }, [archive, isBlocked]);

  const dismiss = useCallback((id?: string) => {
    setCenter((current) => !id || current?.id === id ? null : current);
    setImportant((current) => !id || current?.id === id ? null : current);
    setToasts((current) => id ? current.filter((item) => item.id !== id) : []);
    setFloats((current) => id ? current.filter((item) => item.id !== id) : []);
    setSheet((current) => !id || current?.id === id ? null : current);
    setPopoverItem((current) => !id || current?.id === id ? null : current);
    setDecision((current) => !id || current?.id === id ? null : current);
  }, []);

  useEffect(() => {
    if (center || important || queue.length === 0 || busyScopesRef.current.size) return;
    const [next, ...rest] = queue;
    const timer = window.setTimeout(() => {
      setQueue(rest);
      if (next.level === "L3") setCenter(next);
      else setImportant(next);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [busyRevision, center, important, queue]);

  useEffect(() => {
    if (!center?.expiresAt) return;
    const timer = window.setTimeout(() => dismiss(center.id), Math.max(0, center.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [center?.expiresAt, center?.id, dismiss]);

  useEffect(() => {
    if (!important?.expiresAt) return;
    const timer = window.setTimeout(() => dismiss(important.id), Math.max(0, important.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [dismiss, important?.expiresAt, important?.id]);

  useEffect(() => {
    const expiring = [...toasts, ...floats].filter((item) => item.expiresAt);
    if (!expiring.length) return;
    const nearest = Math.min(...expiring.map((item) => item.expiresAt!));
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setToasts((current) => current.filter((item) => !item.expiresAt || item.expiresAt > now));
      setFloats((current) => current.filter((item) => !item.expiresAt || item.expiresAt > now));
    }, Math.max(0, nearest - Date.now()));
    return () => window.clearTimeout(timer);
  }, [floats, toasts]);

  const toast = useCallback<FeedbackApi["toast"]>((input) => publish({ ...input, level: input.level ?? "L1", variant: "action-toast" }), [publish]);
  const float = useCallback<FeedbackApi["float"]>((input) => publish({ ...input, level: input.level ?? "L1", variant: "floating-text" }), [publish]);
  const inspect = useCallback<FeedbackApi["inspect"]>((input) => publish({ ...input, level: "D", dismissPolicy: "manual", variant: "inspector-sheet" }), [publish]);
  const popover = useCallback<FeedbackApi["popover"]>((input) => publish({ ...input, level: "D", dismissPolicy: "manual", variant: "info-popover" }), [publish]);
  const compare = useCallback<FeedbackApi["compare"]>((input) => publish({ ...input, level: "D", dismissPolicy: "manual", variant: "equipment-compare" }), [publish]);
  const confirm = useCallback<FeedbackApi["confirm"]>((input) => new Promise<boolean>((resolve) => {
    resolveConfirmRef.current?.(false);
    resolveConfirmRef.current = resolve;
    publish({
      ...input,
      level: "D",
      dismissPolicy: "decision",
      variant: "decision-dialog",
      actions: [
        { labelKey: "system.cancel", tone: "secondary", onSelect: () => { resolveConfirmRef.current?.(false); resolveConfirmRef.current = null; setDecision(null); } },
        { labelKey: "system.confirm", tone: "primary", onSelect: () => { resolveConfirmRef.current?.(true); resolveConfirmRef.current = null; setDecision(null); } },
      ],
    });
  }), [publish]);

  const setBusy = useCallback((scope: FeedbackBusyScope, busy: boolean) => {
    if (busy) busyScopesRef.current.add(scope);
    else busyScopesRef.current.delete(scope);
    setBusyRevision((value) => value + 1);
  }, []);
  const setCombatBusy = useCallback((busy: boolean) => setBusy("combat", busy), [setBusy]);
  const api = useMemo<FeedbackApi>(() => ({
    publish, toast, float, inspect, popover, compare, confirm, dismiss,
    openHistory: () => setHistoryOpen(true), setBusy, setCombatBusy,
  }), [compare, confirm, dismiss, float, inspect, popover, publish, setBusy, setCombatBusy, toast]);

  return <FeedbackContext.Provider value={api}>
    {children}
    <FeedbackViewport center={center} important={important} toasts={toasts} floats={floats} sheet={sheet} popoverItem={popoverItem} decision={decision} history={history} historyOpen={historyOpen} onCloseHistory={() => setHistoryOpen(false)} onDismiss={dismiss} />
  </FeedbackContext.Provider>;
}

export function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error("useFeedback must be used within FeedbackProvider");
  return value;
}
