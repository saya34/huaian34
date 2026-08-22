import type { GlobalKeyDefinition } from "../game/types";

export function validateGlobalKey(input: unknown) {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { valid: false, errors: ["全局 Key 必须是对象"] };
  const value = input as Record<string, unknown>;
  if (typeof value.id !== "string" || !/^[a-z0-9][a-z0-9._-]{1,80}$/i.test(value.id)) errors.push("Key ID 只能使用字母、数字、点、横线和下划线");
  for (const field of ["name", "category", "description"]) if (typeof value[field] !== "string" || !String(value[field]).trim()) errors.push(`缺少 ${field}`);
  if (typeof value.initialValue !== "boolean") errors.push("initialValue 必须是布尔值");
  if (value.triggerMode !== undefined && !["manual", "automatic", "both"].includes(String(value.triggerMode))) errors.push("triggerMode 无效");
  if (value.autoRules !== undefined && !Array.isArray(value.autoRules)) errors.push("autoRules 必须是数组");
  if (Array.isArray(value.autoRules)) value.autoRules.forEach((rule,index)=>{
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) { errors.push(`第 ${index+1} 条自动规则无效`); return; }
    const item=rule as Record<string,unknown>;
    if(typeof item.id!=="string"||typeof item.label!=="string"||!Array.isArray(item.conditions)||!item.conditions.length)errors.push(`第 ${index+1} 条自动规则需要 ID、说明与条件`);
  });
  if (value.announcement !== undefined) {
    if (!value.announcement || typeof value.announcement !== "object" || Array.isArray(value.announcement)) errors.push("announcement 必须是对象");
    else {
      const announcement=value.announcement as Record<string,unknown>;
      if(typeof announcement.enabled!=="boolean")errors.push("announcement.enabled 必须是布尔值");
      if(announcement.enabled&&(typeof announcement.title!=="string"||!announcement.title.trim()))errors.push("开启公告后必须填写公告标题");
      if(announcement.enabled&&(typeof announcement.message!=="string"||!announcement.message.trim()))errors.push("开启公告后必须填写公告正文");
    }
  }
  return { valid: !errors.length, errors, key: errors.length ? undefined : value as GlobalKeyDefinition };
}
