/* eslint-disable @typescript-eslint/no-require-imports */
// Execute production TypeScript reducers without a browser or a second rule implementation.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true } }).outputText;
  module._compile(output, filename);
};
const root = path.resolve(__dirname, "..");
const load = (file) => require(path.join(root, "app/game", file));
const { cloneInitial, mergeSave } = load("core/save-migration.ts");
const { SHEN_QINGSHUANG_EVENTS: story } = load("content/shen-qingshuang-content.ts");
const { getEligibleEvents, startDefinition, advanceEvent, currentNode } = load("event-engine.ts");
const { eligibleInspectionEvents, getInspectionHints, inspectionSlot } = load("inspection-engine.ts");
const { getDueCalendarEvents } = load("calendar-engine.ts");
const { buyShopItem, sellShopItem, shopBuyPrice, shopStockRemaining, itemSellValue, buyAlchemyMarketOffer } = load("core/trading-service.ts");
const { prepareAlchemyBatch, startAlchemyBatch, claimAlchemyBatch, normalizeAlchemyBatch } = load("alchemy/batch-service.ts");
const { readObjectiveCurrent, questView, synchronizeQuestProgress } = load("quests/engine.ts");
const { QUESTS } = load("quests/content.ts");
const { MATERIALS, DEFAULT_RECIPE_RULES, MYTHIC_MATERIAL, isFatedFlower } = load("alchemy/item-data.ts");
const { SHOP_OFFERS } = load("shop-content.ts");
const { getMarketPrice } = load("alchemy/market.ts");
const { EVENTS, CHARACTERS } = load("content.ts");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }
const roundtrip = (state) => mergeSave(JSON.parse(JSON.stringify(state)));

test("32 story chapters use normal eligibility, complete in sequence, and restore each dialogue node", () => {
  let state = cloneInitial().romance;
  // Meet documented relationship/progression prerequisites, never pre-mark story completion.
  state.relationships.shen = 100;
  for (const event of story) {
    state = { ...state, day: 9, sceneId: event.sceneId, period: event.conditions.find((c) => c.type === "period")?.value ?? (event.trigger === "inspection" ? "夜晚" : "清晨"),
      presentCharacters: { [event.sceneId]: event.presenceMode === "visit" ? [] : ["shen"] }, activeEvent: null };
    const context = { trigger: event.trigger, sceneId: event.sceneId, characterId: "shen", giftId: event.conditions.find((c) => c.type === "gift")?.value };
    const eligible = event.trigger === "calendar_event" ? getDueCalendarEvents(state, EVENTS)
      : event.trigger === "inspection" ? eligibleInspectionEvents(state, EVENTS, event.sceneId) : getEligibleEvents(EVENTS, state, context);
    assert(eligible.some((entry) => entry.id === event.id), "Blocked: " + event.id);
    state = startDefinition(state, event, context);
    let limit = 100;
    while (state.activeEvent && limit-- > 0) {
      const node = currentNode(state, EVENTS);
      assert(node, "Missing node");
      state = advanceEvent(state, EVENTS, node.type === "choice" ? node.options[0]?.id : undefined);
      const saved = roundtrip({ ...cloneInitial(), romance: state });
      assert.deepEqual(saved.romance.activeEvent, state.activeEvent, "Dialogue position lost");
      state = saved.romance;
    }
    assert(state.completedEvents.includes(event.id), "Not completed: " + event.id);
  }
  assert.equal(story.length, 32);
  assert.equal(state.completedEvents.filter((id) => id.startsWith("shen.arc.")).length, 32);
});

test("deep-night inspection is reachable even after an evening inspection and cannot be rerolled in the same slot", () => {
  const event = story[5];
  const state = { ...cloneInitial().romance, day: 3, period: "深夜", relationships: { shen: 100 }, completedEvents: story.slice(0,5).map((e)=>e.id), sceneInspectionSlots: { [event.sceneId]: inspectionSlot(3,"夜晚") } };
  assert(getInspectionHints(state, EVENTS, [event.sceneId]).has(event.sceneId));
  const used = { ...state, sceneInspectionSlots: { [event.sceneId]: inspectionSlot(3,"深夜") } };
  assert.equal(eligibleInspectionEvents(used, EVENTS, event.sceneId).length, 0);
  assert.equal(getInspectionHints({ ...state, period:"清晨" }, EVENTS, [event.sceneId]).size, 0);
});

