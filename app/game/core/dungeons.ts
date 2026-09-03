export type RegionId = "yunzhou" | "canglan" | "chixia";

export type DungeonDefinition = {
  id: string;
  waveId: number;
  regionId: RegionId;
  name: string;
  kind: "permanent" | "random";
  recommendedPower: number;
  x: number;
  y: number;
  requiresMap?: boolean;
};

export const REGIONS = [
  { id: "yunzhou" as const, name: "云州山河", image: "/assets/maps/yunzhou-realm.webp", subtitle: "山门、烟市与初醒灵脉" },
  { id: "canglan" as const, name: "沧澜水域", image: "/assets/maps/canglan-waters.webp", subtitle: "潮宫、毒泽与水下旧城" },
  { id: "chixia" as const, name: "赤霞荒域", image: "/assets/maps/chixia-frontier.webp", subtitle: "火矿、古战场与妖王遗境" },
];

const names: Record<RegionId, string[]> = {
  yunzhou: ["青岚秘径", "落星古道", "栖霞妖窟", "凌霄残境", "月隐竹海", "镜花墟", "旧梦山门"],
  canglan: ["听潮水府", "沉舟鬼港", "寒鲛宫", "沧海月墟", "雾毒泽", "龙眠渊", "无灯水城"],
  chixia: ["赤砂矿脉", "焚风古道", "离火妖城", "神墟战场", "烬羽天坑", "血月荒台", "太初火海"],
};

export const DUNGEONS: DungeonDefinition[] = [...REGIONS.flatMap((region, regionIndex) => names[region.id].map((name, index) => ({
  id: `${region.id}-${index + 1}`,
  waveId: regionIndex * 7 + index + 1,
  regionId: region.id,
  name,
  kind: (index < 4 ? "permanent" : "random") as "permanent" | "random",
  recommendedPower: 120 + (regionIndex * 7 + index) * 85,
  x: [24, 42, 66, 78, 33, 58, 73][index],
  y: [58, 35, 48, 69, 73, 24, 38][index],
}))), { id:"treasure-map-vault",waveId:7,regionId:"yunzhou",name:"太虚藏宝窟",kind:"random",recommendedPower:980,x:52,y:82,requiresMap:true }];
