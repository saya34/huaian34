export const PROFICIENCY_NAMES = ["初尝", "浅酌", "渐熟", "善饮", "酒中熟手", "千杯不乱", "解意入微", "饮中宗师", "醉里仙"] as const;
export const DIFFICULTY_NAMES = ["闲适", "舒缓", "渐紧", "棘手", "险峻", "凌厉", "刁钻", "极险", "无常"] as const;
export const PROFICIENCY_THRESHOLDS = [0, 3, 7, 12, 18, 25, 33, 42, 52] as const;

export type ProficiencyProfile = {
  level: number;
  name: string;
  experience: number;
  currentFloor: number;
  nextThreshold: number | null;
  progress: number;
};

export type ResolvedMinigameDifficulty = {
  sceneLevel: number;
  roundPressure: number;
  skillRelief: number;
  effectiveLevel: number;
  name: string;
};

export function clampTier(value:number){return Math.max(1,Math.min(9,Math.round(value||1)))}

export function getProficiencyProfile(experience:number):ProficiencyProfile{
  const safe=Math.max(0,Math.floor(experience||0));
  let level=1;
  for(let index=PROFICIENCY_THRESHOLDS.length-1;index>=0;index-=1){if(safe>=PROFICIENCY_THRESHOLDS[index]){level=index+1;break}}
  const currentFloor=PROFICIENCY_THRESHOLDS[level-1];
  const nextThreshold=level<9?PROFICIENCY_THRESHOLDS[level]:null;
  const progress=nextThreshold===null?1:(safe-currentFloor)/(nextThreshold-currentFloor);
  return{level,name:PROFICIENCY_NAMES[level-1],experience:safe,currentFloor,nextThreshold,progress:Math.max(0,Math.min(1,progress))};
}

export function resolveMinigameDifficulty(sceneDifficulty:number,round:number,proficiencyLevel:number,random:()=>number=Math.random):ResolvedMinigameDifficulty{
  const sceneLevel=clampTier(sceneDifficulty);
  const safeRound=Math.max(1,Math.floor(round));
  const roundPressure=safeRound===1?0:safeRound===2?1:Math.min(5,safeRound);
  const skillLevel=clampTier(proficiencyLevel);
  const reliefChance=(skillLevel-1)/8;
  const maxRelief=Math.max(1,Math.ceil((skillLevel-1)/2));
  const skillRelief=random()<reliefChance?1+Math.floor(random()*maxRelief):0;
  const effectiveLevel=clampTier(sceneLevel+roundPressure-skillRelief);
  return{sceneLevel,roundPressure,skillRelief,effectiveLevel,name:DIFFICULTY_NAMES[effectiveLevel-1]};
}
