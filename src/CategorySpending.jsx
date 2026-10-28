const compactCurrency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });

function CategorySpending({ transactions, categories }) {
  // Props provide the current filtered transactions and category names; all totals are derived during render, with no local state.
  const amounts = new Map();
  for (const transaction of transactions) {
    if (transaction.type === "expense") amounts.set(transaction.category_id, (amounts.get(transaction.category_id) ?? 0) + transaction.amount_paise);
  }
  const rows = categories.map((category) => ({ ...category, amount: amounts.get(category.id) ?? 0 })).filter((category) => category.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 5);
  const highest = Math.max(1, ...rows.map((row) => row.amount));
  return <section className="panel category-panel"><div className="panel-heading"><div><p className="eyebrow">WHERE IT GOES</p><h2>Spending by category</h2></div><span className="panel-menu" aria-hidden="true">···</span></div>
    {rows.length ? <div className="category-bars">{rows.map((row) => <div className="category-bar-row" key={row.id}><div className="category-bar-label"><span className="category-dot" style={{ "--category-color": row.color }} />{row.name}<strong>{compactCurrency.format(row.amount / 100)}</strong></div><div className="category-track"><span style={{ width: `${Math.max(4, (row.amount / highest) * 100)}%`, "--category-color": row.color }} /></div></div>)}</div> : <div className="mini-empty">Your spending categories will appear here.</div>}
  </section>;
}

export default CategorySpending;
