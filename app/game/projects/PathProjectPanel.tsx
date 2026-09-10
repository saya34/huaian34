"use client";

import { useEffect, useRef } from "react";

import { MATERIALS, PRODUCTS } from "../alchemy/item-data";
import { productStackKey, type ProductStack } from "../alchemy/commissions";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import type { PathProjectRoute } from "../types";
import { useFeedback } from "../feedback/FeedbackProvider";
import { feedbackText } from "../feedback/texts";

const herb=MATERIALS.find(item=>item.name==="碧落灵芝")!;
const frost=MATERIALS.find(item=>item.name==="霜心草")!;
const remedy=PRODUCTS.find(item=>item.name==="碧落回春丹")!;
const ROUTES:Record<PathProjectRoute,{glyph:string;name:string;role:string;description:string;result:string}>={
  production:{glyph:"圃",name:feedbackText("projects.routeProduction"),role:feedbackText("projects.medicine.productionRole"),description:feedbackText("projects.medicine.productionDescription"),result:feedbackText("projects.medicine.productionResult")},
  relationship:{glyph:"契",name:feedbackText("projects.routeRelationship"),role:feedbackText("projects.medicine.relationshipRole"),description:feedbackText("projects.medicine.relationshipDescription"),result:feedbackText("projects.medicine.relationshipResult")},
  battle:{glyph:"境",name:feedbackText("projects.routeBattle"),role:feedbackText("projects.medicine.battleRole"),description:feedbackText("projects.medicine.battleDescription"),result:feedbackText("projects.medicine.battleResult")},
};

function productCount(stacks:Record<string,ProductStack>,productId:string){return Object.values(stacks).filter(stack=>stack.productId===productId).reduce((sum,stack)=>sum+stack.count,0)}

export function PathProjectTracker({onOpen}:{onOpen:()=>void}){
  const{state}=useUnifiedGame();const project=state.romance.medicineShortage;
  const overdue=project.status==="active"&&state.romance.day>(project.deadlineDay??state.romance.day),remaining=project.deadlineDay===undefined?3:Math.max(0,project.deadlineDay-state.romance.day+1);
  return <button type="button" className={`path-project-tracker status-${project.status} ${overdue?"overdue":""}`} onClick={onOpen}><span className="project-seal">途</span><span><small>{project.status==="completed"?"坊市变化已生效":project.status==="offered"?"新的道途项目":"当前道途项目"}</small><strong>{project.status==="completed"?"医馆药路重开":"坊市药材断供"}</strong><em>{project.status==="completed"?"查看选择造成的结果":project.status==="offered"?"查明断供原因并选择解法":overdue?"危机期已过 · 补救仍可继续":`危机窗口 · 余 ${remaining} 日`}</em></span><i>›</i></button>;
}

