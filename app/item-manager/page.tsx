"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_RECIPE_RULES,
  ELEMENT_TYPES,
  ITEM_QUALITIES,
  MATERIALS,
  PRODUCTS,
  RecipeRule,
} from "../item-data";

type ManagerState = {
  draft: RecipeRule[];
  published: RecipeRule[];
  version: number;
  updatedAt: string;
  publishedAt: string;
  error?: string;
};

function createRule(sequence: number): RecipeRule {
  return {
    id: `rule-${Date.now()}-${sequence}`,
    name: `新丹方 ${sequence}`,
    resultItemId: PRODUCTS[0].id,
    enabled: true,
    priority: 100,
    weight: 100,
    minMaterialCount: 2,
    requiredItems: [{ itemId: MATERIALS[0].id, quantity: 1 }],
    elementRequirements: [{ element: "火", minCount: 1, additional: true }],
    minimumQuality: "凡品",
  };
}

function formatTimestamp(value: string) {
  if (!value || value === "尚未读取") return value;
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

export default function ItemManagerPage() {
  const [rules, setRules] = useState<RecipeRule[]>(DEFAULT_RECIPE_RULES);
  const [selectedId, setSelectedId] = useState(DEFAULT_RECIPE_RULES[0]?.id ?? "");
  const [version, setVersion] = useState(1);
  const [publishedAt, setPublishedAt] = useState("尚未读取");
  const [updatedAt, setUpdatedAt] = useState("尚未读取");
  const [status, setStatus] = useState("正在连接配方库……");
  const [busy, setBusy] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(DEFAULT_RECIPE_RULES));

  const selectedRule = rules.find((rule) => rule.id === selectedId) ?? rules[0];
  const resultItem = PRODUCTS.find((item) => item.id === selectedRule?.resultItemId);
  const dirty = useMemo(() => JSON.stringify(rules) !== savedSnapshot, [rules, savedSnapshot]);

  useEffect(() => {
    void fetch("/api/item-manager", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as ManagerState;
        if (!response.ok) throw new Error(data.error ?? "读取失败");
        setRules(data.draft);
        setSelectedId(data.draft[0]?.id ?? "");
        setVersion(data.version);
        setPublishedAt(data.publishedAt);
        setUpdatedAt(data.updatedAt);
        setSavedSnapshot(JSON.stringify(data.draft));
        setStatus(`已连接 · 当前发布版本 v${data.version}`);
      })
      .catch((error) => setStatus(`连接失败：${error instanceof Error ? error.message : "未知错误"}`));
  }, []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const ruleSummary = useMemo(() => {
    if (!selectedRule) return "尚未创建规则";
    const materialNames = selectedRule.requiredItems.map((entry) => {
      const item = MATERIALS.find((candidate) => candidate.id === entry.itemId);
      return `${item?.name ?? entry.itemId}×${entry.quantity}`;
    });
    const elements = selectedRule.elementRequirements.map((entry) => `${entry.additional ? "额外" : "包含"}${entry.element}×${entry.minCount}`);
    return [...materialNames, ...elements, `至少${selectedRule.minMaterialCount}味`].join(" ＋ ");
  }, [selectedRule]);

  function patchRule(patch: Partial<RecipeRule>) {
    if (!selectedRule) return;
    setRules((current) => current.map((rule) => rule.id === selectedRule.id ? { ...rule, ...patch } : rule));
  }

  async function submit(action: "save-draft" | "publish" | "reset-defaults") {
    if (action === "publish" && !window.confirm(`确认将当前 ${rules.length} 条规则发布到游戏？发布后玩家端会读取新版本。`)) return;
    setBusy(true);
    setStatus(action === "publish" ? "正在发布……" : action === "save-draft" ? "正在保存草稿……" : "正在恢复默认规则……");
    try {
      const response = await fetch("/api/item-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rules }),
      });
      const data = await response.json() as ManagerState;
      if (!response.ok) throw new Error(data.error ?? "操作失败");
      setRules(data.draft);
      setSelectedId((current) => data.draft.some((rule) => rule.id === current) ? current : data.draft[0]?.id ?? "");
      setVersion(data.version);
      setPublishedAt(data.publishedAt);
      setUpdatedAt(data.updatedAt);
      setSavedSnapshot(JSON.stringify(data.draft));
      setStatus(action === "save-draft" ? "草稿已保存，尚未影响游戏" : `发布成功 · 游戏已切换至 v${data.version}`);
      if (action !== "save-draft") {
        const channel = new BroadcastChannel("xuanhuo-item-manager");
        channel.postMessage({ type: "published", version: data.version });
        channel.close();
      }
    } catch (error) {
      setStatus(`操作失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setBusy(false);
    }
  }

  function addRule() {
    const next = createRule(rules.length + 1);
    setRules((current) => [...current, next]);
    setSelectedId(next.id);
  }

  function removeRule() {
    if (!selectedRule || rules.length <= 1) return;
    if (!window.confirm(`删除草稿规则“${selectedRule.name}”？删除后仍需保存草稿或发布才会写入配置库。`)) return;
    const next = rules.filter((rule) => rule.id !== selectedRule.id);
    setRules(next);
    setSelectedId(next[0]?.id ?? "");
  }

  function importJson() {
    try {
      const parsed = JSON.parse(jsonText) as RecipeRule[];
      if (!Array.isArray(parsed)) throw new Error("根节点必须是规则数组");
      if (!parsed.length) throw new Error("至少需要保留一条规则");
      setRules(parsed);
      setSelectedId(parsed[0]?.id ?? "");
      setStatus(`已载入 ${parsed.length} 条结构体，请保存或发布`);
    } catch (error) {
      setStatus(`JSON 解析失败：${error instanceof Error ? error.message : "格式错误"}`);
    }
  }

  return (
    <main className="im-shell">
      <header className="im-topbar">
        <div>
          <a href="/admin">← 内容中台</a>
          <a href="/">前台验收 · 槐安一梦</a>
          <span>炼丹规则 · 可视化配置台</span>
        </div>
        <div className="im-brand"><small>ITEM MANAGER</small><h1>万象配方司</h1></div>
        <div className="im-publish-actions">
          <button onClick={() => void submit("save-draft")} disabled={busy}>保存草稿</button>
          <button className="primary" onClick={() => void submit("publish")} disabled={busy}>发布到游戏</button>
        </div>
      </header>

      <section className="im-statusbar">
        <span className={status.includes("失败") ? "error" : busy ? "busy" : ""}>{status}</span>
        <span className={dirty ? "dirty" : ""}>{dirty ? `● 有未保存修改 · 上次保存 ${formatTimestamp(updatedAt)}` : `发布版本 v${version} · ${formatTimestamp(publishedAt)}`}</span>
      </section>

      <div className="im-workspace">
        <aside className="im-rule-list">
          <div className="im-panel-heading"><div><small>RULE SET</small><h2>成品映射规则</h2></div><button onClick={addRule}>＋</button></div>
          <div className="im-rule-scroll">
            {rules.map((rule, index) => {
              const product = PRODUCTS.find((item) => item.id === rule.resultItemId);
              return (
                <button key={rule.id} className={selectedRule?.id === rule.id ? "active" : ""} onClick={() => setSelectedId(rule.id)}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <img src={product?.image} alt="" />
                  <div><strong>{rule.name}</strong><small>{product?.name ?? "未选择成品"} · P{rule.priority} · W{rule.weight}</small></div>
                  <i className={rule.enabled ? "on" : ""} />
                </button>
              );
            })}
          </div>
          <div className="im-rule-foot"><span>{rules.length} 条草稿规则{dirty ? " · 未保存" : ""}</span><button onClick={removeRule} disabled={rules.length <= 1 || busy}>删除当前</button></div>
        </aside>

        <section className="im-editor">
          {selectedRule ? <>
            <div className="im-editor-title">
              <div><small>RECIPE CONDITION</small><h2>规则编辑器</h2><p>{ruleSummary} → <b>{resultItem?.name}</b></p></div>
              <label className="im-switch"><input type="checkbox" checked={selectedRule.enabled} onChange={(event) => patchRule({ enabled: event.target.checked })} /><span />启用</label>
            </div>

            <div className="im-form-grid">
              <label><span>规则名称</span><input value={selectedRule.name} onChange={(event) => patchRule({ name: event.target.value })} /></label>
              <label><span>炼成成品</span><select value={selectedRule.resultItemId} onChange={(event) => patchRule({ resultItemId: event.target.value })}>{PRODUCTS.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.quality}</option>)}</select></label>
              <label><span>优先级</span><input type="number" min="0" max="999" value={selectedRule.priority} onChange={(event) => patchRule({ priority: Number(event.target.value) })} /></label>
              <label><span>同级权重</span><input type="number" min="1" max="1000" value={selectedRule.weight} onChange={(event) => patchRule({ weight: Number(event.target.value) })} /></label>
              <label><span>最低投入数</span><select value={selectedRule.minMaterialCount} onChange={(event) => patchRule({ minMaterialCount: Number(event.target.value) })}><option value="1">1 味</option><option value="2">2 味</option><option value="3">3 味</option></select></label>
              <label><span>最低品质</span><select value={selectedRule.minimumQuality ?? ""} onChange={(event) => patchRule({ minimumQuality: event.target.value ? event.target.value as RecipeRule["minimumQuality"] : undefined })}><option value="">不限品质</option>{ITEM_QUALITIES.map((quality) => <option key={quality}>{quality}</option>)}</select></label>
            </div>

            <div className="im-condition-columns">
              <section className="im-condition-card">
                <header><div><small>EXACT ITEMS</small><h3>指定材料条件</h3></div><button onClick={() => patchRule({ requiredItems: [...selectedRule.requiredItems, { itemId: MATERIALS[0].id, quantity: 1 }] })}>＋ 添加</button></header>
                {selectedRule.requiredItems.map((entry, index) => (
                  <div className="im-condition-row" key={`${entry.itemId}-${index}`}>
                    <span>{index + 1}</span>
                    <select value={entry.itemId} onChange={(event) => patchRule({ requiredItems: selectedRule.requiredItems.map((item, itemIndex) => itemIndex === index ? { ...item, itemId: event.target.value } : item) })}>{MATERIALS.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.element} · {item.quality}</option>)}</select>
                    <select value={entry.quantity} onChange={(event) => patchRule({ requiredItems: selectedRule.requiredItems.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item) })}><option value="1">×1</option><option value="2">×2</option><option value="3">×3</option></select>
                    <button aria-label="删除材料条件" onClick={() => patchRule({ requiredItems: selectedRule.requiredItems.filter((_, itemIndex) => itemIndex !== index) })}>×</button>
                  </div>
                ))}
                {!selectedRule.requiredItems.length && <p className="im-empty">不限制具体材料，仅按属性判断</p>}
              </section>

              <section className="im-condition-card">
                <header><div><small>TAG CONDITIONS</small><h3>五行属性条件</h3></div><button onClick={() => patchRule({ elementRequirements: [...selectedRule.elementRequirements, { element: "火", minCount: 1, additional: true }] })}>＋ 添加</button></header>
                {selectedRule.elementRequirements.map((entry, index) => (
                  <div className="im-condition-row element" key={`${entry.element}-${index}`}>
                    <span>{index + 1}</span>
                    <select value={entry.element} onChange={(event) => patchRule({ elementRequirements: selectedRule.elementRequirements.map((item, itemIndex) => itemIndex === index ? { ...item, element: event.target.value as typeof item.element } : item) })}>{ELEMENT_TYPES.map((element) => <option key={element} value={element}>{element}属性</option>)}</select>
                    <select value={entry.minCount} onChange={(event) => patchRule({ elementRequirements: selectedRule.elementRequirements.map((item, itemIndex) => itemIndex === index ? { ...item, minCount: Number(event.target.value) } : item) })}><option value="1">至少1味</option><option value="2">至少2味</option><option value="3">至少3味</option></select>
                    <label className="im-additional"><input type="checkbox" checked={Boolean(entry.additional)} onChange={(event) => patchRule({ elementRequirements: selectedRule.elementRequirements.map((item, itemIndex) => itemIndex === index ? { ...item, additional: event.target.checked } : item) })} />外加</label>
                    <button aria-label="删除属性条件" onClick={() => patchRule({ elementRequirements: selectedRule.elementRequirements.filter((_, itemIndex) => itemIndex !== index) })}>×</button>
                  </div>
                ))}
                {!selectedRule.elementRequirements.length && <p className="im-empty">不限制五行属性</p>}
              </section>
            </div>

            <div className="im-rule-preview">
              <div className="im-product-orb">{resultItem && <img src={resultItem.image} alt={resultItem.name} />}</div>
              <div><small>规则解释</small><h3>{selectedRule.name}</h3><p>当丹炉满足「{ruleSummary}」时，进入优先级 {selectedRule.priority} 的候选池，并以权重 {selectedRule.weight} 竞争炼成「{resultItem?.name}」。“外加”属性只统计指定材料之外的剩余槽位。</p></div>
            </div>
          </> : <div className="im-empty-editor">请新建一条配方规则</div>}
        </section>

        <aside className="im-ops-panel">
          <div className="im-panel-heading"><div><small>OPERATIONS</small><h2>发布与注入</h2></div></div>
          <section><h3>即时发布</h3><p>保存草稿不会影响玩家；发布前会再次确认，成功后游戏读取新版本。</p><button className="wide primary" onClick={() => void submit("publish")} disabled={busy}>发布 v{version + 1}</button></section>
          <section><h3>批量结构体</h3><p>可直接注入 RecipeRule[] JSON，适合程序批量生成多对多映射。</p><button className="wide" onClick={() => { setJsonText(JSON.stringify(rules, null, 2)); setShowJson(true); }}>导出当前结构</button><button className="wide" onClick={() => setShowJson((value) => !value)}>导入 JSON</button></section>
          <section><h3>接口入口</h3><code>POST /api/item-manager<br />action: publish<br />rules: RecipeRule[]</code></section>
          <section className="danger"><h3>默认规则</h3><p>恢复内置丹方并立即发布为新版本。</p><button className="wide" onClick={() => window.confirm("确认恢复默认配方？当前草稿和发布规则都会被替换。") && void submit("reset-defaults")} disabled={busy}>恢复默认</button></section>
        </aside>
      </div>

      {showJson && <div className="im-json-overlay" role="dialog" aria-modal="true" aria-label="批量规则 JSON">
        <div><header><h2>RecipeRule[] 结构体注入</h2><button onClick={() => setShowJson(false)}>×</button></header><textarea value={jsonText} onChange={(event) => setJsonText(event.target.value)} spellCheck={false} /><footer><span>服务端会校验材料、成品、数量、属性与重复 ID。</span><button onClick={importJson}>应用到草稿</button></footer></div>
      </div>}
    </main>
  );
}
