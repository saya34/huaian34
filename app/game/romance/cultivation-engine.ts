export type CultivationEntry = {
  id: string;
  text: string;
  experience: number;
  probability: number;
};

export const CULTIVATION_ENTRIES: CultivationEntry[] = [
  { id: "wandering", text: "心绪略有浮动，却仍完成了一轮吐纳", experience: 2, probability: 10 },
  { id: "steady-breath", text: "呼吸渐稳，灵气沿经脉缓缓游走", experience: 3, probability: 10 },
  { id: "quiet-mind", text: "杂念稍歇，灵台比往日清明", experience: 3, probability: 8 },
  { id: "warm-dantian", text: "丹田微暖，一缕真元悄然凝实", experience: 4, probability: 8 },
  { id: "moonlight", text: "月华入室，恰好照亮行气关窍", experience: 4, probability: 7 },
  { id: "incense", text: "沉香安神，吐纳比平日绵长", experience: 5, probability: 7 },
  { id: "sword-intent", text: "剑意忽至，周身灵气为之一振", experience: 5, probability: 6 },
  { id: "flowing", text: "真元如溪流不息，顺利运转一周天", experience: 6, probability: 6 },
  { id: "rain-listening", text: "听风辨雨，心境与天地隐隐相合", experience: 6, probability: 6 },
  { id: "old-insight", text: "想起师门旧诀，忽然明白其中一处深意", experience: 7, probability: 5 },
  { id: "spirit-gathering", text: "散落灵气向你聚拢，衣袂无风自起", experience: 7, probability: 5 },
  { id: "meridian", text: "一处滞涩经脉被真元温柔冲开", experience: 8, probability: 5 },
  { id: "sword-hum", text: "架上佩剑轻鸣，似在回应你的心念", experience: 8, probability: 4 },
  { id: "lotus", text: "观想灵莲初绽，识海泛起清光", experience: 9, probability: 4 },
  { id: "clear-cycle", text: "行气圆融无碍，周天比往日更完整", experience: 10, probability: 3 },
  { id: "star-breath", text: "一息之间似有星辉落入丹田", experience: 11, probability: 3 },
  { id: "forget-self", text: "物我两忘，醒来时窗外月色已移", experience: 12, probability: 3 },
  { id: "resonance", text: "灵阵与你同频共鸣，真元层层回响", experience: 14, probability: 2 },
  { id: "breakthrough", text: "旧日困惑骤然贯通，境界隐有松动", experience: 16, probability: 2 },
  { id: "perfect-cycle", text: "灵台澄澈，周天自成，仿佛触到大道一角", experience: 20, probability: 2 },
];

export function drawCultivationEntry(random = Math.random): CultivationEntry {
  let cursor = random() * CULTIVATION_ENTRIES.reduce((sum, entry) => sum + entry.probability, 0);
  for (const entry of CULTIVATION_ENTRIES) {
    cursor -= entry.probability;
    if (cursor <= 0) return entry;
  }
  return CULTIVATION_ENTRIES[0];
}
