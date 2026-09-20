"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { useFeedback } from "../feedback/FeedbackProvider";
import { KITCHEN_RECIPES, KITCHEN_UI, kitchenFoodItemId } from "./content";
import { cookRecipe, eatDish, recipeAvailability } from "./service";
import type { KitchenRecipe } from "./types";

type KitchenTab = "cook" | "pantry";
type KitchenPhase = "idle" | "cooking" | "reveal";

const RARITY_LABELS = ["", "凡味", "清味", "珍味", "上味", "天味", "仙味", "神味"];

function EffectChips({ recipe }: { recipe: KitchenRecipe }) {
  return <div className="kitchen-effect-chips">
    {recipe.effects.stamina > 0 && <span><i>炁</i>{KITCHEN_UI.stamina} +{recipe.effects.stamina}</span>}
    {recipe.effects.experience > 0 && <span><i>悟</i>{KITCHEN_UI.experience} +{recipe.effects.experience}</span>}
    {recipe.effects.luckCharges > 0 && <span className="luck"><i>福</i>{KITCHEN_UI.luck} {recipe.effects.luckBonus}阶 · {recipe.effects.luckCharges}次</span>}
  </div>;
}

export default function KitchenModal({ onClose, onNotice: _onNotice }: { onClose: () => void; onNotice: (message: string) => void }) {
  const { state, transact } = useUnifiedGame();
  const feedback = useFeedback();
  const [tab, setTab] = useState<KitchenTab>("cook");
  const [selectedId, setSelectedId] = useState(KITCHEN_RECIPES[0].id);
  const [phase, setPhase] = useState<KitchenPhase>("idle");
  const [revealed, setRevealed] = useState<KitchenRecipe | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = KITCHEN_RECIPES.find((recipe) => recipe.id === selectedId) ?? KITCHEN_RECIPES[0];
  const availability = useMemo(() => recipeAvailability(state.shared.items, selected), [selected, state.shared.items]);
  const pantry = KITCHEN_RECIPES.map((recipe) => ({ recipe, amount: state.shared.items[kitchenFoodItemId(recipe.id)]?.amount ?? 0 })).filter((entry) => entry.amount > 0);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function selectRecipe(id: string) {
    if (phase !== "idle") return;
    setSelectedId(id);
    setRevealed(null);
  }

  function cook() {
    if (phase !== "idle") return;
    const result = cookRecipe(state, selected.id);
    if (!result.ok) { feedback.toast({ priority: 3, tone: "muted", titleKey: "system.toastWarning", bodyKey: "world.changeBody", params: { message: result.message }, icon: "缺", dedupeKey: `kitchen-missing:${selected.id}` }); return; }
    const firstMastery=!state.kitchen.discoveredRecipes.includes(result.recipe.id);
    transact(() => result.state);
    setPhase("cooking");
    setRevealed(result.recipe);
    timer.current = setTimeout(() => {
      const grand=firstMastery&&result.recipe.rarity>=4;
      setPhase(grand?"reveal":"idle");
      if(!grand)setRevealed(null);
      feedback.publish({
        variant: grand ? "rare-reward" : "action-toast",
        level: grand ? "L0" : "L1",
        priority: grand ? 1 : 3,
        tone: "gold",
        titleKey: "system.toastSuccess",
        bodyKey: "world.changeBody",
        params: { message: `${result.recipe.name}已收入食盒。` },
        icon: "膳", imageSrc: result.recipe.art,
        receiptId: result.state.activity.last?.id,
        presentationOwner:"kitchen",
        firstObtain:firstMastery,
        record:grand,
        rewards:result.state.activity.last?.rewards,
        impacts:result.state.activity.last?.impacts,
      });
    }, 1350);
  }

  function eat(recipe: KitchenRecipe) {
    const result = eatDish(state, recipe.id);
    if (!result.ok) { feedback.toast({titleKey:"system.toastWarning",bodyKey:"world.changeBody",params:{message:result.message},icon:"盒",tone:"muted",dedupeKey:`kitchen-eat-missing:${recipe.id}`}); return; }
    transact(() => result.state);
    const staminaGain=Math.max(0,result.state.shared.stamina-state.shared.stamina);
    const levelGain=Math.max(0,result.state.shared.playerLevel-state.shared.playerLevel);
    const effect = [`体力 +${staminaGain}`, recipe.effects.experience ? levelGain?`修为 +${recipe.effects.experience} · 境界 +${levelGain}`:`修为 +${recipe.effects.experience}`:"", recipe.effects.luckCharges ? `食运 ${recipe.effects.luckBonus}阶×${recipe.effects.luckCharges}次` : ""].filter(Boolean).join(" · ");
    feedback.publish({ variant: "action-toast",level:"L1", priority: 2, tone: recipe.effects.luckCharges ? "gold" : "jade", titleKey: "system.toastSuccess", bodyKey: "world.changeBody", params: { message: effect }, icon: recipe.effects.luckCharges ? "福" : "炁", imageSrc: recipe.art, eventId:`kitchen-eat:${state.kitchen.mealsEaten + 1}`,presentationOwner:"kitchen" });
    setPhase("idle"); setRevealed(null);
  }

  return <div className="kitchen-backdrop" role="presentation" onMouseDown={onClose}>
    <section className={`kitchen-window phase-${phase}`} role="dialog" aria-modal="true" aria-label="王妈的小灶" onMouseDown={(event) => event.stopPropagation()}>
      <header className="kitchen-heading">
        <button type="button" className="kitchen-back" onClick={onClose} aria-label={KITCHEN_UI.close}>‹</button>
        <div><small>{KITCHEN_UI.eyebrow}</small><h2>{KITCHEN_UI.title}</h2><p>{KITCHEN_UI.subtitle}</p></div>
        <div className="kitchen-vitals"><span><i>炁</i><b>{state.shared.stamina}/10</b></span><span className={state.shared.luck.charges ? "active" : ""}><i>福</i><b>{state.shared.luck.charges ? `${state.shared.luck.bonus}阶×${state.shared.luck.charges}` : "未食"}</b></span></div>
      </header>

      <nav className="kitchen-tabs" aria-label="厨房功能">
        <button type="button" className={tab === "cook" ? "active" : ""} onClick={() => setTab("cook")}><i>灶</i>{KITCHEN_UI.recipeTab}</button>
        <button type="button" className={tab === "pantry" ? "active" : ""} onClick={() => setTab("pantry")}><i>盒</i>{KITCHEN_UI.pantryTab}<b>{pantry.reduce((sum, entry) => sum + entry.amount, 0)}</b></button>
      </nav>

      {tab === "cook" ? <div className="kitchen-cook-layout">
        <main className="kitchen-stove-stage">
          <div className="kitchen-stage-vignette" />
          <div className="kitchen-fire" aria-hidden="true"><i /><i /><i /><b /></div>
          <div className="kitchen-wok" aria-hidden="true"><span /><i /><i /><i /></div>
          <div className="kitchen-dish-focus">
            <span className="kitchen-rarity">{RARITY_LABELS[selected.rarity]}</span>
            <img src={selected.art} alt="" />
            <h3>{selected.name}</h3><p>{selected.subtitle}</p>
            <EffectChips recipe={selected} />
          </div>
          <div className="kitchen-ingredient-orbit" aria-label="所需食材">
            {availability.ingredients.map((ingredient, index) => <div key={ingredient.itemId} className={ingredient.missing ? "missing" : "ready"} style={{ "--ingredient-index": index, "--ingredient-count": availability.ingredients.length } as React.CSSProperties}><span><img src={ingredient.art} alt="" /></span><strong>{ingredient.name}</strong><small>{ingredient.held}/{ingredient.amount}</small></div>)}
          </div>
          {phase === "cooking" && <div className="kitchen-cooking-overlay"><div className="kitchen-lid"><i /></div><strong>{KITCHEN_UI.cooking}</strong><span>风起 · 火旺 · 收香</span></div>}
        </main>

        <aside className="kitchen-recipe-deck">
          <button type="button" className="kitchen-deck-arrow" onClick={() => selectRecipe(KITCHEN_RECIPES[(KITCHEN_RECIPES.findIndex((entry) => entry.id === selected.id) - 1 + KITCHEN_RECIPES.length) % KITCHEN_RECIPES.length].id)} aria-label="上一道菜">‹</button>
          <div className="kitchen-deck-strip">{KITCHEN_RECIPES.map((recipe) => <button type="button" key={recipe.id} className={recipe.id === selected.id ? "active" : ""} onClick={() => selectRecipe(recipe.id)}><img src={recipe.art} alt="" /><span><strong>{recipe.name}</strong><small>{RARITY_LABELS[recipe.rarity]}</small></span></button>)}</div>
          <button type="button" className="kitchen-deck-arrow" onClick={() => selectRecipe(KITCHEN_RECIPES[(KITCHEN_RECIPES.findIndex((entry) => entry.id === selected.id) + 1) % KITCHEN_RECIPES.length].id)} aria-label="下一道菜">›</button>
        </aside>

        <footer className="kitchen-thumb-zone"><div><span className={availability.ready ? "ready" : "missing"}>{availability.ready ? KITCHEN_UI.ready : KITCHEN_UI.missing}</span><p>{selected.description}</p></div><button type="button" disabled={!availability.ready || phase !== "idle"} onClick={cook}><i>{phase === "cooking" ? "火" : "炊"}</i><span><small>{availability.ready ? "耗材一次 · 成膳入盒" : availability.ingredients.filter((entry) => entry.missing).map((entry) => entry.name).join("、")}</small><strong>{phase === "cooking" ? KITCHEN_UI.cooking : KITCHEN_UI.cook}</strong></span></button></footer>
      </div> : <div className="kitchen-pantry">
        <div className="kitchen-pantry-shelf"><header><small>WARM MEALS · 今日食盒</small><h3>挑一味，趁热入口</h3><p>料理保存在统一行囊；食用后效果直接写入角色状态。</p></header>{pantry.length ? <div className="kitchen-pantry-cards">{pantry.map(({ recipe, amount }) => <article key={recipe.id}><div className="kitchen-pantry-art"><img src={recipe.art} alt="" /><b>×{amount}</b></div><div><small>{RARITY_LABELS[recipe.rarity]}</small><h4>{recipe.name}</h4><p>{recipe.subtitle}</p><EffectChips recipe={recipe} /></div><button type="button" onClick={() => eat(recipe)}>{KITCHEN_UI.eat}</button></article>)}</div> : <div className="kitchen-pantry-empty"><i>空</i><h3>食盒里还没有料理</h3><p>回到灶前选择一页菜谱，备齐原料后添柴起灶。</p><button type="button" onClick={() => setTab("cook")}>回灶前掌勺</button></div>}</div>
      </div>}

      {phase === "reveal" && revealed && <div className={`kitchen-reveal rarity-${revealed.rarity}`} role="dialog" aria-label={`${revealed.name}烹制完成`}><div className="kitchen-reveal-rays"/><div className="kitchen-reveal-dish"><img src={revealed.art} alt="" /><i>膳</i></div><small>烟火入道 · 灵膳成</small><h2>{revealed.name}</h2><p>{revealed.subtitle}</p><EffectChips recipe={revealed} /><div><button type="button" onClick={() => { setPhase("idle"); setRevealed(null); }}>{KITCHEN_UI.store}</button><button type="button" className="primary" onClick={() => eat(revealed)}>{KITCHEN_UI.eat}</button></div></div>}
    </section>
  </div>;
}
