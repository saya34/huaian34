export type AnyRow = Record<string, any>;

export interface AssetManifest {
  atlases: { name: string; image: string; plist: string | null }[];
  effects: { name: string; path: string; folder: string }[];
  scenes: { name: string; path: string; scene: string }[];
  ui: { name: string; path: string }[];
}

export interface GameData {
  monsters: AnyRow[];
  monsterSkills: AnyRow[];
  monsterSkillTypes: AnyRow[];
  bullets: AnyRow[];
  skills: AnyRow[];
  skillLevels: AnyRow[];
  evolutions: AnyRow[];
  supplies: AnyRow[];
  supplyLevels: AnyRow[];
  battleLevels: AnyRow[];
  waves: AnyRow[];
  wavePlans: AnyRow[];
  waveNums: AnyRow[];
  waveTypes: AnyRow[];
  heroes: AnyRow[];
  maps: AnyRow[];
  models: AnyRow[];
  fubens: AnyRow[];
  skillGroups: AnyRow[];
  gameConfig: AnyRow[];
  manifest: AssetManifest;
}

const ROOT = "/blcx-assets";

const GU_CHANGFENG_HERO: AnyRow = {
  animationId: 400007,
  attr: [{ key: "lv", value: 80 }],
  audio: 1,
  bodyModel: "custom_gu_changfeng",
  desc: "青年剑修，御使飞剑追踪最近的妖物。",
  equipIcon: "",
  equipType: 1,
  iconBattle: "",
  iconCard: "",
  id: 400007,
  modelBattle: "custom_gu_changfeng",
  name: "顾长风",
  property: [
    { key: "spd", value: 265 },
    { key: "pua", value: 100 },
  ],
  showGet: 400007,
  sort: 6,
  weapon: 10000,
  unlockTip: null,
  portrait: "/game-assets/heroes/young-male-cultivator.webp",
  animationSet: {
    idleWalk: "/game-assets/heroes/gu-changfeng-idle-walk.webp",
    attack: "/game-assets/heroes/gu-changfeng-attack.webp",
    hurtDefeat: "/game-assets/heroes/gu-changfeng-hurt-defeat.webp",
  },
};

const CUSTOM_HEROES: AnyRow[] = [
  {
    animationId: 400008,
    attr: [{ key: "lv", value: 80 }],
    audio: 1,
    bodyModel: "custom_shen_xiao",
    desc: "雷枪修士，枪出如霆，以连绵雷势洞穿群妖。",
    equipIcon: "",
    equipType: 1,
    iconBattle: "",
    iconCard: "",
    id: 400008,
    modelBattle: "custom_shen_xiao",
    name: "沈霄",
    property: [{ key: "spd", value: 270 }, { key: "pua", value: 105 }],
    showGet: 400008,
    sort: 7,
    weapon: 10000,
    unlockTip: null,
    portrait: "/game-assets/heroes/shen-xiao-portrait.webp",
    animationSet: {
      idleWalk: "/game-assets/heroes/shen-xiao-idle-walk.webp",
      attack: "/game-assets/heroes/shen-xiao-attack.webp",
      hurtDefeat: "/game-assets/heroes/shen-xiao-hurt-defeat.webp",
    },
    combatStyle: { projectile: "lightningSpear", trail: "lightning", tint: "#69cfff" },
  },
  {
    animationId: 400009,
    attr: [{ key: "lv", value: 80 }],
    audio: 1,
    bodyModel: "custom_su_qingli",
    desc: "寒魄灵弓的传人，箭矢携霜而至，身法轻盈迅捷。",
    equipIcon: "",
    equipType: 1,
    iconBattle: "",
    iconCard: "",
    id: 400009,
    modelBattle: "custom_su_qingli",
    name: "苏清璃",
    property: [{ key: "spd", value: 278 }, { key: "pua", value: 98 }],
    showGet: 400009,
    sort: 8,
    weapon: 10000,
    unlockTip: null,
    portrait: "/game-assets/heroes/su-qingli-portrait.webp",
    animationSet: {
      idleWalk: "/game-assets/heroes/su-qingli-idle-walk.webp",
      attack: "/game-assets/heroes/su-qingli-attack.webp",
      hurtDefeat: "/game-assets/heroes/su-qingli-hurt-defeat.webp",
    },
    combatStyle: { projectile: "frostArrow", trail: "frost", tint: "#d6f6ff" },
  },
  {
    animationId: 400010,
    attr: [{ key: "lv", value: 80 }],
    audio: 1,
    bodyModel: "custom_luo_hongling",
    desc: "赤鸾火脉觉醒者，羽扇挥舞间可卷起灼烈火浪。",
    equipIcon: "",
    equipType: 1,
    iconBattle: "",
    iconCard: "",
    id: 400010,
    modelBattle: "custom_luo_hongling",
    name: "洛红绫",
    property: [{ key: "spd", value: 266 }, { key: "pua", value: 108 }],
    showGet: 400010,
    sort: 9,
    weapon: 10000,
    unlockTip: null,
    portrait: "/game-assets/heroes/luo-hongling-portrait.webp",
    animationSet: {
      idleWalk: "/game-assets/heroes/luo-hongling-idle-walk.webp",
      attack: "/game-assets/heroes/luo-hongling-attack.webp",
      hurtDefeat: "/game-assets/heroes/luo-hongling-hurt-defeat.webp",
    },
    combatStyle: { projectile: "phoenixFan", trail: "flame", tint: "#ff8b38" },
  },
];

