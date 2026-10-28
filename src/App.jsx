import { useCallback, useEffect, useMemo, useState } from "react";
import Analytics from "./Analytics.jsx";
import BudgetManager from "./BudgetManager.jsx";
import CategoryManager from "./CategoryManager.jsx";
import Dashboard from "./Dashboard.jsx";
import ExpenseForm from "./ExpenseForm.jsx";
import ExpenseDetails from "./ExpenseDetails.jsx";
import ExpenseList from "./ExpenseList.jsx";
import ImportExport from "./ImportExport.jsx";
import Settings from "./Settings.jsx";

function localMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const requestError = new Error(error.error ?? "The request could not be completed.");
    requestError.fields = error.fields;
    requestError.status = response.status;
    throw requestError;
  }
  return response.status === 204 ? null : response.json();
}

function dateBounds(period, customStart, customEnd) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (period === "today") return [start, end];
  if (period === "week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return [start, end];
  }
  if (period === "month") return [new Date(now.getFullYear(), now.getMonth(), 1), end];
  if (period === "last-month") return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)];
  if (period === "custom") {
    return [customStart ? new Date(`${customStart}T00:00:00`) : null, customEnd ? new Date(`${customEnd}T23:59:59.999`) : null];
  }
  return [null, null];
}

function App() {
  // The root owns loaded records, navigation, active filters, and dialog state; child components receive data and actions through props.
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeView, setActiveView] = useState("dashboard");
  const [period, setPeriod] = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [detailsExpense, setDetailsExpense] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState(() => window.localStorage.getItem("expense-theme") ?? "light");

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [transactionRows, categoryRows, accountRows, budgetRows] = await Promise.all([
        api("/api/transactions?sort=date&order=desc"),
        api("/api/categories"),
        api("/api/accounts"),
        api(`/api/budgets?month=${localMonthKey()}`),
      ]);
      setTransactions(transactionRows);
      setCategories(categoryRows);
      setAccounts(accountRows);
      setBudgets(budgetRows);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [refreshKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    window.localStorage.setItem("expense-theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const dateFilteredTransactions = useMemo(() => {
    const [start, end] = dateBounds(period, customStart, customEnd);
    return transactions.filter((expense) => {
      const occurred = new Date(expense.occurred_at);
      const inEnd = !end || (period === "custom" ? occurred <= end : occurred < end);
      return (!start || occurred >= start) && inEnd;
    });
  }, [transactions, period, customStart, customEnd]);

  const filteredTransactions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return dateFilteredTransactions
      .filter((expense) => {
        return (categoryFilter === "all" || String(expense.category_id) === categoryFilter)
          && (typeFilter === "all" || expense.type === typeFilter)
          && (!term || `${expense.description} ${expense.category} ${expense.notes}`.toLowerCase().includes(term));
      })
      .sort((first, second) => sortOrder === "oldest"
        ? new Date(first.occurred_at) - new Date(second.occurred_at)
        : sortOrder === "amount-high"
          ? second.amount_paise - first.amount_paise
          : new Date(second.occurred_at) - new Date(first.occurred_at));
  }, [dateFilteredTransactions, search, categoryFilter, typeFilter, sortOrder]);

  const saveExpense = async (formData) => {
    const path = editingExpense ? `/api/transactions/${editingExpense.id}` : "/api/transactions";
    await api(path, { method: editingExpense ? "PUT" : "POST", body: JSON.stringify(formData) });
    setShowForm(false);
    setEditingExpense(null);
    setNotice(editingExpense ? "Transaction updated." : "Transaction added.");
    setRefreshKey((current) => current + 1);
  };

  const deleteExpense = async (expense) => {
    await api(`/api/transactions/${expense.id}`, { method: "DELETE" });
    setNotice("Transaction deleted.");
    setRefreshKey((current) => current + 1);
  };

  const openNewForm = () => {
    setEditingExpense(null);
    setShowForm(true);
  };

  const openEditForm = (expense) => {
    setEditingExpense(expense);
    setShowForm(true);
  };

  const navItems = [
    ["dashboard", "▦", "Dashboard"],
    ["transactions", "↔", "Transactions"],
    ["budgets", "⌖", "Budgets"],
    ["analytics", "⌁", "Analytics"],
    ["categories", "◉", "Categories"],
    ["import", "⇅", "Import"],
    ["settings", "⚙", "Settings"],
  ];

  return (
    <main className={`app-shell theme-${theme}`}>
      <aside className="sidebar">
        <a className="brand" href="#dashboard" onClick={() => setActiveView("dashboard")}>
          <span className="brand-mark" aria-hidden="true">₹</span>
          <span>paisa<span className="brand-light">wise</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation" className="main-nav">
          {navItems.map(([view, icon, label]) => <button key={view} className={activeView === view ? "nav-link active" : "nav-link"} onClick={() => setActiveView(view)}><span aria-hidden="true">{icon}</span>{label}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <span className="privacy-icon" aria-hidden="true">◈</span>
            <strong>Your money, your data</strong>
            <p>Stored locally on this device. Never shared.</p>
          </div>
          <div className="profile-row">
            <span className="avatar">P</span>
            <span><strong>Personal space</strong><small>Local account</small></span>
            <span className="profile-dots" aria-hidden="true">···</span>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{navItems.find(([view]) => view === activeView)?.[2]}</strong></div>
          <div className="topbar-actions">
            <span className="today-label">{new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(new Date())}</span>
            <button className="icon-button" aria-label="Notifications" title="No new notifications">♧</button>
            <button className="top-avatar" aria-label="Personal account">P</button>
          </div>
        </header>

        <div className="page-content">
          {notice && <div className="toast" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></div>}
          {loadError && <div className="alert alert-error" role="alert">{loadError} <button onClick={loadData}>Try again</button></div>}
          {activeView === "dashboard" ? (
            <Dashboard
              transactions={dateFilteredTransactions}
              allTransactions={transactions}
              categories={categories}
              budgets={budgets}
              period={period}
              customStart={customStart}
              customEnd={customEnd}
              onCustomStartChange={setCustomStart}
              onCustomEndChange={setCustomEnd}
              onPeriodChange={setPeriod}
              onAddExpense={openNewForm}
              onViewTransactions={() => setActiveView("transactions")}
              onViewBudgets={() => setActiveView("budgets")}
              loading={loading}
            />
          ) : activeView === "transactions" ? (
            <section className="transactions-page">
              <div className="page-heading-row">
                <div><p className="eyebrow">YOUR MONEY, CLEARLY</p><h1>Transactions</h1><p className="page-subtitle">Every rupee, accounted for.</p></div>
                <button className="button button-primary" onClick={openNewForm} disabled={loading}><span aria-hidden="true">＋</span> Add transaction</button>
              </div>
              <div className="filter-card">
                <label className="search-field"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions" aria-label="Search transactions" /></label>
                <label className="select-filter"><span className="sr-only">Filter by category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label className="select-filter"><span className="sr-only">Filter by type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All types</option><option value="expense">Expenses</option><option value="income">Income</option><option value="transfer">Transfers</option></select></label>
                <label className="select-filter"><span className="sr-only">Sort transactions</span><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="amount-high">Highest amount</option></select></label>
              </div>
              {loading ? <div className="loading-card" role="status">Loading your transactions…</div> : (
                <ExpenseList expenses={filteredTransactions} onView={setDetailsExpense} onEdit={openEditForm} onDelete={deleteExpense} />
              )}
            </section>
          ) : activeView === "budgets" ? <BudgetManager budgets={budgets} categories={categories} month={localMonthKey()} onChanged={loadData} />
            : activeView === "categories" ? <CategoryManager categories={categories} onChanged={loadData} />
              : activeView === "analytics" ? <Analytics transactions={transactions} />
                : activeView === "import" ? <ImportExport transactions={filteredTransactions} categories={categories} accounts={accounts} onImported={loadData} />
                  : <Settings accounts={accounts} onAccountsChanged={loadData} theme={theme} onThemeChange={setTheme} />}
        </div>
      </section>

      {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
        <ExpenseForm
          categories={categories}
          accounts={accounts}
          initialExpense={editingExpense}
          onSubmit={saveExpense}
          onCancel={() => { setShowForm(false); setEditingExpense(null); }}
        />
      </div>}
      {detailsExpense && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsExpense(null); }}><ExpenseDetails expense={detailsExpense} onClose={() => setDetailsExpense(null)} onEdit={(expense) => { setDetailsExpense(null); openEditForm(expense); }} /></div>}
    </main>
  );
}

export default App;
