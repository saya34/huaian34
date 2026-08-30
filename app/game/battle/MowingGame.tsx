"use client";

import { CSSProperties, DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BattleEngine, GameSettings, GameSnapshot, UpgradeChoice } from "./engine";
import { AnyRow, assetUrl, GameData, loadGameData } from "./data";
import { findEffect } from "./assets";
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
  awardClearExperience,
  awardSkillBooks,
  availableAttributePoints,
  availableSkillPoints,
  backpackSize,
  computePermanentAttributes,
  equipCard,
  identifyEquipment,
  experienceToNextLevel,
  feedSkillExperience,
  learnMetaSkill,
  safeSize,
  sellTreasure,
  sortEquipment,
  sortTreasureContainer,
  settleExpedition,
  upgradeCost,
  unequipCard,
  transferTreasure,
  tryEquipItem,
  tryUnequipItem,
  moveEquipment,
  warehouseSize,
} from "./meta";
import { ATTRIBUTE_POINT_BONUS, AttributeAllocation, BLESSING_META, BlessingPage, EquipmentBodySlot, EquipmentItem, PASSIVE_SKILLS, SLOT_META, addAttributes, canUseEquipment, cardById, computeCombatTraits, equipmentAttributeBonus, equipmentById, equipmentRequirements, equipmentSize, equipmentValue, formatBonus, passiveSkillUnlocked } from "./progression";
import { DEFAULT_WM_CONFIG, WMAttributeKey, WMConfig, WMEquipmentRule, cloneWMConfig, validateWMConfig } from "./weaponManager";
import {
  MAX_SKILL_MASTERY_LEVEL,
  SKILL_BOOK_EXP,
  SKILL_MANUALS,
  learnedSkillIds,
  skillDamageBonuses,
  skillMasteryDamageMultiplier,
  skillMasteryExpToNext,
  skillUnlockReady,
} from "./skillMastery";
import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { CULTIVATOR_PACK_SIZE, organizeEquipment } from "./inventorySystem";
import type { UnifiedCardInstance, UnifiedRarity } from "../core/types";
import { MATERIALS as ALCHEMY_MATERIALS } from "../alchemy/item-data";

type Screen = "loading" | "menu" | "preparing" | "battle" | "result";
type HeldTreasure = { uid: string; source: ContainerKind | "loot"; treasureId: string };
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

const SKILL_ART_BY_ID: Record<number, string> = {
  10000: "/game-assets/equipment/bamboo-sword.webp",
  10001: "/game-assets/equipment/spirit-sword.webp",
  10002: "/game-assets/equipment/frost-bow.webp",
  10003: "/game-assets/equipment/phoenix-fan.webp",
  10004: "/game-assets/equipment/frost-bow.webp",
  10005: "/game-assets/equipment/galaxy-blade.webp",
  10006: "/game-assets/equipment/iron-sabre.webp",
  10007: "/game-assets/equipment/chaos-blade.webp",
  10008: "/game-assets/equipment/blood-spear.webp",
  10009: "/game-assets/equipment/galaxy-blade.webp",
  10010: "/game-assets/equipment/mystic-weapon.webp",
  10011: "/game-assets/equipment/phoenix-fan.webp",
  10012: "/game-assets/spells/dragon-pill.webp",
  10013: "/game-assets/treasures/relic-pearl.webp",
  10014: "/game-assets/treasures/lotus-artifact.webp",
  10015: "/game-assets/equipment/phoenix-crown.webp",
  10016: "/game-assets/treasures/ancient-cauldron.webp",
  10017: "/game-assets/equipment/vajra-bracers.webp",
  10018: "/game-assets/equipment/phoenix-fan.webp",
  10019: "/game-assets/equipment/flame-bracers.webp",
  10020: "/game-assets/equipment/frost-bow.webp",
  10021: "/game-assets/equipment/ice-bracers.webp",
  10022: "/game-assets/equipment/heaven-crown.webp",
  10023: "/game-assets/equipment/galaxy-blade.webp",
  10024: "/game-assets/equipment/chaos-blade.webp",
  10025: "/game-assets/equipment/spirit-sword.webp",
  10026: "/game-assets/equipment/azure-dragon-crown.webp",
  10027: "/game-assets/treasures/jade-scroll.webp",
  10028: "/game-assets/equipment/mystic-weapon.webp",
  10029: "/game-assets/equipment/blood-spear.webp",
  10030: "/game-assets/equipment/blood-moon-crown.webp",
  10031: "/game-assets/partners/thunder-lord.webp",
  10032: "/game-assets/equipment/thunder-halberd.webp",
  10033: "/game-assets/treasures/relic-pearl.webp",
  10034: "/game-assets/equipment/moon-boots.webp",
  10035: "/game-assets/treasures/relic-pearl.webp",
  10036: "/game-assets/equipment/samsara-gloves.webp",
  10037: "/game-assets/equipment/thunder-halberd.webp",
  10038: "/game-assets/equipment/vajra-bracers.webp",
};

const skillArtwork = (id: number) => SKILL_ART_BY_ID[id] ?? null;

function skillVisual(data: GameData | null, choice: UpgradeChoice) {
  if (!data || choice.kind === "supply" || choice.kind === "heal") return null;
  const prepared = skillArtwork(choice.id);
  if (prepared) return prepared;
  const level = data.skillLevels.find((row) => Number(row.skillId) === choice.id && Number(row.level) === choice.level)
    ?? data.skillLevels.find((row) => Number(row.skillId) === choice.id);
  const bullet = data.bullets.find((row) => Number(row.id) === Number(level?.bullet?.[0]));
  const path = findEffect(data.manifest, bullet?.model);
  return path ? assetUrl(path) : null;
}

