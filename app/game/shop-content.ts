import type { CharacterDefinition, CharacterMessageDefinition, EventDefinition, GiftDefinition, SceneDefinition } from "./types";

export const SHOP_SCENES: SceneDefinition[] = [{
  id: "treasure-shop",
  name: "栖珍阁",
  shortName: "商店",
  description: "云州市集最深处的百宝铺。货架上的灵光明灭有序，柜后那人比每件宝物都更难估价。",
  atmosphere: "灯暖 · 玉鸣",
  image: "/assets/shop/qizhen-shop.jpg",
  characters: ["ning", "huo"],
}];

export const SHOP_GIFTS: GiftDefinition[] = [
  { id: "travelQiPill", name: "商旅回气丸", description: "走商常备的小丹丸，食用后恢复 3 点体力。", icon: "丹", tags: ["丹药", "恢复"], image: "/assets/shop/ning-shop-goods.jpg", imagePosition: "0% 0%", initialCount: 0, energyRestore: 3 },
  { id: "cloudWard", name: "云纹护身符", description: "寻常黄符，纹路却画得一丝不苟。", icon: "符", tags: ["符箓", "平安"], image: "/assets/shop/ning-shop-goods.jpg", imagePosition: "50% 0%", initialCount: 0 },
  { id: "jadeAbacusCharm", name: "青金算盘坠", description: "微型算盘珠会在月下自行拨动，似乎算着一笔未清的心账。", icon: "算", tags: ["饰物", "心意"], image: "/assets/shop/ning-shop-goods.jpg", imagePosition: "100% 0%", initialCount: 0 },
  { id: "merfolkSilkSachet", name: "鲛绡清梦囊", description: "用一线鲛绡缝成，香气像雨后的远海。", icon: "绡", tags: ["香囊", "清雅"], image: "/assets/shop/ning-shop-goods.jpg", imagePosition: "0% 100%", initialCount: 0 },
  { id: "moonwick", name: "月华灯芯", description: "能燃三夜的银白灯芯，适合送给总为人留灯的人。", icon: "灯", tags: ["灯火", "旧约"], image: "/assets/shop/ning-shop-goods.jpg", imagePosition: "50% 100%", initialCount: 0 },
  { id: "treasureKeyTag", name: "百宝钥牌", description: "栖珍阁的黄铜钥牌，没有锁，却很适合挂在行囊上。", icon: "钥", tags: ["金石", "纪念"], image: "/assets/shop/ning-shop-goods.jpg", imagePosition: "100% 100%", initialCount: 0 },
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

const huoStages = [
  { id: "stranger", min: 0, name: "试锋", addressing: "道友", description: "她愿意让你看货，也在暗中掂量你的胆识。" },
  { id: "familiar", min: 15, name: "识刃", addressing: "同行人", description: "你来时，炉边总会留着一张没有落灰的椅子。" },
  { id: "close", min: 35, name: "共火", addressing: "你", description: "她不再只谈兵刃，也开始说起自己想去的远方。" },
  { id: "devoted", min: 65, name: "同契", addressing: "执刃人", description: "淬火与风雪皆可同赴，她将余生也写进了同行的契书。" },
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
}, {
  id: "huo",
  name: "霍青翎",
  role: "玄锋号东主 · 铸兵行商",
  courtesy: "霍老板",
  bio: "出身北地铸剑世家，善辨兵刃，也善藏锋。她把每一次交易都当作试剑，却会为真正信任的人留下一柄不标价的好剑。",
  sceneId: "treasure-shop",
  image: "/assets/shop/huo-qingling.webp",
  accent: "#b86d46",
  lovedGift: "treasureKeyTag",
  relationshipStages: huoStages,
  giftPreferences: [
    { giftId: "treasureKeyTag", tier: "loved", reaction: "她将钥牌扣在剑匣上，试了几次都没有取下，低声说这算你在玄锋号留了位置。" },
    { giftId: "cloudWard", tier: "liked", reaction: "她嘴上说铸剑人不信符，转身却把它系在了常用的火钳上。" },
    { giftId: "peachWine", tier: "liked", reaction: "她拍开泥封，难得放下了手里的价签，说这一坛该留到打烊后与你分。" },
    { giftId: "osmanthusCake", tier: "disliked", reaction: "她怕酥屑落进淬火槽，只尝了一小块，剩下的仔细包好。" },
  ],
  ambientLines: [
    "兵刃占几格不是讲究，是它真实的分量。你若背不动，便别急着买。",
    "封匣里的东西，我只保证来路干净。能开出什么锋芒，要看你的眼力与缘法。",
    "鉴定不只是报个名字。我得替你把沉睡的灵纹一条条引出来，自然要收工钱。",
    "不买也可以聊。只是别盯着我腰间这柄剑看太久——它和我一样，认人。",
  ],
  presence: { mode: "resident", guaranteedRules: [], randomRules: [] },
  seekingRules: [],
}];

