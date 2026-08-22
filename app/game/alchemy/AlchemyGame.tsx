"use client";

import {
  CSSProperties,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CHARACTER_PROFILES,
  DEFAULT_RECIPE_RULES,
  GameItem,
  getDominantCharacter,
  isFatedFlower,
  isMythicScroll,
  ITEM_TABLE,
  MATERIALS,
  MYTHIC_MATERIAL,
  PRODUCTS,
  RecipeRule,
  resolveManagedRecipe,
  selectAlchemyResult,
  selectCharacterOutcome,
} from "./item-data";
import {
  getManualRefreshPrice,
  getMarketPrice,
  MARKET_QUALITY_WEIGHTS,
  MARKET_RESET_MS,
  MarketOffer,
  rollMarketOffers,
  SOLD_OUT_REFRESH_MS,
} from "./market";
import {
  COMMISSION_REFRESH_MS,
  DailyCommission,
  generateCommissions,
  getMutationValue,
  matchesFuzzyCommission,
  MUTATIONS,
  MutationId,
  mutationDisplayName,
  ProductStack,
  productStackKey,
  rollMutation,
} from "./commissions";
import { COMMISSION_NPCS, CommissionNpc } from "./commission-npcs";
import {
  CharacterCardRecord,
  FatedCharacterCardRecord,
  isMythicCardRecord,
  MYTHIC_CARD_OPTIONS,
  MYTHIC_MAX_OPTIONS,
  MYTHIC_OPTION_PAGES,
  MYTHIC_RARE_MAX_USES,
  MythicCardRecord,
  MythicOptionPage,
  mythicTierLabel,
  visibleMythicOptions,
} from "./advanced-card";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import type { AlchemyProgress, UnifiedCardInstance, UnifiedRarity } from "../core/types";

const FILTERS = ["全部", "灵草", "妖丹", "矿骨", "辅材", "法器"];
const CODEX_FILTERS = ["全部", "材料", "成品", "神品", "神话"];
const QUALITY_FILTERS = ["全部品质", "凡品", "良品", "珍品", "极品", "神品", "神话"];
const ELEMENT_FILTERS = ["全部属性", "火", "水", "木", "金", "土", "阴"];
const PAGE_SIZE = 6;
const MATERIAL_GROUPS = Array.from(new Set(MATERIALS.map((item) => item.group).filter((group): group is string => Boolean(group))));
const ITEM_GROUP_COUNT = new Set(ITEM_TABLE.map((item) => item.group).filter(Boolean)).size;
const INVENTORY_MATERIALS = [
  ...MATERIALS.filter((item) => !isMythicScroll(item)).slice(0, 5),
  MYTHIC_MATERIAL,
  ...MATERIALS.filter((item) => !isMythicScroll(item)).slice(5),
];

function formatCountdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function playTone(kind: "drop" | "ignite" | "reveal") {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const ctx = new AudioContextClass();
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(kind === "reveal" ? 0.16 : 0.08, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === "reveal" ? 1.2 : 0.35));
  const frequencies = kind === "reveal" ? [392, 523.25, 659.25] : kind === "ignite" ? [110, 164.8] : [320];
  frequencies.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    oscillator.type = kind === "ignite" ? "sawtooth" : "sine";
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + index * 0.08);
    oscillator.connect(gain);
    oscillator.start(ctx.currentTime + index * 0.08);
    oscillator.stop(ctx.currentTime + (kind === "reveal" ? 1.2 : 0.4));
  });
  window.setTimeout(() => void ctx.close(), 1500);
}

