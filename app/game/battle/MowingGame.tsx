"use client";

import { CSSProperties, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BattleEngine, GameSettings, GameSnapshot, UpgradeChoice } from "./engine";
import { assetUrl, GameData, loadGameData } from "./data";
import {
  ContainerKind,
  EXPEDITION_PHASES,
  LootOffer,
  PartnerDefinition,
  PlacedTreasure,
  RARITY_META,
  RunResult,
  TreasureItem,
  placeItems,
  treasureById,
} from "./expedition";
import {
  MetaProgress,
  availableAttributePoints,
  availableSkillPoints,
  backpackSize,
  identifyEquipment,
  experienceToNextLevel,
  feedSkillExperience,
  safeSize,
  sellTreasure,
  sortEquipment,
  sortTreasureContainer,
  upgradeCost,
  transferTreasure,
  tryEquipItem,
  tryUnequipItem,
  moveEquipment,
  warehouseSize,
} from "./meta";
import { ATTRIBUTE_POINT_BONUS, AttributeAllocation, BLESSING_META, BlessingPage, EquipmentBodySlot, EquipmentItem, PASSIVE_SKILLS, SLOT_META, addAttributes, canUseEquipment, computeCombatTraits, equipmentAttributeBonus, equipmentById, equipmentRequirements, equipmentSize, equipmentValue, formatBonus, passiveSkillUnlocked } from "./progression";
import { DEFAULT_WM_CONFIG, WMAttributeKey, WMConfig, WMEquipmentRule, cloneWMConfig, validateWMConfig } from "./weaponManager";
import {
  MAX_SKILL_MASTERY_LEVEL,
  SKILL_BOOK_EXP,
  SKILL_MANUALS,
  learnedSkillIds,
  skillDamageBonuses,
  skillMasteryDamageMultiplier,
  skillMasteryExpToNext,
} from "./skillMastery";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { CULTIVATOR_PACK_SIZE, organizeEquipment } from "./inventorySystem";
import type { UnifiedCardInstance } from "../core/types";
import { ITEM_TABLE, MATERIALS as ALCHEMY_MATERIALS } from "../alchemy/item-data";
import { MainEquipmentPanel } from "../ui/FusionSystemPanel";
import { useFeedback } from "../feedback/FeedbackProvider";
import { feedbackText } from "../feedback/texts";
import { DUNGEONS } from "../core/dungeons";
import { BattlePreparation, preparationSupplyBonus, readBattlePreparation, type BattleReturnReceipt } from "./BattlePreparation";
import { computeFinalAttributes } from "../core/attributes-service";
import { itemTemplateId } from "../core/inventory-service";
import { CARD_QUALITY_NAMES } from "../core/card-service";
import { resolveBattleSettlement, type BattleSettlement } from "./settlement-service";
import { lockBattleSession, type LockedBattleSession } from "./run-session";
import { CardSystem, CharacterProgression, EquipmentSystem, SkillStudySystem, WeaponManager } from "./BattleManagementPanels";
import { InventoryGrid, RunEquipmentGrid, writeTreasureDrag, type HeldTreasure } from "./BattleInventoryPanels";
import { skillArtwork, skillVisual } from "./skill-art";

type Screen = "loading" | "menu" | "preparing" | "battle" | "result";
type BattleCeremony = {
  phase: "opening" | "ending";
  tone: "opening" | RunResult;
  eyebrow: string;
  title: string;
  subtitle: string;
  seal: string;
};

const emptySnapshot: GameSnapshot = {
  elapsed: 0,
  total: 240,
  hp: 1000,
  maxHp: 1000,
  level: 0,
  exp: 0,
  nextExp: 20,
  kills: 0,
  bossKills: 0,
  gold: 0,
  speed: 1,
  paused: true,
  monsterCount: 0,
  skills: [],
  supplies: [],
  boss: null,
  phaseIndex: 0,
  phase: EXPEDITION_PHASES[0],
  extraction: null,
  qi: 100,
  backpack: [],
  safeBox: [],
  backpackSize: { columns: 10, rows: 4 },
  safeSize: { columns: 2, rows: 2 },
  activeBuffs: [],
  runEquipment: [],
};

const formatTime = (seconds: number) => {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
};


