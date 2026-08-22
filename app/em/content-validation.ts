import type { CharacterDefinition, SceneDefinition } from "../game/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validId(value: unknown) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9._-]{1,60}$/i.test(value);
}

export function validateCharacter(input: unknown) {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["人物必须是一个对象"] };
  if (!validId(input.id)) errors.push("人物 ID 只能使用字母、数字、点、横线和下划线");
  for (const key of ["name", "role", "courtesy", "bio", "sceneId", "image", "accent", "lovedGift"]) {
    if (typeof input[key] !== "string" || !String(input[key]).trim()) errors.push(`缺少 ${key}`);
  }
  if (!Array.isArray(input.ambientLines) || !input.ambientLines.every((item) => typeof item === "string")) errors.push("ambientLines 必须是台词数组");
  if (input.presence !== undefined) {
    if (!isRecord(input.presence) || !["resident", "random"].includes(String(input.presence.mode))) errors.push("presence.mode 必须是 resident 或 random");
    else {
      if (!Array.isArray(input.presence.guaranteedRules)) errors.push("guaranteedRules 必须是数组");
      if (!Array.isArray(input.presence.randomRules)) errors.push("randomRules 必须是数组");
      if (Array.isArray(input.presence.randomRules)) input.presence.randomRules.forEach((rule, index) => {
        if (!isRecord(rule) || !Number.isFinite(rule.probability) || Number(rule.probability) < 0 || Number(rule.probability) > 100) errors.push(`第 ${index + 1} 条随机出现概率必须在 0—100 之间`);
      });
    }
  }
  if (input.appearances !== undefined) {
    if (!Array.isArray(input.appearances) || !input.appearances.length) errors.push("appearances 至少需要一个场景配置");
    else {
      const scenes = new Set<string>();
      input.appearances.forEach((appearance, index) => {
        if (!isRecord(appearance) || typeof appearance.sceneId !== "string" || !appearance.sceneId.trim()) errors.push(`第 ${index + 1} 个出现配置缺少场景`);
        else if (scenes.has(appearance.sceneId)) errors.push(`场景 ${appearance.sceneId} 被重复配置`); else scenes.add(appearance.sceneId);
        if (!isRecord(appearance) || !["resident", "random"].includes(String(appearance.mode))) errors.push(`第 ${index + 1} 个出现方式无效`);
        if (!isRecord(appearance) || !Array.isArray(appearance.guaranteedRules) || !Array.isArray(appearance.randomRules)) errors.push(`第 ${index + 1} 个出现规则数组无效`);
      });
    }
  }
  if(input.relationshipStages!==undefined){if(!Array.isArray(input.relationshipStages)||!input.relationshipStages.length)errors.push("relationshipStages 至少需要一个阶段");else input.relationshipStages.forEach((stage,index)=>{if(!isRecord(stage)||typeof stage.id!=="string"||typeof stage.name!=="string"||typeof stage.addressing!=="string"||typeof stage.description!=="string"||!Number.isFinite(stage.min)||Number(stage.min)<0||Number(stage.min)>100)errors.push(`第 ${index+1} 个关系阶段无效`)})}
  if(input.giftPreferences!==undefined){if(!Array.isArray(input.giftPreferences))errors.push("giftPreferences 必须是数组");else{const seen=new Set<string>();input.giftPreferences.forEach((preference,index)=>{if(!isRecord(preference)||typeof preference.giftId!=="string"||!["loved","liked","neutral","disliked"].includes(String(preference.tier))||typeof preference.reaction!=="string")errors.push(`第 ${index+1} 个礼物偏好无效`);else if(seen.has(preference.giftId))errors.push(`礼物 ${preference.giftId} 被重复配置`);else seen.add(preference.giftId)})}}
  if(input.seekingRules!==undefined){if(!Array.isArray(input.seekingRules))errors.push("seekingRules 必须是数组");else input.seekingRules.forEach((rule,index)=>{if(!isRecord(rule)||typeof rule.id!=="string"||typeof rule.label!=="string"||typeof rule.intro!=="string"||!Array.isArray(rule.periods)||!Array.isArray(rule.conditions)||!Number.isFinite(rule.probability)||Number(rule.probability)<0||Number(rule.probability)>100||!Number.isFinite(rule.cooldownDays)||!Number.isFinite(rule.priority))errors.push(`第 ${index+1} 个主动相遇规则无效`)})}
  if(input.interactions!==undefined){
    if(!isRecord(input.interactions))errors.push("interactions 必须是互动配置对象");
    else if(input.interactions.drinking!==undefined){const drinking=input.interactions.drinking;if(!isRecord(drinking)||typeof drinking.enabled!=="boolean"||!Array.isArray(drinking.sceneIds)||!drinking.sceneIds.length||!Array.isArray(drinking.periods)||!drinking.periods.length||!Number.isFinite(drinking.minRelationship)||Number(drinking.minRelationship)<0||Number(drinking.minRelationship)>100||!Number.isInteger(drinking.maxAttempts)||Number(drinking.maxAttempts)<1||Number(drinking.maxAttempts)>20||!Number.isFinite(drinking.targetScore)||Number(drinking.targetScore)<1||!Number.isInteger(drinking.specialWinCount)||Number(drinking.specialWinCount)<1)errors.push("喝酒互动需要有效的场景、时段、好感门槛、点击次数、目标分和特殊事件次数");else if(Number(drinking.targetScore)>Number(drinking.maxAttempts)*3)errors.push("喝酒互动的目标分不能超过点击次数 × 3，否则无法达成")}
  }
  return { valid: !errors.length, errors, character: errors.length ? undefined : input as CharacterDefinition };
}

export function validateScene(input: unknown) {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["场景必须是一个对象"] };
  if (!validId(input.id)) errors.push("场景 ID 只能使用字母、数字、点、横线和下划线");
  for (const key of ["name", "shortName", "description", "atmosphere", "image"]) {
    if (typeof input[key] !== "string" || !String(input[key]).trim()) errors.push(`缺少 ${key}`);
  }
  if (!Array.isArray(input.characters)) errors.push("characters 必须是数组");
  if(input.minigameDifficulty!==undefined){if(!isRecord(input.minigameDifficulty))errors.push("minigameDifficulty 必须是小游戏难度对象");else if(input.minigameDifficulty.drinking!==undefined&&(!Number.isInteger(input.minigameDifficulty.drinking)||Number(input.minigameDifficulty.drinking)<1||Number(input.minigameDifficulty.drinking)>9))errors.push("喝酒场景难度必须是 1—9 阶整数")}
  if (input.variants !== undefined) {
    if (!Array.isArray(input.variants)) errors.push("variants 必须是数组");
    else input.variants.forEach((variant, index) => {
      if (!isRecord(variant) || typeof variant.id !== "string" || typeof variant.image !== "string" || !Array.isArray(variant.conditions) || !Number.isFinite(variant.priority)) errors.push(`第 ${index + 1} 个场景变体配置无效`);
    });
  }
  return { valid: !errors.length, errors, scene: errors.length ? undefined : input as SceneDefinition };
}
