import ExpenseItem from "./ExpenseItem.jsx";

function ExpenseList({ expenses, onView, onEdit, onDelete }) {
  // Props provide the visible transaction rows and their view/edit/delete callbacks; this presentational list has no local state.
  if (!expenses.length) return <div className="empty-state"><span className="empty-art" aria-hidden="true">⌁</span><h3>No transactions found</h3><p>Try changing your filters or add your first transaction.</p></div>;
  return <section className="transaction-list" aria-label="Transactions">
    <div className="transaction-list-heading"><span>Transaction</span><span>Type</span><span>Amount</span><span className="sr-only">Actions</span></div>
    {expenses.map((expense) => <ExpenseItem key={expense.id} expense={expense} onView={onView} onEdit={onEdit} onDelete={onDelete} />)}
  </section>;
}

export default ExpenseList;
