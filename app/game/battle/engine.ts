import { AnyRow, byId, GameData, gameConfigValue } from "./data";
import { drawAtlasFrame, findEffect, findScene, loadAtlas, loadGridAtlas, loadImage, SpriteAtlas } from "./assets";
import { BASE_HERO_ATTRIBUTES, CombatTraits, DEFAULT_COMBAT_TRAITS, HeroAttributes } from "./progression";
import { EquipmentItem } from "./progression";
import { CULTIVATOR_PACK_SIZE, organizeEquipment } from "./inventorySystem";
import { DEFAULT_WM_CONFIG, WMConfig, rollManagedEquipment, rollManagedTreasure } from "./weaponManager";
import {
  BUFFS,
  ChestKind,
  ContainerKind,
  EXPEDITION_PHASES,
  ExpeditionPhase,
  InventorySize,
  LootOffer,
  PARTNERS,
  PartnerDefinition,
  PlacedTreasure,
  RARITY_META,
  RunResult,
  TreasureRarity,
  createTreasureItem,
  canPlaceTreasure,
  firstTreasurePosition,
  organizeTreasures,
  placeOrSwapTreasure,
  phaseCountForWave,
  randomBuffChoices,
  rarityIndex,
  rollRarity,
  targetDurationForWave,
} from "./expedition";

export type UpgradeKind = "skill" | "supply" | "evolution" | "heal";

export interface UpgradeChoice {
  kind: UpgradeKind;
  id: number;
  level: number;
  name: string;
  description: string;
  evolved?: boolean;
}

export interface GameSettings {
  heroId: number;
  waveId: number;
  mapId: number;
  backpackSize?: InventorySize;
  safeSize?: InventorySize;
  baseAttributes?: HeroAttributes;
  combatTraits?: CombatTraits;
  wmConfig?: WMConfig;
  availableSkillIds?: number[];
  skillDamageBonuses?: Record<number, number>;
}

export interface GameSnapshot {
  elapsed: number;
  total: number;
  hp: number;
  maxHp: number;
  level: number;
  exp: number;
  nextExp: number;
  kills: number;
  bossKills: number;
  gold: number;
  speed: number;
  paused: boolean;
  monsterCount: number;
  skills: { id: number; level: number; name: string; evolved: boolean }[];
  supplies: { id: number; level: number; name: string }[];
  boss: { name: string; hp: number; maxHp: number } | null;
  phaseIndex: number;
  phase: ExpeditionPhase;
  extraction: { active: boolean; distance: number; angle: number; progress: number } | null;
  qi: number;
  backpack: PlacedTreasure[];
  safeBox: PlacedTreasure[];
  backpackSize: InventorySize;
  safeSize: InventorySize;
  activeBuffs: string[];
  runEquipment: EquipmentItem[];
}

export interface GameCallbacks {
  onSnapshot: (snapshot: GameSnapshot) => void;
  onUpgrade: (choices: UpgradeChoice[], rerolls: number) => void;
  onGameOver: (result: RunResult, snapshot: GameSnapshot) => void;
  onToast: (message: string) => void;
  onPhase: (phase: ExpeditionPhase, index: number) => void;
  onLoot: (offer: LootOffer) => void;
  onPartner: (partner: PartnerDefinition, resonance: boolean) => void;
  onPartnerRequest?: () => void;
}

type PlayerAction = "idle" | "move" | "attack" | "hurt" | "death";

interface PlayerAnimationSet {
  idle: SpriteAtlas;
  move: SpriteAtlas;
  attack: SpriteAtlas;
  hurt: SpriteAtlas;
  death: SpriteAtlas;
}

interface Player {
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  directionX: number;
  directionY: number;
  invulnerable: number;
  atlas: SpriteAtlas | null;
  animations: PlayerAnimationSet | null;
  action: PlayerAction;
  actionTimer: number;
  hurtTimer: number;
  deathStartedAt: number;
  moving: boolean;
  frame: number;
}

interface Monster {
  eid: number;
  ref: AnyRow;
  waveNumId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  atlas: SpriteAtlas | null;
  frame: number;
  alive: boolean;
  hitFlash: number;
  contactCooldown: number;
  aiTimer: number;
  skillTimers: Map<number, number>;
  dashTimer: number;
  dashCooldown: number;
  isBoss: boolean;
  isElite: boolean;
  frozen: number;
}

interface Projectile {
  eid: number;
  owner: "hero" | "monster";
  skillId: number;
  bullet: AnyRow;
  kind: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  penetration: number;
  rebounds: number;
  angle: number;
  orbitIndex: number;
  orbitCount: number;
  orbitRadius: number;
  hit: Set<number>;
  hitCooldown: Map<number, number>;
  effect: HTMLImageElement | null;
  effectAtlas: SpriteAtlas | null;
  effectPath: string | null;
  phase: number;
  sourceX: number;
  sourceY: number;
  pathStyle: "linear" | "arc" | "sine" | "spiral" | "return" | "anchored";
  targetEid: number | null;
  curveSign: number;
  curveAmplitude: number;
  curveFrequency: number;
  trail: TrailPoint[];
}

interface TrailPoint {
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

interface ImpactParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Shockwave {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  maxRadius: number;
  color: string;
}

interface Drop {
  eid: number;
  type: "exp" | "gold" | "heal" | "magnet" | "chest";
  x: number;
  y: number;
  value: number;
  radius: number;
  age: number;
  chestKind?: ChestKind;
  quality?: TreasureRarity;
  opened?: boolean;
}

interface DamageText {
  x: number;
  y: number;
  value: string;
  life: number;
  color: string;
  size: number;
  maxLife?: number;
}

interface PartnerStrike {
  x: number;
  y: number;
  kind: "lightning" | "sword" | "freeze";
  life: number;
  maxLife: number;
  seed: number;
}

const TAU = Math.PI * 2;
// Visual size is deliberately decoupled from collision size. At 1280x720 this
// keeps the hero near 145px tall, normal enemies near 80-105px, elites around
// 125px and bosses around 200px, leaving enough room to read attacks and loot.
const UNIT_VISUAL_ZOOM = 1.8;
const PLAYER_VISUAL_HEIGHT = 122 * UNIT_VISUAL_ZOOM;
const MONSTER_VISUAL_SCALE = 3.35 * UNIT_VISUAL_ZOOM;
const BOSS_VISUAL_SCALE = 2.9 * UNIT_VISUAL_ZOOM;
const CHEST_RENDER_SIZE = 125;
const CHEST_PICKUP_RADIUS = 42;

// 杀怪宝箱采用两段判定：先以 n 判定是否掉箱，再以 p 分配箱型。
// 后续只需调整 MONSTER_CHEST_DROP_RATE 即可整体缩放所有宝箱的掉率。
const MONSTER_CHEST_DROP_RATE = 0.10;
const MONSTER_CHEST_KIND_WEIGHTS: ReadonlyArray<{ kind: ChestKind; p: number }> = [
  { kind: "monster", p: 0.55 }, // 最终概率 n × 55% = 5.5%
  { kind: "treasure", p: 0.30 }, // 最终概率 n × 30% = 3.0%
  { kind: "buff", p: 0.15 }, // 最终概率 n × 15% = 1.5%
];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distanceSq = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;
const randomRange = (min: number, max: number) => min + Math.random() * (max - min);
const angleDelta = (from: number, to: number) => ((to - from + Math.PI * 3) % TAU) - Math.PI;
const rotateTowards = (from: number, to: number, maxStep: number) => from + clamp(angleDelta(from, to), -maxStep, maxStep);
const numberList = (value: unknown): number[] => {
  if (value == null || value === 0 || value === "") return [];
  const entries = Array.isArray(value) ? value : [value];
  return entries.map(Number).filter((entry) => Number.isFinite(entry) && entry > 0);
};

function projectilePalette(projectile: Projectile) {
  const model = `${Array.isArray(projectile.bullet.model) ? projectile.bullet.model.join(" ") : projectile.bullet.model ?? ""} ${projectile.kind}`;
  if (/火|炎|莲|molotov|dragon/i.test(model)) return { core: "#fff2a1", glow: "#ff8a32", edge: "#ff3d20", trail: "rgba(255,92,30,.46)" };
  if (/毒|蛇|venom/i.test(model)) return { core: "#efff9c", glow: "#79ec52", edge: "#238f50", trail: "rgba(90,227,89,.42)" };
  if (/冰|雪|freeze/i.test(model)) return { core: "#ffffff", glow: "#8de9ff", edge: "#538dff", trail: "rgba(126,220,255,.45)" };
  if (/雷|lightning/i.test(model)) return { core: "#ffffff", glow: "#8ff5ff", edge: "#a178ff", trail: "rgba(150,112,255,.5)" };
  if (/佛|杵|金光|地藏|aura/i.test(model)) return { core: "#fffbd0", glow: "#ffd75f", edge: "#ff8d30", trail: "rgba(255,207,83,.46)" };
  if (/刀|剑|boomerang|orbit/i.test(model)) return { core: "#ffffff", glow: "#d49bff", edge: "#7d5cff", trail: "rgba(174,112,255,.46)" };
  if (/弩|环|法盘|ricochet/i.test(model)) return { core: "#fff7bd", glow: "#ffbf5d", edge: "#62dfcd", trail: "rgba(255,185,79,.42)" };
  return { core: "#fffbd1", glow: "#72e8df", edge: "#198fb1", trail: "rgba(73,224,255,.38)" };
}

function weightedPick<T>(values: T[], weights: number[]) {
  const total = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
  let roll = Math.random() * total;
  for (let index = 0; index < values.length; index++) {
    roll -= Math.max(0, weights[index] ?? 1);
    if (roll <= 0) return values[index];
  }
  return values[values.length - 1];
}

function rollMonsterChestKind(): ChestKind {
  const entries = [...MONSTER_CHEST_KIND_WEIGHTS];
  return weightedPick(entries, entries.map((entry) => entry.p)).kind;
}

export class BattleEngine {
  private context: CanvasRenderingContext2D;
  private data: GameData;
  private settings: GameSettings;
  private callbacks: GameCallbacks;
  private player: Player;
  private monsters: Monster[] = [];
  private projectiles: Projectile[] = [];
  private drops: Drop[] = [];
  private damageTexts: DamageText[] = [];
  private partnerStrikes: PartnerStrike[] = [];
  private impactParticles: ImpactParticle[] = [];
  private shockwaves: Shockwave[] = [];
  private keys = new Set<string>();
  private joystick = { x: 0, y: 0 };
  private animationFrame = 0;
  private resizeObserver: ResizeObserver | null = null;
  private previousTime = 0;
  private snapshotTimer = 0;
  private spawnTimer = 0;
  private elapsed = 0;
  private totalTime = 240;
  private originalTotalTime = 240;
  private kills = 0;
  private bossKills = 0;
  private gold = 0;
  private level = 0;
  private exp = 0;
  private speed = 1;
  private paused = true;
  private upgradePaused = false;
  private ended = false;
  private rerolls = 1;
  private upgradeCount = 0;
  private entityId = 1;
  private learnedSkills = new Map<number, number>();
  private learnedSupplies = new Map<number, number>();
  private castTimers = new Map<number, number>();
  private singleCast = new Set<number>();
  private spawnedBossRows = new Set<number>();
  private finalBossSpawned = false;
  private background: HTMLImageElement | null = null;
  private bgTileWidth = 1024;
  private bgTileHeight = 1024;
  private wave: AnyRow;
  private waveRows: AnyRow[] = [];
  private monsterById = new Map<number, AnyRow>();
  private bulletById = new Map<number, AnyRow>();
  private monsterSkillById = new Map<number, AnyRow>();
  private skillById = new Map<number, AnyRow>();
  private monsterAtlases = new Map<string, SpriteAtlas | null>();
  private activeChoices: UpgradeChoice[] = [];
  private debugHitboxes = false;
  private phaseIndex = 0;
  private phaseCount = 2;
  private extraction: { x: number; y: number; progress: number; radius: number } | null = null;
  private backpack: PlacedTreasure[] = [];
  private safeBox: PlacedTreasure[] = [];
  private backpackSize: InventorySize;
  private safeSize: InventorySize;
  private pendingLoot: LootOffer | null = null;
  private lootPaused = false;
  private runBuffs = new Map<string, number>();
  private baseAttributes: HeroAttributes;
  private combatTraits: CombatTraits;
  private wmConfig: WMConfig;
  private runEquipment: EquipmentItem[] = [];
  private cloneActive = false;
  private activeBuffNames = new Set<string>();
  private reviveReady = false;
  private qi = 100;
  private lastPartnerId = "";
  private lastPartnerTag = "";
  private partnerBuff = { damage: 0, haste: 0, speed: 0, remaining: 0 };
  private partnerPower: {
    partner: PartnerDefinition;
    resonance: boolean;
    remaining: number;
    nextPulse: number;
    pulses: number;
  } | null = null;
  private shake = 0;
  private chestImages = new Map<ChestKind, HTMLImageElement | null>();
  private extractionImage: HTMLImageElement | null = null;

