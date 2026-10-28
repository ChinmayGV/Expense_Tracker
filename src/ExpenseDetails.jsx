const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeStyle: "short" });

function ExpenseDetails({ expense, onClose, onEdit }) {
  // Props provide the selected transaction and close/edit callbacks; this read-only detail view has no local state.
  return <section className="expense-dialog details-dialog" role="dialog" aria-modal="true" aria-labelledby="expense-details-title">
    <div className="dialog-heading"><div><p className="eyebrow">TRANSACTION DETAILS</p><h2 id="expense-details-title">{expense.description}</h2></div><button className="icon-button dialog-close" type="button" onClick={onClose} aria-label="Close details">×</button></div>
    <div className="details-amount"><span className={`transaction-icon ${expense.type}`} aria-hidden="true">{expense.type === "income" ? "↙" : expense.type === "transfer" ? "↔" : expense.category?.slice(0, 1)}</span><strong>{expense.type === "income" ? "+" : expense.type === "expense" ? "−" : ""}{currency.format(expense.amount_paise / 100)}</strong><span className={`transaction-type-badge ${expense.type}`}>{expense.type}</span></div>
    <dl className="details-list"><div><dt>Date and time</dt><dd>{dateTime.format(new Date(expense.occurred_at))}</dd></div><div><dt>Category</dt><dd>{expense.category}</dd></div><div><dt>Account</dt><dd>{expense.account}</dd></div>{expense.type === "transfer" && <div><dt>Destination account</dt><dd>{expense.target_account}</dd></div>}<div><dt>Payment method</dt><dd>{expense.payment_method}</dd></div><div><dt>Notes</dt><dd>{expense.notes || "No notes"}</dd></div></dl>
    <div className="dialog-actions"><button className="button button-quiet" onClick={onClose}>Close</button><button className="button button-primary" onClick={() => onEdit(expense)}>Edit transaction</button></div>
  </section>;
}

export default ExpenseDetails;
