"use client";

import type { EventDefinition, ExplorationEventConfig } from "../game/types";
import { AssetField } from "./ContentManager";

function defaults(value: EventDefinition): ExplorationEventConfig {
  return value.exploration ?? {
    chance: 60,
    positionMode: "random",
    image: "/assets/scenes/drunken-moon-tavern.webp",
    text: "微光之下似乎藏着一段不为人知的旧事。",
    rewardItem: value.cardStyle === "easter_egg" ? {
      id: `${value.id}.item`,
      name: "无名旧物",
      image: "/assets/gifts/gift-atlas.webp",
      description: "一件偶然发现、值得留作纪念的小物。",
    } : undefined,
  };
}

export default function ExplorationEventEditor({value,onChange}:{value:EventDefinition;onChange:(value:EventDefinition)=>void}) {
  const config=defaults(value);
  const update=(patch:Partial<ExplorationEventConfig>)=>onChange({...value,exploration:{...config,...patch}});
  const isEgg=value.cardStyle==="easter_egg";
  const reward=config.rewardItem??{id:`${value.id}.item`,name:"无名旧物",image:"/assets/gifts/gift-atlas.webp",description:"一件偶然发现的小物。"};
  const updateReward=(patch:Partial<typeof reward>)=>update({rewardItem:{...reward,...patch}});
  return <fieldset className={`exploration-event-config ${isEgg?"egg":"trigger"}`}>
    <legend><span>{isEgg?"彩":"触"}</span>{isEgg?"彩蛋探索点":"剧情触发点"}</legend>
    <p className="exploration-help">满足事件条件后，场景中会按概率刷新一个{isEgg?"金色呼吸光点":"青色提示光点"}。玩家点击后先看到画面与引子。</p>
    <div className="em-form-grid compact">
      <label>出现概率（%）<input type="number" min="0" max="100" value={config.chance} onChange={event=>update({chance:Number(event.target.value)})}/><small>每次进入场景、推进时段或条件变化时重新判定</small></label>
      <label>光点位置<select value={config.positionMode} onChange={event=>update({positionMode:event.target.value as "random"|"fixed"})}><option value="random">安全区域内随机</option><option value="fixed">固定百分比坐标</option></select></label>
      {config.positionMode==="fixed"&&<><label>横向位置 X（%）<input type="number" min="8" max="92" value={config.x??50} onChange={event=>update({x:Number(event.target.value)})}/></label><label>纵向位置 Y（%）<input type="number" min="8" max="72" value={config.y??38} onChange={event=>update({y:Number(event.target.value)})}/></label></>}
    </div>
    <AssetField label="发现画面" value={config.image} aspectRatio={4/3} aspectLabel="4:3" onChange={image=>update({image})}/>
    <label className="exploration-copy">发现文字<textarea value={config.text} onChange={event=>update({text:event.target.value})} placeholder="填写线索、趣味介绍或进入剧情前的引子。"/></label>
    {isEgg&&<section className="egg-reward-editor"><strong>获得的彩蛋物品</strong><div className="em-form-grid"><label>物品 ID<input value={reward.id} onChange={event=>updateReward({id:event.target.value})}/></label><label>物品名称<input value={reward.name} onChange={event=>updateReward({name:event.target.value})}/></label><label className="wide">物品说明<textarea value={reward.description} onChange={event=>updateReward({description:event.target.value})}/></label></div><AssetField label="物品图片" value={reward.image} aspectRatio={1} aspectLabel="1:1" onChange={image=>updateReward({image})}/></section>}
    {!isEgg&&<small className="exploration-story-note">点击“进入剧情”后，将从下方配置的剧情起点继续执行对话、选项和效果。</small>}
  </fieldset>;
}
