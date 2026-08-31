import type { CharacterDefinition, CharacterMessageDefinition, EventDefinition, GiftDefinition, SceneDefinition } from "./types";

export const SHOP_SCENES: SceneDefinition[] = [{
  id: "treasure-shop",
  name: "栖珍阁",
  shortName: "商店",
  description: "云州市集最深处的百宝铺。货架上的灵光明灭有序，柜后那人比每件宝物都更难估价。",
  atmosphere: "灯暖 · 玉鸣",
  image: "/assets/shop/qizhen-shop.png",
  characters: ["ning"],
}];

export const SHOP_GIFTS: GiftDefinition[] = [
  { id: "travelQiPill", name: "商旅回气丸", description: "走商常备的小丹丸，食用后恢复 3 点体力。", icon: "丹", tags: ["丹药", "恢复"], image: "/assets/shop/ning-shop-goods.png", imagePosition: "0% 0%", initialCount: 0, energyRestore: 3 },
  { id: "cloudWard", name: "云纹护身符", description: "寻常黄符，纹路却画得一丝不苟。", icon: "符", tags: ["符箓", "平安"], image: "/assets/shop/ning-shop-goods.png", imagePosition: "50% 0%", initialCount: 0 },
  { id: "jadeAbacusCharm", name: "青金算盘坠", description: "微型算盘珠会在月下自行拨动，似乎算着一笔未清的心账。", icon: "算", tags: ["饰物", "心意"], image: "/assets/shop/ning-shop-goods.png", imagePosition: "100% 0%", initialCount: 0 },
  { id: "merfolkSilkSachet", name: "鲛绡清梦囊", description: "用一线鲛绡缝成，香气像雨后的远海。", icon: "绡", tags: ["香囊", "清雅"], image: "/assets/shop/ning-shop-goods.png", imagePosition: "0% 100%", initialCount: 0 },
  { id: "moonwick", name: "月华灯芯", description: "能燃三夜的银白灯芯，适合送给总为人留灯的人。", icon: "灯", tags: ["灯火", "旧约"], image: "/assets/shop/ning-shop-goods.png", imagePosition: "50% 100%", initialCount: 0 },
  { id: "treasureKeyTag", name: "百宝钥牌", description: "栖珍阁的黄铜钥牌，没有锁，却很适合挂在行囊上。", icon: "钥", tags: ["金石", "纪念"], image: "/assets/shop/ning-shop-goods.png", imagePosition: "100% 100%", initialCount: 0 },
];

export const SHOP_OFFERS = [
  { itemId: "travelQiPill", price: 90, stock: "常备", note: "恢复 3 点体力" },
  { itemId: "cloudWard", price: 120, stock: "常备", note: "寻常平安礼" },
  { itemId: "jadeAbacusCharm", price: 360, stock: "限购", note: "宁砚书珍爱之物" },
  { itemId: "merfolkSilkSachet", price: 220, stock: "少量", note: "清雅赠礼" },
  { itemId: "moonwick", price: 160, stock: "常备", note: "灯火旧约" },
  { itemId: "treasureKeyTag", price: 80, stock: "常备", note: "栖珍阁纪念物" },
] as const;

const stages = [
  { id: "stranger", min: 0, name: "初识", addressing: "客官", description: "她记得你的账，却还没有把你写进心里。" },
  { id: "familiar", min: 15, name: "相知", addressing: "道友", description: "你来时，她会将柜台最暖的位置留出来。" },
  { id: "close", min: 35, name: "心悦", addressing: "你", description: "账本里开始出现与你无关、却只写给你的句子。" },
  { id: "devoted", min: 65, name: "同心", addressing: "归人", description: "万宝皆有价，唯有与你的来日不再售卖。" },
];

