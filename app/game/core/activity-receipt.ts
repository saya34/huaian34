import type { ActivityReceipt } from "./types";

export function createActivityReceipt(input: Omit<ActivityReceipt, "id" | "createdAt">): ActivityReceipt {
  const createdAt = Date.now();
  return { ...input, id: `${input.kind}:${createdAt}`, createdAt };
}
