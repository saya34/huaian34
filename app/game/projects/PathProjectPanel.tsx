"use client";

import { useEffect, useRef } from "react";

import { useUnifiedGame } from "../core/UnifiedGameProvider";
import { useFeedback } from "../feedback/FeedbackProvider";
import { feedbackText } from "../feedback/texts";
import type { PathProjectRoute } from "../types";
import {
  evaluateMedicineShortageRoutes,
  MEDICINE_SHORTAGE_CONTENT,
  MEDICINE_SHORTAGE_ROUTES,
  medicineShortageCompletionEffects,
  medicineShortageCompletionNotice,
  medicineShortageConsumptionEffects,
  type PathProjectDestination,
} from "./medicine-shortage-service";

export function PathProjectTracker({ onOpen }: { onOpen: () => void }) {
  const { state } = useUnifiedGame();
  const project = state.romance.medicineShortage;
  const overdue = project.status === "active" && state.romance.day > (project.deadlineDay ?? state.romance.day);
  const remaining = project.deadlineDay === undefined ? 3 : Math.max(0, project.deadlineDay - state.romance.day + 1);
  return <button type="button" className={`path-project-tracker status-${project.status} ${overdue ? "overdue" : ""}`} onClick={onOpen}>
    <span className="project-seal">任</span>
    <span><small>{project.status === "completed" ? "坊市变化已生效" : project.status === "offered" ? "新的主线任务" : "当前主线任务"}</small><strong>{project.status === "completed" ? "医馆药路重开" : MEDICINE_SHORTAGE_CONTENT.name}</strong><em>{project.status === "completed" ? "查看选择造成的结果" : project.status === "offered" ? "查明断供原因并选择解法" : overdue ? "危机期已过 · 补救仍可继续" : `危机窗口 · 余 ${remaining} 日`}</em></span>
    <i>›</i>
  </button>;
}

