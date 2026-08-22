export type CommissionNpc = {
  id: string;
  name: string;
  title: string;
  organization: string;
  element: string;
  portrait: string;
  greeting: string;
  dialogue: string[];
};

export const COMMISSION_NPCS: CommissionNpc[] = [
  {
    id: "gu-changfeng",
    name: "顾长风",
    title: "听雪剑客",
    organization: "北境·凌霄剑宗",
    element: "金",
    portrait: "/assets/commission-npcs/gu-changfeng.webp",
    greeting: "借炉主一步说话。",
    dialogue: [
      "北境风雪封山，守关弟子所需的丹药已所剩无几。",
      "若你愿接下榜上委托，凌霄剑宗愿以高于市价的酬金相谢。",
    ],
  },
  {
    id: "shen-qingluo",
    name: "沈青萝",
    title: "百草医仙",
    organization: "南谷·青囊医庐",
    element: "木",
    portrait: "/assets/commission-npcs/shen-qingluo.webp",
    greeting: "炉主，可否听我一言？",
    dialogue: [
      "谷中病患骤增，寻常药材易得，能稳住灵脉的丹药却难炼。",
      "我将需求写入仙门榜中，成色越好的丹药，医庐给出的价格越高。",
    ],
  },
  {
    id: "tie-wujiu",
    name: "铁无咎",
    title: "镇岳镖首",
    organization: "西川·震远镖局",
    element: "土",
    portrait: "/assets/commission-npcs/tie-wujiu.webp",
    greeting: "这趟镖，少不了你的丹。",
    dialogue: [
      "商路上妖兽横行，弟兄们带的护脉丹已经耗尽。",
      "我不拘丹名，只要符合榜上的条件，便按实价另加五成收下。",
    ],
  },
  {
    id: "su-yeli",
    name: "苏夜璃",
    title: "听雨楼主",
    organization: "东都·听雨楼",
    element: "阴",
    portrait: "/assets/commission-npcs/su-yeli.webp",
    greeting: "今夜的风，带来了一个好价钱。",
    dialogue: [
      "有些客人不问丹名，只看五行与品阶，选什么货由你决定。",
      "替我填满委托匣，定价单照榜结算，浮价单则按总估值的一点五倍。",
    ],
  },
];
