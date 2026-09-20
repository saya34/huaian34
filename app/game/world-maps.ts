import type { RegionId } from "./core/dungeons";
import type { SceneId } from "./types";

export type WorldMapId = "yunzhou" | "village" | "wilds" | "canglan" | "chixia";
export type WorldMapLocation = {
  id: string;
  name: string;
  subtitle: string;
  x: number;
  y: number;
  icon: string;
  sceneId?: SceneId;
  targetMapId?: WorldMapId;
  unlocked: boolean;
};
export type WorldMapDefinition = {
  id: WorldMapId;
  name: string;
  subtitle: string;
  description: string;
  image: string;
  chapterMark: string;
  unlockWave: number;
  dungeonRegionId?: RegionId;
  locations: WorldMapLocation[];
};

export const WORLD_MAPS: WorldMapDefinition[] = [
  {
    id: "yunzhou",
    name: "凌云宗门",
    subtitle: "第一地图 · 问道起居与同门相伴",
    description: "云海托起宗门诸峰。此域以同门交往、炼丹起居和人物剧情为主，山下营生与历练已迁往相邻地域。",
    image: "/assets/maps/yunzhou-realm.webp",
    chapterMark: "壹",
    unlockWave: 1,
    locations: [
      { id: "lingxiao", name: "凌霄殿", subtitle: "宗门正殿 · 会见同门", x: 58, y: 18, icon: "殿", sceneId: "lingxiao", unlocked: true },
      { id: "bedroom", name: "听云居", subtitle: "你的居所 · 练功休憩", x: 42, y: 36, icon: "居", sceneId: "bedroom", unlocked: true },
      { id: "senior-sister-home", name: "师姐住处", subtitle: "夭夭师姐 · 夜晚归居", x: 72, y: 44, icon: "姊", sceneId: "senior-sister-home", unlocked: true },
      { id: "junior-sister-home", name: "师妹住处", subtitle: "小师妹 · 夜晚归居", x: 28, y: 48, icon: "妹", sceneId: "junior-sister-home", unlocked: true },
      { id: "kitchen", name: "烟火小灶", subtitle: "料理灵膳 · 王妈掌勺", x: 59, y: 61, icon: "膳", sceneId: "kitchen", unlocked: true },
      { id: "intelligence-bureau", name: "槐安情报局", subtitle: "诸界闻壁 · 道友论坛", x: 27, y: 70, icon: "闻", sceneId: "intelligence-bureau", unlocked: true },
      { id: "to-village", name: "下山云阶", subtitle: "前往山下村庄", x: 72, y: 86, icon: "村", targetMapId: "village", unlocked: true },
    ],
  },
  {
    id: "village",
    name: "山下村庄",
    subtitle: "第二地图 · 田园营生与人间烟火",
    description: "灵田、牧苑、商铺与酒楼沿山溪铺开。村中人物各有日常，也藏着沈家旧院与田间小屋的故事。",
    image: "/assets/maps/mountain-village.jpg",
    chapterMark: "贰",
    unlockWave: 1,
    locations: [
      { id: "spirit-farm", name: "云岫灵田与牧苑", subtitle: "种植 · 畜牧 · 生产", x: 20, y: 25, icon: "田", sceneId: "spirit-farm", unlocked: true },
      { id: "tavern", name: "醉月楼", subtitle: "临水酒楼 · 闻听轶事", x: 18, y: 48, icon: "酒", sceneId: "tavern", unlocked: true },
      { id: "market", name: "山下集市", subtitle: "周期集会 · 百物交易", x: 51, y: 43, icon: "市", sceneId: "market", unlocked: true },
      { id: "treasure-shop", name: "栖珍阁", subtitle: "杂货铺 · 买卖百物", x: 77, y: 50, icon: "珍", sceneId: "treasure-shop", unlocked: true },
      { id: "field-cottage", name: "田间小屋", subtitle: "囡囡母女的田畔居所", x: 23, y: 66, icon: "舍", sceneId: "field-cottage", unlocked: true },
      { id: "shen-estate", name: "沈家大院", subtitle: "清音与晚棠的旧宅", x: 72, y: 65, icon: "沈", sceneId: "shen-estate", unlocked: true },
      { id: "to-yunzhou", name: "登云山门", subtitle: "返回凌云宗门", x: 77, y: 13, icon: "宗", targetMapId: "yunzhou", unlocked: true },
      { id: "to-wilds", name: "村外古道", subtitle: "前往野外", x: 75, y: 87, icon: "野", targetMapId: "wilds", unlocked: true },
    ],
  },
  {
    id: "wilds",
    name: "云州野外",
    subtitle: "第三地图 · 秘境、垂钓与地宫勘探",
    description: "林海、溪谷与矿脉交错。战斗秘境、随机钓点和游光矿脉大多在此显现，林间小屋则为远行者留着一盏灯。",
    image: "/assets/maps/wildlands.jpg",
    chapterMark: "叁",
    unlockWave: 1,
    dungeonRegionId: "yunzhou",
    locations: [
      { id: "forest-cabin", name: "林间小屋", subtitle: "猎人居所 · 山林见闻", x: 18, y: 26, icon: "猎", sceneId: "forest-cabin", unlocked: true },
      { id: "to-village", name: "归村石桥", subtitle: "返回山下村庄", x: 17, y: 88, icon: "村", targetMapId: "village", unlocked: true },
      { id: "to-canglan", name: "沧澜古道", subtitle: "通往东方水域", x: 85, y: 10, icon: "舟", targetMapId: "canglan", unlocked: true },
    ],
  },
  {
    id: "canglan",
    name: "沧澜水域",
    subtitle: "第四地图 · 尚未解锁",
    description: "月落万顷碧波，浮岛与剑阁之间似有旧日仙航。区域地点暂不可进入。",
    image: "/assets/maps/canglan-waters.webp",
    chapterMark: "肆",
    unlockWave: 8,
    dungeonRegionId: "canglan",
    locations: [
      { id: "sword-pavilion", name: "照海剑阁", subtitle: "悬于潮眼之上的剑台", x: 62, y: 29, icon: "剑", unlocked: false },
      { id: "medicine-valley", name: "月汐药谷", subtitle: "只在月下显形的灵谷", x: 27, y: 43, icon: "药", unlocked: false },
      { id: "island-market", name: "浮灯海市", subtitle: "来去无踪的水上集市", x: 69, y: 59, icon: "市", unlocked: false },
      { id: "water-shrine", name: "听澜古祠", subtitle: "潮声守护的古老祠堂", x: 30, y: 75, icon: "祠", unlocked: false },
      { id: "canglan-north", name: "北溟云门", subtitle: "返回云州野外", x: 18, y: 15, icon: "门", targetMapId: "wilds", unlocked: true },
      { id: "canglan-south", name: "归墟水驿", subtitle: "通往赤霞荒域", x: 78, y: 87, icon: "驿", targetMapId: "chixia", unlocked: true },
    ],
  },
  {
    id: "chixia",
    name: "赤霞荒域",
    subtitle: "第五地图 · 尚未解锁",
    description: "赤岩裂地，古老剑意与星台遗迹仍在暮色中沉睡。区域地点暂不可进入。",
    image: "/assets/maps/chixia-frontier.webp",
    chapterMark: "伍",
    unlockWave: 15,
    dungeonRegionId: "chixia",
    locations: [
      { id: "sword-tomb", name: "万剑古冢", subtitle: "断剑遍立的赤岩绝峰", x: 27, y: 39, icon: "冢", unlocked: false },
      { id: "observatory", name: "紫微天台", subtitle: "悬空观测天象的遗迹", x: 66, y: 25, icon: "星", unlocked: false },
      { id: "lotus-city", name: "焚莲城", subtitle: "以地火温养灵器的古城", x: 70, y: 56, icon: "莲", unlocked: false },
      { id: "sealed-ruin", name: "无相封墟", subtitle: "阵柱环绕的禁行之地", x: 31, y: 73, icon: "封", unlocked: false },
      { id: "chixia-west", name: "落日天门", subtitle: "返回沧澜水域", x: 16, y: 16, icon: "门", targetMapId: "canglan", unlocked: true },
    ],
  },
];

export const WORLD_MAP_BY_ID = Object.fromEntries(WORLD_MAPS.map((map) => [map.id, map])) as Record<WorldMapId, WorldMapDefinition>;

export function worldMapForScene(sceneId: SceneId) {
  return WORLD_MAPS.find((map) => map.locations.some((location) => location.sceneId === sceneId));
}

export function isWorldMapUnlocked(mapId: WorldMapId, highestUnlocked: number) {
  return WORLD_MAP_BY_ID[mapId].unlockWave <= highestUnlocked;
}
