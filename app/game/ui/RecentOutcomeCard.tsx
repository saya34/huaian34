"use client";

import type { ActivityReceipt } from "../core/types";
import copy from "./content/activity-receipt.json";

export default function RecentOutcomeCard({ receipt, onNext, onDismiss }: { receipt: ActivityReceipt; onNext: () => void; onDismiss: () => void }) {
  return (
    <aside className={`recent-outcome-card result-${receipt.kind}`} aria-label={`${receipt.title}结算`}>
      <header><span>{copy.eyebrow}</span><button type="button" onClick={onDismiss} aria-label={copy.dismiss}>×</button></header>
      <h3>{receipt.title}</h3><p>{receipt.summary}</p>
      <div className="recent-outcome-flow">
        <section><small>{copy.rewardLabel}</small>{receipt.rewards.slice(0, 2).map((item) => <b key={item}>{item}</b>)}</section>
        <i>›</i>
        <section><small>{copy.impactLabel}</small>{receipt.impacts.slice(0, 2).map((item) => <b key={item}>{item}</b>)}</section>
      </div>
      <button type="button" className="recent-outcome-next" onClick={onNext}><small>{copy.nextLabel}</small><strong>{receipt.nextStep.label}</strong><i>›</i></button>
    </aside>
  );
}
