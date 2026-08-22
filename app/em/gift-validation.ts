import type { GiftDefinition } from "../game/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateGift(input: unknown) {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["礼物必须是一个对象"] };
  if (typeof input.id !== "string" || !/^[a-z0-9][a-z0-9._-]{1,60}$/i.test(input.id)) errors.push("礼物 ID 只能使用字母、数字、点、横线和下划线");
  for (const key of ["name", "description", "icon", "image"]) if (typeof input[key] !== "string" || !String(input[key]).trim()) errors.push(`缺少 ${key}`);
  if (!Array.isArray(input.tags) || !input.tags.every((item) => typeof item === "string")) errors.push("tags 必须是字符串数组");
  if (!Number.isInteger(input.initialCount) || Number(input.initialCount) < 0 || Number(input.initialCount) > 999) errors.push("initialCount 必须是 0—999 的整数");
  if (input.imagePosition !== undefined && typeof input.imagePosition !== "string") errors.push("imagePosition 必须是字符串");
  return { valid: !errors.length, errors, gift: errors.length ? undefined : input as GiftDefinition };
}
