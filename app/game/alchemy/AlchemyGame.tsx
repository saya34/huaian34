"use client";

import {
  CSSProperties,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
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
  MARKET_RESET_TICKS,
  MarketOffer,
  rollMarketOffers,
  SOLD_OUT_REFRESH_TICKS,
} from "./market";
import {
  COMMISSION_REFRESH_TICKS,
  DailyCommission,
  generateCommissions,
  getMutationValue,
  matchesFuzzyCommission,
  matchesCommissionInventory,
  MUTATIONS,
  MutationId,
  mutationDisplayName,
  ProductStack,
  productStackKey,
  rollMutation,
} from "./commissions";
import type { CommissionNpc } from "./commission-npcs";
import {
  CharacterCardRecord,
  FatedCharacterCardRecord,
  isMythicCardRecord,
  MYTHIC_CARD_OPTIONS,
  MYTHIC_MAX_OPTIONS,
  MYTHIC_RARE_MAX_USES,
  MythicCardRecord,
  MythicOptionPage,
} from "./advanced-card";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import type { AlchemyProgress, UnifiedCardInstance } from "../core/types";
import { cardQualityName, normalizeCardName } from "../core/card-service";
import { ACTION_COSTS, actionCostLabel, checkActionAdmission } from "../core/action-service";
import { useFeedback } from "../feedback/FeedbackProvider";
import { feedbackText } from "../feedback/texts";
import alchemyUi from "./data/ui.json";
import { createActivityReceipt } from "../core/activity-receipt";
import RotarySelector from "../ui/RotarySelector";
import { activeMedicineShortageRecipe } from "../projects/medicine-shortage-service";
import { AlchemyResultOverlay, CommissionNpcDock, FatedCharacterOverlay, NpcDialogueOverlay } from "./AlchemyPresentation";
import { AlchemyCodexOverlay, AlchemyMarketOverlay, FuzzyPickerOverlay } from "./AlchemyMarketOverlay";
import { MythicCodexOverlay, MythicCreatorOverlay, MythicRevealOverlay } from "./AlchemyMythicOverlays";

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

