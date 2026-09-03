export type ForumSection = "square" | "official" | "secrets";

export type ForumAnnouncement = {
  id: string;
  tag: string;
  title: string;
  detail: string;
};

export type ForumRankEntry = {
  id: string;
  name: string;
  title: string;
  level: number;
  score: number;
  seal: string;
  accent: string;
};

export type ForumPlayerCard = {
  name: string;
  title: string;
  level: number;
  cultivation: number;
  dungeons: number;
  bondName: string;
  bond: number;
};

export type ForumAttachment =
  | { kind: "image"; src: string; alt: string }
  | { kind: "sticker"; sticker: string; label: string }
  | { kind: "player_card"; card: ForumPlayerCard };

export type ForumPost = {
  id: string;
  channel: ForumSection;
  author: string;
  authorTitle: string;
  avatar: string;
  createdAt: string;
  content: string;
  tags: string[];
  attachments: ForumAttachment[];
  likes: number;
  replies: number;
  liked?: boolean;
  pinned?: boolean;
  official?: boolean;
};

export type ForumSnapshot = {
  announcements: ForumAnnouncement[];
  ranking: ForumRankEntry[];
  posts: ForumPost[];
  syncMode: "local" | "online";
};

export type CreateForumPostInput = Pick<ForumPost, "content" | "attachments"> & {
  player: ForumPlayerCard;
};

export interface ForumGateway {
  load(): Promise<ForumSnapshot>;
  createPost(input: CreateForumPostInput): Promise<ForumPost>;
  toggleLike(postId: string): Promise<ForumPost>;
}
