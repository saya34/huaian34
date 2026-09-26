import { FORUM_ANNOUNCEMENTS, FORUM_RANKING, FORUM_SEED_POSTS } from "./content";
import type { CreateForumCommentInput, CreateForumPostInput, ForumAttachment, ForumComment, ForumGateway, ForumPost, ForumSnapshot } from "./types";

const STORAGE_KEY = "huaian.forum.demo.v1";
const VISITOR_KEY = "huaian.forum.visitor.v1";

const BASE: ForumSnapshot = { syncMode: "local", announcements: FORUM_ANNOUNCEMENTS, ranking: FORUM_RANKING, posts: FORUM_SEED_POSTS };

function pause<T>(value: T) { return new Promise<T>((resolve) => window.setTimeout(() => resolve(value), 120)); }

function visitorId() {
  try {
    const saved = window.localStorage.getItem(VISITOR_KEY);
    if (saved) return saved;
    const next = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, next);
    return next;
  } catch { return `session-${crypto.randomUUID()}`; }
}

class LocalForumGateway implements ForumGateway {
  private read(): ForumPost[] {
    try { const raw = window.localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) as ForumPost[] : []; }
    catch { return []; }
  }
  private write(posts: ForumPost[]) { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); } catch { /* Local fallback is best-effort only. */ } }
  async load() { return pause({ ...BASE, posts: [...this.read(), ...FORUM_SEED_POSTS] }); }
  async createPost(input: CreateForumPostInput) {
    const post: ForumPost = { id: `local-${Date.now()}`, channel: "square", author: input.player.name, authorTitle: input.player.title, avatar: input.player.name.slice(0, 1) || "我", createdAt: new Date().toISOString(), content: input.content, tags: ["本地草稿"], attachments: input.attachments, likes: 0, replies: 0 };
    this.write([post, ...this.read()]); return pause(post);
  }
  async toggleLike(postId: string) {
    const local = this.read(); const localIndex = local.findIndex((post) => post.id === postId);
    if (localIndex >= 0) { local[localIndex] = { ...local[localIndex], liked: !local[localIndex].liked, likes: Math.max(0, local[localIndex].likes + (local[localIndex].liked ? -1 : 1)) }; this.write(local); return pause(local[localIndex]); }
    const seed = FORUM_SEED_POSTS.find((post) => post.id === postId) ?? FORUM_SEED_POSTS[0];
    return pause({ ...seed, liked: !seed.liked, likes: seed.likes + (seed.liked ? -1 : 1) });
  }
  async loadComments() { return pause([] as ForumComment[]); }
  async createComment(input: CreateForumCommentInput) {
    return pause({ id: `local-comment-${Date.now()}`, postId: input.postId, author: input.player.name, authorTitle: input.player.title, avatar: input.player.name.slice(0, 1) || "我", createdAt: new Date().toISOString(), content: input.content, attachments: input.attachments });
  }
}

class HttpForumGateway implements ForumGateway {
  constructor(private readonly baseUrl: string) {}
  private async request<T>(path: string, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    headers.set("x-forum-visitor", visitorId());
    if (typeof init?.body === "string") headers.set("content-type", "application/json");
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers, cache: "no-store" });
    const payload = await response.json().catch(() => ({})) as { error?: string } & T;
    if (!response.ok) throw new Error(payload.error || `forum api ${response.status}`);
    return payload;
  }
  private async uploadImage(attachment: Extract<ForumAttachment, { kind: "image" }>) {
    if (attachment.mediaId) return attachment;
    const image = await fetch(attachment.src).then((response) => response.blob());
    const form = new FormData();
    form.set("file", new File([image], "forum-image.jpg", { type: image.type || "image/jpeg" }));
    form.set("alt", attachment.alt);
    const result = await this.request<{ attachment: Extract<ForumAttachment, { kind: "image" }> }>("/api/forum/upload", { method: "POST", body: form });
    return result.attachment;
  }
  private async prepareAttachments(attachments: ForumAttachment[]) {
    return Promise.all(attachments.map((attachment) => attachment.kind === "image" ? this.uploadImage(attachment) : attachment));
  }
  load() { return this.request<ForumSnapshot>("/api/forum"); }
  async createPost(input: CreateForumPostInput) {
    const attachments = await this.prepareAttachments(input.attachments);
    return this.request<ForumPost>("/api/forum", { method: "POST", body: JSON.stringify({ action: "create_post", ...input, attachments }) });
  }
  toggleLike(postId: string) { return this.request<ForumPost>("/api/forum", { method: "POST", body: JSON.stringify({ action: "toggle_like", postId }) }); }
  loadComments(postId: string) { return this.request<ForumComment[]>(`/api/forum?postId=${encodeURIComponent(postId)}`); }
  async createComment(input: CreateForumCommentInput) {
    const attachments = await this.prepareAttachments(input.attachments);
    return this.request<ForumComment>("/api/forum", { method: "POST", body: JSON.stringify({ action: "create_comment", ...input, attachments }) });
  }
}

export function createForumGateway(): ForumGateway {
  const apiBase = process.env.NEXT_PUBLIC_FORUM_API_BASE?.trim()?.replace(/\/$/, "") ?? "";
  return new HttpForumGateway(apiBase);
}

export function createLocalForumGateway(): ForumGateway { return new LocalForumGateway(); }
