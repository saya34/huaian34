"use client";

import { useEffect, useMemo, useState } from "react";
import { CHARACTERS, CHARACTER_MAP, EVENTS, GIFTS, GLOBAL_KEYS, SCENES } from "../game/content";
import type { CalendarDoodle, CharacterDefinition, CharacterId, CharacterMessageDefinition, Condition, DialogueProfileDefinition, Effect, EventCardStyle, EventDefinition, EventNode, GiftDefinition, GiftId, GlobalKeyDefinition, SceneDefinition, SceneId, TriggerType } from "../game/types";
import { parentEventId, validateEventDefinition } from "./event-validation";
import ContentManager, { AssetField, type ManagedContentRecord } from "./ContentManager";
import GiftManager from "./GiftManager";
import DialogueManager from "./DialogueManager";
import { WorldKeyManager } from "./GlobalKeyManager";
import AudioEventEditor from "./AudioEventEditor";
import MessageManager from "./MessageManager";
import ExplorationEventEditor from "./ExplorationEventEditor";

type EventStatus = "draft" | "published";
type ManagedRecord = { id: string; status: EventStatus; sourceMode: "form" | "json"; createdAt: number; updatedAt: number; definition: EventDefinition };
type DisplayEvent = { definition: EventDefinition; origin: "builtin" | "managed"; status: "builtin" | EventStatus; sourceMode: "code" | "form" | "json" };
type ViewMode = "tree" | "list";

const TRIGGER_LABELS: Record<TriggerType, string> = { scene_enter: "进入场景", talk: "与人物交谈", gift: "赠送礼物", time_change: "时辰变化", map_event: "地图限时事件", calendar_event: "固定日期事件", inspection: "夜间检视", interaction:"互动完成" };
const CONDITION_LABELS: Record<Condition["type"], string> = { scene: "所在场景", character: "当前人物", gift: "指定礼物", period: "当前时段", relationship: "缘分不少于", event_completed: "已完成事件", flag: "剧情标记", player_level:"人物等级", teacher_skill:"老师树节点", learned_skill:"已学随机技能", card_owned:"拥有人物卡", item_rarity:"物品最低品质", dungeon_complete:"已镇压秘境", alchemy_result:"炼丹结果" };
const CARD_STYLE_LABELS:Record<EventCardStyle,string>={normal:"普通",special:"特殊",audio:"音画",easter_egg:"彩蛋",trigger_point:"触发点"};

function makeDefaultEvent(characterId: CharacterId = "shen", characterMap: Record<string, CharacterDefinition> = CHARACTER_MAP, scenes: SceneDefinition[] = SCENES): EventDefinition {
  const character = characterMap[characterId] ?? CHARACTERS[0];
  const sceneId = character.sceneId;
  return {
    id: `${characterId}.custom.new-event`, title: "未命名事件", subtitle: "填写一句吸引人的事件摘要", chapter: `${character.name} · 新章`, type: "心事",
    trigger: "talk", priority: 60, weight: 1, once: true, journal: true, cardStyle: "normal", openingEffect: "none", sceneId, characterId,
    conditions: [{ type: "scene", value: sceneId }, { type: "character", value: characterId }],
    clue: `在${scenes.find((item) => item.id === sceneId)?.name ?? "指定场景"}与${character.name}交谈`, start: "a",
    nodes: {
      a: { id: "a", type: "line", speaker: "narrator", text: "在这里填写事件开场。", next: "b" },
      b: { id: "b", type: "line", speaker: characterId, text: "在这里填写人物对白。", mood: "平静", next: "end" },
      end: { id: "end", type: "end", summary: "事件已经结束。" },
    },
  };
}

function conditionTemplate(type: Condition["type"], event: EventDefinition): Condition {
  if (type === "scene") return { type, value: event.sceneId };
  if (type === "character") return { type, value: event.characterId };
  if (type === "gift") return { type, value: "osmanthusCake" };
  if (type === "period") return { type, value: "夜晚" };
  if (type === "relationship") return { type, characterId: event.characterId, min: 10 };
  if (type === "event_completed") return { type, eventId: "" };
  if (type === "player_level") return { type, min: 1 };
  if (type === "teacher_skill") return { type, skillId: "battle-might", minRank: 1 };
  if (type === "learned_skill") return { type, skillId: 1201 };
  if (type === "card_owned") return { type, cardId: "" };
  if (type === "item_rarity") return { type, minRarity: 3 };
  if (type === "dungeon_complete") return { type, waveId: 1 };
  if (type === "alchemy_result") return { type, itemId: "" };
  return { type: "flag", key: "story_flag", value: true };
}

function bondEffect(effects: Effect[] | undefined, characterId: CharacterId) {
  return effects?.find((item): item is Extract<Effect, { type: "relationship" }> => item.type === "relationship" && item.characterId === characterId)?.amount ?? 0;
}

function withBondEffect(effects: Effect[] | undefined, characterId: CharacterId, amount: number) {
  const rest = (effects ?? []).filter((item) => item.type !== "relationship" || item.characterId !== characterId);
  return amount ? [...rest, { type: "relationship", characterId, amount } as Effect] : rest;
}

function nodeFlagEffect(effects: Effect[] | undefined) { return effects?.find((item): item is Extract<Effect,{type:"set_flag"}>=>item.type==="set_flag"); }
function withNodeFlag(effects: Effect[] | undefined, key: string, value = true) { const rest=(effects??[]).filter(item=>item.type!=="set_flag"); return key?[...rest,{type:"set_flag",key,value} as Effect]:rest; }
function ChoiceMemoryEditor({node,keys,onChange}:{node:Extract<EventNode,{type:"choice"}>;keys:GlobalKeyDefinition[];onChange:(node:Extract<EventNode,{type:"choice"}>)=>void}){return <section className="choice-memory-editor"><header><strong>选择记忆回写</strong><small>建议选择“人物记忆”分类的全局 Key；后续事件可用该 Key 回调玩家选择。</small></header>{node.options.map((option,index)=>{const flag=nodeFlagEffect(option.effects);return <label key={option.id}><span>{option.label}</span><select value={flag?.key??""} onChange={(event)=>onChange({...node,options:node.options.map((item,i)=>i===index?{...item,effects:withNodeFlag(item.effects,event.target.value,flag?.value??true)}:item)})}><option value="">不记录</option>{keys.map((key)=><option key={key.id} value={key.id}>{key.category} · {key.name}</option>)}</select>{flag&&<select value={String(flag.value)} onChange={(event)=>onChange({...node,options:node.options.map((item,i)=>i===index?{...item,effects:withNodeFlag(item.effects,flag.key,event.target.value==="true")}:item)})}><option value="true">记为是</option><option value="false">记为否</option></select>}</label>})}</section>}

