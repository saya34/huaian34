import type { ReactNode } from "react";

export type FeedbackVariant =
  | "world-announcement"
  | "progression-milestone"
  | "relationship-reveal"
  | "day-opening"
  | "project-milestone"
  | "rare-reward"
  | "identification-reveal"
  | "action-toast"
  | "floating-text"
  | "info-popover"
  | "inspector-sheet"
  | "equipment-compare"
  | "decision-dialog";

export type FeedbackTone = "jade" | "gold" | "cinnabar" | "danger" | "muted";
export type FeedbackPriority = 0 | 1 | 2 | 3;
export type FeedbackTextParams = Record<string, string | number>;
export type FeedbackLevel = "L0" | "L1" | "L2" | "L3" | "D";
export type FeedbackOutcome = "success" | "damaged" | "failed" | "discovered" | "changed" | "neutral";
export type FeedbackDismissPolicy = "auto" | "click" | "manual" | "decision";
export type FeedbackBusyScope = "story" | "audio" | "fishing" | "combat" | "turn-combat" | "rare-reveal";

export type FeedbackDetail = {
  labelKey: string;
  labelParams?: FeedbackTextParams;
  value: ReactNode;
  emphasis?: boolean;
  delta?: "up" | "down" | "neutral";
};

export type FeedbackAction = {
  labelKey: string;
  tone?: "primary" | "secondary" | "danger";
  onSelect: () => void;
};

export type FeedbackInput = {
  variant: FeedbackVariant;
  /** Stable identity of the completed action. All presenters for one action must share it. */
  eventId?: string;
  receiptId?: string;
  /** L0/L1/L2/L3/D is semantic importance, independent of visual skin. */
  level?: FeedbackLevel;
  outcome?: FeedbackOutcome;
  domain?: string;
  rarity?: number;
  firstObtain?: boolean;
  milestoneId?: string;
  presentationOwner?: string;
  safeAfter?: FeedbackBusyScope;
  dismissPolicy?: FeedbackDismissPolicy;
  record?: boolean;
  rewards?: string[];
  costs?: string[];
  impacts?: string[];
  priority?: FeedbackPriority;
  tone?: FeedbackTone;
  titleKey: string;
  bodyKey?: string;
  params?: FeedbackTextParams;
  icon?: string;
  imageSrc?: string;
  details?: FeedbackDetail[];
  actions?: FeedbackAction[];
  durationMs?: number;
  dedupeKey?: string;
  anchor?: { x: number; y: number; element?: HTMLElement };
  scope?: "world" | "combat";
  className?: string;
};

export type FeedbackItem = FeedbackInput & {
  id: string;
  createdAt: number;
  expiresAt?: number;
  count: number;
  level: FeedbackLevel;
  dismissPolicy: FeedbackDismissPolicy;
};

export type FeedbackHistoryItem = {
  id: string;
  createdAt: number;
  variant: FeedbackVariant;
  level: FeedbackLevel;
  tone: FeedbackTone;
  title: string;
  body: string;
  eventId?: string;
  receiptId?: string;
  rewards?: string[];
  costs?: string[];
  impacts?: string[];
};

export type FeedbackApi = {
  publish: (input: FeedbackInput) => string | null;
  toast: (input: Omit<FeedbackInput, "variant">) => string | null;
  float: (input: Omit<FeedbackInput, "variant">) => string | null;
  inspect: (input: Omit<FeedbackInput, "variant">) => string | null;
  popover: (input: Omit<FeedbackInput, "variant">) => string | null;
  compare: (input: Omit<FeedbackInput, "variant">) => string | null;
  confirm: (input: Omit<FeedbackInput, "variant" | "actions">) => Promise<boolean>;
  dismiss: (id?: string) => void;
  openHistory: () => void;
  setBusy: (scope: FeedbackBusyScope, busy: boolean) => void;
  setCombatBusy: (busy: boolean) => void;
};
