const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });

function Analytics({ transactions }) {
  // Props provide the saved transaction history; summaries and charts are derived from it with no local state.
  const expenses = transactions.filter((transaction) => transaction.type === "expense");
  const income = transactions.filter((transaction) => transaction.type === "income");
  const totalSpent = expenses.reduce((sum, transaction) => sum + transaction.amount_paise, 0);
  const totalIncome = income.reduce((sum, transaction) => sum + transaction.amount_paise, 0);
  const highest = expenses.reduce((top, transaction) => transaction.amount_paise > (top?.amount_paise ?? 0) ? transaction : top, null);
  const today = new Date();
  const currentMonthSpent = expenses.filter((transaction) => {
    const date = new Date(transaction.occurred_at);
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
  }).reduce((sum, transaction) => sum + transaction.amount_paise, 0);
  const averageDaily = Math.round(currentMonthSpent / today.getDate());
  const months = [];
  const now = new Date();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(month), income: 0, expense: 0 });
  }
  for (const transaction of transactions) {
    const transactionDate = new Date(transaction.occurred_at);
    const transactionMonth = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, "0")}`;
    const month = months.find((item) => item.key === transactionMonth);
    if (!month) continue;
    if (transaction.type === "income") month.income += transaction.amount_paise;
    if (transaction.type === "expense") month.expense += transaction.amount_paise;
  }
  const chartMax = Math.max(1, ...months.flatMap((month) => [month.income, month.expense]));
  const categories = new Map();
  for (const expense of expenses) categories.set(expense.category, (categories.get(expense.category) ?? 0) + expense.amount_paise);
  const categoryRows = [...categories].sort((a, b) => b[1] - a[1]).slice(0, 6);
  return <section className="management-page analytics-page">
    <div className="page-heading-row"><div><p className="eyebrow">THE BIGGER PICTURE</p><h1>Analytics</h1><p className="page-subtitle">Patterns from all your saved transactions.</p></div></div>
    <div className="analytics-summary-grid"><article className="panel analytics-stat"><span>Total income</span><strong className="income-text">{currency.format(totalIncome / 100)}</strong><small>Across all time</small></article><article className="panel analytics-stat"><span>Total expenses</span><strong>{currency.format(totalSpent / 100)}</strong><small>Across all time</small></article><article className="panel analytics-stat"><span>Average daily spending</span><strong>{currency.format(averageDaily / 100)}</strong><small>Current month to date</small></article><article className="panel analytics-stat"><span>Highest expense</span><strong>{highest ? currency.format(highest.amount_paise / 100) : "—"}</strong><small>{highest?.description ?? "No expenses yet"}</small></article></div>
    <section className="panel analytics-chart-panel"><div className="panel-heading"><div><p className="eyebrow">MONTH BY MONTH</p><h2>Income and expenses</h2></div><div className="analytics-legend"><span className="income-legend" />Income<span className="expense-legend" />Expenses</div></div><div className="analytics-chart" role="img" aria-label="Income compared to expenses for the last six months">{months.map((month) => <div className="analytics-month" key={month.key}><div className="analytics-bars"><span className="analytics-bar income-bar" title={`Income ${currency.format(month.income / 100)}`} style={{ height: `${Math.max(3, month.income / chartMax * 100)}%` }} /><span className="analytics-bar expense-bar" title={`Expenses ${currency.format(month.expense / 100)}`} style={{ height: `${Math.max(3, month.expense / chartMax * 100)}%` }} /></div><small>{month.label}</small></div>)}</div><div className="chart-scale"><span>₹0</span><span>{compact.format(chartMax / 100)}</span></div></section>
    <section className="panel analytics-categories"><div className="panel-heading"><div><p className="eyebrow">SPENDING BREAKDOWN</p><h2>Top categories</h2></div></div>{categoryRows.length ? <div className="analytics-category-list">{categoryRows.map(([category, amount], index) => <div className="analytics-category-row" key={category}><span className="rank-pill">{index + 1}</span><strong>{category}</strong><span>{currency.format(amount / 100)}</span></div>)}</div> : <div className="mini-empty">Add expenses to see category patterns.</div>}</section>
  </section>;
}

export default Analytics;