function TreeBranch({ item, childrenMap, onOpen, visited = new Set<string>() }: { item: DisplayEvent; childrenMap: Map<string, DisplayEvent[]>; onOpen: (item: DisplayEvent) => void; visited?: Set<string> }) {
  if (visited.has(item.definition.id)) return null;
  const nextVisited = new Set(visited).add(item.definition.id);
  const children = childrenMap.get(item.definition.id) ?? [];
  return (
    <div className="em-tree-branch">
      <button type="button" className={`em-tree-card ${item.status}`} onClick={() => onOpen(item)}>
        <span className="em-card-top"><i>{`${CARD_STYLE_LABELS[item.definition.cardStyle??"normal"]} · ${item.definition.type}`}</i><b>{item.status === "builtin" ? "内置" : item.status === "published" ? "已发布" : "草稿"}</b></span>
        <strong>{item.definition.title}</strong>
        <small>{TRIGGER_LABELS[item.definition.trigger]} · 优先级 {item.definition.priority}</small>
        <p>{item.definition.clue}</p>
      </button>
      {children.length > 0 && <div className="em-tree-children">{children.map((child) => <TreeBranch key={child.definition.id} item={child} childrenMap={childrenMap} onOpen={onOpen} visited={nextVisited} />)}</div>}
    </div>
  );
}

