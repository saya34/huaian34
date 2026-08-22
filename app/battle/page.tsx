import { MowingGame } from "../game/battle/MowingGame";
import Link from "next/link";

export default async function BattlePage({ searchParams }: { searchParams: Promise<{ wave?: string }> }) {
  const query = await searchParams;
  const waveId = Math.max(1, Math.min(21, Number(query.wave) || 1));
  return <><Link className="module-home-link battle-home-link" href="/">返回云州</Link><div className="rotate-hint"><b>请横置手机</b><span>秘境战斗采用横屏操作</span></div><MowingGame initialWaveId={waveId} /></>;
}
