"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFeedback } from "./FeedbackProvider";
import type { FeedbackInput } from "./types";

export function Inspectable({ feedback, children, className = "", mode = "sheet", ...buttonProps }: {
  feedback: Omit<FeedbackInput, "variant">;
  children: ReactNode;
  mode?: "sheet" | "popover";
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onClick">) {
  const { inspect, popover } = useFeedback();
  return <button type="button" className={`feedback-inspectable ${className}`.trim()} onClick={(event) => mode === "popover" ? popover({ ...feedback, anchor: { x: event.clientX, y: event.clientY, element: event.currentTarget } }) : inspect(feedback)} {...buttonProps}>{children}</button>;
}
