import { checkCondition } from "./event-engine";
import type { CharacterDefinition, CharacterId, CharacterMessageDefinition, EventDefinition, GameState, GlobalKeyAutoCondition, GlobalKeyDefinition, SceneDefinition, SceneId, TriggerContext } from "./types";

function roll(seed: string) {
  let hash = 2166136261;
  for (let i=0;i<seed.length;i+=1) { hash ^= seed.charCodeAt(i); hash = Math.imul(hash,16777619); }
  return (hash>>>0)%10000/100;
}

export function resolveScenePresence(state: GameState, sceneId: SceneId, characters: CharacterDefinition[], events: EventDefinition[], incrementVisit = true) {
  const visit=(state.sceneVisits[sceneId]??0)+(incrementVisit?1:0); const used=new Set(state.appearanceTriggersUsed); const present:CharacterId[]=[]; let forcedEvent:EventDefinition|undefined;
  for(const character of characters){
    const appearances=character.appearances?.length?character.appearances:(character.sceneId===sceneId?[{sceneId:character.sceneId,...(character.presence??{mode:"resident" as const,guaranteedRules:[],randomRules:[]})}]:[]);
    const relevant=appearances.filter(item=>item.sceneId===sceneId); if(!relevant.length)continue;
    if(relevant.some(item=>item.mode==="resident")){present.push(character.id);continue}
    const context:TriggerContext={trigger:"scene_enter",sceneId,characterId:character.id};
    const guarantee=relevant.flatMap(item=>item.guaranteedRules.map(rule=>({appearance:item,rule}))).find(({rule})=>!used.has(`${character.id}:${sceneId}:${rule.id}`)&&rule.conditions.every(condition=>checkCondition(condition,state,context)));
    if(guarantee){present.push(character.id);used.add(`${character.id}:${sceneId}:${guarantee.rule.id}`);if(guarantee.rule.triggerEventId&&!forcedEvent){const candidate=events.find(item=>item.id===guarantee.rule.triggerEventId);if(candidate&&!state.completedEvents.includes(candidate.id))forcedEvent=candidate}continue}
    const random=relevant.some(appearance=>appearance.randomRules.some(rule=>rule.periods.includes(state.period)&&rule.conditions.every(condition=>checkCondition(condition,state,context))&&roll(`${state.day}:${state.period}:${sceneId}:${character.id}:${visit}:${rule.id}`)<rule.probability));
    if(random)present.push(character.id);
  }
  return { state:{...state,presentCharacters:{...state.presentCharacters,[sceneId]:present},appearanceTriggersUsed:[...used],sceneVisits:{...state.sceneVisits,[sceneId]:visit}}, present, forcedEvent };
}

export function checkAutoCondition(condition: GlobalKeyAutoCondition, state: GameState) {
  if(condition.type==="event_completed")return state.completedEvents.includes(condition.eventId);
  if(condition.type==="day_reached")return state.day>=condition.min;
  if(condition.type==="period")return state.period===condition.value;
  if(condition.type==="scene")return state.sceneId===condition.value;
  if(condition.type==="flag")return Boolean(state.flags[condition.key])===condition.value;
  if(condition.type==="relationship")return (state.relationships[condition.characterId]??0)>=condition.min;
  if(condition.type==="event_run_count")return (state.eventRuns[condition.eventId]??0)>=condition.min;
  if(condition.type==="completed_event_count")return state.completedEvents.length>=condition.min;
  if(condition.type==="scene_visit_count")return (state.sceneVisits[condition.sceneId]??0)>=condition.min;
  return (state.inventory[condition.giftId]??0)>=condition.min;
}

export function getEligibleMessages(state: GameState, messages: CharacterMessageDefinition[]) {
  return messages.filter((message)=>!state.receivedMessages.includes(message.id)&&message.conditions.every((condition)=>checkAutoCondition(condition,state)));
}

export function resolveSeekingEncounter(state: GameState, characters: CharacterDefinition[], events: EventDefinition[]) {
  const candidates=characters.flatMap((character)=>(character.seekingRules??[]).map((rule)=>({character,rule})))
    .filter(({rule})=>rule.periods.includes(state.period))
    .filter(({rule})=>state.day-(state.seekingEncounterDays[rule.id]??-999)>=Math.max(0,rule.cooldownDays))
    .filter(({rule})=>rule.conditions.every((condition)=>checkAutoCondition(condition,state)))
    .filter(({rule})=>roll(`seek:${state.day}:${state.period}:${rule.id}`)<rule.probability)
    .filter(({rule})=>!rule.triggerEventId||!state.completedEvents.includes(rule.triggerEventId))
    .sort((a,b)=>b.rule.priority-a.rule.priority||a.rule.id.localeCompare(b.rule.id));
  const chosen=candidates[0];if(!chosen)return null;
  const present=state.presentCharacters[state.sceneId]??[];
  const next={...state,selectedCharacterId:chosen.character.id,presentCharacters:{...state.presentCharacters,[state.sceneId]:[chosen.character.id,...present.filter((id)=>id!==chosen.character.id)]},seekingEncounterDays:{...state.seekingEncounterDays,[chosen.rule.id]:state.day}};
  return {state:next,character:chosen.character,rule:chosen.rule,event:chosen.rule.triggerEventId?events.find((event)=>event.id===chosen.rule.triggerEventId):undefined};
}

export function applyAutomaticGlobalKeys(state: GameState, keys: GlobalKeyDefinition[]) {
  const flags={...state.flags};let changed=false;let advanced=true;
  // Resolve to a fixed point so A can activate B in the same game action even
  // when B appears before A in the EM list.
  while(advanced){
    advanced=false;
    const snapshot={...state,flags};
    for(const key of keys){
      if(flags[key.id]||key.triggerMode==="manual")continue;
      const rules=key.autoRules??[];
      if(rules.some(rule=>rule.conditions.length>0&&rule.conditions.every(condition=>checkAutoCondition(condition,snapshot)))){
        flags[key.id]=true;changed=true;advanced=true;
      }
    }
  }
  return changed?{...state,flags}:state;
}

export function resolveSceneVariant(scene: SceneDefinition, state: GameState) {
  const context:TriggerContext={trigger:"scene_enter",sceneId:scene.id};
  const variant=(scene.variants??[]).filter(item=>item.conditions.every(condition=>checkCondition(condition,state,context))).sort((a,b)=>b.priority-a.priority)[0];
  return variant?{...scene,name:variant.name||scene.name,description:variant.description||scene.description,atmosphere:variant.atmosphere||scene.atmosphere,image:variant.image}:scene;
}