export default function PathProjectPanel({onClose,onNotice}:{onClose:()=>void;onNotice:(message:string)=>void}){
  const{state,setRomance,setAlchemy,applyEffects}=useUnifiedGame();const game=state.romance,project=game.medicineShortage;
  const feedback=useFeedback();const readyAnnouncedRef=useRef<PathProjectRoute|null>(null);
  const overdue=project.status==="active"&&game.day>(project.deadlineDay??game.day),remaining=project.deadlineDay===undefined?3:Math.max(0,project.deadlineDay-game.day+1);
  const herbCount=state.shared.items[herb.id]?.amount??0,frostCount=state.shared.items[frost.id]?.amount??0,remedyCount=productCount(state.alchemy.productStacks,remedy.id);
  const personallyHarvested=project.status==="active"&&state.farm.totalHarvests>(project.farmHarvestsAtAccept??state.farm.totalHarvests);
  const battleMaterial=Object.values(state.shared.items).find(item=>item.itemType==="material"&&item.amount>0&&item.sourceTags.includes("battle"));
  const readiness:Record<PathProjectRoute,{ready:boolean;progress:string;checks:Array<{done:boolean;label:string}>}>={
    production:{ready:personallyHarvested&&herbCount>=3&&remedyCount>=1,progress:`亲植 ${personallyHarvested?1:0}/1 · 灵芝 ${Math.min(herbCount,3)}/3 · 回春丹 ${Math.min(remedyCount,1)}/1`,checks:[{done:personallyHarvested,label:"接取后亲手完成一次收获"},{done:herbCount>=3,label:"备齐三份碧落灵芝"},{done:remedyCount>=1,label:"炼成一枚碧落回春丹"}]},
    relationship:{ready:(game.relationships.liu??0)>=12&&frostCount>=2,progress:`柳知意信任 ${game.relationships.liu??0}/12 · 霜心草 ${Math.min(frostCount,2)}/2`,checks:[{done:(game.relationships.liu??0)>=12,label:"柳知意缘分达到 12"},{done:frostCount>=2,label:"备齐两份霜心草"}]},
    battle:{ready:project.battleVictories>=1&&Boolean(battleMaterial),progress:`项目期胜利 ${project.battleVictories}/1 · 秘境灵材 ${battleMaterial?1:0}/1`,checks:[{done:project.battleVictories>=1,label:"接受项目后镇压一次秘境"},{done:Boolean(battleMaterial),label:"保留一份秘境带出的灵材"}]},
  };
  function accept(){setRomance(current=>({...current,medicineShortage:{status:"active",acceptedDay:current.day,deadlineDay:current.day+2,battleVictories:0,farmHarvestsAtAccept:state.farm.totalHarvests}}));onNotice("道途项目已接受 · 坊市药材断供");}
  function choose(route:PathProjectRoute){setRomance(current=>({...current,medicineShortage:{...current.medicineShortage,route}}));onNotice(`主解法已定 · ${ROUTES[route].name}`);}
  function removeProduct(){setAlchemy(current=>{let remaining=1;const stacks={...current.productStacks};for(const stack of Object.values(stacks).filter(item=>item.productId===remedy.id)){if(remaining<=0)break;const key=productStackKey(stack.productId,stack.mutation),used=Math.min(remaining,stack.count);stacks[key]={...stack,count:stack.count-used};remaining-=used;}return{...current,productStacks:stacks};});}
  async function deliver(){const route=project.route;if(!route||!readiness[route].ready)return;const accepted=await feedback.confirm({titleKey:"projects.deliveryTitle",bodyKey:"projects.deliveryBody",icon:"交",tone:"cinnabar",details:[{labelKey:"projects.routeLabel",value:ROUTES[route].name,emphasis:true},{labelKey:"system.cost",value:readiness[route].progress},{labelKey:"projects.resultLabel",value:ROUTES[route].result}],dedupeKey:`project-deliver:${route}:${game.day}`});if(!accepted)return;if(route==="production"){applyEffects([{type:"remove_item",itemId:herb.id,amount:3}]);removeProduct();}else if(route==="relationship")applyEffects([{type:"remove_item",itemId:frost.id,amount:2}]);else if(battleMaterial)applyEffects([{type:"remove_item",itemId:battleMaterial.itemId,amount:1}]);const outcome=overdue?"recovered":"stabilized";applyEffects([{type:"add_currency",amount:overdue?100:240},{type:"add_relationship",characterId:"liu",amount:overdue?1:3},{type:"add_item",item:{itemId:"clinic-supply-covenant",itemType:"quest",rarity:4,amount:1,sourceTags:["道途项目","坊市药材断供"],locked:true}},{type:"set_global_key",key:"medicine_supply_restored",value:true}]);setRomance(current=>({...current,medicineShortage:{...current.medicineShortage,status:"completed",completedDay:current.day,outcome}}));onNotice(outcome==="stabilized"?feedbackText("projects.medicine.completedOnTime"):feedbackText("projects.medicine.completedRecovery"));}
  useEffect(()=>{const route=project.route;if(!route||!readiness[route].ready||readyAnnouncedRef.current===route)return;readyAnnouncedRef.current=route;feedback.publish({variant:"project-milestone",priority:1,tone:"gold",titleKey:"projects.ready",bodyKey:"projects.readyBody",params:{name:feedbackText("projects.medicineName"),route:ROUTES[route].name},icon:"备",dedupeKey:`project-ready:${route}:${project.acceptedDay}`});},[feedback,project.acceptedDay,project.route,readiness]);
  const milestones=["accepted","route","prepared","delivered","changed"].map((id,index)=>({done:[project.status!=="offered",Boolean(project.route),Boolean(project.route&&readiness[project.route].ready),project.status==="completed",project.status==="completed"][index],label:feedbackText(`projects.medicine.milestone.${id}`)}));
  return <div className="path-project-backdrop" onMouseDown={onClose}><section className={`path-project-panel ${overdue?"recovery":""}`} role="dialog" aria-modal="true" aria-label="道途项目" onMouseDown={event=>event.stopPropagation()}>
    <header><span className="path-project-mark">途</span><div><small>DAO PATH PROJECT · 世界事件</small><h2>坊市药材断供</h2><p>{project.status==="completed"?"你选择的解法已经改变了坊市。":project.status==="offered"?"医馆的常用药材突然断供，需要有人查明缺口并交付替代方案。":overdue?"三日危机窗口已经过去，但事件不会永久错过；你仍可完成补救版本。":`第 ${project.acceptedDay} 日接取 · 第 ${project.deadlineDay} 日结束危机窗口 · 尚余 ${remaining} 日`}</p></div><button onClick={onClose}>×</button></header>
    {project.status==="completed"?<div className="project-outcome"><div className="outcome-ripple"><i/><i/><b>成</b></div><small>{project.outcome==="stabilized"?"危机期内完成":"补救完成"}</small><h3>{project.outcome==="stabilized"?"药路重开，坊市复苏":"医馆复诊，供给渐稳"}</h3><p>医馆恢复接诊，栖珍阁重新上架基础补给；柳知意的日程从寻药改为坐诊。你获得了剧情物品「医馆回春契」。</p><div><span><b>医馆</b>恢复接诊</span><span><b>商店</b>补给恢复</span><span><b>人物</b>柳知意回归日程</span></div><button onClick={onClose}>返回坊市</button></div>:<div className="project-workspace">
      <aside className="project-milestones"><small>VISIBLE MILESTONES</small><h3>当前推进</h3>{milestones.map((item,index)=><span className={item.done?"done":""} key={item.label}><i>{item.done?"✓":index+1}</i><b>{item.label}</b></span>)}<p>只需完成一条主路线。其余系统是助力，不是隐性必修。</p></aside>
      <main><div className="project-brief"><span><i>病</i><b>医馆库存</b><strong>仅余三日</strong></span><span><i>缺</i><b>温养药材</b><strong>供给中断</strong></span><span><i>果</i><b>完成变化</b><strong>医馆复诊</strong></span></div>
        {project.status==="offered"?<section className="project-accept"><blockquote>“不必样样精通。你只要选一条真正走得通的路，把药送回来。”</blockquote><p>危机窗口为三个游戏日。到期不会永久失败，而会进入奖励较低的补救阶段。</p><button onClick={accept}>接下项目 · 开始计时</button></section>:<><div className="project-route-heading"><div><small>CHOOSE ONE PRIMARY SOLUTION</small><h3>选择主解法</h3></div><span>{project.route?`已选择 · ${ROUTES[project.route].name}`:"三选一，不要求全部参与"}</span></div><div className="project-routes">{(Object.keys(ROUTES) as PathProjectRoute[]).map(route=>{const info=ROUTES[route],status=readiness[route];return <button className={`${project.route===route?"selected":""} ${status.ready?"ready":""}`} key={route} onClick={()=>choose(route)}><i>{info.glyph}</i><small>{info.role}</small><h4>{info.name}</h4><p>{info.description}</p><div>{status.checks.map(check=><span className={check.done?"done":""} key={check.label}><b>{check.done?"✓":"○"}</b>{check.label}</span>)}</div><em>{status.progress}</em><strong>{status.ready?"准备完成":"选择为主路线"}</strong></button>})}</div>{project.route&&<footer className="project-delivery"><div><small>SELECTED OUTCOME</small><strong>{ROUTES[project.route].result}</strong><p>{overdue?"补救交付：获得较少报酬，但不会失去剧情与世界变化。":"危机期交付：获得完整报酬、关系进展和世界变化。"}</p></div><button disabled={!readiness[project.route].ready} onClick={deliver}>{readiness[project.route].ready?"交付成果 · 解决断供":"尚未满足交付条件"}</button></footer>}</>}
      </main>
    </div>}
  </section></div>;
}