export function MowingGame({ initialWaveId = 1, embedded = false }: { initialWaveId?: number; embedded?: boolean }) {
  const { state: unifiedState, setBattle: setMeta, applyEffects } = useUnifiedGame();
  const [screen, setScreen] = useState<Screen>("loading");
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState("");
  const [heroId, setHeroId] = useState(400001);
  const [waveId, setWaveId] = useState(Math.max(1, Math.min(21, initialWaveId)));
  const [snapshot, setSnapshot] = useState<GameSnapshot>(emptySnapshot);
  const [upgrades, setUpgrades] = useState<UpgradeChoice[]>([]);
  const [rerolls, setRerolls] = useState(1);
  const [result, setResult] = useState<{ kind: RunResult; snapshot: GameSnapshot; accepted: TreasureItem[]; overflow: TreasureItem[]; equipmentOverflow: EquipmentItem[]; experience: number; levelsGained: number; skillBooks: number } | null>(null);
  const [toast, setToast] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const meta = unifiedState.battle;
  const [menuPanel, setMenuPanel] = useState<"warehouse" | "upgrades" | "equipment" | "cards" | "character" | "skills" | "wm" | null>(null);
  const [loot, setLoot] = useState<LootOffer | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [phaseAlert, setPhaseAlert] = useState<{ name: string; subtitle: string } | null>(null);
  const [battleCeremony, setBattleCeremony] = useState<BattleCeremony | null>(null);
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
        setScreen(embedded ? "preparing" : "menu");
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "资源加载失败");
      });
    return () => {
      active = false;
      engineRef.current?.destroy();
      if (phaseTimer.current) clearTimeout(phaseTimer.current);
      if (partnerTimer.current) clearTimeout(partnerTimer.current);
      if (ceremonyTimer.current) clearTimeout(ceremonyTimer.current);
    };
  }, [embedded]);

  const selectedHero = useMemo(() => data?.heroes.find((hero) => Number(hero.id) === heroId), [data, heroId]);
  const selectedWave = useMemo(() => data?.waves.find((wave) => Number(wave.id) === waveId), [data, waveId]);
  const mapId = 1000 + clampWave(waveId) - 1;
  const selectedMap = useMemo(() => data?.maps.find((map) => Number(map.id) === mapId) ?? data?.maps[0], [data, mapId]);
  const menuBackground = "/game-assets/ui/main-menu-xianxia-bg.webp";
  const passiveCardBonuses = useMemo(() => unifiedState.shared.cards.filter((card) => card.mode === "passive").map((card) => card.bonuses), [unifiedState.shared.cards]);
  const permanentAttributes = useMemo(() => addAttributes(computePermanentAttributes(meta), ...passiveCardBonuses), [meta, passiveCardBonuses]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  }, []);

  const requestCardSummon = useCallback(() => {
    const pool = unifiedState.shared.cards.filter((card) => card.mode === "active").sort(() => Math.random() - .5).slice(0, 3);
    if (!pool.length) return showToast("太虚名册中尚无主动人物卡");
    engineRef.current?.setInventoryPaused(true);
    setCardChoices(pool);
  }, [showToast, unifiedState.shared.cards]);

  const chooseCardSummon = (card: UnifiedCardInstance) => {
    const partnerId = card.activeEffect === "healing" ? "pill-fairy" : card.activeEffect === "ward" ? "vajra-monk" : card.activeEffect === "frost" ? "moon-demon" : card.activeEffect === "assault" ? "thunder-lord" : "sword-sister";
    setCardChoices([]);
    engineRef.current?.setInventoryPaused(false);
    engineRef.current?.summonPartner(partnerId);
  };

  const beginBattle = useCallback(async () => {
    if (!data || !canvasRef.current) return;
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
    const settings: GameSettings = {
      heroId,
      waveId,
      mapId,
      backpackSize: backpackSize(meta.backpackLevel),
      safeSize: safeSize(meta.safeLevel),
      baseAttributes: permanentAttributes,
      combatTraits: computeCombatTraits(meta.passiveRanks),
      wmConfig: meta.wmPublished,
      availableSkillIds: learnedSkillIds(meta.skillMastery),
      skillDamageBonuses: skillDamageBonuses(meta.skillMastery),
    };
    const engine = new BattleEngine(canvasRef.current, data, settings, {
      onSnapshot: setSnapshot,
      onUpgrade: (choices, remaining) => {
        setUpgrades(choices);
        setRerolls(remaining);
      },
      onGameOver: (kind, finalSnapshot) => {
        const settlement = settleExpedition(meta, kind, finalSnapshot.backpack, finalSnapshot.safeBox, finalSnapshot.runEquipment);
        const progression = kind === "victory" ? awardClearExperience(settlement.meta, waveId) : { meta: settlement.meta, gained: 0, levelsGained: 0 };
        const bookReward = awardSkillBooks(progression.meta, kind, waveId);
        setMeta(bookReward.meta);
        const rarityMap: Record<string, UnifiedRarity> = { common: 1, fine: 2, rare: 3, epic: 4, immortal: 6 };
        applyEffects([
          { type: "complete_dungeon", waveId, result: kind },
          ...settlement.accepted.map((item) => {
            const definition = treasureById(item.treasureId);
            return { type: "add_item" as const, item: { itemId: `treasure:${item.treasureId}`, itemType: "treasure" as const, rarity: rarityMap[definition.rarity] ?? 1, amount: 1, sourceTags: ["battle", `wave-${waveId}`] } };
          }),
          ...(kind === "victory" ? [{ type: "add_item" as const, item: { itemId: ALCHEMY_MATERIALS[(waveId * 11) % ALCHEMY_MATERIALS.length].id, itemType: "material" as const, rarity: Math.min(7, 2 + Math.floor(waveId / 4)) as UnifiedRarity, amount: 1, sourceTags: ["battle", "alchemy", `wave-${waveId}`] } }] : []),
        ]);
        setResult({ kind, snapshot: finalSnapshot, accepted: settlement.accepted, overflow: settlement.overflow, equipmentOverflow: settlement.equipmentOverflow, experience: progression.gained, levelsGained: progression.levelsGained, skillBooks: bookReward.gained });
        const endingCopy = kind === "victory"
          ? { eyebrow: "妖王伏诛", title: "秘境镇压", subtitle: "一念斩群妖 · 清气复山河", seal: "胜" }
          : kind === "extracted"
            ? { eyebrow: "归途既现", title: "全身而退", subtitle: "守住所得 · 来日再问长生", seal: "归" }
            : { eyebrow: "道心未泯", title: "暂退此境", subtitle: "胜败如云烟 · 重整亦是修行", seal: "修" };
        setBattleCeremony({ phase: "ending", tone: kind, ...endingCopy });
        ceremonyTimer.current = setTimeout(() => {
          setBattleCeremony(null);
          setScreen("result");
        }, 3300);
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
        partnerTimer.current = setTimeout(() => setPartnerCast(null), 7000);
      },
    });
    engineRef.current = engine;
    try {
      await engine.prepare();
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
      ceremonyTimer.current = setTimeout(() => {
        setBattleCeremony(null);
        if (engineRef.current === engine) engine.start();
      }, 3700);
    } catch (reason) {
      setBattleCeremony(null);
      setError(reason instanceof Error ? reason.message : "战场初始化失败");
      setScreen("menu");
    }
  }, [applyEffects, data, heroId, mapId, meta, permanentAttributes, requestCardSummon, setMeta, showToast, waveId]);

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
              {data.heroes.map((hero) => (
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
                  <small>{data.skills.find((skill) => Number(skill.resId) === Number(hero.weapon))?.name ?? "本命法器"}</small>
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
              {snapshot.skills.map((skill) => { const art = skillArtwork(skill.id); return <div key={skill.id} className={`skill-orb ${skill.evolved ? "evolved" : ""}`} title={skill.name}>{art ? <img src={art} alt="" /> : <span>{skill.name.slice(0, 1)}</span>}<b>{skill.level}</b></div>; })}
              {Array.from({ length: Math.max(0, 6 - snapshot.skills.length) }).map((_, index) => <div className="skill-orb empty" key={`skill-${index}`} />)}
            </div>
            <div className="skill-rack supplies">
              {snapshot.supplies.map((supply) => <div key={supply.id} className="skill-orb" title={supply.name}><span>{supply.name.slice(0, 1)}</span><b>{supply.level}</b></div>)}
            </div>
          </div>

          <div className="bottom-status">
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
                    return <article key={item.uid} className="loot-equipment" style={{ "--rarity": RARITY_META[item.rarity ?? base.rarity].color } as CSSProperties}><img src={base.art} alt="" /><div><small>随机装备 · {RARITY_META[item.rarity ?? base.rarity].name}</small><strong>{item.name ?? base.name}</strong><p>{formatBonus(item.bonuses ?? base.bonuses).join(" · ")}</p></div><div className="loot-actions"><button onClick={() => engineRef.current?.takeEquipment(item.uid)}>收入装备背包</button></div></article>;
                  })}
                </div>
                <div className="loot-targets">
                  <p>拖拽宝物到指定格子，红色格子表示尺寸冲突。</p>
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
              <button onClick={() => { engineRef.current?.destroy(); if (embedded && window.parent !== window) window.parent.postMessage({ type: "huaian-close-module", settled: true }, window.location.origin); else setScreen("menu"); }}>{embedded ? "返回山河" : "返回选择"}</button>
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
              <div><button className="inventory-sort" onClick={() => updateMeta(sortTreasureContainer(meta, "warehouse"))}>整理个人仓库</button><InventoryGrid title="个人仓库" items={meta.warehouse} size={warehouseSize(meta.warehouseLevel)} actionLabel="移入行囊" onAction={(uid) => { const result = transferTreasure(meta, uid, "backpack"); updateMeta(result.meta); showToast(result.message); }} secondaryActionLabel="出售" onSecondaryAction={(uid) => updateMeta(sellTreasure(meta, uid))} /></div>
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
            <CardSystem meta={meta} onChange={updateMeta} />
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

