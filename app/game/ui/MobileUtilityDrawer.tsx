"use client";

import content from "./mobile-shell-content.json";

type ActionId = keyof typeof content.actions;

type MobileUtilityDrawerProps = {
  open: boolean;
  stamina: number;
  stones: number;
  cardCount: number;
  messageCount: number;
  galleryCount: number;
  collectionCount: number;
  onClose: () => void;
  onAction: (id: ActionId) => void;
};

const GROUPS: { id: keyof typeof content.sections; actions: ActionId[] }[] = [
  { id: "prepare", actions: ["inventory", "equipment", "cards", "skills"] },
  { id: "records", actions: ["events", "messages", "gallery", "collection", "history"] },
  { id: "schedule", actions: ["wait", "rest", "sleep"] },
];

export default function MobileUtilityDrawer(props: MobileUtilityDrawerProps) {
  if (!props.open) return null;
  const badges: Partial<Record<ActionId, string | number>> = {
    cards: props.cardCount,
    messages: props.messageCount,
    gallery: props.galleryCount,
    collection: props.collectionCount,
  };
  return <div className="mobile-utility-backdrop" role="presentation" onMouseDown={props.onClose}>
    <section className="mobile-utility-drawer" role="dialog" aria-modal="true" aria-label={content.drawerTitle} onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <span aria-hidden="true">匣</span>
        <div><small>{content.drawerEyebrow}</small><h2>{content.drawerTitle}</h2><p>{content.drawerSubtitle}</p></div>
        <aside><b>体 {props.stamina}/10</b><b>石 {props.stones.toLocaleString()}</b></aside>
        <button type="button" onClick={props.onClose} aria-label={content.close}>×</button>
      </header>
      <div className="mobile-utility-groups">
        {GROUPS.map((group) => <section key={group.id} className={`utility-group utility-${group.id}`}>
          <h3>{content.sections[group.id]}</h3>
          <div>{group.actions.map((id) => {
            const action = content.actions[id];
            return <button type="button" key={id} onClick={() => props.onAction(id)}>
              <i>{action.icon}</i><span><strong>{action.label}</strong><small>{action.hint}</small></span>
              {badges[id] !== undefined && <b>{badges[id]}</b>}
            </button>;
          })}</div>
        </section>)}
      </div>
    </section>
  </div>;
}
