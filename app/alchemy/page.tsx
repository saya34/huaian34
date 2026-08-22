import AlchemyGame from "../game/alchemy/AlchemyGame";
import Link from "next/link";

export default async function AlchemyPage({ searchParams }: { searchParams: Promise<{ embedded?: string }> }) {
  const query = await searchParams;
  const embedded = query.embedded === "1";
  return <div className={embedded ? "alchemy-embedded-page" : "alchemy-standalone-page"}>{!embedded && <Link className="module-home-link" href="/">返回云州</Link>}<AlchemyGame embedded={embedded} /></div>;
}