const WM_STAT_LABELS: Record<WMAttributeKey, string> = { health: "生命", mana: "灵力", defense: "护甲", damage: "伤害", weaponMinDamage: "武伤下限", weaponMaxDamage: "武伤上限", hitChance: "命中", strength: "体魄", dexterity: "身法", magic: "神识", fireResist: "离火抗性", lightningResist: "玄雷抗性", magicResist: "术法抗性", dodge: "闪避", moveSpeed: "移速", expGain: "经验", attackSpeed: "攻速", projectileSpeed: "弹速" };

function skillArtById(data: GameData, skillId: number) {
  const level = data.skillLevels.find((row) => Number(row.skillId) === skillId && Number(row.level) === 1)
    ?? data.skillLevels.find((row) => Number(row.skillId) === skillId);
  const bullet = data.bullets.find((row) => Number(row.id) === Number(level?.bullet?.[0]));
  const path = findEffect(data.manifest, bullet?.model);
  return path ? assetUrl(path) : null;
}

function SkillStudySystem({ data, meta, onChange, notify }: { data: GameData; meta: MetaProgress; onChange: (meta: MetaProgress) => void; notify: (message: string) => void }) {
  const [selectedId, setSelectedId] = useState(SKILL_MANUALS[0].baseId);
  const [filter, setFilter] = useState<"all" | "learned" | "locked">("all");
  const selected = SKILL_MANUALS.find((manual) => manual.baseId === selectedId) ?? SKILL_MANUALS[0];
  const selectedState = meta.skillMastery[String(selected.baseId)];
  const baseSkill = data.skills.find((skill) => Number(skill.resId) === selected.baseId);
  const evolutionSkill = data.skills.find((skill) => Number(skill.resId) === selected.evolutionId);
  const baseLevel = data.skillLevels.find((level) => Number(level.skillId) === selected.baseId && Number(level.level) === 1);
  const evolutionLevel = data.skillLevels.find((level) => Number(level.skillId) === selected.evolutionId && Number(level.level) === 6);
  const evolution = data.evolutions.find((entry) => Number(entry.skillId) === selected.evolutionId);
  const ready = skillUnlockReady(meta.playerLevel, meta.highestUnlockedWave, selected);
  const maxed = selectedState.level >= MAX_SKILL_MASTERY_LEVEL;
  const nextExp = skillMasteryExpToNext(selectedState.level);
  const currentDamage = Math.round((skillMasteryDamageMultiplier(selectedState.level) - 1) * 100);
  const nextDamage = Math.round((skillMasteryDamageMultiplier(Math.min(MAX_SKILL_MASTERY_LEVEL, selectedState.level + 1)) - 1) * 100);
  const visibleManuals = SKILL_MANUALS.filter((manual) => {
    const learned = meta.skillMastery[String(manual.baseId)]?.learned;
    return filter === "all" || (filter === "learned" ? learned : !learned);
  });

  const requirementName = (id: number) => data.skills.find((skill) => Number(skill.resId) === id)?.name
    ?? data.supplies.find((supply) => Number(supply.resId) === id)?.name
    ?? `秘术 ${id}`;

  const unlockSelected = () => {
    if (!ready) return notify(`尚需人物等级 ${selected.unlockLevel}，并通关至第 ${Math.max(1, (selected.unlockWave ?? 1) - 1)} 关`);
    onChange(learnMetaSkill(meta, selected.baseId));
    notify(`参悟成功 · ${baseSkill?.name ?? "无名秘术"} 已习得`);
  };

  const feedBooks = (count: number) => {
    if (!meta.skillBooks) return notify("悟道残卷不足，可通过镇压秘境获得");
    const before = selectedState.level;
    const next = feedSkillExperience(meta, selected.baseId, count);
    onChange(next);
    const after = next.skillMastery[String(selected.baseId)].level;
    notify(after > before ? `${baseSkill?.name} 提升至场外 ${after} 级` : `已注入 ${Math.min(count, meta.skillBooks)} 卷悟道残卷`);
  };

  return (
    <div className="skill-study-system">
      <div className="skill-study-toolbar">
        <div><small>万法总览</small><strong>已习得 {Object.values(meta.skillMastery).filter((skill) => skill.learned).length} / {SKILL_MANUALS.length}</strong></div>
        <nav aria-label="技能筛选">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全部</button>
          <button className={filter === "learned" ? "active" : ""} onClick={() => setFilter("learned")}>已习得</button>
          <button className={filter === "locked" ? "active" : ""} onClick={() => setFilter("locked")}>未参悟</button>
        </nav>
        <div className="skill-book-counter"><i>卷</i><span><small>悟道残卷</small><b>{meta.skillBooks}</b></span></div>
      </div>

      <div className="skill-study-layout">
        <section className="skill-manual-gallery">
          <div className="gallery-rune rune-one">乾</div><div className="gallery-rune rune-two">坤</div>
          {visibleManuals.map((manual, index) => {
            const state = meta.skillMastery[String(manual.baseId)];
            const skill = data.skills.find((entry) => Number(entry.resId) === manual.baseId);
            const evolved = data.skills.find((entry) => Number(entry.resId) === manual.evolutionId);
            const art = skillArtById(data, manual.baseId);
            const unlockable = !state.learned && skillUnlockReady(meta.playerLevel, meta.highestUnlockedWave, manual);
            return (
              <button
                key={manual.baseId}
                className={`skill-manual ${selected.baseId === manual.baseId ? "selected" : ""} ${state.learned ? "learned" : "locked"} ${unlockable ? "unlockable" : ""}`}
                onClick={() => setSelectedId(manual.baseId)}
                style={{ "--manual-order": index } as CSSProperties}
              >
                <span className="manual-index">{String(SKILL_MANUALS.indexOf(manual) + 1).padStart(2, "0")}</span>
                <i className="manual-art" style={{ backgroundImage: art ? `url("${art}")` : "none" }}><b>{manual.element}</b></i>
                <span className="manual-copy"><small>{manual.school}</small><strong>{skill?.name}</strong><em>化境 · {evolved?.name}</em></span>
                <span className="manual-state">{state.learned ? `外修 ${state.level} 重` : unlockable ? "可参悟" : "未习得"}</span>
              </button>
            );
          })}
          {!visibleManuals.length && <p className="skill-gallery-empty">此卷暂无秘术记载</p>}
        </section>

        <aside className={`skill-study-detail ${selectedState.learned ? "learned" : "locked"}`}>
          <div className="skill-detail-sigil"><i /><i /><span>{selected.element}</span></div>
          <div className="skill-detail-heading">
            <small>{selected.school} · {selected.element}行</small>
            <h3>{baseSkill?.name}</h3>
            <p>{selected.verse}</p>
            <span className="skill-learn-seal">{selectedState.learned ? "已习" : "未悟"}</span>
          </div>

          <div className="skill-evolution-line">
            <span><small>初境</small><b>{baseSkill?.name}</b></span><i>流转</i><span><small>化境</small><b>{evolutionSkill?.name}</b></span>
          </div>

          <div className="skill-effect-scroll">
            <article><small>副本效果</small><p>{baseLevel?.desc ?? baseSkill?.desc ?? "施展秘法攻击妖物。"}</p></article>
            <article><small>化境真意</small><p>{evolutionLevel?.desc ?? "突破极限，演化为超武。"}</p></article>
            <article className="evolution-needs"><small>进化条件</small><p>{(evolution?.need ?? []).map((need: AnyRow) => `${requirementName(Number(need.resId))} ${need.level}级`).join(" ＋ ")}</p></article>
          </div>

          {selectedState.learned ? (
            <div className="skill-mastery-altar">
              <div className="mastery-level"><small>场外修习</small><b>{selectedState.level}</b><span>/ {MAX_SKILL_MASTERY_LEVEL} 重</span></div>
              <div className="mastery-bonus"><small>本系技能伤害</small><strong>+{currentDamage}%</strong>{!maxed && <span>下一级 +{nextDamage}%</span>}</div>
              <div className="mastery-exp"><i><u style={{ width: `${maxed ? 100 : Math.min(100, selectedState.exp / nextExp * 100)}%` }} /></i><span>{maxed ? "功法圆满" : `${selectedState.exp} / ${nextExp} 技能经验`}</span></div>
              <div className="mastery-actions">
                <button disabled={maxed || meta.skillBooks < 1} onClick={() => feedBooks(1)}>注入一卷 <small>+{SKILL_BOOK_EXP} 经验</small></button>
                <button disabled={maxed || meta.skillBooks < 1} onClick={() => feedBooks(5)}>连悟五卷 <small>最多消耗5卷</small></button>
              </div>
              <p>场外修习只增强该流派的伤害，不改变局内升级、弹道与进化条件；进化技能继承同一加成。</p>
            </div>
          ) : (
            <div className={`skill-unlock-inscription ${ready ? "ready" : ""}`}>
              <small>参悟门槛</small>
              <p><span className={meta.playerLevel >= (selected.unlockLevel ?? 1) ? "met" : ""}>修士等级 {selected.unlockLevel ?? 1}</span><i>·</i><span className={meta.highestUnlockedWave >= (selected.unlockWave ?? 1) ? "met" : ""}>通关第 {Math.max(1, (selected.unlockWave ?? 1) - 1)} 关</span></p>
              <button disabled={!ready} onClick={unlockSelected}>{ready ? "焚香参悟此术" : "机缘未至"}</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function WeaponManager({ meta, onChange, notify }: { meta: MetaProgress; onChange: (meta: MetaProgress) => void; notify: (message: string) => void }) {
  const [tab, setTab] = useState<"equipment" | "affixes" | "treasures" | "json">("equipment");
  const [selectedId, setSelectedId] = useState(meta.wmDraft.equipment[0]?.equipmentId ?? "");
  const [json, setJson] = useState(() => JSON.stringify(meta.wmDraft, null, 2));
  const draft = meta.wmDraft;
  const updateDraft = (next: WMConfig) => onChange({ ...meta, wmDraft: next });
  const updateRule = (next: WMEquipmentRule) => updateDraft({ ...draft, equipment: draft.equipment.map((rule) => rule.equipmentId === next.equipmentId ? next : rule) });
  const selected = draft.equipment.find((rule) => rule.equipmentId === selectedId) ?? draft.equipment[0];
  const publish = () => { onChange({ ...meta, wmDraft: draft, wmPublished: cloneWMConfig(draft), wmPublishedAt: Date.now() }); notify("WM配置已发布，新副本将使用此版本"); };
  return <div className="weapon-manager">
    <nav><button className={tab === "equipment" ? "active" : ""} onClick={() => setTab("equipment")}>武器装备</button><button className={tab === "affixes" ? "active" : ""} onClick={() => setTab("affixes")}>词条池</button><button className={tab === "treasures" ? "active" : ""} onClick={() => setTab("treasures")}>物品掉落</button><button className={tab === "json" ? "active" : ""} onClick={() => { setJson(JSON.stringify(draft, null, 2)); setTab("json"); }}>结构体注入</button><button className="wm-publish" onClick={publish}>发布到游戏</button></nav>
    {tab === "equipment" && selected && <div className="wm-equipment-layout"><aside>{draft.equipment.map((rule) => { const gear = equipmentById(rule.equipmentId); return <button key={rule.equipmentId} className={selected.equipmentId === rule.equipmentId ? "active" : ""} onClick={() => setSelectedId(rule.equipmentId)}><img src={gear.art} alt="" /><span><b>{gear.name}</b><small>{SLOT_META[gear.slot].name} · {RARITY_META[rule.rarity].name}</small></span></button>; })}</aside><section className="wm-rule-editor"><div className="wm-fields"><label>启用<input type="checkbox" checked={selected.enabled} onChange={(e) => updateRule({ ...selected, enabled: e.target.checked })} /></label><label>品质<select value={selected.rarity} onChange={(e) => updateRule({ ...selected, rarity: e.target.value as typeof selected.rarity })}>{Object.entries(RARITY_META).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}</select></label><label>基础价格<input type="number" value={selected.price} onChange={(e) => updateRule({ ...selected, price: +e.target.value })} /></label><label>基础掉率<input type="range" min="0" max="1" step=".005" value={selected.dropChance} onChange={(e) => updateRule({ ...selected, dropChance: +e.target.value })} /><b>{Math.round(selected.dropChance * 1000) / 10}%</b></label><label>通用副本<input type="checkbox" checked={selected.universal} onChange={(e) => updateRule({ ...selected, universal: e.target.checked })} /></label><label>关卡列表<input value={selected.waves.join(",")} disabled={selected.universal} onChange={(e) => updateRule({ ...selected, waves: e.target.value.split(",").map(Number).filter((v) => v >= 1 && v <= 21) })} placeholder="1,2,5" /></label></div><WMStatEditor title="绑定属性（必出）" stats={selected.boundStats} onChange={(boundStats) => updateRule({ ...selected, boundStats })} /><WMStatEditor title={`选取属性（随机 ${selected.optionalPick}/${selected.optionalStats.length}）`} stats={selected.optionalStats} onChange={(optionalStats) => updateRule({ ...selected, optionalStats })} extra={<input type="number" min="0" max={selected.optionalStats.length} value={selected.optionalPick} onChange={(e) => updateRule({ ...selected, optionalPick: +e.target.value })} />} /><div className="wm-affix-picks"><h4>可用词条 <small>命中后最多截断 <input type="number" min="0" max="8" value={selected.affixCap} onChange={(e) => updateRule({ ...selected, affixCap: +e.target.value })} /> 条</small></h4>{draft.affixes.map((affix) => <label key={affix.id}><input type="checkbox" checked={selected.affixIds.includes(affix.id)} onChange={(e) => updateRule({ ...selected, affixIds: e.target.checked ? [...selected.affixIds, affix.id] : selected.affixIds.filter((id) => id !== affix.id) })} />{affix.name}<small>{Math.round(affix.chance * 100)}%</small></label>)}</div></section></div>}
    {tab === "affixes" && <div className="wm-affix-list">{draft.affixes.map((affix) => <article key={affix.id}><div><input value={affix.name} onChange={(e) => updateDraft({ ...draft, affixes: draft.affixes.map((a) => a.id === affix.id ? { ...a, name: e.target.value } : a) })} /><label>出现概率<input type="range" min="0" max="1" step=".01" value={affix.chance} onChange={(e) => updateDraft({ ...draft, affixes: draft.affixes.map((a) => a.id === affix.id ? { ...a, chance: +e.target.value } : a) })} />{Math.round(affix.chance * 100)}%</label></div><WMStatEditor title="词条属性" stats={affix.stats} onChange={(stats) => updateDraft({ ...draft, affixes: draft.affixes.map((a) => a.id === affix.id ? { ...a, stats } : a) })} /></article>)}</div>}
    {tab === "treasures" && <div className="wm-treasure-table"><header><b>物品</b><b>价格</b><b>出现权重</b><b>范围</b><b>关卡列表</b></header>{draft.treasures.map((rule) => { const item = treasureById(rule.treasureId); return <article key={rule.treasureId}><label><input type="checkbox" checked={rule.enabled} onChange={(e) => updateDraft({ ...draft, treasures: draft.treasures.map((r) => r.treasureId === rule.treasureId ? { ...r, enabled: e.target.checked } : r) })} />{item.name}<small>{RARITY_META[item.rarity].name}</small></label><input type="number" value={rule.price} onChange={(e) => updateDraft({ ...draft, treasures: draft.treasures.map((r) => r.treasureId === rule.treasureId ? { ...r, price: +e.target.value } : r) })} /><input type="number" min="0" step=".05" value={rule.dropChance} onChange={(e) => updateDraft({ ...draft, treasures: draft.treasures.map((r) => r.treasureId === rule.treasureId ? { ...r, dropChance: +e.target.value } : r) })} /><button onClick={() => updateDraft({ ...draft, treasures: draft.treasures.map((r) => r.treasureId === rule.treasureId ? { ...r, universal: !r.universal } : r) })}>{rule.universal ? "全部副本" : "指定副本"}</button><input disabled={rule.universal} value={rule.waves.join(",")} placeholder="1,2,5" onChange={(e) => updateDraft({ ...draft, treasures: draft.treasures.map((r) => r.treasureId === rule.treasureId ? { ...r, waves: e.target.value.split(",").map(Number).filter((v) => v >= 1 && v <= 21) } : r) })} /></article>; })}</div>}
    {tab === "json" && <div className="wm-json"><p>可复制当前结构体批量修改后重新注入。注入只更新草稿，仍需点击发布。</p><textarea value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} /><div><button onClick={() => { setJson(JSON.stringify(DEFAULT_WM_CONFIG, null, 2)); }}>载入默认结构</button><button onClick={() => { try { const next = validateWMConfig(JSON.parse(json)); updateDraft(next); notify("结构体已注入草稿"); } catch (error) { notify(error instanceof Error ? error.message : "结构体无效"); } }}>注入草稿</button></div></div>}
  </div>;
}

function WMStatEditor({ title, stats, onChange, extra }: { title: string; stats: WMEquipmentRule["boundStats"]; onChange: (stats: WMEquipmentRule["boundStats"]) => void; extra?: ReactNode }) {
  return <div className="wm-stat-editor"><h4>{title}{extra}</h4>{stats.map((entry, index) => <div key={`${entry.key}-${index}`}><select value={entry.key} onChange={(e) => onChange(stats.map((row, i) => i === index ? { ...row, key: e.target.value as WMAttributeKey } : row))}>{Object.entries(WM_STAT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><label>最小<input type="number" step=".005" value={entry.min} onChange={(e) => onChange(stats.map((row, i) => i === index ? { ...row, min: +e.target.value } : row))} /></label><label>最大<input type="number" step=".005" value={entry.max} onChange={(e) => onChange(stats.map((row, i) => i === index ? { ...row, max: +e.target.value } : row))} /></label><button onClick={() => onChange(stats.filter((_, i) => i !== index))}>×</button></div>)}<button onClick={() => onChange([...stats, { key: "damage", min: .03, max: .08 }])}>＋ 添加属性</button></div>;
}

const ALLOCATION_META: Array<{ key: keyof AttributeAllocation; name: string; description: string }> = [
  { key: "health", name: "体魄", description: `每点生命 +${ATTRIBUTE_POINT_BONUS.health}` },
  { key: "defense", name: "护体", description: `每点防御 +${ATTRIBUTE_POINT_BONUS.defense}` },
  { key: "damage", name: "道法", description: `每点伤害 +${ATTRIBUTE_POINT_BONUS.damage * 100}%` },
  { key: "attackSpeed", name: "御器", description: `每点攻速 +${ATTRIBUTE_POINT_BONUS.attackSpeed * 100}%` },
  { key: "dodge", name: "身法", description: `每点闪避 +${ATTRIBUTE_POINT_BONUS.dodge * 100}%` },
  { key: "moveSpeed", name: "疾行", description: `每点移速 +${ATTRIBUTE_POINT_BONUS.moveSpeed}` },
];

function CharacterProgression({ meta, relationships, onChange }: { meta: MetaProgress; relationships: Record<string, number>; onChange: (meta: MetaProgress) => void }) {
  const [section, setSection] = useState<"attributes" | "skills">("attributes");
  const [page, setPage] = useState<BlessingPage>("sister");
  const [selectedSkill, setSelectedSkill] = useState(PASSIVE_SKILLS[0].id);
  const attrPoints = availableAttributePoints(meta);
  const skillPoints = availableSkillPoints(meta);
  const selected = PASSIVE_SKILLS.find((skill) => skill.id === selectedSkill) ?? PASSIVE_SKILLS[0];
  const addAttribute = (key: keyof AttributeAllocation) => {
    if (attrPoints <= 0) return;
    onChange({ ...meta, attributeAllocation: { ...meta.attributeAllocation, [key]: meta.attributeAllocation[key] + 1 } });
  };
  const addPassive = () => {
    const rank = meta.passiveRanks[selected.id] ?? 0;
    if (skillPoints <= 0 || rank >= selected.maxRank || !passiveSkillUnlocked(meta.passiveRanks, selected, relationships)) return;
    onChange({ ...meta, passiveRanks: { ...meta.passiveRanks, [selected.id]: rank + 1 } });
  };
  const prerequisite = selected.requires ? PASSIVE_SKILLS.find((skill) => skill.id === selected.requires) : null;
  const selectedUnlocked = passiveSkillUnlocked(meta.passiveRanks, selected, relationships);
  return (
    <div className={`character-progression page-${section}`}>
      <nav className="progression-pagination" aria-label="人物成长分页">
        <button className={section === "attributes" ? "active" : ""} onClick={() => setSection("attributes")}><small>第一页</small><b>人物属性</b><span>{attrPoints} 点可用</span></button>
        <i>‹</i><button className={section === "skills" ? "active" : ""} onClick={() => setSection("skills")}><small>第二页</small><b>赐福技能树</b><span>{skillPoints} 点可用</span></button>
        <button className="page-turn" onClick={() => setSection(section === "attributes" ? "skills" : "attributes")}>{section === "attributes" ? "下一页 · 技能树 ›" : "‹ 上一页 · 人物属性"}</button>
      </nav>
      {section === "attributes" && <section className="attribute-allocation progression-page">
        <div className="point-heading"><div><small>可用属性点</small><b>{attrPoints}</b></div><span>每级获得 5 点</span></div>
        <div className="attribute-list">
          {ALLOCATION_META.map((entry) => (
            <article key={entry.key}>
              <div><strong>{entry.name}</strong><small>{entry.description}</small></div>
              <b>{meta.attributeAllocation[entry.key]}</b>
              <button disabled={attrPoints <= 0} onClick={() => addAttribute(entry.key)}>＋</button>
            </article>
          ))}
        </div>
        <p>属性点会永久增强副本外基础属性，装备和卡片在此基础上继续加成。</p>
      </section>}
      {section === "skills" && <section className={`blessing-tree progression-page blessing-${page}`}>
        <div className="blessing-tabs">
          {(Object.keys(BLESSING_META) as BlessingPage[]).map((key) => <button key={key} className={page === key ? "active" : ""} onClick={() => { setPage(key); setSelectedSkill(PASSIVE_SKILLS.find((skill) => skill.page === key)!.id); }}><b>{BLESSING_META[key].name}</b><small>{BLESSING_META[key].subtitle}</small></button>)}
        </div>
        <div className="skill-point-line"><span>可用技能点 <b>{skillPoints}</b></span><small>每级获得 1 点</small></div>
        <div className="passive-skill-tree">
          {PASSIVE_SKILLS.filter((skill) => skill.page === page).map((skill) => {
            const rank = meta.passiveRanks[skill.id] ?? 0;
            const unlocked = passiveSkillUnlocked(meta.passiveRanks, skill, relationships);
            return <button key={skill.id} style={{ gridColumn: skill.tier + 1, gridRow: skill.branch + 1 }} className={`${selected.id === skill.id ? "selected" : ""} ${rank >= skill.maxRank ? "maxed" : ""} ${unlocked ? "unlocked" : "locked"} ${skill.tier === 0 ? "root-skill" : ""}`} onClick={() => setSelectedSkill(skill.id)}><em aria-hidden="true" /><i>{unlocked ? skill.icon : "锁"}</i><strong>{skill.name}</strong><span>{rank}/{skill.maxRank}</span></button>;
          })}
        </div>
        <article className="passive-detail">
          <i>{selectedUnlocked ? selected.icon : "锁"}</i><div><small>{BLESSING_META[selected.page].name} · 第 {selected.tier + 1} 重</small><h3>{selected.name}</h3><p>{selected.description}</p><b>{selectedUnlocked ? `当前等级 ${meta.passiveRanks[selected.id] ?? 0} / ${selected.maxRank}` : `需先升满「${prerequisite?.name ?? "前置心法"}」`}</b></div>
          <button disabled={skillPoints <= 0 || !selectedUnlocked || (meta.passiveRanks[selected.id] ?? 0) >= selected.maxRank} onClick={addPassive}>{!selectedUnlocked ? "前置未圆满" : (meta.passiveRanks[selected.id] ?? 0) >= selected.maxRank ? "已经满级" : "消耗 1 点强化"}</button>
        </article>
      </section>}
    </div>
  );
}

function EquipmentSystem({ meta, onChange, notify }: { meta: MetaProgress; onChange: (meta: MetaProgress) => void; notify: (message: string) => void }) {
  const [heldUid, setHeldUid] = useState<string | null>(null);
  const [selectedUid, setSelectedUid] = useState(meta.equipmentBag[0]?.uid ?? null);
  const attributes = computePermanentAttributes(meta);
  const stored = meta.equipmentBag.filter((item) => meta.equipmentPositions[item.uid]);
  const selected = meta.equipmentBag.find((item) => item.uid === selectedUid) ?? stored[0];
  const bodySlots: EquipmentBodySlot[] = ["head", "chest", "hands", "legs", "feet", "weapon", "offhand"];
  const slotName = (slot: EquipmentBodySlot) => slot === "offhand" ? { name: "副手", mark: "辅" } : SLOT_META[slot];
  const equip = (uid: string) => { const result = tryEquipItem(meta, uid); onChange(result.meta); notify(result.message); if (result.ok) setHeldUid(null); };
  const unequip = (slot: EquipmentBodySlot) => { const result = tryUnequipItem(meta, slot); onChange(result.meta); notify(result.message); };
  const identify = (uid: string) => { const result = identifyEquipment(meta, uid); onChange(result.meta); notify(result.message); };
  const place = (uid: string, x: number, y: number) => { const next = moveEquipment(meta, uid, x, y); if (next === meta) notify("此处放不下，或交换后的法器无处安放"); else { onChange(next); setHeldUid(null); } };

  return (
    <div className="equipment-layout devilution-equipment">
      <section className="equipment-doll">
        <div className="doll-silhouette"><i className="doll-head" /><i className="doll-body" /><i className="doll-arms" /><i className="doll-legs" /></div>
        {bodySlots.map((slot) => {
          const uid = meta.equipped[slot];
          const item = meta.equipmentBag.find((entry) => entry.uid === uid);
          const definition = item ? equipmentById(item.equipmentId) : null;
          const enabled = item ? canUseEquipment(item, attributes) : true;
          return <button key={slot} className={`gear-slot slot-${slot} ${definition ? `rarity-${item?.rarity ?? definition.rarity}` : "empty"} ${enabled ? "" : "disabled-gear"}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const draggedUid = event.dataTransfer.getData("application/x-blcx-equipment"); if (draggedUid) equip(draggedUid); }} onClick={() => uid && unequip(slot)} title={definition ? `${item?.name ?? definition.name}（点击卸下）` : slotName(slot).name}>
            {definition ? <><img src={definition.art} alt="" />{item?.twoHanded && <em>双手</em>}{!enabled && <b>失效</b>}</> : <><b>{slotName(slot).mark}</b><small>{slotName(slot).name}</small></>}
          </button>;
        })}
        <aside className="requirement-readout"><span>体魄 <b>{Math.floor(attributes.strength)}</b></span><span>身法 <b>{Math.floor(attributes.dexterity)}</b></span><span>神识 <b>{Math.floor(attributes.magic)}</b></span></aside>
      </section>
      <section className="gear-backpack tetris-pack">
        <header><div><h3>乾坤行囊 <small>10×4 · 40 格</small></h3><p>点击拿起再点格子，或直接拖拽；可与一件法器原子交换。</p></div><button onClick={() => { onChange(sortEquipment(meta)); notify("行囊已按高度、宽度压缩整理"); }}>一键整理</button></header>
        <div className="gear-pack-workspace">
          <div className="gear-tetris-grid" aria-label="10乘4法器背包">
            {Array.from({ length: 40 }).map((_, index) => { const x = index % 10; const y = Math.floor(index / 10); return <i key={index} data-cell={`${x}-${y}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const uid = event.dataTransfer.getData("application/x-blcx-equipment"); if (uid) place(uid, x, y); }} onClick={() => heldUid && place(heldUid, x, y)} />; })}
            {stored.map((item) => {
              const definition = equipmentById(item.equipmentId); const point = meta.equipmentPositions[item.uid]; const size = equipmentSize(item); const rarity = item.rarity ?? definition.rarity;
              return <article key={item.uid} draggable onDragStart={(event) => event.dataTransfer.setData("application/x-blcx-equipment", item.uid)} onClick={(event) => { event.stopPropagation(); setSelectedUid(item.uid); setHeldUid(heldUid === item.uid ? null : item.uid); }} onDoubleClick={() => equip(item.uid)} className={`rarity-${rarity} ${heldUid === item.uid ? "is-held" : ""} ${item.identified === false ? "unidentified" : ""}`} style={{ gridColumn: `${point.x + 1} / span ${size.width}`, gridRow: `${point.y + 1} / span ${size.height}`, "--rarity": RARITY_META[rarity].color } as CSSProperties}>
                <img src={definition.art} alt="" /><small>{item.identified === false ? "未鉴定" : item.twoHanded ? "双手" : RARITY_META[rarity].name}</small>
              </article>;
            })}
          </div>
          <aside className="gear-inspector">
            {selected ? (() => { const base = equipmentById(selected.equipmentId); const req = equipmentRequirements(selected); const enabled = canUseEquipment(selected, attributes); const size = equipmentSize(selected); return <><div className="gear-inspector-art" style={{ "--rarity": RARITY_META[selected.rarity ?? base.rarity].color } as CSSProperties}><img src={base.art} alt="" /><span>{selected.identified === false ? "未鉴定法器" : RARITY_META[selected.rarity ?? base.rarity].name}</span></div><small>{SLOT_META[base.slot].name} · {size.width}×{size.height}{selected.twoHanded ? " · 占据双手" : ""}</small><h3>{selected.identified === false ? `未鉴定的${base.name}` : selected.name ?? base.name}</h3><p>{base.description}</p><div className="gear-stat-chips">{formatBonus(equipmentAttributeBonus(selected)).map((line) => <span key={line}>{line}</span>)}</div><div className={`gear-requirements ${enabled ? "met" : "failed"}`}><b>驱使要求</b><span>体魄 {req.strength ?? 0}</span><span>身法 {req.dexterity ?? 0}</span><span>神识 {req.magic ?? 0}</span></div><footer><b>估值 {equipmentValue(selected).toLocaleString()} 灵石</b>{selected.identified === false ? <button onClick={() => identify(selected.uid)}>鉴定并激活词缀</button> : <button disabled={!enabled} onClick={() => equip(selected.uid)}>{enabled ? "装备" : "属性不足"}</button>}</footer></>; })() : <p>行囊中暂无法器</p>}
          </aside>
        </div>
      </section>
    </div>
  );
}

function CardSystem({ meta, onChange }: { meta: MetaProgress; onChange: (meta: MetaProgress) => void }) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const quickEquip = (cardId: string) => {
    const open = meta.cardSlots.slice(0, meta.cardSlotCount).findIndex((id) => !id);
    onChange(equipCard(meta, cardId, open >= 0 ? open : 0));
  };
  const detail = detailId ? cardById(detailId) : null;
  return (
    <div className="card-system">
      <aside className="card-slots">
        <h3>命格卡槽</h3>
        {[0, 1, 2].map((index) => {
          const unlocked = index < meta.cardSlotCount;
          const cardId = meta.cardSlots[index];
          const card = cardId ? cardById(cardId) : null;
          return (
            <button
              key={index}
              className={`${unlocked ? "unlocked" : "locked"} ${card ? `rarity-${card.rarity}` : ""}`}
              onDragOver={(event) => unlocked && event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); onChange(equipCard(meta, event.dataTransfer.getData("application/x-blcx-card"), index)); }}
              onClick={() => card && onChange(unequipCard(meta, index))}
            >
              {card ? <><img src={card.art} alt="" /><strong>{card.name}</strong><small>点击卸下</small></> : <><b>{unlocked ? "+" : "锁"}</b><span>{unlocked ? "拖入插入卡" : "尚未解锁"}</span></>}
            </button>
          );
        })}
      </aside>
      <section className="card-gallery-wrap">
        <h3>卡片展廊 <small>单击查看 · 双击插入</small></h3>
        <div className="card-gallery">
          {meta.ownedCards.map((id) => {
            const card = cardById(id);
            return (
              <article
                key={card.id}
                draggable={card.type === "insert"}
                onDragStart={(event) => event.dataTransfer.setData("application/x-blcx-card", card.id)}
                onClick={() => setDetailId(card.id)}
                onDoubleClick={() => card.type === "insert" && quickEquip(card.id)}
                className={`rarity-${card.rarity}`}
              >
                <img src={card.art} alt="" />
                <i /><div><small>{card.type === "insert" ? "插入卡" : "长效卡 · 持有生效"}</small><strong>{card.name}</strong><p>{formatBonus(card.bonuses).join(" · ")}</p></div>
              </article>
            );
          })}
        </div>
      </section>
      {detail && (
        <div className="card-detail-backdrop" onClick={() => setDetailId(null)}>
          <article className={`card-detail rarity-${detail.rarity}`} onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setDetailId(null)}>×</button><img src={detail.art} alt="" />
            <div><small>{RARITY_META[detail.rarity].name} · {detail.type === "insert" ? "插入卡" : "长效卡"}</small><h3>{detail.name}</h3><p>{detail.lore}</p><strong>{formatBonus(detail.bonuses).join(" · ")}</strong>{detail.type === "insert" && <button className="card-equip" onClick={() => { quickEquip(detail.id); setDetailId(null); }}>插入可用卡槽</button>}</div>
          </article>
        </div>
      )}
    </div>
  );
}