test("visits bypass residency only at the explicitly authored scene", () => {
  for (const index of [20,26,29]) {
    const event = story[index];
    assert.equal(event.presenceMode,"visit");
    assert(!CHARACTERS.filter((c) => c.sceneId === "bedroom").some((c) => c.id === "shen"));
    const state = { ...cloneInitial().romance, sceneId:"bedroom", relationships:{shen:100}, completedEvents:story.slice(0,index).map((e)=>e.id), period:event.conditions.find((c)=>c.type==="period").value, presentCharacters:{bedroom:[]} };
    assert(getEligibleEvents([event],state,{trigger:"time_change",sceneId:"bedroom"}).length);
    assert.equal(getEligibleEvents([{...event,presenceMode:"resident"}],state,{trigger:"time_change",sceneId:"bedroom"}).length,0);
  }
});

test("birthday can be caught up on day 9 or 100, but not before prerequisites or after completion", () => {
  const event=story[24], state={...cloneInitial().romance,relationships:{shen:100},completedEvents:story.slice(0,24).map(e=>e.id)};
  for(const day of [8,9,100]) assert(getDueCalendarEvents({...state,day},[event]).length);
  assert.equal(getDueCalendarEvents({...state,day:7},[event]).length,0);
  assert.equal(getDueCalendarEvents({...state,day:9,completedEvents:[]},[event]).length,0);
  assert.equal(getDueCalendarEvents({...state,day:9,completedEvents:[...state.completedEvents,event.id]},[event]).length,0);
});

test("100 key-tag trades cannot generate currency; daily stock survives saves and resets only on a new game day", () => {
  let state=cloneInitial(); const start=state.shared.spiritStones;
  for(let i=0;i<100;i++){state=buyShopItem(state,"treasureKeyTag");state=sellShopItem(state,"treasureKeyTag",1);state=roundtrip(state);}
  assert(state.shared.spiritStones<start);
  assert.equal(shopStockRemaining(state,"treasureKeyTag"),0);
  assert.equal(buyShopItem(state,"treasureKeyTag"),state);
  assert.equal(shopStockRemaining({...state,romance:{...state.romance,day:state.romance.day+1}},"treasureKeyTag"),8);
  console.log("  balance: "+start+" -> "+state.shared.spiritStones);
});

test("maximum discounts and cross-shop materials/monthly sweets cannot be bought and resold for profit", () => {
  const state=cloneInitial(); state.romance.relationships.ning=100;state.shared.globalKeys.medicine_supply_restored=true;
  for(const offer of SHOP_OFFERS) assert(itemSellValue({itemId:offer.itemId,itemType:"gift",rarity:7,amount:1,sourceTags:[]})<shopBuyPrice(state,offer.itemId),offer.itemId);
  for(const item of MATERIALS) assert(itemSellValue({itemId:item.id,itemType:"material",rarity:7,amount:1,sourceTags:[]})<getMarketPrice(item),item.id);
  for(const [id,price] of Object.entries(load("core/trading-service.ts").MONTHLY_MARKET_PRICES)) assert(itemSellValue({itemId:id,itemType:"gift",rarity:7,amount:1,sourceTags:[]})<price,id);
});

test("duplicate sale/purchase and insufficient balances leave resources unchanged", () => {
  let state=buyShopItem(cloneInitial(),"treasureKeyTag");
  state=sellShopItem(state,"treasureKeyTag",1);
  assert.equal(sellShopItem(state,"treasureKeyTag",1),state);
  assert.equal(sellShopItem(state,"treasureKeyTag",-1),state);
  const poor={...state,shared:{...state.shared,spiritStones:0}};
  assert.equal(buyShopItem(poor,"treasureKeyTag"),poor);
  state={...state,alchemy:{...state.alchemy,marketOffers:[{id:"one",itemId:MATERIALS[0].id,sold:false}]}};
  state=buyAlchemyMarketOffer(state,"one");
  assert.equal(buyAlchemyMarketOffer(state,"one"),state);
});

