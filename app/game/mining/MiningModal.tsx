"use client";

import { useMemo, useState } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import {
  KEY_DEFINITIONS, SOIL_DEFINITIONS, activeMiningMaze, assembleTreasureMap, descendResidentMine,
  miningLocationById, miningMaterialByName, miningPool, openMineChest, pickaxeUpgradeCost, repairPickaxe, repairPrice,
  strikeMineTile, upgradePickaxe, type MineTile, type MiningLocationId, type MiningReward,
} from "./mining";

type Props={locationId:MiningLocationId;randomSpotId?:string;day:number;period:string;onClose:()=>void;onNotice:(message:string)=>void};
const RARITY=["凡品","良品","珍品","极品","神品","神话","太初"];
type CavePoint={x:number;y:number};

function cavePoint(tile:MineTile,width:number,height:number):CavePoint{
  const jitterX=(((tile.x*17+tile.y*11)%7)-3)*.58,jitterY=(((tile.x*13+tile.y*19)%7)-3)*.46;
  return{x:10+(tile.x/Math.max(1,width-1))*80+(tile.y%2?1.5:-1.2)+jitterX,y:6+(tile.y/Math.max(1,height-1))*88+jitterY};
}
function caveTileStyle(tile:MineTile,width:number,height:number):React.CSSProperties{
  const point=cavePoint(tile,width,height),rotation=((tile.x*19+tile.y*23)%13)-6,scale=.91+((tile.x*7+tile.y*5)%5)*.025;
  return{"--tile-x":`${point.x}%`,"--tile-y":`${point.y}%`,"--tile-rot":`${rotation}deg`,"--tile-scale":scale,"--tile-delay":`${(tile.x+tile.y)*.025}s`} as React.CSSProperties;
}
function tunnelStyle(from:MineTile,to:MineTile,width:number,height:number):React.CSSProperties{
  const a=cavePoint(from,width,height),b=cavePoint(to,width,height),dx=b.x-a.x,dy=b.y-a.y,angle=Math.atan2(dy*1.26,dx)*180/Math.PI;
  return{left:`${a.x}%`,top:`${a.y}%`,width:`${Math.hypot(dx,dy)}%`,transform:`rotate(${angle}deg)`};
}
function isPassage(tile:MineTile){return tile.state==="dug"||tile.state==="opened";}

