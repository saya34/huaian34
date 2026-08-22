import Link from "next/link";

const tools = [
  { href: "/em", title: "剧情事件管理", description: "管理人物、场景、对话、礼物、消息、条件与跨模块效果。" },
  { href: "/item-manager", title: "炼丹物品管理", description: "维护材料、丹药、法器、配方与发布版本。" },
  { href: "/battle", title: "秘境与战斗配置", description: "进入秘境，查看卡牌、技能、装备与武器管理能力。" },
  { href: "/", title: "返回游戏", description: "回到《槐安一梦》主界面检查联动结果。" },
];

export default function AdminPage() {
  return (
    <main style={{ minHeight: "100dvh", padding: "32px 18px", color: "#f4e7c7", background: "radial-gradient(circle at top, #233a32, #0b1514 58%)" }}>
      <div style={{ width: "min(920px, 100%)", margin: "0 auto" }}>
        <p style={{ color: "#d1ae72", letterSpacing: ".22em" }}>HUAIĀN CONTENT CONSOLE</p>
        <h1 style={{ margin: "8px 0", fontSize: "clamp(28px, 6vw, 48px)" }}>槐安一梦 · 内容后台</h1>
        <p style={{ maxWidth: 680, color: "#b8c6bd", lineHeight: 1.8 }}>三个原项目的配置入口已汇总到这里。玩家侧使用同一套存档、七级品质、道具、卡牌、技能与副本进度。</p>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 28 }}>
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href} style={{ display: "block", padding: 20, minHeight: 150, color: "inherit", textDecoration: "none", border: "1px solid #8a7048", borderRadius: 18, background: "rgba(14, 31, 28, .86)", boxShadow: "0 14px 40px rgba(0,0,0,.24)" }}>
              <h2 style={{ margin: "0 0 10px", fontSize: 20 }}>{tool.title}</h2>
              <p style={{ margin: 0, color: "#b8c6bd", lineHeight: 1.65 }}>{tool.description}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
