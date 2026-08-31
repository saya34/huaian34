"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CHARACTERS, CHARACTER_MESSAGES, EVENTS, GIFTS, GLOBAL_KEYS, SCENES } from "./content";
import {
  INITIAL_STATE,
  advanceEvent,
  applyEffects,
  buildAmbientEvent,
  buildGiftFallback,
  chooseEvent,
  currentNode,
  getEligibleEvents,
  isExplorationEvent,
  resolveEvent,
  startDefinition,
  startTransient,
} from "./event-engine";
import { applyAutomaticGlobalKeys, getEligibleMessages, resolveScenePresence, resolveSceneVariant, resolveSeekingEncounter } from "./world-engine";
import { getAudioFrame } from "./audio-frames";
import WorldMapModal from "./WorldMapModal";
import { getSceneEventHints, getVisibleMapEvents, scheduleMapEvents } from "./map-event-engine";
import CalendarModal from "./CalendarModal";
import { getCalendarDate, getDueCalendarEvents, markCalendarEventCompleted } from "./calendar-engine";
import ActivityCards from "./ActivityCards";
import GamblingModal from "./GamblingModal";
import MarketModal from "./MarketModal";
import FortuneModal from "./FortuneModal";
import CultivationModal from "./CultivationModal";
import InspectionModal from "./InspectionModal";
import DrinkingModal from "./DrinkingModal";
import ShopModal from "./ShopModal";
import { getProficiencyProfile } from "./proficiency-engine";
import { getInspectionHints, rollInspectionEvent } from "./inspection-engine";
import type { CultivationEntry } from "./cultivation-engine";
import { getAvailableActivities, isMarketReminderDay, marketReminderKey, type PeriodicActivityId } from "./periodic-activities";
import { drawDailyFortune, FORTUNE_STORAGE_KEY, fortuneBoosts, fortuneEffectLabel, getFortuneSign, getLocalDateKey, type FortuneDrawRecord } from "./fortune-engine";
import type { CharacterDefinition, CharacterId, CharacterMessageDefinition, DialogueProfileDefinition, EventDefinition, GiftDefinition, GiftId, GameState, GlobalKeyDefinition, Period, RelationshipStageDefinition, SceneDefinition, SceneId, TriggerContext } from "./types";
import { useUnifiedGame } from "./core/UnifiedGameProvider";
import type { DungeonDefinition } from "./core/dungeons";
import FusionSystemPanel, { type FusionPanelId } from "./ui/FusionSystemPanel";

const PERIODS: Period[] = ["清晨", "黄昏", "夜晚"];

function bondTitle(value: number) {
  if (value >= 70) return "同心";
  if (value >= 45) return "心悦";
  if (value >= 25) return "相知";
  if (value >= 10) return "初识";
  return "初逢";
}

function bondFeeling(amount: number) {
  if (amount >= 8) return "十分开心";
  if (amount >= 5) return "感到欣喜";
  if (amount >= 3) return "感到愉悦";
  return "心情变好了";
}

const FALLBACK_STAGES:RelationshipStageDefinition[]=[{id:"stranger",min:0,name:"初识",addressing:"道友",description:"彼此仍守着礼数。"},{id:"familiar",min:15,name:"相知",addressing:"你",description:"她开始记住你说过的话。"},{id:"close",min:35,name:"心悦",addressing:"名字",description:"牵挂已藏不住。"},{id:"devoted",min:65,name:"同心",addressing:"心上人",description:"愿与你共赴山海。"}];
function relationshipStage(character:CharacterDefinition,value:number){return [...(character.relationshipStages?.length?character.relationshipStages:FALLBACK_STAGES)].sort((a,b)=>b.min-a.min).find((stage)=>value>=stage.min)??FALLBACK_STAGES[0]}
const PREFERENCE_LABELS={loved:"珍爱",liked:"喜欢",neutral:"寻常",disliked:"不喜"} as const;

function speakerName(speaker: string, characterMap: Record<string, CharacterDefinition>) {
  if (speaker === "player") return "你";
  if (speaker === "narrator") return "旁白";
  return characterMap[speaker as CharacterId]?.name ?? speaker;
}

type BondFeedback = { id: number; characterId: CharacterId; amount: number; source?: string };
type ExplorePoint = { eventId: string; x: number; y: number };
type InspectionReveal = { scene: SceneDefinition; event: EventDefinition | null };