export const SHOP_MESSAGES: CharacterMessageDefinition[] = [{
  id: "letter.ning.new-stock",
  senderCharacterId: "ning",
  title: "新到一匣小物",
  body: "今日新到几件寻常物什，本不值得特意知会。只是其中有一样，我猜你会喜欢。经过云州时，来替我掌掌眼。",
  signature: "宁砚书",
  conditions: [{ type: "event_completed", eventId: "ning.first.appraisal" }],
  relationshipAmount: 1,
}, {
  id: "letter.huo.inner-shelf",
  senderCharacterId: "huo",
  title: "内柜留了一格",
  body: "新一周的兵刃已经上架。最里侧那一格我没有摆货，不是算错尺寸，是想看看你什么时候来。若有封匣看不明白，也一并带来。",
  signature: "霍青翎",
  conditions: [{ type: "event_completed", eventId: "huo.first.edge" }],
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
  {
    id: "huo.first.edge", title: "锋从何来", subtitle: "她递来一柄未开锋的剑，也递来一次试探", chapter: "霍青翎 · 壹", type: "相识", trigger: "talk", priority: 97, once: true, journal: true,
    sceneId: "treasure-shop", characterId: "huo", conditions: [{ type: "character", value: "huo" }, { type: "scene", value: "treasure-shop" }], clue: "在栖珍阁与霍青翎交谈", start: "a",
    nodes: {
      a: { id: "a", type: "line", speaker: "huo", text: "想买兵刃，先回答我：剑是拿来赢的，还是拿来守的？", mood: "审视", next: "b" },
      b: { id: "b", type: "choice", prompt: "她把未开锋的剑横放在你掌心，分量比看起来更沉。", options: [
        { id: "guard", label: "有想守住的人，赢才有意义", next: "c", effects: [{ type: "relationship", characterId: "huo", amount: 8 }] },
        { id: "honest", label: "先活下来，再慢慢想答案", next: "d", effects: [{ type: "relationship", characterId: "huo", amount: 6 }] },
      ] },
      c: { id: "c", type: "line", speaker: "huo", text: "这答案不算锋利，但够稳。我记住了——也记住你想守的人。", mood: "稍缓", next: "end" },
      d: { id: "d", type: "line", speaker: "huo", text: "实话比漂亮话值钱。等你活过几场硬仗，再回来告诉我新答案。", mood: "认可", next: "end" },
      end: { id: "end", type: "end", summary: "霍青翎把那柄试手剑收回，却为你留下了玄锋号的内柜名帖。" },
    },
  },
  {
    id: "huo.gift.keytag", title: "匣上留名", subtitle: "一枚钥牌，让玄锋号第一次有了为你而留的空位", chapter: "霍青翎 · 贰", type: "赠礼", trigger: "gift", priority: 93, once: true, journal: true,
    sceneId: "treasure-shop", characterId: "huo", conditions: [{ type: "character", value: "huo" }, { type: "gift", value: "treasureKeyTag" }, { type: "event_completed", eventId: "huo.first.edge" }], clue: "把百宝钥牌赠给霍青翎", start: "a",
    nodes: {
      a: { id: "a", type: "line", speaker: "huo", text: "钥牌没有锁，倒正适合我的剑匣。你送这个，是想让我替你留货，还是留人？", mood: "含笑", next: "b" },
      b: { id: "b", type: "choice", prompt: "她将钥牌扣上剑匣，指尖却没有立刻松开。", options: [
        { id: "person", label: "货会换，我想留住的是人", next: "c", effects: [{ type: "relationship", characterId: "huo", amount: 11 }] },
        { id: "both", label: "好兵刃和好掌柜，我都舍不得", next: "d", effects: [{ type: "relationship", characterId: "huo", amount: 9 }] },
      ] },
      c: { id: "c", type: "line", speaker: "huo", text: "胆子不小。那就常来，别让我这枚钥牌只等到风声。", mood: "心动", next: "end" },
      d: { id: "d", type: "line", speaker: "huo", text: "会做生意。可我若真把自己搭进去，你可没有退货的机会。", mood: "明快", next: "end" },
      end: { id: "end", type: "end", summary: "从此玄锋号的内柜始终空着一格，她说那是给你的。" },
    },
  },
  {
    id: "huo.heart.tempered", title: "同炉淬心", subtitle: "火光熄灭之后，她终于说出那柄剑要交给谁", chapter: "霍青翎 · 叁", type: "情缘", trigger: "talk", priority: 99, once: true, journal: true,
    sceneId: "treasure-shop", characterId: "huo", conditions: [{ type: "character", value: "huo" }, { type: "relationship", characterId: "huo", min: 18 }, { type: "event_completed", eventId: "huo.gift.keytag" }], clue: "与霍青翎缘分达到18，再与她交谈", start: "a",
    nodes: {
      a: { id: "a", type: "line", speaker: "huo", text: "我铸了一柄没有标价的剑。原想等一个配得上它的人，后来才发现……我等的不是执剑的手。", mood: "认真", next: "b" },
      b: { id: "b", type: "choice", prompt: "她把剑与你的手一同按在温热的炉台边。", options: [
        { id: "together", label: "那就让我陪你把余下的锋磨完", next: "c", effects: [{ type: "relationship", characterId: "huo", amount: 10 }] },
        { id: "keeper", label: "剑归我，你也别再远行了", next: "d", effects: [{ type: "relationship", characterId: "huo", amount: 12 }] },
      ] },
      c: { id: "c", type: "line", speaker: "huo", text: "好。往后的火候你来守，我负责不让你把自己烧坏。", mood: "温柔", next: "end" },
      d: { id: "d", type: "line", speaker: "huo", text: "想留下我，光靠一句话可不够。拿稳这柄剑，也拿稳我的手。", mood: "心动", next: "end" },
      end: { id: "end", type: "end", summary: "玄锋号照常开门，只是她的远行契书上从此多了你的名字。" },
    },
  },
];
