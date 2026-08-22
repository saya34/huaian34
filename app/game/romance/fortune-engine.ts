export type FortuneEffect = "none" | "talk_double" | "gift_double" | "social_double";

export type FortuneSign = {
  id: string;
  rank: "上上签" | "上签" | "中签" | "平签" | "下签";
  title: string;
  quote: string;
  peach: number;
  wealth: number;
  chance: number;
  effect: FortuneEffect;
  weight: number;
};

export type FortuneDrawRecord = {
  dateKey: string;
  signId: string;
  auspicious: string[];
  taboo: string[];
  opening: string;
  interpretation: string;
};

export const FORTUNE_STORAGE_KEY = "cloud-romance-real-daily-fortune-v1";

export const DIVINATION_OPENINGS = [
  "医师以净水洗过龟甲，将三枚灵钱依次落入青瓷盘。",
  "柳知意燃起一线药香，示意你在心中默念今日所求。",
  "窗外雨声正细，她把签筒推到你面前，指尖压住微颤的竹签。",
  "她取来悬壶谷的旧签册，说今日只问行止，不问生死。",
  "一枚铜钱在案上旋了许久，最终停在她指尖旁。",
  "柳知意听完你的来意，先诊了脉，才肯替你起这一卦。",
  "药炉余温未散，她借炉中青烟辨认卦象的去处。",
  "她将白玉签一字排开，让你凭第一眼选中其中一枚。",
];

export const DIVINATION_INTERPRETATIONS = [
  "卦象只照今日，不替你决定脚下的路。顺势而行，莫因吉凶失了本心。",
  "今日气机有聚有散。该见的人便去见，该说的话莫留到明日。",
  "签文未必尽准，但心中第一念往往比签更诚实。",
  "吉处不可挥霍，险处也并非绝路。你只需比往日多留意一步。",
  "世间所谓机缘，多半是准备好的人恰好没有错过。",
  "今日宜缓不宜急。若有人等你，莫让她等得太久。",
  "这签气息清正。少些猜疑，多些坦诚，便不负今日好风。",
  "卦中有变，变中有生。临事先定心，再定剑。",
  "财与缘皆是外象，真正要紧的是你愿意把时间留给谁。",
  "今日的一点善意，或许会在很久以后回到你身边。",
];

export const FORTUNE_SIGNS: FortuneSign[] = [
  { id:"red-luan",rank:"上上签",title:"红鸾入命",quote:"一念有应，双星照席；所见之人，亦在见你。",peach:5,wealth:3,chance:5,effect:"social_double",weight:4 },
  { id:"crane-letter",rank:"上签",title:"云鹤衔书",quote:"书来雁往，旧言得续；开口之时，便是缘起。",peach:4,wealth:2,chance:4,effect:"talk_double",weight:8 },
  { id:"golden-orchid",rank:"上签",title:"金兰照路",quote:"访友逢知己，闲谈见真心；一言胜却千金。",peach:4,wealth:3,chance:4,effect:"talk_double",weight:8 },
  { id:"jade-box",rank:"上签",title:"玉匣生辉",quote:"礼轻意重，藏于方寸；投桃报李，心意可知。",peach:4,wealth:4,chance:3,effect:"gift_double",weight:8 },
  { id:"moon-offering",rank:"上签",title:"灵犀奉月",quote:"月照掌中物，物寄未尽言；今日赠礼，最宜表心。",peach:5,wealth:2,chance:4,effect:"gift_double",weight:8 },
  { id:"purple-air",rank:"上上签",title:"紫气东来",quote:"云开千嶂，路见长明；所行皆有回响。",peach:4,wealth:4,chance:5,effect:"none",weight:5 },
  { id:"spring-stream",rank:"上签",title:"春水绕庭",quote:"流水不争先，却自能抵达花开之处。",peach:4,wealth:3,chance:4,effect:"none",weight:7 },
  { id:"pine-wind",rank:"中签",title:"松风解意",quote:"风过松间，繁声自静；守心片刻，答案自明。",peach:3,wealth:3,chance:3,effect:"none",weight:7 },
  { id:"half-moon",rank:"中签",title:"半月藏辉",quote:"未圆并非有缺，静待一夜，自见清光。",peach:3,wealth:2,chance:4,effect:"none",weight:7 },
  { id:"fish-shadow",rank:"中签",title:"鱼影过桥",quote:"水动影散，不必追问；来时自来，去时莫留。",peach:2,wealth:3,chance:3,effect:"none",weight:7 },
  { id:"tea-smoke",rank:"平签",title:"茶烟微起",quote:"寻常日子亦有清欢，宜把脚步放慢一些。",peach:3,wealth:2,chance:2,effect:"none",weight:7 },
  { id:"cloud-rest",rank:"平签",title:"云停远岫",quote:"山高路缓，停一停并不算误了行程。",peach:2,wealth:3,chance:2,effect:"none",weight:7 },
  { id:"rain-lantern",rank:"中签",title:"灯照微雨",quote:"前路虽湿，仍有一盏灯替你留着。",peach:4,wealth:2,chance:3,effect:"none",weight:6 },
  { id:"frost-branch",rank:"平签",title:"霜压寒枝",quote:"眼前稍滞，根骨未伤；少行险路，静候回暖。",peach:2,wealth:2,chance:2,effect:"none",weight:6 },
  { id:"lost-cloud",rank:"下签",title:"乱云遮月",quote:"所求暂隐，强取反失；谨言慎行，可避微厄。",peach:1,wealth:2,chance:1,effect:"none",weight:5 },
];

