import GameDemo from "../game/GameDemo";
import PhoneGameHost from "../game/ui/PhoneGameHost";
import "../phone-host.css";

export default async function RomancePage({ searchParams }: { searchParams: Promise<{ embedded?: string }> }) {
  const query = await searchParams;
  if (query.embedded === "1") return <GameDemo />;
  return <PhoneGameHost src="/romance?embedded=1" title="槐安一梦" />;
}
