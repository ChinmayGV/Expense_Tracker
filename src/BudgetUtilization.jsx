const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function BudgetUtilization({ budget, onViewBudgets }) {
  // Props provide the current overall monthly budget and navigation action; this read-only progress card has no local state.
  if (!budget) return <section className="budget-utilization panel"><div><p className="eyebrow">MONTHLY BUDGET</p><h2>Give your spending a limit</h2><p>No overall budget is set for this month.</p></div><button className="budget-empty-mark" onClick={onViewBudgets} aria-label="Set a monthly budget">＋</button></section>;
  const percent = budget.utilization_percent;
  const status = percent >= 100 ? "over" : percent >= 80 ? "near" : "safe";
  return <section className={`budget-utilization panel ${status}`}><div><p className="eyebrow">MONTHLY BUDGET</p><h2>{currency.format(budget.spent_paise / 100)} <span>of {currency.format(budget.amount_paise / 100)}</span></h2><p>{percent >= 100 ? "Your spending is over budget." : `${currency.format(Math.max(0, budget.remaining_paise) / 100)} left this month.`}</p></div><button className="budget-utilization-meter" onClick={onViewBudgets} aria-label="Manage monthly budget"><strong>{percent}%</strong><span className="budget-track"><span style={{ width: `${Math.min(percent, 100)}%` }} /></span></button></section>;
}

export default BudgetUtilization;
