import { MATERIALS, type GameItem } from "../alchemy/item-data";

export type MiningMapId = "yunzhou" | "canglan" | "chixia";
export type MiningLocationId = "yunzhou-mine" | "yunzhou-vein" | "canglan-vein" | "chixia-vein";
export type MiningLocation = { id: MiningLocationId; name: string; subtitle: string; kind: "resident" | "random"; mapId: MiningMapId; x?: number; y?: number; pool: Array<{ materialName: string; weight: number }> };
export type MineSoilType = "loose" | "clay" | "stone" | "crystal" | "ancient";
export type MineKeyId = "bronze" | "jade" | "star";
export type MineTileKind = "entrance" | MineSoilType | "wall" | "chest" | "deep-chest";
export type MineTileState = "hidden" | "revealed" | "dug" | "opened";
export type MineTile = { id:string;x:number;y:number;depth:number;kind:MineTileKind;state:MineTileState;hp:number;maxHp:number;keyId?:MineKeyId;rewardSeed:string };
export type MiningMaze = { id:string;width:number;height:number;floor:number;tiles:MineTile[];deepestOpened:number;completed:boolean };
export type RandomMiningSpot = { id:string;locationId:MiningLocationId;mapId:MiningMapId;x:number;y:number;spawnDay:number;durability:number;maxDurability:number;maze:MiningMaze };
export type MiningNode = { id:string;materialName:string;minedAtTick:number;readyAtTick:number;recoveryTicks:number;tier:1|2|3 };
export type MiningProgress = {
  /** Legacy count kept only so older saves remain readable. */
  pickaxes:number;
  pickaxeLevel:1|2|3;
  pickaxeDurability:number;
  pickaxeMaxDurability:number;
  keys:Record<MineKeyId,number>;
  treasureMapFragments:number;
  treasureMapAssembled:boolean;
  residentFloor:number;
  residentMaze:MiningMaze;
  dailyDay:number;
  randomSpots:RandomMiningSpot[];
  lastSpawnDay:number;
  totalMined:number;
  records:Record<string,number>;
  strikeSerial:number;
  residentDurability:number;
  residentMaxDurability:number;
  residentNodes:MiningNode[];
};

export type MiningReward = {kind:"item"|"currency"|"key"|"map-fragment";name:string;amount:number;rarity:1|2|3|4|5|6|7;image:string;itemId?:string;itemType?:"material"|"treasure"|"quest";keyId?:MineKeyId};

export const MINING_LOCATIONS:MiningLocation[]=[
  {id:"yunzhou-mine",name:"玄铁常明矿窟",subtitle:"常驻矿洞 · 深层迷宫可持续下探",kind:"resident",mapId:"yunzhou",x:84,y:60,pool:[{materialName:"黑曜火铁",weight:42},{materialName:"星陨铁",weight:30},{materialName:"雷纹紫晶",weight:20},{materialName:"太初玉髓",weight:8}]},
  {id:"yunzhou-vein",name:"云州游光地宫",subtitle:"随机矿脉 · 探索完成后消失",kind:"random",mapId:"yunzhou",pool:[{materialName:"星陨铁",weight:40},{materialName:"黑曜火铁",weight:32},{materialName:"金乌翎石",weight:20},{materialName:"太初玉髓",weight:8}]},
  {id:"canglan-vein",name:"沧澜寒晶地宫",subtitle:"随机矿脉 · 寒潮深窟",kind:"random",mapId:"canglan",pool:[{materialName:"寒渊玄冰",weight:48},{materialName:"雷纹紫晶",weight:30},{materialName:"星陨铁",weight:16},{materialName:"太初玉髓",weight:6}]},
  {id:"chixia-vein",name:"赤霞熔金地宫",subtitle:"随机矿脉 · 炎脉深窟",kind:"random",mapId:"chixia",pool:[{materialName:"黑曜火铁",weight:44},{materialName:"金乌翎石",weight:31},{materialName:"雷纹紫晶",weight:18},{materialName:"太初玉髓",weight:7}]},
];