export default function PathProjectPanel({ onClose, onNotice, onNavigate }: {
  onClose: () => void;
  onNotice: (message: string) => void;
  onNavigate: (target: PathProjectDestination, options?: { sceneId?: string; characterId?: string; waveId?: number }) => void;
}) {
  const { state, setRomance, applyEffects } = useUnifiedGame();
  const game = state.romance;
  const project = game.medicineShortage;
  const feedback = useFeedback();
  const readyAnnouncedRef = useRef<PathProjectRoute | null>(null);
  const overdue = project.status === "active" && game.day > (project.deadlineDay ?? game.day);
  const remaining = project.deadlineDay === undefined ? 3 : Math.max(0, project.deadlineDay - game.day + 1);
  const readiness = evaluateMedicineShortageRoutes(state);
  const selectedRoute = MEDICINE_SHORTAGE_ROUTES.find((item) => item.id === project.route);

  function accept() {
    setRomance((current) => ({ ...current, medicineShortage: { status: "active", acceptedDay: current.day, deadlineDay: current.day + 2, battleVictories: 0, farmHarvestsAtAccept: state.farm.totalHarvests } }));
    onNotice("主线任务已接受 · 坊市药材断供");
  }

  function choose(route: PathProjectRoute) {
    const info = MEDICINE_SHORTAGE_ROUTES.find((item) => item.id === route)!;
    setRomance((current) => ({ ...current, medicineShortage: { ...current.medicineShortage, route } }));
    onNotice(`主解法已定 · ${info.name}`);
  }

  async function deliver() {
    const route = project.route;
    if (!route || !readiness[route].ready) return;
    const info = MEDICINE_SHORTAGE_ROUTES.find((item) => item.id === route)!;
    const accepted = await feedback.confirm({
      titleKey: "projects.deliveryTitle",
      bodyKey: "projects.deliveryBody",
      icon: "交",
      tone: "cinnabar",
      details: [
        { labelKey: "projects.routeLabel", value: info.name, emphasis: true },
        { labelKey: "system.cost", value: readiness[route].progress },
        { labelKey: "projects.resultLabel", value: info.result },
      ],
      dedupeKey: `project-deliver:${route}:${game.day}`,
    });
    if (!accepted) return;
    const outcome = overdue ? "recovered" : "stabilized";
    applyEffects([...medicineShortageConsumptionEffects(state, route), ...medicineShortageCompletionEffects(outcome)]);
    setRomance((current) => ({ ...current, medicineShortage: { ...current.medicineShortage, status: "completed", completedDay: current.day, outcome } }));
    onNotice(medicineShortageCompletionNotice(outcome));
  }

  useEffect(() => {
    const route = project.route;
    if (!route || !readiness[route].ready || readyAnnouncedRef.current === route) return;
    const info = MEDICINE_SHORTAGE_ROUTES.find((item) => item.id === route)!;
    readyAnnouncedRef.current = route;
    feedback.publish({ variant: "project-milestone", priority: 1, tone: "gold", titleKey: "projects.ready", bodyKey: "projects.readyBody", params: { name: feedbackText("projects.medicineName"), route: info.name }, icon: "备", dedupeKey: `project-ready:${route}:${project.acceptedDay}` });
  }, [feedback, project.acceptedDay, project.route, readiness]);

  const milestones = ["accepted", "route", "prepared", "delivered", "changed"].map((id, index) => ({
    done: [project.status !== "offered", Boolean(project.route), Boolean(project.route && readiness[project.route].ready), project.status === "completed", project.status === "completed"][index],
    label: feedbackText(`projects.medicine.milestone.${id}`),
  }));

  return <div className="path-project-backdrop" onMouseDown={onClose}><section className={`path-project-panel ${overdue ? "recovery" : ""}`} role="dialog" aria-modal="true" aria-label="主线任务路线选择" onMouseDown={(event) => event.stopPropagation()}>
    <header><span className="path-project-mark">任</span><div><small>{MEDICINE_SHORTAGE_CONTENT.eyebrow}</small><h2>{MEDICINE_SHORTAGE_CONTENT.name}</h2><p>{project.status === "completed" ? "你选择的解法已经改变了坊市。" : project.status === "offered" ? "医馆的常用药材突然断供，需要有人查明缺口并交付替代方案。" : overdue ? "三日危机窗口已经过去，但事件不会永久错过；你仍可完成补救版本。" : `第 ${project.acceptedDay} 日接取 · 第 ${project.deadlineDay} 日结束危机窗口 · 尚余 ${remaining} 日`}</p></div><button onClick={onClose} aria-label="关闭任务路线">×</button></header>
    {project.status === "completed" ? <div className="project-outcome"><div className="outcome-ripple"><i/><i/><b>成</b></div><small>{project.outcome === "stabilized" ? "危机期内完成" : "补救完成"}</small><h3>{project.outcome === "stabilized" ? "药路重开，坊市复苏" : "医馆复诊，供给渐稳"}</h3><p>医馆恢复接诊，栖珍阁重新上架基础补给；柳知意的日程从寻药改为坐诊。你获得了剧情物品「医馆回春契」。</p><div><span><b>医馆</b>恢复接诊</span><span><b>商店</b>补给恢复</span><span><b>人物</b>柳知意回归日程</span></div><button onClick={onClose}>返回坊市</button></div> : <div className="project-workspace">
      <aside className="project-milestones"><small>VISIBLE MILESTONES</small><h3>当前推进</h3>{milestones.map((item, index) => <span className={item.done ? "done" : ""} key={item.label}><i>{item.done ? "✓" : index + 1}</i><b>{item.label}</b></span>)}<p>只需完成一条主路线。其余系统是助力，不是隐性必修。</p></aside>
      <main><div className="project-brief"><span><i>病</i><b>医馆库存</b><strong>仅余三日</strong></span><span><i>缺</i><b>温养药材</b><strong>供给中断</strong></span><span><i>果</i><b>完成变化</b><strong>医馆复诊</strong></span></div>
        {project.status === "offered" ? <section className="project-accept"><blockquote>“{MEDICINE_SHORTAGE_CONTENT.quote}”</blockquote><p>{MEDICINE_SHORTAGE_CONTENT.deadlineNote}</p><button onClick={accept}>接下任务 · 开始计时</button></section> : <><div className="project-route-heading"><div><small>CHOOSE ONE PRIMARY SOLUTION</small><h3>选择主解法</h3></div><span>{selectedRoute ? `已选择 · ${selectedRoute.name}` : "三选一，不要求全部参与"}</span></div><div className="project-routes">{MEDICINE_SHORTAGE_ROUTES.map((info) => { const status = readiness[info.id]; return <button className={`${project.route === info.id ? "selected" : ""} ${status.ready ? "ready" : ""}`} key={info.id} onClick={() => choose(info.id)}><i>{info.glyph}</i><small>{info.role}</small><h4>{info.name}</h4><p>{info.description}</p><div>{status.checks.map((check) => <span className={check.done ? "done" : ""} key={check.label}><b>{check.done ? "✓" : "○"}</b>{check.label}</span>)}</div><em>{status.progress}</em><strong>{status.ready ? "准备完成" : "选择为主路线"}</strong></button>; })}</div>{selectedRoute && <footer className="project-delivery"><div><small>SELECTED OUTCOME</small><strong>{selectedRoute.result}</strong><p>{overdue ? "补救交付：获得较少报酬，但不会失去剧情与世界变化。" : "危机期交付：获得完整报酬、关系进展和世界变化。"}</p><nav className="project-route-actions" aria-label={`${selectedRoute.name}可执行行动`}>{selectedRoute.actions.map((action) => <button type="button" key={`${action.target}-${action.label}`} onClick={() => onNavigate(action.target, action)}>{action.label}<i>›</i></button>)}</nav></div><button disabled={!readiness[selectedRoute.id].ready} onClick={deliver}>{readiness[selectedRoute.id].ready ? "交付成果 · 解决断供" : "完成上方条件后交付"}</button></footer>}</>}
      </main>
    </div>}
  </section></div>;
}