export default function GameDemo() {
  const { state: unifiedState, setRomance: setGame, applyEffects: applyUnifiedEffects, hydrated, resetGame } = useUnifiedGame();
  const game = unifiedState.romance;
  const [eventDefinitions, setEventDefinitions] = useState<EventDefinition[]>(EVENTS);
  const [definitionsReady, setDefinitionsReady] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const [managedCharacters, setManagedCharacters] = useState<CharacterDefinition[]>([]);
  const [managedScenes, setManagedScenes] = useState<SceneDefinition[]>([]);
  const [managedGifts, setManagedGifts] = useState<GiftDefinition[]>([]);
  const [managedMessages, setManagedMessages] = useState<CharacterMessageDefinition[]>([]);
  const [dialogueProfiles, setDialogueProfiles] = useState<DialogueProfileDefinition[]>([]);
  const [globalKeys, setGlobalKeys] = useState<GlobalKeyDefinition[]>(GLOBAL_KEYS);
  const [giftOpen, setGiftOpen] = useState(false);
  const [interactionMenuOpen,setInteractionMenuOpen]=useState(false);
  const [drinkingOpen,setDrinkingOpen]=useState(false);
  const [shopOpen,setShopOpen]=useState(false);
  const [cultivationOpen,setCultivationOpen]=useState(false);
  const [inspectionReveal,setInspectionReveal]=useState<InspectionReveal|null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<{ kind: "battle"; dungeon: DungeonDefinition } | { kind: "alchemy" } | null>(null);
  const [systemPanel, setSystemPanel] = useState<FusionPanelId | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activeActivity, setActiveActivity] = useState<PeriodicActivityId | null>(null);
  const [realDateKey,setRealDateKey]=useState(()=>getLocalDateKey());
  const [fortuneHistory,setFortuneHistory]=useState<Record<string,FortuneDrawRecord>>({});
  const [fortuneHydrated,setFortuneHydrated]=useState(false);
  const [panel, setPanel] = useState<"characters" | "events" | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [collectionOpen,setCollectionOpen]=useState(false);
  const [explorePoints,setExplorePoints]=useState<ExplorePoint[]>([]);
  const [activeExploration,setActiveExploration]=useState<EventDefinition|null>(null);
  const [eggRewardNotice,setEggRewardNotice]=useState<{name:string;image:string}|null>(null);
  const [replayEvent, setReplayEvent] = useState<EventDefinition | null>(null);
  const [audioIndex, setAudioIndex] = useState(0);
  const [unlockNotice, setUnlockNotice] = useState("");
  const [notice, setNotice] = useState("剧情系统已就绪");
  const [keyAnnouncementQueue, setKeyAnnouncementQueue] = useState<GlobalKeyDefinition[]>([]);
  const [messageQueue,setMessageQueue]=useState<CharacterMessageDefinition[]>([]);
  const [messageInboxOpen,setMessageInboxOpen]=useState(false);
  const [replayMessage,setReplayMessage]=useState<CharacterMessageDefinition|null>(null);
  const [stageNotice,setStageNotice]=useState<{characterId:CharacterId;stage:RelationshipStageDefinition}|null>(null);
  const [preferenceNotice,setPreferenceNotice]=useState("");
  const [bondQueue, setBondQueue] = useState<BondFeedback[]>([]);
  const booted = useRef(false);
  const bondId = useRef(0);

  useEffect(() => {
    const receiveModuleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== "huaian-close-module") return;
      setActiveModule(null);
      setNotice(event.data?.settled ? "秘境结算已归入乾坤行囊，时辰随之推移。" : "已返回当前场景。");
    };
    window.addEventListener("message", receiveModuleMessage);
    return () => window.removeEventListener("message", receiveModuleMessage);
  }, []);

  useEffect(() => {
    if (!activeModule) return;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousBodyOverflow; };
  }, [activeModule]);

  useEffect(()=>{
    try{const saved=window.localStorage.getItem(FORTUNE_STORAGE_KEY);if(saved)setFortuneHistory(JSON.parse(saved))}catch{/* A malformed fortune record should not block the game. */}
    setFortuneHydrated(true);
    const timer=window.setInterval(()=>setRealDateKey(getLocalDateKey()),60_000);
    return()=>window.clearInterval(timer);
  },[]);

  useEffect(()=>{if(fortuneHydrated)window.localStorage.setItem(FORTUNE_STORAGE_KEY,JSON.stringify(fortuneHistory))},[fortuneHistory,fortuneHydrated]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/em/gifts?status=published", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<any> : Promise.reject()),
      fetch("/api/em/dialogues?status=published", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<any> : Promise.reject()),
      fetch("/api/em/global-keys?status=published", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<any> : Promise.reject()),
    ]).then(([giftData, dialogueData, keyData]: [{ gifts?: Array<{ definition: GiftDefinition }> }, { dialogues?: Array<{ definition: DialogueProfileDefinition }> }, { keys?: Array<{ definition: GlobalKeyDefinition }> }]) => {
      if (!active) return;
      setManagedGifts((giftData.gifts ?? []).map((item) => item.definition));
      setDialogueProfiles((dialogueData.dialogues ?? []).map((item) => item.definition));
      const managed=(keyData.keys ?? []).map((item) => item.definition); const ids=new Set(managed.map((item)=>item.id)); setGlobalKeys([...GLOBAL_KEYS.filter((item)=>!ids.has(item.id)),...managed]);
    }).catch(() => { /* Built-in gifts and default character lines remain available. */ });
    return () => { active = false; };
  }, []);

  useEffect(()=>{
    let active=true;
    fetch("/api/em/messages?status=published",{cache:"no-store"}).then((response)=>response.ok?response.json() as Promise<any>:Promise.reject()).then((data:{messages?:Array<{definition:CharacterMessageDefinition}>})=>{if(active)setManagedMessages((data.messages??[]).map((item)=>item.definition))}).catch(()=>{/* Built-in letters remain available. */});
    return()=>{active=false};
  },[]);

  useEffect(() => {
    const current = bondQueue[0];
    if (!current) return;
    const timer = window.setTimeout(() => setBondQueue((queue) => queue.slice(1)), current.amount === 1 ? 1300 : 2800);
    return () => window.clearTimeout(timer);
  }, [bondQueue]);

  useEffect(() => {
    let active = true;
    fetch("/api/em/content?status=published", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<any> : Promise.reject(new Error("内容库暂不可用")))
      .then((data: { characters?: Array<{ definition: CharacterDefinition }>; scenes?: Array<{ definition: SceneDefinition }> }) => {
        if (!active) return;
        const characters = (data.characters ?? []).map((item) => item.definition);
        const scenes = (data.scenes ?? []).map((item) => item.definition);
        setManagedCharacters(characters); setManagedScenes(scenes);
        setGame((state) => ({ ...state, relationships: { ...Object.fromEntries(characters.map((item) => [item.id, 4])), ...state.relationships } }));
      })
      .catch(() => { /* Built-in content remains playable if the content library is offline. */ })
      .finally(() => { if (active) setContentReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/em/events?status=published", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<any> : Promise.reject(new Error("事件库暂不可用")))
      .then((data: { events?: Array<{ definition: EventDefinition }> }) => {
        if (!active) return;
        const merged = new Map(EVENTS.map((event) => [event.id, event]));
        for (const item of data.events ?? []) merged.set(item.definition.id, item.definition);
        setEventDefinitions([...merged.values()]);
      })
      .catch(() => { /* Built-in events remain available when the manager is offline. */ })
      .finally(() => { if (active) setDefinitionsReady(true); });
    return () => { active = false; };
  }, []);

  const characters = useMemo(() => {
    const ids = new Set(managedCharacters.map((item) => item.id));
    return [...CHARACTERS.filter((item) => !ids.has(item.id)), ...managedCharacters];
  }, [managedCharacters]);
  const characterMap = useMemo(() => Object.fromEntries(characters.map((item) => [item.id, item])) as Record<string, CharacterDefinition>, [characters]);
  const scenes = useMemo(() => {
    const ids = new Set(managedScenes.map((item) => item.id));
    const definitions = [...SCENES.filter((item) => !ids.has(item.id)), ...managedScenes];
    return definitions.map((item) => ({ ...item, characters: characters.filter((character) => character.sceneId === item.id || character.appearances?.some((appearance)=>appearance.sceneId===item.id)).map((character) => character.id) }));
  }, [characters, managedScenes]);
  const playableScenes = scenes.filter((item) => item.characters.length > 0 || item.id === "bedroom");
  const sceneMap = useMemo(() => Object.fromEntries(scenes.map((item) => [item.id, item])) as Record<string, SceneDefinition>, [scenes]);
  const gifts = useMemo(() => { const ids = new Set(managedGifts.map((item) => item.id)); return [...GIFTS.filter((item) => !ids.has(item.id)), ...managedGifts]; }, [managedGifts]);
  const giftMap = useMemo(() => Object.fromEntries(gifts.map((item) => [item.id, item])) as Record<string, GiftDefinition>, [gifts]);
  const messageDefinitions=useMemo(()=>{const ids=new Set(managedMessages.map((item)=>item.id));return[...CHARACTER_MESSAGES.filter((item)=>!ids.has(item.id)),...managedMessages]},[managedMessages]);

  useEffect(() => {
    if (!hydrated || !definitionsReady) return;
    setGame((state) => scheduleMapEvents(state, eventDefinitions));
  }, [definitionsReady, eventDefinitions, game.completedEvents, game.day, game.flags, game.relationships, hydrated]);

  useEffect(() => {
    setGame((state) => {
      const inventory = { ...state.inventory }; const flags = { ...state.flags }; let changed = false;
      gifts.forEach((gift) => { if (inventory[gift.id] === undefined) { inventory[gift.id] = gift.initialCount; changed = true; } });
      globalKeys.forEach((key) => { if (flags[key.id] === undefined) { flags[key.id] = key.initialValue; changed = true; } });
      return changed ? { ...state, inventory, flags } : state;
    });
  }, [gifts, globalKeys]);

  useEffect(() => { setGame((state)=>applyAutomaticGlobalKeys(state,globalKeys)); }, [game, globalKeys]);

  useEffect(() => {
    if (!hydrated) return;
    const announced = new Set(game.announcedGlobalKeys ?? []);
    const pending = globalKeys.filter((key) => game.flags[key.id] && key.announcement?.enabled && !announced.has(key.id));
    if (!pending.length) return;
    setKeyAnnouncementQueue((queue) => [...queue, ...pending.filter((key)=>!queue.some((queued)=>queued.id===key.id))]);
    setGame((state)=>({...state,announcedGlobalKeys:[...(state.announcedGlobalKeys??[]),...pending.map((key)=>key.id)]}));
  }, [game.announcedGlobalKeys, game.flags, globalKeys, hydrated]);

  useEffect(()=>{
    if(!hydrated||game.activeEvent)return;
    const eligible=getEligibleMessages(game,messageDefinitions);
    const available=messageDefinitions.filter((message)=>(game.receivedMessages.includes(message.id)||eligible.some((item)=>item.id===message.id))&&!game.claimedMessages.includes(message.id));
    if(eligible.length)setGame((state)=>({...state,receivedMessages:[...new Set([...state.receivedMessages,...eligible.map((message)=>message.id)])]}));
    if(available.length)setMessageQueue((queue)=>{const additions=available.filter((message)=>!queue.some((item)=>item.id===message.id));return additions.length?[...queue,...additions]:queue});
  },[game,hydrated,messageDefinitions]);

  useEffect(() => {
    if (!hydrated || !isMarketReminderDay(game.day)) return;
    const reminderId = marketReminderKey(game.day);
    if (game.activityNotices.includes(reminderId)) return;
    const reminder: CharacterMessageDefinition = {
      id: reminderId,
      senderCharacterId: "hua",
      title: "明日云市开门",
      body: "明日是十五，云州市集会开一整日。拍卖行有新到的旧物，石坊也运来一批星髓原石。若你想去，我在市口等你。",
      signature: "花照影",
      conditions: [],
    };
    setMessageQueue((queue) => queue.some((item) => item.id === reminderId) ? queue : [...queue, reminder]);
    setGame((state) => ({ ...state, activityNotices: [...state.activityNotices, reminderId] }));
    setNotice("收到传音 · 明日云州市集开市");
  }, [game.activityNotices, game.day, hydrated]);

  useEffect(() => {
    if (!hydrated || !definitionsReady || !contentReady || booted.current) return;
    booted.current = true;
    setGame((state) => {
      const automatic=applyAutomaticGlobalKeys(state,globalKeys);
      const resolved=resolveScenePresence(automatic,automatic.sceneId,characters,eventDefinitions,true);
      const selected=resolved.present[0]??state.selectedCharacterId;
      const ready={...resolved.state,selectedCharacterId:selected};
      const context:TriggerContext={trigger:"scene_enter",sceneId:state.sceneId,characterId:resolved.present[0]};
      if(resolved.forcedEvent){setNotice(`人物事件触发 · ${resolved.forcedEvent.title}`);return startDefinition(ready,resolved.forcedEvent,context)}
      const event=chooseEvent(getEligibleEvents(eventDefinitions,ready,context).filter((item)=>!isExplorationEvent(item)));
      return event?startDefinition(ready,event,context):ready;
    });
  }, [characters, contentReady, definitionsReady, eventDefinitions, hydrated]);

  useEffect(() => {
    if (!hydrated || !definitionsReady || !contentReady) return;
    setGame((state) => {
      if (state.activeEvent) return state;
      const event = chooseEvent(getDueCalendarEvents(state, eventDefinitions));
      if (!event) return state;
      queueMicrotask(() => setNotice(`日期事件触发 · ${event.title}`));
      const base = { ...state, sceneId: event.sceneId, selectedCharacterId: event.characterId };
      return startDefinition(base, event, { trigger: "calendar_event", sceneId: event.sceneId, characterId: event.characterId });
    });
  }, [contentReady, definitionsReady, eventDefinitions, game.activeEvent, game.calendarEventRuns, game.completedEvents, game.day, game.flags, game.period, game.relationships, hydrated]);

  const baseScene = sceneMap[game.sceneId] ?? playableScenes[0] ?? scenes[0];
  const scene = resolveSceneVariant(baseScene, game);
  const presentIds = game.presentCharacters[scene.id] ?? scene.characters.filter((id)=>{const item=characterMap[id];const appearances=item?.appearances?.filter((entry)=>entry.sceneId===scene.id);return appearances?.length?appearances.some((entry)=>entry.mode==="resident"):((item?.presence?.mode??"resident")==="resident")});
  const activeCharacters = presentIds.map((id) => characterMap[id]).filter(Boolean);
  const hasPresentCharacter = activeCharacters.length > 0;
  const character = characterMap[game.selectedCharacterId] ?? activeCharacters[0] ?? characters[0];
  const node = currentNode(game, eventDefinitions);
  const activeDefinition = game.activeEvent ? resolveEvent(game.activeEvent, eventDefinitions) : null;
  const audioEvents = eventDefinitions.filter((event)=>event.cardStyle==="audio");
  const unlockedAudioEvents = audioEvents.filter((event)=>game.completedEvents.includes(event.id));
  const activeAudioEvent = activeDefinition?.cardStyle === "audio" ? activeDefinition : replayEvent;
  const activeAudioSegment = activeAudioEvent?.audioSegments?.[audioIndex];
  const activeAudioFrame = getAudioFrame(activeAudioEvent?.audioFrameId);
  const easterEggEvents=eventDefinitions.filter((event)=>event.cardStyle==="easter_egg"&&event.exploration?.rewardItem);
  const collectedEggItems=easterEggEvents.filter((event)=>game.collectedEasterEggs.includes(event.exploration!.rewardItem!.id)).map((event)=>({event,item:event.exploration!.rewardItem!}));
  const completedCount = eventDefinitions.filter((event) => event.journal && game.completedEvents.includes(event.id)).length;
  const totalEvents = eventDefinitions.filter((event) => event.journal).length;
  const isSpecialEvent = activeDefinition?.cardStyle === "special";
  const specialPortrait = node?.portrait || activeDefinition?.defaultPortrait || character.image;
  const stageEffect = node?.stageEffect ?? "none";
  const relationship = game.relationships[character.id] ?? 4;
  const currentStage=relationshipStage(character,relationship);
  const drinkingConfig=character.interactions?.drinking;
  const canDrink=Boolean(drinkingConfig?.enabled&&drinkingConfig.sceneIds.includes(game.sceneId)&&drinkingConfig.periods.includes(game.period)&&relationship>=drinkingConfig.minRelationship);
  const drinkingCountKey=`${character.id}:drinking`;
  const drinkingProficiency=getProficiencyProfile(game.proficiencyExperience.drinking??0);
  const bondFeedback = bondQueue[0] ?? null;
  const activeMessage=replayMessage??messageQueue[0]??null;
  const calendarDate = getCalendarDate(game.day);
  const sceneEventHints = useMemo(() => getSceneEventHints(game, eventDefinitions, playableScenes.map((item) => item.id)), [eventDefinitions, game, playableScenes]);
  const visibleMapEvents = useMemo(() => getVisibleMapEvents(game, eventDefinitions), [eventDefinitions, game]);
  const inspectionHints=useMemo(()=>getInspectionHints(game,eventDefinitions,playableScenes.map((item)=>item.id)),[eventDefinitions,game,playableScenes]);
  const availableActivities = useMemo(() => getAvailableActivities(game), [game.day, game.sceneId]);
  const activeFortune=fortuneHistory[realDateKey];
  const activeFortuneSign=getFortuneSign(activeFortune);

  useEffect(()=>{if(activeDefinition?.cardStyle==="audio")setAudioIndex(0)},[activeDefinition?.id, activeDefinition?.cardStyle]);

  useEffect(()=>{
    if(!hydrated||!definitionsReady||!contentReady||game.activeEvent){setExplorePoints([]);return}
    const contexts:TriggerContext[]=[{trigger:"scene_enter",sceneId:game.sceneId,characterId:game.selectedCharacterId},{trigger:"time_change",sceneId:game.sceneId,characterId:game.selectedCharacterId}];
    const found=new Map<string,EventDefinition>();
    contexts.flatMap((context)=>getEligibleEvents(eventDefinitions,game,context)).filter(isExplorationEvent).forEach((event)=>found.set(event.id,event));
    const points=[...found.values()].filter((event)=>Math.random()*100<(event.exploration?.chance??100)).slice(0,3).map((event,index)=>{
      const config=event.exploration!;const fixed=config.positionMode==="fixed";
      const x=fixed?Math.max(8,Math.min(92,config.x??50)):16+((Math.random()*68+index*19)%68);
      const y=fixed?Math.max(8,Math.min(72,config.y??38)):14+((Math.random()*46+index*13)%46);
      return{eventId:event.id,x,y};
    });
    setExplorePoints(points);
  },[contentReady,definitionsReady,eventDefinitions,game.activeEvent,game.completedEvents,game.day,game.flags,game.period,game.relationships,game.sceneId,game.selectedCharacterId,hydrated]);

  const nextHint = useMemo(() => {
    const characterEvents = eventDefinitions.filter((event) => event.characterId === character.id && !game.completedEvents.includes(event.id));
    return characterEvents[0]?.clue ?? "缘分尚有余章，静候后续更新";
  }, [character.id, eventDefinitions, game.completedEvents]);

  function launch(context: TriggerContext, base: GameState, fallback?: "talk" | "gift") {
    // Automatic world keys must become visible before event eligibility is
    // checked. Otherwise a key reached by this very action would only affect
    // the following click, making audio events appear to be lost.
    base = applyAutomaticGlobalKeys(base, globalKeys);
    const chosen = chooseEvent(getEligibleEvents(eventDefinitions, base, context).filter((item)=>!isExplorationEvent(item)));
    if (chosen) {
      if(context.trigger==="gift"&&context.giftId)base=applyEffects(base,[{type:"consume_gift",giftId:context.giftId,amount:1}]);
      setNotice(`事件触发 · ${chosen.title}`);
      return startDefinition(base, chosen, context);
    }
    if ((fallback === "talk" || fallback === "gift") && base.stamina < 1) {
      setNotice("体力已耗尽 · 请推移到下一个时辰，或食用糕点恢复体力");
      return base;
    }
    if (fallback === "talk" && context.characterId) {
      const target = characterMap[context.characterId];
      const countKey = `${base.day}:${base.period}:${target.id}`;
      const nextCount = (base.talkCounts[countKey] ?? 0) + 1;
      const counted = { ...base, stamina: base.stamina - 1, talkCounts: { ...base.talkCounts, [countKey]: nextCount } };
      const profile = dialogueProfiles.find((item) => item.characterId === target.id);
      const rule = profile?.rules.filter((item) => item.period === base.period && (base.relationships[target.id] ?? 0) >= item.minRelationship && (base.relationships[target.id] ?? 0) <= item.maxRelationship).sort((a,b) => b.minRelationship - a.minRelationship)[0];
      const closing = Boolean(rule && nextCount > rule.closingAfter);
      const line = rule ? (closing ? rule.closingLine : rule.lines[(base.day + nextCount + (base.relationships[target.id] ?? 0)) % rule.lines.length]) : undefined;
      setNotice(closing ? `${base.period}交谈已尽 · 触发结束语` : "触发日常闲谈");
      return startTransient(counted, buildAmbientEvent(target, nextCount, line, closing), context);
    }
    if (fallback === "gift" && context.characterId && context.giftId) {
      const target = characterMap[context.characterId];
      const gift = giftMap[context.giftId];
      const preference=target.giftPreferences?.find((item)=>item.giftId===gift.id);const tier=preference?.tier??(target.lovedGift===gift.id?"loved":"neutral");
      setNotice(tier==="loved"?"正合她的心意":tier==="liked"?"她看起来很喜欢":tier==="disliked"?"这似乎并不合她心意":"她收下了礼物");
      const spent=applyEffects({...base,stamina:base.stamina-1},[{type:"consume_gift",giftId:context.giftId,amount:1}]);
      return startTransient(spent, buildGiftFallback(target, gift.name, tier, preference?.reaction), context);
    }
    return base;
  }

  function enterScene(sceneId: SceneId) {
    if (sceneId === game.sceneId || game.activeEvent) return;
    const destination = sceneMap[sceneId];
    if (!destination || (!destination.characters.length && destination.id!=="bedroom")) return;
    setInteractionMenuOpen(false);
    setNotice(`抵达 · ${destination.name}`);
    setGame((state)=>{const base:GameState=applyAutomaticGlobalKeys({...state,sceneId,activeEvent:null},globalKeys);const resolved=resolveScenePresence(base,sceneId,characters,eventDefinitions,true);const selected=resolved.present[0]??destination.characters[0]??state.selectedCharacterId;const ready={...resolved.state,selectedCharacterId:selected};const context:TriggerContext={trigger:"scene_enter",sceneId,characterId:selected};if(resolved.forcedEvent){setNotice(`人物事件触发 · ${resolved.forcedEvent.title}`);return startDefinition(ready,resolved.forcedEvent,context)}return launch(context,ready)});
  }

  function triggerMapEvent(eventId: string) {
    const event = eventDefinitions.find((item) => item.id === eventId && item.trigger === "map_event" && item.mapEvent);
    if (!event) return;
    setNotice(`地图异闻触发 · ${event.title}`);
    setGame((state) => {
      const scheduledDay = state.mapEventSchedules?.[event.id];
      if (state.activeEvent || scheduledDay === undefined || scheduledDay > state.day || state.completedEvents.includes(event.id)) return state;
      const base = applyAutomaticGlobalKeys({ ...state, sceneId: event.sceneId, selectedCharacterId: event.characterId, activeEvent: null }, globalKeys);
      return startDefinition(base, event, { trigger: "map_event", sceneId: event.sceneId, characterId: event.characterId });
    });
  }

  function selectCharacter(id: CharacterId) {
    if (game.activeEvent) return;
    setGame((state) => ({ ...state, selectedCharacterId: id }));
    setInteractionMenuOpen(false);
    setNotice(`正在与${characterMap[id].name}相处`);
  }

  function talk() {
    if (game.activeEvent) return;
    const context: TriggerContext = { trigger: "talk", sceneId: game.sceneId, characterId: character.id };
    setGame((state) => launch(context, state, "talk"));
  }

  function giveGift(giftId: GiftId) {
    if (game.inventory[giftId] <= 0) return;
    setGiftOpen(false);
    const context: TriggerContext = { trigger: "gift", sceneId: game.sceneId, characterId: character.id, giftId };
    const preference=character.giftPreferences?.find((item)=>item.giftId===giftId);const known=(game.discoveredGiftPreferences[character.id]??[]).includes(giftId);
    if(!known){const tier=preference?.tier??(character.lovedGift===giftId?"loved":"neutral");setPreferenceNotice(`发现偏好 · ${character.name}${PREFERENCE_LABELS[tier]}「${giftMap[giftId].name}」`);window.setTimeout(()=>setPreferenceNotice(""),2200)}
    setGame((state) => {const discovered=state.discoveredGiftPreferences[character.id]??[];const remembered={...state,discoveredGiftPreferences:{...state.discoveredGiftPreferences,[character.id]:discovered.includes(giftId)?discovered:[...discovered,giftId]}};return launch(context, remembered, "gift")});
  }

  function advanceTime() {
    if (game.activeEvent) return;
    const current = PERIODS.indexOf(game.period);
    const wrapped = current === PERIODS.length - 1;
    const period = PERIODS[(current + 1) % PERIODS.length];
    const context: TriggerContext = { trigger: "time_change", sceneId: game.sceneId };
    setInteractionMenuOpen(false);
    setNotice(wrapped ? `第${game.day+1}日 · ${period}` : `时辰推移 · ${period}`);
    setGame((state)=>{const base=applyAutomaticGlobalKeys({...state,period,day:wrapped?state.day+1:state.day,stamina:10},globalKeys);const resolved=resolveScenePresence(base,state.sceneId,characters,eventDefinitions,false);const ready={...resolved.state,selectedCharacterId:resolved.present[0]??state.selectedCharacterId};if(resolved.forcedEvent){const eventContext:TriggerContext={trigger:"scene_enter",sceneId:state.sceneId,characterId:resolved.present[0]};setNotice(`人物事件触发 · ${resolved.forcedEvent.title}`);return startDefinition(ready,resolved.forcedEvent,eventContext)}const seeking=resolveSeekingEncounter(ready,characters,eventDefinitions);if(seeking){setNotice(`主动相遇 · ${seeking.rule.intro}`);const seekingContext:TriggerContext={trigger:"time_change",sceneId:ready.sceneId,characterId:seeking.character.id};return seeking.event?startDefinition(seeking.state,seeking.event,seekingContext):seeking.state}return launch({...context,characterId:ready.selectedCharacterId},ready)});
  }

  function currentInitialState(): GameState {
    const firstScene = playableScenes.find((item) => item.id === "lingxiao") ?? playableScenes[0] ?? scenes[0];
    const firstCharacter = firstScene?.characters[0] ?? characters[0]?.id ?? "shen";
    return { ...INITIAL_STATE, sceneId: firstScene?.id ?? "lingxiao", selectedCharacterId: firstCharacter, spiritStones: 600, stamina:10, experience:0, marketTreasures: {}, activityNotices: [], relationships: Object.fromEntries(characters.map((item) => [item.id, 4])), inventory: Object.fromEntries(gifts.map((item) => [item.id, item.initialCount])), flags: Object.fromEntries(globalKeys.map((item)=>[item.id,item.initialValue])), announcedGlobalKeys: [], receivedMessages: [], claimedMessages: [], discoveredGiftPreferences: {}, seekingEncounterDays: {}, mapEventSchedules: {}, calendarEventRuns: {}, completedEvents: [], eventRuns: {}, talkCounts: {}, presentCharacters: {}, appearanceTriggersUsed: [], sceneVisits: {}, sceneInspectionDays:{}, interactionCounts:{}, proficiencyExperience:{}, activeEvent: null, lastContext: null };
  }

  function recoverGifts() {
    setGame((state) => ({ ...state, inventory: Object.fromEntries(gifts.map((item) => [item.id, item.initialCount])) }));
    setGiftOpen(false); setNotice("所有礼物已恢复至 EM 设定的初始数量");
  }

  function resetDemo() {
    resetGame();
    setPanel(null);
    setGiftOpen(false);
    setInteractionMenuOpen(false);setDrinkingOpen(false);
    setMapOpen(false);
    setCalendarOpen(false);
    setCultivationOpen(false);setInspectionReveal(null);
    setActiveActivity(null);
    setGalleryOpen(false); setReplayEvent(null); setUnlockNotice(""); setAudioIndex(0);setCollectionOpen(false);setActiveExploration(null);setExplorePoints([]);setEggRewardNotice(null);
    setKeyAnnouncementQueue([]);setMessageQueue([]);setReplayMessage(null);setMessageInboxOpen(false);setStageNotice(null);setPreferenceNotice("");
    const resetState = currentInitialState();
    setGame(resetState);
    setNotice("篇章已经重新开始");
    window.setTimeout(() => {
      setGame((state)=>{const automatic=applyAutomaticGlobalKeys(state,globalKeys);const resolved=resolveScenePresence(automatic,automatic.sceneId,characters,eventDefinitions,true);const ready={...resolved.state,selectedCharacterId:resolved.present[0]??automatic.selectedCharacterId};const context:TriggerContext={trigger:"scene_enter",sceneId:automatic.sceneId,characterId:ready.selectedCharacterId};if(resolved.forcedEvent)return startDefinition(ready,resolved.forcedEvent,context);const event=chooseEvent(getEligibleEvents(eventDefinitions,ready,context).filter((item)=>!isExplorationEvent(item)));return event?startDefinition(ready,event,context):ready});
    }, 180);
  }

  function advance(optionId?: string) {
    const title = activeDefinition?.title;
    const willClose = Boolean(node && (node.type === "end" || (node.type === "line" && activeDefinition?.nodes[node.next]?.type === "end")));
    setGame((state) => {
      let next = advanceEvent(state, eventDefinitions, optionId);
      if (state.activeEvent && !next.activeEvent && activeDefinition?.trigger === "calendar_event") next = markCalendarEventCompleted(next, activeDefinition, state.day);
      const fortuneAction=state.lastContext?.trigger==="talk"?"talk":state.lastContext?.trigger==="gift"?"gift":undefined;
      const boosted=Boolean(activeFortuneSign&&fortuneAction&&fortuneBoosts(activeFortuneSign.effect,fortuneAction));
      if(boosted){const relationships={...next.relationships};for(const [id,value] of Object.entries(next.relationships)){const baseGain=value-(state.relationships[id]??0);if(baseGain>0)relationships[id]=Math.min(100,value+baseGain)}next={...next,relationships}}
      const gains = Object.entries(next.relationships).map(([id,value]) => ({ characterId:id, amount:value-(state.relationships[id]??0) })).filter((item)=>item.amount>0) as Array<{characterId:CharacterId;amount:number}>;
      if (gains.length) queueMicrotask(() => setBondQueue((queue) => [...queue, ...gains.map((gain) => ({ id: ++bondId.current, ...gain,source:boosted?`「${activeFortuneSign?.title}」金运加持`:undefined }))]));
      const promotion=gains.map((gain)=>{const target=characterMap[gain.characterId];const before=relationshipStage(target,state.relationships[gain.characterId]??0);const after=relationshipStage(target,next.relationships[gain.characterId]??0);return before.id!==after.id?{characterId:gain.characterId,stage:after}:null}).find((item):item is {characterId:CharacterId;stage:RelationshipStageDefinition}=>Boolean(item));
      if(promotion)queueMicrotask(()=>setStageNotice(promotion));
      return next;
    });
    if (willClose && title) setNotice(`事件完成 · ${title}`);
  }

  function advanceAudioStory() {
    if(!activeAudioEvent)return;const segments=activeAudioEvent.audioSegments??[];
    if(audioIndex<segments.length-1){setAudioIndex((value)=>value+1);return}
    if(replayEvent){setReplayEvent(null);setGalleryOpen(true);setAudioIndex(0);return}
    setGame((state)=>{const next=advanceEvent(state,eventDefinitions);return activeAudioEvent.trigger==="calendar_event"?markCalendarEventCompleted(next,activeAudioEvent,state.day):next});
    const title=activeAudioEvent.unlockTitle||activeAudioEvent.title;setUnlockNotice(`解锁「${title}」事件`);setNotice(`音画事件解锁 · ${title}`);
    window.setTimeout(()=>{setUnlockNotice("");setGalleryOpen(true)},1800);
  }

  function resolveExploration(){
    if(!activeExploration?.exploration)return;
    const event=activeExploration;const config=event.exploration!;const context:TriggerContext={trigger:event.trigger,sceneId:event.sceneId,characterId:event.characterId};
    setExplorePoints((points)=>points.filter((point)=>point.eventId!==event.id));
    setActiveExploration(null);
    if(event.cardStyle==="trigger_point"){
      setGame((state)=>startDefinition(state,event,context));setNotice(`触发隐秘剧情 · ${event.title}`);return;
    }
    const item=config.rewardItem;if(!item)return;
    setGame((state)=>({...state,completedEvents:(event.journal||event.once)&&!state.completedEvents.includes(event.id)?[...state.completedEvents,event.id]:state.completedEvents,eventRuns:{...state.eventRuns,[event.id]:(state.eventRuns[event.id]??0)+1},collectedEasterEggs:[...new Set([...state.collectedEasterEggs,item.id])]}));
    applyUnifiedEffects([{ type: "add_item", item: { itemId: item.id, itemType: "quest", rarity: 4, amount: 1, sourceTags: ["剧情", "藏珍录"], locked: true } }]);
    setEggRewardNotice({name:item.name,image:item.image});setNotice(`获得彩蛋物品 · ${item.name}`);window.setTimeout(()=>setEggRewardNotice(null),2200);
  }

  function closeMessage(){
    if(!activeMessage)return;
    if(replayMessage){setReplayMessage(null);return}
    setGame((state)=>{
      const sender=characterMap[activeMessage.senderCharacterId]??characters[0];const before=relationshipStage(sender,state.relationships[sender.id]??0);const amount=activeMessage.relationshipAmount??0;const relationship=Math.min(100,(state.relationships[sender.id]??0)+amount);const after=relationshipStage(sender,relationship);
      if(before.id!==after.id)queueMicrotask(()=>setStageNotice({characterId:sender.id,stage:after}));
      return {...state,claimedMessages:[...new Set([...state.claimedMessages,activeMessage.id])],relationships:{...state.relationships,[sender.id]:relationship},inventory:activeMessage.giftId?{...state.inventory,[activeMessage.giftId]:(state.inventory[activeMessage.giftId]??0)+(activeMessage.giftAmount??1)}:state.inventory,flags:activeMessage.setFlagKey?{...state.flags,[activeMessage.setFlagKey]:true}:state.flags};
    });
    setMessageQueue((queue)=>queue.filter((message)=>message.id!==activeMessage.id));
    setNotice(`收到传音 · ${activeMessage.title}`);
  }

  function spendSpiritStones(amount: number) {
    if (game.spiritStones < amount) { setNotice(`灵石不足 · 还需 ${amount - game.spiritStones} 枚`); return false; }
    setGame((state) => ({ ...state, spiritStones: Math.max(0, state.spiritStones - amount) }));
    setNotice(`支出灵石 ${amount} 枚`); return true;
  }

  function spendStamina(amount:number,label:string){
    if(game.stamina<amount){setNotice(`体力不足 · ${label}需要 ${amount} 点体力`);return false}
    setGame((state)=>({...state,stamina:Math.max(0,state.stamina-amount)}));setNotice(`${label} · 体力 -${amount}`);return true;
  }

  function eatGift(giftId:GiftId){
    const gift=giftMap[giftId];const restore=gift?.energyRestore??0;
    if(!gift||restore<=0||game.inventory[giftId]<=0)return;
    if(game.stamina>=10){setNotice("当前体力充盈，无需食用糕点");return}
    setGame((state)=>({...state,stamina:Math.min(10,state.stamina+restore),inventory:{...state.inventory,[giftId]:Math.max(0,state.inventory[giftId]-1)}}));
    setGiftOpen(false);setNotice(`食用${gift.name} · 体力恢复 ${Math.min(restore,10-game.stamina)} 点`);
  }

  function completeCultivation(results:CultivationEntry[]){
    const gained=results.reduce((sum,result)=>sum+result.experience,0);
    setGame((state)=>({...state,stamina:Math.max(0,state.stamina-results.length*2),experience:state.experience+gained}));
    setNotice(`练功完成 · 修为 +${gained} · 体力 -${results.length*2}`);
  }

  function recordDrinkingWin(wins:number){
    setGame((state)=>({...state,interactionCounts:{...state.interactionCounts,[drinkingCountKey]:Math.max(state.interactionCounts[drinkingCountKey]??0,wins)}}));
    setNotice(`共饮成功 · ${character.name}酒兴 ${wins}`);
  }

  function practiceDrinking(amount:number){
    setGame((state)=>({...state,proficiencyExperience:{...state.proficiencyExperience,drinking:(state.proficiencyExperience.drinking??0)+amount}}));
  }

  function triggerDrinkingSpecial(wins:number){
    const config=character.interactions?.drinking;setDrinkingOpen(false);setInteractionMenuOpen(false);
    if(!config?.specialEventId){setNotice(`与${character.name}尽兴而归 · 酒兴 ${wins}`);return}
    const context:TriggerContext={trigger:"interaction",interactionId:"drinking",sceneId:game.sceneId,characterId:character.id};
    setGame((state)=>{
      const base={...state,interactionCounts:{...state.interactionCounts,[drinkingCountKey]:Math.max(state.interactionCounts[drinkingCountKey]??0,wins)}};
      const event=getEligibleEvents(eventDefinitions,base,context).find((item)=>item.id===config.specialEventId);
      if(!event){queueMicrotask(()=>setNotice(`共饮达成 · ${character.name}酒兴 ${wins}`));return base}
      queueMicrotask(()=>setNotice(`共饮特殊事件 · ${event.title}`));return startDefinition(base,event,context);
    });
  }

  function inspectScene(sceneId:SceneId){
    if(game.period!=="夜晚"){setNotice("检视只能在夜晚进行");return}
    if(game.sceneInspectionDays?.[sceneId]===game.day){setNotice("这个场景今日已经检视过了");return}
    const target=sceneMap[sceneId];if(!target)return;
    const event=rollInspectionEvent(game,eventDefinitions,sceneId);
    setGame((state)=>({...state,sceneInspectionDays:{...state.sceneInspectionDays,[sceneId]:state.day}}));
    setInspectionReveal({scene:resolveSceneVariant(target,{...game,sceneId}),event});setNotice(`夜间检视 · ${target.name}`);
  }

  function enterInspectionEvent(event:EventDefinition){
    setInspectionReveal(null);setNotice(`检视事件触发 · ${event.title}`);
    setGame((state)=>startDefinition(applyAutomaticGlobalKeys({...state,sceneId:event.sceneId,selectedCharacterId:event.characterId},globalKeys),event,{trigger:"inspection",sceneId:event.sceneId,characterId:event.characterId}));
  }

  function gainSpiritStones(amount: number, message: string) {
    setGame((state) => ({ ...state, spiritStones: state.spiritStones + amount }));
    setNotice(`${message} · 灵石 +${amount}`);
  }

  function gainHuaBond(amount: number) {
    setGame((state) => ({ ...state, relationships: { ...state.relationships, hua: Math.min(100, (state.relationships.hua ?? 0) + amount) } }));
    setBondQueue((queue) => [...queue, { id: ++bondId.current, characterId: "hua", amount }]);
  }

  function collectMarketTreasure(item: { id: string; name: string }, source: string) {
    setGame((state) => ({ ...state, marketTreasures: { ...state.marketTreasures, [item.id]: (state.marketTreasures[item.id] ?? 0) + 1 } }));
    setNotice(`获得宝物 · ${item.name}（${source}）`);
  }

  function buyMarketGift(giftId: GiftId, name: string) {
    setGame((state) => ({ ...state, inventory: { ...state.inventory, [giftId]: (state.inventory[giftId] ?? 0) + 1 } }));
    setNotice(`购得 ${name} · 已收入礼物行囊`);
  }

  function openActivity(id: PeriodicActivityId) {
    if (!availableActivities.some((activity) => activity.id === id)) return;
    setActiveActivity(id);
    setNotice(id === "tavern-gambling" ? "周期活动开启 · 醉月赌局" : id === "monthly-market" ? "周期活动开启 · 云州市集" : fortuneHistory[realDateKey] ? "查看今日签文 · 悬壶问卦" : "每日活动开启 · 悬壶问卦");
  }

  function drawFortuneToday(){const existing=fortuneHistory[realDateKey];if(existing)return existing;const record=drawDailyFortune(realDateKey);setFortuneHistory((history)=>({...history,[realDateKey]:record}));setNotice(`今日签文 · ${getFortuneSign(record)?.rank}「${getFortuneSign(record)?.title}」`);return record}

  return (
    <main className="game-shell">
      <div className="paper-noise" aria-hidden="true" />
      <header className="topbar">
        <button type="button" className={`map-entry-button ${visibleMapEvents.length ? "has-map-event" : ""}`} onClick={() => setMapOpen(true)} aria-label={visibleMapEvents.length ? `打开山河地图，有${visibleMapEvents.length}处待完成异闻` : "打开山河地图"}><span className="map-fold-icon"><i/><i/><i/></span><small>地图</small>{visibleMapEvents.length > 0 && <b className="map-entry-alert">!</b>}</button>
        <button type="button" className="calendar-entry-button" onClick={() => setCalendarOpen(true)} aria-label="打开云和历"><span className="calendar-page-icon"><i/><i/><b>{calendarDate.day}</b></span><small>日历</small></button>
        <div className="brand-block">
          <div className="seal">槐</div>
          <div><p className="eyebrow">山河入梦 · 与卿同游</p><h1>槐安一梦</h1></div>
        </div>
        <div className="world-state" aria-label="当前时间"><span>第 {game.day} 日</span><i /><span>{calendarDate.eraYear} · {calendarDate.monthName}{calendarDate.dayName}</span><i /><span>{calendarDate.weekdayName} · {game.period}</span><i /><span className="stamina-balance">体力 {game.stamina}/10</span><i/><span className="spirit-stone-balance">灵石 {game.spiritStones}</span><i/><span className="proficiency-balance">酒艺 {drinkingProficiency.level}阶·{drinkingProficiency.name}</span></div>
        <nav className="top-actions" aria-label="功能菜单">
          <button type="button" onClick={() => setPanel("characters")}>人物谱</button>
          <a className="em-entry" href="/em">EM 管理台</a>
          <button type="button" onClick={() => setPanel("events")}>事件簿 <b>{completedCount}/{totalEvents}</b></button>
          <button type="button" onClick={()=>setMessageInboxOpen(true)}>传音 <b>{game.receivedMessages.length}</b></button>
          <button type="button" onClick={() => setGalleryOpen(true)}>展馆 <b>{unlockedAudioEvents.length}/{audioEvents.length}</b></button>
          <button type="button" onClick={()=>setCollectionOpen(true)}>藏珍 <b>{game.collectedEasterEggs.length}/{easterEggEvents.length}</b></button>
          <button type="button" onClick={()=>setGiftOpen(true)}>行囊</button>
          <button type="button" className="time-button" onClick={advanceTime}>推移时辰</button>
        </nav>
      </header>

      <div className="mobile-calendar-date" aria-label="今日日期">{calendarDate.eraYear} · {calendarDate.monthName}{calendarDate.dayName} · {calendarDate.weekdayName}</div>

      <section className="scene-tabs" aria-label="场景选择">
        {playableScenes.map((item) => (
          <button type="button" key={item.id} className={item.id === game.sceneId ? "active" : ""} onClick={() => enterScene(item.id)}>
            <span>{item.shortName}</span><strong>{item.name}</strong>
          </button>
        ))}
      </section>

      <section className={`stage ${isSpecialEvent ? "special-event-active" : ""} stage-fx-${stageEffect}`} style={{ backgroundImage: `url(${scene.image})` }}>
        {isSpecialEvent && <div key={`${activeDefinition?.id}-${activeDefinition?.openingEffect}`} className={`special-opening special-opening-${activeDefinition?.openingEffect ?? "none"}`} aria-hidden="true" />}
        <div className="stage-wash" aria-hidden="true" />
        <div className="scene-title"><p>{scene.atmosphere}</p><h2>{scene.name}</h2><span>{scene.description}</span></div>
        {activeFortuneSign&&activeFortuneSign.effect!=="none"&&<div className="fortune-buff-chip"><i>✦</i><span><small>今日金运 · {activeFortuneSign.rank}</small><strong>{activeFortuneSign.title}</strong><em>{fortuneEffectLabel(activeFortuneSign.effect).replace("金运 · ","")}</em></span></div>}
        {!game.activeEvent&&!activeExploration&&explorePoints.map((point)=>{const event=eventDefinitions.find((item)=>item.id===point.eventId);if(!event)return null;const egg=event.cardStyle==="easter_egg";return <button type="button" key={event.id} className={`explore-light ${egg?"easter-light":"trigger-light"}`} style={{left:`${point.x}%`,top:`${point.y}%`}} onClick={()=>setActiveExploration(event)} aria-label={egg?"发现彩蛋光点":"发现剧情光点"}><i/><span>{egg?"拾":"寻"}</span></button>})}
        <aside className="present-characters" aria-label="当前在场人物">
          <p>此间人物</p>
          {!activeCharacters.length && <span className="nobody-present">此时无人</span>}
          {activeCharacters.map((item) => (
            <button type="button" key={item.id} className={item.id === character.id ? "active" : ""} onClick={() => selectCharacter(item.id)} aria-label={`选择${item.name}`}>
              <img src={item.image} alt="" /><span>{item.name.slice(0, 1)}</span>
            </button>
          ))}
          {!game.activeEvent && <ActivityCards activities={availableActivities} completedIds={activeFortune?["daily-divination"]:[]} onOpen={openActivity} />}
        </aside>

        {hasPresentCharacter && !isSpecialEvent && <div className="portrait-wrap" key={character.id}>
          <div className="portrait-halo" style={{ "--accent": character.accent } as React.CSSProperties} />
          <img className="main-portrait" src={character.image} alt={`${character.name}人物立绘`} />
        </div>}
        {isSpecialEvent && <div className="special-portrait-wrap" key={`${game.activeEvent?.eventId}-${game.activeEvent?.nodeId}`}><div className="special-portrait-aura" /><img src={specialPortrait} alt={`${character.name}特殊事件立绘`} /></div>}
        {hasPresentCharacter && <div className="character-plaque"><p>{character.role}</p><h3>{character.name}</h3><span>{currentStage.name} · 唤你「{currentStage.addressing}」</span></div>}
        {!game.activeEvent&&scene.id==="bedroom"&&<div className="bedroom-practice-card"><div className="bedroom-formation"><i/><i/><span>炁</span></div><p>PRIVATE CULTIVATION · 静室</p><h3>聚灵阵已启</h3><span>每次练功消耗 2 点体力，运转一周天需 1 秒。</span><div><b>修为 {game.experience}</b><b>体力 {game.stamina}/10</b></div><button type="button" disabled={game.stamina<2} onClick={()=>setCultivationOpen(true)}>{game.stamina<2?"体力不足":"入阵练功"}</button></div>}

        {bondFeedback && bondFeedback.amount === 1 && <div key={bondFeedback.id} className="bond-gain-mini"><span>♥</span> 好感度 +1</div>}
        {bondFeedback && bondFeedback.amount > 1 && <div key={bondFeedback.id} className={`bond-gain-card ${bondFeedback.source?"fortune-boosted":""}`}><img src={characterMap[bondFeedback.characterId]?.image ?? character.image} alt="" /><div><p><strong>{characterMap[bondFeedback.characterId]?.name ?? bondFeedback.characterId}</strong>{bondFeeling(bondFeedback.amount)}</p><span>好感度提升</span>{bondFeedback.source&&<em>{bondFeedback.source}</em>}</div><b>+{bondFeedback.amount}</b><i>♥</i></div>}

        {!game.activeEvent && hasPresentCharacter && (
          <div className={`interaction-dock ${character.id === "ning" || character.id === "huo" ? "has-shop" : ""}`}>
            {canDrink&&interactionMenuOpen&&<div className="interaction-popover"><p>与{character.name}互动</p><button type="button" onClick={()=>{setInteractionMenuOpen(false);setGiftOpen(true)}}><i>礼</i><span><strong>赠予心意</strong><small>从行囊中选择礼物 · 消耗 1 体力</small></span></button><button type="button" onClick={()=>{setInteractionMenuOpen(false);setDrinkingOpen(true)}}><i>酌</i><span><strong>月下共饮</strong><small>{drinkingProficiency.level}阶「{drinkingProficiency.name}」 · 酒兴 {game.interactionCounts[drinkingCountKey]??0}/{drinkingConfig?.specialWinCount}</small></span></button></div>}
            <div className="bond-panel">
              <div><span>缘分 · {currentStage.name}</span><strong>{relationship}</strong></div>
              <div className="bond-track"><i style={{ width: `${relationship}%` }} /></div>
              <p>{nextHint}</p>
            </div>
            {(character.id === "ning" || character.id === "huo") && <button type="button" className="shop-action" onClick={() => setShopOpen(true)}><span className="action-glyph">商</span><span><small>进入</small>{character.id === "huo" ? "玄锋号" : "栖珍阁"}</span></button>}
            <button type="button" className="ink-action" onClick={talk}><span className="action-glyph">言</span><span><small>与她</small>交谈</span></button>
            <button type="button" className={`gold-action ${interactionMenuOpen?"active":""}`} onClick={() => canDrink?setInteractionMenuOpen(value=>!value):setGiftOpen(true)}><span className="action-glyph">{canDrink?"互":"礼"}</span><span><small>{canDrink?"展开":"赠予"}</small>{canDrink?"互动":"心意"}</span></button>
          </div>
        )}

        {game.activeEvent && node && activeDefinition && activeDefinition.cardStyle !== "audio" && (
          <div className="dialogue-box" role="dialog" aria-label={activeDefinition.title}>
            <div className="event-kicker"><span>{activeDefinition.chapter}</span><i /><span>{activeDefinition.type}</span></div>
            {node.type === "choice" ? (
              <div className="choice-content">
                <h4>{node.prompt ?? "你要如何回应？"}</h4>
                <div className="choice-list">
                  {node.options.map((option, index) => (
                    <button type="button" key={option.id} onClick={() => advance(option.id)}><span>{String(index + 1).padStart(2, "0")}</span>{option.label}</button>
                  ))}
                </div>
              </div>
            ) : node.type === "line" ? (
              <button type="button" className="dialogue-advance" onClick={() => advance()} aria-label="继续对话">
                <div className="speaker-row"><strong>{speakerName(node.speaker, characterMap)}</strong>{node.mood && <span>{node.mood}</span>}</div>
                <p>{node.text}</p><span className="continue-mark">继续 ···</span>
              </button>
            ) : (
              <button type="button" className="dialogue-advance" onClick={() => advance()}><p>{node.summary ?? "这一刻被收入了事件簿。"}</p><span className="continue-mark">收起</span></button>
            )}
          </div>
        )}
      </section>

      <footer className="statusbar"><span className="status-dot" /><p>{notice}</p><div className="game-reset-controls"><button type="button" onClick={recoverGifts}>恢复礼物</button><button type="button" onClick={resetDemo}>初始化</button></div><span>事件引擎 · 数据驱动</span></footer>

      <nav className="fusion-world-dock" aria-label="槐安一梦主要功能">
        <button type="button" className={systemPanel === "profile" ? "active" : ""} onClick={() => setSystemPanel("profile")}><i>我</i><span>修士属性</span></button>
        <button type="button" className={mapOpen ? "active" : ""} onClick={() => { setSystemPanel(null); setMapOpen(true); }}><i>山</i><span>山河地图</span>{visibleMapEvents.length > 0 && <b>{visibleMapEvents.length}</b>}</button>
        <button type="button" onClick={() => setPanel("characters")}><i>缘</i><span>人物谱</span></button>
        <button type="button" className={systemPanel === "inventory" ? "active" : ""} onClick={() => setSystemPanel("inventory")}><i>囊</i><span>乾坤行囊</span></button>
        <button type="button" className={systemPanel === "cards" ? "active" : ""} onClick={() => setSystemPanel("cards")}><i>契</i><span>太虚名册</span><b>{unifiedState.shared.cards.length}</b></button>
        <button type="button" className={systemPanel === "skills" ? "active" : ""} onClick={() => setSystemPanel("skills")}><i>法</i><span>万法谱</span></button>
        <button type="button" className={systemPanel === "equipment" ? "active" : ""} onClick={() => setSystemPanel("equipment")}><i>器</i><span>法器阁</span></button>
      </nav>

      {mapOpen && <WorldMapModal sceneId={game.sceneId} sceneEventHints={sceneEventHints} mapEvents={visibleMapEvents} period={game.period} day={game.day} inspectionHints={inspectionHints} inspectionDays={game.sceneInspectionDays} onClose={() => setMapOpen(false)} onEnterScene={enterScene} onTriggerMapEvent={triggerMapEvent} onInspectScene={inspectScene} onEnterDungeon={(dungeon) => { setActiveModule({ kind: "battle", dungeon }); setMapOpen(false); }} onEnterAlchemy={() => { setActiveModule({ kind: "alchemy" }); setMapOpen(false); }} />}
      {systemPanel && <FusionSystemPanel panel={systemPanel} onClose={() => setSystemPanel(null)} />}
      {activeModule && <div className={`fusion-module-backdrop module-${activeModule.kind}`} role="presentation"><section className="fusion-module-window" role="dialog" aria-modal="true" aria-label={activeModule.kind === "battle" ? `${activeModule.dungeon.name}秘境战斗` : "玄火丹炉"}>
        <header><button type="button" onClick={() => setActiveModule(null)} aria-label="返回当前场景">‹</button><div><small>{activeModule.kind === "battle" ? "山河地图 · 秘境投影" : "云州山河 · 常驻生产场景"}</small><strong>{activeModule.kind === "battle" ? activeModule.dungeon.name : "玄火丹炉"}</strong></div><span><b>{game.period}</b><i />灵石 {unifiedState.shared.spiritStones.toLocaleString()}</span></header>
        <div className="fusion-module-frame"><iframe title={activeModule.kind === "battle" ? `${activeModule.dungeon.name}战斗窗口` : "玄火丹炉窗口"} src={activeModule.kind === "battle" ? `/battle?wave=${activeModule.dungeon.waveId}&embedded=1` : "/alchemy?embedded=1"} /></div>
        {activeModule.kind === "battle" && <div className="module-orientation-note"><i>↻</i><strong>请横置手机进入秘境</strong><span>地图与恋爱场景会在结算后继续</span></div>}
      </section></div>}
      {calendarOpen && <CalendarModal state={game} events={eventDefinitions} onClose={() => setCalendarOpen(false)} />}
      {activeActivity === "tavern-gambling" && <GamblingModal stones={game.spiritStones} stamina={game.stamina} portrait={characterMap.hua?.image ?? "/assets/characters/hua-zhaoying.webp"} onClose={() => setActiveActivity(null)} onSpend={spendSpiritStones} onSpendStamina={spendStamina} onPayout={gainSpiritStones} onBond={gainHuaBond} />}
      {activeActivity === "monthly-market" && <MarketModal stones={game.spiritStones} stamina={game.stamina} treasures={game.marketTreasures} onClose={() => setActiveActivity(null)} onSpend={spendSpiritStones} onSpendStamina={spendStamina} onTreasure={collectMarketTreasure} onBuyGift={buyMarketGift} />}
      {activeActivity === "daily-divination" && <FortuneModal dateKey={realDateKey} portrait={characterMap.liu?.image ?? "/assets/characters/liu-zhiyi.webp"} initialRecord={fortuneHistory[realDateKey]} onClose={()=>setActiveActivity(null)} onDraw={drawFortuneToday}/>}
      {cultivationOpen&&<CultivationModal stamina={game.stamina} experience={game.experience} onClose={()=>setCultivationOpen(false)} onComplete={completeCultivation}/>}
      {inspectionReveal&&<InspectionModal scene={inspectionReveal.scene} event={inspectionReveal.event} onClose={()=>setInspectionReveal(null)} onEnterEvent={enterInspectionEvent}/>}
      {drinkingOpen&&drinkingConfig&&<DrinkingModal character={character} config={drinkingConfig} stamina={game.stamina} initialWins={game.interactionCounts[drinkingCountKey]??0} sceneDifficulty={sceneMap[game.sceneId]?.minigameDifficulty?.drinking??4} proficiencyExperience={game.proficiencyExperience.drinking??0} specialCompleted={Boolean(drinkingConfig.specialEventId&&game.completedEvents.includes(drinkingConfig.specialEventId))} onClose={()=>setDrinkingOpen(false)} onSpendStamina={spendStamina} onPractice={practiceDrinking} onWin={recordDrinkingWin} onSpecial={triggerDrinkingSpecial}/>}
      {shopOpen&&characterMap.ning&&<ShopModal gifts={gifts} events={eventDefinitions} relationship={game.relationships.ning??4} initialDepartment={character.id === "huo" ? "weapons" : "treasure"} onClose={()=>setShopOpen(false)} onNotice={setNotice}/>}

      {activeExploration?.exploration&&<div className="exploration-backdrop"><section className={`exploration-card ${activeExploration.cardStyle}`} role="dialog" aria-modal="true" aria-label={activeExploration.title}><button type="button" className="exploration-close" onClick={()=>setActiveExploration(null)}>×</button><div className="exploration-image"><img src={activeExploration.exploration.image} alt=""/><span>{activeExploration.cardStyle==="easter_egg"?"偶得":"异光"}</span></div><div className="exploration-content"><p>{activeExploration.cardStyle==="easter_egg"?"HIDDEN TREASURE · 彩蛋发现":"STORY TRACE · 剧情触发"}</p><h3>{activeExploration.title}</h3><blockquote>{activeExploration.exploration.text}</blockquote>{activeExploration.cardStyle==="easter_egg"&&activeExploration.exploration.rewardItem&&<small>发现物品 · {activeExploration.exploration.rewardItem.name}</small>}<button type="button" className="exploration-resolve" onClick={resolveExploration}>{activeExploration.cardStyle==="easter_egg"?`收入藏珍录 · ${activeExploration.exploration.rewardItem?.name??"彩蛋"}`:"循光而入 · 进入剧情"}</button></div></section></div>}
      {eggRewardNotice&&<div className="egg-obtained"><img src={eggRewardNotice.image} alt=""/><span><small>EASTER EGG OBTAINED</small><strong>获得彩蛋物品 · {eggRewardNotice.name}</strong></span></div>}

      {collectionOpen&&<div className="modal-backdrop collection-backdrop" onMouseDown={()=>setCollectionOpen(false)}><section className="collection-sheet" role="dialog" aria-modal="true" aria-label="藏珍录" onMouseDown={(event)=>event.stopPropagation()}><div className="sheet-heading"><div><p>HIDDEN TREASURES · {game.collectedEasterEggs.length}/{easterEggEvents.length}</p><h3>藏珍录</h3></div><button type="button" onClick={()=>setCollectionOpen(false)}>×</button></div><p className="collection-intro">散落于各处的微小旧物。每一件都记着一段旁人未曾留意的故事。</p><div className="collection-grid">{collectedEggItems.map(({event,item})=><article key={item.id}><img src={item.image} alt=""/><div><small>{event.chapter}</small><h4>{item.name}</h4><p>{item.description}</p><i>发现于 · {sceneMap[event.sceneId]?.name??event.sceneId}</i></div></article>)}{!collectedEggItems.length&&<div className="em-empty">尚未发现彩蛋。留意场景中如呼吸般明灭的金色微光。</div>}</div></section></div>}

      {activeAudioEvent&&activeAudioSegment&&<div className="audio-story-overlay" role="dialog" aria-label={activeAudioEvent.title} onClick={advanceAudioStory}><div className="audio-story-heading"><span>{replayEvent?"展馆 · 回忆模式":"音画事件"}</span><strong>{activeAudioEvent.title}</strong><i>{audioIndex+1} / {activeAudioEvent.audioSegments?.length}</i></div><div className="audio-story-art"><img className="audio-story-picture" src={activeAudioSegment.image} alt=""/><img className="audio-story-frame" src={activeAudioFrame.src} alt=""/></div><p>{activeAudioSegment.subtitle}</p><audio key={`${activeAudioEvent.id}-${audioIndex}`} src={activeAudioSegment.audio} autoPlay controls onClick={event=>event.stopPropagation()}/><small>点击画面进入下一段</small></div>}
      {unlockNotice&&<div className="audio-unlock-banner"><span>✦</span><p>{unlockNotice}</p><small>已收入展馆，可随时回放</small></div>}

      {keyAnnouncementQueue[0]&&<div className="global-announcement-backdrop"><section className="global-announcement" role="dialog" aria-modal="true" aria-label="游戏公告"><div className="announcement-seal">告</div><p>WORLD NOTICE · 游戏公告</p><h3>{keyAnnouncementQueue[0].announcement?.title||keyAnnouncementQueue[0].name}</h3><div className="announcement-rule"><i/><span>◆</span><i/></div><div className="announcement-message">{keyAnnouncementQueue[0].announcement?.message||keyAnnouncementQueue[0].description}</div><small>{keyAnnouncementQueue[0].category} · {keyAnnouncementQueue[0].name}</small><button type="button" onClick={()=>setKeyAnnouncementQueue((queue)=>queue.slice(1))}>知晓</button></section></div>}

      {preferenceNotice&&<div className="preference-discovery"><span>✦</span>{preferenceNotice}</div>}
      {stageNotice&&<div className="stage-notice-backdrop"><section className="stage-notice" role="dialog" aria-modal="true"><img src={characterMap[stageNotice.characterId]?.image} alt=""/><div><p>RELATIONSHIP ADVANCED · 关系进展</p><h3>{characterMap[stageNotice.characterId]?.name} · {stageNotice.stage.name}</h3><blockquote>{stageNotice.stage.description}</blockquote><span>从今往后，她会唤你「{stageNotice.stage.addressing}」</span><button type="button" onClick={()=>setStageNotice(null)}>记下此刻</button></div></section></div>}

      {activeMessage&&<div className="message-backdrop"><section className="character-message" role="dialog" aria-modal="true" aria-label={activeMessage.title}><img src={characterMap[activeMessage.senderCharacterId]?.image} alt=""/><div><p>CHARACTER LETTER · {characterMap[activeMessage.senderCharacterId]?.name}</p><h3>{activeMessage.title}</h3><blockquote>{activeMessage.body}</blockquote><span>—— {activeMessage.signature}</span>{!replayMessage&&(activeMessage.giftId||activeMessage.relationshipAmount)&&<small>{activeMessage.giftId?`随信附赠：${giftMap[activeMessage.giftId]?.name} × ${activeMessage.giftAmount??1}`:""}{activeMessage.giftId&&activeMessage.relationshipAmount?" · ":""}{activeMessage.relationshipAmount?`缘分 +${activeMessage.relationshipAmount}`:""}</small>}<button type="button" onClick={closeMessage}>{replayMessage?"收起旧笺":"收下传音"}</button></div></section></div>}

      {messageInboxOpen&&!activeMessage&&<div className="modal-backdrop message-inbox-backdrop" onMouseDown={()=>setMessageInboxOpen(false)}><section className="message-inbox" role="dialog" aria-modal="true" onMouseDown={(event)=>event.stopPropagation()}><div className="sheet-heading"><div><p>LETTERS & WHISPERS</p><h3>传音匣</h3></div><button type="button" onClick={()=>setMessageInboxOpen(false)}>×</button></div><div className="message-list">{messageDefinitions.filter((message)=>game.receivedMessages.includes(message.id)).map((message)=><button type="button" key={message.id} onClick={()=>{setMessageInboxOpen(false);setReplayMessage(message)}}><img src={characterMap[message.senderCharacterId]?.image} alt=""/><span><small>{characterMap[message.senderCharacterId]?.name}</small><strong>{message.title}</strong><p>{message.body}</p></span><i>重读</i></button>)}{!game.receivedMessages.length&&<div className="em-empty">传音匣尚空。随着关系与时间推进，她们会主动写信给你。</div>}</div></section></div>}

      {galleryOpen&&!replayEvent&&<div className="modal-backdrop gallery-backdrop" role="presentation" onMouseDown={()=>setGalleryOpen(false)}><section className="memory-gallery" role="dialog" aria-label="音画展馆" onMouseDown={event=>event.stopPropagation()}><div className="sheet-heading"><div><p>COLLECTED MEMORIES</p><h3>云上展馆</h3></div><button type="button" onClick={()=>setGalleryOpen(false)}>×</button></div><p className="gallery-intro">已解锁的音画事件会成为回忆卡片。点击卡片进入回忆模式，从第一段重新播放。</p><div className="gallery-card-grid">{audioEvents.map((event,index)=>{const unlocked=game.completedEvents.includes(event.id);const cover=event.audioSegments?.[0]?.image;return <button type="button" key={event.id} className={unlocked?"unlocked":"locked"} disabled={!unlocked} onClick={()=>{setGalleryOpen(false);setReplayEvent(event);setAudioIndex(0)}}><span className="gallery-card-art" style={{backgroundImage:cover?`url(${cover})`:undefined}}><img src={getAudioFrame(event.audioFrameId).src} alt=""/></span><small>{String(index+1).padStart(2,"0")} · {event.chapter}</small><strong>{unlocked?(event.unlockTitle||event.title):"未解锁回忆"}</strong><i>{unlocked?`${event.audioSegments?.length??0} 段音画 · 点击回放`:event.clue}</i></button>})}{!audioEvents.length&&<div className="em-empty">尚未发布音画事件。可在 EM 中创建第一张音画事件卡。</div>}</div></section></div>}

      {giftOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setGiftOpen(false)}>
          <section className="gift-sheet" role="dialog" aria-modal="true" aria-label="选择礼物" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sheet-heading"><div><p>INVENTORY · 行囊</p><h3>{hasPresentCharacter?`挑一份心意赠予${character.name}`:"查看随身物品"}</h3></div><button type="button" onClick={() => setGiftOpen(false)} aria-label="关闭">×</button></div>
            <div className="gift-grid">
              {gifts.map((gift) => {
                const count = game.inventory[gift.id];
                return (
                  <article key={gift.id} className={count<=0?"depleted":""}>
                    <span className="gift-icon gift-art" style={{ backgroundImage: `url(${gift.image})`, backgroundPosition: gift.imagePosition ?? "center", backgroundSize: gift.image.includes("gift-atlas") ? "500% 100%" : gift.image.includes("ning-shop-goods") ? "300% 200%" : "cover" }}>{gift.icon}</span>
                    <span className="gift-copy"><strong>{gift.name}</strong><small>{gift.description}</small><i>{(game.discoveredGiftPreferences[character.id]??[]).includes(gift.id)?`已发现 · ${PREFERENCE_LABELS[character.giftPreferences?.find((item)=>item.giftId===gift.id)?.tier??(character.lovedGift===gift.id?"loved":"neutral")]}`:"偏好未明"} · {gift.tags.join(" · ")}</i></span>
                    <b>× {count}</b>
                    <span className="gift-item-actions">{hasPresentCharacter&&<button type="button" disabled={count<=0} onClick={()=>giveGift(gift.id)}>赠予</button>}{gift.energyRestore&&<button type="button" className="eat-action" disabled={count<=0} onClick={()=>eatGift(gift.id)}>食用 +{gift.energyRestore}</button>}</span>
                  </article>
                );
              })}
            </div>
            <p className="gift-tip">提示：人物偏爱的礼物会触发专属事件，并留下更深的缘分。</p>
          </section>
        </div>
      )}

      {panel && (
        <div className="modal-backdrop panel-backdrop" role="presentation" onMouseDown={() => setPanel(null)}>
          <section className="side-sheet" role="dialog" aria-modal="true" aria-label={panel === "events" ? "事件簿" : "人物谱"} onMouseDown={(event) => event.stopPropagation()}>
            <div className="sheet-heading"><div><p>{panel === "events" ? `${totalEvents}章 · 数据驱动剧情` : `${characters.length}人 · 缘分录`}</p><h3>{panel === "events" ? "事件簿" : "人物谱"}</h3></div><button type="button" onClick={() => setPanel(null)} aria-label="关闭">×</button></div>
            {panel === "characters" ? (
              <div className="character-ledger">
                {characters.map((item) => (
                  <button type="button" key={item.id} onClick={() => { setPanel(null); if (item.sceneId !== game.sceneId) enterScene(item.sceneId); window.setTimeout(() => selectCharacter(item.id), 50); }}>
                    <img src={item.image} alt="" /><span><small>{item.role}</small><strong>{item.name}</strong><p>{item.bio}</p><i>缘分 {game.relationships[item.id] ?? 4} · {relationshipStage(item,game.relationships[item.id]??4).name}</i><em className="known-preferences">{(game.discoveredGiftPreferences[item.id]??[]).length?(game.discoveredGiftPreferences[item.id]??[]).map((giftId)=>{const preference=item.giftPreferences?.find((entry)=>entry.giftId===giftId);return `${giftMap[giftId]?.name??giftId} · ${PREFERENCE_LABELS[preference?.tier??(item.lovedGift===giftId?"loved":"neutral")]}`}).join(" ｜ "):"礼物偏好尚未发现"}</em></span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="event-ledger">
                {eventDefinitions.map((event, index) => {
                  const completed = game.completedEvents.includes(event.id);
                  return (
                    <article key={event.id} className={completed ? "completed" : "locked"}>
                      <span className="event-number">{String(index + 1).padStart(2, "0")}</span>
                      <div><small>{event.chapter} · {event.type}</small><h4>{completed ? event.title : "未解之章"}</h4><p>{completed ? event.subtitle : event.clue}</p></div>
                      <b>{completed ? "已阅" : "待续"}</b>
                    </article>
                  );
                })}
              </div>
            )}
            <div className="reset-actions"><button type="button" className="reset-button" onClick={recoverGifts}>恢复礼物</button><button type="button" className="reset-button danger-reset" onClick={resetDemo}>初始化</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
