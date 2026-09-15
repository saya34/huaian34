"use client";

import { useEffect } from "react";

type PhoneGameHostProps = {
  src: string;
  title: string;
  orientation?: "portrait" | "landscape";
  closeHref?: string;
};

export default function PhoneGameHost({ src, title, orientation = "portrait", closeHref = "/" }: PhoneGameHostProps) {
  useEffect(() => {
    const closeModule = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== "huaian-close-module") return;
      window.location.assign(closeHref);
    };
    window.addEventListener("message", closeModule);
    return () => window.removeEventListener("message", closeModule);
  }, [closeHref]);

  return <main className={`phone-game-host phone-game-host-${orientation}`}>
    <div className="phone-game-device">
      <i className="phone-device-speaker" aria-hidden="true" />
      <iframe src={src} title={title} allow="autoplay; fullscreen" />
    </div>
    <p className="phone-host-caption">槐安一梦 · {orientation === "portrait" ? "竖屏游玩画面" : "横屏秘境画面"}</p>
  </main>;
}
