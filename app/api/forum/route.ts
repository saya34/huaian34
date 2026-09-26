import { getD1 } from "../../../db";
import { FORUM_ANNOUNCEMENTS, FORUM_RANKING, FORUM_SEED_POSTS } from "../../game/forum/content";
import type { ForumPost } from "../../game/forum/types";
import { assertSameOrigin, cleanText, commentFromRow, ForumRequestError, getVisitorHash, jsonError, normalizeAttachments, normalizePlayer, postFromRow, type ForumCommentRow, type ForumPostRow } from "./_shared";

const SEED_IDS = new Set(FORUM_SEED_POSTS.map((post) => post.id));

async function loadPostRow(postId: string, visitorHash: string) {
  const db = await getD1();
  return db.prepare(`
    SELECT p.*, CASE WHEN l.id IS NULL THEN 0 ELSE 1 END AS liked
    FROM forum_posts p
    LEFT JOIN forum_likes l ON l.post_id = p.id AND l.visitor_hash = ?
    WHERE p.id = ? AND p.status = 'visible'
  `).bind(visitorHash, postId).first<ForumPostRow>();
}

async function seedPostWithStats(postId: string, visitorHash: string) {
  const seed = FORUM_SEED_POSTS.find((post) => post.id === postId);
  if (!seed) return null;
  const db = await getD1();
  const [likes, comments, mine] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM forum_likes WHERE post_id = ?").bind(postId).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM forum_comments WHERE post_id = ? AND status = 'visible'").bind(postId).first<{ count: number }>(),
    db.prepare("SELECT id FROM forum_likes WHERE post_id = ? AND visitor_hash = ?").bind(postId, visitorHash).first<{ id: string }>(),
  ]);
  return { ...seed, likes: seed.likes + Number(likes?.count ?? 0), replies: seed.replies + Number(comments?.count ?? 0), liked: Boolean(mine) };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const postId = url.searchParams.get("postId")?.trim();
    const db = await getD1();
    if (postId) {
      if (postId.length > 100) throw new ForumRequestError("帖子编号无效。", 400);
      const rows = await db.prepare(`
        SELECT id, post_id, author, author_title, avatar, content, attachments_json, created_at
        FROM forum_comments WHERE post_id = ? AND status = 'visible'
        ORDER BY created_at ASC LIMIT 200
      `).bind(postId).all<ForumCommentRow>();
      return Response.json(rows.results.map(commentFromRow), { headers: { "Cache-Control": "no-store" } });
    }

    const visitorHash = await getVisitorHash(request);
    const rows = await db.prepare(`
      SELECT p.*, CASE WHEN l.id IS NULL THEN 0 ELSE 1 END AS liked
      FROM forum_posts p
      LEFT JOIN forum_likes l ON l.post_id = p.id AND l.visitor_hash = ?
      WHERE p.status = 'visible'
      ORDER BY p.pinned DESC, p.created_at DESC LIMIT 60
    `).bind(visitorHash).all<ForumPostRow>();
    const seeds = await Promise.all(FORUM_SEED_POSTS.map((post) => seedPostWithStats(post.id, visitorHash)));
    return Response.json({ announcements: FORUM_ANNOUNCEMENTS, ranking: FORUM_RANKING, posts: [...rows.results.map(postFromRow), ...seeds.filter(Boolean)], syncMode: "online" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const visitorHash = await getVisitorHash(request);
    const payload = await request.json() as Record<string, unknown>;
    const action = String(payload.action ?? "");
    const db = await getD1();
    const now = Date.now();

    if (action === "create_post") {
      const recent = await db.prepare("SELECT COUNT(*) AS count FROM forum_posts WHERE visitor_hash = ? AND created_at > ?").bind(visitorHash, now - 10 * 60_000).first<{ count: number }>();
      if (Number(recent?.count ?? 0) >= 5) throw new ForumRequestError("纸鹤飞得太频繁了，请过一会儿再发。", 429);
      const player = normalizePlayer(payload.player);
      const content = cleanText(payload.content, 500, "帖子内容", true);
      const { attachments, mediaIds } = await normalizeAttachments(payload.attachments, visitorHash, 3);
      if (!content && !attachments.length) throw new ForumRequestError("写下一句话，或附上一份内容再发布。", 400);
      const id = `post_${crypto.randomUUID()}`;
      const tags = ["道友新帖"];
      const statements = [db.prepare(`
        INSERT INTO forum_posts (id, channel, author, author_title, avatar, visitor_hash, content, tags_json, attachments_json, created_at)
        VALUES (?, 'square', ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, player.name, player.title, player.name.slice(0, 1) || "我", visitorHash, content, JSON.stringify(tags), JSON.stringify(attachments), now)];
      for (const mediaId of mediaIds) statements.push(db.prepare("UPDATE forum_media SET post_id = ? WHERE id = ? AND owner_hash = ? AND post_id IS NULL AND comment_id IS NULL").bind(id, mediaId, visitorHash));
      await db.batch(statements);
      return Response.json({ id, channel: "square", author: player.name, authorTitle: player.title, avatar: player.name.slice(0, 1) || "我", createdAt: new Date(now).toISOString(), content, tags, attachments, likes: 0, replies: 0, liked: false } satisfies ForumPost, { status: 201, headers: { "Cache-Control": "no-store" } });
    }

    if (action === "create_comment") {
      const postId = cleanText(payload.postId, 100, "帖子编号");
      const dynamicPost = await db.prepare("SELECT id FROM forum_posts WHERE id = ? AND status = 'visible'").bind(postId).first<{ id: string }>();
      if (!dynamicPost && !SEED_IDS.has(postId)) throw new ForumRequestError("这卷帖子已经被收起。", 404);
      const recent = await db.prepare("SELECT COUNT(*) AS count FROM forum_comments WHERE visitor_hash = ? AND created_at > ?").bind(visitorHash, now - 5 * 60_000).first<{ count: number }>();
      if (Number(recent?.count ?? 0) >= 10) throw new ForumRequestError("论道太快了，请稍歇片刻。", 429);
      const player = normalizePlayer(payload.player);
      const content = cleanText(payload.content, 500, "评论内容", true);
      const { attachments, mediaIds } = await normalizeAttachments(payload.attachments, visitorHash, 2);
      if (!content && !attachments.length) throw new ForumRequestError("写下一句话，或附上一张留影再回复。", 400);
      const id = `comment_${crypto.randomUUID()}`;
      const statements = [db.prepare(`
        INSERT INTO forum_comments (id, post_id, author, author_title, avatar, visitor_hash, content, attachments_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, postId, player.name, player.title, player.name.slice(0, 1) || "我", visitorHash, content, JSON.stringify(attachments), now)];
      if (dynamicPost) statements.push(db.prepare("UPDATE forum_posts SET comment_count = comment_count + 1 WHERE id = ?").bind(postId));
      for (const mediaId of mediaIds) statements.push(db.prepare("UPDATE forum_media SET comment_id = ? WHERE id = ? AND owner_hash = ? AND post_id IS NULL AND comment_id IS NULL").bind(id, mediaId, visitorHash));
      await db.batch(statements);
      return Response.json({ id, postId, author: player.name, authorTitle: player.title, avatar: player.name.slice(0, 1) || "我", createdAt: new Date(now).toISOString(), content, attachments }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }

    if (action === "toggle_like") {
      const postId = cleanText(payload.postId, 100, "帖子编号");
      const dynamicPost = await loadPostRow(postId, visitorHash);
      if (!dynamicPost && !SEED_IDS.has(postId)) throw new ForumRequestError("这卷帖子已经被收起。", 404);
      const existing = await db.prepare("SELECT id FROM forum_likes WHERE post_id = ? AND visitor_hash = ?").bind(postId, visitorHash).first<{ id: string }>();
      if (existing) {
        const statements = [db.prepare("DELETE FROM forum_likes WHERE id = ?").bind(existing.id)];
        if (dynamicPost) statements.push(db.prepare("UPDATE forum_posts SET like_count = MAX(0, like_count - 1) WHERE id = ?").bind(postId));
        await db.batch(statements);
      } else {
        const statements = [db.prepare("INSERT INTO forum_likes (id, post_id, visitor_hash, created_at) VALUES (?, ?, ?, ?)").bind(`like_${crypto.randomUUID()}`, postId, visitorHash, now)];
        if (dynamicPost) statements.push(db.prepare("UPDATE forum_posts SET like_count = like_count + 1 WHERE id = ?").bind(postId));
        await db.batch(statements);
      }
      const updated = await loadPostRow(postId, visitorHash) ?? await seedPostWithStats(postId, visitorHash);
      if (!updated) throw new ForumRequestError("帖子状态更新失败。", 409);
      return Response.json("content" in updated ? ("author_title" in updated ? postFromRow(updated) : updated) : updated, { headers: { "Cache-Control": "no-store" } });
    }

    throw new ForumRequestError("未知的闻壁操作。", 400);
  } catch (error) { return jsonError(error); }
}
