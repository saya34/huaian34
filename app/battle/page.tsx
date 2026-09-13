import { MowingGame } from "../game/battle/MowingGame";
import Link from "next/link";
import mobileGuidance from "../game/battle/content/mobile-guidance.json";

export default async function BattlePage({ searchParams }: { searchParams: Promise<{ wave?: string; embedded?: string; ready?: string }> }) {
  const query = await searchParams;
  const waveId = Math.max(1, Math.min(21, Number(query.wave) || 1));
  const embedded = query.embedded === "1";
  const autoStart = embedded && query.ready === "1";
  return <div className={embedded ? "battle-embedded-page" : "battle-standalone-page"}>{!embedded && <Link className="module-home-link battle-home-link" href="/">返回云州</Link>}<div className="rotate-hint"><b>{mobileGuidance.title}</b><span>{mobileGuidance.subtitle}</span><p>{mobileGuidance.controls}</p></div><MowingGame initialWaveId={waveId} embedded={embedded} autoStart={autoStart} /></div>;
}
