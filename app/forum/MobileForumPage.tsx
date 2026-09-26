"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createForumGateway } from "../game/forum/forum-service";
import type { ForumAttachment, ForumComment, ForumPlayerCard, ForumPost, ForumSection, ForumSnapshot } from "../game/forum/types";

const PROFILE_KEY = "huaian.forum.profile.v1";
const CHANNELS: Array<{ id: ForumSection; seal: string; name: string }> = [
  { id: "square", seal: "闻", name: "诸界闻壁" },
  { id: "official", seal: "诏", name: "司天监" },
  { id: "secrets", seal: "秘", name: "秘闻录" },
];
const STICKERS = [{ glyph: "🌿", label: "灵草摇曳" }, { glyph: "⚔️", label: "拔剑围观" }, { glyph: "🐟", label: "灵鱼上钩" }, { glyph: "🔥", label: "炉火正旺" }, { glyph: "✨", label: "仙缘降临" }, { glyph: "🦊", label: "灵狐探头" }];

type ForumProfile = { name: string; title: string };
const DEFAULT_PROFILE: ForumProfile = { name: "槐安行者", title: "云州散修" };

function playerFromProfile(profile: ForumProfile): ForumPlayerCard {
  return { ...profile, level: 1, cultivation: 0, dungeons: 0, bondName: "未结缘", bond: 0 };
}

function formatForumTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  const elapsed = Date.now() - timestamp;
  if (elapsed < 60_000) return "刚刚";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} 分钟前`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} 小时前`;
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

function AttachmentView({ attachment }: { attachment: ForumAttachment }) {
  if (attachment.kind === "image") return <img src={attachment.src} alt={attachment.alt} />;
  if (attachment.kind === "sticker") return <span className="mobile-forum-sticker" title={attachment.label}>{attachment.sticker}<small>{attachment.label}</small></span>;
  return <div className="mobile-forum-player-card"><i>侠</i><span><small>槐安人物卡</small><strong>{attachment.card.name}</strong><em>{attachment.card.title} · 境界 {attachment.card.level}</em></span><b>{attachment.card.cultivation.toLocaleString()} 修为</b></div>;
}

