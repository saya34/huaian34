import type { ForumAnnouncement, ForumPost, ForumRankEntry } from "./types";

export const FORUM_ANNOUNCEMENTS: ForumAnnouncement[] = [
  { id: "a1", tag: "天象", title: "今夜云州有小灵潮", detail: "灵田生长略有增益，夜间检视更容易发现异动。" },
  { id: "a2", tag: "悬赏", title: "悬壶谷求购霜心草", detail: "委托持续至本月十五，品相越高奖励越丰厚。" },
  { id: "a3", tag: "秘境", title: "赤霞古道出现无名剑痕", detail: "已有三名道友上传人物卡组队，战力建议 820。" },
];

export const FORUM_RANKING: ForumRankEntry[] = [
  { id: "r1", name: "照雪归鸿", title: "问剑魁首", level: 27, score: 9860, seal: "雪", accent: "#b9d9e8" },
  { id: "r2", name: "灯下折花", title: "百缘知客", level: 25, score: 9215, seal: "花", accent: "#e2a27d" },
  { id: "r3", name: "炉火照夜", title: "丹道宗师", level: 24, score: 8840, seal: "丹", accent: "#d88a54" },
  { id: "r4", name: "青蘅客", title: "采药行者", level: 22, score: 7906, seal: "药", accent: "#83b69b" },
  { id: "r5", name: "沧澜散客", title: "潮生客", level: 18, score: 6732, seal: "澜", accent: "#6db4c4" },
];

export const FORUM_SEED_POSTS: ForumPost[] = [
  { id: "official-season", channel: "official", author: "槐安司天监", authorTitle: "官方执笔", avatar: "槐", createdAt: "今辰 · 清晨", content: "云州灵脉已完成本旬巡检。玄铁常明矿窟恢复稳定，随机矿脉的显现概率于黄昏略有提升。", tags: ["官方公告", "世界进度"], attachments: [], likes: 328, replies: 46, pinned: true, official: true },
  { id: "player-herb", channel: "square", author: "一剑听雨", authorTitle: "问剑峰内门", avatar: "剑", createdAt: "半个时辰前", content: "五相灵肥不一定要留给高阶种子。霜潮天给霜心草用，成熟快得很，刚好赶上柳医师的委托。", tags: ["灵田心得"], attachments: [{ kind: "sticker", sticker: "🌿", label: "灵草摇曳" }], likes: 86, replies: 19 },
  { id: "player-fish", channel: "square", author: "沧澜散客", authorTitle: "游历四方", avatar: "澜", createdAt: "一个时辰前", content: "沧澜渡夜钓实测：赤霄龙葵作窝料以后，灵鳞鱼影明显更多。附上今日人物卡，欢迎来比鱼获。", tags: ["钓鱼", "实测"], attachments: [{ kind: "player_card", card: { name: "沧澜散客", title: "潮生客", level: 18, cultivation: 2750, dungeons: 9, bondName: "花照影", bond: 42 } }], likes: 134, replies: 31 },
  { id: "secret-bell", channel: "secrets", author: "不署名的纸鹤", authorTitle: "秘闻录 · 乙卷", avatar: "秘", createdAt: "昨夜 · 子时", content: "有人听见凌霄殿钟鸣九次之后，西侧无人使用的剑架多了一缕红绳。若在夜间检视，也许会遇见并不属于当下的剑影。", tags: ["游戏秘闻", "未证实"], attachments: [], likes: 211, replies: 57 },
  { id: "official-rules", channel: "official", author: "情报局值守", authorTitle: "版务", avatar: "局", createdAt: "三日前", content: "万象闻壁仅收录文字、留影、表情印与人物卡。请勿刊登扰乱心神的邪术影像；重复刷屏将被纸鹤自动折叠。", tags: ["版规"], attachments: [], likes: 506, replies: 12, official: true },
];