function RunEquipmentGrid({ items }: { items: EquipmentItem[] }) {
  const positions = organizeEquipment(items, CULTIVATOR_PACK_SIZE) ?? {};
  return <section className="inventory-section run-gear-pack"><h3>法器战利品<small>{items.length} 件 · 共用 10×4 容量规则</small></h3><div className="gear-tetris-grid">{Array.from({ length: 40 }).map((_, index) => <i key={index} />)}{items.map((item) => { const base = equipmentById(item.equipmentId); const point = positions[item.uid]; const size = equipmentSize(item); const rarity = item.rarity ?? base.rarity; if (!point) return null; return <article key={item.uid} style={{ gridColumn: `${point.x + 1}/span ${size.width}`, gridRow: `${point.y + 1}/span ${size.height}`, "--rarity": RARITY_META[rarity].color } as CSSProperties}><img src={base.art} alt="" /><small>{item.identified === false ? "未鉴定" : item.twoHanded ? "双手" : RARITY_META[rarity].name}</small></article>; })}</div></section>;
}

function InventoryGrid({
  title,
  items,
  size,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  onSort,
  container,
  onPlace,
  held,
  onHeldChange,
}: {
  title: string;
  items: TreasureItem[];
  size: { columns: number; rows: number };
  actionLabel?: string;
  onAction?: (uid: string) => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: (uid: string) => void;
  onSort?: () => void;
  container?: ContainerKind;
  onPlace?: (uid: string, source: ContainerKind | "loot", x: number, y: number) => boolean | undefined;
  held?: HeldTreasure | null;
  onHeldChange?: (held: HeldTreasure | null) => void;
}) {
  const cellSize = size.columns >= 10 ? 40 : 58;
  const cellGap = 3;
  const gridPadding = 5;
  const hasSavedPositions = items.every((item) => "x" in item && "y" in item);
  const placed = hasSavedPositions ? items as PlacedTreasure[] : placeItems(items, size) ?? [];
  return (
    <section className="inventory-section">
      <h3>{title}<small>{items.length} 件 · {size.columns}×{size.rows}</small>{onSort && <button type="button" onClick={onSort}>整理</button>}</h3>
      <div
        className={`treasure-grid ${onPlace ? "droppable" : ""}`}
        style={{
          "--columns": size.columns,
          "--rows": size.rows,
          "--cell-size": `${cellSize}px`,
          width: size.columns * cellSize + (size.columns - 1) * cellGap + gridPadding * 2,
          height: size.rows * cellSize + (size.rows - 1) * cellGap + gridPadding * 2,
        } as CSSProperties}
      >
        {Array.from({ length: size.columns * size.rows }).map((_, index) => {
          const x = index % size.columns;
          const y = Math.floor(index / size.columns);
          return (
            <i
              key={index}
              data-cell={`${x}-${y}`}
              style={{
                left: gridPadding + x * (cellSize + cellGap),
                top: gridPadding + y * (cellSize + cellGap),
              }}
              onDragOver={(event) => {
                if (!onPlace) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                if (!onPlace) return;
                event.preventDefault();
                const payload = readTreasureDrag(event);
                if (payload && onPlace(payload.uid, payload.source, x, y)) onHeldChange?.(null);
              }}
              onClick={() => {
                if (!held || !onPlace) return;
                if (onPlace(held.uid, held.source, x, y)) onHeldChange?.(null);
              }}
            />
          );
        })}
        {placed.map((item) => {
          const treasure = treasureById(item.treasureId);
          return (
            <article
              key={item.uid}
              draggable={Boolean(container && onPlace)}
              onDragStart={(event) => container && writeTreasureDrag(event, item.uid, container)}
              onClick={(event) => {
                event.stopPropagation();
                if (!container || !onHeldChange) return;
                if (held) {
                  if (held.uid === item.uid && held.source === container) onHeldChange(null);
                  else if (onPlace?.(held.uid, held.source, item.x, item.y)) onHeldChange(null);
                  return;
                }
                onHeldChange({ uid: item.uid, source: container, treasureId: item.treasureId });
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onAction?.(item.uid);
                onHeldChange?.(null);
              }}
              onDragOver={(event) => {
                if (!onPlace) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                if (!onPlace) return;
                event.preventDefault();
                event.stopPropagation();
                const payload = readTreasureDrag(event);
                if (payload && onPlace(payload.uid, payload.source, item.x, item.y)) onHeldChange?.(null);
              }}
              className={`inventory-item rarity-${treasure.rarity} ${held?.uid === item.uid && held.source === container ? "is-held" : ""}`}
              data-grid-x={item.x}
              data-grid-y={item.y}
              style={{
                left: gridPadding + item.x * (cellSize + cellGap),
                top: gridPadding + item.y * (cellSize + cellGap),
                width: treasure.width * cellSize + (treasure.width - 1) * cellGap,
                height: treasure.height * cellSize + (treasure.height - 1) * cellGap,
                "--rarity": RARITY_META[treasure.rarity].color,
              } as CSSProperties}
              title={`${treasure.name} · ${treasure.value} 灵石`}
            >
              <img src={treasure.art} alt="" />
                <aside className="inventory-tooltip">
                <strong>{treasure.name}</strong>
                <small>{RARITY_META[treasure.rarity].name} · {treasure.width}×{treasure.height}</small>
                <p>{treasure.description}</p>
                <b>价值 {treasure.value.toLocaleString()} 灵石</b>
                  {onAction && <em>双击：{actionLabel}</em>}
                </aside>
                {(onAction || onSecondaryAction) && <span className="inventory-item-actions">{onAction && <button type="button" onClick={(event) => { event.stopPropagation(); onAction(item.uid); }}>{actionLabel}</button>}{onSecondaryAction && <button type="button" onClick={(event) => { event.stopPropagation(); onSecondaryAction(item.uid); }}>{secondaryActionLabel}</button>}</span>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function writeTreasureDrag(
  event: ReactDragEvent<HTMLElement>,
  uid: string,
  source: ContainerKind | "loot",
) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-blcx-treasure", JSON.stringify({ uid, source }));
  event.dataTransfer.setData("text/plain", uid);
}

function readTreasureDrag(event: ReactDragEvent<HTMLElement>) {
  try {
    return JSON.parse(event.dataTransfer.getData("application/x-blcx-treasure")) as {
      uid: string;
      source: ContainerKind | "loot";
    };
  } catch {
    return null;
  }
}
