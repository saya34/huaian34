import Link from "next/link";

const tools = [
  { href: "/em", eyebrow: "STORY PIPELINE", title: "剧情事件管理", mark: "事", image: "/assets/characters/shen-qingshuang.webp", description: "以事件脉络、人物档案和场景素材为核心，管理对话、礼物、传音与全局剧情状态。", features: ["事件树", "人物与场景", "条件发布"], tone: "jade" },
  { href: "/item-manager", eyebrow: "ALCHEMY RULESET", title: "炼丹配方管理", mark: "丹", image: "/assets/xuanhuo-furnace.webp", description: "可视化组合指定材料、五行属性、品质门槛与权重，草稿确认后再发布到游戏。", features: ["配方映射", "规则预览", "版本发布"], tone: "gold" },
  { href: "/battle", eyebrow: "DUNGEON PREVIEW", title: "秘境战斗验收", mark: "战", image: "/assets/battle/secret-realm.webp", description: "从玩家视角检查卡牌、技能、装备、掉落与关卡图片是否已经正确进入融合流程。", features: ["战斗窗口", "技能卡组", "掉落联动"], tone: "red" },
];

export default function AdminPage() {
  return (
    <main className="admin-shell">
      <div className="admin-ornament" aria-hidden="true" />
      <header className="admin-header">
        <Link className="admin-home-link" href="/">← 返回游戏</Link>
        <div className="admin-title-block">
          <p>HUAI&apos;AN CONTENT CONSOLE</p>
          <h1>槐安一梦 <span>内容中台</span></h1>
          <small>剧情、炼丹与秘境使用同一套融合数据；管理操作会明确区分草稿、发布与前台验收。</small>
        </div>
        <div className="admin-health" title="管理接口与持久化服务已启用"><i /><div><small>SYSTEM STATUS</small><strong>配置链路在线</strong></div></div>
      </header>

      <section className="admin-summary" aria-label="管理流程概览">
        {[['01','编辑','在可视化管理器中调整内容'],['02','校验','检查必填项和引用关系'],['03','发布','确认后写入统一游戏数据'],['04','验收','回到手机端游戏检查效果']].map(([step,title,copy]) => (
          <article key={step}><span>{step}</span><div><strong>{title}</strong><small>{copy}</small></div></article>
        ))}
      </section>

      <section className="admin-grid">
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href} className={`admin-tool-card ${tool.tone}`}>
            <div className="admin-card-art" style={{ backgroundImage: `url(${tool.image})` }}><span>{tool.mark}</span><small>{tool.eyebrow}</small></div>
            <div className="admin-card-copy">
              <div><p>{tool.eyebrow}</p><b>进入管理器 ↗</b></div>
              <h2>{tool.title}</h2>
              <p>{tool.description}</p>
              <ul>{tool.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            </div>
          </Link>
        ))}
      </section>

      <footer className="admin-footer"><span>槐安一梦 · H5 融合项目</span><span>管理端仅用于内容制作与验收，请在修改前确认当前环境。</span></footer>
    </main>
  );
}
