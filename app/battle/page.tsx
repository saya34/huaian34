import { MowingGame } from "../game/battle/MowingGame";
import mobileGuidance from "../game/battle/content/mobile-guidance.json";
import PhoneGameHost from "../game/ui/PhoneGameHost";
import "../phone-host.css";

export default async function BattlePage({ searchParams }: { searchParams: Promise<{ wave?: string; embedded?: string; ready?: string; framed?: string }> }) {
  const query = await searchParams;
  const waveId = Math.max(1, Math.min(21, Number(query.wave) || 1));
  const embedded = query.embedded === "1";
  if (!embedded && query.framed !== "1") return <PhoneGameHost src={`/battle?wave=${waveId}&framed=1`} title="槐安秘境" orientation="landscape" />;
  const autoStart = embedded && query.ready === "1";
  return <div className={embedded ? "battle-embedded-page" : "battle-standalone-page"}><div className="rotate-hint"><b>{mobileGuidance.title}</b><span>{mobileGuidance.subtitle}</span><p>{mobileGuidance.controls}</p></div><MowingGame initialWaveId={waveId} embedded={embedded} autoStart={autoStart} /></div>;
}
