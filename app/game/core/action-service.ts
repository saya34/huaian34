import actionsJson from "./content/actions.json";
export type ActionId=keyof typeof actionsJson;
export type ActionCost={label:string;stamina:number;timeStages:number;chargeOn:"start"|"success"};
export const ACTION_COSTS=actionsJson as Record<ActionId,ActionCost>;
export function checkActionAdmission(actionId:ActionId,state:{stamina:number}){const cost=ACTION_COSTS[actionId];return state.stamina<cost.stamina?{ok:false as const,cost,message:`体力不足：${cost.label}需要 ${cost.stamina} 点体力`}:{ok:true as const,cost,message:""};}
export function checkActionUnits(actionId:ActionId,state:{stamina:number},units=1){const cost=ACTION_COSTS[actionId];const stamina=cost.stamina*Math.max(1,Math.floor(units));return state.stamina<stamina?{ok:false as const,cost:{...cost,stamina},message:`体力不足：${cost.label}需要 ${stamina} 点体力`}:{ok:true as const,cost:{...cost,stamina},message:""};}
export function actionCostLabel(actionId:ActionId){const cost=ACTION_COSTS[actionId];const parts=[];if(cost.stamina)parts.push(`体力 ${cost.stamina}`);if(cost.timeStages)parts.push(`${cost.timeStages} 个时段`);return parts.length?parts.join(" · "):"无行动消耗";}