const AUSPICIOUS_POOL = ["访友","炼丹","采药","品茗","读卷","赏花","赠礼","写信","听雨","静修","温酒","抚琴","整理行囊","拜访故人"];
const TABOO_POOL = ["御剑","赌石","远行","争辩","熬夜","独闯秘境","借酒消愁","妄下承诺","强行破阵","追问旧事"];

function randomValue() { return Math.random(); }

function pickUnique(pool: string[], count: number) {
  const available = [...pool]; const result: string[] = [];
  while (available.length && result.length < count) result.push(available.splice(Math.floor(randomValue() * available.length), 1)[0]);
  return result;
}

function weightedSign() {
  let cursor = randomValue() * FORTUNE_SIGNS.reduce((sum, sign) => sum + sign.weight, 0);
  for (const sign of FORTUNE_SIGNS) { cursor -= sign.weight; if (cursor <= 0) return sign; }
  return FORTUNE_SIGNS[0];
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2,"0"); const day = String(date.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
}

export function getFortuneSign(record?: FortuneDrawRecord | null) {
  return record ? FORTUNE_SIGNS.find((sign) => sign.id === record.signId) ?? null : null;
}

export function drawDailyFortune(dateKey: string): FortuneDrawRecord {
  const sign = weightedSign();
  const auspicious = pickUnique(AUSPICIOUS_POOL, 3);
  if (sign.effect === "talk_double" && !auspicious.includes("访友")) auspicious[0] = "访友";
  if (sign.effect === "gift_double" && !auspicious.includes("赠礼")) auspicious[0] = "赠礼";
  if (sign.effect === "social_double") { auspicious[0] = "访友"; auspicious[1] = "赠礼"; }
  return { dateKey, signId: sign.id, auspicious, taboo: pickUnique(TABOO_POOL, 2), opening: DIVINATION_OPENINGS[Math.floor(randomValue()*DIVINATION_OPENINGS.length)], interpretation: DIVINATION_INTERPRETATIONS[Math.floor(randomValue()*DIVINATION_INTERPRETATIONS.length)] };
}

export function fortuneEffectLabel(effect: FortuneEffect) {
  if (effect === "talk_double") return "金运 · 今日交谈获得的好感度翻倍";
  if (effect === "gift_double") return "金运 · 今日送礼获得的好感度翻倍";
  if (effect === "social_double") return "金运 · 今日交谈与送礼获得的好感度均翻倍";
  return "此签只作今日指引，不附加数值效果";
}

export function fortuneBoosts(effect: FortuneEffect, action?: "talk" | "gift") {
  return effect === "social_double" || (effect === "talk_double" && action === "talk") || (effect === "gift_double" && action === "gift");
}
