"use client";

import { useState } from "react";
import type { ActivityReceipt } from "../core/types";
import copy from "./content/activity-receipt.json";

type Props = { receipt: ActivityReceipt; history?: ActivityReceipt[]; onNext: () => void; onDismiss: () => void };

export default function RecentOutcomeCard({ receipt, history, onNext, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  if (!expanded) return <button type="button" className={`recent-outcome-capsule result-${receipt.kind}`} onClick={() => setExpanded(true)}><i>记</i><span><small>{copy.eyebrow}</small><strong>{receipt.title}</strong></span><b>展开 ›</b></button>;
  return (
    <aside className={`recent-outcome-card result-${receipt.kind}`} aria-label={`${receipt.title}结算`}>
      <header><span>{copy.eyebrow}</span><nav><button type="button" onClick={() => setShowHistory((value) => !value)}>{showHistory ? "本次" : "历练录"}</button><button type="button" onClick={() => setExpanded(false)} aria-label="收起">⌄</button><button type="button" onClick={onDismiss} aria-label={copy.dismiss}>×</button></nav></header>
      {showHistory ? <div className="recent-outcome-history">{(history ?? [receipt]).slice(0, 12).map((entry) => <article key={entry.id}><small>{new Date(entry.createdAt).toLocaleString("zh-CN", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" })}</small><strong>{entry.title}</strong><p>{entry.rewards.join(" · ") || entry.summary}</p></article>)}</div> : <>
        <h3>{receipt.title}</h3><p>{receipt.summary}</p>
        <div className="recent-outcome-flow">
          <section><small>{copy.rewardLabel}</small>{receipt.rewards.map((item) => <b key={item}>{item}</b>)}</section>
          <i>›</i>
          <section><small>{copy.impactLabel}</small>{receipt.impacts.map((item) => <b key={item}>{item}</b>)}</section>
        </div>
        <button type="button" className="recent-outcome-next" onClick={onNext}><small>{copy.nextLabel}</small><strong>{receipt.nextStep.label}</strong><i>›</i></button>
      </>}
    </aside>
  );
}
