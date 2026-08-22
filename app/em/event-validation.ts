import type { Condition, Effect, EventDefinition, EventNode } from "../game/types";
import { AUDIO_FRAMES } from "../game/audio-frames";

const triggers = new Set(["scene_enter", "talk", "gift", "time_change", "map_event", "calendar_event", "inspection", "interaction"]);
const eventTypes = new Set(["主线", "相识", "心事", "赠礼", "情缘", "闲谈"]);
const gifts = new Set(["snowTea", "peachWine", "herbSachet", "goldHairpin", "osmanthusCake"]);
const periods = new Set(["清晨", "黄昏", "夜晚"]);
const stageEffects = new Set(["none", "soft_glow", "heartbeat", "shake"]);
const audioFrameIds = new Set<string>(AUDIO_FRAMES.map((frame) => frame.id));

function validId(value: unknown) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9._-]{1,80}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function checkEffect(value: unknown, path: string, errors: string[]) {
  if (!isRecord(value) || typeof value.type !== "string") return errors.push(`${path} 不是有效效果`);
  if (value.type === "relationship") {
    if (!validId(value.characterId) || typeof value.amount !== "number") errors.push(`${path} 的好感效果参数不完整`);
  } else if (value.type === "set_flag") {
    if (typeof value.key !== "string" || typeof value.value !== "boolean") errors.push(`${path} 的标记效果参数不完整`);
  } else if (value.type === "consume_gift") {
    if (!gifts.has(String(value.giftId)) || typeof value.amount !== "number") errors.push(`${path} 的礼物效果参数不完整`);
  } else errors.push(`${path} 使用了未知效果类型`);
}

function checkCondition(value: unknown, index: number, errors: string[]) {
  if (!isRecord(value) || typeof value.type !== "string") return errors.push(`条件 ${index + 1} 无效`);
  const label = `条件 ${index + 1}`;
  if (value.type === "scene" && !validId(value.value)) errors.push(`${label} 的场景 ID 无效`);
  else if (value.type === "character" && !validId(value.value)) errors.push(`${label} 的人物 ID 无效`);
  else if (value.type === "gift" && !gifts.has(String(value.value))) errors.push(`${label} 的礼物不存在`);
  else if (value.type === "period" && !periods.has(String(value.value))) errors.push(`${label} 的时段不存在`);
  else if (value.type === "relationship" && (!validId(value.characterId) || typeof value.min !== "number")) errors.push(`${label} 的缘分门槛不完整`);
  else if (value.type === "event_completed" && typeof value.eventId !== "string") errors.push(`${label} 缺少前置事件 ID`);
  else if (value.type === "flag" && (typeof value.key !== "string" || typeof value.value !== "boolean")) errors.push(`${label} 的剧情标记不完整`);
  else if (!["scene", "character", "gift", "period", "relationship", "event_completed", "flag"].includes(value.type)) errors.push(`${label} 使用了未知类型`);
}

