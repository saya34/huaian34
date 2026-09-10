"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFeedback } from "./FeedbackProvider";
import type { FeedbackInput } from "./types";

export function Inspectable({ feedback, children, className = "", ...buttonProps }: {
  feedback: Omit<FeedbackInput, "variant">;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onClick">) {
  const { inspect } = useFeedback();
  return <button type="button" className={`feedback-inspectable ${className}`.trim()} onClick={() => inspect(feedback)} {...buttonProps}>{children}</button>;
}