  constructor(canvas: HTMLCanvasElement, data: GameData, settings: GameSettings, callbacks: GameCallbacks) {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("当前浏览器不支持 Canvas 2D");
    this.context = context;
    this.data = data;
    this.settings = settings;
    this.baseAttributes = { ...BASE_HERO_ATTRIBUTES, ...(settings.baseAttributes ?? {}) };
    this.combatTraits = { ...DEFAULT_COMBAT_TRAITS, ...(settings.combatTraits ?? {}) };
    this.wmConfig = settings.wmConfig ?? DEFAULT_WM_CONFIG;
    this.cloneActive = Math.random() < this.combatTraits.cloneChance;
    this.reviveReady = this.combatTraits.reviveCount > 0;
    this.callbacks = callbacks;
    this.wave = byId(data.waves, settings.waveId)!;
    const wavePlanId = Number(this.wave?.wavePlanId ?? 10001);
    this.waveRows = data.waveNums.filter((row) => Number(row.groupId) === wavePlanId).sort((a, b) => a.point - b.point);
    this.originalTotalTime = Math.max(1, ...this.waveRows.map((row) => Number(row.point) || 0));
    this.totalTime = targetDurationForWave(settings.waveId);
    const timeScale = this.totalTime / this.originalTotalTime;
    this.waveRows = this.waveRows.map((row) => ({
      ...row,
      point: Number(row.point || 0) * timeScale,
      duration: Math.max(1, Number(row.duration || 1) * timeScale),
    }));
    this.phaseCount = phaseCountForWave(settings.waveId);
    this.backpackSize = settings.backpackSize ?? { columns: 10, rows: 4 };
    this.safeSize = settings.safeSize ?? { columns: 2, rows: 2 };
    data.monsters.forEach((row) => this.monsterById.set(Number(row.resId), row));
    data.bullets.forEach((row) => this.bulletById.set(Number(row.id), row));
    data.monsterSkills.forEach((row) => this.monsterSkillById.set(Number(row.id), row));
    data.skills.forEach((row) => this.skillById.set(Number(row.resId), row));

    const hero = byId(data.heroes, settings.heroId)! ?? data.heroes[0];
    this.player = {
      x: 0,
      y: 0,
      radius: 24,
      hp: this.baseAttributes.health,
      maxHp: this.baseAttributes.health,
      speed: this.baseAttributes.moveSpeed,
      directionX: 1,
      directionY: 0,
      invulnerable: 0,
      atlas: null,
      animations: null,
      action: "idle",
      actionTimer: 0,
      hurtTimer: 0,
      deathStartedAt: 0,
      moving: false,
      frame: 0,
    };
    this.learnedSkills.set(Number(hero?.weapon ?? 10000), 1);
  }

  async prepare() {
    const hero = byId(this.data.heroes, this.settings.heroId)! ?? this.data.heroes[0];
    const map = byId(this.data.maps, this.settings.mapId)! ?? this.data.maps[0];
    const monsterIds = numberList(this.wave?.monster);
    const monsterModels = monsterIds.map((id) => this.monsterById.get(Number(id))?.model).filter(Boolean) as string[];
    const uniqueModels = [...new Set(monsterModels)];
    const scenePath = findScene(this.data.manifest, map?.model ?? map?.name ?? "莲池梦境");
    const customAnimationsPromise = hero?.animationSet
      ? this.loadCustomHeroAnimations(hero.animationSet)
      : Promise.resolve(null);
    const [heroAtlas, customAnimations, scene, treasureChest, buffChest, monsterChest, extractionImage, ...atlases] = await Promise.all([
      hero?.animationSet ? Promise.resolve(null) : loadAtlas(this.data.manifest, hero?.modelBattle ?? hero?.name, hero?.name),
      customAnimationsPromise,
      scenePath ? loadImage(scenePath).catch(() => null) : Promise.resolve(null),
      loadImage("/game-assets/chests/treasure-chest.webp").catch(() => null),
      loadImage("/game-assets/chests/buff-chest.webp").catch(() => null),
      loadImage("/game-assets/chests/monster-chest.webp").catch(() => null),
      loadImage("/game-assets/effects/extraction-array.webp").catch(() => null),
      ...uniqueModels.map((model) => loadAtlas(this.data.manifest, model)),
    ]);
    this.player.atlas = heroAtlas;
    this.player.animations = customAnimations;
    this.background = scene;
    if (scene) {
      const ratio = scene.width / Math.max(scene.height, 1);
      this.bgTileHeight = 1024;
      this.bgTileWidth = this.bgTileHeight * ratio;
    }
    this.chestImages.set("treasure", treasureChest);
    this.chestImages.set("buff", buffChest);
    this.chestImages.set("monster", monsterChest);
    this.extractionImage = extractionImage;
    uniqueModels.forEach((model, index) => this.monsterAtlases.set(model, atlases[index]));
    this.spawnMapChests();
    this.resize();
    this.emitSnapshot(true);
  }

  private async loadCustomHeroAnimations(spec: AnyRow): Promise<PlayerAnimationSet | null> {
    const idleWalk = String(spec.idleWalk ?? "");
    const attackPath = String(spec.attack ?? "");
    const hurtDefeat = String(spec.hurtDefeat ?? "");
    if (!idleWalk || !attackPath || !hurtDefeat) return null;
    const [idle, move, attack, hurt, death] = await Promise.all([
      loadGridAtlas(idleWalk, 4, 2, 0, 4),
      loadGridAtlas(idleWalk, 4, 2, 4, 4),
      loadGridAtlas(attackPath, 4, 2, 0, 8),
      loadGridAtlas(hurtDefeat, 4, 2, 0, 4),
      loadGridAtlas(hurtDefeat, 4, 2, 4, 4),
    ]);
    if (!idle || !move || !attack || !hurt || !death) return null;
    return { idle, move, attack, hurt, death };
  }

