import { assetUrl, AssetManifest, normalizeAssetName } from "./data";

export interface AtlasFrame {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sourceW: number;
  sourceH: number;
  offsetX: number;
  offsetY: number;
  rotated: boolean;
}

export interface SpriteAtlas {
  image: HTMLImageElement;
  frames: AtlasFrame[];
  moveFrames: AtlasFrame[];
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();
const atlasCache = new Map<string, Promise<SpriteAtlas | null>>();

export function loadImage(relativePath: string) {
  if (!imageCache.has(relativePath)) {
    imageCache.set(
      relativePath,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`素材加载失败: ${relativePath}`));
        image.src = assetUrl(relativePath);
      }),
    );
  }
  return imageCache.get(relativePath)!;
}

function elementChildren(node: Element) {
  return Array.from(node.children);
}

function parseTuple(value: string) {
  return [...value.matchAll(/-?\d+(?:\.\d+)?/g)].map((item) => Number(item[0]));
}

function parseAtlas(xml: string): AtlasFrame[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const rootDict = document.querySelector("plist > dict");
  if (!rootDict) return [];
  const rootChildren = elementChildren(rootDict);
  const framesKeyIndex = rootChildren.findIndex((child) => child.tagName === "key" && child.textContent === "frames");
  const framesDict = rootChildren[framesKeyIndex + 1];
  if (!framesDict || framesDict.tagName !== "dict") return [];
  const children = elementChildren(framesDict);
  const frames: AtlasFrame[] = [];
  for (let index = 0; index < children.length; index += 2) {
    const name = children[index]?.textContent ?? "";
    const dict = children[index + 1];
    if (!dict || dict.tagName !== "dict") continue;
    const props = elementChildren(dict);
    const record: Record<string, Element> = {};
    for (let p = 0; p < props.length; p += 2) {
      const key = props[p]?.textContent ?? "";
      if (props[p + 1]) record[key] = props[p + 1];
    }
    const frame = parseTuple(record.frame?.textContent ?? "");
    const size = parseTuple(record.sourceSize?.textContent ?? "");
    const offset = parseTuple(record.offset?.textContent ?? "");
    if (frame.length < 4) continue;
    frames.push({
      name,
      x: frame[0],
      y: frame[1],
      w: frame[2],
      h: frame[3],
      sourceW: size[0] || frame[2],
      sourceH: size[1] || frame[3],
      offsetX: offset[0] || 0,
      offsetY: offset[1] || 0,
      rotated: record.rotated?.tagName === "true",
    });
  }
  return frames;
}

function frameOrder(name: string) {
  const match = name.match(/(\d+)(?=\D*$)/);
  return match ? Number(match[1]) : 0;
}

function chooseMovementFrames(frames: AtlasFrame[]) {
  const groups = [
    frames.filter((frame) => /walk|move|run|xingzou|行走/i.test(frame.name)),
    frames.filter((frame) => /idle|stand|daiji|待机/i.test(frame.name)),
    frames.filter((frame) => !/dead|death|die|attack|atk|hit|hurt|死亡|攻击|受击/i.test(frame.name)),
  ];
  const selected = groups.find((group) => group.length >= 2) ?? frames;
  return [...selected].sort((a, b) => frameOrder(a.name) - frameOrder(b.name)).slice(0, 24);
}

function scoreName(candidate: string, query: string) {
  const a = normalizeAssetName(candidate);
  const b = normalizeAssetName(query);
  if (!a || !b) return -1;
  if (a === b) return 1000;
  if (a.startsWith(b) || b.startsWith(a)) return 700 - Math.abs(a.length - b.length);
  if (a.includes(b) || b.includes(a)) return 500 - Math.abs(a.length - b.length);
  const tokens = b.match(/[\u4e00-\u9fa5]{2,}|[a-z0-9]+/g) ?? [];
  return tokens.reduce((score, token) => score + (a.includes(token) ? 20 : 0), 0);
}