export const SOIL_DEFINITIONS:Record<MineSoilType,{name:string;hardness:number;durabilityCost:number;rarity:number;glyph:string}>={
  loose:{name:"松软灵土",hardness:5,durabilityCost:1,rarity:1,glyph:"土"},clay:{name:"赤黏土",hardness:9,durabilityCost:2,rarity:1,glyph:"壤"},stone:{name:"玄岩层",hardness:14,durabilityCost:3,rarity:2,glyph:"岩"},crystal:{name:"晶簇层",hardness:19,durabilityCost:4,rarity:3,glyph:"晶"},ancient:{name:"太古地层",hardness:25,durabilityCost:5,rarity:4,glyph:"古"},
};
export const KEY_DEFINITIONS:Record<MineKeyId,{name:string;glyph:string;rarity:2|3|4}>={bronze:{name:"青铜地宫钥",glyph:"铜",rarity:2},jade:{name:"碧玉地宫钥",glyph:"玉",rarity:3},star:{name:"星纹地宫钥",glyph:"星",rarity:4}};
export const miningLocationById=(id:string)=>MINING_LOCATIONS.find(location=>location.id===id);
export const miningMaterialByName=(name:string)=>MATERIALS.find(item=>item.name===name)!;
function hash(seed:string){let value=2166136261;for(let index=0;index<seed.length;index+=1)value=Math.imul(value^seed.charCodeAt(index),16777619);return(value>>>0)/4294967296;}
export function miningPool(location:MiningLocation){const total=location.pool.reduce((sum,entry)=>sum+entry.weight,0);return location.pool.map(entry=>({...entry,material:miningMaterialByName(entry.materialName),probability:entry.weight/total}));}
export function rollMiningMaterial(location:MiningLocation,seed:string,depthBias=0):GameItem{const entries=miningPool(location).map((entry,index)=>({...entry,adjusted:entry.probability*(1+depthBias*index*.24)}));const total=entries.reduce((sum,entry)=>sum+entry.adjusted,0);let roll=hash(seed)*total;for(const entry of entries){roll-=entry.adjusted;if(roll<=0)return entry.material;}return entries.at(-1)!.material;}
function soilForDepth(ratio:number,roll:number):MineSoilType{if(ratio>.78&&roll>.38)return"ancient";if(ratio>.54&&roll>.34)return"crystal";if(ratio>.3&&roll>.28)return"stone";return roll>.5?"clay":"loose";}
function tileBase(kind:MineTileKind){if(kind in SOIL_DEFINITIONS)return SOIL_DEFINITIONS[kind as MineSoilType].hardness;if(kind==="chest")return 1;return 0;}
function adjacent(tile:MineTile,other:MineTile){return Math.abs(tile.x-other.x)+Math.abs(tile.y-other.y)===1;}
function revealAround(tiles:MineTile[],origin:MineTile){return tiles.map(tile=>tile.state==="hidden"&&adjacent(origin,tile)?{...tile,state:"revealed" as const}:tile);}

export function createMiningMaze(id:string,floor=1,width=7,height=10):MiningMaze{
  const entranceX=Math.floor(width/2),safe=new Set<string>([`${entranceX}:0`]);let pathX=entranceX;
  for(let y=1;y<height;y+=1){const turn=Math.floor(hash(`${id}:path:${floor}:${y}`)*3)-1;pathX=Math.max(1,Math.min(width-2,pathX+turn));safe.add(`${pathX}:${y}`);}const deepKey=`${pathX}:${height-1}`;let tiles:MineTile[]=[];
  for(let y=0;y<height;y+=1)for(let x=0;x<width;x+=1){const key=`${x}:${y}`,ratio=(y+Math.min(5,floor-1)*.45)/(height-1+2),roll=hash(`${id}:${floor}:${key}`);let kind:MineTileKind;if(y===0&&x===entranceX)kind="entrance";else if(key===deepKey)kind="deep-chest";else if(!safe.has(key)&&roll<.16)kind="wall";else if(!safe.has(key)&&roll>.91)kind="chest";else kind=soilForDepth(ratio,hash(`${id}:soil:${floor}:${key}`));const maxHp=tileBase(kind),keyId=kind==="chest"?(ratio>.7?"star":ratio>.38?"jade":"bronze"):undefined;tiles.push({id:`${id}-${floor}-${x}-${y}`,x,y,depth:y,kind,state:kind==="entrance"?"dug":"hidden",hp:maxHp,maxHp,keyId,rewardSeed:`${id}:${floor}:${x}:${y}`});}
  const entrance=tiles.find(tile=>tile.kind==="entrance")!;tiles=revealAround(tiles,entrance);return{id:`${id}-floor-${floor}`,width,height,floor,tiles,deepestOpened:0,completed:false};
}

