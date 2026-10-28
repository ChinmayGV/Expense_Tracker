import { useState } from "react";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

async function request(path, options) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error ?? "Could not complete the request.");
  return payload;
}

function BudgetManager({ budgets, categories, month, onChanged }) {
  // Props provide this month’s budgets, categories, and a refresh callback; local state holds the budget draft and saving/error feedback.
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const expenseCategories = categories.filter((category) => ["expense", "both"].includes(category.kind));

  const saveBudget = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request("/api/budgets", { method: "POST", body: JSON.stringify({ month, amount: Number(amount), category_id: categoryId || null }) });
      setAmount("");
      setCategoryId("");
      await onChanged();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteBudget = async (id) => {
    setError("");
    try {
      await request(`/api/budgets/${id}`, { method: "DELETE" });
      setDeletingId(null);
      await onChanged();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return <section className="management-page">
    <div className="page-heading-row"><div><p className="eyebrow">SPEND WITH INTENTION</p><h1>Budgets</h1><p className="page-subtitle">Set monthly guardrails and see how you’re doing.</p></div><span className="month-chip">{new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`))}</span></div>
    <section className="panel budget-form-panel"><div className="panel-heading"><div><p className="eyebrow">PLAN YOUR MONTH</p><h2>Create or update a budget</h2></div></div>
      <form className="budget-form" onSubmit={saveBudget}><label className="form-field">Budget amount (₹)<input required min="0.01" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 25000" /></label><label className="form-field">Applies to<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Overall monthly budget</option>{expenseCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save budget"}</button></form>
      {error && <p role="alert" className="field-error budget-error">{error}</p>}
    </section>
    <div className="budget-list-heading"><div><p className="eyebrow">YOUR LIMITS</p><h2>Active budgets</h2></div><span>{budgets.length} {budgets.length === 1 ? "budget" : "budgets"}</span></div>
    {budgets.length ? <div className="budget-grid">{budgets.map((budget) => {
      const percent = budget.utilization_percent;
      const tone = percent >= 100 ? "over" : percent >= 80 ? "near" : "safe";
      return <article className={`panel budget-card ${tone}`} key={budget.id}>
        <div className="budget-card-top"><div><span className="budget-category-dot" /> <strong>{budget.category ?? "Overall monthly budget"}</strong></div>{deletingId === budget.id ? <div className="budget-delete-confirm"><span>Remove?</span><button onClick={() => deleteBudget(budget.id)}>Yes</button><button onClick={() => setDeletingId(null)}>No</button></div> : <button className="row-delete-button" onClick={() => setDeletingId(budget.id)} aria-label={`Remove ${budget.category ?? "overall"} budget`}>×</button>}</div>
        <div className="budget-spent"><strong>{currency.format(budget.spent_paise / 100)}</strong><span>of {currency.format(budget.amount_paise / 100)}</span></div>
        <div className="budget-track"><span style={{ width: `${Math.min(percent, 100)}%` }} /></div>
        <div className="budget-card-bottom"><span>{percent >= 100 ? "Budget exceeded" : `${currency.format(Math.max(0, budget.remaining_paise) / 100)} remaining`}</span><strong>{percent}%</strong></div>
        {tone !== "safe" && <p className={`budget-warning ${tone}`} role="status">{tone === "over" ? "You’ve passed this budget." : "You’re close to this budget."}</p>}
      </article>;
    })}</div> : <div className="empty-state budget-empty"><span className="empty-art" aria-hidden="true">⌖</span><h3>No budgets for this month</h3><p>Create an overall or category budget to track your spending.</p></div>}
  </section>;
}

export default BudgetManager;