export default function EventManager() {
  const [section, setSection] = useState<"events" | "characters" | "scenes" | "gifts" | "dialogues" | "messages" | "globalKeys">("events");
  const [records, setRecords] = useState<ManagedRecord[]>([]);
  const [characterRecords, setCharacterRecords] = useState<ManagedContentRecord<CharacterDefinition>[]>([]);
  const [sceneRecords, setSceneRecords] = useState<ManagedContentRecord<SceneDefinition>[]>([]);
  const [giftRecords, setGiftRecords] = useState<ManagedContentRecord<GiftDefinition>[]>([]);
  const [dialogueRecords, setDialogueRecords] = useState<ManagedContentRecord<DialogueProfileDefinition>[]>([]);
  const [globalKeyRecords, setGlobalKeyRecords] = useState<ManagedContentRecord<GlobalKeyDefinition>[]>([]);
  const [messageRecords, setMessageRecords] = useState<ManagedContentRecord<CharacterMessageDefinition>[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("tree");
  const [characterId, setCharacterId] = useState<CharacterId>("shen");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"form" | "json">("form");
  const [draft, setDraft] = useState<EventDefinition>(() => makeDefaultEvent());
  const [draftStatus, setDraftStatus] = useState<EventStatus>("draft");
  const [jsonText, setJsonText] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("[]");
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("事件库连接中");
  const [saving, setSaving] = useState(false);

  async function loadEvents() {
    setLoading(true);
    try {
      const response = await fetch("/api/em/events", { cache: "no-store" });
      const data = await response.json() as { events?: ManagedRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "读取失败");
      setRecords(data.events ?? []);
      setNotice(`事件库已同步 · ${(data.events ?? []).length} 个自定义事件`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "事件库读取失败");
    } finally { setLoading(false); }
  }

  async function loadContent() {
    try {
      const response = await fetch("/api/em/content", { cache: "no-store" });
      const data = await response.json() as { characters?: ManagedContentRecord<CharacterDefinition>[]; scenes?: ManagedContentRecord<SceneDefinition>[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "内容库读取失败");
      setCharacterRecords(data.characters ?? []); setSceneRecords(data.scenes ?? []);
    } catch (error) { setNotice(error instanceof Error ? error.message : "内容库读取失败"); }
  }

  async function loadGifts() {
    try { const response = await fetch("/api/em/gifts", { cache: "no-store" }); const data = await response.json() as { gifts?: ManagedContentRecord<GiftDefinition>[]; error?: string }; if (!response.ok) throw new Error(data.error ?? "礼物库读取失败"); setGiftRecords(data.gifts ?? []); }
    catch (error) { setNotice(error instanceof Error ? error.message : "礼物库读取失败"); }
  }

  async function loadDialogues() {
    try { const response = await fetch("/api/em/dialogues", { cache: "no-store" }); const data = await response.json() as { dialogues?: ManagedContentRecord<DialogueProfileDefinition>[]; error?: string }; if (!response.ok) throw new Error(data.error ?? "对话库读取失败"); setDialogueRecords(data.dialogues ?? []); }
    catch (error) { setNotice(error instanceof Error ? error.message : "对话库读取失败"); }
  }

  async function loadGlobalKeys() {
    try { const response = await fetch("/api/em/global-keys", { cache: "no-store" }); const data = await response.json() as { keys?: ManagedContentRecord<GlobalKeyDefinition>[]; error?: string }; if (!response.ok) throw new Error(data.error ?? "全局 Key 读取失败"); setGlobalKeyRecords(data.keys ?? []); }
    catch (error) { setNotice(error instanceof Error ? error.message : "全局 Key 读取失败"); }
  }
  async function loadMessages(){try{const response=await fetch("/api/em/messages",{cache:"no-store"});const data=await response.json() as {messages?:ManagedContentRecord<CharacterMessageDefinition>[];error?:string};if(!response.ok)throw new Error(data.error??"传音读取失败");setMessageRecords(data.messages??[])}catch(error){setNotice(error instanceof Error?error.message:"传音读取失败")}}

  useEffect(() => { void loadEvents(); void loadContent(); void loadGifts(); void loadDialogues(); void loadGlobalKeys(); void loadMessages(); }, []);

  const allScenes = useMemo(() => {
    const ids = new Set(sceneRecords.map((item) => item.id));
    return [...SCENES.filter((item) => !ids.has(item.id)), ...sceneRecords.map((item) => item.definition)];
  }, [sceneRecords]);
  const allCharacters = useMemo(() => {
    const ids = new Set(characterRecords.map((item) => item.id));
    return [...CHARACTERS.filter((item) => !ids.has(item.id)), ...characterRecords.map((item) => item.definition)];
  }, [characterRecords]);
  const characterMap = useMemo(() => Object.fromEntries(allCharacters.map((item) => [item.id, item])) as Record<string, CharacterDefinition>, [allCharacters]);
  const allGifts = useMemo(() => { const ids = new Set(giftRecords.map((item) => item.id)); return [...GIFTS.filter((item) => !ids.has(item.id)), ...giftRecords.map((item) => item.definition)]; }, [giftRecords]);
  const allGlobalKeys = useMemo(() => { const ids=new Set(globalKeyRecords.map(item=>item.id)); return [...GLOBAL_KEYS.filter(item=>!ids.has(item.id)),...globalKeyRecords.map(item=>item.definition)]; }, [globalKeyRecords]);

  function changeCardStyle(cardStyle:EventCardStyle){
    const characterImage=characterMap[draft.characterId]?.image??"/assets/characters/shen-qingshuang.webp";
    const isExploration=cardStyle==="easter_egg"||cardStyle==="trigger_point";
    const hasStory=Object.keys(draft.nodes).some((id)=>id!=="end");
    const storyNodes=hasStory?draft.nodes:{a:{id:"a",type:"line",speaker:"narrator",text:"微光被触碰后，一段故事在眼前展开。",next:"b"},b:{id:"b",type:"line",speaker:draft.characterId,text:"你终于发现这里了。",mood:"意外",next:"end"},end:{id:"end",type:"end",summary:"这段隐秘的相遇被收入事件簿。"}} as EventDefinition["nodes"];
    const exploration:NonNullable<EventDefinition["exploration"]>=draft.exploration??{chance:60,positionMode:"random",image:characterImage,text:"微光之下似乎藏着一段不为人知的旧事。"};
    const withReward=cardStyle==="easter_egg"?{...exploration,rewardItem:exploration.rewardItem??{id:`${draft.id}.item`,name:"无名旧物",image:"/assets/gifts/gift-atlas.webp",description:"一件偶然发现、值得留作纪念的小物。"}}:exploration;
    const incompatibleMap=draft.trigger==="map_event"&&!(["special","audio"] as EventCardStyle[]).includes(cardStyle);
    const incompatibleCalendar=draft.trigger==="calendar_event"&&isExploration;
    const trigger=incompatibleMap||incompatibleCalendar?"talk":isExploration?"scene_enter":draft.trigger;
    setDraft({...draft,cardStyle,trigger,conditions:isExploration?draft.conditions.filter((item)=>item.type!=="character"&&item.type!=="gift"):draft.conditions,openingEffect:cardStyle==="special"?(draft.openingEffect==="flash_black"?"flash_black":"flash_white"):"none",defaultPortrait:cardStyle==="special"?(draft.defaultPortrait||characterImage):draft.defaultPortrait,audioSegments:cardStyle==="audio"?(draft.audioSegments?.length?draft.audioSegments:[{id:"segment-1",image:characterImage,audio:"",subtitle:"风声掠过檐角，她的声音从旧日深处传来。"}]):draft.audioSegments,audioFrameId:cardStyle==="audio"?(draft.audioFrameId||"gold-phoenix"):draft.audioFrameId,unlockTitle:cardStyle==="audio"?(draft.unlockTitle||draft.title):draft.unlockTitle,exploration:isExploration?withReward:draft.exploration,start:cardStyle==="audio"||cardStyle==="easter_egg"?"end":hasStory?draft.start:"a",nodes:cardStyle==="audio"?{end:{id:"end",type:"end",summary:"音画事件已解锁。"}}:cardStyle==="easter_egg"?{end:{id:"end",type:"end",summary:"彩蛋物品已经收入藏珍录。"}}:storyNodes});
  }

  function changeTrigger(trigger: TriggerType) {
    if(trigger==="interaction"){
      setDraft({...draft,trigger,interactionId:draft.interactionId??"drinking",conditions:draft.conditions.filter((item)=>item.type!=="gift")});return;
    }
    if (trigger === "inspection") {
      setDraft({ ...draft, trigger, conditions:draft.conditions.filter((item)=>item.type!=="character"&&item.type!=="gift"), inspection:draft.inspection??{chance:50,hint:true} });
      return;
    }
    if (trigger === "calendar_event") {
      const cardStyle=draft.cardStyle==="easter_egg"||draft.cardStyle==="trigger_point"?"normal":draft.cardStyle;
      setDraft({ ...draft, trigger, cardStyle, conditions:draft.conditions.filter((item)=>item.type!=="gift"), calendarEvent:draft.calendarEvent?.mode==="fixed"?draft.calendarEvent:{mode:"fixed",month:1,day:1,doodle:"story"} });
      return;
    }
    if (trigger !== "map_event") { setDraft({ ...draft, trigger }); return; }
    const characterImage=characterMap[draft.characterId]?.image??"/assets/characters/shen-qingshuang.webp";
    const cardStyle=draft.cardStyle==="audio"?"audio":"special";
    setDraft({ ...draft, trigger, cardStyle, once:true, openingEffect:cardStyle==="special"?(draft.openingEffect??"flash_white"):draft.openingEffect, defaultPortrait:cardStyle==="special"?(draft.defaultPortrait||characterImage):draft.defaultPortrait, conditions:draft.conditions.filter((item)=>item.type!=="character"&&item.type!=="gift"), mapEvent:draft.mapEvent??{mapId:"yunzhou",windowDays:10,x:50,y:50} });
  }

  const allEvents = useMemo<DisplayEvent[]>(() => {
    const managedIds = new Set(records.map((item) => item.id));
    return [
      ...EVENTS.filter((item) => !managedIds.has(item.id)).map((definition) => ({ definition, origin: "builtin", status: "builtin", sourceMode: "code" } as DisplayEvent)),
      ...records.map((item) => ({ definition: item.definition, origin: "managed", status: item.status, sourceMode: item.sourceMode } as DisplayEvent)),
    ];
  }, [records]);

  const visibleEvents = useMemo(() => allEvents.filter((item) => item.definition.characterId === characterId && (!search.trim() || `${item.definition.title}${item.definition.id}${item.definition.clue}`.toLowerCase().includes(search.trim().toLowerCase()))), [allEvents, characterId, search]);
  const childrenMap = useMemo(() => {
    const map = new Map<string, DisplayEvent[]>();
    visibleEvents.forEach((item) => { const parent = parentEventId(item.definition); if (parent) map.set(parent, [...(map.get(parent) ?? []), item]); });
    map.forEach((items) => items.sort((a, b) => b.definition.priority - a.definition.priority));
    return map;
  }, [visibleEvents]);
  const visibleIds = new Set(visibleEvents.map((item) => item.definition.id));
  const roots = visibleEvents.filter((item) => { const parent = parentEventId(item.definition); return !parent || !visibleIds.has(parent); });
  const counts = { total: allEvents.length, managed: records.length, published: records.filter((item) => item.status === "published").length, draft: records.filter((item) => item.status === "draft").length };

  function openNew() {
    const next = makeDefaultEvent(characterId, characterMap, allScenes);
    setDraft(next); setDraftStatus("draft"); setEditorMode("form"); setJsonText(JSON.stringify(next, null, 2)); setErrors([]); setEditorOpen(true);
  }

  function openEvent(item: DisplayEvent) {
    const next = structuredClone(item.definition);
    if (item.origin === "builtin") { next.id = `${next.id}.variant`; next.title = `${next.title}·改编`; }
    setDraft(next); setDraftStatus(item.status === "published" ? "published" : "draft"); setEditorMode(item.sourceMode === "json" ? "json" : "form"); setJsonText(JSON.stringify(next, null, 2)); setErrors([]); setEditorOpen(true);
  }

  async function persist(definition: EventDefinition, status: EventStatus, sourceMode: "form" | "json") {
    const response = await fetch("/api/em/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ definition, status, sourceMode }) });
    const data = await response.json() as { error?: string; errors?: string[] };
    if (!response.ok) throw new Error(data.errors?.join("\n") || data.error || "保存失败");
  }

  async function saveEditor() {
    setSaving(true); setErrors([]);
    try {
      const value = editorMode === "json" ? JSON.parse(jsonText) : draft;
      const checked = validateEventDefinition(value);
      if (!checked.valid || !checked.event) { setErrors(checked.errors); return; }
      await persist(checked.event, draftStatus, editorMode);
      setEditorOpen(false); setNotice(`${checked.event.title} 已${draftStatus === "published" ? "发布" : "保存为草稿"}`); await loadEvents();
    } catch (error) { setErrors(String(error instanceof Error ? error.message : error).split("\n")); }
    finally { setSaving(false); }
  }

  async function importBulk() {
    setSaving(true); setErrors([]);
    try {
      const value = JSON.parse(bulkText) as unknown;
      const list = Array.isArray(value) ? value : [value];
      if (!list.length) throw new Error("没有可导入的事件");
      const checked = list.map(validateEventDefinition);
      const invalid = checked.flatMap((item, index) => item.errors.map((error) => `第 ${index + 1} 个事件：${error}`));
      if (invalid.length) { setErrors(invalid); return; }
      for (const item of checked) await persist(item.event!, "draft", "json");
      setBulkOpen(false); setNotice(`已导入 ${list.length} 个事件草稿`); await loadEvents();
    } catch (error) { setErrors([error instanceof Error ? error.message : "JSON 解析失败"]); }
    finally { setSaving(false); }
  }

  async function setRecordStatus(item: DisplayEvent, status: EventStatus) {
    if (item.origin !== "managed") return;
    setSaving(true);
    try { await persist(item.definition, status, item.sourceMode as "form" | "json"); setNotice(`${item.definition.title} 已${status === "published" ? "发布到前台" : "转为草稿"}`); await loadEvents(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "状态更新失败"); }
    finally { setSaving(false); }
  }

  async function removeRecord(item: DisplayEvent) {
    if (item.origin !== "managed" || !window.confirm(`确定删除“${item.definition.title}”吗？`)) return;
    await fetch(`/api/em/events?id=${encodeURIComponent(item.definition.id)}`, { method: "DELETE" });
    setNotice(`${item.definition.title} 已删除`); await loadEvents();
  }

  function exportEvents() {
    const blob = new Blob([JSON.stringify(records.map((item) => item.definition), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "yunshang-events.json"; link.click(); URL.revokeObjectURL(url);
  }

  function updateCondition(index: number, condition: Condition) { setDraft((current) => ({ ...current, conditions: current.conditions.map((item, i) => i === index ? condition : item) })); }
  function updateNode(id: string, node: EventNode) { setDraft((current) => ({ ...current, nodes: { ...current.nodes, [id]: node } })); }
  function updateLineBond(id: string, node: Extract<EventNode, { type: "line" }>, amount: number) { updateNode(id, { ...node, effects: withBondEffect(node.effects, draft.characterId, amount) }); }
  function updateOptionBond(id: string, node: Extract<EventNode, { type: "choice" }>, optionIndex: number, amount: number) {
    updateNode(id, { ...node, options: node.options.map((option, index) => index === optionIndex ? { ...option, effects: withBondEffect(option.effects, draft.characterId, amount) } : option) });
  }

  function addNode(type: "line" | "choice") {
    setDraft((current) => {
      let number = Object.keys(current.nodes).length;
      let id = `n${number}`; while (current.nodes[id]) id = `n${++number}`;
      const entries = Object.entries(current.nodes); const withoutEnd = entries.filter(([key]) => key !== "end"); const end = entries.find(([key]) => key === "end");
      const last = withoutEnd.at(-1);
      if (last?.[1].type === "line" && last[1].next === "end") last[1] = { ...last[1], next: id };
      const node: EventNode = type === "line"
        ? { id, type: "line", speaker: current.characterId, text: "填写新的对白。", next: "end" }
        : { id, type: "choice", prompt: "你准备如何回应？", options: [{ id: "option_1", label: "填写选项", next: "end" }] };
      return { ...current, nodes: Object.fromEntries([...withoutEnd, [id, node], ...(end ? [end] : [])]) };
    });
  }

  function removeNode(id: string) {
    if (id === draft.start || id === "end") return;
    setDraft((current) => {
      const nodes = Object.fromEntries(Object.entries(current.nodes).filter(([key]) => key !== id));
      Object.entries(nodes).forEach(([key, node]) => {
        if (node.type === "line" && node.next === id) nodes[key] = { ...node, next: "end" };
        if (node.type === "choice") nodes[key] = { ...node, options: node.options.map((option) => option.next === id ? { ...option, next: "end" } : option) };
      });
      return { ...current, nodes };
    });
  }

  const nodeIds = Object.keys(draft.nodes);
  const priorEventOptions = allEvents.filter((item) => item.definition.characterId === draft.characterId && item.definition.id !== draft.id);

  return (
    <main className="em-shell">
      <aside className="em-sidebar">
        <a className="em-brand" href="/"><span>见</span><div><small>云上见卿</small><strong>Event Manager</strong></div></a>
        <nav><button className={section === "events" ? "active" : ""} onClick={() => setSection("events")}><span>树</span>事件管理</button><button className={section === "dialogues" ? "active" : ""} onClick={() => setSection("dialogues")}><span>言</span>对话管理</button><button className={section === "messages" ? "active" : ""} onClick={() => setSection("messages")}><span>笺</span>传音书信</button><button className={section === "globalKeys" ? "active" : ""} onClick={() => setSection("globalKeys")}><span>钥</span>全局 Key</button><button className={section === "characters" ? "active" : ""} onClick={() => setSection("characters")}><span>人</span>人物管理</button><button className={section === "scenes" ? "active" : ""} onClick={() => setSection("scenes")}><span>景</span>场景管理</button><button className={section === "gifts" ? "active" : ""} onClick={() => setSection("gifts")}><span>礼</span>礼物管理</button><a href="/"><span>游</span>前台演示</a></nav>
        <div className="em-sidebar-note"><small>内容联动</small><p>已发布的事件、对话、人物、场景与礼物会直接进入游戏；草稿只在管理台中保存。</p></div>
      </aside>

      <section className="em-workspace">
        <header className="em-header">
          <div><p>剧情内容中台</p><h1>{section === "events" ? "事件管理台" : section === "characters" ? "人物管理器" : section === "scenes" ? "场景管理器" : section === "gifts" ? "礼物管理器" : section === "dialogues" ? "对话管理器" : section === "messages" ? "传音书信管理" : "全局 Key 管理"} <span>EM</span></h1></div>
          {section === "events" && <div className="em-header-actions"><button className="quiet" onClick={() => { setErrors([]); setBulkOpen(true); }}>导入结构体</button><button className="quiet" onClick={exportEvents} disabled={!records.length}>导出 JSON</button><button className="primary" onClick={openNew}>＋ 新建事件</button></div>}
        </header>

        {section === "events" && <>
        <section className="em-stats">
          <article><span>全部事件</span><strong>{counts.total}</strong><small>含 {EVENTS.length} 个内置事件</small></article>
          <article><span>自定义事件</span><strong>{counts.managed}</strong><small>由 EM 统一维护</small></article>
          <article><span>已发布</span><strong>{counts.published}</strong><small>正在前台生效</small></article>
          <article><span>待完善草稿</span><strong>{counts.draft}</strong><small>不会进入游戏</small></article>
        </section>

        <section className="em-content-card">
          <div className="em-toolbar">
            <div className="em-character-tabs">{allCharacters.map((item) => <button key={item.id} className={characterId === item.id ? "active" : ""} onClick={() => setCharacterId(item.id)}><img src={item.image} alt="" /><span>{item.name}<small>{allEvents.filter((event) => event.definition.characterId === item.id).length} 个事件</small></span></button>)}</div>
            <div className="em-tools"><label><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索标题、ID 或线索" /></label><div className="em-view-toggle"><button className={view === "tree" ? "active" : ""} onClick={() => setView("tree")}>树状</button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>列表</button></div></div>
          </div>

          <div className="em-board-heading"><div><small>{characterMap[characterId]?.role ?? "未登记人物"}</small><h2>{characterMap[characterId]?.name ?? characterId} · 事件脉络</h2></div><p><i />前置事件会自动形成连线与分支</p></div>

          {loading ? <div className="em-empty">正在整理事件脉络……</div> : !visibleEvents.length ? <div className="em-empty">没有符合条件的事件</div> : view === "tree" ? (
            <div className="em-tree-canvas"><div className="em-tree-roots">{roots.map((item) => <TreeBranch key={item.definition.id} item={item} childrenMap={childrenMap} onOpen={openEvent} />)}</div></div>
          ) : (
            <div className="em-event-list">{visibleEvents.map((item) => <article key={item.definition.id}><div className={`em-list-mark ${item.status}`} /><div><small>{item.definition.id}</small><strong>{item.definition.title}</strong><p>{item.definition.clue}</p></div><span>{TRIGGER_LABELS[item.definition.trigger]}</span><b>{item.definition.priority}</b><div className="em-row-actions"><button onClick={() => openEvent(item)}>{item.origin === "builtin" ? "复制" : "编辑"}</button>{item.origin === "managed" && <><button onClick={() => setRecordStatus(item, item.status === "published" ? "draft" : "published")}>{item.status === "published" ? "下线" : "发布"}</button><button className="danger" onClick={() => removeRecord(item)}>删除</button></>}</div></article>)}</div>
          )}
        </section></>}
        {section === "characters" && <ContentManager kind="character" records={characterRecords} characters={allCharacters} scenes={allScenes} gifts={allGifts} events={allEvents.map((item)=>item.definition)} globalKeys={allGlobalKeys} onReload={loadContent} />}
        {section === "scenes" && <ContentManager kind="scene" records={sceneRecords} characters={allCharacters} scenes={allScenes} gifts={allGifts} events={allEvents.map((item)=>item.definition)} globalKeys={allGlobalKeys} onReload={loadContent} />}
        {section === "gifts" && <GiftManager records={giftRecords} onReload={loadGifts} />}
        {section === "dialogues" && <DialogueManager records={dialogueRecords} characters={allCharacters} onReload={loadDialogues} />}
        {section === "messages" && <MessageManager records={messageRecords} characters={allCharacters} events={allEvents.map((item)=>item.definition)} gifts={allGifts} globalKeys={allGlobalKeys} onReload={loadMessages} />}
        {section === "globalKeys" && <WorldKeyManager records={globalKeyRecords} characters={allCharacters} events={allEvents.map((item)=>item.definition)} scenes={allScenes} gifts={allGifts} onReload={loadGlobalKeys} />}
        <footer className="em-footer"><span className="status-dot" /><p>{notice}</p><span>数据驱动 · D1 持久化</span></footer>
      </section>

      {editorOpen && <div className="em-overlay" onMouseDown={() => setEditorOpen(false)}><section className="em-editor" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><p>{records.some((item) => item.id === draft.id) ? "编辑事件" : "创建事件卡"}</p><h2>{draft.title || "未命名事件"}</h2></div><button onClick={() => setEditorOpen(false)}>×</button></header>
        <div className="em-editor-tabs"><button className={editorMode === "form" ? "active" : ""} onClick={() => setEditorMode("form")}>表单录入</button><button className={editorMode === "json" ? "active" : ""} onClick={() => { setJsonText(JSON.stringify(draft, null, 2)); setEditorMode("json"); }}>结构体注入</button></div>
        {editorMode === "json" ? <div className="em-json-editor"><div><strong>EventDefinition</strong><span>支持直接粘贴完整事件结构体</span></div><textarea value={jsonText} onChange={(event) => setJsonText(event.target.value)} spellCheck={false} /></div> : <div className="em-form">
          <fieldset><legend><span>01</span>基本资料</legend><div className="em-form-grid">
            <label className="wide">事件 ID<small>唯一标识，发布后尽量不要修改</small><input value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} /></label>
            <label>事件标题<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <label>章节显示<input value={draft.chapter} onChange={(event) => setDraft({ ...draft, chapter: event.target.value })} /></label>
            <label className="wide">副标题<input value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} /></label>
            <label>所属人物<select value={draft.characterId} onChange={(event) => { const id = event.target.value as CharacterId; setDraft({ ...draft, characterId: id, sceneId: characterMap[id]?.sceneId ?? draft.sceneId }); }}>{allCharacters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>发生场景<select value={draft.sceneId} onChange={(event) => setDraft({ ...draft, sceneId: event.target.value as SceneId })}>{allScenes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>事件类型<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as EventDefinition["type"] })}>{["主线", "相识", "心事", "赠礼", "情缘", "闲谈"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="wide">解锁线索<input value={draft.clue} onChange={(event) => setDraft({ ...draft, clue: event.target.value })} /></label>
          </div></fieldset>

          <fieldset><legend><span>02</span>触发策略</legend><div className="em-form-grid compact">
            <label>事件卡演出<select value={draft.cardStyle ?? "normal"} onChange={(event) => changeCardStyle(event.target.value as EventCardStyle)}>{draft.trigger!=="map_event"&&<option value="normal">普通事件卡</option>}<option value="special">特殊事件卡</option><option value="audio">音画事件</option>{draft.trigger!=="map_event"&&draft.trigger!=="calendar_event"&&<><option value="easter_egg">彩蛋事件 · 获得物品</option><option value="trigger_point">触发事件 · 进入剧情</option></>}</select></label>
            <label>触发动作<select value={draft.trigger} onChange={(event) => changeTrigger(event.target.value as TriggerType)}>{Object.entries(TRIGGER_LABELS).filter(([value])=>!(draft.cardStyle==="easter_egg"||draft.cardStyle==="trigger_point")||value==="scene_enter"||value==="time_change").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>优先级<input type="number" min="0" max="999" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })} /></label>
            <label>随机权重<input type="number" min="1" value={draft.weight ?? 1} onChange={(event) => setDraft({ ...draft, weight: Number(event.target.value) })} /></label>
            <label>发布状态<select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as EventStatus)}><option value="draft">草稿</option><option value="published">立即发布</option></select></label>
            <label className="em-check"><input type="checkbox" checked={draft.once} onChange={(event) => setDraft({ ...draft, once: event.target.checked })} /><span>仅触发一次</span></label>
            <label className="em-check"><input type="checkbox" checked={draft.journal} onChange={(event) => setDraft({ ...draft, journal: event.target.checked })} /><span>收录事件簿</span></label>
          </div></fieldset>

          {draft.cardStyle === "special" && <fieldset className="em-special-config"><legend><span>特</span>特殊事件演出</legend><div className="em-special-grid"><AssetField label="默认特殊立绘" value={draft.defaultPortrait ?? ""} onChange={(defaultPortrait) => setDraft({ ...draft, defaultPortrait })} /><label>开场动效<select value={draft.openingEffect ?? "flash_white"} onChange={(event) => setDraft({ ...draft, openingEffect: event.target.value as "none" | "flash_white" | "flash_black" })}><option value="flash_white">闪白入场</option><option value="flash_black">闪黑入场</option><option value="none">柔和入场</option></select><small>特殊立绘将在舞台中央显示，每个剧情节点还可以单独覆盖。</small></label></div></fieldset>}
          {draft.cardStyle === "audio" && <AudioEventEditor value={draft} onChange={setDraft} />}
          {(draft.cardStyle === "easter_egg" || draft.cardStyle === "trigger_point") && <ExplorationEventEditor value={draft} onChange={setDraft} />}
          {draft.trigger === "map_event" && <fieldset className="em-map-event-config"><legend><span>图</span>地图限时事件</legend><div className="em-form-grid compact"><label>出现地图<select value={draft.mapEvent?.mapId??"yunzhou"} onChange={(event)=>setDraft({...draft,mapEvent:{...(draft.mapEvent??{windowDays:10,x:50,y:50}),mapId:event.target.value}})}><option value="yunzhou">云州山河</option><option value="canglan">沧澜水域</option><option value="chixia">赤霞荒域</option></select></label><label>随机窗口（天）<input type="number" min="1" max="90" value={draft.mapEvent?.windowDays??10} onChange={(event)=>setDraft({...draft,mapEvent:{...(draft.mapEvent??{mapId:"yunzhou",x:50,y:50}),windowDays:Number(event.target.value)}})}/><small>前置条件达成后，从未来这些天中随机选择一天。</small></label><label>地图横坐标 %<input type="number" min="5" max="95" value={draft.mapEvent?.x??50} onChange={(event)=>setDraft({...draft,mapEvent:{...(draft.mapEvent??{mapId:"yunzhou",windowDays:10,y:50}),x:Number(event.target.value)}})}/></label><label>地图纵坐标 %<input type="number" min="5" max="95" value={draft.mapEvent?.y??50} onChange={(event)=>setDraft({...draft,mapEvent:{...(draft.mapEvent??{mapId:"yunzhou",windowDays:10,x:50}),y:Number(event.target.value)}})}/></label></div><p className="em-field-note">事件从抽中的日期开始显示为金红光标；未点击、流程中断或推进日期都会继续驻留，直至剧情完整结束。</p></fieldset>}
          {draft.trigger === "calendar_event" && <fieldset className="em-calendar-event-config"><legend><span>历</span>固定日期事件</legend><div className="em-form-grid compact"><label>月份<select value={draft.calendarEvent?.month??1} onChange={(event)=>setDraft({...draft,calendarEvent:{mode:"fixed",month:Number(event.target.value),day:draft.calendarEvent?.day??1,doodle:draft.calendarEvent?.doodle??"story"}})}>{["正月","二月","三月","四月","五月","六月","七月","八月","九月","十月","冬月","腊月"].map((name,index)=><option key={name} value={index+1}>{name}</option>)}</select></label><label>日期<input type="number" min="1" max="30" value={draft.calendarEvent?.day??1} onChange={(event)=>setDraft({...draft,calendarEvent:{mode:"fixed",month:draft.calendarEvent?.month??1,day:Number(event.target.value),doodle:draft.calendarEvent?.doodle??"story"}})}/></label><label>日历涂鸦<select value={draft.calendarEvent?.doodle??"story"} onChange={(event)=>setDraft({...draft,calendarEvent:{mode:"fixed",month:draft.calendarEvent?.month??1,day:draft.calendarEvent?.day??1,doodle:event.target.value as CalendarDoodle}})}><option value="birthday">寿辰 · 手绘糕烛</option><option value="auction">拍卖 · 手绘木槌</option><option value="festival">佳节 · 手绘同心结</option><option value="meeting">相会 · 手绘缘印</option><option value="story">异闻 · 手绘卷轴</option></select></label><label className="em-check"><input type="checkbox" checked={!draft.once} onChange={(event)=>setDraft({...draft,once:!event.target.checked})}/><span>每年重复</span></label></div><p className="em-field-note">固定日期由 EM 管理；每周、间隔天数等周期规则暂由代码内置。日期到达且前置条件满足后，事件会自动触发。</p></fieldset>}
          {draft.trigger === "inspection" && <fieldset className="em-inspection-config"><legend><span>眼</span>夜间检视事件</legend><div className="em-form-grid compact"><label>检视触发概率 %<input type="number" min="0" max="100" value={draft.inspection?.chance??50} onChange={(event)=>setDraft({...draft,inspection:{chance:Number(event.target.value),hint:draft.inspection?.hint??true}})}/><small>玩家夜晚检视该场景时独立判定。</small></label><label className="em-check"><input type="checkbox" checked={draft.inspection?.hint??true} onChange={(event)=>setDraft({...draft,inspection:{chance:draft.inspection?.chance??50,hint:event.target.checked}})}/><span>在地图显示眼睛提示</span></label></div><p className="em-field-note">关闭提示可制作隐秘检视事件；玩家仍可主动检视没有眼睛图标的场景。每个场景每日只能检视一次。</p></fieldset>}
          {draft.trigger === "interaction" && <fieldset className="em-interaction-event-config"><legend><span>互</span>互动完成事件</legend><div className="em-form-grid compact"><label>互动 ID<input value={draft.interactionId??"drinking"} onChange={(event)=>setDraft({...draft,interactionId:event.target.value})}/><small>喝酒互动填写 drinking；需要与人物管理器中的互动类型对应。</small></label></div><p className="em-field-note">人物互动达到配置次数后触发。特殊事件卡可使用中央立绘与开场闪白/闪黑演出。</p></fieldset>}

          <fieldset><legend><span>03</span>发生条件 <button onClick={() => setDraft({ ...draft, conditions: [...draft.conditions, conditionTemplate("period", draft)] })}>＋ 添加条件</button></legend><div className="em-condition-list">
            {draft.conditions.map((condition, index) => <div className="em-condition-row" key={`${condition.type}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><select value={condition.type} onChange={(event) => { const type=event.target.value as Condition["type"]; updateCondition(index, type === "flag" && allGlobalKeys[0] ? { type:"flag", key:allGlobalKeys[0].id, value:true } : conditionTemplate(type, draft)); }}>{Object.entries(CONDITION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              {condition.type === "scene" && <select value={condition.value} onChange={(event) => updateCondition(index, { ...condition, value: event.target.value as SceneId })}>{allScenes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
              {condition.type === "character" && <select value={condition.value} onChange={(event) => updateCondition(index, { ...condition, value: event.target.value as CharacterId })}>{allCharacters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
              {condition.type === "gift" && <select value={condition.value} onChange={(event) => updateCondition(index, { ...condition, value: event.target.value as GiftId })}>{allGifts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
              {condition.type === "period" && <select value={condition.value} onChange={(event) => updateCondition(index, { ...condition, value: event.target.value as "清晨" | "黄昏" | "夜晚" })}>{["清晨", "黄昏", "夜晚"].map((item) => <option key={item}>{item}</option>)}</select>}
              {condition.type === "relationship" && <><select value={condition.characterId} onChange={(event) => updateCondition(index, { ...condition, characterId: event.target.value as CharacterId })}>{allCharacters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input type="number" min="0" max="100" value={condition.min} onChange={(event) => updateCondition(index, { ...condition, min: Number(event.target.value) })} /></>}
              {condition.type === "event_completed" && <select value={condition.eventId} onChange={(event) => updateCondition(index, { ...condition, eventId: event.target.value })}><option value="">选择前置事件</option>{priorEventOptions.map((item) => <option key={item.definition.id} value={item.definition.id}>{item.definition.title} · {item.definition.id}</option>)}</select>}
              {condition.type === "flag" && <><select value={condition.key} onChange={(event) => updateCondition(index, { ...condition, key: event.target.value })}>{allGlobalKeys.length ? allGlobalKeys.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>) : <option value={condition.key}>{condition.key || "请先创建全局 Key"}</option>}</select><select value={String(condition.value)} onChange={(event) => updateCondition(index, { ...condition, value: event.target.value === "true" })}><option value="true">已经发生</option><option value="false">尚未发生</option></select></>}
              {condition.type === "player_level" && <input type="number" min="1" max="60" value={condition.min} onChange={(event)=>updateCondition(index,{...condition,min:Number(event.target.value)})}/>} 
              {condition.type === "teacher_skill" && <><input value={condition.skillId} onChange={(event)=>updateCondition(index,{...condition,skillId:event.target.value})} placeholder="老师树节点ID"/><input type="number" min="1" value={condition.minRank} onChange={(event)=>updateCondition(index,{...condition,minRank:Number(event.target.value)})}/></>}
              {condition.type === "learned_skill" && <input type="number" value={condition.skillId} onChange={(event)=>updateCondition(index,{...condition,skillId:Number(event.target.value)})}/>} 
              {condition.type === "card_owned" && <input value={condition.cardId} onChange={(event)=>updateCondition(index,{...condition,cardId:event.target.value})} placeholder="人物卡ID"/>}
              {condition.type === "item_rarity" && <select value={condition.minRarity} onChange={(event)=>updateCondition(index,{...condition,minRarity:Number(event.target.value) as 1|2|3|4|5|6|7})}>{[1,2,3,4,5,6,7].map((value)=><option key={value} value={value}>{value}级品质</option>)}</select>}
              {condition.type === "dungeon_complete" && <input type="number" min="1" max="21" value={condition.waveId} onChange={(event)=>updateCondition(index,{...condition,waveId:Number(event.target.value)})}/>} 
              {condition.type === "alchemy_result" && <input value={condition.itemId} onChange={(event)=>updateCondition(index,{...condition,itemId:event.target.value})} placeholder="炼成物ID"/>}
              <button className="remove" onClick={() => setDraft({ ...draft, conditions: draft.conditions.filter((_, i) => i !== index) })}>×</button></div>)}
          </div></fieldset>

          {draft.cardStyle !== "audio" && draft.cardStyle !== "easter_egg" && <fieldset><legend><span>04</span>剧情节点 <div><button onClick={() => addNode("line")}>＋ 对话</button><button onClick={() => addNode("choice")}>＋ 选择</button></div></legend><div className="em-node-list">
            {Object.entries(draft.nodes).map(([id, node], index) => <article className={`em-node-card ${node.type}`} key={id}><div className="em-node-index"><span>{String(index + 1).padStart(2, "0")}</span><i />{id !== draft.start && id !== "end" && <button onClick={() => removeNode(id)}>删除</button>}</div><div className="em-node-body"><div className="em-node-title"><strong>{node.type === "line" ? "对白节点" : node.type === "choice" ? "玩家选择" : "事件结尾"}</strong><code>{id}</code>{id === draft.start && <b>起点</b>}</div>
              {node.type !== "choice" && <div className="node-key-effect"><label>经过节点写入全局 Key<select value={nodeFlagEffect(node.effects)?.key??""} onChange={(event)=>updateNode(id,{...node,effects:withNodeFlag(node.effects,event.target.value,nodeFlagEffect(node.effects)?.value??true)} as EventNode)}><option value="">不写入</option>{allGlobalKeys.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{nodeFlagEffect(node.effects)&&<label>写入值<select value={String(nodeFlagEffect(node.effects)?.value)} onChange={(event)=>updateNode(id,{...node,effects:withNodeFlag(node.effects,nodeFlagEffect(node.effects)?.key??"",event.target.value==="true")} as EventNode)}><option value="true">已发生</option><option value="false">未发生</option></select></label>}</div>}
              {draft.cardStyle === "special" && <div className="em-node-visual"><AssetField label="本轮立绘" value={node.portrait ?? draft.defaultPortrait ?? ""} onChange={(portrait) => updateNode(id, { ...node, portrait } as EventNode)} /><label>场景动效<select value={node.stageEffect ?? "none"} onChange={(event) => updateNode(id, { ...node, stageEffect: event.target.value as "none" | "soft_glow" | "heartbeat" | "shake" } as EventNode)}><option value="none">无额外动效</option><option value="soft_glow">柔光流动</option><option value="heartbeat">心动呼吸</option><option value="shake">轻微震动</option></select></label></div>}
              {node.type === "line" && <><div className="em-inline-fields"><label>说话人<select value={node.speaker} onChange={(event) => updateNode(id, { ...node, speaker: event.target.value as Extract<EventNode, { type: "line" }>["speaker"] })}><option value="narrator">旁白</option><option value="player">玩家</option>{allCharacters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>情绪<input value={node.mood ?? ""} onChange={(event) => updateNode(id, { ...node, mood: event.target.value })} placeholder="如：犹豫" /></label><label>下一节点<select value={node.next} onChange={(event) => updateNode(id, { ...node, next: event.target.value })}>{nodeIds.filter((item) => item !== id).map((item) => <option key={item}>{item}</option>)}</select></label><label>缘分变化<input type="number" value={bondEffect(node.effects, draft.characterId)} onChange={(event) => updateLineBond(id, node, Number(event.target.value))} /></label></div><textarea value={node.text} onChange={(event) => updateNode(id, { ...node, text: event.target.value })} /></>}
              {node.type === "choice" && <><label className="em-prompt">选择提示<input value={node.prompt ?? ""} onChange={(event) => updateNode(id, { ...node, prompt: event.target.value })} /></label><div className="em-option-list">{node.options.map((option, optionIndex) => <div key={option.id}><span>{optionIndex + 1}</span><input value={option.label} onChange={(event) => updateNode(id, { ...node, options: node.options.map((item, i) => i === optionIndex ? { ...item, label: event.target.value } : item) })} /><select value={option.next} onChange={(event) => updateNode(id, { ...node, options: node.options.map((item, i) => i === optionIndex ? { ...item, next: event.target.value } : item) })}>{nodeIds.filter((item) => item !== id).map((item) => <option key={item}>{item}</option>)}</select><input className="bond-input" type="number" title="缘分变化" value={bondEffect(option.effects, draft.characterId)} onChange={(event) => updateOptionBond(id, node, optionIndex, Number(event.target.value))} /><button onClick={() => updateNode(id, { ...node, options: node.options.filter((_, i) => i !== optionIndex) })}>×</button></div>)}</div><button className="add-option" onClick={() => updateNode(id, { ...node, options: [...node.options, { id: `option_${node.options.length + 1}`, label: "新选项", next: "end" }] })}>＋ 添加选项</button></>}
              {node.type === "choice" && <ChoiceMemoryEditor node={node} keys={allGlobalKeys} onChange={(next)=>updateNode(id,next)}/>}
              {node.type === "end" && <label className="em-prompt">事件总结<textarea value={node.summary ?? ""} onChange={(event) => updateNode(id, { ...node, summary: event.target.value })} /></label>}
            </div></article>)}
          </div></fieldset>}
        </div>}
        {errors.length > 0 && <div className="em-errors"><strong>请先修正以下内容</strong>{errors.map((error, index) => <p key={`${error}-${index}`}>· {error}</p>)}</div>}
        <footer><div><span className={`em-status-pill ${draftStatus}`}>{draftStatus === "published" ? "发布后进入游戏" : "仅保存到草稿箱"}</span><small>保存前会自动检查节点连线和字段完整性</small></div><div><button className="quiet" onClick={() => setEditorOpen(false)}>取消</button><button className="primary" disabled={saving} onClick={saveEditor}>{saving ? "保存中…" : draftStatus === "published" ? "保存并发布" : "保存草稿"}</button></div></footer>
      </section></div>}

      {bulkOpen && <div className="em-overlay" onMouseDown={() => setBulkOpen(false)}><section className="em-bulk" onMouseDown={(event) => event.stopPropagation()}><header><div><p>结构体批量注入</p><h2>导入事件 JSON</h2></div><button onClick={() => setBulkOpen(false)}>×</button></header><p>支持单个 EventDefinition 对象，或由多个事件组成的数组。导入后默认保存为草稿。</p><label className="em-file-button">选择 JSON 文件<input type="file" accept="application/json,.json" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setBulkText(await file.text()); }} /></label><textarea value={bulkText} onChange={(event) => setBulkText(event.target.value)} spellCheck={false} />{errors.length > 0 && <div className="em-errors">{errors.map((error, index) => <p key={`${error}-${index}`}>· {error}</p>)}</div>}<footer><button className="quiet" onClick={() => setBulkOpen(false)}>取消</button><button className="primary" disabled={saving} onClick={importBulk}>{saving ? "导入中…" : "校验并导入"}</button></footer></section></div>}
    </main>
  );
}
