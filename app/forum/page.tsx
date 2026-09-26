import type { Metadata } from "next";
import MobileForumPage from "./MobileForumPage";

export const metadata: Metadata = {
  title: "诸界闻壁 · 槐安一梦",
  description: "槐安道友共用的修真论坛，分享见闻、攻略与留影。",
};

export default function ForumPage() {
  return <MobileForumPage />;
}