export function decodeRef(raw: any): AnyRow[] {
  if (!raw || raw.c !== 1 || !Array.isArray(raw.k) || !Array.isArray(raw.v)) {
    return Array.isArray(raw) ? raw : [];
  }
  const shared: any[] = raw.sv ?? [];
  const valueKeys: Record<string, string[]> = raw.vk ?? {};
  return raw.v.map((row: any[]) => {
    const value: AnyRow = {};
    row.forEach((source, index) => {
      const key = raw.k[index];
      let entry = source;
      if (typeof entry === "string" && entry.startsWith(">}")) {
        const sharedIndex = Number(entry.slice(2));
        if (Number.isFinite(sharedIndex)) entry = shared[sharedIndex];
      }
      const nestedKeys = valueKeys[key];
      if (nestedKeys?.length && Array.isArray(entry)) {
        entry = Object.fromEntries(nestedKeys.map((nestedKey, i) => [nestedKey, entry[i]]));
      }
      value[key] = entry;
    });
    return value;
  });
}

async function loadRef(name: string): Promise<AnyRow[]> {
  const response = await fetch(`${ROOT}/ref/${name}.json`);
  if (!response.ok) throw new Error(`配置加载失败: ${name}`);
  return decodeRef(await response.json());
}

export async function loadGameData(): Promise<GameData> {
  const names = [
    "battleMonsterRef",
    "battleSkillMonster",
    "battleSkillTypeMonster",
    "battleBullet",
    "battleSkillRef",
    "battleSkillLevel",
    "battleSkillEvolutionRef",
    "battleSupplyRef",
    "battleSupplyLevelRef",
    "battleLevelRef",
    "battleWaveRef",
    "battleWavePlanRef",
    "battleWaveNumRef",
    "battleWaveType",
    "hero",
    "mapRef",
    "modelRef",
    "fuBenRef",
    "fuBenCanUseSkillGroupRef",
    "gameConfig",
  ];
  const [rows, manifestResponse] = await Promise.all([
    Promise.all(names.map(loadRef)),
    fetch(`${ROOT}/asset-manifest.json`),
  ]);
  if (!manifestResponse.ok) throw new Error("原项目素材索引加载失败");
  const manifest = (await manifestResponse.json()) as AssetManifest;
  return {
    monsters: rows[0],
    monsterSkills: rows[1],
    monsterSkillTypes: rows[2],
    bullets: rows[3],
    skills: rows[4],
    skillLevels: rows[5],
    evolutions: rows[6],
    supplies: rows[7],
    supplyLevels: rows[8],
    battleLevels: rows[9],
    waves: rows[10],
    wavePlans: rows[11],
    waveNums: rows[12],
    waveTypes: rows[13],
    heroes: [GU_CHANGFENG_HERO, ...CUSTOM_HEROES, ...rows[14]],
    maps: rows[15],
    models: rows[16],
    fubens: rows[17],
    skillGroups: rows[18],
    gameConfig: rows[19],
    manifest,
  };
}

export const byId = (rows: AnyRow[], id: number, field = "id") =>
  rows.find((row) => Number(row[field]) === Number(id));

export function gameConfigValue(data: GameData, key: string, fallback: any) {
  return data.gameConfig.find((row) => row.key === key)?.value ?? fallback;
}

export function normalizeAssetName(value: string) {
  return String(value ?? "")
    .replace(/^百恋_(怪物|英雄|技能|章节地图|活动地图)_/, "")
    .replace(/^百恋_/, "")
    .replace(/[·_\-\s（）()]/g, "")
    .toLowerCase();
}

export const assetUrl = (relative: string) => {
  if (/^(?:https?:|data:|blob:)/i.test(relative)) return relative;
  if (relative.startsWith("/")) return relative.split("/").map(encodeURIComponent).join("/");
  return `${ROOT}/${relative.split("/").map(encodeURIComponent).join("/")}`;
};
