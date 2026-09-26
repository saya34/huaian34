import { getD1 } from "../../../db";
import type { ForumAttachment, ForumComment, ForumPlayerCard, ForumPost } from "../../game/forum/types";

export class ForumRequestError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export type ForumPostRow = {
  id: string; channel: string; author: string; author_title: string; avatar: string; content: string;
  tags_json: string; attachments_json: string; like_count: number; comment_count: number;
  pinned: number; official: number; created_at: number; liked?: number;
};

export type ForumCommentRow = {
  id: string; post_id: string; author: string; author_title: string; avatar: string; content: string;
  attachments_json: string; created_at: number;
};

type MediaRow = { id: string; alt: string };

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ForumRequestError("跨域传讯已被闻壁拒绝。", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new ForumRequestError("跨域传讯已被闻壁拒绝。", 403);
}

export async function getVisitorHash(request: Request) {
  const visitor = request.headers.get("x-forum-visitor")?.trim() ?? "";
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(visitor)) throw new ForumRequestError("请刷新页面后再试。", 401);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(visitor));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function cleanText(value: unknown, max: number, label: string, allowEmpty = false) {
  const text = String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
  if (!allowEmpty && !text) throw new ForumRequestError(`${label}不能为空。`);
  return text;
}

export function normalizePlayer(value: unknown): ForumPlayerCard {
  const raw = value && typeof value === "object" ? value as Partial<ForumPlayerCard> : {};
  return {
    name: cleanText(raw.name, 12, "道号") || "无名散修",
    title: cleanText(raw.title, 20, "称号", true) || "云州散修",
    level: Math.max(1, Math.min(999, Math.floor(Number(raw.level) || 1))),
    cultivation: Math.max(0, Math.floor(Number(raw.cultivation) || 0)),
    dungeons: Math.max(0, Math.floor(Number(raw.dungeons) || 0)),
    bondName: cleanText(raw.bondName, 12, "牵绊", true) || "未结缘",
    bond: Math.max(0, Math.min(999, Math.floor(Number(raw.bond) || 0))),
  };
}

function parseAttachments(value: string): ForumAttachment[] {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as ForumAttachment[] : []; }
  catch { return []; }
}

function parseTags(value: string) {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String).slice(0, 5) : []; }
  catch { return []; }
}

export function postFromRow(row: ForumPostRow): ForumPost {
  return {
    id: row.id,
    channel: row.channel === "official" || row.channel === "secrets" ? row.channel : "square",
    author: row.author,
    authorTitle: row.author_title,
    avatar: row.avatar,
    createdAt: new Date(row.created_at).toISOString(),
    content: row.content,
    tags: parseTags(row.tags_json),
    attachments: parseAttachments(row.attachments_json),
    likes: row.like_count,
    replies: row.comment_count,
    liked: Boolean(row.liked),
    pinned: Boolean(row.pinned),
    official: Boolean(row.official),
  };
}

export function commentFromRow(row: ForumCommentRow): ForumComment {
  return { id: row.id, postId: row.post_id, author: row.author, authorTitle: row.author_title, avatar: row.avatar, createdAt: new Date(row.created_at).toISOString(), content: row.content, attachments: parseAttachments(row.attachments_json) };
}

export async function normalizeAttachments(value: unknown, ownerHash: string, max = 3) {
  if (!Array.isArray(value)) return { attachments: [] as ForumAttachment[], mediaIds: [] as string[] };
  if (value.length > max) throw new ForumRequestError(`每次最多附上 ${max} 份内容。`);
  const db = await getD1();
  const attachments: ForumAttachment[] = [];
  const mediaIds: string[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const attachment = raw as Record<string, unknown>;
    if (attachment.kind === "image") {
      const mediaId = cleanText(attachment.mediaId, 80, "留影编号");
      const media = await db.prepare("SELECT id, alt FROM forum_media WHERE id = ? AND owner_hash = ? AND post_id IS NULL AND comment_id IS NULL").bind(mediaId, ownerHash).first<MediaRow>();
      if (!media) throw new ForumRequestError("这张留影已经失效，请重新选择。", 409);
      attachments.push({ kind: "image", mediaId, src: `/api/forum/media?id=${encodeURIComponent(mediaId)}`, alt: cleanText(attachment.alt, 80, "留影说明", true) || media.alt });
      mediaIds.push(mediaId);
    } else if (attachment.kind === "sticker") {
      attachments.push({ kind: "sticker", sticker: cleanText(attachment.sticker, 8, "表情印"), label: cleanText(attachment.label, 24, "表情名") });
    } else if (attachment.kind === "player_card") {
      attachments.push({ kind: "player_card", card: normalizePlayer(attachment.card) });
    }
  }
  return { attachments, mediaIds };
}

export function jsonError(error: unknown) {
  const status = error instanceof ForumRequestError ? error.status : 500;
  const message = error instanceof Error ? error.message : "万象镜暂时无法回应。";
  if (status >= 500) console.error("forum request failed", error);
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