export default function Home() {
  const { state: unifiedState, setAlchemy, applyEffects } = useUnifiedGame();
  const alchemy = unifiedState.alchemy;
  const setField = useCallback(<K extends keyof AlchemyProgress>(key: K, value: SetStateAction<AlchemyProgress[K]>) => {
    setAlchemy((current) => ({ ...current, [key]: typeof value === "function" ? (value as (previous: AlchemyProgress[K]) => AlchemyProgress[K])(current[key]) : value }));
  }, [setAlchemy]);
  const [slots, setSlots] = useState<(GameItem | null)[]>([null, null, null]);
  const [filter, setFilter] = useState("全部");
  const [seriesFilter, setSeriesFilter] = useState("全部系列");
  const [qualityFilter, setQualityFilter] = useState("全部品质");
  const [elementFilter, setElementFilter] = useState("全部属性");
  const [characterFilter, setCharacterFilter] = useState("全部人物");
  const [inventoryPage, setInventoryPage] = useState(0);
  const [phase, setPhase] = useState<"idle" | "ready" | "brewing" | "done">("idle");
  const [timeLeft, setTimeLeft] = useState(8);
  const [showResult, setShowResult] = useState(false);
  const [resultItem, setResultItem] = useState(PRODUCTS[0]);
  const [resultMutation, setResultMutation] = useState<MutationId>("normal");
  const [showCodex, setShowCodex] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [codexFilter, setCodexFilter] = useState("全部");
  const [codexSearch, setCodexSearch] = useState("");
  const [characterCard, setCharacterCard] = useState<NonNullable<ReturnType<typeof selectCharacterOutcome>> | null>(null);
  const [characterCardFromCodex, setCharacterCardFromCodex] = useState(false);
  const [starArrivalPulse, setStarArrivalPulse] = useState(false);
  const [openingFlash, setOpeningFlash] = useState(false);
  const [toast, setToast] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [dragging, setDragging] = useState<{ item: GameItem; x: number; y: number } | null>(null);
  const materialCounts = alchemy.materialCounts;
  const setMaterialCounts = (value: SetStateAction<Record<string, number>>) => setField("materialCounts", value);
  const [recipeRules, setRecipeRules] = useState<RecipeRule[]>(DEFAULT_RECIPE_RULES);
  const [recipeVersion, setRecipeVersion] = useState(1);
  const gold = unifiedState.shared.spiritStones;
  const setGold = (value: SetStateAction<number>) => { const next = typeof value === "function" ? value(gold) : value; applyEffects([{ type: "add_currency", amount: next - gold }]); };
  const marketOffers = alchemy.marketOffers;
  const setMarketOffers = (value: SetStateAction<MarketOffer[]>) => setField("marketOffers", value);
  const manualRefreshCount = alchemy.manualRefreshCount;
  const setManualRefreshCount = (value: SetStateAction<number>) => setField("manualRefreshCount", value);
  const refreshResetAt = alchemy.refreshResetAt;
  const setRefreshResetAt = (value: SetStateAction<number>) => setField("refreshResetAt", value);
  const soldOutRefreshAt = alchemy.soldOutRefreshAt;
  const setSoldOutRefreshAt = (value: SetStateAction<number>) => setField("soldOutRefreshAt", value);
  const [marketClock, setMarketClock] = useState(0);
  const marketReady = true;
  const [marketTab, setMarketTab] = useState<"goods" | "commissions">("goods");
  const productStacks = alchemy.productStacks;
  const setProductStacks = (value: SetStateAction<Record<string, ProductStack>>) => setField("productStacks", value);
  const commissions = alchemy.commissions;
  const setCommissions = (value: SetStateAction<DailyCommission[]>) => setField("commissions", value);
  const commissionRefreshAt = alchemy.commissionRefreshAt;
  const setCommissionRefreshAt = (value: SetStateAction<number>) => setField("commissionRefreshAt", value);
  const commissionReady = true;
  const [fuzzySelections, setFuzzySelections] = useState<Record<string, string[]>>({});
  const [pickerCommissionId, setPickerCommissionId] = useState<string | null>(null);
  const [activeCommissionNpc, setActiveCommissionNpc] = useState<CommissionNpc | null>(null);
  const [npcDialogueStep, setNpcDialogueStep] = useState(0);
  const [showMythicCreator, setShowMythicCreator] = useState(false);
  const [mythicTab, setMythicTab] = useState<MythicOptionPage>("character");
  const [mythicSelections, setMythicSelections] = useState<string[]>([]);
  const mythicRareUses = alchemy.mythicRareUses;
  const setMythicRareUses = (value: SetStateAction<Record<string, number>>) => setField("mythicRareUses", value);
  const characterCards = alchemy.characterCards;
  const setCharacterCards = (value: SetStateAction<CharacterCardRecord[]>) => setField("characterCards", value);
  const [showMythicCodex, setShowMythicCodex] = useState(false);
  const [pendingMythicCard, setPendingMythicCard] = useState<MythicCardRecord | null>(null);
  const [revealedMythicCard, setRevealedMythicCard] = useState<MythicCardRecord | null>(null);
  const [mythicRevealFromCodex, setMythicRevealFromCodex] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointerDragRef = useRef<{ item: GameItem; startX: number; startY: number; pointerId: number; moved: boolean } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const brewSerialRef = useRef(0);
  const pendingCharacterRef = useRef<ReturnType<typeof selectCharacterOutcome>>(null);
  const recipeVersionRef = useRef(0);
  const mythicRevealStartedRef = useRef(false);

  const filled = slots.filter(Boolean).length;
  const hasFatedFlower = slots.some(isFatedFlower);
  const hasMythicScroll = slots.some(isMythicScroll);
  const brewDuration = hasFatedFlower || hasMythicScroll ? 10 : 8;
  const dominantCharacter = useMemo(() => hasFatedFlower ? getDominantCharacter(slots) : null, [hasFatedFlower, slots]);
  const hasEnoughStock = slots.every((slot, index) => !slot || (materialCounts[slot.id] ?? 0) > slots.slice(0, index).filter((candidate) => candidate?.id === slot.id).length);
  const selectedMythicOptions = MYTHIC_CARD_OPTIONS.filter((option) => mythicSelections.includes(option.id));
  const selectedMythicCharacter = selectedMythicOptions.find((option) => option.page === "character");
  const selectedMythicProfile = CHARACTER_PROFILES.find((profile) => profile.id === selectedMythicCharacter?.characterId);
  const selectedMythicScene = selectedMythicOptions.find((option) => option.page === "scene");
  const mythicBrewConfigured = Boolean(selectedMythicCharacter && selectedMythicProfile);
  const canBrew = (hasMythicScroll ? mythicBrewConfigured : filled >= 2) && hasEnoughStock && unifiedState.shared.stamina > 0 && phase !== "brewing" && phase !== "done";
  const filteredMaterials = INVENTORY_MATERIALS.filter((item) => {
    const matchesCategory = filter === "全部" || item.category === filter;
    const matchesSeries = seriesFilter === "全部系列" || item.group === seriesFilter;
    const matchesQuality = qualityFilter === "全部品质" || item.quality === qualityFilter;
    const matchesElement = elementFilter === "全部属性" || item.element === elementFilter;
    const matchesCharacter = characterFilter === "全部人物" || item.character?.id === characterFilter;
    return matchesCategory && matchesSeries && matchesQuality && matchesElement && matchesCharacter;
  });
  const pageCount = Math.max(1, Math.ceil(filteredMaterials.length / PAGE_SIZE));
  const pageItems = filteredMaterials.slice(inventoryPage * PAGE_SIZE, inventoryPage * PAGE_SIZE + PAGE_SIZE);
  const progress = ((brewDuration - timeLeft) / brewDuration) * 100;
  const marketItems = marketOffers.map((offer) => ({ offer, item: MATERIALS.find((item) => item.id === offer.itemId) })).filter((entry): entry is { offer: MarketOffer; item: GameItem } => Boolean(entry.item));
  const marketSoldOut = marketOffers.length > 0 && marketOffers.every((offer) => offer.sold);
  const manualRefreshPrice = getManualRefreshPrice(manualRefreshCount);
  const manualResetRemaining = Math.max(0, refreshResetAt - marketClock);
  const soldOutRemaining = Math.max(0, soldOutRefreshAt - marketClock);
  const commissionRemaining = Math.max(0, commissionRefreshAt - marketClock);
  const productStackList = Object.values(productStacks).filter((stack) => stack.count > 0).map((stack) => ({ stack, item: PRODUCTS.find((item) => item.id === stack.productId) })).filter((entry): entry is { stack: ProductStack; item: GameItem } => Boolean(entry.item));
  const pickerCommission = commissions.find((commission) => commission.id === pickerCommissionId && commission.kind === "fuzzy");
  const revealedMythicOptions = MYTHIC_CARD_OPTIONS.filter((option) => revealedMythicCard?.optionIds.includes(option.id));
  const revealedMythicCharacter = revealedMythicOptions.find((option) => option.page === "character");
  const revealedMythicProfile = CHARACTER_PROFILES.find((profile) => profile.id === revealedMythicCharacter?.characterId);
  const revealedMythicScene = revealedMythicOptions.find((option) => option.page === "scene");
  const mythicCardCount = characterCards.filter(isMythicCardRecord).length;
  const fatedCardCount = characterCards.length - mythicCardCount;

  const omen = useMemo(() => {
    if (hasMythicScroll) {
      return mythicBrewConfigured
        ? { title: "太初命刻", result: "神话人物卡 · 真容未显", chance: "十息必成", quality: "神话" }
        : { title: "无字命卷", result: "尚待封存人物命格", chance: "待定", quality: "神话" };
    }
    if (hasFatedFlower) {
      return dominantCharacter
        ? { title: "缘影共鸣", result: `人物卡·${dominantCharacter.profile.title}倾向`, chance: "命契必成", quality: "神品" }
        : { title: "命星入雾", result: "随机命定人物卡", chance: "命契必成", quality: "神品" };
    }
    const linkedCharacter = getDominantCharacter(slots);
    if (linkedCharacter) {
      return { title: "缘物有应", result: "需星命神花引契", chance: "尚未启契", quality: "待引" };
    }
    if (filled >= 2) {
      const managedMatch = resolveManagedRecipe(slots, recipeRules);
      const predicted = selectAlchemyResult(slots, recipeRules);
      const rate = Math.min(96, 72 + slots.filter(Boolean).reduce((sum, item) => sum + (item?.rarity ?? 0), 0) * 2);
      return { title: managedMatch ? `配方·${managedMatch.rule.name}` : "五行丹象", result: `${predicted.quality}·${predicted.name}`, chance: `${rate}%`, quality: predicted.quality };
    }
    return { title: "炉火已燃", result: "尚缺两味灵材", chance: "--", quality: "待鉴定" };
  }, [slots, filled, hasFatedFlower, hasMythicScroll, mythicBrewConfigured, dominantCharacter, recipeRules]);

  const codexRows = useMemo(() => {
    const keyword = codexSearch.trim().toLowerCase();
    return ITEM_TABLE.filter((item) => {
      const matchesGroup = codexFilter === "全部" || (codexFilter === "材料" && item.itemType === "material") || (codexFilter === "成品" && item.itemType === "product") || (codexFilter === "神品" && item.quality === "神品") || (codexFilter === "神话" && item.quality === "神话");
      const matchesSearch = !keyword || `${item.name}${item.originalName ?? ""}${item.short}${item.group ?? ""}${item.category}${item.attribute}${item.trait}${item.effect}${item.character?.name ?? ""}${item.character?.relation ?? ""}`.toLowerCase().includes(keyword);
      return matchesGroup && matchesSearch;
    });
  }, [codexFilter, codexSearch]);

  useEffect(() => setInventoryPage(0), [filter, seriesFilter, qualityFilter, elementFilter, characterFilter]);

  useEffect(() => {
    const now = Date.now();
    setMarketClock(now);
    setAlchemy((current) => {
      const validOffers = current.marketOffers.filter((offer) => MATERIALS.some((item) => item.id === offer.itemId)).slice(0, 6);
      const resetExpired = !current.refreshResetAt || current.refreshResetAt <= now;
      const pendingSoldOut = validOffers.length === 6 && validOffers.every((offer) => offer.sold) ? current.soldOutRefreshAt || now + SOLD_OUT_REFRESH_MS : 0;
      const marketOffers = validOffers.length === 6 && !(pendingSoldOut > 0 && pendingSoldOut <= now) ? validOffers : rollMarketOffers(MATERIALS);
      const validCommissions = current.commissions.length === 7 && current.commissions.every((commission) => commission.kind !== "fuzzy" || commission.pricingMode === "fixed" || commission.pricingMode === "dynamic") && current.commissionRefreshAt > now;
      const rareDefaults = Object.fromEntries(MYTHIC_CARD_OPTIONS.filter((option) => option.tier === "rare").map((option) => [option.id, Math.max(0, Math.min(MYTHIC_RARE_MAX_USES, current.mythicRareUses[option.id] ?? MYTHIC_RARE_MAX_USES))]));
      return { ...current, marketOffers, manualRefreshCount: resetExpired ? 0 : current.manualRefreshCount, refreshResetAt: resetExpired ? 0 : current.refreshResetAt, soldOutRefreshAt: pendingSoldOut, commissions: validCommissions ? current.commissions : generateCommissions(MATERIALS, PRODUCTS), commissionRefreshAt: validCommissions ? current.commissionRefreshAt : now + COMMISSION_REFRESH_MS, mythicRareUses: rareDefaults };
    });
    const clock = window.setInterval(() => setMarketClock(Date.now()), 250);
    return () => window.clearInterval(clock);
  }, [setAlchemy]);

  useEffect(() => {
    if (!marketReady) return;
    if (refreshResetAt > 0 && marketClock >= refreshResetAt) {
      setManualRefreshCount(0);
      setRefreshResetAt(0);
      setToast("集市刷新令已恢复，本次刷新免费");
    }
    if (soldOutRefreshAt > 0 && marketClock >= soldOutRefreshAt) {
      setMarketOffers(rollMarketOffers(MATERIALS));
      setSoldOutRefreshAt(0);
      setToast("云商补货已至，集市上新六件灵材");
    }
  }, [marketClock, marketReady, refreshResetAt, soldOutRefreshAt]);

  useEffect(() => {
    if (!commissionReady || commissionRefreshAt <= 0 || marketClock < commissionRefreshAt) return;
    setCommissions(generateCommissions(MATERIALS, PRODUCTS));
    setFuzzySelections({});
    setPickerCommissionId(null);
    setCommissionRefreshAt(Date.now() + COMMISSION_REFRESH_MS);
    setToast("仙门收购榜已刷新，新委托现已张榜");
  }, [commissionReady, commissionRefreshAt, marketClock]);

  useEffect(() => {
    let active = true;
    async function loadPublishedRules(showNotice = false) {
      try {
        const response = await fetch("/api/item-manager", { cache: "no-store" });
        const data = await response.json() as { published?: RecipeRule[]; version?: number };
        if (!response.ok || !data.published || typeof data.version !== "number") return;
        if (!active || data.version === recipeVersionRef.current) return;
        const previous = recipeVersionRef.current;
        recipeVersionRef.current = data.version;
        setRecipeRules(data.published);
        setRecipeVersion(data.version);
        if (showNotice || previous > 0) setToast(`配方司已发布 v${data.version}，本炉规则已即时更新`);
      } catch {
        // 后端不可用时继续使用内置规则，保证离线启动仍可炼制。
      }
    }
    void loadPublishedRules();
    const interval = window.setInterval(() => void loadPublishedRules(), 3000);
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("xuanhuo-item-manager");
    if (channel) channel.onmessage = () => void loadPublishedRules(true);
    return () => {
      active = false;
      window.clearInterval(interval);
      channel?.close();
    };
  }, []);

  useEffect(() => {
    if (phase === "idle" || phase === "ready") setTimeLeft(brewDuration);
  }, [brewDuration, phase]);

  useEffect(() => {
    if (inventoryPage >= pageCount) setInventoryPage(0);
  }, [inventoryPage, pageCount]);

  useEffect(() => {
    if (phase !== "brewing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setPhase("done");
          setToast(hasMythicScroll ? "十息已满，太初命卡正在显化真容" : "丹香已现，可开炉取丹");
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, hasMythicScroll]);

  useEffect(() => {
    if (phase !== "done" || !hasMythicScroll || !pendingMythicCard || mythicRevealStartedRef.current) return;
    mythicRevealStartedRef.current = true;
    setOpeningFlash(true);
    const timeout = window.setTimeout(() => {
      setOpeningFlash(false);
      setCharacterCards((current) => current.some((card) => card.id === pendingMythicCard.id) ? current : [...current, pendingMythicCard]);
      setMythicRevealFromCodex(false);
      setRevealedMythicCard(pendingMythicCard);
      if (soundOn) playTone("reveal");
    }, 720);
    return () => window.clearTimeout(timeout);
  }, [phase, hasMythicScroll, pendingMythicCard, soundOn]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timeout);
  }, [toast]);

  function addIngredient(item: GameItem, targetIndex?: number) {
    if (!item.canBeIngredient || item.itemType !== "material") {
      setToast("成品不可再次投入丹炉");
      return;
    }
    if (phase === "brewing" || phase === "done") {
      setToast("文火凝丹中，不可再添灵材");
      return;
    }
    if (isMythicScroll(item)) {
      if ((materialCounts[item.id] ?? 0) <= 0) {
        setToast("太初命卷已耗尽，可重置材料数量后再次体验");
        return;
      }
      if (slots.some((slot) => slot && !isMythicScroll(slot))) {
        setToast("太初命卷需独占丹炉，请先取出其他灵材");
        return;
      }
      const alreadyInFurnace = slots.some(isMythicScroll);
      if (!alreadyInFurnace) {
        const next: (GameItem | null)[] = [null, null, null];
        next[typeof targetIndex === "number" ? targetIndex : 0] = item;
        setSlots(next);
        setMythicSelections([]);
        setPendingMythicCard(null);
        mythicRevealStartedRef.current = false;
      }
      setPhase("idle");
      setMythicTab("character");
      setShowMythicCreator(true);
      setToast("太初命卷入炉，诸天命格正在展开");
      if (soundOn) playTone("reveal");
      return;
    }
    if (slots.some(isMythicScroll)) {
      setToast("太初命卷正在占据丹炉，请先完成或收起命卷");
      return;
    }
    setSlots((current) => {
      const selectedQuantity = current.filter((slot) => slot?.id === item.id).length;
      if ((materialCounts[item.id] ?? 0) <= selectedQuantity) {
        setToast(`${item.name}库存不足`);
        return current;
      }
      const index = typeof targetIndex === "number" && !current[targetIndex] ? targetIndex : current.findIndex((slot) => slot === null);
      if (index < 0) {
        setToast("丹炉已满，请先取出一味灵材");
        return current;
      }
      const next = [...current];
      next[index] = item;
      if (isFatedFlower(item)) {
        setStarArrivalPulse(false);
        window.requestAnimationFrame(() => setStarArrivalPulse(true));
        window.setTimeout(() => setStarArrivalPulse(false), 2800);
        setToast("星命神花入炉，命雾正在炉外聚拢");
      } else if (item.character) {
        setToast(`${item.name}留下${item.character.name}的缘息，需星命神花方可引契`);
      }
      if (soundOn) playTone("drop");
      window.setTimeout(() => setPhase(next.filter(Boolean).length >= 2 ? "ready" : "idle"), 0);
      return next;
    });
  }

  function removeIngredient(index: number) {
    if (phase === "brewing" || phase === "done") return;
    setSlots((current) => {
      if (isMythicScroll(current[index])) {
        setMythicSelections([]);
        setPendingMythicCard(null);
        mythicRevealStartedRef.current = false;
      }
      const next = [...current];
      next[index] = null;
      window.setTimeout(() => setPhase(next.filter(Boolean).length >= 2 ? "ready" : "idle"), 0);
      return next;
    });
  }

  function onDrop(event: DragEvent<HTMLButtonElement>, index: number) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/ingredient");
    const item = MATERIALS.find((ingredient) => ingredient.id === id);
    if (item) addIngredient(item, index);
  }

  function beginPointerDrag(event: ReactPointerEvent<HTMLButtonElement>, item: GameItem) {
    if (event.button !== 0 || phase === "brewing" || phase === "done") return;
    pointerDragRef.current = { item, startX: event.clientX, startY: event.clientY, pointerId: event.pointerId, moved: false };
    let cleanup = () => {};
    const move = (nativeEvent: PointerEvent) => {
      const current = pointerDragRef.current;
      if (!current || current.pointerId !== nativeEvent.pointerId) return;
      const distance = Math.hypot(nativeEvent.clientX - current.startX, nativeEvent.clientY - current.startY);
      if (distance > 7) current.moved = true;
      if (!current.moved) return;
      nativeEvent.preventDefault();
      setDragging({ item: current.item, x: nativeEvent.clientX, y: nativeEvent.clientY });
    };
    const finish = (nativeEvent: PointerEvent) => {
      const current = pointerDragRef.current;
      if (current?.moved) {
        const target = document.elementFromPoint(nativeEvent.clientX, nativeEvent.clientY)?.closest<HTMLElement>("[data-slot-index]");
        const slotIndex = target?.dataset.slotIndex;
        if (slotIndex !== undefined) addIngredient(current.item, Number(slotIndex));
        else setToast("灵材需放入丹炉材料槽");
        suppressClickUntilRef.current = Date.now() + 180;
      }
      cleanup();
    };
    cleanup = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", cleanup);
      pointerDragRef.current = null;
      setDragging(null);
    };
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", cleanup);
  }

  function quickRecipe() {
    if (phase === "brewing" || phase === "done") return;
    const recipe = [MATERIALS[0], MATERIALS[1], MATERIALS[24]];
    if (recipe.some((item) => (materialCounts[item.id] ?? 0) < 1)) {
      setToast("赤霄丹方所需灵材库存不足");
      return;
    }
    setSlots(recipe);
    setResultItem(selectAlchemyResult(recipe, recipeRules));
    setPhase("ready");
    setToast("已按《赤霄丹方》配齐灵材");
    if (soundOn) playTone("drop");
  }

  function primaryAction() {
    if (phase === "done") {
      if (hasMythicScroll) return;
      if (openingFlash) return;
      if (soundOn) playTone("reveal");
      if (hasFatedFlower) {
        setOpeningFlash(true);
        window.setTimeout(() => {
          setOpeningFlash(false);
          if (pendingCharacterRef.current) {
            setCharacterCardFromCodex(false);
            setCharacterCard(pendingCharacterRef.current);
          }
        }, 780);
      } else {
        setShowResult(true);
      }
      return;
    }
    if (!canBrew) {
      setToast(unifiedState.shared.stamina <= 0 ? "当前时段体力已耗尽，请先返回主世界推进时辰" : !hasEnoughStock ? "所选灵材库存不足，请更换材料或重置数量" : hasMythicScroll ? "请先在太初命卷中封存一位人物" : filled === 0 ? "请先选择两味灵材" : "还需一味主材");
      return;
    }
    applyEffects([{ type: "spend_stamina", amount: 1 }]);
    if (hasMythicScroll) {
      const rareOptions = selectedMythicOptions.filter((option) => option.tier === "rare");
      if (rareOptions.some((option) => (mythicRareUses[option.id] ?? MYTHIC_RARE_MAX_USES) <= 0)) {
        setToast("所选稀有词条的命数已经耗尽，请重新展开命卷");
        return;
      }
      const card = { id: `mythic-card-${Date.now()}`, createdAt: Date.now(), optionIds: [...mythicSelections] };
      setPendingMythicCard(card);
      mythicRevealStartedRef.current = false;
      setMaterialCounts((current) => ({ ...current, [MYTHIC_MATERIAL.id]: Math.max(0, (current[MYTHIC_MATERIAL.id] ?? 0) - 1) }));
      setMythicRareUses((current) => {
        const next = { ...current };
        rareOptions.forEach((option) => { next[option.id] = Math.max(0, (next[option.id] ?? MYTHIC_RARE_MAX_USES) - 1); });
        return next;
      });
      setTimeLeft(10);
      setPhase("brewing");
      setToast("太初命火已起，十息之后方见人物真容……");
      if (soundOn) playTone("ignite");
      return;
    }
    setResultItem(selectAlchemyResult(slots, recipeRules));
    setResultMutation(rollMutation().id);
    setMaterialCounts((current) => {
      const next = { ...current };
      slots.forEach((item) => { if (item) next[item.id] = Math.max(0, (next[item.id] ?? 0) - 1); });
      return next;
    });
    brewSerialRef.current += 1;
    pendingCharacterRef.current = selectCharacterOutcome(slots, brewSerialRef.current);
    setTimeLeft(brewDuration);
    setPhase("brewing");
    setToast(hasFatedFlower ? "命星入火，十息之后方见契主……" : "玄火已起，正在炼化灵材……");
    if (soundOn) playTone("ignite");
  }

  function resetBrew() {
    setShowResult(false);
    setPhase("ready");
    setTimeLeft(brewDuration);
    setToast("丹方已保留，可再炼一炉");
  }

  function collectResult() {
    const key = productStackKey(resultItem.id, resultMutation);
    setProductStacks((current) => ({ ...current, [key]: { productId: resultItem.id, mutation: resultMutation, count: (current[key]?.count ?? 0) + 1 } }));
    applyEffects([{ type: "add_item", item: { itemId: resultItem.id, itemType: resultItem.category === "丹药" ? "pill" : "treasure", rarity: Math.max(1, Math.min(7, resultItem.rarity)) as UnifiedRarity, amount: 1, sourceTags: ["alchemy", resultMutation] } }]);
    setShowResult(false);
    setSlots([null, null, null]);
    setPhase("idle");
    setTimeLeft(8);
    pendingCharacterRef.current = null;
    setToast(`${mutationDisplayName(resultItem, resultMutation)} 已收入成品库`);
  }

  function collectCharacter() {
    if (!characterCard) return;
    if (characterCardFromCodex) {
      setCharacterCard(null);
      setCharacterCardFromCodex(false);
      setShowMythicCodex(true);
      return;
    }
    const acquired = characterCard.title;
    const record: FatedCharacterCardRecord = {
      id: `fated-card-${Date.now()}`,
      createdAt: Date.now(),
      origin: "fated",
      profileId: characterCard.id,
      image: characterCard.image,
      chance: characterCard.chance,
      targeted: characterCard.targeted,
    };
    setCharacterCards((current) => [...current, record]);
    const profile = CHARACTER_PROFILES.find((item) => item.id === record.profileId);
    const unifiedCard: UnifiedCardInstance = { id: record.id, characterId: record.profileId, name: `${profile?.title ?? "命定"}·${profile?.name ?? "人物卡"}`, rarity: 6, mode: characterCards.length % 2 === 0 ? "active" : "passive", source: "alchemy", art: record.image, activeEffect: "sword", bonuses: { damage: .035, health: 35 }, alchemyRecord: record };
    applyEffects([{ type: "add_card", card: unifiedCard }]);
    setCharacterCard(null);
    setSlots([null, null, null]);
    setPhase("idle");
    setTimeLeft(8);
    pendingCharacterRef.current = null;
    setToast(`${acquired}灵契人物卡已收入太虚名册`);
  }

  function resetMaterialCounts() {
    if (phase === "brewing" || phase === "done") {
      setToast("本炉尚未结束，暂不可重置库存");
      return;
    }
    setMaterialCounts(Object.fromEntries(MATERIALS.map((item) => [item.id, item.count])));
    setToast("全部材料数量已恢复为初始库存");
  }

  function closeMythicCreator() {
    setShowMythicCreator(false);
    setSlots((current) => current.map((slot) => isMythicScroll(slot) ? null : slot));
    setPhase("idle");
    setToast("太初命卷已收回，未消耗任何次数");
  }

  function toggleMythicOption(optionId: string) {
    const option = MYTHIC_CARD_OPTIONS.find((candidate) => candidate.id === optionId);
    if (!option || !option.unlocked) return;
    const alreadySelected = mythicSelections.includes(optionId);
    if (!alreadySelected && option.tier === "rare" && (mythicRareUses[option.id] ?? MYTHIC_RARE_MAX_USES) <= 0) {
      setToast(`${option.label}的稀有命数已耗尽`);
      return;
    }
    if (alreadySelected) {
      setMythicSelections((current) => current.filter((id) => id !== optionId));
      return;
    }
    if (option.page === "character") {
      const hasCharacter = mythicSelections.some((id) => MYTHIC_CARD_OPTIONS.find((candidate) => candidate.id === id)?.page === "character");
      if (!hasCharacter && mythicSelections.length >= MYTHIC_MAX_OPTIONS) {
        setToast(`一张高级人物卡最多铭刻 ${MYTHIC_MAX_OPTIONS} 个词条`);
        return;
      }
      setMythicSelections((current) => [...current.filter((id) => MYTHIC_CARD_OPTIONS.find((candidate) => candidate.id === id)?.page !== "character"), optionId]);
      return;
    }
    if (mythicSelections.length >= MYTHIC_MAX_OPTIONS) {
      setToast(`一张高级人物卡最多铭刻 ${MYTHIC_MAX_OPTIONS} 个词条`);
      return;
    }
    setMythicSelections((current) => [...current, optionId]);
  }

  function prepareMythicBrew() {
    if (!selectedMythicCharacter || !selectedMythicProfile) {
      setMythicTab("character");
      setToast("请先选择一位命定人物");
      return;
    }
    const rareOptions = selectedMythicOptions.filter((option) => option.tier === "rare");
    if (rareOptions.some((option) => (mythicRareUses[option.id] ?? MYTHIC_RARE_MAX_USES) <= 0)) {
      setToast("所选稀有词条的命数已经耗尽");
      return;
    }
    setShowMythicCreator(false);
    setPhase("ready");
    setTimeLeft(10);
    setToast("命格已封入卷中，人物真容将在十息炼制后揭晓");
    if (soundOn) playTone("drop");
  }

  function collectMythicCard() {
    if (mythicRevealFromCodex) {
      setRevealedMythicCard(null);
      setMythicRevealFromCodex(false);
      setShowMythicCodex(true);
      return;
    }
    const profile = revealedMythicProfile;
    if (revealedMythicCard) {
      const unifiedCard: UnifiedCardInstance = { id: revealedMythicCard.id, characterId: revealedMythicCharacter?.characterId ?? "taichu", name: profile ? `太初·${profile.name}` : "太初人物卡", rarity: 7, mode: characterCards.length % 2 === 0 ? "active" : "passive", source: "alchemy", art: profile?.images[0] ?? "/assets/mythic-scroll-backdrop.webp", activeEffect: "ward", bonuses: { damage: .08, health: 80, defense: 20 }, alchemyRecord: revealedMythicCard };
      applyEffects([{ type: "add_card", card: unifiedCard }]);
    }
    setRevealedMythicCard(null);
    setPendingMythicCard(null);
    setSlots([null, null, null]);
    setMythicSelections([]);
    setPhase("idle");
    setTimeLeft(8);
    mythicRevealStartedRef.current = false;
    setToast(`${profile ? `太初·${profile.name}` : "太初人物卡"}已收入太虚名册`);
  }

  function buyMarketItem(offerId: string) {
    const offer = marketOffers.find((candidate) => candidate.id === offerId);
    const item = offer && MATERIALS.find((candidate) => candidate.id === offer.itemId);
    if (!offer || !item || offer.sold) return;
    const price = getMarketPrice(item);
    if (gold < price) {
      setToast(`金币不足，还需 ${(price - gold).toLocaleString()} 金币`);
      return;
    }
    setGold((current) => current - price);
    setMaterialCounts((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 }));
    setMarketOffers((current) => {
      const next = current.map((candidate) => candidate.id === offerId ? { ...candidate, sold: true } : candidate);
      if (next.every((candidate) => candidate.sold)) setSoldOutRefreshAt(Date.now() + SOLD_OUT_REFRESH_MS);
      return next;
    });
    setToast(`${item.name} ×1 已收入乾坤灵囊`);
    if (soundOn) playTone("drop");
  }

  function refreshMarketManually() {
    const price = getManualRefreshPrice(manualRefreshCount);
    if (gold < price) {
      setToast(`金币不足，刷新需要 ${price.toLocaleString()} 金币`);
      return;
    }
    if (price > 0) setGold((current) => current - price);
    setMarketOffers(rollMarketOffers(MATERIALS));
    setManualRefreshCount((current) => current + 1);
    setRefreshResetAt(Date.now() + MARKET_RESET_MS);
    setSoldOutRefreshAt(0);
    setToast(price === 0 ? "免费刷新完成，云商已换上新货" : `消耗 ${price.toLocaleString()} 金币刷新集市`);
  }

  function deliverCommission(commission: DailyCommission) {
    let reward = commission.reward;
    if (commission.kind === "specific") {
      const item = ITEM_TABLE.find((candidate) => candidate.id === commission.itemId);
      if (!item) return;
      if (item.itemType === "material") {
        if ((materialCounts[item.id] ?? 0) < commission.quantity) { setToast(`${item.name}数量不足`); return; }
        setMaterialCounts((current) => ({ ...current, [item.id]: current[item.id] - commission.quantity }));
      } else {
        const candidates = productStackList.filter(({ item: product }) => product.id === item.id).sort((a, b) => getMutationValue(a.item, a.stack.mutation) - getMutationValue(b.item, b.stack.mutation));
        if (candidates.reduce((sum, entry) => sum + entry.stack.count, 0) < commission.quantity) { setToast(`${item.name}数量不足`); return; }
        consumeProductStacks(candidates, commission.quantity);
      }
    } else {
      const selectedKeys = fuzzySelections[commission.id] ?? [];
      if (selectedKeys.length !== commission.quantity) { setToast(`请先装满 ${commission.quantity} 个委托物品框`); return; }
      const selectedEntries = selectedKeys.map((key) => productStackList.find(({ stack }) => productStackKey(stack.productId, stack.mutation) === key));
      if (selectedEntries.some((entry) => !entry || !matchesFuzzyCommission(entry.item, commission))) { setToast("装填物已失效，请重新选择"); return; }
      const requiredByStack = selectedKeys.reduce<Record<string, number>>((counts, key) => ({ ...counts, [key]: (counts[key] ?? 0) + 1 }), {});
      if (Object.entries(requiredByStack).some(([key, count]) => (productStacks[key]?.count ?? 0) < count)) { setToast("成品库存发生变化，请重新配货"); return; }
      reward = commission.pricingMode === "dynamic"
        ? Math.round(selectedEntries.reduce((sum, entry) => sum + (entry ? getMutationValue(entry.item, entry.stack.mutation) : 0), 0) * 1.5)
        : commission.reward;
      consumeSelectedProductKeys(selectedKeys);
      setFuzzySelections((current) => {
        const next = { ...current };
        delete next[commission.id];
        return next;
      });
    }
    setGold((current) => current + reward);
    setCommissions((current) => current.filter((entry) => entry.id !== commission.id));
    setPickerCommissionId(null);
    setToast(`委托交付完成，获得 ${reward.toLocaleString()} 金币`);
  }

  function consumeProductStacks(candidates: { stack: ProductStack; item: GameItem }[], quantity: number) {
    let remainingToRemove = quantity;
    const removedByProduct: Record<string, number> = {};
    candidates.forEach(({ stack }) => {
      if (remainingToRemove <= 0) return;
      const used = Math.min(remainingToRemove, stack.count);
      removedByProduct[stack.productId] = (removedByProduct[stack.productId] ?? 0) + used;
      remainingToRemove -= used;
    });
    applyEffects(Object.entries(removedByProduct).map(([itemId, amount]) => ({ type: "remove_item" as const, itemId, amount })));
    setProductStacks((current) => {
      const next = { ...current };
      let remaining = quantity;
      candidates.forEach(({ stack }) => {
        if (remaining <= 0) return;
        const key = productStackKey(stack.productId, stack.mutation);
        const used = Math.min(remaining, next[key]?.count ?? 0);
        if (used > 0) next[key] = { ...next[key], count: next[key].count - used };
        remaining -= used;
      });
      return next;
    });
  }

  function consumeSelectedProductKeys(keys: string[]) {
    const required = keys.reduce<Record<string, number>>((counts, key) => ({ ...counts, [key]: (counts[key] ?? 0) + 1 }), {});
    const removedByProduct = Object.entries(required).reduce<Record<string, number>>((counts, [key, amount]) => {
      const productId = productStacks[key]?.productId;
      if (productId) counts[productId] = (counts[productId] ?? 0) + amount;
      return counts;
    }, {});
    applyEffects(Object.entries(removedByProduct).map(([itemId, amount]) => ({ type: "remove_item" as const, itemId, amount })));
    setProductStacks((current) => {
      const next = { ...current };
      Object.entries(required).forEach(([key, count]) => {
        if (next[key]) next[key] = { ...next[key], count: Math.max(0, next[key].count - count) };
      });
      return next;
    });
  }

  function addFuzzySelection(commissionId: string, stackKey: string) {
    const commission = commissions.find((entry) => entry.id === commissionId);
    if (!commission || commission.kind !== "fuzzy") return;
    const entry = productStackList.find(({ stack }) => productStackKey(stack.productId, stack.mutation) === stackKey);
    if (!entry || !matchesFuzzyCommission(entry.item, commission)) return;
    setFuzzySelections((current) => {
      const selected = current[commissionId] ?? [];
      const used = selected.filter((key) => key === stackKey).length;
      if (selected.length >= commission.quantity || used >= entry.stack.count) return current;
      const next = { ...current, [commissionId]: [...selected, stackKey] };
      if (next[commissionId].length >= commission.quantity) window.setTimeout(() => setPickerCommissionId(null), 0);
      return next;
    });
  }

  function removeFuzzySelection(commissionId: string, slotIndex: number) {
    setFuzzySelections((current) => ({ ...current, [commissionId]: (current[commissionId] ?? []).filter((_, index) => index !== slotIndex) }));
  }

  function fuzzySelectedEntries(commissionId: string) {
    return (fuzzySelections[commissionId] ?? []).map((key) => productStackList.find(({ stack }) => productStackKey(stack.productId, stack.mutation) === key)).filter((entry): entry is { stack: ProductStack; item: GameItem } => Boolean(entry));
  }

  function fuzzyCommissionReward(commission: Extract<DailyCommission, { kind: "fuzzy" }>) {
    if (commission.pricingMode === "fixed") return commission.reward;
    return Math.round(fuzzySelectedEntries(commission.id).reduce((sum, entry) => sum + getMutationValue(entry.item, entry.stack.mutation), 0) * 1.5);
  }

  function commissionStock(commission: DailyCommission) {
    if (commission.kind === "specific") {
      const item = ITEM_TABLE.find((candidate) => candidate.id === commission.itemId);
      if (!item) return 0;
      return item.itemType === "material" ? materialCounts[item.id] ?? 0 : productStackList.filter(({ item: product }) => product.id === item.id).reduce((sum, entry) => sum + entry.stack.count, 0);
    }
    return (fuzzySelections[commission.id] ?? []).length;
  }

  function openNpcDialogue(npc: CommissionNpc) {
    setActiveCommissionNpc(npc);
    setNpcDialogueStep(0);
    if (soundOn) playTone("drop");
  }

  function advanceNpcDialogue() {
    if (!activeCommissionNpc) return;
    if (npcDialogueStep < activeCommissionNpc.dialogue.length - 1) {
      setNpcDialogueStep((step) => step + 1);
      return;
    }
    setActiveCommissionNpc(null);
    setShowMarket(true);
    setMarketTab("commissions");
  }

  function exportCodex() {
    const header = ["编号", "名称", "物品类型", "可作为材料", "系列", "分类", "属性", "特性", "品质", "稀有度", "价格", "人物", "人物关系", "缘契权重", "效果", "来源"];
    const rows = ITEM_TABLE.map((item) => [item.index, item.name, item.itemType === "material" ? "材料" : "成品", item.canBeIngredient ? "是" : "否", item.group ?? "未分组", item.category, item.attribute, item.trait, item.quality, item.rarity, item.price, item.character?.name ?? "", item.character?.relation ?? "", item.character?.affinity ?? 0, item.effect, item.source ?? "本体"]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `玄火丹炉-${ITEM_TABLE.length}项属性表.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setToast("完整属性表已导出");
  }

  const buttonLabel = phase === "brewing"
    ? `${hasMythicScroll ? "太初命刻" : "凝丹中"} 00:${String(timeLeft).padStart(2, "0")}`
    : phase === "done"
      ? hasMythicScroll ? "真 容 显 化 中" : "开 炉"
      : hasMythicScroll
        ? mythicBrewConfigured ? "太初炼制 · 十息" : "请先封存人物命格"
        : filled >= 2 ? !hasEnoughStock ? "灵材库存不足" : hasFatedFlower ? "命星炼制 · 十息" : "开始炼制" : filled === 1 ? "还需一味主材" : "请选择灵材";
  const quickItems = [MATERIALS[0], MATERIALS[1], MATERIALS[24]];

  return (
    <main className={`game-shell phase-${phase} ${hasFatedFlower ? "has-fated-flower" : ""} ${hasMythicScroll ? "has-mythic-scroll" : ""} ${starArrivalPulse ? "star-arrival" : ""}`}>
      <div className="backdrop" aria-hidden="true" />
      <div className="mist mist-one" aria-hidden="true" />
      <div className="mist mist-two" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <header className="topbar">
        <button className="round-button" aria-label="返回主界面">返</button>
        <div className="title-lockup">
          <span className="eyebrow">太虚仙府 · 炼丹房</span>
          <h1>玄火丹炉</h1>
          <span className="seal">丹</span>
        </div>
        <div className="top-actions">
          <button className="mythic-codex-entry" onClick={() => setShowMythicCodex(true)} aria-label={`打开太虚名册，共 ${characterCards.length} 张人物卡`}><span>册</span><strong>太虚名册</strong><b>{characterCards.length}</b></button>
          <div className="gold-balance" aria-label={`持有金币 ${gold}`}><span>◉</span>{gold.toLocaleString()}</div>
          <button className="text-button market-entry-button" onClick={() => setShowMarket(true)}><span>市</span> 云游集市</button>
          <a className="text-button im-entry-button" href="/item-manager"><span>▦</span> IM 配方司 <b>v{recipeVersion}</b></a>
          <button className="text-button" onClick={() => setShowCodex(true)}><span>◈</span> 万物图鉴 <b>{ITEM_TABLE.length}/{ITEM_TABLE.length}</b></button>
          <button className="sound-button" onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "关闭声效" : "开启声效"}>{soundOn ? "♪" : "×"}</button>
        </div>
      </header>

      <section className="alchemy-stage" aria-label="炼丹操作区">
        <aside className="omen-panel glass-panel">
          <span className="panel-kicker">天 机 丹 象</span>
          <h2>{omen.title}</h2>
          <div className="omen-divider"><i /><span>◆</span><i /></div>
          <p className="result-label">可能炼成</p>
          <p className="result-name">{omen.result}</p>
          <div className="omen-stats">
            <div><span>成丹率</span><strong>{omen.chance}</strong></div>
            <div><span>品质预估</span><strong>{omen.quality}</strong></div>
          </div>
          <p className="omen-note">※ 五行相生可提升灵变概率</p>
        </aside>

        <div className="furnace-zone">
          <div className="slot-row" aria-label="炼丹材料槽">
            {slots.map((slot, index) => (
              <button
                key={index}
                className={`material-slot ${slot ? "filled" : ""} ${index === 2 ? "auxiliary" : ""}`}
                data-slot-index={index}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDrop(event, index)}
                onClick={() => slot && removeIngredient(index)}
                aria-label={slot ? `取出${slot.name}` : index === 2 ? "添加辅材" : "添加主材"}
              >
                <span className="slot-orbit" />
                {slot ? <img src={slot.image} alt={slot.name} /> : <span className="slot-plus">+</span>}
                <small>{slot ? slot.name : index === 2 ? "辅材" : `主材 ${index + 1}`}</small>
                {slot && <em style={{ color: slot.color }}>{slot.element}</em>}
              </button>
            ))}
          </div>

          <div className="energy-ring ring-outer" aria-hidden="true" />
          <div className="energy-ring ring-inner" aria-hidden="true" />
          {hasFatedFlower && <div className="fated-orbit" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>}
          {hasFatedFlower && <div className="fated-mist" aria-hidden="true"><i /><i /><i /></div>}
          {dominantCharacter && phase !== "brewing" && phase !== "done" && (
            <div className="character-phantom" aria-hidden="true">
              <img src={dominantCharacter.profile.images[0]} alt="" />
              <span>{dominantCharacter.profile.title} · 缘影</span>
            </div>
          )}
          <div className="furnace-glow" aria-hidden="true" />
          <div className="fire-core" aria-hidden="true"><i /><i /><i /></div>
          <div className="furnace-wrap">
            <img className="furnace-image" src="/assets/xuanhuo-furnace.webp" alt="青铜玄火丹炉" />
            <div className="rune-pulse" aria-hidden="true" />
            {Array.from({ length: 14 }).map((_, index) => <span key={index} className={`spark spark-${index + 1}`} aria-hidden="true" />)}
          </div>

          <div className="brew-controls">
            <div className="progress-track" aria-label={`炼制进度 ${Math.round(progress)}%`}><span style={{ width: phase === "done" ? "100%" : `${progress}%` }} /></div>
            <button className={`brew-button ${phase === "done" ? "complete" : ""}`} onClick={primaryAction} disabled={phase === "brewing"}>
              <span className="button-corner corner-left" /><span>{buttonLabel}</span><span className="button-corner corner-right" />
            </button>
            <p>{phase === "brewing" ? "文火凝丹，切勿心急" : phase === "done" ? "丹光已成，点击开炉" : "拖入灵材，或点击物品自动添加"}</p>
          </div>
        </div>

        <aside className="recipe-panel glass-panel">
          <div className="recipe-heading">
            <div><span className="panel-kicker">已悟丹方</span><h2>赤霄丹方</h2></div>
            <span className="recipe-rank">地阶</span>
          </div>
          <div className="mini-recipe">
            {quickItems.map((item) => <div key={item.id}><img src={item.image} alt="" /><span style={{ color: item.color }}>{item.element}</span></div>)}
          </div>
          <p>赤炎为骨，月华为引，可聚天地灵息于一丸。</p>
          <button className="recipe-button" onClick={quickRecipe}>一键配伍</button>
          <div className="daily-luck"><span>今日炉运</span><strong>灵变 +12%</strong></div>
          <small className="recipe-version">配方司已同步 · v{recipeVersion}</small>
        </aside>
      </section>

      <section className="commission-npc-dock" aria-label="仙门委托来客">
        <header>
          <div><span>仙 门 来 客</span><h2>有人携委托登门</h2></div>
          <p>点击人物交谈，听取委托后前往收购榜</p>
          <button onClick={() => { setShowMarket(true); setMarketTab("commissions"); }}>直入委托榜 <b>{commissions.length}</b></button>
        </header>
        <div className="commission-npc-list">
          {COMMISSION_NPCS.map((npc, index) => (
            <button key={npc.id} className={`commission-npc-card npc-element-${npc.element}`} style={{ "--npc-delay": `${index * -0.7}s` } as CSSProperties} onClick={() => openNpcDialogue(npc)}>
              <span className="npc-portrait"><img src={npc.portrait} alt={npc.name} /><i /></span>
              <span className="npc-identity"><small>{npc.organization}</small><strong>{npc.name}</strong><em>{npc.title}</em></span>
              <span className="npc-whisper">“{npc.greeting}”</span>
              <span className="npc-talk-mark">访</span>
            </button>
          ))}
        </div>
      </section>

      <section className="inventory-panel" aria-label="灵材物品栏">
        <div className="inventory-head">
          <div className="inventory-title"><span className="bag-mark">囊</span><div><h2>乾坤灵囊</h2><p>材料 {MATERIALS.length} 种 · 成品不可入炉</p></div><button className="reset-count-button" onClick={resetMaterialCounts}>重置数量</button></div>
          <div className="filters" role="tablist" aria-label="物品分类">
            {FILTERS.map((name) => <button key={name} role="tab" aria-selected={filter === name} className={filter === name ? "active" : ""} onClick={() => setFilter(name)}>{name}</button>)}
          </div>
          <div className="inventory-selectors">
            <select value={qualityFilter} onChange={(event) => setQualityFilter(event.target.value)} aria-label="按品质筛选">{QUALITY_FILTERS.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={elementFilter} onChange={(event) => setElementFilter(event.target.value)} aria-label="按属性筛选">{ELEMENT_FILTERS.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={characterFilter} onChange={(event) => setCharacterFilter(event.target.value)} aria-label="按人物筛选">
              <option value="全部人物">全部人物</option>
              {CHARACTER_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.title}</option>)}
            </select>
            <select value={seriesFilter} onChange={(event) => setSeriesFilter(event.target.value)} aria-label="素材系列">
              <option>全部系列</option>
              {MATERIAL_GROUPS.map((group) => <option key={group}>{group}</option>)}
            </select>
          </div>
        </div>
        <div className="inventory-grid">
          {pageItems.map((item) => {
            const selected = slots.some((slot) => slot?.id === item.id);
            return (
              <button
                key={item.id}
                draggable={false}
                onPointerDown={(event) => beginPointerDrag(event, item)}
                onClick={() => {
                  if (Date.now() < suppressClickUntilRef.current) return;
                  addIngredient(item);
                }}
                className={`item-card quality-${item.quality} ${selected ? "selected" : ""} ${(materialCounts[item.id] ?? 0) <= 0 ? "depleted" : ""} ${item.characterTrigger ? "rare-material" : ""} ${item.advancedCardTrigger ? "mythic-material" : ""}`}
                style={{ "--item-color": item.color } as CSSProperties}
                aria-label={`${item.name}，${item.quality}，${item.attribute}${item.character ? `，关联人物${item.character.name}` : ""}${item.characterTrigger ? "，命定稀有素材" : ""}`}
                title={`属性：${item.attribute}\n特性：${item.trait}\n价格：${item.price} 灵石${item.character ? `\n人物：${item.character.title}（缘契 +${item.character.affinity}）` : ""}`}
              >
                <span className="quality-label">{item.quality}</span>
                {item.characterTrigger && <span className="rare-mark">命 定</span>}
                {item.advancedCardTrigger && <span className="mythic-item-mark">太 初</span>}
                <span className="item-image"><img src={item.image} alt="" loading="lazy" /></span>
                <span className="item-copy"><strong>{item.name}</strong><small>{item.short}</small></span>
                <span className="element-badge">{item.element}</span>
                {item.character && <span className="character-link-mark">缘·{item.character.name}</span>}
                <span className="item-count">×{materialCounts[item.id] ?? 0}</span>
                {selected && <span className="selected-mark">入炉</span>}
              </button>
            );
          })}
          <button className="inventory-more" onClick={() => setInventoryPage((page) => (page + 1) % pageCount)} aria-label="换一批灵材">
            <span>{inventoryPage + 1}/{pageCount}</span><small>换一批</small>
          </button>
        </div>
      </section>

      {dragging && <div className="drag-ghost" style={{ left: dragging.x, top: dragging.y }} aria-hidden="true"><img src={dragging.item.image} alt="" /><span>{dragging.item.name}</span></div>}
      {toast && <div className="toast" role="status"><span>◇</span>{toast}<span>◇</span></div>}
      {openingFlash && <div className="opening-flash" aria-hidden="true"><span /><i /></div>}

      {showMythicCreator && (
        <div className="mythic-creator-overlay" role="dialog" aria-modal="true" aria-label="太初命卷高级人物卡定制">
          <div className="mythic-void" aria-hidden="true" />
          <div className="mythic-cloud cloud-a" aria-hidden="true" /><div className="mythic-cloud cloud-b" aria-hidden="true" /><div className="mythic-cloud cloud-c" aria-hidden="true" />
          <section className="mythic-scroll-panel">
            <button className="mythic-close" onClick={closeMythicCreator} aria-label="收起太初命卷">×</button>
            <header className="mythic-heading">
              <div><span>鸿 蒙 初 判 · 诸 天 命 刻</span><h2>太初命卷</h2></div>
              <p>择一命主，以衣、势、境共铸神话人物卡</p>
              <div className="mythic-counter"><small>太初铭刻</small><strong>{mythicCardCount}</strong><span>卷</span></div>
            </header>

            <div className={`mythic-preview is-sealed ${selectedMythicProfile ? "has-character" : ""}`}>
              <div className="mythic-preview-rings" aria-hidden="true"><i /><i /><i /></div>
              <div className="mythic-character-stage">
                <div className={`mythic-sealed-figure ${selectedMythicProfile ? "is-bound" : ""}`} aria-label={selectedMythicProfile ? "人物命格已封存，真容尚未揭晓" : "尚未选择人物"}><i /><strong>{selectedMythicProfile ? "命" : "?"}</strong><span>{selectedMythicProfile ? "真容封印" : "待择命主"}</span></div>
                <span className="mythic-scene-name">{selectedMythicScene ? "场景命纹已封存" : "混沌未定"}</span>
              </div>
              <div className="mythic-preview-copy">
                <span className="mythic-preview-kicker">MYTHIC · SEALED DESTINY</span>
                <h3>{selectedMythicProfile ? "命主已定 · 真容未显" : "无字命格"}</h3>
                <p>{selectedMythicProfile ? "人物与诸般词条已封入卷中，需经十息玄火方可照见神话真容。" : "命卷尚待一位人物落笔"}</p>
                <div className="mythic-selected-terms" aria-label="已选择的全部词条">
                  {selectedMythicOptions.map((option) => <span key={option.id} className={`term-${option.tier}`}>{option.label}<i>{mythicTierLabel(option.tier)}</i></span>)}
                  {selectedMythicOptions.length === 0 && <em>所选词条将在此显现</em>}
                </div>
              </div>
              <div className="mythic-selection-count"><strong>{mythicSelections.length}</strong><span>/{MYTHIC_MAX_OPTIONS}</span><small>命纹</small></div>
              {selectedMythicProfile && <div className="mythic-bound-seal"><span>已封</span><strong>十息后揭晓</strong></div>}
            </div>

            <div className="mythic-form">
              <nav className="mythic-tabs" aria-label="命卷词条分页">
                {MYTHIC_OPTION_PAGES.map((page) => <button key={page.id} className={mythicTab === page.id ? "active" : ""} onClick={() => setMythicTab(page.id)}><i>{page.seal}</i><span>{page.label}</span><small>{page.id === "character" ? "单选" : "多选"}</small></button>)}
              </nav>
              <div className="mythic-options" role="group" aria-label={`${MYTHIC_OPTION_PAGES.find((page) => page.id === mythicTab)?.label}词条`}>
                {visibleMythicOptions(mythicTab).map((option) => {
                  const selected = mythicSelections.includes(option.id);
                  const remaining = mythicRareUses[option.id] ?? MYTHIC_RARE_MAX_USES;
                  return <button key={option.id} className={`mythic-term term-${option.tier} ${selected ? "selected" : ""} ${option.tier === "rare" && remaining <= 0 ? "exhausted" : ""}`} onClick={() => toggleMythicOption(option.id)} disabled={option.tier === "rare" && remaining <= 0 && !selected} aria-pressed={selected}>
                    <span className="term-corner tl" /><span className="term-corner tr" /><span className="term-corner bl" /><span className="term-corner br" />
                    <small>{mythicTierLabel(option.tier)}</small><strong>{option.label}</strong><em>{option.subtitle}</em>
                    {option.tier === "rare" && <b className="rare-uses" aria-label={`剩余${remaining}次`}>{remaining}/{MYTHIC_RARE_MAX_USES}</b>}
                    {selected && <b className="term-selected">✓</b>}
                  </button>;
                })}
              </div>
              <footer className="mythic-actions">
                <div><span className="legend permanent">常驻词条</span><span className="legend unlocked">解锁词条</span><span className="legend rare">稀有解锁 · 5次</span></div>
                <p>{mythicTab === "character" ? "人物页仅可择一命主" : `本页可多选 · 全卡至多 ${MYTHIC_MAX_OPTIONS} 条`}</p>
                <button onClick={prepareMythicBrew}>封 卷 入 炉 · 炼 制 十 息</button>
              </footer>
            </div>
          </section>
        </div>
      )}

      {revealedMythicCard && revealedMythicProfile && (
        <div className="mythic-reveal-overlay" role="dialog" aria-modal="true" aria-label={`太初神话人物卡 太初·${revealedMythicProfile.name}`}>
          <div className="mythic-reveal-sky" aria-hidden="true"><i /><i /><i /></div>
          <div className="xian-cloud-curtain" aria-hidden="true"><i /><i /></div>
          <div className="xian-reveal-mist mist-back" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="mythic-reveal-cloud cloud-left" aria-hidden="true" /><div className="mythic-reveal-cloud cloud-right" aria-hidden="true" />
          <section className="mythic-reveal-card xian-card-frame xian-card-mythic">
            <div className="mythic-reveal-orbit" aria-hidden="true"><i /><i /><i /></div>
            <div className="mythic-reveal-art xian-portrait-mask"><img src={revealedMythicProfile.images[0]} alt={revealedMythicProfile.title} /><span /></div>
            <div className="mythic-reveal-copy">
              <span>太 初 命 刻 · 诸 天 唯 一</span>
              <h2>太初·{revealedMythicProfile.name}</h2>
              <p>{revealedMythicProfile.relation} · {revealedMythicProfile.trait}</p>
              <div className="mythic-reveal-scene"><small>命定场景</small><strong>{revealedMythicScene?.label ?? "太虚云海"}</strong></div>
              <div className="mythic-reveal-terms">{revealedMythicOptions.map((option) => <span key={option.id} className={`term-${option.tier}`}>{option.label}</span>)}</div>
              <button onClick={collectMythicCard}>{mythicRevealFromCodex ? "返 回 太 虚 名 册" : "收 入 太 虚 名 册"}</button>
            </div>
            <div className="mythic-reveal-title"><small>TAICHU MYTHIC · PRIME ORIGIN</small><strong>太 初 神 话</strong></div>
            {Array.from({ length: 16 }).map((_, index) => <i key={index} className={`mythic-reveal-particle particle-${(index % 12) + 1}`} aria-hidden="true" />)}
          </section>
          <div className="xian-reveal-mist mist-front" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        </div>
      )}

      {showMythicCodex && (
        <div className="mythic-codex-overlay" role="dialog" aria-modal="true" aria-label="太虚名册人物卡背包">
          <section className="mythic-codex-window">
            <header><div><span>诸 天 命 轨 · 灵 契 归 藏</span><h2>太虚名册</h2><p>共 {characterCards.length} 张人物卡 · <b>灵契 {fatedCardCount}</b> · <em>太初 {mythicCardCount}</em></p></div><button onClick={() => setShowMythicCodex(false)} aria-label="关闭太虚名册">×</button></header>
            <div className="mythic-codex-grid">
              {characterCards.map((card, index) => {
                if (!isMythicCardRecord(card)) {
                  const profile = CHARACTER_PROFILES.find((candidate) => candidate.id === card.profileId);
                  if (!profile) return null;
                  return <button key={card.id} className="mythic-codex-card codex-card-fated" onClick={() => {
                    setShowMythicCodex(false);
                    setCharacterCardFromCodex(true);
                    setCharacterCard({ ...profile, image: card.image, chance: card.chance, targeted: card.targeted });
                  }}>
                    <span className="codex-card-index">灵契 {String(index + 1).padStart(2, "0")}<b>星命神花</b></span>
                    <span className="codex-card-art xian-portrait-mask"><img src={card.image} alt={profile.title} /><i /></span>
                    <strong>灵契·{profile.name}</strong><small>{profile.relation} · {profile.trait}</small>
                    <em>查看灵契</em>
                  </button>;
                }
                const options = MYTHIC_CARD_OPTIONS.filter((option) => card.optionIds.includes(option.id));
                const character = options.find((option) => option.page === "character");
                const profile = CHARACTER_PROFILES.find((candidate) => candidate.id === character?.characterId);
                const scene = options.find((option) => option.page === "scene");
                if (!profile) return null;
                return <button key={card.id} className="mythic-codex-card codex-card-mythic" onClick={() => { setShowMythicCodex(false); setMythicRevealFromCodex(true); setRevealedMythicCard(card); }}>
                  <span className="codex-card-index">太初 {String(index + 1).padStart(2, "0")}<b>至高神话</b></span>
                  <span className="codex-card-art xian-portrait-mask"><img src={profile.images[0]} alt={profile.title} /><i /></span>
                  <strong>太初·{profile.name}</strong><small>{scene?.label ?? "太虚云海"} · {options.length} 道命纹</small>
                  <em>展开太初命相</em>
                </button>;
              })}
              {characterCards.length === 0 && <div className="mythic-codex-empty"><img src={MYTHIC_MATERIAL.image} alt="太初命卷" /><strong>名册尚空</strong><p>星命神花可唤来灵契卡；太初命卷可铭刻更高阶的太初神话卡。</p></div>}
            </div>
          </section>
        </div>
      )}

      {activeCommissionNpc && (
        <div className="npc-dialogue-overlay" role="dialog" aria-modal="true" aria-label={`与${activeCommissionNpc.name}交谈`}>
          <button className="npc-dialogue-backdrop" onClick={() => setActiveCommissionNpc(null)} aria-label="结束交谈" />
          <div className={`npc-dialogue-card npc-element-${activeCommissionNpc.element}`}>
            <div className="npc-dialogue-portrait"><img src={activeCommissionNpc.portrait} alt={activeCommissionNpc.name} /><span /></div>
            <div className="npc-dialogue-copy">
              <small>{activeCommissionNpc.organization} · {activeCommissionNpc.title}</small>
              <h2>{activeCommissionNpc.name}</h2>
              <p>“{activeCommissionNpc.dialogue[npcDialogueStep]}”</p>
              <div className="npc-dialogue-progress">{activeCommissionNpc.dialogue.map((_, index) => <i key={index} className={index <= npcDialogueStep ? "active" : ""} />)}</div>
              <button onClick={advanceNpcDialogue}>{npcDialogueStep < activeCommissionNpc.dialogue.length - 1 ? "继 续" : "查 看 委 托"}</button>
            </div>
          </div>
        </div>
      )}

      {showMarket && (
        <div className="market-overlay" role="dialog" aria-modal="true" aria-label="云游集市">
          <div className="market-window">
            <header className="market-heading">
              <div><span>浮 云 有 市 · 奇 珍 自 来</span><h2>云游集市</h2><p>每轮六件灵材，售罄后十息自动补货</p></div>
              <div className="market-wallet"><small>持有金币</small><strong><i>◉</i>{gold.toLocaleString()}</strong></div>
              <button className="market-close" onClick={() => setShowMarket(false)} aria-label="关闭集市">×</button>
            </header>
            <div className="market-odds" aria-label="品质出现概率">
              {marketTab === "goods" ? (Object.entries(MARKET_QUALITY_WEIGHTS) as [string, number][]).map(([quality, weight]) => <span key={quality} className={`quality-text quality-${quality}`}><i />{quality} {weight}%</span>) : <><span>指定委托 5 条</span><span>模糊委托 2 条</span><span>低品质需求更常见</span><span>收购价高于市价</span></>}
            </div>
            <nav className="market-tabs" aria-label="集市功能"><button className={marketTab === "goods" ? "active" : ""} onClick={() => setMarketTab("goods")}>灵材摊位</button><button className={marketTab === "commissions" ? "active" : ""} onClick={() => setMarketTab("commissions")}>仙门委托 <b>{commissions.length}</b></button></nav>
            {marketTab === "goods" ? <>
              <div className="market-grid">
                {marketItems.map(({ offer, item }, index) => (
                  <article key={offer.id} className={`market-card quality-${item.quality} ${offer.sold ? "sold" : ""}`} style={{ "--item-color": item.color } as CSSProperties}>
                    <span className="market-stock">货位 {String(index + 1).padStart(2, "0")}</span>
                    <span className="market-quality">{item.quality}</span>
                    <div className="market-item-art"><img src={item.image} alt="" /></div>
                    <div className="market-item-copy"><strong>{item.name}</strong><small>{item.attribute} · {item.trait}</small></div>
                    <div className="market-price"><span><i>◉</i>{getMarketPrice(item).toLocaleString()}</span><button onClick={() => buyMarketItem(offer.id)} disabled={offer.sold}>{offer.sold ? "已售罄" : "购 入"}</button></div>
                    {offer.sold && <div className="sold-seal">售罄</div>}
                  </article>
                ))}
                {!marketReady && <div className="market-loading">云商正在布置货架……</div>}
              </div>
              <footer className="market-footer">
                <div className="market-rule-copy"><strong>{marketSoldOut ? `全场售罄 · ${formatCountdown(soldOutRemaining)} 后自动补货` : "货品一经购入，将直接进入乾坤灵囊"}</strong><small>{manualRefreshCount > 0 ? `${formatCountdown(manualResetRemaining)} 后刷新费用恢复免费` : "当前拥有一次免费刷新机会"}</small></div>
                <button className="market-refresh" onClick={refreshMarketManually} disabled={!marketReady}><span>↻</span><b>刷新货架</b><small>{manualRefreshPrice === 0 ? "本次免费" : `${manualRefreshPrice.toLocaleString()} 金币`}</small></button>
              </footer>
            </> : <>
              <div className="commission-workspace">
                <section className="commission-list" aria-label="仙门售卖委托">
                  {commissions.map((commission, index) => {
                    const item = commission.kind === "specific" ? ITEM_TABLE.find((candidate) => candidate.id === commission.itemId) : null;
                    const stock = commissionStock(commission);
                    const name = commission.kind === "specific" ? item?.name ?? "未知货品" : commission.title;
                    const selectedEntries = commission.kind === "fuzzy" ? fuzzySelectedEntries(commission.id) : [];
                    const reward = commission.kind === "fuzzy" ? fuzzyCommissionReward(commission) : commission.reward;
                    return <article key={commission.id} className={`commission-card ${commission.kind}`}>
                      <span className="commission-index">{String(index + 1).padStart(2, "0")}</span>
                      <div className="commission-icon">{item ? <img src={item.image} alt="" /> : <span>{commission.kind === "fuzzy" && commission.requirement === "element" ? commission.element : "品"}</span>}</div>
                      <div className="commission-copy"><small>{commission.kind === "specific" ? `${item?.itemType === "material" ? "材料" : "丹药"}指定收购` : `模糊丹药委托 · ${commission.pricingMode === "dynamic" ? "动态价格" : "仙门定价"}`}</small><strong>{name} ×{commission.quantity}</strong><em>{commission.kind === "fuzzy" ? `已装填 ${stock}/${commission.quantity}` : `持有 ${stock}/${commission.quantity}`}</em></div>
                      {commission.kind === "fuzzy" && <div className="fuzzy-item-slots" aria-label={`${commission.title}物品框`}>
                        {Array.from({ length: commission.quantity }).map((_, slotIndex) => {
                          const entry = selectedEntries[slotIndex];
                          return <button key={slotIndex} className={entry ? "filled" : ""} onClick={() => entry ? removeFuzzySelection(commission.id, slotIndex) : setPickerCommissionId(commission.id)} aria-label={entry ? `移除${mutationDisplayName(entry.item, entry.stack.mutation)}` : `选择第${slotIndex + 1}件丹药`}>
                            {entry ? <><img src={entry.item.image} alt="" /><span>{MUTATIONS[entry.stack.mutation].prefix || entry.item.element}</span></> : <><b>＋</b><span>选丹</span></>}
                          </button>;
                        })}
                      </div>}
                      <div className="commission-reward"><small>{commission.kind === "fuzzy" && commission.pricingMode === "dynamic" ? "总估值 ×1.5" : "仙门定价"}</small><strong>◉ {reward.toLocaleString()}</strong></div>
                      <button onClick={() => deliverCommission(commission)} disabled={stock < commission.quantity}>交 付</button>
                    </article>;
                  })}
                  {commissions.length === 0 && <div className="commission-empty">本轮委托均已完成，请静候下次张榜</div>}
                </section>
                <aside className="product-vault">
                  <header><span>炼 成 物</span><h3>成品库</h3><small>{productStackList.length} 个独立格</small></header>
                  <div>{productStackList.map(({ stack, item }) => <article key={productStackKey(stack.productId, stack.mutation)} className={`mutation-${stack.mutation}`}><img src={item.image} alt="" /><span><strong>{mutationDisplayName(item, stack.mutation)}</strong><small>{MUTATIONS[stack.mutation].note} · 估值 {getMutationValue(item, stack.mutation).toLocaleString()}</small></span><b>×{stack.count}</b></article>)}</div>
                  {productStackList.length === 0 && <p>尚无成品，先去丹炉炼制一炉。</p>}
                </aside>
              </div>
              <footer className="market-footer commission-footer"><div className="market-rule-copy"><strong>委托榜将在 {formatCountdown(commissionRemaining)} 后刷新</strong><small>模糊委托由你自由配货；动态价格按装填物总估值 ×1.5 结算</small></div><span className="commission-seal">仙门收购 · 概不赊欠</span></footer>
            </>}
          </div>
        </div>
      )}

      {pickerCommission && pickerCommission.kind === "fuzzy" && (
        <div className="fuzzy-picker-overlay" role="dialog" aria-modal="true" aria-label="选择符合委托的丹药">
          <button className="fuzzy-picker-backdrop" onClick={() => setPickerCommissionId(null)} aria-label="关闭配货" />
          <section className="fuzzy-picker">
            <header><div><span>乾 坤 灵 囊 · 成 品 库</span><h2>为「{pickerCommission.title}」配货</h2><p>已选 {(fuzzySelections[pickerCommission.id] ?? []).length}/{pickerCommission.quantity} · 点击丹药放入空物品框</p></div><button onClick={() => setPickerCommissionId(null)} aria-label="关闭">×</button></header>
            <div className="fuzzy-picker-summary"><span className={pickerCommission.pricingMode === "dynamic" ? "dynamic" : "fixed"}>{pickerCommission.pricingMode === "dynamic" ? "动态价格" : "仙门定价"}</span><strong>{pickerCommission.pricingMode === "dynamic" ? `当前结算 ◉ ${fuzzyCommissionReward(pickerCommission).toLocaleString()}` : `固定酬金 ◉ ${pickerCommission.reward.toLocaleString()}`}</strong><small>{pickerCommission.pricingMode === "dynamic" ? "所选物品总估值 ×1.5" : "物品成色不会改变本单酬金"}</small></div>
            <div className="fuzzy-picker-grid">
              {productStackList.filter(({ item }) => matchesFuzzyCommission(item, pickerCommission)).map(({ stack, item }) => {
                const key = productStackKey(stack.productId, stack.mutation);
                const selectedCount = (fuzzySelections[pickerCommission.id] ?? []).filter((selectedKey) => selectedKey === key).length;
                const unavailable = selectedCount >= stack.count || (fuzzySelections[pickerCommission.id] ?? []).length >= pickerCommission.quantity;
                return <button key={key} className={`fuzzy-picker-item mutation-${stack.mutation}`} onClick={() => addFuzzySelection(pickerCommission.id, key)} disabled={unavailable}>
                  <span className="fuzzy-picker-art"><img src={item.image} alt="" /></span>
                  <span><strong>{mutationDisplayName(item, stack.mutation)}</strong><small>{item.element} · {item.quality} · 估值 {getMutationValue(item, stack.mutation).toLocaleString()}</small></span>
                  <b>{selectedCount > 0 ? `已选 ${selectedCount}/` : "持有 "}{stack.count}</b>
                </button>;
              })}
              {productStackList.filter(({ item }) => matchesFuzzyCommission(item, pickerCommission)).length === 0 && <p className="fuzzy-picker-empty">成品库中暂时没有符合条件的丹药。</p>}
            </div>
            <footer><button onClick={() => setPickerCommissionId(null)}>完成配货</button></footer>
          </section>
        </div>
      )}

      {showCodex && (
        <div className="codex-overlay" role="dialog" aria-modal="true" aria-label="万物图鉴属性表">
          <div className="codex-window">
            <header className="codex-heading">
              <div><span>太虚万物志 · 数据总览</span><h2>{ITEM_TABLE.length} 项材料与成品</h2></div>
              <button onClick={() => setShowCodex(false)} aria-label="关闭万物图鉴">×</button>
            </header>
            <div className="codex-summary">
              <div><strong>{ITEM_TABLE.length}</strong><span>图鉴总数</span></div><div><strong>{MATERIALS.length}</strong><span>可炼制材料</span></div><div><strong>{PRODUCTS.length}</strong><span>不可炼制成品</span></div><div><strong>{ITEM_GROUP_COUNT}</strong><span>素材系列</span></div>
            </div>
            <div className="codex-toolbar">
              <label><span>⌕</span><input value={codexSearch} onChange={(event) => setCodexSearch(event.target.value)} placeholder="搜索名称、五行或效果" aria-label="搜索图鉴" /></label>
              <div>{CODEX_FILTERS.map((name) => <button key={name} className={codexFilter === name ? "active" : ""} onClick={() => setCodexFilter(name)}>{name}</button>)}</div>
              <button className="export-button" onClick={exportCodex}>导出属性表</button>
            </div>
            <div className="codex-table-wrap">
              <table>
                <thead><tr><th>序</th><th>图鉴</th><th>名称</th><th>类型</th><th>归属</th><th>属性</th><th>品质</th><th>特性</th><th>价格</th><th>人物缘契</th><th>玩法效果</th></tr></thead>
                <tbody>
                  {codexRows.map((item) => (
                    <tr key={item.id} className={item.characterTrigger ? "fated-row" : ""}>
                      <td>{String(item.index).padStart(3, "0")}</td><td><img src={item.image} alt="" loading="lazy" /></td><td><strong>{item.name}</strong><small>{item.short}</small></td><td><span className={`kind-pill kind-${item.itemType}`}>{item.itemType === "material" ? "材料" : "成品"}</span><small>{item.canBeIngredient ? "可投入" : "不可炼制"}</small></td><td>{item.group ?? item.kind}·{item.category}</td><td><i style={{ background: item.color }} />{item.attribute}</td><td className={`quality-text quality-${item.quality}`}>{item.quality}<small>{"◆".repeat(item.rarity)}</small></td><td>{item.trait}</td><td>{item.price.toLocaleString()}<small>灵石</small></td><td>{item.character ? <><strong>{item.character.title}</strong><small>{item.character.relation} · 权重+{item.character.affinity}</small></> : <small>—</small>}</td><td>{item.effect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer>当前显示 {codexRows.length} 项 · 属性数据由统一表格驱动，可搜索、筛选与导出</footer>
          </div>
        </div>
      )}

      {characterCard && (
        <div className="character-overlay" role="dialog" aria-modal="true" aria-label="命定炉灵人物卡">
          <div className="character-portal" aria-hidden="true" />
          <div className="xian-cloud-curtain fated-curtain" aria-hidden="true"><i /><i /></div>
          <div className="xian-reveal-mist mist-back" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="character-card xian-card-frame xian-card-fated">
            <div className="character-halo" aria-hidden="true" />
            <div className="character-runes" aria-hidden="true">乾 · 坎 · 艮 · 震 · 巽 · 离 · 坤 · 兑</div>
            <div className="character-image xian-portrait-mask"><img src={characterCard.image} alt={characterCard.title} /><span /></div>
            <div className="character-copy">
              <span className="character-kicker">灵 契 人 物 卡 · {characterCard.targeted ? `缘物定向 ${characterCard.chance}%` : "星命随机"}</span>
              <h2>灵契·{characterCard.name}</h2>
              <p>{characterCard.targeted ? "人物缘物在十息丹火中显化，星命神花循着熟悉气息找到了她。" : "未有缘物指引，星命神花自万千命轨中随机照见了她。"}</p>
              <div className="character-stats"><span>人物关系<strong>{characterCard.relation}</strong></span><span>本炉概率<strong>{characterCard.chance}%</strong></span><span>命格特性<strong>{characterCard.trait}</strong></span></div>
              <button onClick={collectCharacter}>{characterCardFromCodex ? "返 回 太 虚 名 册" : "收 入 太 虚 名 册"}</button>
            </div>
            {Array.from({ length: 12 }).map((_, index) => <i key={index} className={`card-particle particle-${index + 1}`} aria-hidden="true" />)}
          </div>
          <div className="xian-reveal-mist mist-front" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        </div>
      )}

      {showResult && (
        <div className="result-overlay" role="dialog" aria-modal="true" aria-label="炼丹结果">
          <div className="result-rays" aria-hidden="true" />
          <div className="result-card">
            <div className="card-art product-card-art">
              <span className="result-item-aura" aria-hidden="true" />
              <img className="result-item-icon" src={resultItem.image} alt={mutationDisplayName(resultItem, resultMutation)} />
              <span className="legendary-tag">{resultMutation === "normal" ? `${resultItem.quality}·${resultItem.category}` : `${MUTATIONS[resultMutation].prefix}·异变词缀`}</span>
            </div>
            <div className="card-copy">
              <span className="first-acquired">◈ 炼成物 · 成品库独立记录</span>
              <h2 className={`mutation-name mutation-${resultMutation}`}>{mutationDisplayName(resultItem, resultMutation)}</h2>
              <p>{MUTATIONS[resultMutation].note}。{resultItem.effect}。五行属 <b>{resultItem.element}</b>，实际估值 <b>{getMutationValue(resultItem, resultMutation).toLocaleString()}</b> 灵石。</p>
              {resultMutation !== "normal" && <div className={`mutation-banner mutation-${resultMutation}`}><span>炼丹异变</span><strong>{MUTATIONS[resultMutation].prefix}</strong><small>价值倍率 ×{MUTATIONS[resultMutation].valueMultiplier}</small></div>}
              <div className="result-value"><span>灵韵稀有</span><strong>{"◆".repeat(resultItem.rarity)}</strong></div>
              <div className="card-actions"><button onClick={collectResult}>收 下</button><button onClick={resetBrew}>再炼一炉</button></div>
            </div>
          </div>
          <div className="result-title"><span>天地同贺</span><strong>灵 变 成 丹</strong></div>
        </div>
      )}
    </main>
  );
}