// The Cocos prefabs use three logical model names whose packed sequence-frame
// atlases kept their art-production names. These aliases come from the prefab
// atlas UUID references in the original project.
const MODEL_ATLAS_ALIASES: Record<string, string> = {
  "百恋_怪物_青蛙武士": "武士青蛙",
  "百恋_怪物_妖道僵尸": "紫色僵尸",
  "百恋_怪物_嗜血尸王": "旱魃尸王_行走",
};

const HERO_ATLAS_ALIASES: Record<string, string> = {
  "陆天涯": "酒剑侠-陆天涯-行走",
  "弥勒": "云游僧-天乐和尚-行走",
  "玉兔": "玉兔精-卜卜兔-行走",
  "迦楼罗": "暗夜射手-迦楼罗-行走-武器",
  "恶修罗": "修罗刀客-恶修罗-行走",
};

const SKILL_ATLAS_ALIASES: [RegExp, string][] = [
  [/孔雀翎/, "千机环_高级"],
  [/千机弩/, "千机环_低级"],
  [/噬魂修罗/, "技能-恶修罗"],
  [/弑神八荒/, "S刀万魂波动"],
  [/修罗刀|太刀刀光/, "太刀刀光"],
  [/黑曲弓觉醒/, "黑曲弓觉醒新"],
  [/黑曲弓/, "黑曲弓新"],
  [/百鸟归巢/, "回旋镖-燕返术_高级"],
  [/燕返术/, "回旋镖-燕返术_低级"],
  [/冥蛇咒/, "火药瓶-灵蛇咒_高级"],
  [/灵蛇咒/, "火药瓶-灵蛇咒_低级"],
  [/佛怒莲华/, "技能_红莲业火"],
  [/护体金光/, "立场发生器-护体金光_低级"],
  [/降魔杵/, "砖头-降魔杵_低级"],
  [/炎雀焚天/, "技能_炎雀焚天"],
  [/火灵咒/, "技能_火灵咒_飞行"],
  [/断魂剑/, "最新邪剑"],
  [/无邪剑/, "最新天剑"],
  [/龙神伏魔咒/, "白龙珠"],
  [/驱魔法盘/, "足球-法盘_高级"],
  [/阴阳盘/, "足球-法盘_低级"],
  [/诛天斩魂/, "S刀万魂波动"],
  [/破煞刀/, "远程剑气（紫色刀）"],
  [/天罚惊雷/, "雷电-天雷咒_高级2"],
  [/天雷咒/, "雷电-天雷咒_低级"],
  [/冰凌雪女/, "技能-冰凌雪女1"],
  [/雪童子/, "雪童子"],
  [/皎月罗刹/, "S刀万魂波动"],
  [/玄刀阵/, "S刀修炼领域"],
];

function atlasQuery(model: string) {
  return SKILL_ATLAS_ALIASES.find(([pattern]) => pattern.test(model))?.[1]
    ?? MODEL_ATLAS_ALIASES[model]
    ?? model;
}

export function findAtlasEntry(manifest: AssetManifest, model: string, heroName?: string) {
  const heroAlias = heroName ? HERO_ATLAS_ALIASES[heroName] : undefined;
  if (heroAlias) {
    const exact = manifest.atlases.find((entry) => entry.plist && entry.name === heroAlias);
    if (exact) return exact;
  }
  const query = heroAlias ?? heroName ?? atlasQuery(model);
  const best = manifest.atlases
    .filter((entry) => entry.plist && (!heroName || !/武器|展示|胜利|死亡/.test(entry.name)))
    .map((entry) => {
      const baseScore = scoreName(entry.name, query);
      return {
        entry,
        baseScore,
        score: baseScore + (baseScore > 0 && /行走|move|walk/i.test(entry.name) ? 30 : 0),
      };
    })
    .sort((a, b) => b.score - a.score)[0];
  return best && best.baseScore > 0 ? best.entry : undefined;
}

