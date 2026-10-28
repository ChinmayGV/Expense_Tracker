import { useState } from "react";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function ExpenseItem({ expense, onView, onEdit, onDelete }) {
  // Props contain one transaction and its view/edit/delete callbacks; local state tracks confirmation and delete-request errors.
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const amount = currency.format(expense.amount_paise / 100);
  const isTransfer = expense.type === "transfer";
  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete(expense);
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setDeleting(false);
    }
  };
  return (
    <article className="transaction-row">
      <span className={`transaction-icon ${expense.type}`} aria-hidden="true">{expense.type === "income" ? "↙" : isTransfer ? "↔" : expense.category?.slice(0, 1) ?? "•"}</span>
      <button type="button" className="transaction-description" onClick={() => onView(expense)}><strong>{expense.description}</strong><span>{expense.category} <i>·</i> {shortDate.format(new Date(expense.occurred_at))}</span></button>
      <span className={`transaction-type-badge ${expense.type}`}>{expense.type}</span>
      <span className={`transaction-amount ${expense.type}`}>{expense.type === "income" ? "+" : expense.type === "expense" ? "−" : ""}{amount}</span>
      {confirming ? <div className="row-confirm"><span>{deleteError || "Delete?"}</span><button className="text-danger" disabled={deleting} onClick={confirmDelete}>{deleting ? "…" : "Yes"}</button><button className="text-muted" disabled={deleting} onClick={() => setConfirming(false)}>No</button></div> : <div className="row-actions"><button onClick={() => onView(expense)} aria-label={`View ${expense.description}`} title="View details">⌕</button><button onClick={() => onEdit(expense)} aria-label={`Edit ${expense.description}`} title="Edit">✎</button><button onClick={() => { setDeleteError(""); setConfirming(true); }} aria-label={`Delete ${expense.description}`} title="Delete">×</button></div>}
    </article>
  );
}

export default ExpenseItem;
