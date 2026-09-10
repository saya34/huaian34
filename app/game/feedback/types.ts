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

export type FeedbackDetail = {
  labelKey: string;
  labelParams?: FeedbackTextParams;
  value: ReactNode;
  emphasis?: boolean;
};

export type FeedbackAction = {
  labelKey: string;
  tone?: "primary" | "secondary" | "danger";
  onSelect: () => void;
};

export type FeedbackInput = {
  variant: FeedbackVariant;
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
  anchor?: { x: number; y: number };
  className?: string;
};

export type FeedbackItem = FeedbackInput & {
  id: string;
  createdAt: number;
  count: number;
};

export type FeedbackHistoryItem = {
  id: string;
  createdAt: number;
  variant: FeedbackVariant;
  tone: FeedbackTone;
  title: string;
  body: string;
};

export type FeedbackApi = {
  publish: (input: FeedbackInput) => string | null;
  toast: (input: Omit<FeedbackInput, "variant">) => string | null;
  float: (input: Omit<FeedbackInput, "variant">) => string | null;
  inspect: (input: Omit<FeedbackInput, "variant">) => string | null;
  compare: (input: Omit<FeedbackInput, "variant">) => string | null;
  confirm: (input: Omit<FeedbackInput, "variant" | "actions">) => Promise<boolean>;
  dismiss: (id?: string) => void;
  openHistory: () => void;
};