export function diggableTiles(maze:MiningMaze){return maze.tiles.filter(tile=>tile.kind!=="wall"&&tile.kind!=="entrance").length;}
export function remainingTiles(maze:MiningMaze){return maze.tiles.filter(tile=>tile.kind!=="wall"&&tile.kind!=="entrance"&&tile.state!=="dug"&&tile.state!=="opened").length;}
export function createInitialMining():MiningProgress{return{pickaxes:0,pickaxeLevel:1,pickaxeDurability:80,pickaxeMaxDurability:80,keys:{bronze:1,jade:0,star:0},treasureMapFragments:0,treasureMapAssembled:false,residentFloor:1,residentMaze:createMiningMaze("resident",1),dailyDay:1,randomSpots:[],lastSpawnDay:0,totalMined:0,records:{},strikeSerial:0,residentDurability:0,residentMaxDurability:0,residentNodes:[]};}
function normalizeMaze(value:MiningMaze|undefined,id:string,floor:number){if(!value?.tiles?.length)return createMiningMaze(id,floor);return{...value,tiles:value.tiles.map(tile=>({...tile,rewardSeed:tile.rewardSeed??`${id}:${tile.x}:${tile.y}`}))};}
export function normalizeMiningProgress(value?:Partial<MiningProgress>|null):MiningProgress{const base=createInitialMining(),floor=value?.residentFloor??value?.residentMaze?.floor??1,durability=value?.pickaxeDurability??Math.min(80,Math.max(24,(value?.pickaxes??6)*12));const spots=Array.isArray(value?.randomSpots)?value.randomSpots.map(spot=>{const maze=normalizeMaze(spot.maze,spot.id,1);return{...spot,maze,durability:remainingTiles(maze),maxDurability:diggableTiles(maze)}}):[];return{...base,...value,pickaxes:0,pickaxeDurability:durability,pickaxeMaxDurability:value?.pickaxeMaxDurability??80,keys:{...base.keys,...value?.keys},treasureMapFragments:value?.treasureMapFragments??0,treasureMapAssembled:value?.treasureMapAssembled??false,residentFloor:floor,residentMaze:normalizeMaze(value?.residentMaze,"resident",floor),randomSpots:spots,records:{...base.records,...value?.records},residentNodes:[]};}

const VEIN_COORDINATES:Record<MiningMapId,Array<[number,number]>>={yunzhou:[[17,63],[68,79],[31,26]],canglan:[[19,46],[64,72],[78,47]],chixia:[[31,77],[68,45],[81,67]]};
export function resetMiningDay(progress:MiningProgress,day:number){return progress.dailyDay===day?progress:{...progress,dailyDay:day};}
export function ensureRandomMiningSpots(progress:MiningProgress,day:number,highestUnlocked:number):MiningProgress{const current=resetMiningDay(progress,day);if(current.lastSpawnDay===day)return current;const maps:MiningMapId[]=["yunzhou"];if(highestUnlocked>=8)maps.push("canglan");if(highestUnlocked>=15)maps.push("chixia");const count=day%4===0?2:1;const spots=Array.from({length:count},(_,index)=>{const mapId=maps[Math.floor(hash(`ore-map:${day}:${index}`)*maps.length)],coords=VEIN_COORDINATES[mapId],[x,y]=coords[Math.floor(hash(`ore-pos:${day}:${index}`)*coords.length)],id=`ore-maze-${day}-${index}`,maze=createMiningMaze(id,Math.max(1,Math.ceil(day/5)));return{id,locationId:`${mapId}-vein` as MiningLocationId,mapId,x,y,spawnDay:day,durability:remainingTiles(maze),maxDurability:diggableTiles(maze),maze};});return{...current,randomSpots:spots,lastSpawnDay:day};}
export function activeMiningMaze(progress:MiningProgress,location:MiningLocation,spotId?:string){return location.kind==="resident"?progress.residentMaze:progress.randomSpots.find(spot=>spot.id===spotId)?.maze;}
function replaceMaze(progress:MiningProgress,location:MiningLocation,maze:MiningMaze,spotId?:string){if(location.kind==="resident")return{...progress,residentMaze:maze};return{...progress,randomSpots:progress.randomSpots.map(spot=>spot.id===spotId?{...spot,maze,durability:remainingTiles(maze)}:spot)};}
function powerFor(level:number){return level===3?10:level===2?7:5;}

