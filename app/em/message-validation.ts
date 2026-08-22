import type { CharacterMessageDefinition } from "../game/types";

function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==="object"&&!Array.isArray(value)}

export function validateCharacterMessage(input:unknown){
  const errors:string[]=[];
  if(!isRecord(input))return{valid:false,errors:["传音必须是一个对象"]};
  if(typeof input.id!=="string"||!/^[a-z0-9][a-z0-9._-]{1,80}$/i.test(input.id))errors.push("传音 ID 格式无效");
  for(const key of ["senderCharacterId","title","body","signature"])if(typeof input[key]!=="string"||!String(input[key]).trim())errors.push(`缺少 ${key}`);
  if(!Array.isArray(input.conditions)||!input.conditions.length)errors.push("至少需要一个发送条件");
  if(input.relationshipAmount!==undefined&&(!Number.isFinite(input.relationshipAmount)||Number(input.relationshipAmount)<0))errors.push("缘分奖励不能小于 0");
  if(input.giftId!==undefined&&typeof input.giftId!=="string")errors.push("giftId 必须是字符串");
  if(input.giftAmount!==undefined&&(!Number.isInteger(input.giftAmount)||Number(input.giftAmount)<1))errors.push("礼物数量至少为 1");
  return{valid:!errors.length,errors,message:errors.length?undefined:input as CharacterMessageDefinition};
}
