import PhoneGameHost from "./game/ui/PhoneGameHost";
import "./phone-host.css";

export default function Home() {
  return <PhoneGameHost src="/romance?embedded=1" title="槐安一梦" />;
}
