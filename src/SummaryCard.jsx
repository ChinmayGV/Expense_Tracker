const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function SummaryCard({ label, amount, icon, tone, note }) {
  // Props provide the display label, paise amount, accent, icon, and context; the card has no local state.
  return <article className={`summary-card ${tone}`}><div className="summary-top"><span>{label}</span><span className="summary-icon" aria-hidden="true">{icon}</span></div><strong>{currency.format(amount / 100)}</strong><small>{note}</small></article>;
}

export default SummaryCard;
