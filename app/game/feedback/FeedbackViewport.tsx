"use client";

import { feedbackText } from "./texts";
import type { FeedbackHistoryItem, FeedbackItem } from "./types";

function MessageContent({ item }: { item: FeedbackItem }) {
  return <>
    {item.imageSrc && <img className="feedback-art" src={item.imageSrc} alt="" />}
    <div className="feedback-copy">
      <small>{item.icon ?? feedbackText("system.iconDefault")}</small>
      <h2>{feedbackText(item.titleKey, item.params)}{item.count > 1 && <b> ×{item.count}</b>}</h2>
      {item.bodyKey && <p>{feedbackText(item.bodyKey, item.params)}</p>}
      {item.details?.length ? <dl>{item.details.map((entry, index) => <div className={entry.emphasis ? "emphasis" : ""} key={`${entry.labelKey}-${index}`}><dt>{feedbackText(entry.labelKey, entry.labelParams)}</dt><dd>{entry.value}</dd></div>)}</dl> : null}
    </div>
  </>;
}

export function FeedbackViewport({ center, toasts, floats, sheet, decision, history, historyOpen, onCloseHistory, onDismiss }: {
  center: FeedbackItem | null;
  toasts: FeedbackItem[];
  floats: FeedbackItem[];
  sheet: FeedbackItem | null;
  decision: FeedbackItem | null;
  history: FeedbackHistoryItem[];
  historyOpen: boolean;
  onCloseHistory: () => void;
  onDismiss: (id?: string) => void;
}) {
  return <div className="feedback-viewport" aria-live="polite">
    {center && <div className={`feedback-center tone-${center.tone} variant-${center.variant}`} role="status" onClick={() => onDismiss(center.id)}>
      <div className="feedback-scroll" onClick={(event) => event.stopPropagation()}><MessageContent item={center} /><button className="feedback-close" onClick={() => onDismiss(center.id)} aria-label={feedbackText("system.close")}>{feedbackText("system.closeGlyph")}</button></div>
    </div>}
    <div className="feedback-toast-stack">{toasts.map((item) => <button type="button" className={`feedback-toast tone-${item.tone}`} key={item.id} onClick={() => onDismiss(item.id)}><MessageContent item={item} /></button>)}</div>
    {floats.map((item, index) => <div className={`feedback-float tone-${item.tone}`} key={item.id} style={item.anchor ? { left: item.anchor.x, top: item.anchor.y } : { left: "50%", top: `${42 + index * 5}%` }}><MessageContent item={item} /></div>)}
    {sheet && <div className="feedback-sheet-backdrop" role="presentation" onMouseDown={() => onDismiss(sheet.id)}><section className={`feedback-sheet tone-${sheet.tone} variant-${sheet.variant}`} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><span>{sheet.icon ?? feedbackText("system.iconInspect")}</span><button onClick={() => onDismiss(sheet.id)} aria-label={feedbackText("system.close")}>{feedbackText("system.closeGlyph")}</button></header><MessageContent item={sheet} />{sheet.actions?.length ? <footer>{sheet.actions.map((action) => <button className={`action-${action.tone ?? "secondary"}`} key={action.labelKey} onClick={action.onSelect}>{feedbackText(action.labelKey)}</button>)}</footer> : null}</section></div>}
    {decision && <div className="feedback-decision-backdrop" role="presentation"><section className={`feedback-decision tone-${decision.tone}`} role="alertdialog" aria-modal="true"><MessageContent item={decision} /><footer>{decision.actions?.map((action) => <button className={`action-${action.tone ?? "secondary"}`} key={action.labelKey} onClick={action.onSelect}>{feedbackText(action.labelKey)}</button>)}</footer></section></div>}
    {historyOpen && <div className="feedback-sheet-backdrop" role="presentation" onMouseDown={onCloseHistory}><section className="feedback-history" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><small>{feedbackText("system.historyEyebrow")}</small><h2>{feedbackText("system.history")}</h2></div><button onClick={onCloseHistory} aria-label={feedbackText("system.close")}>{feedbackText("system.closeGlyph")}</button></header>{history.length ? <ol>{history.map((entry) => <li className={`tone-${entry.tone}`} key={entry.id}><time>{new Date(entry.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time><div><strong>{entry.title}</strong>{entry.body && <p>{entry.body}</p>}</div></li>)}</ol> : <p className="history-empty">{feedbackText("system.historyEmpty")}</p>}</section></div>}
  </div>;
}
