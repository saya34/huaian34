import type { CSSProperties } from "react";
import type { EasterEggItemDefinition } from "../types";

type Props = {
  item: EasterEggItemDefinition;
  className?: string;
  hidden?: boolean;
};

export default function EasterEggArtwork({ item, className = "", hidden = false }: Props) {
  const style = {
    backgroundImage: `url(${item.image})`,
    backgroundPosition: item.imagePosition ?? "center",
    backgroundSize: item.imagePosition ? "500% 400%" : "cover",
  } as CSSProperties;

  return (
    <span
      className={`easter-egg-artwork ${hidden ? "is-hidden" : ""} ${className}`.trim()}
      style={style}
      role="img"
      aria-label={hidden ? "尚未发现的藏珍" : item.name}
    >
      <i>{hidden ? "?" : (item.icon ?? "藏")}</i>
    </span>
  );
}
