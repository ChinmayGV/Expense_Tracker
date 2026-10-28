import BudgetUtilization from "./BudgetUtilization.jsx";
import CategorySpending from "./CategorySpending.jsx";
import SpendingTrend from "./SpendingTrend.jsx";
import SummaryCard from "./SummaryCard.jsx";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Dashboard({ transactions, allTransactions, categories, budgets, period, customStart, customEnd, onCustomStartChange, onCustomEndChange, onPeriodChange, onAddExpense, onViewTransactions, onViewBudgets, loading }) {
  // Props provide period-filtered and full transaction data, categories, budgets, navigation actions, and loading state; values are derived with no local state.
  const income = transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount_paise, 0);
  const expenses = transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount_paise, 0);
  const balance = allTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount_paise, 0)
    - allTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount_paise, 0);
  const monthlySavings = income - expenses;
  const savings = income ? Math.round((monthlySavings / income) * 100) : 0;
  const currentDate = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  const previousMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const previousMonthKey = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const expenseMonthKey = (item) => {
    const date = new Date(item.occurred_at);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };
  const currentMonthExpenses = allTransactions.filter((item) => item.type === "expense" && expenseMonthKey(item) === currentMonthKey).reduce((sum, item) => sum + item.amount_paise, 0);
  const previousMonthExpenses = allTransactions.filter((item) => item.type === "expense" && expenseMonthKey(item) === previousMonthKey).reduce((sum, item) => sum + item.amount_paise, 0);
  const spendComparison = previousMonthExpenses && currentMonthExpenses === previousMonthExpenses
    ? "Same as last month"
    : previousMonthExpenses
      ? `${Math.round(Math.abs((currentMonthExpenses - previousMonthExpenses) / previousMonthExpenses) * 100)}% ${currentMonthExpenses > previousMonthExpenses ? "higher" : "lower"} than last month`
    : "No previous month comparison yet";
  const overallBudget = budgets.find((budget) => budget.category_id === null);
  const periods = [["today", "Today"], ["week", "This week"], ["month", "This month"], ["last-month", "Last month"], ["all", "All time"]];
  const recent = transactions.slice(0, 5);
  const dateRange = period === "month" ? new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date()) : period === "last-month" ? new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)) : period === "today" ? "today" : period === "week" ? "this week" : period === "custom" ? "your selected dates" : "all time";
  return <section className="dashboard-page">
    <div className="dashboard-heading"><div><p className="eyebrow">YOUR FINANCES AT A GLANCE</p><h1>Good to see you<span className="heading-period">.</span></h1><p className="page-subtitle">Here’s your money story for {dateRange.toLowerCase()}.</p></div><button className="button button-primary" onClick={onAddExpense} disabled={loading}><span aria-hidden="true">＋</span> Add transaction</button></div>
    <div className="dashboard-toolbar"><div className="period-tabs" role="group" aria-label="Dashboard date range">{[...periods, ["custom", "Custom"]].map(([value, label]) => <button key={value} onClick={() => onPeriodChange(value)} className={period === value ? "period-tab selected" : "period-tab"} aria-pressed={period === value}>{label}</button>)}</div>{period === "custom" ? <div className="custom-date-range"><label>From<input aria-label="Start date" type="date" value={customStart} onChange={(event) => onCustomStartChange(event.target.value)} /></label><span>to</span><label>To<input aria-label="End date" type="date" value={customEnd} onChange={(event) => onCustomEndChange(event.target.value)} /></label></div> : <span className="date-range-button"><span aria-hidden="true">▦</span> {period === "all" ? "All time" : dateRange}</span>}</div>
    {loading ? <div className="loading-card" role="status">Gathering your money story…</div> : <>
      <div className="summary-grid">
        <SummaryCard label="Total income" amount={income} icon="↙" tone="income-card" note="Money coming in" />
        <SummaryCard label="Total expenses" amount={expenses} icon="↗" tone="expense-card" note={spendComparison} />
        <SummaryCard label="Net balance" amount={balance} icon="◈" tone="balance-card" note="Income minus expenses" />
        <SummaryCard label={period === "month" ? "Monthly savings" : "Period savings"} amount={monthlySavings} icon="％" tone="savings-card" note={income ? `${savings}% of selected-period income` : "Add income to see savings"} />
      </div>
      <BudgetUtilization budget={overallBudget} onViewBudgets={onViewBudgets} />
      <div className="dashboard-grid"><CategorySpending transactions={transactions} categories={categories} /><SpendingTrend transactions={allTransactions} /></div>
      <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Latest transactions</h2></div><button className="text-link" onClick={onViewTransactions}>View all <span aria-hidden="true">→</span></button></div>
        {recent.length ? <div className="recent-list">{recent.map((transaction) => <div className="recent-row" key={transaction.id}><span className={`recent-icon ${transaction.type}`} aria-hidden="true">{transaction.type === "income" ? "↙" : transaction.type === "transfer" ? "↔" : transaction.category?.slice(0, 1)}</span><span className="recent-info"><strong>{transaction.description}</strong><small>{transaction.category} · {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(transaction.occurred_at))}</small></span><strong className={`recent-amount ${transaction.type}`}>{transaction.type === "income" ? "+" : transaction.type === "expense" ? "−" : ""}{currency.format(transaction.amount_paise / 100)}</strong></div>)}</div> : <div className="mini-empty">No transactions in this period yet. Add one to get started.</div>}
      </section>
    </>}
  </section>;
}

export default Dashboard;
