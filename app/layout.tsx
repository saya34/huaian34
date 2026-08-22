import type { Metadata } from "next";
import "./globals.css";
import { UnifiedGameProvider } from "./game/core/UnifiedGameProvider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "槐安一梦",
  description: "古风修仙恋爱养成、玄火炼丹与秘境搜寻融合游戏",
  openGraph: {
    title: "槐安一梦",
    description: "恋爱养成 · 玄火炼丹 · 秘境搜寻",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og.webp", width: 1200, height: 630, alt: "槐安一梦" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "槐安一梦",
    description: "恋爱养成 · 玄火炼丹 · 秘境搜寻",
    images: ["/og.webp"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><UnifiedGameProvider>{children}</UnifiedGameProvider></body></html>;
}