export function validateEventDefinition(input: unknown) {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["事件必须是一个对象"] };
  for (const key of ["id", "title", "subtitle", "chapter", "clue", "start"]) {
    if (typeof input[key] !== "string" || !String(input[key]).trim()) errors.push(`缺少 ${key}`);
  }
  if (typeof input.id === "string" && !/^[a-z0-9][a-z0-9._-]{2,80}$/i.test(input.id)) errors.push("事件 ID 只能使用字母、数字、点、横线和下划线");
  if (!eventTypes.has(String(input.type))) errors.push("事件类型无效");
  if (!triggers.has(String(input.trigger))) errors.push("触发方式无效");
  if (!validId(input.sceneId)) errors.push("场景 ID 无效");
  if (!validId(input.characterId)) errors.push("人物 ID 无效");
  if (typeof input.priority !== "number" || input.priority < 0 || input.priority > 999) errors.push("优先级应为 0—999");
  if (input.weight !== undefined && (typeof input.weight !== "number" || input.weight <= 0)) errors.push("随机权重必须大于 0");
  if (typeof input.once !== "boolean" || typeof input.journal !== "boolean") errors.push("once 与 journal 必须为布尔值");
  if (input.cardStyle !== undefined && !["normal", "special", "audio", "easter_egg", "trigger_point"].includes(String(input.cardStyle))) errors.push("事件卡类型无效");
  if (input.cardStyle === "special") {
    if (!["none", "flash_white", "flash_black"].includes(String(input.openingEffect))) errors.push("特殊事件需要选择开场动效");
    if (typeof input.defaultPortrait !== "string" || !input.defaultPortrait.trim()) errors.push("特殊事件需要设置默认特殊立绘");
  }
  if (input.cardStyle === "audio") {
    if (input.audioFrameId !== undefined && !audioFrameIds.has(String(input.audioFrameId))) errors.push("音画事件边框预设无效");
    if (typeof input.unlockTitle !== "string" || !input.unlockTitle.trim()) errors.push("音画事件需要填写解锁文案");
    if (!Array.isArray(input.audioSegments) || !input.audioSegments.length) errors.push("音画事件至少需要一个素材段落");
    else input.audioSegments.forEach((segment,index)=>{
      if(!isRecord(segment)||typeof segment.id!=="string"||typeof segment.image!=="string"||!segment.image.trim()||typeof segment.audio!=="string"||!segment.audio.trim()||typeof segment.subtitle!=="string"||!segment.subtitle.trim())errors.push(`音画段落 ${index+1} 需要图片、音频与字幕`);
    });
  }
  if (input.cardStyle === "easter_egg" || input.cardStyle === "trigger_point") {
    if (!isRecord(input.exploration)) errors.push("探索点事件需要配置光点与发现画面");
    else {
      const config=input.exploration;
      if(typeof config.chance!=="number"||config.chance<0||config.chance>100)errors.push("探索点出现概率应为 0—100");
      if(!["random","fixed"].includes(String(config.positionMode)))errors.push("探索点位置模式无效");
      if(config.positionMode==="fixed"&&(typeof config.x!=="number"||typeof config.y!=="number"||config.x<8||config.x>92||config.y<8||config.y>72))errors.push("固定光点坐标超出安全区域");
      if(typeof config.image!=="string"||!config.image.trim())errors.push("探索点需要发现画面");
      if(typeof config.text!=="string"||!config.text.trim())errors.push("探索点需要发现文字");
      if(input.cardStyle==="easter_egg"){
        if(!isRecord(config.rewardItem))errors.push("彩蛋事件需要配置获得物品");
        else if(!validId(config.rewardItem.id)||typeof config.rewardItem.name!=="string"||!config.rewardItem.name.trim()||typeof config.rewardItem.image!=="string"||!config.rewardItem.image.trim()||typeof config.rewardItem.description!=="string"||!config.rewardItem.description.trim())errors.push("彩蛋物品的 ID、名称、图片与说明必须完整");
      }
    }
    if(input.trigger!=="scene_enter"&&input.trigger!=="time_change")errors.push("探索点事件只能由进入场景或时辰变化触发");
  }
  if (input.trigger === "map_event") {
    if (input.cardStyle !== "special" && input.cardStyle !== "audio") errors.push("地图限时事件只能挂载特殊事件或音画事件");
    if (input.once !== true) errors.push("地图限时事件必须设置为仅触发一次");
    if (!isRecord(input.mapEvent)) errors.push("地图限时事件需要配置地图、随机窗口与坐标");
    else {
      if (!["yunzhou", "canglan", "chixia"].includes(String(input.mapEvent.mapId))) errors.push("地图限时事件的所属地图无效");
      if (typeof input.mapEvent.windowDays !== "number" || input.mapEvent.windowDays < 1 || input.mapEvent.windowDays > 90) errors.push("地图事件随机窗口应为 1—90 天");
      if (typeof input.mapEvent.x !== "number" || input.mapEvent.x < 5 || input.mapEvent.x > 95 || typeof input.mapEvent.y !== "number" || input.mapEvent.y < 5 || input.mapEvent.y > 95) errors.push("地图事件坐标应位于 5%—95% 的安全区域");
    }
  }
  if (input.trigger === "calendar_event") {
    if (input.cardStyle === "easter_egg" || input.cardStyle === "trigger_point") errors.push("固定日期事件不支持彩蛋或场景触发点演出");
    if (!isRecord(input.calendarEvent)) errors.push("固定日期事件需要配置月份、日期与日历涂鸦");
    else {
      if (input.calendarEvent.mode !== "fixed") errors.push("EM 当前仅支持固定日期；周期日期事件请在代码中配置");
      if (!Number.isInteger(input.calendarEvent.month) || Number(input.calendarEvent.month) < 1 || Number(input.calendarEvent.month) > 12) errors.push("固定日期事件月份应为 1—12");
      if (!Number.isInteger(input.calendarEvent.day) || Number(input.calendarEvent.day) < 1 || Number(input.calendarEvent.day) > 30) errors.push("固定日期事件日期应为 1—30");
      if (!["birthday", "auction", "festival", "meeting", "story"].includes(String(input.calendarEvent.doodle))) errors.push("固定日期事件的日历涂鸦无效");
    }
  }
  if (input.trigger === "inspection") {
    if (!isRecord(input.inspection)) errors.push("夜间检视事件需要配置触发概率与地图提示");
    else {
      if (typeof input.inspection.chance !== "number" || input.inspection.chance < 0 || input.inspection.chance > 100) errors.push("检视事件触发概率应为 0—100");
      if (typeof input.inspection.hint !== "boolean") errors.push("检视事件需要明确是否显示眼睛提示");
    }
  }
  if(input.trigger==="interaction"&&(typeof input.interactionId!=="string"||!input.interactionId.trim()))errors.push("互动完成事件需要填写互动 ID，例如 drinking");
  if (!Array.isArray(input.conditions)) errors.push("conditions 必须是数组");
  else {
    input.conditions.forEach((item, index) => checkCondition(item, index, errors));
    if ((input.trigger === "scene_enter" || input.trigger === "time_change" || input.trigger === "map_event") && input.conditions.some((item) => isRecord(item) && (item.type === "character" || item.type === "gift"))) {
      errors.push("进入场景、时辰变化或地图事件没有人物与礼物操作上下文，请移除对应条件");
    }
    if (input.trigger === "calendar_event" && input.conditions.some((item) => isRecord(item) && item.type === "gift")) errors.push("固定日期事件没有赠礼操作上下文，请移除礼物条件");
    if (input.trigger === "inspection" && input.conditions.some((item) => isRecord(item) && (item.type === "character" || item.type === "gift"))) errors.push("检视事件没有人物与礼物操作上下文，请使用好感度等前置条件");
    if (input.trigger === "interaction" && input.conditions.some((item) => isRecord(item) && item.type === "gift")) errors.push("互动完成事件没有赠礼上下文，请移除礼物条件");
  }
  if (!isRecord(input.nodes)) errors.push("nodes 必须是节点对象");
  else {
    const nodes = input.nodes as Record<string, unknown>;
    if (typeof input.start === "string" && !nodes[input.start]) errors.push("start 指向的起始节点不存在");
    for (const [key, raw] of Object.entries(nodes)) {
      if (!isRecord(raw) || raw.id !== key) { errors.push(`节点 ${key} 的 id 不一致`); continue; }
      if (raw.type === "line") {
        if (typeof raw.speaker !== "string" || typeof raw.text !== "string" || typeof raw.next !== "string") errors.push(`对话节点 ${key} 参数不完整`);
        else if (!nodes[raw.next]) errors.push(`节点 ${key} 指向不存在的 ${raw.next}`);
        if (Array.isArray(raw.effects)) raw.effects.forEach((effect, i) => checkEffect(effect, `${key} 效果 ${i + 1}`, errors));
      } else if (raw.type === "choice") {
        if (!Array.isArray(raw.options) || !raw.options.length) errors.push(`选择节点 ${key} 至少需要一个选项`);
        else raw.options.forEach((option, i) => {
          if (!isRecord(option) || typeof option.id !== "string" || typeof option.label !== "string" || typeof option.next !== "string") errors.push(`${key} 的选项 ${i + 1} 不完整`);
          else if (!nodes[option.next]) errors.push(`${key} 的选项 ${i + 1} 指向不存在的节点`);
          if (isRecord(option) && Array.isArray(option.effects)) option.effects.forEach((effect, j) => checkEffect(effect, `${key} 选项 ${i + 1} 效果 ${j + 1}`, errors));
        });
      } else if (raw.type === "end") {
        if (Array.isArray(raw.effects)) raw.effects.forEach((effect, i) => checkEffect(effect, `${key} 效果 ${i + 1}`, errors));
      } else errors.push(`节点 ${key} 使用了未知类型`);
      if (typeof raw.stageEffect === "string" && !stageEffects.has(raw.stageEffect)) errors.push(`节点 ${key} 的舞台动效无效`);
      if (raw.portrait !== undefined && typeof raw.portrait !== "string") errors.push(`节点 ${key} 的立绘地址无效`);
    }
  }
  return { valid: errors.length === 0, errors, event: errors.length ? undefined : input as EventDefinition };
}

export function parentEventId(event: EventDefinition) {
  return (event.conditions.find((item) => item.type === "event_completed") as Extract<Condition, { type: "event_completed" }> | undefined)?.eventId ?? null;
}

export function eventEffects(node: EventNode): Effect[] {
  if (node.type === "choice") return node.options.flatMap((item) => item.effects ?? []);
  return node.effects ?? [];
}