function PostCard({ post, onLike, onDiscuss }: { post: ForumPost; onLike: (post: ForumPost) => void; onDiscuss: (post: ForumPost) => void }) {
  return <article className={`mobile-forum-post ${post.official ? "official" : ""}`}>
    <header>
      <span className="mobile-forum-avatar">{post.avatar}</span>
      <div><strong>{post.author}{post.official && <b>官</b>}</strong><small>{post.authorTitle} · {formatForumTime(post.createdAt)}</small></div>
      {post.pinned && <i>置顶</i>}
    </header>
    <button type="button" className="mobile-forum-post-body" onClick={() => onDiscuss(post)} aria-label={`查看${post.author}的帖子与评论`}><span>{post.content}</span></button>
    {!!post.attachments.length && <button type="button" className="mobile-forum-attachments" onClick={() => onDiscuss(post)} aria-label="查看帖子留影与评论">{post.attachments.map((attachment, index) => <AttachmentView key={index} attachment={attachment} />)}</button>}
    <div className="mobile-forum-tags">{post.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
    <footer><button type="button" className={post.liked ? "liked" : ""} onClick={() => onLike(post)} aria-label={post.liked ? "取消赞同" : "赞同"}>{post.liked ? "♥" : "♡"} {post.likes}</button><button type="button" onClick={() => onDiscuss(post)}>言 {post.replies}</button><button type="button" onClick={() => onDiscuss(post)}>展开</button></footer>
  </article>;
}

function CommentCard({ comment }: { comment: ForumComment }) {
  return <article className="mobile-forum-comment"><span className="mobile-forum-avatar">{comment.avatar}</span><div><header><strong>{comment.author}</strong><span>{comment.authorTitle} · {formatForumTime(comment.createdAt)}</span></header>{comment.content && <p>{comment.content}</p>}{!!comment.attachments.length && <div className="mobile-forum-comment-media">{comment.attachments.map((attachment, index) => <AttachmentView key={index} attachment={attachment} />)}</div>}</div></article>;
}

export default function MobileForumPage() {
  const gateway = useMemo(() => createForumGateway(), []);
  const [snapshot, setSnapshot] = useState<ForumSnapshot | null>(null);
  const [section, setSection] = useState<ForumSection>("square");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<ForumAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState<ForumProfile>(DEFAULT_PROFILE);
  const [profileDraft, setProfileDraft] = useState<ForumProfile>(DEFAULT_PROFILE);
  const [editingProfile, setEditingProfile] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [thread, setThread] = useState<ForumPost | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentAttachments, setCommentAttachments] = useState<ForumAttachment[]>([]);
  const [commentSending, setCommentSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const commentFileRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const closeThreadRef = useRef<HTMLButtonElement>(null);

  async function loadForum() {
    try { setSnapshot(await gateway.load()); }
    catch (error) { setNotice(error instanceof Error ? error.message : "诸界连接暂时中断，请稍后再试。"); }
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PROFILE_KEY);
      if (saved) { const parsed = JSON.parse(saved) as ForumProfile; if (parsed.name) { setProfile(parsed); setProfileDraft(parsed); } }
    } catch { /* Keep the default public identity. */ }
    void loadForum();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateway]);

  useEffect(() => {
    if (!thread) return;
    closeThreadRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setThread(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [thread]);

  function saveProfile() {
    const next = { name: profileDraft.name.trim().slice(0, 12), title: profileDraft.title.trim().slice(0, 20) || "云州散修" };
    if (!next.name) { setNotice("请先写下道号。" ); return; }
    setProfile(next); setProfileDraft(next); setEditingProfile(false);
    try { window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); } catch { /* The identity remains valid for this visit. */ }
    setNotice(`已用道号“${next.name}”落印。`);
  }

  function imageAttachment(file?: File): ForumAttachment | null {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setNotice("请选择 JPG、PNG 或 WebP 留影。" ); return null; }
    if (file.size > 5 * 1024 * 1024) { setNotice("留影需小于 5MB。" ); return null; }
    return { kind: "image", src: URL.createObjectURL(file), alt: `${profile.name}上传的留影` };
  }

  async function publish() {
    if (!content.trim() && !attachments.length) { setNotice("写下一句话，或附上一份内容再发布。" ); return; }
    setSending(true);
    try {
      const post = await gateway.createPost({ content: content.trim(), attachments, player: playerFromProfile(profile) });
      setSnapshot((current) => current ? { ...current, posts: [post, ...current.posts] } : current);
      setContent(""); setAttachments([]); setSection("square"); setNotice("见闻已送上诸界闻壁，所有道友现在都能看见。" );
    } catch (error) { setNotice(error instanceof Error ? error.message : "纸鹤迷了路，内容仍留在当前页面。" ); }
    finally { setSending(false); }
  }

  function updatePost(updated: ForumPost) {
    setSnapshot((current) => current ? { ...current, posts: current.posts.map((post) => post.id === updated.id ? updated : post) } : current);
    setThread((current) => current?.id === updated.id ? updated : current);
  }

  async function toggleLike(post: ForumPost) {
    const optimistic = { ...post, liked: !post.liked, likes: Math.max(0, post.likes + (post.liked ? -1 : 1)) };
    updatePost(optimistic);
    try { updatePost(await gateway.toggleLike(post.id)); }
    catch (error) { updatePost(post); setNotice(error instanceof Error ? error.message : "赞同没有送达，请重试。" ); }
  }

  async function openThread(post: ForumPost) {
    setThread(post); setComments([]); setCommentsLoading(true);
    try { setComments(await gateway.loadComments(post.id)); }
    catch (error) { setNotice(error instanceof Error ? error.message : "暂时无法展开论道。" ); }
    finally { setCommentsLoading(false); }
  }

  async function publishComment() {
    if (!thread || (!commentText.trim() && !commentAttachments.length)) { setNotice("写下一句话，或附上一张留影再回复。" ); return; }
    setCommentSending(true);
    try {
      const comment = await gateway.createComment({ postId: thread.id, content: commentText.trim(), attachments: commentAttachments, player: playerFromProfile(profile) });
      setComments((list) => [...list, comment]); setCommentText(""); setCommentAttachments([]);
      const updated = { ...thread, replies: thread.replies + 1 }; updatePost(updated);
      setNotice("回复已经落在这卷帖子下。" );
    } catch (error) { setNotice(error instanceof Error ? error.message : "回复没有送达，文字仍为你保留。" ); }
    finally { setCommentSending(false); }
  }

  const posts = (snapshot?.posts ?? []).filter((post) => post.channel === section);
  const announcement = snapshot?.announcements[0];

  return <main className="mobile-forum-page">
    <div className="mobile-forum-shell">
      <header className="mobile-forum-topbar">
        <a href="/" aria-label="返回槐安一梦">‹</a>
        <div className="mobile-forum-brand"><span>闻</span><div><small>HUAIAN INTELLIGENCE BUREAU</small><h1>诸界闻壁</h1></div></div>
        <button type="button" className="mobile-forum-online" onClick={() => void loadForum()} aria-label="重新同步论坛"><i />{snapshot?.syncMode === "online" ? "诸界在线" : "连接中"}</button>
      </header>

      <section className="mobile-forum-announcement" aria-label="今日传讯"><b>{announcement?.tag ?? "传讯"}</b><div><strong>{announcement?.title ?? "正在展开世界传讯……"}</strong><small>{announcement?.detail}</small></div></section>

      <nav className="mobile-forum-channels" aria-label="论坛分区">{CHANNELS.map((channel) => <button type="button" key={channel.id} className={section === channel.id ? "active" : ""} onClick={() => setSection(channel.id)}><i>{channel.seal}</i><span>{channel.name}</span></button>)}</nav>

      {section === "square" && <section className="mobile-forum-composer" aria-label="发布见闻">
        <div className="mobile-forum-composer-head"><span className="mobile-forum-avatar">{profile.name.slice(0, 1)}</span><div><strong>{profile.name}</strong><small>{profile.title}</small></div><button type="button" onClick={() => setEditingProfile((value) => !value)}>更换道号</button></div>
        {editingProfile && <div className="mobile-forum-profile-edit"><label>道号<input value={profileDraft.name} maxLength={12} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} /></label><label>称号<input value={profileDraft.title} maxLength={20} onChange={(event) => setProfileDraft((current) => ({ ...current, title: event.target.value }))} /></label><button type="button" onClick={saveProfile}>落印</button></div>}
        <textarea ref={composerRef} value={content} maxLength={500} onChange={(event) => setContent(event.target.value)} placeholder="写下见闻、攻略或邀约……" aria-label="帖子内容" />
        <div className="mobile-forum-preview-list">{attachments.map((attachment, index) => <button className={`mobile-forum-preview ${attachment.kind}`} type="button" key={index} onClick={() => setAttachments((list) => list.filter((_, itemIndex) => itemIndex !== index))} aria-label="移除附件">{attachment.kind === "image" ? <img src={attachment.src} alt={attachment.alt} /> : attachment.kind === "sticker" ? attachment.sticker : "人物卡"}<span>×</span></button>)}</div>
        {stickersOpen && <div className="mobile-forum-sticker-picker" aria-label="选择表情印">{STICKERS.map((sticker) => <button type="button" key={sticker.label} title={sticker.label} onClick={() => { setAttachments((list) => [...list.filter((item) => item.kind !== "sticker"), { kind: "sticker", sticker: sticker.glyph, label: sticker.label }]); setStickersOpen(false); }}>{sticker.glyph}</button>)}</div>}
        <footer><div><input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const attachment = imageAttachment(event.target.files?.[0]); if (attachment) setAttachments((list) => [...list.filter((item) => item.kind !== "image"), attachment]); event.currentTarget.value = ""; }} /><button type="button" onClick={() => fileRef.current?.click()}>景 留影</button><button type="button" className={stickersOpen ? "active" : ""} onClick={() => setStickersOpen((value) => !value)}>印 表情</button></div><span>{content.length}/500</span><button className="mobile-forum-publish" type="button" disabled={sending} onClick={publish}>{sending ? "纸鹤传送中" : "发布见闻"}</button></footer>
      </section>}

      <section className="mobile-forum-feed" aria-live="polite">
        <header><div><small>{section === "square" ? "PLAYER FORUM" : section === "official" ? "OFFICIAL ARCHIVE" : "SECRET SCROLLS"}</small><h2>{CHANNELS.find((channel) => channel.id === section)?.name}</h2></div><span>{posts.length} 卷</span></header>
        {!snapshot ? <div className="mobile-forum-loading"><i />纸鹤正在搬运卷宗……</div> : posts.length ? posts.map((post) => <PostCard key={post.id} post={post} onLike={(item) => void toggleLike(item)} onDiscuss={(item) => void openThread(item)} />) : <div className="mobile-forum-empty"><b>静</b><span>此卷尚无见闻，等你写下第一笔。</span></div>}
      </section>

      {section === "square" && <button type="button" className="mobile-forum-compose-shortcut" onClick={() => { composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); composerRef.current?.focus(); }}>＋ 写见闻</button>}
      {notice && <button type="button" className="mobile-forum-notice" onClick={() => setNotice("")}>{notice}</button>}
    </div>

    {thread && <div className="mobile-forum-thread-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setThread(null); }}><section className="mobile-forum-thread" role="dialog" aria-modal="true" aria-label="帖子详情与评论">
      <header><div><small>DISCUSSION SCROLL</small><h2>论道卷</h2></div><button ref={closeThreadRef} type="button" onClick={() => setThread(null)} aria-label="关闭论道卷">×</button></header>
      <div className="mobile-forum-thread-scroll"><PostCard post={thread} onLike={(item) => void toggleLike(item)} onDiscuss={() => undefined} /><section className="mobile-forum-comments"><h3>道友论道 <span>{thread.replies}</span></h3>{commentsLoading ? <div className="mobile-forum-loading"><i />正在展开回帖……</div> : comments.length ? comments.map((comment) => <CommentCard key={comment.id} comment={comment} />) : <div className="mobile-forum-empty compact"><b>静</b><span>尚无玩家留言，来坐第一席。</span></div>}</section></div>
      <footer className="mobile-forum-reply"><textarea value={commentText} maxLength={500} onChange={(event) => setCommentText(event.target.value)} placeholder={`以“${profile.name}”的道号回复……`} aria-label="评论内容" />{commentAttachments.map((attachment, index) => attachment.kind === "image" && <button type="button" className="mobile-forum-comment-preview" key={index} onClick={() => setCommentAttachments([])}><img src={attachment.src} alt={attachment.alt} /><span>×</span></button>)}<div><input ref={commentFileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const attachment = imageAttachment(event.target.files?.[0]); if (attachment) setCommentAttachments([attachment]); event.currentTarget.value = ""; }} /><button type="button" onClick={() => commentFileRef.current?.click()}>景 留影</button><span>{commentText.length}/500</span><button type="button" className="mobile-forum-reply-send" disabled={commentSending} onClick={publishComment}>{commentSending ? "传送中" : "回复"}</button></div></footer>
    </section></div>}
  </main>;
}
