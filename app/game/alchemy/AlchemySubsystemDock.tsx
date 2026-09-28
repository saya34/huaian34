type Props = {
  labels: {
    market: string;
    commissions: string;
    codex: string;
    cards: string;
  };
  cardCount: number;
  onOpenMarket: () => void;
  onOpenCommissions: () => void;
  onOpenCodex: () => void;
  onOpenCards: () => void;
};

/** Persistent phone entry points for the four alchemy subsystems. */
export default function AlchemySubsystemDock({ labels, cardCount, onOpenMarket, onOpenCommissions, onOpenCodex, onOpenCards }: Props) {
  const entries = [
    { id: "market", glyph: "市", label: labels.market, onClick: onOpenMarket },
    { id: "commissions", glyph: "榜", label: labels.commissions, onClick: onOpenCommissions },
    { id: "codex", glyph: "鉴", label: labels.codex, onClick: onOpenCodex },
    { id: "cards", glyph: "册", label: labels.cards, badge: cardCount, onClick: onOpenCards },
  ];

  return <nav className="alchemy-subsystem-dock" aria-label="炼丹房子系统">
    {entries.map((entry) => <button type="button" key={entry.id} data-surface={entry.id} onClick={entry.onClick}>
      <i>{entry.glyph}</i><span>{entry.label}</span>{entry.badge !== undefined && <b>{entry.badge}</b>}
    </button>)}
  </nav>;
}
