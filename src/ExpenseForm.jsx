import { useEffect, useMemo, useState } from "react";

function currentLocalDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function toLocalDateTime(value) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function ExpenseForm({ categories, accounts, initialExpense, onSubmit, onCancel }) {
  // Props provide reference data, an optional transaction, and save/cancel actions; local state holds the draft, validation errors, and submit status.
  const [values, setValues] = useState(() => initialExpense ? {
    description: initialExpense.description,
    amount: (initialExpense.amount_paise / 100).toFixed(2),
    type: initialExpense.type,
    occurred_at: toLocalDateTime(initialExpense.occurred_at),
    category_id: String(initialExpense.category_id),
    payment_method: initialExpense.payment_method,
    account_id: String(initialExpense.account_id),
    target_account_id: initialExpense.target_account_id ? String(initialExpense.target_account_id) : "",
    notes: initialExpense.notes ?? "",
  } : {
    description: "", amount: "", type: "expense", occurred_at: currentLocalDateTime(),
    category_id: "", payment_method: "UPI", account_id: accounts[0] ? String(accounts[0].id) : "",
    target_account_id: "", notes: "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const allowedCategories = useMemo(
    () => categories.filter((category) => category.kind === values.type || category.kind === "both"),
    [categories, values.type],
  );

  useEffect(() => {
    if (values.account_id || !accounts.length) return;
    setValues((current) => ({ ...current, account_id: String(accounts[0].id) }));
  }, [accounts, values.account_id]);

  const update = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setFormError("");
  };

  const handleTypeChange = (type) => {
    setValues((current) => ({ ...current, type, category_id: "", target_account_id: type === "transfer" ? current.target_account_id : "" }));
    setErrors({});
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!values.description.trim()) nextErrors.description = "Add a description.";
    if (!/^\d+(\.\d{1,2})?$/.test(values.amount) || Number(values.amount) <= 0) nextErrors.amount = "Enter an amount greater than ₹0 with up to two decimal places.";
    if (!values.occurred_at || Number.isNaN(Date.parse(values.occurred_at))) nextErrors.occurred_at = "Choose a valid date and time.";
    if (!values.category_id) nextErrors.category_id = "Choose a category.";
    if (!values.account_id) nextErrors.account_id = "Choose an account.";
    if (!values.payment_method.trim()) nextErrors.payment_method = "Choose a payment method.";
    if (values.type === "transfer" && (!values.target_account_id || values.account_id === values.target_account_id)) nextErrors.target_account_id = "Choose a different destination account.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await onSubmit({
        ...values,
        description: values.description.trim(),
        amount: Number(values.amount),
        occurred_at: new Date(values.occurred_at).toISOString(),
        category_id: Number(values.category_id),
        account_id: Number(values.account_id),
        target_account_id: values.target_account_id ? Number(values.target_account_id) : null,
      });
    } catch (error) {
      setErrors(error.fields ?? {});
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="expense-dialog" role="dialog" aria-modal="true" aria-labelledby="expense-form-title">
      <div className="dialog-heading">
        <div><p className="eyebrow">TRANSACTION DETAILS</p><h2 id="expense-form-title">{initialExpense ? "Edit transaction" : "Add transaction"}</h2></div>
        <button className="icon-button dialog-close" type="button" onClick={onCancel} aria-label="Close form">×</button>
      </div>
      {formError && <div className="alert alert-error form-alert" role="alert">{formError}</div>}
      <form onSubmit={submit} noValidate>
        <fieldset className="type-picker">
          <legend>Transaction type</legend>
          {["expense", "income", "transfer"].map((type) => <button key={type} type="button" className={values.type === type ? `type-option selected ${type}` : "type-option"} onClick={() => handleTypeChange(type)}>{type === "expense" ? "−" : type === "income" ? "+" : "↔"} {type[0].toUpperCase() + type.slice(1)}</button>)}
        </fieldset>
        <div className="form-grid">
          <label className="form-field full-field">Description<input autoFocus maxLength="120" value={values.description} onChange={(event) => update("description", event.target.value)} placeholder="e.g. Dinner with friends" aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "description-error" : undefined} />{errors.description && <small id="description-error" className="field-error">{errors.description}</small>}</label>
          <label className="form-field">Amount (₹)<div className="amount-input"><span>₹</span><input inputMode="decimal" value={values.amount} onChange={(event) => update("amount", event.target.value)} placeholder="0.00" aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? "amount-error" : undefined} /></div>{errors.amount && <small id="amount-error" className="field-error">{errors.amount}</small>}</label>
          <label className="form-field">Date and time<input type="datetime-local" value={values.occurred_at} onChange={(event) => update("occurred_at", event.target.value)} aria-invalid={Boolean(errors.occurred_at)} aria-describedby={errors.occurred_at ? "date-error" : undefined} />{errors.occurred_at && <small id="date-error" className="field-error">{errors.occurred_at}</small>}</label>
          <label className="form-field">Category<select value={values.category_id} onChange={(event) => update("category_id", event.target.value)} aria-invalid={Boolean(errors.category_id)} aria-describedby={errors.category_id ? "category-error" : undefined}><option value="">Select category</option>{allowedCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{errors.category_id && <small id="category-error" className="field-error">{errors.category_id}</small>}</label>
          <label className="form-field">Account<select value={values.account_id} onChange={(event) => update("account_id", event.target.value)} aria-invalid={Boolean(errors.account_id)}><option value="">Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.type.replace("_", " ")}</option>)}</select>{errors.account_id && <small className="field-error">{errors.account_id}</small>}</label>
          {values.type === "transfer" && <label className="form-field full-field">Move to<select value={values.target_account_id} onChange={(event) => update("target_account_id", event.target.value)} aria-invalid={Boolean(errors.target_account_id)}><option value="">Choose destination account</option>{accounts.filter((account) => String(account.id) !== values.account_id).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>{errors.target_account_id && <small className="field-error">{errors.target_account_id}</small>}</label>}
          <label className="form-field">Payment method<select value={values.payment_method} onChange={(event) => update("payment_method", event.target.value)}><option>UPI</option><option>Cash</option><option>Credit card</option><option>Debit card</option><option>Bank transfer</option><option>Other</option></select></label>
          <label className="form-field full-field">Notes <span className="optional-label">Optional</span><textarea rows="3" maxLength="1000" value={values.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Add a note to remember the details" /></label>
        </div>
        <div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving…" : initialExpense ? "Save changes" : "Save transaction"}</button></div>
      </form>
    </section>
  );
}

export default ExpenseForm;