  start() {
    this.paused = false;
    this.previousTime = performance.now();
    this.resize();
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.context.canvas);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.resize);
    this.animationFrame = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.resize);
  }

  setJoystick(x: number, y: number) {
    const length = Math.hypot(x, y);
    this.joystick.x = length > 1 ? x / length : x;
    this.joystick.y = length > 1 ? y / length : y;
  }

  setSpeed(speed: number) {
    this.speed = clamp(speed, 1, 30);
    this.emitSnapshot(true);
  }

  togglePause() {
    if (this.ended || this.upgradePaused) return;
    this.paused = !this.paused;
    this.emitSnapshot(true);
  }

  toggleHitboxes() {
    this.debugHitboxes = !this.debugHitboxes;
  }

  setInventoryPaused(open: boolean) {
    if (this.ended || this.upgradePaused || this.lootPaused) return;
    this.paused = open;
    this.emitSnapshot(true);
  }

  summonPartner(partnerId?: string) {
    if (this.ended || this.paused || this.qi < 100) return;
    const pool = PARTNERS.filter((partner) => partner.id !== this.lastPartnerId);
    const partner = (partnerId ? PARTNERS.find((entry) => entry.id === partnerId) : null) ?? pool[Math.floor(Math.random() * pool.length)] ?? PARTNERS[0];
    this.qi -= 100;
    const resonance = this.lastPartnerTag === partner.tag;
    this.lastPartnerId = partner.id;
    this.lastPartnerTag = partner.tag;
    this.applyPartnerPower(partner, resonance);
    this.callbacks.onPartner(partner, resonance);
    this.emitSnapshot(true);
  }

  takeLoot(uid: string, container: ContainerKind) {
    const offer = this.pendingLoot;
    const item = offer?.items.find((entry) => entry.uid === uid);
    if (!offer || !item) return false;
    const target = container === "safe" ? this.safeBox : this.backpack;
    const size = container === "safe" ? this.safeSize : this.backpackSize;
    const position = firstTreasurePosition(target, item, size);
    if (!position) {
      this.callbacks.onToast(container === "safe" ? "保险箱空间不足" : "背包空间不足");
      return false;
    }
    target.push({ ...item, ...position });
    offer.items = offer.items.filter((entry) => entry.uid !== uid);
    this.callbacks.onLoot({ ...offer, items: [...offer.items] });
    this.emitSnapshot(true);
    return true;
  }

  takeEquipment(uid: string) {
    const offer = this.pendingLoot;
    const item = offer?.equipment?.find((entry) => entry.uid === uid);
    if (!offer || !item) return false;
    if (!organizeEquipment([...this.runEquipment, item], CULTIVATOR_PACK_SIZE)) {
      this.callbacks.onToast("10×4 法器行囊已满，无法拾取这件装备");
      return false;
    }
    this.runEquipment.push(item);
    offer.equipment = offer.equipment?.filter((entry) => entry.uid !== uid);
    this.callbacks.onLoot({ ...offer, items: [...offer.items], equipment: [...(offer.equipment ?? [])] });
    this.callbacks.onToast(`${item.name ?? "装备"} · 已收入本局战利品`);
    this.emitSnapshot(true);
    return true;
  }

  moveTreasure(uid: string, target: ContainerKind) {
    const from = target === "safe" ? this.backpack : this.safeBox;
    const to = target === "safe" ? this.safeBox : this.backpack;
    const size = target === "safe" ? this.safeSize : this.backpackSize;
    const item = from.find((entry) => entry.uid === uid);
    if (!item) return false;
    const position = firstTreasurePosition(to, item, size);
    if (!position) {
      this.callbacks.onToast(target === "safe" ? "保险箱空间不足" : "背包空间不足");
      return false;
    }
    const index = from.indexOf(item);
    from.splice(index, 1);
    to.push({ ...item, ...position });
    this.emitSnapshot(true);
    return true;
  }

  placeTreasure(
    uid: string,
    source: ContainerKind | "loot",
    target: ContainerKind,
    x: number,
    y: number,
  ) {
    const targetItems = target === "safe" ? this.safeBox : this.backpack;
    const targetSize = target === "safe" ? this.safeSize : this.backpackSize;
    const sourceItems = source === "loot"
      ? this.pendingLoot?.items
      : source === "safe" ? this.safeBox : this.backpack;
    const item = sourceItems?.find((entry) => entry.uid === uid);
    if (!item) return false;
    if (source !== "loot") {
      const sourceSize = source === "safe" ? this.safeSize : this.backpackSize;
      const moved = placeOrSwapTreasure(sourceItems as PlacedTreasure[], targetItems, uid, targetSize, x, y, source === target, sourceSize);
      if (!moved) {
        this.callbacks.onToast("目标位置冲突，交换后的物品也放不下");
        return false;
      }
      if (source === target) {
        if (target === "safe") this.safeBox = moved.target;
        else this.backpack = moved.target;
      } else {
        if (source === "safe") this.safeBox = moved.source;
        else this.backpack = moved.source;
        if (target === "safe") this.safeBox = moved.target;
        else this.backpack = moved.target;
      }
      this.emitSnapshot(true);
      return true;
    }
    const ignoreUid = "";
    if (!canPlaceTreasure(targetItems, item, targetSize, x, y, ignoreUid)) {
      this.callbacks.onToast("这里放不下这件宝物");
      return false;
    }

    if (source === "loot") {
      if (!this.pendingLoot) return false;
      this.pendingLoot.items = this.pendingLoot.items.filter((entry) => entry.uid !== uid);
      this.callbacks.onLoot({ ...this.pendingLoot, items: [...this.pendingLoot.items] });
    } else {
      const index = sourceItems!.findIndex((entry) => entry.uid === uid);
      sourceItems!.splice(index, 1);
    }
    targetItems.push({ uid: item.uid, treasureId: item.treasureId, x, y });
    this.emitSnapshot(true);
    return true;
  }

  sortContainer(container: ContainerKind) {
    const items = container === "safe" ? this.safeBox : this.backpack;
    const size = container === "safe" ? this.safeSize : this.backpackSize;
    const organized = organizeTreasures(items, size);
    if (!organized) {
      this.callbacks.onToast("当前布局无法整理");
      return false;
    }
    if (container === "safe") this.safeBox = organized;
    else this.backpack = organized;
    this.callbacks.onToast(container === "safe" ? "保险箱已压缩整理" : "10×4 行囊已压缩整理");
    this.emitSnapshot(true);
    return true;
  }

  discardTreasure(uid: string) {
    this.backpack = this.backpack.filter((entry) => entry.uid !== uid);
    this.safeBox = this.safeBox.filter((entry) => entry.uid !== uid);
    this.emitSnapshot(true);
  }

  selectBuff(id: string) {
    const offer = this.pendingLoot;
    const buff = offer?.buffs?.find((entry) => entry.id === id);
    if (!buff) return;
    this.applyRunBuff(buff);
    this.callbacks.onToast(`${buff.name} · ${buff.description}`);
    this.closeLoot();
  }

  closeLoot() {
    this.pendingLoot = null;
    this.lootPaused = false;
    if (!this.upgradePaused && !this.ended) this.paused = false;
    this.emitSnapshot(true);
  }

  rerollUpgrade() {
    if (!this.upgradePaused || this.rerolls <= 0) return;
    this.rerolls--;
    this.activeChoices = this.createUpgradeChoices();
    this.callbacks.onUpgrade(this.activeChoices, this.rerolls);
  }

  selectUpgrade(index: number) {
    if (!this.upgradePaused) return;
    const choice = this.activeChoices[index];
    if (!choice) return;
    this.applyUpgrade(choice);
    this.upgradePaused = false;
    this.paused = false;
    this.activeChoices = [];
    this.emitSnapshot(true);
  }

  getSnapshot(): GameSnapshot {
    const levelRow = byId(this.data.battleLevels, this.level + 1, "level");
    const boss = this.monsters.find((monster) => monster.alive && monster.isBoss);
    return {
      elapsed: this.elapsed,
      total: this.totalTime,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      level: this.level,
      exp: this.exp,
      nextExp: Number(levelRow?.exp ?? Math.max(20, (this.level + 1) * 100)),
      kills: this.kills,
      bossKills: this.bossKills,
      gold: this.gold,
      speed: this.speed,
      paused: this.paused,
      monsterCount: this.monsters.filter((monster) => monster.alive).length,
      skills: [...this.learnedSkills].map(([id, level]) => ({
        id,
        level,
        name: this.skillById.get(id)?.name ?? `技能${id}`,
        evolved: level >= 6 || this.data.evolutions.some((row) => Number(row.skillId) === id),
      })),
      supplies: [...this.learnedSupplies].map(([id, level]) => ({
        id,
        level,
        name: byId(this.data.supplies, id, "resId")?.name ?? `补给${id}`,
      })),
      boss: boss ? { name: boss.ref.name, hp: boss.hp, maxHp: boss.maxHp } : null,
      phaseIndex: this.phaseIndex,
      phase: EXPEDITION_PHASES[this.phaseIndex],
      extraction: this.extraction ? {
        active: true,
        distance: Math.hypot(this.extraction.x - this.player.x, this.extraction.y - this.player.y),
        angle: Math.atan2(this.extraction.y - this.player.y, this.extraction.x - this.player.x),
        progress: this.extraction.progress,
      } : null,
      qi: this.qi,
      backpack: [...this.backpack],
      safeBox: [...this.safeBox],
      backpackSize: this.backpackSize,
      safeSize: this.safeSize,
      activeBuffs: [...this.activeBuffNames],
      runEquipment: [...this.runEquipment],
    };
  }

  private resize = () => {
    const canvas = this.context.canvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  private onKeyDown = (event: KeyboardEvent) => {
    this.keys.add(event.key.toLowerCase());
    if (event.key === "Escape" || event.key.toLowerCase() === "p") this.togglePause();
    if (event.code === "Space") {
      event.preventDefault();
      if (this.qi >= 100 && this.callbacks.onPartnerRequest) this.callbacks.onPartnerRequest();
      else this.summonPartner();
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase());
  };

  private loop = (now: number) => {
    const rawDelta = clamp((now - this.previousTime) / 1000, 0, 0.08);
    this.previousTime = now;
    if (!this.paused && !this.ended) {
      this.updateRealTime(rawDelta);
      let remaining = rawDelta * this.speed;
      let steps = 0;
      while (remaining > 0 && steps < 12) {
        const delta = Math.min(remaining, 1 / 30);
        this.update(delta);
        remaining -= delta;
        steps++;
      }
      if (remaining > 0) this.update(Math.min(remaining, 0.15));
    }
    this.render(now / 1000);
    this.animationFrame = requestAnimationFrame(this.loop);
  };

  private update(delta: number) {
    this.elapsed += delta;
    this.snapshotTimer += delta;
    this.spawnTimer += delta;
    this.player.invulnerable = Math.max(0, this.player.invulnerable - delta);
    this.partnerBuff.remaining = Math.max(0, this.partnerBuff.remaining - delta);
    if (this.partnerBuff.remaining <= 0) this.partnerBuff = { damage: 0, haste: 0, speed: 0, remaining: 0 };
    this.updatePhase();
    this.updatePlayer(delta);
    this.updateSpawns(delta);
    this.updateMonsters(delta);
    this.updateHeroSkills(delta);
    this.updateProjectiles(delta);
    this.updateDrops(delta);
    this.updateDamageTexts(delta);
    this.updateVisualEffects(delta);
    this.cleanup();
    this.checkVictory();
    if (this.snapshotTimer >= 0.15) this.emitSnapshot();
  }

  private updateRealTime(delta: number) {
    this.updatePartnerPower(delta);
    for (const strike of this.partnerStrikes) strike.life -= delta;
    this.partnerStrikes = this.partnerStrikes.filter((strike) => strike.life > 0).slice(-90);
    if (!this.extraction || this.ended) return;
    const distance = Math.hypot(this.extraction.x - this.player.x, this.extraction.y - this.player.y);
    if (distance <= this.extraction.radius) this.extraction.progress = Math.min(5, this.extraction.progress + delta);
    else this.extraction.progress = Math.max(0, this.extraction.progress - delta * .7);
    if (this.extraction.progress >= 5) this.finish("extracted");
  }

  private updatePhase() {
    const next = Math.min(this.phaseCount - 1, Math.floor(this.elapsed / this.totalTime * this.phaseCount));
    if (next <= this.phaseIndex) return;
    this.phaseIndex = next;
    this.shake = .28;
    const phase = EXPEDITION_PHASES[next];
    if (next === 1 && !this.extraction) this.spawnExtraction();
    this.callbacks.onPhase(phase, next);
    this.emitSnapshot(true);
  }

  private spawnExtraction() {
    const angle = Math.random() * TAU;
    const distance = randomRange(760, 1120);
    this.extraction = {
      x: this.player.x + Math.cos(angle) * distance,
      y: this.player.y + Math.sin(angle) * distance,
      progress: 0,
      radius: 165,
    };
  }

  private spawnMapChests() {
    const treasureCount = 3 + Math.floor(this.settings.waveId / 7);
    const buffCount = 2 + Math.floor(this.settings.waveId / 10);
    const total = treasureCount + buffCount;
    for (let index = 0; index < total; index++) {
      const angle = index / total * TAU + randomRange(-.28, .28);
      const distance = randomRange(480, 1450);
      const kind: ChestKind = index < treasureCount ? "treasure" : "buff";
      this.drops.push({
        eid: this.entityId++,
        type: "chest",
        chestKind: kind,
        quality: rollRarity(0, this.settings.waveId, this.combatTraits.lootLuck),
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        value: 1,
        radius: CHEST_PICKUP_RADIUS,
        age: 0,
      });
    }
  }

  private openChest(drop: Drop) {
    if (drop.opened || this.pendingLoot) return;
    drop.opened = true;
    const kind = drop.chestKind ?? "monster";
    const quality = drop.quality ?? rollRarity(this.phaseIndex, this.settings.waveId, (this.runBuffs.get("luck") ?? 0) + this.combatTraits.lootLuck);
    if (kind === "buff") {
      this.pendingLoot = {
        chestId: drop.eid,
        kind,
        quality,
        items: [],
        buffs: randomBuffChoices(3),
      };
    } else {
      const baseCount = kind === "monster" ? 2 : 1;
      const count = Math.min(4, baseCount + (Math.random() < .35 ? 1 : 0) + (quality === "immortal" ? 1 : 0));
      const items = Array.from({ length: count }, (_, index) => {
        const offset = Math.random() < .28 ? 1 : Math.random() < .14 ? -1 : 0;
        const rarity = ["common", "fine", "rare", "epic", "immortal"][
          clamp(rarityIndex(quality) + offset, 0, 4)
        ] as TreasureRarity;
        return rollManagedTreasure(this.wmConfig, rarity, this.settings.waveId, this.entityId + index) ?? createTreasureItem(rarity, this.entityId + index);
      });
      const equipment = [rollManagedEquipment(this.wmConfig, this.settings.waveId, quality, this.entityId + count)].filter((item): item is EquipmentItem => Boolean(item));
      this.pendingLoot = { chestId: drop.eid, kind, quality, items, equipment };
    }
    this.lootPaused = true;
    this.paused = true;
    drop.age = -999;
    this.callbacks.onLoot({ ...this.pendingLoot, items: [...this.pendingLoot.items] });
    this.emitSnapshot(true);
  }

  private applyRunBuff(buff: (typeof BUFFS)[number]) {
    this.activeBuffNames.add(buff.name);
    if (buff.effect === "vitality") {
      this.player.maxHp *= 1 + buff.value;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * buff.value);
      return;
    }
    if (buff.effect === "revive") {
      this.reviveReady = true;
      return;
    }
    this.runBuffs.set(buff.effect, (this.runBuffs.get(buff.effect) ?? 0) + buff.value);
  }

  private applyPartnerPower(partner: PartnerDefinition, resonance: boolean) {
    const bonus = resonance ? 1.45 : 1;
    this.shake = .38;
    this.partnerPower = { partner, resonance, remaining: 6.2, nextPulse: 0, pulses: 0 };
    if (partner.power === "frenzy") {
      this.partnerBuff = { damage: .8 * bonus, haste: .55 * bonus, speed: .4 * bonus, remaining: resonance ? 11 : 8 };
    }
    this.updatePartnerPower(0);
  }

  private updatePartnerPower(delta: number) {
    const cast = this.partnerPower;
    if (!cast) return;
    cast.remaining -= delta;
    cast.nextPulse -= delta;
    if (cast.remaining <= 0) {
      this.partnerPower = null;
      return;
    }
    if (cast.nextPulse > 0) return;
    cast.pulses++;
    const bonus = cast.resonance ? 1.45 : 1;
    this.shake = Math.max(this.shake, .16);

    if (cast.partner.power === "screenDamage") {
      cast.nextPulse = 1.22;
      for (const monster of this.monsters) {
        if (monster.alive) this.partnerDamage(monster, Math.max(70, monster.maxHp * .115) * bonus, "#f7e7ff", "sword");
      }
    } else if (cast.partner.power === "lightning") {
      cast.nextPulse = .52;
      const targets = this.monsters
        .filter((monster) => monster.alive)
        .sort((a, b) => Number(b.isBoss) - Number(a.isBoss) || Number(b.isElite) - Number(a.isElite) || Math.random() - .5)
        .slice(0, cast.resonance ? 5 : 3);
      targets.forEach((monster) => this.partnerDamage(monster, Math.max(135, monster.maxHp * .18) * bonus, "#bdf8ff", "lightning"));
    } else if (cast.partner.power === "freeze") {
      cast.nextPulse = 1.05;
      for (const monster of this.monsters) {
        if (!monster.alive) continue;
        monster.frozen = Math.max(monster.frozen, cast.resonance ? 7 : 4.5);
        this.partnerDamage(monster, Math.max(45, monster.maxHp * .065) * bonus, "#d8f8ff", "freeze");
      }
    } else if (cast.partner.power === "recovery") {
      cast.nextPulse = 1;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * .12 * bonus * (1 + this.combatTraits.healingBonus));
      this.player.invulnerable = Math.max(this.player.invulnerable, cast.resonance ? 1.4 : .8);
      this.damageTexts.push({
        x: this.player.x,
        y: this.player.y - 65,
        value: `+${Math.round(this.player.maxHp * .12 * bonus * (1 + this.combatTraits.healingBonus)).toLocaleString()}`,
        life: .9,
        maxLife: .9,
        color: "#8dffae",
        size: 24,
      });
    } else {
      cast.nextPulse = 1.2;
    }
  }

  private partnerDamage(
    monster: Monster,
    damage: number,
    color = "#ffe16f",
    strikeKind?: PartnerStrike["kind"],
  ) {
    monster.hp -= damage;
    monster.hitFlash = .14;
    this.damageTexts.push({
      x: monster.x + randomRange(-12, 12),
      y: monster.y - monster.radius,
      value: Math.round(damage).toLocaleString(),
      life: .85,
      maxLife: .85,
      color,
      size: 27,
    });
    if (strikeKind) {
      this.partnerStrikes.push({
        x: monster.x,
        y: monster.y,
        kind: strikeKind,
        life: strikeKind === "lightning" ? .46 : .62,
        maxLife: strikeKind === "lightning" ? .46 : .62,
        seed: Math.random() * 1000,
      });
    }
    if (monster.hp <= 0) this.killMonster(monster, true);
  }

  private updatePlayer(delta: number) {
    this.player.actionTimer = Math.max(0, this.player.actionTimer - delta);
    this.player.hurtTimer = Math.max(0, this.player.hurtTimer - delta);
    let x = this.joystick.x;
    let y = this.joystick.y;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;
    const length = Math.hypot(x, y);
    this.player.moving = length > 0.05;
    if (length > 0.05) {
      x /= Math.max(1, length);
      y /= Math.max(1, length);
      const speed = this.player.speed
        * this.supplyMultiplier(1002, 0.08)
        * (1 + (this.runBuffs.get("speed") ?? 0) + this.partnerBuff.speed);
      this.player.x += x * speed * delta;
      this.player.y += y * speed * delta;
      this.player.directionX = x;
      this.player.directionY = y;
    }
    let nextAction: PlayerAction = this.player.moving ? "move" : "idle";
    if (this.player.actionTimer > 0) nextAction = "attack";
    if (this.player.hurtTimer > 0) nextAction = "hurt";
    if (this.player.hp <= 0) nextAction = "death";
    if (this.player.action !== nextAction) {
      this.player.action = nextAction;
      this.player.frame = 0;
    }
    const animationRate = nextAction === "attack" ? 14 : nextAction === "hurt" ? 8 : nextAction === "move" ? 10 : nextAction === "death" ? 6 : 4;
    this.player.frame += delta * animationRate;
    const regenLevel = this.learnedSupplies.get(1007) ?? 0;
    const regen = regenLevel * .8 + this.player.maxHp * this.combatTraits.regenPercent;
    if (regen > 0) this.player.hp = Math.min(this.player.maxHp, this.player.hp + regen * (1 + this.combatTraits.healingBonus) * delta);
  }

  private updateSpawns(_delta: number) {
    if (this.spawnTimer < 0.16) return;
    this.spawnTimer = 0;
    for (const row of this.waveRows) {
      const start = Number(row.point) || 0;
      const duration = Math.max(0.1, Number(row.duration) || 1);
      const typeId = Number(row.typeId);
      if (typeId === 99 || typeId === 999) {
        if (this.elapsed >= start && !this.spawnedBossRows.has(Number(row.id))) {
          this.spawnedBossRows.add(Number(row.id));
          this.finalBossSpawned = true;
          this.spawnMonster(row, true);
          this.callbacks.onToast(typeId === 99 ? "妖王现世" : "强敌来袭");
        }
        continue;
      }
      if (this.elapsed < start || this.elapsed > start + duration) continue;
      const progress = clamp((this.elapsed - start) / duration, 0, 1);
      const target = Math.round((Number(row.from || 0) + (Number(row.to || 0) - Number(row.from || 0)) * progress) * EXPEDITION_PHASES[this.phaseIndex].density);
      const alive = this.monsters.filter((monster) => monster.alive && monster.waveNumId === Number(row.id)).length;
      const missing = clamp(target - alive, 0, 4);
      for (let count = 0; count < missing && this.monsters.length < 280; count++) this.spawnMonster(row, false);
    }
  }

  private spawnMonster(row: AnyRow, forceBoss: boolean) {
    const monsterIndex = Number(row.monster) || 0;
    const monsterId = Number(this.wave?.monster?.[monsterIndex]);
    const ref = this.monsterById.get(monsterId);
    if (!ref) return;
    const angle = Math.random() * TAU;
    const canvas = this.context.canvas;
    const viewRadius = Math.max(canvas.clientWidth, canvas.clientHeight) * 0.66 + 140;
    const isBoss = forceBoss || Number(ref.type) === 3;
    const radius = Math.max(16, Number(ref.prototypeSize || 60) * Number(ref.phy || 100) / 200);
    const phase = EXPEDITION_PHASES[this.phaseIndex];
    const hpScale = (1 + this.elapsed / Math.max(this.totalTime, 1) * 1.2) * phase.hp;
    const maxHp = Math.max(8, Number(ref.hp || 10) * hpScale);
    const monster: Monster = {
      eid: this.entityId++,
      ref,
      waveNumId: Number(row.id),
      x: this.player.x + Math.cos(angle) * viewRadius,
      y: this.player.y + Math.sin(angle) * viewRadius,
      vx: 0,
      vy: 0,
      hp: maxHp,
      maxHp,
      radius,
      atlas: this.monsterAtlases.get(ref.model) ?? null,
      frame: Math.random() * 10,
      alive: true,
      hitFlash: 0,
      contactCooldown: 0,
      aiTimer: Math.random() * 3,
      skillTimers: new Map(),
      dashTimer: 0,
      dashCooldown: randomRange(1, 3),
      isBoss,
      isElite: Number(ref.type) === 2,
      frozen: 0,
    };
    this.monsters.push(monster);
  }

  private updateMonsters(delta: number) {
    for (const monster of this.monsters) {
      if (!monster.alive) continue;
      monster.hitFlash = Math.max(0, monster.hitFlash - delta);
      monster.frozen = Math.max(0, monster.frozen - delta);
      monster.contactCooldown = Math.max(0, monster.contactCooldown - delta);
      monster.aiTimer -= delta;
      monster.frame += delta * (monster.isBoss ? 7 : 10);
      const dx = this.player.x - monster.x;
      const dy = this.player.y - monster.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / distance;
      const ny = dy / distance;
      const behavior = Number(monster.ref.behavior || 1);
      const speed = Number(monster.ref.spd || 80) * (monster.frozen > 0 ? .12 : 1);

      if (monster.dashTimer > 0) {
        monster.dashTimer -= delta;
      } else if ([6, 7, 100].includes(behavior) && (monster.dashCooldown -= delta) <= 0) {
        monster.dashCooldown = randomRange(2.5, 5);
        monster.dashTimer = 0.55;
        monster.vx = nx * speed * 5;
        monster.vy = ny * speed * 5;
      } else if (behavior === 2 || behavior === 102) {
        monster.vx *= 0.9;
        monster.vy *= 0.9;
      } else if (behavior === 3) {
        monster.vx = 0;
        monster.vy = speed;
      } else if (behavior === 4 || behavior === 101) {
        const move = distance > 300 ? 1 : 0;
        monster.vx = nx * speed * move;
        monster.vy = ny * speed * move;
      } else if (behavior === 5) {
        if (monster.aiTimer <= 0) {
          monster.aiTimer = randomRange(1, 3);
          const wanderAngle = Math.random() * TAU;
          monster.vx = Math.cos(wanderAngle) * speed;
          monster.vy = Math.sin(wanderAngle) * speed;
        }
      } else {
        monster.vx = nx * speed;
        monster.vy = ny * speed;
      }
      monster.x += monster.vx * delta;
      monster.y += monster.vy * delta;
      this.updateMonsterSkills(monster, distance, nx, ny);

      if (distance < monster.radius + this.player.radius && monster.contactCooldown <= 0) {
        monster.contactCooldown = 0.7;
        if (behavior === 8) {
          this.damagePlayer(Math.max(40, Number(monster.ref.atk || 1) * 35) * EXPEDITION_PHASES[this.phaseIndex].attack);
          this.killMonster(monster, false);
        } else {
          this.damagePlayer(Math.max(10, Number(monster.ref.atk || 1) * (monster.isBoss ? 28 : 12)) * EXPEDITION_PHASES[this.phaseIndex].attack);
          const push = monster.isBoss ? 80 : 35;
          this.player.x += nx * push;
          this.player.y += ny * push;
        }
      }
    }
  }

  private updateMonsterSkills(monster: Monster, distance: number, nx: number, ny: number) {
    const skills = numberList(monster.ref.skill);
    for (const id of skills) {
      const skill = this.monsterSkillById.get(Number(id));
      if (!skill) continue;
      const type = Number(skill.skillId || 13000);
      if (type === 13050 || type === 13060) continue;
      const readyAt = monster.skillTimers.get(id) ?? randomRange(0.5, Number(skill.CD || 3000) / 1000);
      if (this.elapsed < readyAt) continue;
      if (distance > Number(skill.conjureDistance || 300) && !monster.isBoss) continue;
      monster.skillTimers.set(id, this.elapsed + Math.max(0.2, Number(skill.CD || 3000) / 1000));
      if (type === 13070) {
        monster.dashTimer = 0.65;
        monster.vx = nx * Number(skill.param?.[0] || 900);
        monster.vy = ny * Number(skill.param?.[0] || 900);
        continue;
      }
      const count = clamp(Number(skill.num || 1), 1, 24);
      const bullets = numberList(skill.bullet);
      const baseAngle = Math.atan2(ny, nx);
      for (let index = 0; index < count; index++) {
        const bullet = this.bulletById.get(Number(bullets[index % Math.max(1, bullets.length)]));
        if (!bullet) continue;
        let angle = baseAngle;
        if (type === 13010) {
          const spread = Number(skill.param?.[0] || 100) * Math.PI / 180;
          angle += count === 1 ? 0 : (index / (count - 1) - 0.5) * spread;
        } else if ([13020, 13030, 13040].includes(type)) {
          angle = index / count * TAU + (type === 13030 ? this.elapsed * 1.4 : 0);
        }
        this.createProjectile("monster", Number(id), bullet, monster.x, monster.y, angle, index, count, type === 13020 ? "enemyOrbit" : "enemy");
      }
    }
  }

  private updateHeroSkills(delta: number) {
    for (const [skillId, level] of this.learnedSkills) {
      const levelRef = this.data.skillLevels.find((row) => Number(row.skillId) === skillId && Number(row.level) === level);
      if (!levelRef) continue;
      let timer = this.castTimers.get(skillId) ?? 0;
      timer -= delta;
      if (timer > 0) {
        this.castTimers.set(skillId, timer);
        continue;
      }
      const isSingle = Number(levelRef.mode || 0) === 1;
      if (isSingle && this.singleCast.has(skillId)) continue;
      const cd = Math.max(0.08, Number(levelRef.CD || 0) / 1000)
        / this.baseAttributes.attackSpeed
        / this.supplyMultiplier(1012, 0.07)
        / (1 + (this.runBuffs.get("haste") ?? 0) + this.partnerBuff.haste);
      this.castTimers.set(skillId, cd);
      if (isSingle) this.singleCast.add(skillId);
      this.castHeroSkill(skillId, levelRef);
    }
  }

  private castHeroSkill(skillId: number, levelRef: AnyRow) {
    if (this.player.animations && this.player.hp > 0 && this.player.hurtTimer <= 0) {
      this.player.action = "attack";
      this.player.actionTimer = .52;
      this.player.frame = 0;
    }
    const count = clamp(Number(levelRef.num || 1), 1, 30);
    const bullets = numberList(levelRef.bullet);
    const target = this.nearestMonster(this.player.x, this.player.y);
    const baseAngle = target
      ? Math.atan2(target.y - this.player.y, target.x - this.player.x)
      : Math.atan2(this.player.directionY, this.player.directionX);
    for (let index = 0; index < count; index++) {
      const bullet = this.bulletById.get(Number(bullets[index % Math.max(1, bullets.length)]));
      if (!bullet) continue;
      let angle = baseAngle;
      if ([10002, 10003, 10004, 10005, 10008, 10009, 10023, 10024].includes(skillId)) {
        const spread = Number(levelRef.param?.[0] || 60) * Math.PI / 180;
        angle += count === 1 ? 0 : (index / (count - 1) - 0.5) * Math.min(Math.PI * 1.4, spread);
      } else if ([10016, 10017, 10029, 10030, 10035, 10036].includes(skillId)) {
        angle = index / count * TAU;
      } else if ([10031, 10032].includes(skillId)) {
        angle = Math.random() * TAU;
      } else if ([10010, 10011, 10012, 10013, 10018, 10019, 10027, 10028, 10033, 10034].includes(skillId)) {
        angle += (index - (count - 1) / 2) * 0.12;
      }
      const kind = this.heroProjectileKind(skillId, bullet);
      this.createProjectile("hero", skillId, bullet, this.player.x, this.player.y, angle, index, count, kind);
      if (this.cloneActive) this.createProjectile("hero", skillId, bullet, this.player.x - 64, this.player.y + 38, angle, index, count, kind);
    }
  }

  private heroProjectileKind(skillId: number, bullet: AnyRow) {
    if ([10014, 10015].includes(skillId)) return "aura";
    if ([10029, 10030].includes(skillId)) return "orbit";
    if ([10031, 10032].includes(skillId)) return "lightning";
    if ([10010, 10011, 10033, 10034].includes(skillId)) return "boomerang";
    if ([10012, 10013].includes(skillId)) return "molotov";
    if ([10018, 10019].includes(skillId)) return "missile";
    if ([10027, 10028].includes(skillId)) return "ricochet";
    if ([10020, 10021].includes(skillId)) return "companion";
    if ([10025, 10026].includes(skillId)) return "dragon";
    const script = String(bullet.script ?? "");
    if (/Field|Radiation/.test(script)) return "field";
    if (/Lightning/.test(script)) return "lightning";
    if (/Boomerange/.test(script)) return "boomerang";
    if (/Molotov|Venom/.test(script)) return "molotov";
    if (/Missile/.test(script)) return "missile";
    if (/Football|Durian/.test(script)) return "ricochet";
    if (/Guarder|SwordField/.test(script)) return "orbit";
    return "straight";
  }

  private createProjectile(
    owner: "hero" | "monster",
    skillId: number,
    bullet: AnyRow,
    x: number,
    y: number,
    angle: number,
    orbitIndex: number,
    orbitCount: number,
    kind: string,
  ) {
    if (this.projectiles.length >= 650) return;
    const speed = Math.max(40, Number(bullet.speed || 350)) * (owner === "hero" ? this.baseAttributes.projectileSpeed * this.supplyMultiplier(1001, 0.08) : 1);
    const size = Array.isArray(bullet.prototypeSize) ? Number(bullet.prototypeSize[0] || 30) : Number(bullet.prototypeSize || 30);
    const rangeScale = owner === "hero" ? this.supplyMultiplier(1006, 0.08) : 1;
    const life = Math.max(0.25, Number(bullet.effectTime || 2200) / 1000) * (owner === "hero" ? this.supplyMultiplier(1004, 0.08) : 1);
    const weaponDamage = (this.baseAttributes.weaponMinDamage + this.baseAttributes.weaponMaxDamage) / 2;
    const damageScale = owner === "hero"
      ? this.baseAttributes.damage * (1 + weaponDamage / 100) * this.supplyMultiplier(1011, 0.1) * (1 + (this.runBuffs.get("damage") ?? 0) + this.partnerBuff.damage) * (this.settings.skillDamageBonuses?.[skillId] ?? 1)
      : 0.1 * EXPEDITION_PHASES[this.phaseIndex].attack;
    const model = bullet.model;
    const effectPath = findEffect(this.data.manifest, model);
    const target = owner === "hero" ? this.nearestMonster(x, y) : null;
    const pathStyle = this.projectilePathStyle(owner, skillId, kind);
    const projectile: Projectile = {
      eid: this.entityId++,
      owner,
      skillId,
      bullet,
      kind,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: clamp(size * 0.45 * rangeScale, 7, owner === "hero" ? 130 : 65),
      damage: Math.max(1, Number(bullet.damage || 10) * damageScale),
      life,
      maxLife: life,
      penetration: Number(bullet.penetrate ?? 0),
      rebounds: Number(bullet.rebound ?? 0),
      angle,
      orbitIndex,
      orbitCount,
      orbitRadius: Number(bullet.damageRange || 0) + 85,
      hit: new Set(),
      hitCooldown: new Map(),
      effect: null,
      effectAtlas: null,
      effectPath,
      phase: 0,
      sourceX: x,
      sourceY: y,
      pathStyle,
      targetEid: target?.eid ?? null,
      curveSign: (orbitIndex + this.entityId) % 2 ? 1 : -1,
      curveAmplitude: kind === "missile" || kind === "dragon" ? .42 : kind === "ricochet" ? .34 : .58,
      curveFrequency: 7 + orbitIndex * .7,
      trail: [],
    };
    if (kind === "aura" || kind === "orbit" || kind === "field" || kind === "companion") {
      projectile.life = Math.max(projectile.life, 9999);
      projectile.maxLife = projectile.life;
    }
    if (kind === "lightning") {
      projectile.life = 0.22;
      projectile.maxLife = 0.22;
    }
    if (effectPath) loadImage(effectPath).then((image) => (projectile.effect = image)).catch(() => undefined);
    if (owner === "hero") {
      const models = (Array.isArray(model) ? model : [model]).filter(Boolean).map(String);
      Promise.all(models.map((entry) => loadAtlas(this.data.manifest, entry)))
        .then((atlases) => { projectile.effectAtlas = atlases.find(Boolean) ?? null; })
        .catch(() => undefined);
    }
    this.projectiles.push(projectile);
  }

  private projectilePathStyle(owner: "hero" | "monster", skillId: number, kind: string): Projectile["pathStyle"] {
    if (["aura", "field", "orbit", "companion", "lightning"].includes(kind)) return "anchored";
    if (kind === "boomerang") return "return";
    if (kind === "missile" || kind === "dragon") return "spiral";
    if (kind === "ricochet") return "sine";
    if (owner === "monster") return kind === "enemyOrbit" ? "spiral" : "linear";
    if ([10000, 10001, 10006, 10007, 10008, 10009, 10035, 10036].includes(skillId)) return "arc";
    if ([10002, 10003, 10016, 10017, 10023, 10024, 10037, 10038].includes(skillId)) return "sine";
    return "linear";
  }

  private guidedTarget(projectile: Projectile) {
    let target = projectile.targetEid == null
      ? null
      : this.monsters.find((monster) => monster.eid === projectile.targetEid && monster.alive) ?? null;
    if (!target) {
      target = this.nearestMonster(projectile.x, projectile.y, projectile.kind === "ricochet" ? projectile.hit : undefined);
      projectile.targetEid = target?.eid ?? null;
    }
    return target;
  }

  private updateGuidedProjectile(projectile: Projectile, delta: number) {
    const target = this.guidedTarget(projectile);
    const speed = Math.max(220, Math.hypot(projectile.vx, projectile.vy));
    if (!target) {
      projectile.x += projectile.vx * delta;
      projectile.y += projectile.vy * delta;
      return;
    }
    const dx = target.x - projectile.x;
    const dy = target.y - projectile.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const targetAngle = Math.atan2(dy, dx);
    const lock = 1 - clamp((distance - 55) / 260, 0, 1);
    let curve = 0;
    if (projectile.pathStyle === "arc") {
      curve = projectile.curveSign * Math.sin(Math.min(Math.PI, projectile.phase * 2.15)) * projectile.curveAmplitude * (1 - lock);
    } else if (projectile.pathStyle === "sine") {
      curve = Math.sin(projectile.phase * projectile.curveFrequency + projectile.orbitIndex * 1.7) * projectile.curveAmplitude * (1 - lock * .9);
    } else {
      curve = Math.sin(projectile.phase * 12 + projectile.orbitIndex * 2.4) * projectile.curveAmplitude * (1 - lock);
    }
    const desired = targetAngle + curve;
    const current = Math.atan2(projectile.vy, projectile.vx);
    const turnRate = projectile.pathStyle === "spiral" ? 5.5 : projectile.pathStyle === "sine" ? 7.5 : 4.8;
    const next = rotateTowards(current, desired, delta * (turnRate + lock * 11));
    projectile.vx = Math.cos(next) * speed;
    projectile.vy = Math.sin(next) * speed;
    projectile.angle = next;
    if (distance <= speed * delta + projectile.radius + target.radius) {
      projectile.x = target.x;
      projectile.y = target.y;
    } else {
      projectile.x += projectile.vx * delta;
      projectile.y += projectile.vy * delta;
    }
  }

  private updateProjectiles(delta: number) {
    for (const projectile of this.projectiles) {
      projectile.life -= delta;
      projectile.phase += delta;
      for (const point of projectile.trail) point.life -= delta;
      projectile.trail = projectile.trail.filter((point) => point.life > 0);
      if (projectile.life > 0 && !["aura", "field", "lightning"].includes(projectile.kind)) {
        const trailLife = projectile.owner === "hero" ? (projectile.pathStyle === "spiral" ? .5 : .34) : .2;
        projectile.trail.push({ x: projectile.x, y: projectile.y, life: trailLife, maxLife: trailLife });
        if (projectile.trail.length > (projectile.owner === "hero" ? 20 : 10)) projectile.trail.shift();
      }
      for (const [eid, time] of projectile.hitCooldown) {
        if (time <= this.elapsed) projectile.hitCooldown.delete(eid);
      }
      if (projectile.life <= 0) continue;
      if (projectile.kind === "aura") {
        projectile.x = this.player.x;
        projectile.y = this.player.y;
        projectile.radius = Math.max(projectile.radius, 75);
      } else if (projectile.kind === "orbit" || projectile.kind === "companion") {
        const angle = projectile.phase * (projectile.kind === "companion" ? 1.1 : 2.8) + projectile.orbitIndex / projectile.orbitCount * TAU;
        const radius = projectile.kind === "companion" ? 110 : projectile.orbitRadius;
        projectile.x = this.player.x + Math.cos(angle) * radius;
        projectile.y = this.player.y + Math.sin(angle) * radius;
      } else if (projectile.kind === "enemyOrbit") {
        projectile.angle += delta * 1.8;
        projectile.vx += Math.cos(projectile.angle) * 24;
        projectile.vy += Math.sin(projectile.angle) * 24;
        projectile.x += projectile.vx * delta;
        projectile.y += projectile.vy * delta;
      } else if (projectile.kind === "boomerang") {
        if (projectile.life < projectile.maxLife * 0.5) {
          const dx = this.player.x - projectile.x;
          const dy = this.player.y - projectile.y;
          const length = Math.max(1, Math.hypot(dx, dy));
          const speed = Math.max(300, Math.hypot(projectile.vx, projectile.vy));
          projectile.vx += dx / length * speed * delta * 4;
          projectile.vy += dy / length * speed * delta * 4;
        }
        projectile.x += projectile.vx * delta;
        projectile.y += projectile.vy * delta;
      } else if (projectile.kind === "missile" || projectile.kind === "dragon") {
        this.updateGuidedProjectile(projectile, delta);
      } else if (projectile.kind === "molotov") {
        if (projectile.phase < 0.75) {
          projectile.x += projectile.vx * delta;
          projectile.y += projectile.vy * delta;
          projectile.vx *= 0.97;
          projectile.vy *= 0.97;
        } else {
          projectile.kind = "field";
          projectile.radius = Math.max(55, projectile.radius * 1.4);
        }
      } else if (projectile.kind === "lightning") {
        const targets = this.nearestMonsters(this.player.x, this.player.y, Math.max(1, projectile.orbitCount));
        targets.forEach((monster) => this.hitMonster(projectile, monster));
      } else if (projectile.owner === "hero" && ["arc", "sine"].includes(projectile.pathStyle)) {
        this.updateGuidedProjectile(projectile, delta);
      } else {
        projectile.x += projectile.vx * delta;
        projectile.y += projectile.vy * delta;
      }

      if (projectile.owner === "hero" && projectile.kind !== "lightning") {
        for (const monster of this.monsters) {
          if (!monster.alive || projectile.hitCooldown.has(monster.eid)) continue;
          if (distanceSq(projectile.x, projectile.y, monster.x, monster.y) <= (projectile.radius + monster.radius) ** 2) {
            this.hitMonster(projectile, monster);
            if (projectile.kind === "ricochet" && projectile.rebounds > 0) {
              projectile.rebounds--;
              const target = this.nearestMonster(projectile.x, projectile.y, projectile.hit);
              if (target) {
                const angle = Math.atan2(target.y - projectile.y, target.x - projectile.x);
                const speed = Math.max(300, Math.hypot(projectile.vx, projectile.vy));
                projectile.vx = Math.cos(angle) * speed;
                projectile.vy = Math.sin(angle) * speed;
                projectile.targetEid = target.eid;
                projectile.curveSign *= -1;
              }
            }
            if (projectile.penetration >= 0 && !["field", "aura", "orbit", "companion", "boomerang", "ricochet"].includes(projectile.kind)) {
              projectile.penetration--;
              if (projectile.penetration < 0) projectile.life = 0;
            }
          }
        }
      } else if (projectile.owner === "monster") {
        if (distanceSq(projectile.x, projectile.y, this.player.x, this.player.y) <= (projectile.radius + this.player.radius) ** 2) {
          this.damagePlayer(Math.max(8, projectile.damage), "magic");
          projectile.life = 0;
        }
      }
    }
  }

  private hitMonster(projectile: Projectile, monster: Monster) {
    const interval = Math.max(0.08, Number(projectile.bullet.damageInterval || 5) / 10);
    projectile.hit.add(monster.eid);
    projectile.hitCooldown.set(monster.eid, this.elapsed + interval);
    if (Math.random() > Math.min(.99, this.baseAttributes.hitChance)) {
      this.damageTexts.push({ x: monster.x, y: monster.y - monster.radius, value: "未命中", life: .45, color: "#b8c8bf", size: 13 });
      return;
    }
    let damage = projectile.damage;
    const critical = Math.random() < this.combatTraits.critChance;
    if (critical) damage *= this.combatTraits.critMultiplier;
    if (monster.isBoss || monster.isElite) {
      damage *= 1 + (this.learnedSupplies.get(1011) ?? 0) * 0.04 + (this.runBuffs.get("eliteDamage") ?? 0) + this.combatTraits.eliteDamage;
    }
    monster.hp -= damage;
    monster.hitFlash = 0.08;
    if (!["field", "aura"].includes(projectile.kind) || Math.random() < .16) this.spawnImpact(projectile, monster);
    this.damageTexts.push({
      x: monster.x + randomRange(-10, 10),
      y: monster.y - monster.radius,
      value: `${critical ? "暴击 " : ""}${Math.round(damage).toLocaleString()}`,
      life: 0.55,
      color: critical ? "#ffcc4e" : damage > monster.maxHp * 0.2 ? "#ffe671" : "#fff5dc",
      size: critical || damage > monster.maxHp * 0.2 ? 21 : 15,
    });
    if (this.combatTraits.lifeSteal > 0) this.player.hp = Math.min(this.player.maxHp, this.player.hp + damage * this.combatTraits.lifeSteal * (1 + this.combatTraits.healingBonus));
    if (Math.random() < this.combatTraits.chainChance) {
      this.nearestMonsters(monster.x, monster.y, 4).filter((target) => target.eid !== monster.eid).slice(0, 3)
        .forEach((target) => this.traitDamage(target, damage * this.combatTraits.chainRatio, "#9deaff"));
    }
    if (Math.random() < this.combatTraits.globalChance) {
      this.monsters.filter((target) => target.alive && target.eid !== monster.eid)
        .forEach((target) => this.traitDamage(target, damage * this.combatTraits.globalRatio, "#ffe89b"));
    }
    const repel = Number(projectile.bullet.repel || 0);
    if (repel > 0 && !monster.isBoss) {
      const length = Math.max(1, Math.hypot(projectile.vx, projectile.vy));
      monster.x += projectile.vx / length * Math.min(45, repel * 0.12);
      monster.y += projectile.vy / length * Math.min(45, repel * 0.12);
    }
    if (monster.hp <= 0) this.killMonster(monster, true);
  }

  private traitDamage(monster: Monster, damage: number, color: string) {
    if (!monster.alive) return;
    monster.hp -= damage;
    monster.hitFlash = .08;
    this.damageTexts.push({ x: monster.x, y: monster.y - monster.radius, value: Math.round(damage).toLocaleString(), life: .45, color, size: 14 });
    if (monster.hp <= 0) this.killMonster(monster, true);
  }

  private killMonster(monster: Monster, reward: boolean) {
    if (!monster.alive) return;
    monster.alive = false;
    if (!reward) return;
    this.kills++;
    if (monster.isBoss) this.bossKills++;
    this.qi = Math.min(300, this.qi + (monster.isBoss ? 30 : monster.isElite ? 8 : .45));
    const dropLevel = Number(monster.ref.dropLevel ?? 3);
    const expValue = monster.isBoss ? 80 : monster.isElite ? 25 : dropLevel === 1 ? 10 : dropLevel === 2 ? 6 : 3;
    this.drops.push({ eid: this.entityId++, type: "exp", x: monster.x, y: monster.y, value: expValue, radius: 7, age: 0 });
    if (Math.random() < (monster.isBoss ? 1 : monster.isElite ? 0.35 : 0.07)) {
      this.drops.push({ eid: this.entityId++, type: "gold", x: monster.x + 8, y: monster.y, value: monster.isBoss ? 120 : 5, radius: 8, age: 0 });
    }
    if (Math.random() < MONSTER_CHEST_DROP_RATE) {
      this.drops.push({
        eid: this.entityId++,
        type: "chest",
        chestKind: rollMonsterChestKind(),
        quality: rollRarity(this.phaseIndex, this.settings.waveId, (this.runBuffs.get("luck") ?? 0) + this.combatTraits.lootLuck),
        x: monster.x - 10,
        y: monster.y,
        value: 1,
        radius: CHEST_PICKUP_RADIUS,
        age: 0,
      });
    } else if (Math.random() < 0.012) {
      this.drops.push({ eid: this.entityId++, type: Math.random() < 0.65 ? "heal" : "magnet", x: monster.x, y: monster.y, value: 120, radius: 11, age: 0 });
    }
    for (const skillId of numberList(monster.ref.skill)) {
      const skill = this.monsterSkillById.get(Number(skillId));
      if (!skill || Number(skill.skillId) !== 13050) continue;
      const bullet = this.bulletById.get(Number(skill.bullet?.[0]));
      if (!bullet) continue;
      const count = Math.max(1, Number(skill.num || 1));
      for (let index = 0; index < count; index++) this.createProjectile("monster", skillId, bullet, monster.x, monster.y, index / count * TAU, index, count, "enemy");
    }
  }

  private damagePlayer(amount: number, element: "physical" | "fire" | "lightning" | "magic" = "physical") {
    if (this.player.invulnerable > 0 || this.ended) return;
    if (Math.random() < this.baseAttributes.dodge) {
      this.player.invulnerable = .18;
      this.damageTexts.push({ x: this.player.x, y: this.player.y - 45, value: "闪避", life: .55, color: "#a8f4ff", size: 21 });
      return;
    }
    const defenseConstant = 500 + this.settings.waveId * 25;
    const defenseReduction = Math.min(.85, this.baseAttributes.defense / (this.baseAttributes.defense + defenseConstant));
    const supplyReduction = clamp((this.learnedSupplies.get(1005) ?? 0) * 0.06, 0, 0.4);
    const resistance = element === "fire" ? this.baseAttributes.fireResist : element === "lightning" ? this.baseAttributes.lightningResist : element === "magic" ? this.baseAttributes.magicResist : 0;
    const damage = Math.max(1, amount * (1 - defenseReduction) * (1 - supplyReduction) * (1 - Math.min(.75, Math.max(0, resistance))));
    this.player.hp -= damage;
    this.player.invulnerable = 0.55;
    this.damageTexts.push({ x: this.player.x, y: this.player.y - 45, value: `-${Math.round(damage)}`, life: 0.7, color: "#ff756f", size: 22 });
    if (this.player.hp <= 0) {
      if (this.reviveReady) {
        this.reviveReady = false;
        this.activeBuffNames.delete("涅槃替身符");
        this.player.hp = this.player.maxHp * .5;
        this.player.invulnerable = 2.5;
        this.callbacks.onToast("涅槃替身符 · 劫后重生");
      } else {
        this.player.hp = 0;
        this.finish("defeat");
      }
    }
    if (this.player.animations) {
      if (this.player.hp <= 0) {
        this.player.action = "death";
        this.player.deathStartedAt = performance.now() / 1000;
      } else {
        this.player.action = "hurt";
        this.player.hurtTimer = .38;
      }
      this.player.frame = 0;
    }
  }

  private updateDrops(delta: number) {
    const pickupRadius = 75 * this.supplyMultiplier(1010, 0.28);
    for (const drop of this.drops) {
      drop.age += delta;
      const dx = this.player.x - drop.x;
      const dy = this.player.y - drop.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const magnetRadius = pickupRadius * (1 + (this.runBuffs.get("magnet") ?? 0));
      const magnet = drop.type !== "chest" && (distance < magnetRadius || drop.type === "magnet" && distance < 180);
      if (magnet) {
        const speed = clamp(250 + (magnetRadius - distance) * 5, 250, 900);
        drop.x += dx / distance * speed * delta;
        drop.y += dy / distance * speed * delta;
      }
      if (distance < this.player.radius + drop.radius + 5 && !this.pendingLoot) {
        this.collectDrop(drop);
        drop.age = -999;
      }
    }
  }

  private collectDrop(drop: Drop) {
    if (drop.type === "exp") {
      this.exp += drop.value * this.baseAttributes.expGain * this.supplyMultiplier(1003, 0.1);
      this.checkLevelUp();
    } else if (drop.type === "gold") {
      this.gold += Math.round(drop.value * this.supplyMultiplier(1009, 0.1));
    } else if (drop.type === "heal") {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + drop.value * (1 + this.combatTraits.healingBonus));
      this.callbacks.onToast("仙灵丹 · 生命恢复");
    } else if (drop.type === "magnet") {
      for (const other of this.drops) if (other.type === "exp" || other.type === "gold") other.x = this.player.x + randomRange(-20, 20), other.y = this.player.y + randomRange(-20, 20);
      this.callbacks.onToast("乾坤壶 · 吸取全场掉落");
    } else if (drop.type === "chest") this.openChest(drop);
  }

  private checkLevelUp() {
    let next = byId(this.data.battleLevels, this.level + 1, "level");
    let guard = 0;
    while (next && this.exp >= Number(next.exp) && guard++ < 3) {
      this.level++;
      if (this.learnedSupplies.has(1007)) this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.02);
      this.showUpgrade();
      next = byId(this.data.battleLevels, this.level + 1, "level");
      break;
    }
  }

  private showUpgrade() {
    this.paused = true;
    this.upgradePaused = true;
    this.activeChoices = this.createUpgradeChoices();
    this.callbacks.onUpgrade(this.activeChoices, this.rerolls);
  }

  private createUpgradeChoices() {
    const choices: UpgradeChoice[] = [];
    const evolutions = this.availableEvolutions();
    if (evolutions.length && Math.random() < 1 / 3) choices.push(this.evolutionChoice(evolutions[Math.floor(Math.random() * evolutions.length)]));
    const candidates: UpgradeChoice[] = [];
    const evolvedIds = new Set(this.data.evolutions.map((evolution) => Number(evolution.skillId)));
    const availableIds = this.settings.availableSkillIds ? new Set(this.settings.availableSkillIds) : null;
    const baseSkills = this.data.skills.filter((skill) => {
      const id = Number(skill.resId);
      return !evolvedIds.has(id) && (!availableIds || availableIds.has(id));
    });
    const skillSlotsFull = this.learnedSkills.size >= 6;
    for (const skill of baseSkills) {
      const id = Number(skill.resId);
      const level = this.learnedSkills.get(id) ?? 0;
      if (level >= 5 || (skillSlotsFull && level === 0)) continue;
      const nextLevel = level + 1;
      const levelRef = this.data.skillLevels.find((row) => Number(row.skillId) === id && Number(row.level) === nextLevel);
      if (!levelRef) continue;
      candidates.push({ kind: "skill", id, level: nextLevel, name: skill.name, description: levelRef.desc ?? skill.desc ?? "提升技能威力" });
    }
    const supplySlotsFull = this.learnedSupplies.size >= 6;
    for (const supply of this.data.supplies) {
      const id = Number(supply.resId);
      const level = this.learnedSupplies.get(id) ?? 0;
      if (level >= 5 || (supplySlotsFull && level === 0)) continue;
      candidates.push({ kind: "supply", id, level: level + 1, name: supply.name, description: supply.desc ?? "强化英雄属性" });
    }
    while (choices.length < 3 && candidates.length) {
      let filtered = candidates;
      if (this.upgradeCount < Number(gameConfigValue(this.data, "battleSelectOnlySkill", 3))) filtered = candidates.filter((choice) => choice.kind === "skill");
      if (!filtered.length) filtered = candidates;
      const weights = filtered.map((choice) => {
        const learned = choice.kind === "skill" ? this.learnedSkills.has(choice.id) : this.learnedSupplies.has(choice.id);
        if (choice.kind === "skill") return learned ? 2 : 2;
        return learned ? 3 : 3;
      });
      const picked = weightedPick(filtered, weights);
      choices.push(picked);
      candidates.splice(candidates.indexOf(picked), 1);
    }
    if (!choices.length) choices.push({ kind: "heal", id: 0, level: 1, name: "仙灵丹", description: "恢复30%生命" });
    while (choices.length < 3) choices.push({ kind: "heal", id: 0, level: 1, name: "仙灵丹", description: "恢复30%生命" });
    return choices.slice(0, 3);
  }

  private availableEvolutions() {
    return this.data.evolutions.filter((evolution) => {
      const needs = evolution.need ?? [];
      return needs.every((need: AnyRow) => (this.learnedSkills.get(Number(need.resId)) ?? this.learnedSupplies.get(Number(need.resId)) ?? 0) >= Number(need.level));
    }).filter((evolution) => !this.learnedSkills.has(Number(evolution.skillId)));
  }

  private evolutionChoice(evolution: AnyRow): UpgradeChoice {
    const skill = this.skillById.get(Number(evolution.skillId));
    const levelRef = this.data.skillLevels.find((row) => Number(row.skillId) === Number(evolution.skillId) && Number(row.level) === 6);
    return {
      kind: "evolution",
      id: Number(evolution.skillId),
      level: 6,
      name: skill?.name ?? "超武进化",
      description: levelRef?.desc ?? "突破极限，进化为超武",
      evolved: true,
    };
  }

  private applyUpgrade(choice: UpgradeChoice) {
    this.upgradeCount++;
    if (choice.kind === "heal") {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.3 * (1 + this.combatTraits.healingBonus));
      return;
    }
    if (choice.kind === "supply") {
      this.learnedSupplies.set(choice.id, choice.level);
      if (choice.id === 1008) {
        const previousMax = this.player.maxHp;
        this.player.maxHp = this.baseAttributes.health * this.supplyMultiplier(1008, 0.12);
        this.player.hp += this.player.maxHp - previousMax;
      }
      return;
    }
    if (choice.kind === "evolution") {
      const evolution = this.data.evolutions.find((row) => Number(row.skillId) === choice.id);
      const baseSkill = evolution?.need?.find((need: AnyRow) => this.learnedSkills.has(Number(need.resId)));
      if (baseSkill) this.learnedSkills.delete(Number(baseSkill.resId));
      this.learnedSkills.set(choice.id, 6);
      this.castTimers.delete(choice.id);
      this.singleCast.delete(choice.id);
      this.clearSkillProjectiles(Number(baseSkill?.resId));
      return;
    }
    this.learnedSkills.set(choice.id, choice.level);
    this.castTimers.delete(choice.id);
    this.singleCast.delete(choice.id);
    this.clearSkillProjectiles(choice.id);
  }

  private clearSkillProjectiles(skillId: number) {
    for (const projectile of this.projectiles) if (projectile.owner === "hero" && projectile.skillId === skillId) projectile.life = 0;
  }

  private supplyMultiplier(id: number, perLevel: number) {
    return 1 + (this.learnedSupplies.get(id) ?? 0) * perLevel;
  }

  private nearestMonster(x: number, y: number, excluded?: Set<number>) {
    let best: Monster | null = null;
    let bestDistance = Infinity;
    for (const monster of this.monsters) {
      if (!monster.alive || excluded?.has(monster.eid)) continue;
      const current = distanceSq(x, y, monster.x, monster.y);
      if (current < bestDistance) best = monster, bestDistance = current;
    }
    return best;
  }

  private nearestMonsters(x: number, y: number, count: number) {
    return this.monsters
      .filter((monster) => monster.alive)
      .sort((a, b) => distanceSq(x, y, a.x, a.y) - distanceSq(x, y, b.x, b.y))
      .slice(0, count);
  }

  private updateDamageTexts(delta: number) {
    for (const text of this.damageTexts) text.life -= delta, text.y -= 25 * delta;
  }

  private spawnImpact(projectile: Projectile, monster: Monster) {
    const palette = projectilePalette(projectile);
    const count = projectile.kind === "lightning" || projectile.kind === "missile" || projectile.kind === "dragon" ? 10 : 6;
    for (let index = 0; index < count; index++) {
      const angle = index / count * TAU + randomRange(-.22, .22);
      const speed = randomRange(70, projectile.kind === "dragon" ? 250 : 175);
      const life = randomRange(.22, .48);
      this.impactParticles.push({
        x: monster.x + randomRange(-6, 6),
        y: monster.y + randomRange(-6, 6),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: randomRange(2.5, projectile.kind === "dragon" ? 8 : 5.5),
        color: index % 3 === 0 ? palette.core : index % 2 ? palette.glow : palette.edge,
      });
    }
    if (!["field", "aura", "orbit", "companion"].includes(projectile.kind)) {
      const life = .32;
      this.shockwaves.push({ x: monster.x, y: monster.y, life, maxLife: life, maxRadius: monster.radius + Math.max(24, projectile.radius * 1.8), color: palette.glow });
    }
    this.impactParticles = this.impactParticles.slice(-280);
    this.shockwaves = this.shockwaves.slice(-50);
  }

  private updateVisualEffects(delta: number) {
    for (const particle of this.impactParticles) {
      particle.life -= delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx *= Math.pow(.04, delta);
      particle.vy *= Math.pow(.04, delta);
    }
    for (const wave of this.shockwaves) wave.life -= delta;
  }

  private cleanup() {
    this.monsters = this.monsters.filter((monster) => monster.alive || monster.hitFlash > -1).filter((monster) => monster.alive);
    this.projectiles = this.projectiles.filter((projectile) => projectile.life > 0);
    this.drops = this.drops
      .filter((drop) => drop.age >= 0 && (drop.type === "chest" || drop.age < 90))
      .slice(-360);
    this.damageTexts = this.damageTexts.filter((text) => text.life > 0).slice(-120);
    this.impactParticles = this.impactParticles.filter((particle) => particle.life > 0).slice(-280);
    this.shockwaves = this.shockwaves.filter((wave) => wave.life > 0).slice(-50);
  }

  private checkVictory() {
    if (!this.finalBossSpawned || this.elapsed < this.totalTime) return;
    if (!this.monsters.some((monster) => monster.alive && monster.isBoss)) this.finish("victory");
  }

  private finish(result: RunResult) {
    if (this.ended) return;
    this.ended = true;
    this.paused = true;
    this.emitSnapshot(true);
    this.callbacks.onGameOver(result, this.getSnapshot());
  }

  private emitSnapshot(force = false) {
    if (!force && this.snapshotTimer < 0.15) return;
    this.snapshotTimer = 0;
    this.callbacks.onSnapshot(this.getSnapshot());
  }

  private render(time: number) {
    const canvas = this.context.canvas;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const context = this.context;
    context.save();
    context.setTransform(window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio || 1, 0, 0);
    context.fillStyle = "#789b70";
    context.fillRect(0, 0, width, height);
    const shakeAmount = this.shake > 0 ? this.shake * 18 : 0;
    this.shake = Math.max(0, this.shake - .035);
    context.translate(
      width / 2 - this.player.x + randomRange(-shakeAmount, shakeAmount),
      height / 2 - this.player.y + randomRange(-shakeAmount, shakeAmount),
    );
    this.renderBackground(width, height);
    this.renderExtraction(time);
    this.renderDrops(time);
    this.renderProjectiles("hero", true, time);
    this.renderMonsters(time);
    this.renderPlayer(time);
    this.renderProjectiles("hero", false, time);
    this.renderProjectiles("monster", false, time);
    this.renderImpactEffects();
    this.renderPartnerStrikes(time);
    this.renderDamageTexts();
    context.restore();
    const phaseTint = EXPEDITION_PHASES[this.phaseIndex].tint;
    if (phaseTint !== "rgba(22,74,56,0)") {
      context.save();
      context.fillStyle = phaseTint;
      context.fillRect(0, 0, width, height);
      context.restore();
    }
    if (this.paused && !this.upgradePaused && !this.lootPaused && !this.ended) {
      context.save();
      context.fillStyle = "rgba(10, 18, 22, .42)";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#fff7da";
      context.textAlign = "center";
      context.font = "700 34px serif";
      context.fillText("战斗暂停", width / 2, height / 2);
      context.restore();
    }
  }

  private renderBackground(width: number, height: number) {
    const context = this.context;
    const left = this.player.x - width / 2 - 20;
    const top = this.player.y - height / 2 - 20;
    if (!this.background) {
      context.fillStyle = "#a4be8d";
      context.fillRect(left, top, width + 40, height + 40);
      context.strokeStyle = "rgba(40, 91, 63, .12)";
      context.lineWidth = 2;
      for (let x = Math.floor(left / 90) * 90; x < left + width + 90; x += 90) for (let y = Math.floor(top / 90) * 90; y < top + height + 90; y += 90) {
        context.beginPath(); context.arc(x, y, 24, 0, TAU); context.stroke();
      }
      return;
    }
    const startX = Math.floor(left / this.bgTileWidth) * this.bgTileWidth;
    const startY = Math.floor(top / this.bgTileHeight) * this.bgTileHeight;
    for (let x = startX; x < left + width + this.bgTileWidth; x += this.bgTileWidth) {
      for (let y = startY; y < top + height + this.bgTileHeight; y += this.bgTileHeight) {
        context.drawImage(this.background, x, y, this.bgTileWidth + 1, this.bgTileHeight + 1);
      }
    }
    context.fillStyle = "rgba(26, 72, 50, .05)";
    context.fillRect(left, top, width + 40, height + 40);
  }

  private renderExtraction(time: number) {
    if (!this.extraction) return;
    const context = this.context;
    const { x, y, radius, progress } = this.extraction;
    context.save();
    context.translate(x, y);
    context.globalCompositeOperation = "lighter";
    const breath = 1 + Math.sin(time * 2.6) * .045;
    const beam = context.createLinearGradient(0, -410, 0, 100);
    beam.addColorStop(0, "rgba(118,255,222,0)");
    beam.addColorStop(.38, "rgba(118,255,222,.18)");
    beam.addColorStop(.78, "rgba(205,255,225,.32)");
    beam.addColorStop(1, "rgba(255,225,132,.06)");
    context.fillStyle = beam;
    context.beginPath();
    context.moveTo(-70, 70);
    context.lineTo(-135, -410);
    context.lineTo(135, -410);
    context.lineTo(70, 70);
    context.closePath();
    context.fill();

    if (this.extractionImage) {
      context.save();
      context.rotate(time * .16);
      context.scale(breath, breath);
      context.globalAlpha = .9;
      const visualSize = radius * 2.55;
      context.shadowColor = "rgba(102,255,220,.9)";
      context.shadowBlur = 30;
      context.drawImage(this.extractionImage, -visualSize / 2, -visualSize / 2, visualSize, visualSize);
      context.restore();
    }

    context.rotate(time * .35);
    context.strokeStyle = "rgba(148,255,224,.9)";
    context.lineWidth = 6;
    context.beginPath();
    context.arc(0, 0, radius, 0, TAU);
    context.stroke();
    context.rotate(-time * .8);
    context.setLineDash([14, 10]);
    context.strokeStyle = "rgba(255,225,142,.72)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, radius * .72, 0, TAU);
    context.stroke();
    context.setLineDash([]);
    for (let index = 0; index < 16; index++) {
      const particleAngle = index / 16 * TAU - time * (.55 + index % 3 * .08);
      const particleRadius = radius * (.72 + (index % 4) * .1);
      const particleSize = 2.5 + (index % 3);
      context.fillStyle = index % 2 ? "rgba(255,226,139,.9)" : "rgba(113,255,224,.88)";
      context.beginPath();
      context.arc(
        Math.cos(particleAngle) * particleRadius,
        Math.sin(particleAngle) * particleRadius,
        particleSize,
        0,
        TAU,
      );
      context.fill();
    }
    if (progress > 0) {
      context.strokeStyle = "#fff1a3";
      context.shadowColor = "#fff1a3";
      context.shadowBlur = 18;
      context.lineWidth = 11;
      context.beginPath();
      context.arc(0, 0, radius + 12, -Math.PI / 2, -Math.PI / 2 + TAU * progress / 5);
      context.stroke();
    }
    context.restore();
  }

  private renderPlayer(time: number) {
    const context = this.context;
    const player = this.player;
    context.save();
    context.globalAlpha = player.invulnerable > 0 && Math.floor(time * 16) % 2 ? 0.45 : 1;
    context.fillStyle = "rgba(22, 45, 30, .25)";
    context.beginPath(); context.ellipse(player.x, player.y + 29 * UNIT_VISUAL_ZOOM, 39 * UNIT_VISUAL_ZOOM, 13 * UNIT_VISUAL_ZOOM, 0, 0, TAU); context.fill();
    const customAtlas = player.animations?.[player.action] ?? null;
    const activeAtlas = customAtlas ?? player.atlas;
    let activeFrame = player.frame;
    if (player.action === "death" && player.deathStartedAt > 0) {
      activeFrame = clamp(Math.floor((time - player.deathStartedAt) * 6), 0, 3);
    }
    if (activeAtlas) drawAtlasFrame(
      context,
      activeAtlas,
      Math.floor(activeFrame),
      player.x,
      player.y - 16 * UNIT_VISUAL_ZOOM,
      customAtlas ? PLAYER_VISUAL_HEIGHT * .96 : PLAYER_VISUAL_HEIGHT,
      player.directionX < 0,
    );
    else {
      context.fillStyle = "#f2d092";
      context.beginPath(); context.arc(player.x, player.y, 34 * UNIT_VISUAL_ZOOM, 0, TAU); context.fill();
      context.strokeStyle = "#563a4d"; context.lineWidth = 4 * UNIT_VISUAL_ZOOM; context.stroke();
    }
    context.restore();
    if (this.debugHitboxes) this.drawHitbox(player.x, player.y, player.radius, "#70e8ff");
  }

  private renderMonsters(_time: number) {
    const context = this.context;
    const visible = this.monsters
      .filter((monster) => monster.alive && Math.abs(monster.x - this.player.x) < this.context.canvas.clientWidth && Math.abs(monster.y - this.player.y) < this.context.canvas.clientHeight)
      .sort((a, b) => a.y - b.y);
    for (const monster of visible) {
      context.save();
      context.fillStyle = "rgba(18, 32, 27, .24)";
      context.beginPath(); context.ellipse(
        monster.x,
        monster.y + monster.radius * 0.68 * UNIT_VISUAL_ZOOM,
        monster.radius * 0.9 * UNIT_VISUAL_ZOOM,
        monster.radius * 0.28 * UNIT_VISUAL_ZOOM,
        0,
        0,
        TAU,
      ); context.fill();
      if (monster.hitFlash > 0) context.globalAlpha = 0.55;
      if (monster.atlas) drawAtlasFrame(
        context,
        monster.atlas,
        Math.floor(monster.frame),
        monster.x,
        monster.y - monster.radius * 0.2 * UNIT_VISUAL_ZOOM,
        monster.radius * (monster.isBoss ? BOSS_VISUAL_SCALE : MONSTER_VISUAL_SCALE),
        monster.vx > 0,
      );
      else {
        context.fillStyle = monster.isBoss ? "#7d264e" : monster.isElite ? "#bc6f4a" : "#435f4c";
        context.beginPath(); context.arc(monster.x, monster.y, monster.radius * UNIT_VISUAL_ZOOM, 0, TAU); context.fill();
        context.fillStyle = "#fff"; context.font = `${clamp(monster.radius * .5 * UNIT_VISUAL_ZOOM, 18, 70)}px serif`; context.textAlign = "center"; context.fillText(monster.ref.name?.slice(0, 2) ?? "妖", monster.x, monster.y + 5 * UNIT_VISUAL_ZOOM);
      }
      context.restore();
      if (monster.isBoss || monster.isElite || monster.hp < monster.maxHp) {
        const visualScale = monster.isBoss ? BOSS_VISUAL_SCALE : MONSTER_VISUAL_SCALE;
        const barWidth = Math.max(monster.radius * 2.35, monster.radius * visualScale * .62);
        const barY = monster.y - monster.radius * visualScale * .54 - 12;
        context.fillStyle = "rgba(30,20,25,.72)"; context.fillRect(monster.x - barWidth / 2, barY, barWidth, 6);
        context.fillStyle = monster.isBoss ? "#ff4f73" : "#ffb55d"; context.fillRect(monster.x - barWidth / 2, barY, barWidth * clamp(monster.hp / monster.maxHp, 0, 1), 6);
      }
      if (this.debugHitboxes) this.drawHitbox(monster.x, monster.y, monster.radius, monster.isBoss ? "#ff3a6b" : "#ffcf70");
    }
  }

  private renderProjectiles(owner: "hero" | "monster", behind: boolean, time: number) {
    const context = this.context;
    for (const projectile of this.projectiles) {
      if (projectile.owner !== owner || projectile.life <= 0) continue;
      if (behind !== ["field", "aura"].includes(projectile.kind) && owner === "hero") continue;
      this.renderProjectileTrail(projectile);
      context.save();
      const alpha = projectile.kind === "field" || projectile.kind === "aura" ? 0.42 : 0.9;
      context.globalAlpha = alpha;
      context.translate(projectile.x, projectile.y);
      context.rotate(Math.atan2(projectile.vy, projectile.vx) + (projectile.kind === "orbit" ? time * 5 : 0));
      const persistentArea = projectile.kind === "field" || projectile.kind === "aura";
      const heroVisualCap = ["dragon", "missile", "boomerang"].includes(projectile.kind) ? 72 : 52;
      const visualRadius = owner === "hero"
        ? persistentArea
          ? Math.max(15, projectile.radius)
          : clamp(projectile.radius * 1.28, 15, heroVisualCap)
        : clamp(projectile.radius, 9, 45);
      const palette = projectilePalette(projectile);

      if (owner === "hero" && ["field", "aura"].includes(projectile.kind)) {
        context.save();
        context.globalCompositeOperation = "lighter";
        context.globalAlpha = .72;
        const pulse = 1 + Math.sin(time * 5 + projectile.orbitIndex) * .08;
        const field = context.createRadialGradient(0, 0, visualRadius * .08, 0, 0, visualRadius * 1.32);
        field.addColorStop(0, "rgba(255,255,220,.2)");
        field.addColorStop(.58, palette.trail);
        field.addColorStop(1, "rgba(255,160,45,0)");
        context.fillStyle = field;
        context.beginPath(); context.arc(0, 0, visualRadius * 1.32 * pulse, 0, TAU); context.fill();
        context.strokeStyle = palette.glow;
        context.lineWidth = 2.5;
        context.setLineDash([12, 10]);
        context.rotate(time * .8 * projectile.curveSign);
        context.beginPath(); context.arc(0, 0, visualRadius * .92, 0, TAU); context.stroke();
        context.rotate(-time * 1.65 * projectile.curveSign);
        context.setLineDash([3, 15]);
        context.lineWidth = 4;
        context.beginPath(); context.arc(0, 0, visualRadius * 1.16, 0, TAU); context.stroke();
        context.setLineDash([]);
        for (let rune = 0; rune < 6; rune++) {
          const angle = rune / 6 * TAU + time * .45;
          const x = Math.cos(angle) * visualRadius * .72;
          const y = Math.sin(angle) * visualRadius * .72;
          context.fillStyle = rune % 2 ? palette.core : palette.glow;
          context.beginPath();
          context.moveTo(x + Math.cos(angle) * 7, y + Math.sin(angle) * 7);
          context.lineTo(x + Math.cos(angle + 2.3) * 5, y + Math.sin(angle + 2.3) * 5);
          context.lineTo(x + Math.cos(angle - 2.3) * 5, y + Math.sin(angle - 2.3) * 5);
          context.closePath(); context.fill();
        }
        context.restore();
      }

      // All hero attacks receive a luminous core and short trail. Original
      // effect PNGs contain a lot of transparent padding, so drawing only the
      // texture can make fast ordinary attacks effectively invisible.
      if (owner === "hero" && projectile.kind !== "field" && projectile.kind !== "aura") {
        context.save();
        context.globalCompositeOperation = "lighter";
        context.globalAlpha = 0.82;
        const trail = context.createLinearGradient(-visualRadius * 2.8, 0, visualRadius * 0.65, 0);
        trail.addColorStop(0, "rgba(50, 206, 255, 0)");
        trail.addColorStop(0.62, palette.trail);
        trail.addColorStop(1, palette.core);
        context.strokeStyle = trail;
        context.lineWidth = Math.max(5, visualRadius * 0.55);
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(-visualRadius * 2.8, 0);
        context.lineTo(visualRadius * 0.4, 0);
        context.stroke();
        const core = context.createRadialGradient(0, 0, 1, 0, 0, visualRadius * 1.35);
        core.addColorStop(0, palette.core);
        core.addColorStop(.28, palette.glow);
        core.addColorStop(1, "rgba(20,60,80,0)");
        context.fillStyle = core;
        context.beginPath(); context.arc(0, 0, visualRadius * 1.35, 0, TAU); context.fill();
        context.restore();

        context.save();
        context.globalCompositeOperation = "lighter";
        if (projectile.kind === "missile" || projectile.kind === "dragon") {
          const flame = context.createLinearGradient(-visualRadius * 3.4, 0, 0, 0);
          flame.addColorStop(0, "rgba(255,45,16,0)");
          flame.addColorStop(.5, palette.edge);
          flame.addColorStop(1, palette.core);
          context.fillStyle = flame;
          context.beginPath();
          context.moveTo(-visualRadius * 3.2, 0);
          context.quadraticCurveTo(-visualRadius * 1.2, -visualRadius * .62, 0, 0);
          context.quadraticCurveTo(-visualRadius * 1.2, visualRadius * .62, -visualRadius * 3.2, 0);
          context.fill();
        } else if (projectile.kind === "boomerang" || projectile.pathStyle === "arc") {
          context.strokeStyle = palette.core;
          context.shadowColor = palette.glow;
          context.shadowBlur = 14;
          context.lineWidth = Math.max(3, visualRadius * .26);
          context.beginPath();
          context.arc(0, 0, visualRadius * .85, -.9, .9);
          context.stroke();
        } else if (projectile.pathStyle === "sine") {
          for (let mote = 0; mote < 3; mote++) {
            const angle = time * 8 + mote / 3 * TAU + projectile.eid;
            context.fillStyle = mote === 0 ? palette.core : palette.glow;
            context.globalAlpha = .72;
            context.beginPath();
            context.arc(Math.cos(angle) * visualRadius * .8, Math.sin(angle) * visualRadius * .8, Math.max(1.8, visualRadius * .13), 0, TAU);
            context.fill();
          }
        }
        context.restore();
      }

      if (owner === "hero" && projectile.kind === "lightning") {
        context.save();
        context.rotate(-(Math.atan2(projectile.vy, projectile.vx)));
        context.globalCompositeOperation = "lighter";
        context.lineCap = "round";
        for (const target of this.nearestMonsters(projectile.x, projectile.y, Math.max(1, projectile.orbitCount))) {
          const dx = target.x - projectile.x;
          const dy = target.y - projectile.y;
          context.strokeStyle = "rgba(103, 225, 255, .42)";
          context.lineWidth = 9;
          context.beginPath(); context.moveTo(0, 0); context.lineTo(dx, dy); context.stroke();
          context.strokeStyle = "#f8ffff";
          context.lineWidth = 2.5;
          context.beginPath();
          context.moveTo(0, 0);
          context.lineTo(dx * .34 + Math.sin(time * 31 + target.eid) * 16, dy * .34 + Math.cos(time * 27 + target.eid) * 12);
          context.lineTo(dx * .68 + Math.cos(time * 29 + target.eid) * 13, dy * .68 + Math.sin(time * 33 + target.eid) * 15);
          context.lineTo(dx, dy);
          context.stroke();
        }
        context.restore();
      }
      if (projectile.effectAtlas?.frames.length) {
        const atlasHeight = visualRadius * (["field", "aura"].includes(projectile.kind) ? 3.1 : 2.65);
        context.shadowColor = palette.glow;
        context.shadowBlur = owner === "hero" ? 18 : 7;
        drawAtlasFrame(
          context,
          projectile.effectAtlas,
          Math.floor(projectile.phase * 24 + projectile.orbitIndex * 2),
          0,
          0,
          atlasHeight,
        );
      } else if (projectile.effect) {
        const image = projectile.effect;
        const ratio = clamp(image.width / Math.max(1, image.height), .35, 3);
        const height = visualRadius * 2.25;
        context.shadowColor = owner === "hero" ? palette.glow : "rgba(255, 74, 112, .8)";
        context.shadowBlur = owner === "hero" ? 12 : 7;
        context.drawImage(image, -height * ratio / 2, -height / 2, height * ratio, height);
      } else {
        const gradient = context.createRadialGradient(0, 0, 1, 0, 0, visualRadius);
        if (owner === "hero") {
          gradient.addColorStop(0, palette.core); gradient.addColorStop(.35, palette.glow); gradient.addColorStop(1, "rgba(25,80,110,0)");
        } else {
          gradient.addColorStop(0, "#fff0c7"); gradient.addColorStop(.35, "#ff547a"); gradient.addColorStop(1, "rgba(146,15,62,0)");
        }
        context.fillStyle = gradient; context.beginPath(); context.arc(0, 0, visualRadius, 0, TAU); context.fill();
      }
      context.restore();
      if (this.debugHitboxes) this.drawHitbox(projectile.x, projectile.y, projectile.radius, owner === "hero" ? "#4de9ff" : "#ff5270");
    }
  }

  private renderProjectileTrail(projectile: Projectile) {
    if (projectile.trail.length < 2 || ["aura", "field", "lightning"].includes(projectile.kind)) return;
    const context = this.context;
    const palette = projectilePalette(projectile);
    const visualRadius = projectile.owner === "hero" ? Math.max(12, projectile.radius * 1.15) : Math.max(6, projectile.radius * .7);
    context.save();
    context.globalCompositeOperation = "lighter";
    context.lineCap = "round";
    context.lineJoin = "round";
    for (let index = 1; index < projectile.trail.length; index++) {
      const from = projectile.trail[index - 1];
      const to = projectile.trail[index];
      const progress = index / projectile.trail.length;
      const alpha = clamp(to.life / to.maxLife, 0, 1) * progress;
      context.globalAlpha = alpha * (projectile.owner === "hero" ? .82 : .36);
      context.strokeStyle = projectile.owner === "hero" ? palette.trail : "rgba(255,72,110,.52)";
      context.lineWidth = Math.max(1.5, visualRadius * progress * (projectile.pathStyle === "spiral" ? .72 : .48));
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.quadraticCurveTo((from.x + to.x) / 2, (from.y + to.y) / 2, to.x, to.y);
      context.stroke();
      if (projectile.owner === "hero" && projectile.pathStyle === "sine" && index % 3 === 0) {
        context.fillStyle = palette.core;
        context.beginPath(); context.arc(to.x, to.y, Math.max(1.4, visualRadius * .11), 0, TAU); context.fill();
      }
    }
    context.restore();
  }

  private renderImpactEffects() {
    const context = this.context;
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const wave of this.shockwaves) {
      const progress = 1 - wave.life / wave.maxLife;
      context.globalAlpha = (1 - progress) * .8;
      context.strokeStyle = wave.color;
      context.lineWidth = Math.max(1, 6 * (1 - progress));
      context.beginPath(); context.arc(wave.x, wave.y, wave.maxRadius * (.2 + progress * .8), 0, TAU); context.stroke();
    }
    for (const particle of this.impactParticles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      context.globalAlpha = alpha;
      context.fillStyle = particle.color;
      context.shadowColor = particle.color;
      context.shadowBlur = 8;
      context.beginPath(); context.arc(particle.x, particle.y, particle.size * (.45 + alpha * .55), 0, TAU); context.fill();
    }
    context.restore();
  }

  private renderDrops(time: number) {
    const context = this.context;
    for (const drop of this.drops) {
      const bob = Math.sin(time * 5 + drop.eid) * 3;
      context.save(); context.translate(drop.x, drop.y + bob);
      if (drop.type === "exp") {
        context.rotate(time + drop.eid);
        context.fillStyle = drop.value >= 20 ? "#b670ff" : drop.value >= 8 ? "#53a9ff" : "#70e67c";
        context.beginPath(); context.moveTo(0, -8); context.lineTo(7, 0); context.lineTo(0, 8); context.lineTo(-7, 0); context.closePath(); context.fill();
        context.strokeStyle = "rgba(255,255,255,.8)"; context.lineWidth = 1.5; context.stroke();
      } else if (drop.type === "gold") {
        context.rotate(time + drop.eid);
        context.fillStyle = "#ffd85f"; context.beginPath(); context.arc(0, 0, 7, 0, TAU); context.fill(); context.strokeStyle = "#a56a20"; context.stroke();
      } else if (drop.type === "chest") {
        const rarity = RARITY_META[drop.quality ?? "common"];
        const rarityLevel = rarityIndex(drop.quality ?? "common");
        const pulse = 1 + Math.sin(time * 4 + drop.eid) * .05;
        const near = distanceSq(drop.x, drop.y, this.player.x, this.player.y) < 150 ** 2;
        const interactionRadius = drop.radius + this.player.radius + 5;
        context.save();
        context.globalAlpha = near ? .82 : .38;
        context.strokeStyle = rarity.color;
        context.lineWidth = near ? 2.5 : 1.5;
        context.setLineDash(near ? [7, 5] : [3, 7]);
        context.rotate(time * (near ? .8 : .35));
        context.beginPath(); context.ellipse(0, 18, interactionRadius, interactionRadius * .36, 0, 0, TAU); context.stroke();
        context.setLineDash([]);
        context.restore();

        // 中级宝箱（珍品、绝品）：品质色光柱、双层旋转光环和环绕灵子。
        if (rarityLevel >= 2) {
          context.save();
          context.globalCompositeOperation = "lighter";
          const beam = context.createLinearGradient(0, -190, 0, 48);
          beam.addColorStop(0, "rgba(255,255,255,0)");
          beam.addColorStop(.7, rarity.beam);
          beam.addColorStop(1, "rgba(255,255,255,0)");
          context.fillStyle = beam;
          context.fillRect(-34, -190, 68, 238);

          context.globalAlpha = rarityLevel >= 4 ? .92 : .68;
          context.strokeStyle = rarity.color;
          context.lineWidth = rarityLevel >= 4 ? 4 : 2.5;
          context.setLineDash(rarityLevel >= 4 ? [13, 7] : [8, 9]);
          context.save();
          context.rotate(time * .7 + drop.eid);
          context.beginPath(); context.ellipse(0, 18, 76, 29, 0, 0, TAU); context.stroke();
          context.restore();
          context.save();
          context.rotate(-time * 1.05 - drop.eid);
          context.setLineDash([3, 12]);
          context.beginPath(); context.ellipse(0, 18, 63, 23, 0, 0, TAU); context.stroke();
          context.restore();
          context.setLineDash([]);

          const moteCount = rarityLevel >= 4 ? 12 : rarityLevel === 3 ? 9 : 7;
          for (let mote = 0; mote < moteCount; mote++) {
            const angle = mote / moteCount * TAU + time * (rarityLevel >= 4 ? 1.35 : .82) + drop.eid;
            const orbit = 70 + Math.sin(time * 3 + mote * 1.7) * 8;
            const moteX = Math.cos(angle) * orbit;
            const moteY = 10 + Math.sin(angle) * orbit * .42;
            const moteSize = rarityLevel >= 4 ? 4.5 : 3;
            context.globalAlpha = .5 + Math.sin(time * 5 + mote) * .25;
            context.fillStyle = mote % 3 === 0 ? "#ffffff" : rarity.color;
            context.shadowColor = rarity.color;
            context.shadowBlur = rarityLevel >= 4 ? 14 : 8;
            context.beginPath(); context.arc(moteX, moteY, moteSize, 0, TAU); context.fill();
          }
          context.restore();
        }

        // 高级宝箱（仙品）：额外加入金色法阵、星芒和呼吸光晕，与中级特效明显区分。
        if (rarityLevel >= 4) {
          context.save();
          context.globalCompositeOperation = "lighter";
          const haloRadius = 82 + Math.sin(time * 4 + drop.eid) * 7;
          const halo = context.createRadialGradient(0, 0, 22, 0, 0, haloRadius);
          halo.addColorStop(0, "rgba(255,247,178,.48)");
          halo.addColorStop(.52, "rgba(255,202,74,.2)");
          halo.addColorStop(1, "rgba(255,190,42,0)");
          context.fillStyle = halo;
          context.beginPath(); context.arc(0, 0, haloRadius, 0, TAU); context.fill();
          context.translate(0, 18);
          context.rotate(-time * .42);
          context.strokeStyle = "rgba(255,239,150,.9)";
          context.lineWidth = 2;
          for (let ray = 0; ray < 8; ray++) {
            const angle = ray / 8 * TAU;
            context.beginPath();
            context.moveTo(Math.cos(angle) * 42, Math.sin(angle) * 16);
            context.lineTo(Math.cos(angle) * 88, Math.sin(angle) * 34);
            context.stroke();
          }
          context.restore();
        }

        context.scale(pulse, pulse);
        context.shadowColor = rarity.color;
        context.shadowBlur = rarityLevel * 9 + 5;
        const image = this.chestImages.get(drop.chestKind ?? "monster");
        if (image) context.drawImage(image, -CHEST_RENDER_SIZE / 2, -CHEST_RENDER_SIZE / 2, CHEST_RENDER_SIZE, CHEST_RENDER_SIZE);
        else {
          context.fillStyle = drop.chestKind === "buff" ? "#397e67" : drop.chestKind === "treasure" ? "#b6823f" : "#6d3f53";
          context.fillRect(-50, -38, 100, 76);
          context.fillStyle = rarity.color;
          context.fillRect(-7, -38, 14, 76);
        }
        context.strokeStyle = rarity.color;
        context.lineWidth = rarityLevel >= 4 ? 3 : 2;
        context.strokeRect(-53, -41, 106, 82);
      } else {
        context.rotate(time + drop.eid);
        context.fillStyle = drop.type === "heal" ? "#ff6b71" : "#78e4ff"; context.beginPath(); context.arc(0, 0, 10, 0, TAU); context.fill();
      }
      context.restore();
    }
  }

  private renderPartnerStrikes(time: number) {
    const context = this.context;
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const strike of this.partnerStrikes) {
      const alpha = clamp(strike.life / strike.maxLife, 0, 1);
      context.save();
      context.translate(strike.x, strike.y);
      context.globalAlpha = alpha;
      if (strike.kind === "lightning") {
        const top = -Math.max(420, this.context.canvas.clientHeight * .72);
        context.lineCap = "round";
        context.strokeStyle = "rgba(102,186,255,.42)";
        context.lineWidth = 18;
        context.beginPath(); context.moveTo(0, 10); context.lineTo(0, top); context.stroke();
        context.strokeStyle = "#f8ffff";
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(0, 12);
        for (let step = 1; step <= 8; step++) {
          const ratio = step / 8;
          const jitter = step === 8 ? 0 : Math.sin(strike.seed + step * 8.13 + time * 22) * 24;
          context.lineTo(jitter, 12 + (top - 12) * ratio);
        }
        context.stroke();
        const burst = context.createRadialGradient(0, 0, 0, 0, 0, 82);
        burst.addColorStop(0, "rgba(255,255,255,1)");
        burst.addColorStop(.24, "rgba(139,235,255,.9)");
        burst.addColorStop(1, "rgba(91,89,255,0)");
        context.fillStyle = burst;
        context.beginPath(); context.arc(0, 0, 82 * (1.15 - alpha * .15), 0, TAU); context.fill();
      } else if (strike.kind === "sword") {
        context.rotate(-.58 + Math.sin(strike.seed) * .22);
        const length = 150 * (1.25 - alpha * .25);
        const slash = context.createLinearGradient(-length, 0, length, 0);
        slash.addColorStop(0, "rgba(184,120,255,0)");
        slash.addColorStop(.42, "rgba(215,181,255,.76)");
        slash.addColorStop(.5, "#ffffff");
        slash.addColorStop(.58, "rgba(130,226,255,.8)");
        slash.addColorStop(1, "rgba(80,170,255,0)");
        context.strokeStyle = slash;
        context.lineWidth = 12 * alpha + 3;
        context.beginPath(); context.moveTo(-length, 0); context.quadraticCurveTo(0, -28, length, 0); context.stroke();
      } else {
        const radius = 96 * (1.2 - alpha * .2);
        context.strokeStyle = `rgba(188,247,255,${alpha})`;
        context.lineWidth = 7;
        context.setLineDash([12, 9]);
        context.rotate(time * 1.8 + strike.seed);
        context.beginPath(); context.arc(0, 0, radius, 0, TAU); context.stroke();
        context.setLineDash([]);
        for (let shard = 0; shard < 8; shard++) {
          const angle = shard / 8 * TAU;
          context.fillStyle = "rgba(221,252,255,.88)";
          context.beginPath();
          context.moveTo(Math.cos(angle) * 24, Math.sin(angle) * 24);
          context.lineTo(Math.cos(angle - .08) * radius, Math.sin(angle - .08) * radius);
          context.lineTo(Math.cos(angle + .08) * radius, Math.sin(angle + .08) * radius);
          context.closePath();
          context.fill();
        }
      }
      context.restore();
    }
    context.restore();
  }

  private renderDamageTexts() {
    const context = this.context;
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (const text of this.damageTexts) {
      const maxLife = text.maxLife ?? .55;
      const progress = clamp(1 - text.life / maxLife, 0, 1);
      const pop = progress < .18 ? .7 + progress / .18 * .55 : 1.25 - (progress - .18) * .3;
      context.globalAlpha = clamp(Math.min(1, text.life * 3), 0, 1);
      context.font = `900 ${Math.max(10, text.size * pop)}px Arial`;
      context.strokeStyle = "rgba(42,22,31,.8)"; context.lineWidth = 4; context.strokeText(text.value, text.x, text.y);
      context.fillStyle = text.color; context.fillText(text.value, text.x, text.y);
    }
    context.globalAlpha = 1;
  }

  private drawHitbox(x: number, y: number, radius: number, color: string) {
    const context = this.context;
    context.save(); context.strokeStyle = color; context.lineWidth = 1; context.beginPath(); context.arc(x, y, radius, 0, TAU); context.stroke(); context.restore();
  }
}