export function loadAtlas(manifest: AssetManifest, model: string, heroName?: string) {
  const key = `${model}|${heroName ?? ""}`;
  if (!atlasCache.has(key)) {
    atlasCache.set(
      key,
      (async () => {
        const entry = findAtlasEntry(manifest, model, heroName);
        if (!entry?.plist) return null;
        const [image, response] = await Promise.all([loadImage(entry.image), fetch(assetUrl(entry.plist))]);
        if (!response.ok) return null;
        const frames = parseAtlas(await response.text());
        return { image, frames, moveFrames: chooseMovementFrames(frames) };
      })().catch(() => null),
    );
  }
  return atlasCache.get(key)!;
}

export async function loadGridAtlas(
  relativePath: string,
  columns: number,
  rows: number,
  startFrame = 0,
  frameCount = columns * rows,
): Promise<SpriteAtlas | null> {
  try {
    const image = await loadImage(relativePath);
    const frames: AtlasFrame[] = [];
    const total = columns * rows;
    const end = Math.min(total, startFrame + frameCount);
    for (let index = startFrame; index < end; index++) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = Math.floor(column * image.width / columns);
      const y = Math.floor(row * image.height / rows);
      const nextX = Math.floor((column + 1) * image.width / columns);
      const nextY = Math.floor((row + 1) * image.height / rows);
      const width = Math.max(1, nextX - x);
      const height = Math.max(1, nextY - y);
      frames.push({
        name: `grid-${index}`,
        x,
        y,
        w: width,
        h: height,
        sourceW: width,
        sourceH: height,
        offsetX: 0,
        offsetY: 0,
        rotated: false,
      });
    }
    return { image, frames, moveFrames: frames };
  } catch {
    return null;
  }
}

export function findEffect(manifest: AssetManifest, model: string | string[] | null | undefined) {
  const names = Array.isArray(model) ? model : [model];
  let best: { path: string; score: number } | null = null;
  for (const name of names) {
    if (!name) continue;
    for (const effect of manifest.effects) {
      const score = Math.max(scoreName(effect.folder, name), scoreName(effect.name, name), scoreName(effect.path, name));
      if (!best || score > best.score) best = { path: effect.path, score };
    }
  }
  return best && best.score > 0 ? best.path : null;
}

export function findScene(manifest: AssetManifest, model: string) {
  return manifest.scenes
    .map((scene) => ({ scene, score: Math.max(scoreName(scene.scene, model), scoreName(scene.name, model)) }))
    .sort((a, b) => b.score - a.score)[0]?.scene.path;
}

export function drawAtlasFrame(
  context: CanvasRenderingContext2D,
  atlas: SpriteAtlas,
  frameIndex: number,
  x: number,
  y: number,
  height: number,
  flip = false,
  alpha = 1,
) {
  const frames = atlas.moveFrames.length ? atlas.moveFrames : atlas.frames;
  const frame = frames[Math.abs(frameIndex) % Math.max(frames.length, 1)];
  if (!frame) return;
  const scale = height / Math.max(frame.sourceH, 1);
  context.save();
  context.globalAlpha = alpha;
  context.translate(x, y);
  if (flip) context.scale(-1, 1);
  if (frame.rotated) {
    context.rotate(-Math.PI / 2);
    context.drawImage(atlas.image, frame.x, frame.y, frame.h, frame.w, -frame.h * scale / 2, -frame.w * scale / 2, frame.h * scale, frame.w * scale);
  } else {
    const dx = (-frame.sourceW / 2 + (frame.sourceW - frame.w) / 2 + frame.offsetX) * scale;
    const dy = (-frame.sourceH / 2 + (frame.sourceH - frame.h) / 2 - frame.offsetY) * scale;
    context.drawImage(atlas.image, frame.x, frame.y, frame.w, frame.h, dx, dy, frame.w * scale, frame.h * scale);
  }
  context.restore();
}
