export type PlayerGrowth = { playerLevel:number; playerExperience:number };

export const MAX_PLAYER_LEVEL = 60;

export function stageClearExperience(waveId:number){
  return Math.round(100*1.18**Math.max(0,Math.min(20,waveId-1)));
}

export function experienceToNextLevel(level:number){
  if(level>=MAX_PLAYER_LEVEL)return 0;
  const matchingWave=1+Math.round((level-1)*20/(MAX_PLAYER_LEVEL-2));
  const desiredClears=1+9*(level-1)/(MAX_PLAYER_LEVEL-2);
  return Math.round(stageClearExperience(matchingWave)*desiredClears);
}

/** 唯一角色成长结算：经验永远保存为当前等级内的余量。 */
export function grantPlayerExperience(current:PlayerGrowth,amount:number){
  let playerLevel=Math.max(1,Math.min(MAX_PLAYER_LEVEL,Math.floor(current.playerLevel||1)));
  let playerExperience=Math.max(0,Math.floor(current.playerExperience||0)+Math.floor(amount));
  let levelsGained=0;
  while(playerLevel<MAX_PLAYER_LEVEL){
    const needed=experienceToNextLevel(playerLevel);
    if(playerExperience<needed)break;
    playerExperience-=needed;playerLevel+=1;levelsGained+=1;
  }
  if(playerLevel>=MAX_PLAYER_LEVEL)playerExperience=0;
  return{playerLevel,playerExperience,levelsGained,gained:Math.max(0,Math.floor(amount))};
}

export function normalizePlayerGrowth(current:PlayerGrowth){
  return grantPlayerExperience({playerLevel:current.playerLevel,playerExperience:0},current.playerExperience);
}