export function MowingGame({ initialWaveId = 1, embedded = false, autoStart = false, onExit }: { initialWaveId?: number; embedded?: boolean; autoStart?: boolean; onExit?: (receipt?: BattleReturnReceipt) => void }) {
  const { state: unifiedState, setBattle: setMeta, applyEffects } = useUnifiedGame();
  const feedback = useFeedback();
  const [screen, setScreen] = useState<Screen>("loading");
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState("");
  const [heroId, setHeroId] = useState(400001);
  const [waveId, setWaveId] = useState(Math.max(1, Math.min(21, initialWaveId)));
  const [snapshot, setSnapshot] = useState<GameSnapshot>(emptySnapshot);
  const [upgrades, setUpgrades] = useState<UpgradeChoice[]>([]);
  const [rerolls, setRerolls] = useState(1);
  const [result, setResult] = useState<BattleSettlement | null>(null);
  const [toast, setToast] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const meta = unifiedState.battle;
  const metaRef = useRef(meta);
  const [menuPanel, setMenuPanel] = useState<"warehouse" | "upgrades" | "equipment" | "cards" | "character" | "skills" | "wm" | null>(null);
  const [loot, setLoot] = useState<LootOffer | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [phaseAlert, setPhaseAlert] = useState<{ name: string; subtitle: string } | null>(null);
  const [battleCeremony, setBattleCeremony] = useState<BattleCeremony | null>(null);
  const [preparedSupplyName, setPreparedSupplyName] = useState<string | undefined>();
  const [partnerCast, setPartnerCast] = useState<{ partner: PartnerDefinition; resonance: boolean } | null>(null);
  const [cardChoices, setCardChoices] = useState<UnifiedCardInstance[]>([]);
  const [heldTreasure, setHeldTreasure] = useState<HeldTreasure | null>(null);
  const [heldPointer, setHeldPointer] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BattleEngine | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickPointer = useRef<number | null>(null);
  const [joystickKnob, setJoystickKnob] = useState({ x: 0, y: 0 });
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ceremonyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announcedBossRef = useRef<string | null>(null);
  const runSessionRef = useRef<LockedBattleSession | null>(null);
  const settledSessionRef = useRef<string | null>(null);

  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  useEffect(() => {
    feedback.setCombatBusy(screen === "battle");
    return () => feedback.setCombatBusy(false);
  }, [feedback, screen]);

  useEffect(() => {
    const bossName = snapshot.boss?.name ?? null;
    if (!bossName || announcedBossRef.current === bossName) return;
    announcedBossRef.current = bossName;
    setPhaseAlert({name:bossName,subtitle:"强敌现身 · 留意血条与阶段招式"});
    if (phaseTimer.current) clearTimeout(phaseTimer.current);
    phaseTimer.current=setTimeout(()=>setPhaseAlert(null),2400);
  }, [snapshot.boss?.name]);

  useEffect(() => {
    if (!heldTreasure) return;
    const trackPointer = (event: PointerEvent) => setHeldPointer({ x: event.clientX, y: event.clientY });
    const cancelHeld = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHeldTreasure(null);
    };
    window.addEventListener("pointermove", trackPointer);
    window.addEventListener("keydown", cancelHeld);
    return () => {
      window.removeEventListener("pointermove", trackPointer);
      window.removeEventListener("keydown", cancelHeld);
    };
  }, [heldTreasure]);

  useEffect(() => {
    let active = true;
    loadGameData()
      .then((loaded) => {
        if (!active) return;
        setData(loaded);
        setHeroId(Number(loaded.heroes[0]?.id ?? 400001));
        // 主世界已经完成统一整备时直接布置战场；独立入口仍从整备页开始。
        setScreen(autoStart ? "preparing" : "menu");
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "资源加载失败");
      });
    return () => {
      active = false;
      engineRef.current?.destroy();
      engineRef.current = null;
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (phaseTimer.current) clearTimeout(phaseTimer.current);
      if (partnerTimer.current) clearTimeout(partnerTimer.current);
      if (ceremonyTimer.current) clearTimeout(ceremonyTimer.current);
      runSessionRef.current = null;
      settledSessionRef.current = null;
    };
  }, [autoStart]);

  const selectedHero = useMemo(() => data?.heroes.find((hero) => Number(hero.id) === heroId), [data, heroId]);
  const selectedWave = useMemo(() => data?.waves.find((wave) => Number(wave.id) === waveId), [data, waveId]);
  const mapId = 1000 + clampWave(waveId) - 1;
  const selectedMap = useMemo(() => data?.maps.find((map) => Number(map.id) === mapId) ?? data?.maps[0], [data, mapId]);
  const menuBackground = "/game-assets/ui/main-menu-xianxia-bg.webp";
  const permanentAttributes = useMemo(() => computeFinalAttributes({ ...unifiedState, battle: meta }), [meta, unifiedState]);
  const permanentTraits = useMemo(() => computeCombatTraits(meta.passiveRanks), [meta.passiveRanks]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1500);
  }, []);

  const requestCardSummon = useCallback(() => {
    const equippedIds = new Set(meta.cardSlots.slice(0, meta.cardSlotCount).filter(Boolean));
    const equippedPool = unifiedState.shared.cards.filter((card) => card.mode === "active" && equippedIds.has(card.id));
    const pool = (equippedPool.length ? equippedPool : unifiedState.shared.cards.filter((card) => card.mode === "active")).sort(() => Math.random() - .5).slice(0, 3);
    if (!pool.length) return showToast("太虚名册中尚无主动人物卡");
    engineRef.current?.setInventoryPaused(true);
    setCardChoices(pool);
  }, [meta.cardSlotCount, meta.cardSlots, showToast, unifiedState.shared.cards]);

  const chooseCardSummon = (card: UnifiedCardInstance) => {
    const partnerId = card.activeEffect === "healing" ? "pill-fairy" : card.activeEffect === "ward" ? "vajra-monk" : card.activeEffect === "frost" ? "moon-demon" : card.activeEffect === "assault" ? "thunder-lord" : "sword-sister";
    const [name, ...titleParts] = card.name.split("·");
    setCardChoices([]);
    engineRef.current?.setInventoryPaused(false);
    engineRef.current?.summonPartner(partnerId, { name, title: titleParts.join("·") || "命格显化", art: card.art });
  };

  const beginBattle = useCallback(async () => {
    if (!data || !canvasRef.current) return;
    const preparation = readBattlePreparation(waveId);
    const supplyStack = preparation?.supplyId ? unifiedState.shared.items[preparation.supplyId] : null;
    const supplyDefinition = supplyStack?.amount ? ITEM_TABLE.find((item) => item.id === itemTemplateId(supplyStack)) : null;
    const supplyBonus = supplyStack?.amount ? preparationSupplyBonus(supplyStack.rarity) : null;
    const preparedAttributes = supplyBonus ? addAttributes(permanentAttributes, supplyBonus) : permanentAttributes;
    setPreparedSupplyName(supplyDefinition?.name);
    engineRef.current?.destroy();
    setScreen("preparing");
    setSnapshot(emptySnapshot);
    setUpgrades([]);
    setResult(null);
    setLoot(null);
    setBagOpen(false);
    setHeldTreasure(null);
    setBattleCeremony(null);
    if (ceremonyTimer.current) clearTimeout(ceremonyTimer.current);
    const mealLuckBonus = unifiedState.shared.luck.charges > 0 ? unifiedState.shared.luck.bonus : 0;
    const settings: GameSettings = {
      heroId,
      waveId,
      mapId,
      backpackSize: backpackSize(meta.backpackLevel),
      safeSize: safeSize(meta.safeLevel),
      baseAttributes: preparedAttributes,
      combatTraits: { ...permanentTraits, lootLuck: permanentTraits.lootLuck + mealLuckBonus },
      wmConfig: meta.wmPublished,
      availableSkillIds: learnedSkillIds(meta.skillMastery),
      skillDamageBonuses: skillDamageBonuses(meta.skillMastery),
    };
    const session = lockBattleSession({
      waveId,
      settings,
      meta,
      experienceGain: permanentAttributes.expGain,
      ...(supplyStack?.amount ? { supplyItemId: supplyStack.itemId } : {}),
      ...(supplyDefinition ? { supplyName: supplyDefinition.name } : {}),
    });
    runSessionRef.current = session;
    settledSessionRef.current = null;
    const engine = new BattleEngine(canvasRef.current, data, settings, {
      onSnapshot: setSnapshot,
      onUpgrade: (choices, remaining) => {
        setUpgrades(choices);
        setRerolls(remaining);
      },
      onGameOver: (kind, finalSnapshot) => {
        const activeSession = runSessionRef.current;
        if (!activeSession || settledSessionRef.current === activeSession.id) return;
        // Canvas can emit terminal snapshots from more than one code path. The
        // session id is the single commit gate for rewards, costs and quests.
        settledSessionRef.current = activeSession.id;
        const settlement = resolveBattleSettlement({ meta: activeSession.meta, kind, snapshot: finalSnapshot, waveId: activeSession.waveId, experienceGain: activeSession.experienceGain });
        setMeta(settlement.nextMeta);
        applyEffects(settlement.effects);
        setResult(settlement.result);
        const endingCopy = kind === "victory"
          ? { eyebrow: "妖王伏诛", title: "秘境镇压", subtitle: "一念斩群妖 · 清气复山河", seal: "胜" }
          : kind === "extracted"
            ? { eyebrow: "归途既现", title: "全身而退", subtitle: "守住所得 · 来日再问长生", seal: "归" }
            : { eyebrow: "道心未泯", title: "暂退此境", subtitle: "胜败如云烟 · 重整亦是修行", seal: "修" };
        setBattleCeremony({ phase: "ending", tone: kind, ...endingCopy });
        const endingDuration=kind==="victory"&&!unifiedState.dungeons.completed.includes(waveId)?2600:1200;
        ceremonyTimer.current = setTimeout(() => {
          setBattleCeremony(null);
          setScreen("result");
        }, endingDuration);
      },
      onToast: showToast,
      onPhase: (phase) => {
        setPhaseAlert({ name: phase.name, subtitle: phase.subtitle });
        if (phaseTimer.current) clearTimeout(phaseTimer.current);
        phaseTimer.current = setTimeout(() => setPhaseAlert(null), 2400);
      },
      onLoot: setLoot,
      onPartnerRequest: requestCardSummon,
      onPartner: (partner, resonance) => {
        setPartnerCast({ partner, resonance });
        if (partnerTimer.current) clearTimeout(partnerTimer.current);
        partnerTimer.current = setTimeout(() => setPartnerCast(null), resonance ? 2400 : 1200);
      },
    });
    engineRef.current = engine;
    try {
      await engine.prepare();
      const openingEffects = [
        ...(supplyStack?.amount && supplyDefinition ? [{ type: "remove_item" as const, itemId: supplyStack.itemId, amount: 1 }] : []),
        ...(mealLuckBonus > 0 ? [{ type: "consume_luck_charge" as const }] : []),
      ];
      if (openingEffects.length) applyEffects(openingEffects);
      if (mealLuckBonus > 0) showToast(`${unifiedState.shared.luck.source}食运护佑 · 战利品品质权重提升`);
      setScreen("battle");
      const mapName = data.maps.find((map) => Number(map.id) === mapId)?.name ?? "无名秘境";
      const waveName = data.waves.find((wave) => Number(wave.id) === waveId)?.name ?? `第 ${waveId} 重试炼`;
      setBattleCeremony({
        phase: "opening",
        tone: "opening",
        eyebrow: `第 ${String(waveId).padStart(2, "0")} 境 · ${waveName}`,
        title: mapName,
        subtitle: "灵台清明 · 妖潮将至",
        seal: "战",
      });
      const openingDuration=unifiedState.dungeons.completed.includes(waveId)?1100:2600;
      ceremonyTimer.current = setTimeout(() => {
        setBattleCeremony(null);
        if (engineRef.current === engine) engine.start();
      }, openingDuration);
    } catch (reason) {
      setBattleCeremony(null);
      setError(reason instanceof Error ? reason.message : "战场初始化失败");
      setScreen("menu");
    }
  }, [applyEffects, data, feedback, heroId, mapId, meta, permanentAttributes, permanentTraits, requestCardSummon, setMeta, showToast, unifiedState.shared.items, unifiedState.shared.luck, waveId]);

  useEffect(() => {
    if (screen === "preparing") {
      const timer = requestAnimationFrame(() => beginBattle());
      return () => cancelAnimationFrame(timer);
    }
  }, [screen, beginBattle]);

  const requestStart = () => setScreen("preparing");

  const selectUpgrade = (index: number) => {
    engineRef.current?.selectUpgrade(index);
    setUpgrades([]);
  };

  const updateJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const root = joystickRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    let x = event.clientX - (rect.left + rect.width / 2);
    let y = event.clientY - (rect.top + rect.height / 2);
    const radius = rect.width * 0.34;
    const length = Math.hypot(x, y);
    if (length > radius) x = x / length * radius, y = y / length * radius;
    setJoystickKnob({ x, y });
    engineRef.current?.setJoystick(x / radius, y / radius);
  };

  const joystickDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    joystickPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateJoystick(event);
  };

  const joystickMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current === event.pointerId) updateJoystick(event);
  };

  const joystickUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current !== event.pointerId) return;
    joystickPointer.current = null;
    setJoystickKnob({ x: 0, y: 0 });
    engineRef.current?.setJoystick(0, 0);
  };

  const progress = snapshot.total > 0 ? Math.min(100, snapshot.elapsed / snapshot.total * 100) : 0;
  const expProgress = snapshot.nextExp > 0 ? Math.min(100, snapshot.exp / snapshot.nextExp * 100) : 0;
  const hpProgress = snapshot.maxHp > 0 ? Math.max(0, snapshot.hp / snapshot.maxHp * 100) : 0;
  const speedOptions = [1, 2, 5, 10, 30];
  const qiSegments = [0, 1, 2].map((index) => Math.max(0, Math.min(100, snapshot.qi - index * 100)));

  const updateMeta = (next: MetaProgress) => {
    setMeta(next);
  };

  const buyCapacity = (kind: "backpack" | "safe" | "warehouse") => {
    const field = kind === "backpack" ? "backpackLevel" : kind === "safe" ? "safeLevel" : "warehouseLevel";
    const level = meta[field];
    const max = kind === "safe" ? 2 : kind === "backpack" ? 4 : 6;
    const cost = upgradeCost(kind, level);
    if (level >= max) return showToast("已经提升至当前上限");
    if (meta.spiritStones < cost) return showToast("灵石不足");
    updateMeta({ ...meta, spiritStones: meta.spiritStones - cost, [field]: level + 1 });
  };

  const resultCopy = result?.kind === "victory"
    ? { small: "妖王伏诛", title: "秘境镇压", body: "此方妖患已平，全部战利品已经收入藏宝阁。" }
    : result?.kind === "extracted"
      ? { small: "全身而退", title: "撤离成功", body: "你保住了本次战利品，但本关尚未完成镇压。" }
      : { small: "道心破碎", title: "修炼失败", body: "普通背包遗失，保险箱中的宝物已安全带回。" };
  const preparationDungeon = DUNGEONS.find((dungeon) => dungeon.waveId === waveId) ?? DUNGEONS[0];
  const preparationRewards = [0, 9, 19].map((offset) => ALCHEMY_MATERIALS[(waveId * 3 + offset) % ALCHEMY_MATERIALS.length]);

  return (
    <main className="game-shell" style={{ "--menu-bg": menuBackground ? `url("${menuBackground}")` : "none" } as CSSProperties}>
      <canvas ref={canvasRef} className="battle-canvas" aria-label="百炼成仙割草战场" />

      {battleCeremony && screen === "battle" && (
        <section
          className={`ink-ceremony ${battleCeremony.phase} tone-${battleCeremony.tone}`}
          role="status"
          aria-live="assertive"
          aria-label={`${battleCeremony.eyebrow}，${battleCeremony.title}，${battleCeremony.subtitle}`}
        >
          <div className="ink-paper-grain" />
          <div className="ink-wash wash-left" /><div className="ink-wash wash-right" />
          <div className="ink-mountains"><i /><i /><i /></div>
          <div className="ink-flight"><i /><i /><i /></div>
          <div className="ink-brush-stroke"><i /></div>
          <div className="ceremony-copy">
            <small>{battleCeremony.eyebrow}</small>
            <h2>{battleCeremony.title}</h2>
            <i className="ceremony-divider"><u /></i>
            <p>{battleCeremony.subtitle}</p>
            <b>{battleCeremony.seal}</b>
          </div>
          <div className="ink-edge edge-top" /><div className="ink-edge edge-bottom" />
        </section>
      )}

      {(screen === "loading" || screen === "preparing") && (
        <section className="loading-screen">
          <div className="taiji-loader"><i /><i /></div>
          <h1>{screen === "loading" ? "载入百炼世界" : "正在布置战场"}</h1>
          <p>{screen === "loading" ? "还原怪物、技能与序列帧资源…" : `加载第 ${waveId} 关怪物图集与波次配置…`}</p>
          {error && <p className="error-text">{error}</p>}
        </section>
      )}

      {screen === "menu" && data && (
        <section className="battle-preparation-screen">
          <BattlePreparation
            dungeon={preparationDungeon}
            mapImage={menuBackground}
            rewards={preparationRewards}
            heroName={selectedHero?.name ? String(selectedHero.name) : undefined}
            maxWave={meta.highestUnlockedWave}
            onChangeWave={setWaveId}
            onOpenPanel={(panel) => setMenuPanel(panel === "profile" ? "character" : panel)}
            onStart={requestStart}
            onHelp={() => setHelpOpen(true)}
          />
        </section>
      )}

      {false && screen === "menu" && data && (
        <section className="start-screen">
          <div className="start-vignette" />
          <div className="brand-block">
            <span className="brand-kicker">壹念入山 · 百炼问道</span>
            <h1>百炼成仙</h1>
            <p>山水有尽 · 道途无涯</p>
            <div className="brand-verse"><i />云深不知处，仗剑问长生<i /></div>
          </div>

          <div className="setup-panel">
            <div className="setup-heading">
              <div>
                <span>修士选择</span>
                <h2>{selectedHero?.name}</h2>
              </div>
              <button className="round-help" onClick={() => setHelpOpen(true)} aria-label="查看操作说明">?</button>
            </div>
            <div className="hero-grid">
              {data!.heroes.map((hero) => (
                <button
                  key={hero.id}
                  className={`hero-card ${Number(hero.id) === heroId ? "selected" : ""}`}
                  onClick={() => setHeroId(Number(hero.id))}
                >
                  {hero.portrait ? (
                    <img className="hero-portrait" src={assetUrl(hero.portrait)} alt="" />
                  ) : (
                    <span className="hero-seal">{String(hero.name).slice(0, 1)}</span>
                  )}
                  <strong>{hero.name}</strong>
                  <small>{data!.skills.find((skill) => Number(skill.resId) === Number(hero.weapon))?.name ?? "本命法器"}</small>
                </button>
              ))}
            </div>

            <div className="stage-picker">
              <div className="stage-copy">
                <span>历练之地</span>
                <h3>{selectedMap?.name ?? "莲池梦境"}</h3>
                <p>{selectedWave?.name}</p>
              </div>
              <div className="stage-control">
                <button onClick={() => setWaveId((value) => value <= 1 ? meta.highestUnlockedWave : value - 1)} aria-label="上一关">‹</button>
                <div><b>{String(waveId).padStart(2, "0")}</b><small>/ 21</small></div>
                <button onClick={() => setWaveId((value) => value >= meta.highestUnlockedWave ? 1 : value + 1)} aria-label="下一关">›</button>
              </div>
            </div>

            <div className="expedition-meta">
              <div className="meta-currency"><i className="menu-icon icon-spirit" /><span>灵石</span><b>{meta.spiritStones.toLocaleString()}</b></div>
              <button onClick={() => setMenuPanel("warehouse")}><i className="menu-icon icon-treasure" /><span>藏宝阁</span><small>{meta.warehouse.length} 件宝物</small></button>
              <button onClick={() => setMenuPanel("upgrades")}><i className="menu-icon icon-satchel" /><span>行囊</span><small>扩充收纳空间</small></button>
              <button onClick={() => setMenuPanel("equipment")}><i className="menu-icon icon-equipment" /><span>法器</span><small>{Object.keys(meta.equipped).length}/6 已穿戴</small></button>
              <button onClick={() => setMenuPanel("cards")}><i className="menu-icon icon-card" /><span>命格</span><small>{meta.cardSlots.filter(Boolean).length}/{meta.cardSlotCount} 已共鸣</small></button>
              <button onClick={() => setMenuPanel("character")}><i className="menu-icon icon-cultivate" /><span>修行</span><small>{availableAttributePoints(meta)} 根基 · {availableSkillPoints(meta)} 悟道</small></button>
              <button onClick={() => setMenuPanel("skills")}><i className="menu-icon icon-skill-study" /><span>万法谱</span><small>{Object.values(meta.skillMastery).filter((skill) => skill.learned).length}/20 已习得 · {meta.skillBooks} 卷</small></button>
              <button onClick={() => setMenuPanel("wm")}><i className="menu-icon icon-ledger" /><span>造物谱</span><small>{meta.wmPublishedAt ? "法则已生效" : "默认掉落法则"}</small></button>
            </div>

            <div className="player-exp-strip">
              <b>修士等级 {meta.playerLevel}</b>
              <i><u style={{ width: `${meta.playerLevel >= 60 ? 100 : meta.playerExp / experienceToNextLevel(meta.playerLevel) * 100}%` }} /></i>
              <span>{meta.playerLevel >= 60 ? "已达满级" : `${meta.playerExp.toLocaleString()} / ${experienceToNextLevel(meta.playerLevel).toLocaleString()}`}</span>
            </div>

            <div className="permanent-stats" title="副本内临时强化不会改变这些数值">
              <span><small>生命</small><b>{Math.round(permanentAttributes.health)}</b></span>
              <span><small>防御</small><b>{Math.round(permanentAttributes.defense)}</b></span>
              <span><small>伤害</small><b>{Math.round(permanentAttributes.damage * 100)}%</b></span>
              <span><small>闪避</small><b>{Math.round(permanentAttributes.dodge * 100)}%</b></span>
              <span><small>移速</small><b>{Math.round(permanentAttributes.moveSpeed)}</b></span>
              <span><small>经验</small><b>{Math.round(permanentAttributes.expGain * 100)}%</b></span>
            </div>

            <button className="start-button" onClick={requestStart}>
              <i>入</i><span>启程入境</span>
              <small>寻遗宝 · 斩群妖 · 证大道</small>
            </button>
            <p className="asset-note">此行凶险，法器、命格与修行配置仅可在入境前更改</p>
          </div>
        </section>
      )}

      {screen === "battle" && (
        <section className="battle-ui" aria-live="polite">
          <div className="top-hud">
            <div className="timer-block"><small>历练时间</small><b>{formatTime(snapshot.elapsed)}</b><span>/ {formatTime(snapshot.total)}</span></div>
            <div className="phase-track">
              <div className="wave-progress"><i style={{ width: `${progress}%` }} /></div>
              <small>{snapshot.phase.name} · 第 {snapshot.phaseIndex + 1} 阶段</small>
            </div>
            <div className="top-actions">
              <button className="speed-button" onClick={() => {
                const index = speedOptions.indexOf(snapshot.speed);
                engineRef.current?.setSpeed(speedOptions[(index + 1) % speedOptions.length]);
              }}>{snapshot.speed}×</button>
              <button onClick={() => engineRef.current?.togglePause()}>{snapshot.paused ? "继续" : "暂停"}</button>
            </div>
          </div>

          <div className="left-hud">
            <div className="stat-chip"><span>斩妖</span><b>{snapshot.kills.toLocaleString()}</b></div>
            <div className="stat-chip"><span>灵石</span><b>{snapshot.gold.toLocaleString()}</b></div>
            <button className="battle-bag-button" onClick={() => { engineRef.current?.setInventoryPaused(true); setBagOpen(true); }}>
              行囊 {snapshot.backpack.length}/{snapshot.backpackSize.columns * snapshot.backpackSize.rows}
              <small>保险 {snapshot.safeBox.length}</small>
            </button>
            <button className="battle-stats-button" onClick={() => { engineRef.current?.setInventoryPaused(true); setStatsOpen(true); }}>人物属性</button>
            <div className="skill-rack">
              {snapshot.skills.map((skill) => { const art = skillArtwork(skill.id); return <button type="button" key={skill.id} className={`skill-orb ${skill.evolved ? "evolved" : ""}`} title={skill.name} onClick={() => feedback.popover({ scope: "combat", titleKey: "battle.skillLabel", params: { name: skill.name }, bodyKey: "battle.skillDetail", icon: "术", details: [{ labelKey: "items.nameLabel", value: skill.name }, { labelKey: "player.levelLabel", value: skill.level }, { labelKey: "battle.skillState", value: skill.evolved ? "已蜕变" : "修习中" }] })}>{art ? <img src={art} alt="" /> : <span>{skill.name.slice(0, 1)}</span>}<b>{skill.level}</b></button>; })}
              {Array.from({ length: Math.max(0, 6 - snapshot.skills.length) }).map((_, index) => <div className="skill-orb empty" key={`skill-${index}`} />)}
            </div>
            <div className="skill-rack supplies">
              {snapshot.supplies.map((supply) => <button type="button" key={supply.id} className="skill-orb" title={supply.name} onClick={() => feedback.popover({ scope: "combat", titleKey: "battle.supplyTitle", params: { name: supply.name }, bodyKey: "battle.supplyBody", icon: "辅", details: [{ labelKey: "items.nameLabel", value: supply.name }, { labelKey: "player.levelLabel", value: supply.level }] })}><span>{supply.name.slice(0, 1)}</span><b>{supply.level}</b></button>)}
            </div>
          </div>

          <div className="bottom-status" role="button" tabIndex={0} onClick={(event)=>feedback.popover({scope:"combat",titleKey:"battle.hudTitle",bodyKey:"battle.hudBody",icon:"命",anchor:{x:event.clientX,y:event.clientY},details:[{labelKey:"battle.healthLabel",value:`${Math.ceil(snapshot.hp)}/${Math.ceil(snapshot.maxHp)}`,emphasis:true},{labelKey:"player.expLabel",value:`${Math.floor(snapshot.exp)}/${Math.floor(snapshot.nextExp)}`},{labelKey:"battle.buffLabel",value:snapshot.activeBuffs.join(" · ")||"无"},{labelKey:"battle.debuffLabel",value:snapshot.hp<snapshot.maxHp*.3?"重伤警戒":"无"},{labelKey:"battle.cooldownLabel",value:"各术法按独立攻击间隔自动调息"}],dedupeKey:`battle-hud:${snapshot.level}:${snapshot.activeBuffs.join(":")}`})}>
            <div className="level-badge"><small>境界</small><b>{snapshot.level}</b></div>
            <div className="bars">
              <div className="hp-bar"><i style={{ width: `${hpProgress}%` }} /><span>{Math.ceil(snapshot.hp)} / {Math.ceil(snapshot.maxHp)}</span></div>
              <div className="exp-bar"><i style={{ width: `${expProgress}%` }} /><span>修为 {Math.floor(snapshot.exp)} / {Math.floor(snapshot.nextExp)}</span></div>
            </div>
          </div>

          {snapshot.boss && (
            <div className="boss-hud">
              <strong>{snapshot.boss.name}</strong>
              <div><i style={{ width: `${Math.max(0, snapshot.boss.hp / snapshot.boss.maxHp * 100)}%` }} /></div>
            </div>
          )}

          <div
            ref={joystickRef}
            className="joystick"
            onPointerDown={joystickDown}
            onPointerMove={joystickMove}
            onPointerUp={joystickUp}
            onPointerCancel={joystickUp}
          >
            <div className="joystick-knob" style={{ transform: `translate(${joystickKnob.x}px, ${joystickKnob.y}px)` }} />
          </div>

          <button className="hitbox-toggle" onClick={() => engineRef.current?.toggleHitboxes()}>判定框</button>

          <div className="qi-summon">
            <div className="qi-label"><span>伙伴元气</span><b>{Math.floor(snapshot.qi)} / 300</b></div>
            <div className="qi-segments">
              {qiSegments.map((amount, index) => <i key={index}><b style={{ width: `${amount}%` }} /></i>)}
            </div>
            <button disabled={snapshot.qi < 100} onClick={requestCardSummon}>
              <span>召灵</span><small>空格</small>
            </button>
          </div>

          {snapshot.extraction && (
            <div className="extraction-compass">
              <i style={{ transform: `rotate(${snapshot.extraction.angle}rad)` }}>➤</i>
              <div>
                <b>{snapshot.extraction.distance < 100 ? "驻留撤离" : "撤离法阵"}</b>
                <span>{Math.round(snapshot.extraction.distance)} 丈</span>
                <em><u style={{ width: `${snapshot.extraction.progress / 5 * 100}%` }} /></em>
              </div>
            </div>
          )}
          {permanentTraits.forceExtractCount > 0 && <button className="force-extract-button" onClick={() => engineRef.current?.forceExtract()}><i>遁</i><span>强行撤离</span><small>问宝道 · 本境一次</small></button>}
        </section>
      )}

      {statsOpen && screen === "battle" && (
        <section className="battle-attribute-overlay" onClick={() => { engineRef.current?.setInventoryPaused(false); setStatsOpen(false); }}>
          <div className="battle-attribute-card" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => { engineRef.current?.setInventoryPaused(false); setStatsOpen(false); }} aria-label="关闭人物属性">×</button>
            <header><small>PLAYER ATTRIBUTES · 入境快照</small><h2>人物属性</h2><p>永久属性已锁定，本局境界与修为在下方实时更新。</p></header>
            <div className="battle-attribute-level"><span>场外修士等级 <b>Lv.{meta.playerLevel}</b></span><span>本局境界 <b>{snapshot.level}</b></span><span>本局修为 <b>{Math.floor(snapshot.exp)} / {Math.floor(snapshot.nextExp)}</b></span></div>
            <div className="battle-attribute-grid"><span><small>生命</small><b>{Math.round(permanentAttributes.health)}</b></span><span><small>灵力</small><b>{Math.round(permanentAttributes.mana)}</b></span><span><small>护甲</small><b>{Math.round(permanentAttributes.defense)}</b></span><span><small>武器伤害</small><b>{Math.round(permanentAttributes.weaponMinDamage)}-{Math.round(permanentAttributes.weaponMaxDamage)}</b></span><span><small>命中</small><b>{Math.round(permanentAttributes.hitChance * 100)}%</b></span><span><small>体魄</small><b>{Math.floor(permanentAttributes.strength)}</b></span><span><small>身法</small><b>{Math.floor(permanentAttributes.dexterity)}</b></span><span><small>神识</small><b>{Math.floor(permanentAttributes.magic)}</b></span><span><small>离火抗性</small><b>{Math.round(permanentAttributes.fireResist * 100)}%</b></span><span><small>玄雷抗性</small><b>{Math.round(permanentAttributes.lightningResist * 100)}%</b></span><span><small>术法抗性</small><b>{Math.round(permanentAttributes.magicResist * 100)}%</b></span><span><small>伤害</small><b>{Math.round(permanentAttributes.damage * 100)}%</b></span><span><small>闪避</small><b>{Math.round(permanentAttributes.dodge * 100)}%</b></span><span><small>攻速</small><b>{Math.round(permanentAttributes.attackSpeed * 100)}%</b></span><span><small>悟性</small><b>{Math.round(permanentAttributes.expGain * 100)}%</b></span></div>
          </div>
        </section>
      )}

      {upgrades.length > 0 && screen === "battle" && (
        <section className="upgrade-overlay">
          <div className="upgrade-title"><small>突破境界 · 三选一</small><h2>请选择本次修炼方向</h2></div>
          <div className="upgrade-grid">
            {upgrades.map((choice, index) => {
              const visual = skillVisual(data, choice);
              return (
                <button key={`${choice.kind}-${choice.id}-${index}`} className={`upgrade-card ${choice.evolved ? "evolution" : ""}`} onClick={() => selectUpgrade(index)}>
                  <span className="upgrade-index">{index + 1}</span>
                  <div className={`upgrade-art ${visual ? "has-art" : ""}`} style={visual ? { backgroundImage: `url("${visual}")` } : undefined}><b>{choice.name.slice(0, 1)}</b></div>
                  <div className="upgrade-kind">{choice.kind === "skill" ? "主动技能" : choice.kind === "supply" ? "修炼心法" : choice.kind === "evolution" ? "超武进化" : "战场补给"}</div>
                  <h3>{choice.name}</h3>
                  <strong>{choice.evolved ? "觉醒" : `等级 ${choice.level}`}</strong>
                  <p>{choice.description}</p>
                </button>
              );
            })}
          </div>
          <button className="reroll-button" disabled={rerolls <= 0} onClick={() => engineRef.current?.rerollUpgrade()}>重选技能 <span>{rerolls}</span></button>
        </section>
      )}

      {loot && screen === "battle" && (
        <section className="loot-overlay">
          <div className={`loot-panel rarity-${loot.quality}`}>
            <div className="loot-heading">
              <div>
                <small>{loot.kind === "buff" ? "悟道宝匣" : loot.kind === "monster" ? "妖魄宝匣" : "遗藏宝匣"}</small>
                <h2>{loot.kind === "buff" ? "选择本局机缘" : `${RARITY_META[loot.quality].name}战利品`}</h2>
              </div>
              <button onClick={() => { engineRef.current?.closeLoot(); setLoot(null); setHeldTreasure(null); }}>继续战斗</button>
            </div>
            {loot.buffs ? (
              <div className="buff-choice-grid">
                {loot.buffs.map((buff) => (
                  <button key={buff.id} onClick={() => { engineRef.current?.selectBuff(buff.id); setLoot(null); }}>
                    <img src={buff.art} alt="" />
                    <strong>{buff.name}</strong>
                    <p>{buff.description}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="loot-command-layout">
                <section className="loot-field-equipment">
                  <header><span>战地法器阁</span><strong>佩戴与行囊</strong><small>可卸下、替换、整理或丢弃；属性立即生效</small></header>
                  <MainEquipmentPanel meta={meta} onChange={setMeta} compact />
                </section>
                <div className="loot-pack-layout">
                  <div className="loot-item-list">
                  {loot.items.map((item) => {
                    const treasure = treasureById(item.treasureId);
                    return (
                      <article
                        key={item.uid}
                        draggable
                        onDragStart={(event) => writeTreasureDrag(event, item.uid, "loot")}
                        onClick={() => setHeldTreasure({ uid: item.uid, source: "loot", treasureId: item.treasureId })}
                        style={{ "--rarity": RARITY_META[treasure.rarity].color } as CSSProperties}
                      >
                        <img src={treasure.art} alt="" />
                        <div><small>{RARITY_META[treasure.rarity].name} · {treasure.width}×{treasure.height}</small><strong>{treasure.name}</strong><p>{treasure.description}</p></div>
                        <div className="loot-actions">
                          <button onClick={(event) => { event.stopPropagation(); engineRef.current?.takeLoot(item.uid, "backpack"); }}>自动放入背包</button>
                          <button onClick={(event) => { event.stopPropagation(); engineRef.current?.takeLoot(item.uid, "safe"); }}>自动存保险箱</button>
                        </div>
                      </article>
                    );
                  })}
                  {!loot.items.length && <p className="loot-empty">宝物已经全部收妥。</p>}
                  {(loot.equipment ?? []).map((item) => {
                    const base = equipmentById(item.equipmentId);
                    return <article key={item.uid} className="loot-equipment" style={{ "--rarity": RARITY_META[item.rarity ?? base.rarity].color } as CSSProperties}><img src={base.art} alt="" /><div><small>随机装备 · {RARITY_META[item.rarity ?? base.rarity].name}</small><strong>{item.name ?? base.name}</strong><p>{formatBonus(item.bonuses ?? base.bonuses).join(" · ")}</p></div><div className="loot-actions"><button onClick={() => engineRef.current?.takeEquipment(item.uid)}>收入本局战利品</button></div></article>;
                  })}
                  </div>
                  <div className="loot-targets">
                    <p>拖拽宝物到指定格子；新拾取法器成功离境后进入法器行囊。</p>
                    <div className="inventory-columns">
                    <InventoryGrid
                      title="战利品背包"
                      items={snapshot.backpack}
                      size={snapshot.backpackSize}
                      container="backpack"
                      held={heldTreasure}
                      onHeldChange={setHeldTreasure}
                      onPlace={(uid, source, x, y) => engineRef.current?.placeTreasure(uid, source, "backpack", x, y)}
                      onSort={() => engineRef.current?.sortContainer("backpack")}
                    />
                    <InventoryGrid
                      title="保险箱"
                      items={snapshot.safeBox}
                      size={snapshot.safeSize}
                      container="safe"
                      held={heldTreasure}
                      onHeldChange={setHeldTreasure}
                      onPlace={(uid, source, x, y) => engineRef.current?.placeTreasure(uid, source, "safe", x, y)}
                      onSort={() => engineRef.current?.sortContainer("safe")}
                    />
                      <RunEquipmentGrid items={snapshot.runEquipment} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {bagOpen && screen === "battle" && (
        <section className="inventory-overlay" onClick={() => { engineRef.current?.setInventoryPaused(false); setBagOpen(false); setHeldTreasure(null); }}>
          <div className="inventory-panel" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => { engineRef.current?.setInventoryPaused(false); setBagOpen(false); setHeldTreasure(null); }}>×</button>
            <h2>秘境行囊</h2>
            <p>背包物品需要成功撤离；保险箱中的物品死亡后也能带回。</p>
            <div className="inventory-columns">
              <InventoryGrid
                title="战利品背包"
                items={snapshot.backpack}
                size={snapshot.backpackSize}
                actionLabel="移入保险箱"
                onAction={(uid) => engineRef.current?.moveTreasure(uid, "safe")}
                container="backpack"
                held={heldTreasure}
                onHeldChange={setHeldTreasure}
                onPlace={(uid, source, x, y) => engineRef.current?.placeTreasure(uid, source, "backpack", x, y)}
                onSort={() => engineRef.current?.sortContainer("backpack")}
              />
              <InventoryGrid
                title="保险箱"
                items={snapshot.safeBox}
                size={snapshot.safeSize}
                actionLabel="移入背包"
                onAction={(uid) => engineRef.current?.moveTreasure(uid, "backpack")}
                container="safe"
                held={heldTreasure}
                onHeldChange={setHeldTreasure}
                onPlace={(uid, source, x, y) => engineRef.current?.placeTreasure(uid, source, "safe", x, y)}
                onSort={() => engineRef.current?.sortContainer("safe")}
              />
              <RunEquipmentGrid items={snapshot.runEquipment} />
            </div>
          </div>
        </section>
      )}

      {phaseAlert && screen === "battle" && (
        <div className="phase-alert">
          <small>秘境异变</small>
          <h2>{phaseAlert.name}</h2>
          <p>{phaseAlert.subtitle}</p>
        </div>
      )}

      {partnerCast && screen === "battle" && (
        <>
          <div className={`partner-world-effect power-${partnerCast.partner.power} ${partnerCast.resonance ? "resonance" : ""}`}>
            <div className="world-effect-core" />
            <div className="world-effect-runes" />
            <div className="world-effect-strike" />
          </div>
          <div className={`partner-cast power-${partnerCast.partner.power} ${partnerCast.resonance ? "resonance" : ""}`}>
            <div className="partner-ink" />
            <img src={partnerCast.partner.art} alt={partnerCast.partner.name} />
            <div>
              <small>{partnerCast.resonance ? `同源共鸣 · ${partnerCast.partner.tag}` : `${partnerCast.partner.tag}系伙伴`}</small>
              <h3>{partnerCast.partner.name}</h3>
              <strong>{partnerCast.partner.title}</strong>
            </div>
          </div>
        </>
      )}

      {heldTreasure && (loot || bagOpen) && (
        <div
          className="held-treasure"
          style={{ left: heldPointer.x, top: heldPointer.y } as CSSProperties}
        >
          <img src={treasureById(heldTreasure.treasureId).art} alt="" />
        </div>
      )}

      {screen === "result" && result && (
        <section className={`result-screen ${result.kind}`}>
          <div className="result-panel">
            <small>{resultCopy?.small}</small>
            <h2>{resultCopy?.title}</h2>
            <p>{resultCopy?.body}</p>
            <div className="result-stats">
              <div><span>存活时间</span><b>{formatTime(result.snapshot.elapsed)}</b></div>
              <div><span>斩妖数量</span><b>{result.snapshot.kills}</b></div>
              <div><span>境界等级</span><b>{result.snapshot.level}</b></div>
              <div><span>带出宝物</span><b>{result.accepted.length}</b></div>
            </div>
            {result.kind === "victory" && <p className="result-experience">人物经验 +{result.experience.toLocaleString()}{result.levelsGained > 0 && ` · 连升 ${result.levelsGained} 级`}</p>}
            {result.skillBooks > 0 && <p className="result-skill-books">获得悟道残卷 × {result.skillBooks}</p>}
            {result.accepted.length > 0 && (
              <div className="result-loot">
                {result.accepted.slice(0, 8).map((item) => {
                  const treasure = treasureById(item.treasureId);
                  return <img key={item.uid} src={treasure.art} alt={treasure.name} title={treasure.name} style={{ borderColor: RARITY_META[treasure.rarity].color }} />;
                })}
              </div>
            )}
            {result.overflow.length > 0 && <p className="overflow-warning">藏宝阁空间不足，{result.overflow.length} 件宝物未能收纳。</p>}
            {result.equipmentOverflow.length > 0 && <p className="overflow-warning">10×4 法器行囊已满，{result.equipmentOverflow.length} 件装备留在秘境。</p>}
            <div className="result-actions">
              <button onClick={() => {
                engineRef.current?.destroy();
                const receipt: BattleReturnReceipt = { kind: result.kind, waveId, dungeonName: DUNGEONS.find((dungeon) => dungeon.waveId === waveId)?.name ?? selectedWave?.name ?? `第 ${waveId} 重秘境`, accepted: result.accepted.length, experience: result.experience, skillBooks: result.skillBooks, attributePoints: availableAttributePoints(metaRef.current), skillPoints: availableSkillPoints(metaRef.current), equippedCount: Object.values(metaRef.current.equipped).filter(Boolean).length, learnedCount: Object.values(metaRef.current.skillMastery).filter((skill) => skill.learned).length, cardCount: unifiedState.shared.cards.length, supplyName: preparedSupplyName };
                if (onExit) onExit(receipt);
                else if (embedded && window.parent !== window) window.parent.postMessage({ type: "huaian-close-module", settled: true, receipt }, window.location.origin);
                else setScreen("menu");
              }}>{embedded ? "返回山河" : "返回整备"}</button>
              <button className="primary" onClick={requestStart}>再次历练</button>
            </div>
          </div>
        </section>
      )}

      {screen === "menu" && menuPanel === "warehouse" && (
        <section className="meta-overlay" onClick={() => setMenuPanel(null)}>
          <div className="meta-panel warehouse-panel panel-treasure" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setMenuPanel(null)}>×</button>
            <header><small>万宝归藏</small><h2>行囊与个人仓库</h2><b>灵石 {meta.spiritStones.toLocaleString()}</b></header>
            <div className="personal-storage-layout">
              <div><button className="inventory-sort" onClick={() => updateMeta(sortTreasureContainer(meta, "backpack"))}>整理 10×4 行囊</button><InventoryGrid title="随身行囊" items={meta.personalBackpack} size={backpackSize(meta.backpackLevel)} actionLabel="存入仓库" onAction={(uid) => { const result = transferTreasure(meta, uid, "warehouse"); updateMeta(result.meta); showToast(result.message); }} /></div>
              <div><button className="inventory-sort" onClick={() => updateMeta(sortTreasureContainer(meta, "warehouse"))}>整理个人仓库</button><InventoryGrid title="个人仓库" items={meta.warehouse} size={warehouseSize(meta.warehouseLevel, meta.warehouse)} actionLabel="移入行囊" onAction={(uid) => { const result = transferTreasure(meta, uid, "backpack"); updateMeta(result.meta); showToast(result.message); }} secondaryActionLabel="出售" onSecondaryAction={(uid) => updateMeta(sellTreasure(meta, uid))} /></div>
            </div>
            {!meta.warehouse.length && !meta.personalBackpack.length && <p className="warehouse-empty">尚未带回宝物。进入秘境搜寻宝匣并成功撤离。</p>}
          </div>
        </section>
      )}

      {screen === "menu" && menuPanel === "upgrades" && (
        <section className="meta-overlay" onClick={() => setMenuPanel(null)}>
          <div className="meta-panel upgrade-shop panel-satchel" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setMenuPanel(null)}>×</button>
            <header><small>行囊百纳</small><h2>行囊坊</h2><b>灵石 {meta.spiritStones.toLocaleString()}</b></header>
            <div className="capacity-cards">
              {([
                ["backpack", "战利品背包", backpackSize(meta.backpackLevel), meta.backpackLevel, 4],
                ["safe", "乾坤保险箱", safeSize(meta.safeLevel), meta.safeLevel, 2],
                ["warehouse", "藏宝阁", warehouseSize(meta.warehouseLevel), meta.warehouseLevel, 6],
              ] as const).map(([kind, name, size, level, max]) => (
                <article key={kind}>
                  <span>{kind === "safe" ? "安" : kind === "warehouse" ? "藏" : "囊"}</span>
                  <h3>{name}</h3>
                  <p>{size.columns}×{size.rows} · 等级 {level}</p>
                  <button disabled={level >= max} onClick={() => buyCapacity(kind)}>
                    {level >= max ? "已经满级" : `升级 · ${upgradeCost(kind, level).toLocaleString()} 灵石`}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {screen === "menu" && menuPanel === "equipment" && (
        <section className="meta-overlay" onClick={() => setMenuPanel(null)}>
          <div className="meta-panel equipment-panel panel-equipment" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setMenuPanel(null)}>×</button>
            <header><small>法器护身</small><h2>装备</h2><b>仅可在入场前配置</b></header>
            <EquipmentSystem meta={meta} onChange={updateMeta} notify={showToast} />
          </div>
        </section>
      )}

      {screen === "menu" && menuPanel === "cards" && (
        <section className="meta-overlay" onClick={() => setMenuPanel(null)}>
          <div className="meta-panel card-panel panel-card" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setMenuPanel(null)}>×</button>
            <header><small>命格共鸣</small><h2>卡片</h2><b>插入卡更强 · 长效卡持有生效</b></header>
            <CardSystem meta={meta} cards={unifiedState.shared.cards} onChange={updateMeta} />
          </div>
        </section>
      )}

      {screen === "menu" && menuPanel === "character" && (
        <section className="meta-overlay" onClick={() => setMenuPanel(null)}>
          <div className="meta-panel character-panel panel-cultivate" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setMenuPanel(null)}>×</button>
            <header><small>修行根基</small><h2>人物加点</h2><b>等级 {meta.playerLevel} / 60</b></header>
            <CharacterProgression meta={meta} relationships={unifiedState.romance.relationships} onChange={updateMeta} />
          </div>
        </section>
      )}

      {screen === "menu" && menuPanel === "skills" && data && (
        <section className="meta-overlay" onClick={() => setMenuPanel(null)}>
          <div className="meta-panel skill-study-panel panel-skill-study" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setMenuPanel(null)}>×</button>
            <header><small>万法归藏</small><h2>技能习得</h2><b>悟道残卷 {meta.skillBooks} · 每卷蕴含 {SKILL_BOOK_EXP} 点技能经验</b></header>
            <SkillStudySystem data={data} meta={meta} onChange={updateMeta} notify={showToast} />
          </div>
        </section>
      )}

      {screen === "menu" && menuPanel === "wm" && (
        <section className="meta-overlay" onClick={() => setMenuPanel(null)}>
          <div className="meta-panel wm-panel panel-ledger" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setMenuPanel(null)}>×</button>
            <header><small>WEAPON MANAGER</small><h2>装备与物品掉落管理</h2><b>{meta.wmPublishedAt ? `已发布 ${new Date(meta.wmPublishedAt).toLocaleString()}` : "默认版本"}</b></header>
            <WeaponManager meta={meta} onChange={updateMeta} notify={showToast} />
          </div>
        </section>
      )}

      {helpOpen && (
        <section className="help-modal" onClick={() => setHelpOpen(false)}>
          <div className="help-scroll" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setHelpOpen(false)}>×</button>
            <h2>割草玩法</h2>
            <p>键盘使用 WASD 或方向键移动；手机和平板拖动左下角摇杆。英雄会自动攻击，空格键可以消耗一格元气召唤伙伴。</p>
            <ul>
              <li>击杀怪物拾取修为，升级时从三项强化中选择一项。</li>
              <li>探索地图上的遗藏宝匣和悟道宝匣；精英与妖王会掉落妖魄宝匣。</li>
              <li>背包物品只有撤离或镇压成功后才能带回；保险箱物品死亡后也会保留。</li>
              <li>第一次秘境异变后撤离法阵显现，驻留五秒可以提前撤离。</li>
              <li>越晚的秘境阶段怪物越强，但高品质宝物出现概率越高。</li>
              <li>坚持到计时结束并击杀最终妖王，会完成镇压并带回全部战利品。</li>
            </ul>
          </div>
        </section>
      )}

      {toast && <div className="battle-toast">{toast}</div>}
      {error && screen !== "loading" && <div className="fatal-error">{error}</div>}
      {cardChoices.length > 0 && <section className="card-choice-overlay" aria-label="选择人物卡">
        <div className="card-choice-panel"><small>太虚名册 · 元气已满</small><h2>择一人入梦相助</h2><div className="card-choice-grid">{cardChoices.map((card) => <button key={card.id} onClick={() => chooseCardSummon(card)}><img src={card.art} alt="" /><span><b>{card.name}</b><em>{card.rarity >= 7 ? "神品" : card.rarity >= 6 ? "仙品" : "人物卡"}</em></span></button>)}</div></div>
      </section>}
      </main>
  );
}

function clampWave(waveId: number) {
  return Math.max(1, Math.min(21, waveId));
}
