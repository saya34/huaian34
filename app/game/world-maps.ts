import type { SceneId } from "./types";

export type WorldMapId="yunzhou"|"canglan"|"chixia";
export type WorldMapLocation={id:string;name:string;subtitle:string;x:number;y:number;icon:string;sceneId?:SceneId;targetMapId?:WorldMapId;unlocked:boolean};
export type WorldMapDefinition={id:WorldMapId;name:string;subtitle:string;description:string;image:string;locations:WorldMapLocation[]};

export const WORLD_MAPS:WorldMapDefinition[]=[
  {id:"yunzhou",name:"云州山河",subtitle:"主地图 · 云上宗门与山下烟火",description:"群峰拱卫宗门，长河一路通往醉月楼。两条远行古道仍被云障封锁。",image:"/assets/maps/yunzhou-realm.webp",locations:[
    {id:"lingxiao",name:"凌霄殿",subtitle:"宗门 · 云海之上",x:59,y:19,icon:"殿",sceneId:"lingxiao",unlocked:true},
    {id:"tavern",name:"醉月楼",subtitle:"山下 · 临水酒楼",x:61,y:73,icon:"酒",sceneId:"tavern",unlocked:true},
    {id:"market",name:"云州市集",subtitle:"每月十五 · 百宝云集",x:35,y:58,icon:"市",sceneId:"market",unlocked:true},
    {id:"treasure-shop",name:"栖珍阁",subtitle:"常设商铺 · 买卖百物",x:43,y:67,icon:"珍",sceneId:"treasure-shop",unlocked:true},
    {id:"bedroom",name:"听云居",subtitle:"居所 · 静室练功",x:42,y:35,icon:"居",sceneId:"bedroom",unlocked:true},
    {id:"spirit-farm",name:"云岫灵圃",subtitle:"种植仙草 · 供给丹炉",x:72,y:43,icon:"圃",sceneId:"spirit-farm",unlocked:true},
    {id:"intelligence-bureau",name:"槐安情报局",subtitle:"诸界闻壁 · 道友论坛",x:24,y:66,icon:"闻",sceneId:"intelligence-bureau",unlocked:true},
    {id:"to-canglan",name:"沧澜渡",subtitle:"通往东方水域",x:18,y:30,icon:"舟",targetMapId:"canglan",unlocked:true},
    {id:"to-chixia",name:"赤霞关",subtitle:"通往西境荒域",x:82,y:85,icon:"关",targetMapId:"chixia",unlocked:true},
  ]},
  {id:"canglan",name:"沧澜水域",subtitle:"第二地图 · 尚未解锁",description:"月落万顷碧波，浮岛与剑阁之间似有旧日仙航。区域地点暂不可进入。",image:"/assets/maps/canglan-waters.webp",locations:[
    {id:"sword-pavilion",name:"照海剑阁",subtitle:"悬于潮眼之上的剑台",x:62,y:29,icon:"剑",unlocked:false},
    {id:"medicine-valley",name:"月汐药谷",subtitle:"只在月下显形的灵谷",x:27,y:43,icon:"药",unlocked:false},
    {id:"island-market",name:"浮灯海市",subtitle:"来去无踪的水上集市",x:69,y:59,icon:"市",unlocked:false},
    {id:"water-shrine",name:"听澜古祠",subtitle:"潮声守护的古老祠堂",x:30,y:75,icon:"祠",unlocked:false},
    {id:"canglan-north",name:"北溟云门",subtitle:"返回云州山河",x:18,y:15,icon:"门",targetMapId:"yunzhou",unlocked:true},
    {id:"canglan-south",name:"归墟水驿",subtitle:"通往赤霞荒域",x:78,y:87,icon:"驿",targetMapId:"chixia",unlocked:true},
  ]},
  {id:"chixia",name:"赤霞荒域",subtitle:"第三地图 · 尚未解锁",description:"赤岩裂地，古老剑意与星台遗迹仍在暮色中沉睡。区域地点暂不可进入。",image:"/assets/maps/chixia-frontier.webp",locations:[
    {id:"sword-tomb",name:"万剑古冢",subtitle:"断剑遍立的赤岩绝峰",x:27,y:39,icon:"冢",unlocked:false},
    {id:"observatory",name:"紫微天台",subtitle:"悬空观测天象的遗迹",x:66,y:25,icon:"星",unlocked:false},
    {id:"lotus-city",name:"焚莲城",subtitle:"以地火温养灵器的古城",x:70,y:56,icon:"莲",unlocked:false},
    {id:"sealed-ruin",name:"无相封墟",subtitle:"阵柱环绕的禁行之地",x:31,y:73,icon:"封",unlocked:false},
    {id:"chixia-west",name:"落日天门",subtitle:"返回云州山河",x:16,y:16,icon:"门",targetMapId:"yunzhou",unlocked:true},
    {id:"chixia-east",name:"星陨古道",subtitle:"通往沧澜水域",x:84,y:32,icon:"道",targetMapId:"canglan",unlocked:true},
  ]},
];

export const WORLD_MAP_BY_ID=Object.fromEntries(WORLD_MAPS.map((map)=>[map.id,map])) as Record<WorldMapId,WorldMapDefinition>;
