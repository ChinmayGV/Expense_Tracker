const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const compactCurrency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });

function SpendingTrend({ transactions }) {
  // Props provide the full transaction history; monthly bars are derived from those rows, with no local state.
  const months = [];
  const today = new Date();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    months.push({ key: `${date.getFullYear()}-${date.getMonth()}`, label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date), amount: 0 });
  }
  for (const transaction of transactions) {
    if (transaction.type !== "expense") continue;
    const date = new Date(transaction.occurred_at);
    const month = months.find((item) => item.key === `${date.getFullYear()}-${date.getMonth()}`);
    if (month) month.amount += transaction.amount_paise;
  }
  const highest = Math.max(1, ...months.map((month) => month.amount));
  return <section className="panel trend-panel"><div className="panel-heading"><div><p className="eyebrow">SPENDING OVER TIME</p><h2>Monthly trend</h2></div><span className="trend-legend"><i /> Expenses</span></div>
    <div className="trend-chart" role="img" aria-label={`Monthly expense trend: ${months.map((month) => `${month.label} ${currency.format(month.amount / 100)}`).join(", ")}`}>
      {months.map((month, index) => <div className="trend-column" key={month.key}><div className="trend-bar-wrap"><span className={index === months.length - 1 ? "trend-bar current" : "trend-bar"} style={{ height: `${Math.max(4, (month.amount / highest) * 100)}%` }} /></div><span>{month.label}</span></div>)}
    </div>
    <div className="trend-scale"><span>₹0</span><span>{compactCurrency.format(highest / 100)}</span></div>
  </section>;
}

export default SpendingTrend;
