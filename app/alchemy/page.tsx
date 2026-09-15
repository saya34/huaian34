import AlchemyGame from "../game/alchemy/AlchemyGame";
import PhoneGameHost from "../game/ui/PhoneGameHost";
import "../phone-host.css";

export default async function AlchemyPage({ searchParams }: { searchParams: Promise<{ embedded?: string; framed?: string }> }) {
  const query = await searchParams;
  const embedded = query.embedded === "1";
  if (!embedded && query.framed !== "1") return <PhoneGameHost src="/alchemy?framed=1" title="玄火丹炉" />;
  return <div className={embedded ? "alchemy-embedded-page" : "alchemy-standalone-page"}><AlchemyGame embedded={embedded} /></div>;
}