function rollGroundReward(location:MiningLocation,tile:MineTile,serial:number):MiningReward|null{const depthRatio=tile.depth/9,roll=hash(`${tile.rewardSeed}:drop:${serial}`),image="/assets/activities/treasure-atlas.webp";if(roll<.07+depthRatio*.04){const keyId:MineKeyId=depthRatio>.72?"star":depthRatio>.38?"jade":"bronze",key=KEY_DEFINITIONS[keyId];return{kind:"key",keyId,name:key.name,amount:1,rarity:key.rarity,image};}if(roll<.17)return{kind:"currency",name:"地脉灵石",amount:12+Math.floor(depthRatio*48),rarity:1,image:"/assets/activities/spirit-stone-atlas.webp"};if(roll<.48+depthRatio*.28){const material=rollMiningMaterial(location,`${tile.rewardSeed}:ore`,depthRatio);return{kind:"item",itemId:material.id,itemType:"material",name:material.name,amount:1+(tile.kind==="ancient"?1:0),rarity:Math.max(1,Math.min(7,material.rarity)) as 1|2|3|4|5|6|7,image:material.image};}if(roll>.94-depthRatio*.05)return{kind:"item",itemId:"buried-ancient-coin",itemType:"treasure",name:"地宫古钱",amount:1,rarity:2,image:"/assets/items/item-32.webp"};return null;}

export function strikeMineTile(progress:MiningProgress,input:{location:MiningLocation;spotId?:string;tileId:string}):{progress:MiningProgress;ok:boolean;message:string;cleared?:boolean;reward?:MiningReward;damage?:number;durabilityCost?:number}{const maze=activeMiningMaze(progress,input.location,input.spotId);if(!maze)return{progress,ok:false,message:"这处地宫已经消散"};const tile=maze.tiles.find(item=>item.id===input.tileId);if(!tile||tile.state!=="revealed")return{progress,ok:false,message:"必须先挖通相邻土块才能抵达此处"};if(tile.kind==="wall")return{progress,ok:false,message:"镇脉黑墙不可挖掘，只能寻找绕行路线"};if(tile.kind==="chest"||tile.kind==="deep-chest")return{progress,ok:false,message:"这是宝箱，请使用开启操作"};if(tile.kind==="entrance")return{progress,ok:false,message:"这里是本层入口"};const soil=SOIL_DEFINITIONS[tile.kind];if(progress.pickaxeDurability<soil.durabilityCost)return{progress,ok:false,message:"玄铁灵镐耐久不足，请先修复"};const damage=powerFor(progress.pickaxeLevel),hp=Math.max(0,tile.hp-damage),cleared=hp<=0;let tiles=maze.tiles.map(item=>item.id===tile.id?{...item,hp,state:cleared?"dug" as const:item.state}:item);if(cleared)tiles=revealAround(tiles,{...tile,hp:0,state:"dug"});const nextMaze={...maze,tiles,deepestOpened:Math.max(maze.deepestOpened,tile.depth)};let next=replaceMaze({...progress,pickaxeDurability:progress.pickaxeDurability-soil.durabilityCost,strikeSerial:progress.strikeSerial+1,totalMined:progress.totalMined+(cleared?1:0)},input.location,nextMaze,input.spotId);const reward=cleared?rollGroundReward(input.location,tile,progress.strikeSerial):null;if(reward?.kind==="key"&&reward.keyId)next={...next,keys:{...next.keys,[reward.keyId]:next.keys[reward.keyId]+reward.amount}};if(reward?.kind==="item"&&reward.itemId)next={...next,records:{...next.records,[reward.itemId]:(next.records[reward.itemId]??0)+reward.amount}};return{progress:next,ok:true,message:cleared?reward?`挖通${soil.name} · 发现${reward.name} ×${reward.amount}`:`挖通${soil.name} · 通道向四周展开`:`凿击${soil.name} · ${hp}/${tile.maxHp}`,cleared,reward:reward??undefined,damage,durabilityCost:soil.durabilityCost};}