export const SHOP_CHARACTERS: CharacterDefinition[] = [{
  id: "ning",
  name: "宁砚书",
  role: "栖珍阁主人 · 鉴宝商",
  courtesy: "宁老板",
  bio: "能替万物定价，却总在与你有关的账目上少算一笔。她说做生意最忌心软，却从未真正做到。",
  sceneId: "treasure-shop",
  image: "/assets/shop/ning-yanshu.svg",
  accent: "#2f9b8f",
  lovedGift: "jadeAbacusCharm",
  relationshipStages: stages,
  giftPreferences: [
    { giftId: "jadeAbacusCharm", tier: "loved", reaction: "她拨了一颗算盘珠，却迟迟没有报出价钱，最后只说这件不卖了。" },
    { giftId: "snowTea", tier: "liked", reaction: "她将账本合上，难得肯为了与你喝茶耽误一刻生意。" },
    { giftId: "goldHairpin", tier: "liked", reaction: "她用指尖掂了掂金簪，笑问你是在送礼，还是想收买掌柜。" },
    { giftId: "peachWine", tier: "disliked", reaction: "她担心酒液污了账册，只好把酒坛收得远远的。" },
  ],
  ambientLines: [
    "买卖要公平。只是你来，我可以把公平稍稍往你这边挪一点。",
    "世上多数东西都有价。没有价的那些，往往才最让人舍不得。",
    "今日若不买东西，也可以坐一会儿。柜台这边不收你的座钱。",
    "你的行囊又重了。把不要的东西给我，我替它们找下一位主人。",
  ],
  presence: { mode: "resident", guaranteedRules: [], randomRules: [] },
  seekingRules: [{
    id: "ning-seeks-player",
    label: "送来漏记的账页",
    periods: ["黄昏", "夜晚"],
    probability: 38,
    cooldownDays: 3,
    priority: 87,
    conditions: [{ type: "event_completed", eventId: "ning.gift.abacus" }, { type: "relationship", characterId: "ning", min: 16 }],
    triggerEventId: "ning.heart.unpriced",
    intro: "宁砚书亲自送来一页账纸，说上面有一笔与你有关的旧账。",
  }],
}];

export const SHOP_MESSAGES: CharacterMessageDefinition[] = [{
  id: "letter.ning.new-stock",
  senderCharacterId: "ning",
  title: "新到一匣小物",
  body: "今日新到几件寻常物什，本不值得特意知会。只是其中有一样，我猜你会喜欢。经过云州时，来替我掌掌眼。",
  signature: "宁砚书",
  conditions: [{ type: "event_completed", eventId: "ning.first.appraisal" }],
  relationshipAmount: 1,
}];