export default function MiningModal({locationId,randomSpotId,day,period,onClose,onNotice}:Props){
  const{state,setMining,applyEffects}=useUnifiedGame();const location=miningLocationById(locationId)!;const mining=state.mining;const maze=activeMiningMaze(mining,location,randomSpotId);
  const [message,setMessage]=useState("从入口开始开掘。只有清除当前土块，四周相邻区域才会显现。");
  const [selectedId,setSelectedId]=useState(maze?.tiles.find(tile=>tile.state==="revealed")?.id??"");
  const [strikeFx,setStrikeFx]=useState<string|null>(null);const[loot,setLoot]=useState<MiningReward[]>([]);const[chestFx,setChestFx]=useState<"normal"|"deep"|null>(null);const[lootAt,setLootAt]=useState<string|null>(null);
  const pool=useMemo(()=>miningPool(location),[location]);const selected=maze?.tiles.find(tile=>tile.id===selectedId);const opened=maze?.tiles.filter(tile=>tile.state==="dug"||tile.state==="opened").length??0;const progress=maze?Math.round((maze.deepestOpened/(maze.height-1))*100):0;
  const tunnels=useMemo(()=>{
    if(!maze)return[];
    return maze.tiles.flatMap(tile=>([[1,0],[0,1]] as const)
      .map(([dx,dy])=>maze.tiles.find(other=>other.x===tile.x+dx&&other.y===tile.y+dy))
      .filter((other):other is MineTile=>Boolean(other&&isPassage(tile)&&isPassage(other)))
      .map(other=>({from:tile,to:other,key:`${tile.id}-${other.id}`})));
  },[maze]);
  const explorerTile=useMemo(()=>{if(!maze)return undefined;if(selected&&isPassage(selected))return selected;if(selected){const neighbor=maze.tiles.find(tile=>isPassage(tile)&&Math.abs(tile.x-selected.x)+Math.abs(tile.y-selected.y)===1);if(neighbor)return neighbor;}return [...maze.tiles].filter(isPassage).sort((a,b)=>b.depth-a.depth)[0];},[maze,selected]);
  const impactTile=maze?.tiles.find(tile=>tile.id===strikeFx),lootTile=maze?.tiles.find(tile=>tile.id===lootAt);

  function announce(copy:string){setMessage(copy);onNotice(copy)}
  function grant(rewards:MiningReward[]){
    const effects:Parameters<typeof applyEffects>[0]=[];
    for(const reward of rewards){if(reward.kind==="currency")effects.push({type:"add_currency",amount:reward.amount});else if((reward.kind==="item"||reward.kind==="map-fragment")&&reward.itemId)effects.push({type:"add_item",item:{itemId:reward.itemId,itemType:reward.itemType??"treasure",rarity:reward.rarity,amount:reward.amount,sourceTags:[location.name,reward.kind==="map-fragment"?"藏宝图":"地宫开掘"]}});}
    if(effects.length)applyEffects(effects);
  }
  function hit(tile:MineTile){
    setSelectedId(tile.id);
    if(tile.state!=="revealed"){setMessage(tile.state==="hidden"?"此处仍被迷雾遮蔽，请先开通相邻土块。":"已经挖通的甬道无需重复开掘。");return;}
    if(tile.kind==="wall"){setMessage("镇脉黑墙与山根相连，无法挖掘，请寻找绕行路线。 ");return;}
    if(tile.kind==="chest"||tile.kind==="deep-chest"){openChest(tile);return;}
    const result=strikeMineTile(mining,{location,spotId:randomSpotId,tileId:tile.id});if(!result.ok){setMessage(result.message);return;}
    setMining(result.progress);setStrikeFx(tile.id);window.setTimeout(()=>setStrikeFx(null),520);setMessage(result.message);
    if(result.reward){setLoot([result.reward]);setLootAt(tile.id);window.setTimeout(()=>setLootAt(null),1800);grant([result.reward]);}
  }
  function openChest(tile:MineTile){
    const result=openMineChest(mining,{location,spotId:randomSpotId,tileId:tile.id});if(!result.ok){setMessage(result.message);return;}
    setMining(result.progress);setLoot(result.rewards);grant(result.rewards);setChestFx(tile.kind==="deep-chest"?"deep":"normal");setMessage(result.message);onNotice(`${result.message} · 所得已归入行囊`);
  }
  function mend(){const price=repairPrice(mining);if(mining.pickaxeDurability>=mining.pickaxeMaxDurability){setMessage("玄铁灵镐状态完好。 ");return;}if(state.shared.spiritStones<price){setMessage(`修复灵镐需要 ${price} 灵石。`);return;}setMining(repairPickaxe(mining).progress);applyEffects([{type:"add_currency",amount:-price}]);announce(`玄铁灵镐修复完成 · 灵石 -${price}`);}
  function improve(){if(mining.pickaxeLevel>=3){setMessage("玄铁灵镐已经淬炼至最高阶。 ");return;}const cost=pickaxeUpgradeCost(mining.pickaxeLevel),source=miningMaterialByName(cost.materialName),held=state.shared.items[source.id]?.amount??0;if(state.shared.spiritStones<cost.stones||held<cost.materialAmount){setMessage(`淬炼需要灵石 ${cost.stones} 与${cost.materialName} ×${cost.materialAmount}`);return;}const result=upgradePickaxe(mining);if(!result.ok)return;setMining(result.progress);applyEffects([{type:"add_currency",amount:-cost.stones},{type:"remove_item",itemId:source.id,amount:cost.materialAmount}]);announce(result.message);}
  function descend(){const result=descendResidentMine(mining);if(!result.ok){setMessage(result.message);return;}setMining(result.progress);setSelectedId(result.progress.residentMaze.tiles.find(tile=>tile.state==="revealed")?.id??"");setChestFx(null);setLoot([]);setLootAt(null);announce(result.message);}
  function assemble(){const result=assembleTreasureMap(mining);if(!result.ok){setMessage(result.message);return;}setMining(result.progress);applyEffects([{type:"remove_item",itemId:"treasure-map-fragment",amount:3},{type:"add_item",item:{itemId:"complete-treasure-map",itemType:"quest",rarity:6,amount:1,sourceTags:["挖矿","太虚藏宝图"]}},{type:"reveal_dungeon",dungeonId:"treasure-map-vault"}]);announce(result.message);}
  function close(){if(location.kind==="random"&&maze?.completed)setMining(current=>({...current,randomSpots:current.randomSpots.filter(spot=>spot.id!==randomSpotId)}));onClose();}
  function tileCopy(tile?:MineTile){if(!tile)return"选择一个已显现的土块";if(tile.kind==="wall")return"无法开掘 · 必须绕行";if(tile.kind==="entrance")return"本层入口 · 安全甬道";if(tile.kind==="chest")return`${KEY_DEFINITIONS[tile.keyId!].name}开启`;if(tile.kind==="deep-chest")return"太古秘藏 · 无需钥匙";const soil=SOIL_DEFINITIONS[tile.kind],chance=Math.min(94,Math.round((.28+soil.rarity*.11+tile.depth/9*.2)*100));return`${soil.name} · 耐久 ${soil.durabilityCost}/击 · 坚固 ${tile.hp}/${tile.maxHp} · 发现率约 ${chance}%`;}

  if(!maze)return <div className="mining-backdrop"><section className="mine-missing"><b>散</b><h2>游光地宫已经消散</h2><button onClick={onClose}>返回山河图</button></section></div>;
  return <div className={`mining-backdrop maze-mining-backdrop chest-fx-${chestFx??"none"}`} role="presentation" onMouseDown={close}><section className="mine-maze-window" role="dialog" aria-modal="true" aria-label={`${location.name}地宫迷宫`} onMouseDown={event=>event.stopPropagation()}>
    <header className="mine-maze-heading"><button type="button" onClick={close}>‹</button><div><small>EARTH VEIN LABYRINTH · {location.kind==="resident"?`常明第 ${maze.floor} 层`:"游光地宫"}</small><h2>{location.name}</h2></div><div className="pickaxe-durability"><span><i>镐</i>{mining.pickaxeLevel}阶玄铁灵镐</span><strong>{mining.pickaxeDurability}<small> / {mining.pickaxeMaxDurability}</small></strong><b><i style={{width:`${mining.pickaxeDurability/mining.pickaxeMaxDurability*100}%`}}/></b></div><button type="button" onClick={close}>×</button></header>
    <div className="mine-maze-body">
      <aside className="mine-depth-rail"><header><small>本层勘探</small><strong>{progress}%</strong></header><div className="mine-depth-track"><i style={{height:`${Math.max(3,progress)}%`}}/><span style={{top:`${Math.min(94,progress)}%`}}>深 {maze.deepestOpened+1}</span></div><footer><b>{opened}</b><small>已开区域</small></footer></aside>
      <main className="mine-maze-scene">
        <div className="mine-cave-atmosphere" aria-hidden="true"><i/><i/><i/><span/><b className="cave-stalactites"/><b className="cave-ground-mist"/><em className="cave-lantern-glow" style={explorerTile?caveTileStyle(explorerTile,maze.width,maze.height):undefined}/></div>
        <div className="mine-grid cavern-map" style={{"--mine-cols":maze.width,"--mine-depth":progress} as React.CSSProperties}>
          <div className="mine-tunnels" aria-hidden="true">{tunnels.map(tunnel=><i key={tunnel.key} style={tunnelStyle(tunnel.from,tunnel.to,maze.width,maze.height)}/>)}</div>
          {maze.tiles.map(tile=>{const soil=tile.kind in SOIL_DEFINITIONS?SOIL_DEFINITIONS[tile.kind as keyof typeof SOIL_DEFINITIONS]:null;return <button type="button" key={tile.id} style={caveTileStyle(tile,maze.width,maze.height)} className={`mine-tile kind-${tile.kind} state-${tile.state} ${selectedId===tile.id?"selected":""} ${strikeFx===tile.id?"struck":""}`} onClick={()=>hit(tile)} aria-label={tileCopy(tile)}>
          {tile.state==="hidden"?<span className="mine-fog">?</span>:tile.kind==="wall"?<span className="wall-runes"><i/><i/><b>壁</b></span>:tile.kind==="entrance"?<span className="mine-entrance">入</span>:tile.kind==="chest"||tile.kind==="deep-chest"?<span className="mine-chest"><i/><b>{tile.kind==="deep-chest"?"秘":KEY_DEFINITIONS[tile.keyId!].glyph}</b><em/></span>:tile.state==="dug"?<span className="dug-tunnel"><i/></span>:<><span className="soil-cracks"><i/><i/><i/></span><b className="soil-glyph">{soil?.glyph}</b><span className="tile-health"><i style={{width:`${tile.hp/tile.maxHp*100}%`}}/></span></>}
          </button>})}
          {explorerTile&&<div className="mine-explorer-marker" style={caveTileStyle(explorerTile,maze.width,maze.height)} aria-hidden="true"><i/><b>行</b><span/></div>}
          {impactTile&&<div className="mine-impact" key={strikeFx} style={caveTileStyle(impactTile,maze.width,maze.height)}><i>✦</i><i>✦</i><i>◆</i><b>铿</b></div>}
          {lootTile&&loot[0]&&<div className={`mine-loot-burst rarity-${loot[0].rarity}`} style={caveTileStyle(lootTile,maze.width,maze.height)}><i/><img src={loot[0].image} alt=""/><span><small>地脉发现</small><b>{loot[0].name} ×{loot[0].amount}</b></span></div>}
        </div>
        {chestFx&&<div className={`mine-chest-opening ${chestFx}`}><i/><span>{chestFx==="deep"?"太古秘藏":"地宫宝箱"}</span><strong>{loot.map(item=>`${item.name} ×${item.amount}`).join(" · ")}</strong><button type="button" onClick={()=>setChestFx(null)}>收入行囊</button></div>}
      </main>
      <aside className="mine-expedition-hud">
        <section className="mine-selected-info"><small>当前目标</small><h3>{selected?.kind==="deep-chest"?"太古秘藏":selected?.kind==="chest"?"封印宝箱":selected?.kind&&selected.kind in SOIL_DEFINITIONS?SOIL_DEFINITIONS[selected.kind as keyof typeof SOIL_DEFINITIONS].name:selected?.kind==="wall"?"镇脉黑墙":"地宫甬道"}</h3><p>{tileCopy(selected)}</p></section>
        <section className="mine-keyring"><header>地宫钥环</header>{(Object.keys(KEY_DEFINITIONS) as Array<keyof typeof KEY_DEFINITIONS>).map(id=><span key={id}><i>{KEY_DEFINITIONS[id].glyph}</i><b>{KEY_DEFINITIONS[id].name}</b><em>×{mining.keys[id]}</em></span>)}</section>
        <section className="mine-map-scroll"><span><i>{mining.treasureMapAssembled?"图":"卷"}</i><b>{mining.treasureMapAssembled?"太虚藏宝图已成":"藏宝图残卷"}</b><small>{mining.treasureMapAssembled?"特殊副本已出现在云州地图":`${mining.treasureMapFragments}/3 · 深层秘藏产出`}</small></span>{!mining.treasureMapAssembled&&<button type="button" disabled={mining.treasureMapFragments<3} onClick={assemble}>拼合藏宝图</button>}</section>
        <section className="mine-tools-dock"><button type="button" onClick={mend}><i>修</i><span><b>修复灵镐</b><small>◉ {repairPrice(mining)} · 恢复全部耐久</small></span></button><button type="button" disabled={mining.pickaxeLevel>=3} onClick={improve}><i>炼</i><span><b>淬炼灵镐</b><small>提高伤害与耐久上限</small></span></button>{location.kind==="resident"&&maze.completed&&<button type="button" className="descend-button" onClick={descend}><i>下</i><span><b>进入下一层</b><small>更深地层 · 更珍稀掉落</small></span></button>}</section>
        <div className="mine-message"><i>录</i><p>{message}</p></div>
      </aside>
    </div>
  </section></div>;
}