function chestRewards(location:MiningLocation,tile:MineTile,deep:boolean):MiningReward[]{const depthRatio=tile.depth/9,material=rollMiningMaterial(location,`${tile.rewardSeed}:chest`,deep?1.4:depthRatio+.35),rewards:MiningReward[]=[{kind:"item",itemId:material.id,itemType:"material",name:material.name,amount:deep?3:1+(tile.keyId==="star"?2:1),rarity:Math.max(1,Math.min(7,material.rarity)) as 1|2|3|4|5|6|7,image:material.image}];if(deep)rewards.push({kind:"map-fragment",itemId:"treasure-map-fragment",itemType:"quest",name:"太虚藏宝图残卷",amount:1,rarity:5,image:"/assets/activities/treasure-atlas.webp"});else if(hash(`${tile.rewardSeed}:bonus`)>.46)rewards.push({kind:"currency",name:"封藏灵石",amount:30+tile.depth*12,rarity:2,image:"/assets/activities/spirit-stone-atlas.webp"});return rewards;}
export function openMineChest(progress:MiningProgress,input:{location:MiningLocation;spotId?:string;tileId:string}){const maze=activeMiningMaze(progress,input.location,input.spotId);if(!maze)return{progress,ok:false as const,message:"这处地宫已经消散",rewards:[] as MiningReward[]};const tile=maze.tiles.find(item=>item.id===input.tileId);if(!tile||tile.state!=="revealed"||(tile.kind!=="chest"&&tile.kind!=="deep-chest"))return{progress,ok:false as const,message:"宝箱尚未抵达",rewards:[] as MiningReward[]};const deep=tile.kind==="deep-chest";if(!deep&&tile.keyId&&(progress.keys[tile.keyId]??0)<1)return{progress,ok:false as const,message:`需要${KEY_DEFINITIONS[tile.keyId].name}`,rewards:[] as MiningReward[]};let tiles=maze.tiles.map(item=>item.id===tile.id?{...item,state:"opened" as const}:item);tiles=revealAround(tiles,{...tile,state:"opened"});const nextMaze={...maze,tiles,deepestOpened:Math.max(maze.deepestOpened,tile.depth),completed:deep||maze.completed};let next=replaceMaze(progress,input.location,nextMaze,input.spotId);if(!deep&&tile.keyId)next={...next,keys:{...next.keys,[tile.keyId]:next.keys[tile.keyId]-1}};const rewards=chestRewards(input.location,tile,deep);for(const reward of rewards){if(reward.kind==="map-fragment")next={...next,treasureMapFragments:next.treasureMapFragments+1};if(reward.kind==="item"&&reward.itemId)next={...next,records:{...next.records,[reward.itemId]:(next.records[reward.itemId]??0)+reward.amount}};}return{progress:next,ok:true as const,rewards,message:deep?"太古秘藏开启 · 藏宝图残卷重见天日":`${KEY_DEFINITIONS[tile.keyId!].name}转动 · 宝箱开启`};}

export function repairPickaxe(progress:MiningProgress){return{progress:{...progress,pickaxeDurability:progress.pickaxeMaxDurability},missing:progress.pickaxeMaxDurability-progress.pickaxeDurability};}
export function repairPrice(progress:MiningProgress){return Math.max(30,Math.ceil((progress.pickaxeMaxDurability-progress.pickaxeDurability)*2.5));}
export function pickaxeUpgradeCost(level:number){return level===1?{stones:260,materialName:"黑曜火铁",materialAmount:3}:{stones:680,materialName:"星陨铁",materialAmount:5};}
export function upgradePickaxe(progress:MiningProgress){if(progress.pickaxeLevel>=3)return{progress,ok:false as const,message:"玄铁灵镐已经淬炼至最高阶"};const level=(progress.pickaxeLevel+1) as 2|3,max=80+(level-1)*35;return{progress:{...progress,pickaxeLevel:level,pickaxeMaxDurability:max,pickaxeDurability:max},ok:true as const,message:`玄铁灵镐升至 ${level} 阶 · 挖掘力与最大耐久提升`};}
export function descendResidentMine(progress:MiningProgress){if(!progress.residentMaze.completed)return{progress,ok:false as const,message:"必须先开启本层最深处的太古秘藏"};const floor=progress.residentFloor+1;return{progress:{...progress,residentFloor:floor,residentMaze:createMiningMaze("resident",floor)},ok:true as const,message:`地脉门开启 · 进入常明矿窟第 ${floor} 层`};}
export function assembleTreasureMap(progress:MiningProgress){if(progress.treasureMapAssembled)return{progress,ok:false as const,message:"太虚藏宝图已经拼合完成"};if(progress.treasureMapFragments<3)return{progress,ok:false as const,message:`尚缺 ${3-progress.treasureMapFragments} 份藏宝图残卷`};return{progress:{...progress,treasureMapFragments:progress.treasureMapFragments-3,treasureMapAssembled:true},ok:true as const,message:"三卷归一 · 太虚藏宝窟已在云州山河图显现"};}

export const PICKAXE_PRICE=36;
export function miningNodes(){return[] as MiningNode[];}
export function mineNode(progress:MiningProgress){return{progress,ok:false as const,message:"矿点已升级为地宫迷宫"};}
export function nodeUpgradeCost(){return{stones:0,materialName:"黑曜火铁",materialAmount:0};}
export function upgradeResidentNode(progress:MiningProgress){return{progress,ok:false as const,message:"请在迷宫中继续下探"};}