test("starter pills never satisfy personally brewing; an old falsely claimable task is corrected", () => {
  const state=cloneInitial(), quest=QUESTS.find(q=>q.id==="main-first-alchemy");
  assert(Object.values(state.shared.items).some(i=>i.itemType==="pill" && i.amount>0));
  assert.equal(readObjectiveCurrent(quest.objectives[0],state),0);
  state.quests.statuses[quest.id]="claimable";
  assert.equal(questView(quest,state.quests,state).status,"in_progress");
  assert.equal(synchronizeQuestProgress(state.quests,state).statuses[quest.id],"in_progress");
  assert(readObjectiveCurrent({...quest.objectives[0],type:"acquire"},state)>0);
});

test("paid batch survives exit/reload; result/quality are locked; early/double claims never grant extra rewards", () => {
  let state=cloneInitial();
  const ids=MATERIALS.filter(i=>!isFatedFlower(i)&&i.id!==MYTHIC_MATERIAL.id).slice(0,2).map(i=>i.id);
  for(const id of ids) state.alchemy.materialCounts[id]=3;
  const batch=prepareAlchemyBatch(ids,DEFAULT_RECIPE_RULES,1,1000);
  const before=state.shared.stamina;
  state=startAlchemyBatch(state,batch);
  assert.equal(state.shared.stamina,before-1);
  for(const id of ids) assert.equal(state.alchemy.materialCounts[id],2);
  assert.equal(startAlchemyBatch(state,batch),state);
  state=roundtrip(state);
  assert.deepEqual(state.alchemy.pendingBatch,batch);
  assert.equal(claimAlchemyBatch(state,batch.id,1001),state);
  state=claimAlchemyBatch(state,batch.id,batch.readyAt);
  assert.equal(state.alchemy.completedBrews,1);
  assert.equal(state.alchemy.pendingBatch,null);
  assert(Object.values(state.shared.items).some(i=>i.templateId===batch.productId&&i.mutation===batch.mutation&&i.amount===1));
  state=roundtrip(state);
  assert.equal(claimAlchemyBatch(state,batch.id,batch.readyAt+100),state);
  assert.equal(state.alchemy.completedBrews,1);
  assert.equal(readObjectiveCurrent(QUESTS.find(q=>q.id==="main-first-alchemy").objectives[0],state),1);
  assert.equal(normalizeAlchemyBatch({...batch,readyAt:"broken"}),null);
  const poor={...state,shared:{...state.shared,stamina:0}};
  assert.equal(startAlchemyBatch(poor,batch),poor);
});

test("fated and mythic batches survive reload and grant exactly one card in both registries", () => {
  for(const mythic of [false,true]){
    let state=cloneInitial();
    const ids=mythic?[MYTHIC_MATERIAL.id]:[MATERIALS.find(isFatedFlower).id,MATERIALS[0].id];
    for(const id of ids)state.alchemy.materialCounts[id]=3;
    const batch=prepareAlchemyBatch(ids,DEFAULT_RECIPE_RULES,1,2000,mythic?["char-qingdai"]:[]);
    state=roundtrip(startAlchemyBatch(state,batch));
    assert(state.alchemy.pendingBatch?.card);
    state=claimAlchemyBatch(state,batch.id,batch.readyAt);
    assert.equal(state.alchemy.characterCards.filter(c=>c.id===batch.id).length,1);
    assert.equal(state.shared.cards.filter(c=>c.id===batch.id).length,1);
    assert.equal(claimAlchemyBatch(roundtrip(state),batch.id,batch.readyAt).shared.cards.length,state.shared.cards.length);
    assert.equal(state.alchemy.completedBrews??0,0,"a character card is not a personally brewed pill");
  }
});
console.log(`\n${passed} critical regression groups passed.`);