export const SHOP_EVENTS: EventDefinition[] = [
  {
    id: "ning.first.appraisal", title: "一物两价", subtitle: "她先鉴了你的剑，后来却看向了你", chapter: "宁砚书 · 壹", type: "相识", trigger: "scene_enter", priority: 96, once: true, journal: true,
    sceneId: "treasure-shop", characterId: "ning", conditions: [{ type: "scene", value: "treasure-shop" }], clue: "初次进入栖珍阁", start: "a",
    nodes: {
      a: { id: "a", type: "line", speaker: "ning", text: "进门三步没有先看货架，反而看我。客官是来买宝物，还是来鉴人？", mood: "从容", next: "b" },
      b: { id: "b", type: "choice", prompt: "她以指节轻叩账本，等你开价。", options: [
        { id: "person", label: "宝物有价，人却难得", next: "c", effects: [{ type: "relationship", characterId: "ning", amount: 7 }] },
        { id: "business", label: "先谈生意，再慢慢识人", next: "d", effects: [{ type: "relationship", characterId: "ning", amount: 5 }] },
      ] },
      c: { id: "c", type: "line", speaker: "ning", text: "好听。可惜栖珍阁不收空话——除非说这话的人肯常来。", mood: "含笑", next: "end" },
      d: { id: "d", type: "line", speaker: "ning", text: "稳妥。我喜欢会算长账的客人。往后你的东西，栖珍阁都收。", next: "end" },
      end: { id: "end", type: "end", summary: "宁砚书为你单独开了一页没有封底的账。" },
    },
  },
  {
    id: "ning.gift.abacus", title: "珠落心盘", subtitle: "这一回，她没有给礼物标价", chapter: "宁砚书 · 贰", type: "赠礼", trigger: "gift", priority: 92, once: true, journal: true,
    sceneId: "treasure-shop", characterId: "ning", conditions: [{ type: "character", value: "ning" }, { type: "gift", value: "jadeAbacusCharm" }, { type: "event_completed", eventId: "ning.first.appraisal" }], clue: "把青金算盘坠赠给宁砚书", start: "a",
    nodes: {
      a: { id: "a", type: "line", speaker: "ning", text: "这是从我自己的货架上买来，又转手送我？这笔买卖，你算得可不精明。", mood: "意外", next: "b" },
      b: { id: "b", type: "choice", prompt: "她捻着算盘坠，眼底笑意比灯色更亮。", options: [
        { id: "worth", label: "能让你喜欢，便不算亏", next: "c", effects: [{ type: "relationship", characterId: "ning", amount: 10 }] },
        { id: "return", label: "只是物归其主", next: "d", effects: [{ type: "relationship", characterId: "ning", amount: 8 }] },
      ] },
      c: { id: "c", type: "line", speaker: "ning", text: "那我收下。今日起，它算栖珍阁里唯一一件永不出售的宝物。", mood: "动容", next: "end" },
      d: { id: "d", type: "line", speaker: "ning", text: "原来如此。可它到了我手里，账上怎么偏偏多出了一笔人情？", mood: "轻笑", next: "end" },
      end: { id: "end", type: "end", summary: "小小算盘坠被她系在贴近心口的衣带上。" },
    },
  },
  {
    id: "ning.heart.unpriced", title: "无价之页", subtitle: "账本最后一页，只写了你的名字", chapter: "宁砚书 · 叁", type: "情缘", trigger: "talk", priority: 98, once: true, journal: true,
    sceneId: "treasure-shop", characterId: "ning", conditions: [{ type: "character", value: "ning" }, { type: "relationship", characterId: "ning", min: 16 }, { type: "event_completed", eventId: "ning.gift.abacus" }], clue: "与宁砚书缘分达到16，再与她交谈", start: "a",
    nodes: {
      a: { id: "a", type: "line", speaker: "ning", text: "我替世间万物估过价，却有一页账怎么也算不平。你替我看看？", mood: "认真", next: "b" },
      b: { id: "b", type: "line", speaker: "narrator", text: "账本末页没有数字，只有你的名字。墨迹落了又描，像被她看过许多遍。", next: "c" },
      c: { id: "c", type: "choice", prompt: "她没有移开目光。", options: [
        { id: "keep", label: "这笔账，留给我们慢慢算", next: "d", effects: [{ type: "relationship", characterId: "ning", amount: 9 }] },
        { id: "heart", label: "不必算了，我把心赔给你", next: "e", effects: [{ type: "relationship", characterId: "ning", amount: 11 }] },
      ] },
      d: { id: "d", type: "line", speaker: "ning", text: "也好。长账最怕催得太急，你肯留下便够了。", mood: "释然", next: "end" },
      e: { id: "e", type: "line", speaker: "ning", text: "这可比栖珍阁所有货物都贵。既然说了，我便不许你赎回。", mood: "心动", next: "end" },
      end: { id: "end", type: "end", summary: "她合上账本，却没有松开你的手。" },
    },
  },
  {
    id: "ning.inspect.last-lamp", title: "闭阁余灯", subtitle: "打烊后的掌柜，也会对着一页账发呆", chapter: "宁砚书 · 检视", type: "心事", trigger: "inspection", priority: 86, once: true, journal: true,
    inspection: { chance: 60, hint: true }, sceneId: "treasure-shop", characterId: "ning", conditions: [{ type: "relationship", characterId: "ning", min: 8 }, { type: "event_completed", eventId: "ning.first.appraisal" }], clue: "夜晚检视栖珍阁；地图上会显出眼睛提示", start: "a",
    nodes: {
      a: { id: "a", type: "line", speaker: "narrator", text: "柜前的灯已经熄了，宁砚书却还坐在后窗下，将一枚青金算盘珠拨来拨去。", next: "b" },
      b: { id: "b", type: "line", speaker: "ning", text: "被你看见了。别误会，我只是在算……明日该给某位熟客留几分折扣。", mood: "微窘", next: "end", effects: [{ type: "relationship", characterId: "ning", amount: 4 }] },
      end: { id: "end", type: "end", summary: "她最终在你的名字旁写下了一个无人看懂的符号。" },
    },
  },
];