function formatGameTicks(ticks: number) {
  const value=Math.max(0,Math.ceil(ticks));
  return value<=0?"本阶段":`${value} 个游戏阶段`;
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

export default function Home({ embedded = false, onExit, initialSurface = "furnace" }: { embedded?: boolean; onExit?: () => void; initialSurface?: "furnace" | "market" }) {
  const { state: unifiedState, setAlchemy, applyEffects } = useUnifiedGame();
  const feedback = useFeedback();
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
  const [mobileView, setMobileView] = useState<"furnace" | "inventory" | "visitors">("furnace");
  const [mobileMaterialId, setMobileMaterialId] = useState(MATERIALS[0].id);
  const [mobileUtilityOpen, setMobileUtilityOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "ready" | "brewing" | "done">("idle");
  const [timeLeft, setTimeLeft] = useState(8);
  const [showResult, setShowResult] = useState(false);
  const [resultItem, setResultItem] = useState(PRODUCTS[0]);
  const [resultMutation, setResultMutation] = useState<MutationId>("normal");
  const [showCodex, setShowCodex] = useState(false);
  const [showMarket, setShowMarket] = useState(initialSurface === "market");
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
  const wheelMaterials = INVENTORY_MATERIALS.filter((item) => item.canBeIngredient && item.itemType === "material" && (materialCounts[item.id] ?? 0) > 0);
  const visibleWheelMaterials = wheelMaterials.length ? wheelMaterials : INVENTORY_MATERIALS.filter((item) => item.canBeIngredient && item.itemType === "material").slice(0, 3);
  const selectedWheelMaterial = visibleWheelMaterials.find((item) => item.id === mobileMaterialId) ?? visibleWheelMaterials[0];
  const setMaterialCounts = (value: SetStateAction<Record<string, number>>) => setField("materialCounts", value);
  const [recipeRules, setRecipeRules] = useState<RecipeRule[]>(DEFAULT_RECIPE_RULES);
  const [recipeVersion, setRecipeVersion] = useState(1);
  const projectRecipeContent = activeMedicineShortageRecipe(unifiedState);
  const projectRecipe = useMemo(() => {
    if (!projectRecipeContent) return null;
    const ingredients = projectRecipeContent.ingredients.flatMap((requirement) => {
      const item = MATERIALS.find((candidate) => candidate.id === requirement.templateId);
      return item ? Array.from({ length: requirement.quantity }, () => item) : [];
    });
    const result = PRODUCTS.find((item) => item.id === projectRecipeContent.resultTemplateId);
    const expectedIngredientCount = projectRecipeContent.ingredients.reduce((sum, requirement) => sum + requirement.quantity, 0);
    if (!result || ingredients.length !== expectedIngredientCount) return null;
    const rule: RecipeRule = {
      id: `project-medicine-shortage-${projectRecipeContent.resultTemplateId}`,
      name: projectRecipeContent.name,
      resultItemId: result.id,
      enabled: true,
      priority: 1000,
      weight: 100,
      minMaterialCount: expectedIngredientCount,
      requiredItems: projectRecipeContent.ingredients.map((requirement) => ({ itemId: requirement.templateId, quantity: requirement.quantity })),
      elementRequirements: [],
    };
    return { content: projectRecipeContent, ingredients, result, rule };
  }, [projectRecipeContent]);
  const effectiveRecipeRules = useMemo(() => projectRecipe ? [projectRecipe.rule, ...recipeRules] : recipeRules, [projectRecipe, recipeRules]);
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
  const periodOrder=["清晨","上午","午后","黄昏","夜晚","深夜"] as const;
  const marketClock=(Math.max(1,unifiedState.romance.day)-1)*periodOrder.length+Math.max(0,periodOrder.indexOf(unifiedState.romance.period));
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
  const announcedBrewRef = useRef("");

  const filled = slots.filter(Boolean).length;
  const hasFatedFlower = slots.some(isFatedFlower);
  const hasMythicScroll = slots.some(isMythicScroll);
  const brewDuration = hasFatedFlower || hasMythicScroll ? 10 : 8;
  const dominantCharacter = useMemo(() => hasFatedFlower ? getDominantCharacter(slots) : null, [hasFatedFlower, slots]);
  const hasEnoughStock = slots.every((slot, index) => !slot || (materialCounts[slot.id] ?? 0) > slots.slice(0, index).filter((candidate) => candidate?.id === slot.id).length);
  const selectedMythicOptions = MYTHIC_CARD_OPTIONS.filter((option) => mythicSelections.includes(option.id));
  const selectedMythicCharacter = selectedMythicOptions.find((option) => option.page === "character");
  const selectedMythicProfile = CHARACTER_PROFILES.find((profile) => profile.id === selectedMythicCharacter?.characterId);
  const mythicBrewConfigured = Boolean(selectedMythicCharacter && selectedMythicProfile);
  const brewAdmission = checkActionAdmission("alchemy", unifiedState.shared);
  const canBrew = (hasMythicScroll ? mythicBrewConfigured : filled >= 2) && hasEnoughStock && brewAdmission.ok && phase !== "brewing" && phase !== "done";
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

  useEffect(() => {
    if (!toast) return;
    feedback.toast({titleKey:"system.dynamicMessage",params:{message:toast},icon:"炉",dedupeKey:`alchemy-toast:${toast}`});
  }, [feedback, toast]);

  useEffect(() => {
    if (phase !== "brewing") return;
    const key=`${brewSerialRef.current}:${slots.map(item=>item?.id??"empty").join(":")}`;
    if (announcedBrewRef.current===key)return;
    announcedBrewRef.current=key;
    feedback.toast({titleKey:"alchemy.brewTitle",bodyKey:"alchemy.brewing",icon:"火",tone:"cinnabar",dedupeKey:`alchemy-brew:${key}`});
  }, [feedback, phase, slots]);

  useEffect(() => {
    if (phase !== "done" || !resultItem) return;
    const rare=resultItem.rarity>=4||resultMutation!=="normal";
    feedback.publish({variant:rare?"rare-reward":"identification-reveal",priority:rare?0:1,tone:rare?"gold":"jade",titleKey:rare?"alchemy.rareTitle":"alchemy.resultTitle",bodyKey:rare?"alchemy.rareBody":"alchemy.resultBody",params:{name:mutationDisplayName(resultItem,resultMutation)},icon:rare?"丹":"成",imageSrc:resultItem.image,dedupeKey:`alchemy-result:${brewSerialRef.current}:${resultItem.id}:${resultMutation}`});
  }, [feedback, phase, resultItem, resultMutation]);
  const manualRefreshPrice = getManualRefreshPrice(manualRefreshCount);
  const manualResetRemaining = Math.max(0, refreshResetAt - marketClock);
  const soldOutRemaining = Math.max(0, soldOutRefreshAt - marketClock);
  const commissionRemaining = Math.max(0, commissionRefreshAt - marketClock);
  const productStackList = Object.values(productStacks).filter((stack) => stack.count > 0).map((stack) => ({ stack, item: PRODUCTS.find((item) => item.id === stack.productId) })).filter((entry): entry is { stack: ProductStack; item: GameItem } => Boolean(entry.item));
  const pickerCommission = commissions.find((commission) => commission.id === pickerCommissionId && commission.kind === "fuzzy");
  const revealedMythicOptions = MYTHIC_CARD_OPTIONS.filter((option) => revealedMythicCard?.optionIds.includes(option.id));
  const revealedMythicCharacter = revealedMythicOptions.find((option) => option.page === "character");
  const revealedMythicProfile = CHARACTER_PROFILES.find((profile) => profile.id === revealedMythicCharacter?.characterId);
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
        ? { title: "缘影共鸣", result: `人物卡·${dominantCharacter.profile.title}倾向`, chance: "命契必成", quality: cardQualityName(6) }
        : { title: "命星入雾", result: "随机命定人物卡", chance: "命契必成", quality: cardQualityName(6) };
    }
    const linkedCharacter = getDominantCharacter(slots);
    if (linkedCharacter) {
      return { title: "缘物有应", result: "需星命神花引契", chance: "尚未启契", quality: "待引" };
    }
    if (filled >= 2) {
      const managedMatch = resolveManagedRecipe(slots, effectiveRecipeRules);
      const predicted = selectAlchemyResult(slots, effectiveRecipeRules);
      const rate = Math.min(96, 72 + slots.filter(Boolean).reduce((sum, item) => sum + (item?.rarity ?? 0), 0) * 2);
      return { title: managedMatch ? `配方·${managedMatch.rule.name}` : "五行丹象", result: `${predicted.quality}·${predicted.name}`, chance: `${rate}%`, quality: predicted.quality };
    }
    return { title: "炉火已燃", result: "尚缺两味灵材", chance: "--", quality: "待鉴定" };
  }, [slots, filled, hasFatedFlower, hasMythicScroll, mythicBrewConfigured, dominantCharacter, effectiveRecipeRules]);

  const codexRows = useMemo(() => {
    const keyword = codexSearch.trim().toLowerCase();
    return ITEM_TABLE.filter((item) => {
      const matchesGroup = codexFilter === "全部" || (codexFilter === "材料" && item.itemType === "material") || (codexFilter === "成品" && item.itemType === "product") || (codexFilter === "神品" && item.quality === "神品") || (codexFilter === "神话" && item.quality === "神话");
      const matchesSearch = !keyword || `${item.name}${item.originalName ?? ""}${item.short}${item.group ?? ""}${item.category}${item.attribute}${item.trait}${item.effect}${item.character?.name ?? ""}${item.character?.relation ?? ""}`.toLowerCase().includes(keyword);
      return matchesGroup && matchesSearch;
    });
  }, [codexFilter, codexSearch]);

  useEffect(() => setInventoryPage(0), [filter, seriesFilter, qualityFilter, elementFilter, characterFilter]);

  useLayoutEffect(() => {
    setAlchemy((current) => {
      const validOffers = current.marketOffers.filter((offer) => MATERIALS.some((item) => item.id === offer.itemId)).slice(0, 6);
      const refreshResetAt=current.refreshResetAt>1_000_000?0:current.refreshResetAt;
      const soldOutRefreshAt=current.soldOutRefreshAt>1_000_000?0:current.soldOutRefreshAt;
      const commissionRefreshAt=current.commissionRefreshAt>1_000_000?0:current.commissionRefreshAt;
      const resetExpired = !refreshResetAt || refreshResetAt <= marketClock;
      const pendingSoldOut = validOffers.length === 6 && validOffers.every((offer) => offer.sold) ? soldOutRefreshAt || marketClock + SOLD_OUT_REFRESH_TICKS : 0;
      const marketOffers = validOffers.length === 6 && !(pendingSoldOut > 0 && pendingSoldOut <= marketClock) ? validOffers : rollMarketOffers(MATERIALS);
      const validCommissions = current.commissions.length === 7 && current.commissions.every((commission) => commission.kind !== "fuzzy" || commission.pricingMode === "fixed" || commission.pricingMode === "dynamic") && commissionRefreshAt > marketClock;
      const rareDefaults = Object.fromEntries(MYTHIC_CARD_OPTIONS.filter((option) => option.tier === "rare").map((option) => [option.id, Math.max(0, Math.min(MYTHIC_RARE_MAX_USES, current.mythicRareUses[option.id] ?? MYTHIC_RARE_MAX_USES))]));
      return { ...current, marketOffers, manualRefreshCount: resetExpired ? 0 : current.manualRefreshCount, refreshResetAt: resetExpired ? 0 : refreshResetAt, soldOutRefreshAt: pendingSoldOut, commissions: validCommissions ? current.commissions : generateCommissions(MATERIALS, PRODUCTS), commissionRefreshAt: validCommissions ? commissionRefreshAt : marketClock + COMMISSION_REFRESH_TICKS, mythicRareUses: rareDefaults };
    });
  }, [marketClock,setAlchemy]);

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
    setCommissionRefreshAt(marketClock + COMMISSION_REFRESH_TICKS);
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
    const recipe = projectRecipe?.ingredients ?? [MATERIALS[0], MATERIALS[1], MATERIALS[24]];
    if (recipe.some((item) => (materialCounts[item.id] ?? 0) < 1)) {
      setToast(projectRecipe?.content.missingNotice ?? "赤霄丹方所需灵材库存不足");
      return;
    }
    setSlots(recipe);
    setResultItem(selectAlchemyResult(recipe, effectiveRecipeRules));
    setPhase("ready");
    setToast(projectRecipe?.content.readyNotice ?? "已按《赤霄丹方》配齐灵材");
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
      setToast(!brewAdmission.ok ? brewAdmission.message : !hasEnoughStock ? "所选灵材库存不足，请更换材料或重置数量" : hasMythicScroll ? "请先在太初命卷中封存一位人物" : filled === 0 ? "请先选择两味灵材" : "还需一味主材");
      return;
    }
    if (hasMythicScroll) {
      const rareOptions = selectedMythicOptions.filter((option) => option.tier === "rare");
      if (rareOptions.some((option) => (mythicRareUses[option.id] ?? MYTHIC_RARE_MAX_USES) <= 0)) {
        setToast("所选稀有词条的命数已经耗尽，请重新展开命卷");
        return;
      }
      applyEffects([{ type: "spend_stamina", amount: ACTION_COSTS.alchemy.stamina }]);
      const card: MythicCardRecord = { id: `mythic-card-${Date.now()}`, createdAt: Date.now(), optionIds: [...mythicSelections], quality: "神品" };
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
    applyEffects([{ type: "spend_stamina", amount: ACTION_COSTS.alchemy.stamina }]);
    setResultItem(selectAlchemyResult(slots, effectiveRecipeRules));
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
    applyEffects([{type:"record_activity",receipt:createActivityReceipt({kind:"alchemy",title:`炼成 · ${mutationDisplayName(resultItem,resultMutation)}`,summary:"丹药实例、品质与异变词缀已写入统一行囊。",rewards:[`${mutationDisplayName(resultItem,resultMutation)} ×1`],impacts:["万物图鉴与任务库存已同步","可作为战前补给使用"],nextStep:{target:"tasks",label:"查看可推进的任务"}})}]);
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
      quality: "仙品",
    };
    setCharacterCards((current) => [...current, record]);
    const profile = CHARACTER_PROFILES.find((item) => item.id === record.profileId);
    const unifiedCard: UnifiedCardInstance = { id: record.id, characterId: record.profileId, name: normalizeCardName(`${profile?.title ?? "命定"}·${profile?.name ?? "人物卡"}`), rarity: 6, mode: characterCards.length % 2 === 0 ? "active" : "passive", source: "alchemy", art: record.image, activeEffect: "sword", bonuses: { damage: .035, health: 35 }, alchemyRecord: record };
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
      setToast(`灵石不足，还需 ${(price - gold).toLocaleString()} 灵石`);
      return;
    }
    setGold((current) => current - price);
    setMaterialCounts((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 }));
    setMarketOffers((current) => {
      const next = current.map((candidate) => candidate.id === offerId ? { ...candidate, sold: true } : candidate);
      if (next.every((candidate) => candidate.sold)) setSoldOutRefreshAt(marketClock + SOLD_OUT_REFRESH_TICKS);
      return next;
    });
    setToast(`${item.name} ×1 已收入乾坤灵囊`);
    if (soundOn) playTone("drop");
  }

  function refreshMarketManually() {
    const price = getManualRefreshPrice(manualRefreshCount);
    if (gold < price) {
      setToast(`灵石不足，刷新需要 ${price.toLocaleString()} 灵石`);
      return;
    }
    if (price > 0) setGold((current) => current - price);
    setMarketOffers(rollMarketOffers(MATERIALS));
    setManualRefreshCount((current) => current + 1);
    setRefreshResetAt(marketClock + MARKET_RESET_TICKS);
    setSoldOutRefreshAt(0);
    setToast(price === 0 ? "免费刷新完成，云商已换上新货" : `消耗 ${price.toLocaleString()} 灵石刷新集市`);
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
    setToast(`委托交付完成，获得 ${reward.toLocaleString()} 灵石`);
  }

  function consumeProductStacks(candidates: { stack: ProductStack; item: GameItem }[], quantity: number) {
    let remainingToRemove = quantity;
    candidates.forEach(({ stack }) => {
      if (remainingToRemove <= 0) return;
      const used = Math.min(remainingToRemove, stack.count);
      remainingToRemove -= used;
    });
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
      return Object.values(unifiedState.shared.items).filter((entry) => matchesCommissionInventory(entry, commission)).reduce((sum, entry) => sum + entry.amount, 0);
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
  const quickItems = projectRecipe?.ingredients ?? [MATERIALS[0], MATERIALS[1], MATERIALS[24]];

  return (
    <main className={`game-shell mobile-alchemy-${mobileView} phase-${phase} ${hasFatedFlower ? "has-fated-flower" : ""} ${hasMythicScroll ? "has-mythic-scroll" : ""} ${starArrivalPulse ? "star-arrival" : ""}`}>
      <div className="backdrop" aria-hidden="true" />
      <div className="mist mist-one" aria-hidden="true" />
      <div className="mist mist-two" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <header className="topbar">
        <button className="round-button" aria-label="返回主界面" onClick={() => onExit ? onExit() : window.parent !== window ? window.parent.postMessage({ type: "huaian-close-module" }, window.location.origin) : window.location.assign("/")}>返</button>
        <div className="title-lockup">
          <span className="eyebrow">太虚仙府 · 炼丹房</span>
          <h1>玄火丹炉</h1>
          <span className="seal">丹</span>
        </div>
        <div className="top-actions">
          <button className="mythic-codex-entry" onClick={() => setShowMythicCodex(true)} aria-label={`打开太虚名册，共 ${characterCards.length} 张人物卡`}><span>册</span><strong>太虚名册</strong><b>{characterCards.length}</b></button>
          <div className="gold-balance" aria-label={`持有灵石 ${gold}`}><span>◉</span>{gold.toLocaleString()}</div>
          <button className="text-button market-entry-button" onClick={() => setShowMarket(true)}><span>市</span> 云游集市</button>
          {!embedded && <a className="text-button im-entry-button" href="/item-manager"><span>▦</span> IM 配方司 <b>v{recipeVersion}</b></a>}
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
          {selectedWheelMaterial && <RotarySelector
            className="alchemy-material-wheel"
            direction="horizontal"
            items={visibleWheelMaterials.map((item) => ({ id: item.id, name: item.name, glyph: item.name.slice(0, 1), image: item.image, meta: alchemyUi.heldCount.replace("{count}", String(materialCounts[item.id] ?? 0)), disabled: (materialCounts[item.id] ?? 0) <= 0 }))}
            value={selectedWheelMaterial.id}
            onChange={setMobileMaterialId}
            onActivate={(id) => { const item = visibleWheelMaterials.find((entry) => entry.id === id); if (item) addIngredient(item); }}
            ariaLabel={alchemyUi.materialWheelAria}
            caption={alchemyUi.materialWheelCaption}
            previousLabel={alchemyUi.previousMaterial}
            nextLabel={alchemyUi.nextMaterial}
            activateLabel={alchemyUi.addMaterial}
          />}
          <div className={`alchemy-scene-shortcuts ${projectRecipe ? "has-project-recipe" : ""}`}>
            <button type="button" onClick={() => setMobileView("inventory")}><i>囊</i><span>{alchemyUi.openBag}</span></button>
            <button type="button" className={projectRecipe ? "project-recipe-shortcut" : ""} onClick={quickRecipe} aria-label={projectRecipe?.content.buttonLabel ?? alchemyUi.quickRecipe}><i>{projectRecipe ? "药" : "方"}</i><span>{projectRecipe?.content.shortcutLabel ?? alchemyUi.quickRecipe}</span></button>
          </div>
          <div className={`alchemy-scene-utility ${mobileUtilityOpen ? "open" : ""}`}>
            <button type="button" className="alchemy-utility-toggle" onClick={() => setMobileUtilityOpen((current) => !current)} aria-expanded={mobileUtilityOpen}><i>卷</i><span>{alchemyUi.more}</span></button>
            <div className="alchemy-utility-fan">
              <button type="button" onClick={() => { setMobileView("visitors"); setMobileUtilityOpen(false); }}><i>客</i><span>{alchemyUi.visitors}</span></button>
              <button type="button" onClick={() => { setShowMarket(true); setMobileUtilityOpen(false); }}><i>市</i><span>{alchemyUi.market}</span></button>
              <button type="button" onClick={() => { setShowCodex(true); setMobileUtilityOpen(false); }}><i>鉴</i><span>{alchemyUi.codex}</span></button>
            </div>
          </div>
          <div className="slot-row" aria-label="炼丹材料槽">
            {slots.map((slot, index) => (
              <button
                key={index}
                className={`material-slot ${slot ? "filled" : ""} ${index === 2 ? "auxiliary" : ""}`}
                data-slot-index={index}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDrop(event, index)}
                onClick={() => slot && feedback.inspect({titleKey:"alchemy.slotTitle",bodyKey:"alchemy.slotBody",params:{index:index+1},icon:index===2?"辅":"主",imageSrc:slot.image,details:[{labelKey:"items.nameLabel",value:slot.name,emphasis:true},{labelKey:"alchemy.functionLabel",value:`${slot.element} · ${slot.trait}`},{labelKey:"alchemy.stabilityLabel",value:omen.chance},{labelKey:"alchemy.recipeLabel",value:omen.result},{labelKey:"alchemy.yieldLabel",value:omen.quality}],actions:[{labelKey:"system.remove",tone:"secondary",onSelect:()=>removeIngredient(index)}],dedupeKey:`alchemy-slot:${index}:${slot.id}`})}
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
            <p>{phase === "brewing" ? alchemyUi.furnaceBrewing.replace("{remaining}", String(timeLeft)) : phase === "done" ? alchemyUi.furnaceDone : alchemyUi.furnaceIdle.replace("{filled}", String(filled)).replace("{cost}", actionCostLabel("alchemy"))}</p>
          </div>
        </div>

        <aside className="recipe-panel glass-panel">
          <div className="recipe-heading">
            <div><span className="panel-kicker">{projectRecipe?.content.kicker ?? "已悟丹方"}</span><h2>{projectRecipe?.content.name ?? "赤霄丹方"}</h2></div>
            <span className="recipe-rank">{projectRecipe?.content.rank ?? "地阶"}</span>
          </div>
          <div className="mini-recipe">
            {quickItems.map((item) => <div key={item.id}><img src={item.image} alt="" /><span style={{ color: item.color }}>{item.element}</span></div>)}
          </div>
          <p>{projectRecipe?.content.description ?? "赤炎为骨，月华为引，可聚天地灵息于一丸。"}</p>
          <button className="recipe-button" onClick={quickRecipe}>{projectRecipe?.content.buttonLabel ?? "一键配伍"}</button>
          <div className="daily-luck"><span>今日炉运</span><strong>灵变 +12%</strong></div>
          <small className="recipe-version">配方司已同步 · v{recipeVersion}</small>
        </aside>
      </section>

      <CommissionNpcDock
        commissionCount={commissions.length}
        onOpenNpc={openNpcDialogue}
        onOpenBoard={() => { setShowMarket(true); setMarketTab("commissions"); }}
      />

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
                  if (selected) feedback.inspect({titleKey:"alchemy.materialTitle",bodyKey:"world.changeBody",params:{message:item.trait},icon:item.element,imageSrc:item.image,details:[{labelKey:"items.nameLabel",value:item.name,emphasis:true},{labelKey:"alchemy.sourceLabel",value:item.category},{labelKey:"alchemy.functionLabel",value:`${item.attribute} · ${item.trait}`},{labelKey:"items.rarityLabel",value:item.quality},{labelKey:"items.valueLabel",value:item.price},{labelKey:"alchemy.recipeLabel",value:item.short}],dedupeKey:`alchemy-material:${item.id}`}); else addIngredient(item);
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

      <nav className="mobile-alchemy-nav" aria-label="炼丹房主要功能">
        <button type="button" className={mobileView === "furnace" ? "active" : ""} onClick={() => setMobileView("furnace")}><i>炉</i><span>玄火丹炉</span></button>
        <button type="button" className={mobileView === "inventory" ? "active" : ""} onClick={() => setMobileView("inventory")}><i>囊</i><span>乾坤灵囊</span></button>
        <button type="button" className={mobileView === "visitors" ? "active" : ""} onClick={() => setMobileView("visitors")}><i>客</i><span>仙门来客</span></button>
        <button type="button" onClick={() => setShowMarket(true)}><i>市</i><span>云游集市</span></button>
        <button type="button" onClick={() => setShowCodex(true)}><i>鉴</i><span>万物图鉴</span></button>
      </nav>

      {dragging && <div className="drag-ghost" style={{ left: dragging.x, top: dragging.y }} aria-hidden="true"><img src={dragging.item.image} alt="" /><span>{dragging.item.name}</span></div>}
      {toast && <div className="toast" role="status"><span>◇</span>{toast}<span>◇</span></div>}
      {openingFlash && <div className="opening-flash" aria-hidden="true"><span /><i /></div>}

      <MythicCreatorOverlay open={showMythicCreator} tab={mythicTab} selections={mythicSelections} rareUses={mythicRareUses} mythicCardCount={mythicCardCount} onClose={closeMythicCreator} onTab={setMythicTab} onToggle={toggleMythicOption} onPrepare={prepareMythicBrew} />
      <MythicRevealOverlay card={revealedMythicCard} fromCodex={mythicRevealFromCodex} onCollect={collectMythicCard} />
      <MythicCodexOverlay open={showMythicCodex} cards={characterCards} fatedCount={fatedCardCount} mythicCount={mythicCardCount} onClose={() => setShowMythicCodex(false)} onOpenFated={(card, profile) => { setShowMythicCodex(false); setCharacterCardFromCodex(true); setCharacterCard({ ...profile, image: card.image, chance: card.chance, targeted: card.targeted }); }} onOpenMythic={(card) => { setShowMythicCodex(false); setMythicRevealFromCodex(true); setRevealedMythicCard(card); }} />

      <NpcDialogueOverlay
        npc={activeCommissionNpc}
        step={npcDialogueStep}
        onClose={() => setActiveCommissionNpc(null)}
        onAdvance={advanceNpcDialogue}
      />

      <AlchemyMarketOverlay
        open={showMarket}
        onClose={() => setShowMarket(false)}
        gold={gold}
        tab={marketTab}
        onTab={setMarketTab}
        marketItems={marketItems}
        marketReady={marketReady}
        marketSoldOut={marketSoldOut}
        soldOutRemaining={formatGameTicks(soldOutRemaining)}
        manualRefreshCount={manualRefreshCount}
        manualResetRemaining={formatGameTicks(manualResetRemaining)}
        manualRefreshPrice={manualRefreshPrice}
        onRefresh={refreshMarketManually}
        onInspectOffer={(offer, item) => feedback.inspect({ titleKey: "shop.productTitle", bodyKey: "world.changeBody", params: { message: item.trait }, icon: "市", imageSrc: item.image, details: [{ labelKey: "items.nameLabel", value: item.name, emphasis: true }, { labelKey: "items.rarityLabel", value: item.quality }, { labelKey: "items.effectLabel", value: `${item.attribute} · ${item.trait}` }, { labelKey: "shop.priceLabel", value: getMarketPrice(item) }, { labelKey: "system.source", value: "云游集市" }], dedupeKey: `alchemy-market:${offer.id}` })}
        onBuy={buyMarketItem}
        commissions={commissions}
        commissionRefreshAt={commissionRefreshAt}
        commissionRemaining={formatGameTicks(commissionRemaining)}
        commissionStock={commissionStock}
        selectedEntries={fuzzySelectedEntries}
        commissionReward={(commission) => commission.kind === "fuzzy" ? fuzzyCommissionReward(commission) : commission.reward}
        onInspectCommission={(commission, item, stock, reward) => feedback.inspect({ titleKey: "alchemy.commissionTitle", bodyKey: "alchemy.commissionBody", params: { name: commission.kind === "specific" ? item?.name ?? "未知货品" : commission.title, quantity: commission.quantity }, icon: "榜", details: [{ labelKey: "alchemy.commissionLabel", value: commission.kind === "specific" && item?.itemType === "material" ? feedbackText("alchemy.commissionEmergency") : feedbackText("alchemy.commissionProcessed") }, { labelKey: "alchemy.referencePrice", value: reward }, { labelKey: "items.countLabel", value: `${stock}/${commission.quantity}` }, { labelKey: "system.reward", value: `${reward} 灵石` }], dedupeKey: `commission:${commission.id}` })}
        onRemoveSelection={removeFuzzySelection}
        onPickSelection={setPickerCommissionId}
        onDeliver={deliverCommission}
        productEntries={productStackList}
      />

      <FuzzyPickerOverlay
        commission={pickerCommission?.kind === "fuzzy" ? pickerCommission : null}
        selections={pickerCommission?.kind === "fuzzy" ? fuzzySelections[pickerCommission.id] ?? [] : []}
        products={productStackList}
        reward={pickerCommission?.kind === "fuzzy" ? fuzzyCommissionReward(pickerCommission) : 0}
        onPick={(key) => pickerCommission?.kind === "fuzzy" && addFuzzySelection(pickerCommission.id, key)}
        onClose={() => setPickerCommissionId(null)}
      />

      <AlchemyCodexOverlay
        open={showCodex}
        rows={codexRows}
        search={codexSearch}
        filter={codexFilter}
        filters={CODEX_FILTERS}
        groupCount={ITEM_GROUP_COUNT}
        onSearch={setCodexSearch}
        onFilter={setCodexFilter}
        onExport={exportCodex}
        onClose={() => setShowCodex(false)}
      />

      <FatedCharacterOverlay character={characterCard} fromCodex={characterCardFromCodex} onCollect={collectCharacter} />
      <AlchemyResultOverlay open={showResult} item={resultItem} mutation={resultMutation} onCollect={collectResult} onReset={resetBrew} />
    </main>
  );
}
