import { useState } from "react";

const accountTypes = ["cash", "bank", "upi", "credit_card", "debit_card", "other"];

async function request(path, options) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error ?? "Could not complete the request.");
  return payload;
}

function AccountManager({ accounts, onChanged }) {
  // Props supply the account list and reload callback; local state tracks the add/edit form and delete confirmation.
  const [name, setName] = useState("");
  const [type, setType] = useState("bank");
  const [editingId, setEditingId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const reset = () => { setName(""); setType("bank"); setEditingId(null); };
  const edit = (account) => { setName(account.name); setType(account.type); setEditingId(account.id); setError(""); };
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await request(editingId ? `/api/accounts/${editingId}` : "/api/accounts", { method: editingId ? "PUT" : "POST", body: JSON.stringify({ name, type }) });
      reset(); await onChanged();
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  };
  const remove = async (account) => {
    setError("");
    try { await request(`/api/accounts/${account.id}`, { method: "DELETE" }); setConfirmingId(null); await onChanged(); }
    catch (deleteError) { setError(deleteError.message); }
  };
  return <section className="panel account-manager">
    <div className="panel-heading"><div><p className="eyebrow">WHERE YOUR MONEY LIVES</p><h2>Accounts</h2></div><span>{accounts.length} accounts</span></div>
    <form className="account-form" onSubmit={save}><label className="form-field">Account name<input required maxLength="60" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. SBI savings" /></label><label className="form-field">Account type<select value={type} onChange={(event) => setType(event.target.value)}>{accountTypes.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}</option>)}</select></label><div className="account-form-actions"><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : editingId ? "Save account" : "Add account"}</button>{editingId && <button type="button" className="button button-quiet" onClick={reset}>Cancel</button>}</div></form>
    {error && <p className="field-error account-error" role="alert">{error}</p>}
    <div className="account-list">{accounts.map((account) => <div className="account-row" key={account.id}><span className="account-icon" aria-hidden="true">{account.type === "cash" ? "₹" : account.type === "upi" ? "↗" : "▤"}</span><span className="account-info"><strong>{account.name}</strong><small>{account.type.replaceAll("_", " ")}</small></span>{confirmingId === account.id ? <div className="row-confirm"><button className="text-danger" onClick={() => remove(account)}>Delete</button><button onClick={() => setConfirmingId(null)}>Cancel</button></div> : <div className="row-actions always-visible"><button aria-label={`Edit ${account.name}`} onClick={() => edit(account)}>✎</button><button aria-label={`Delete ${account.name}`} onClick={() => setConfirmingId(account.id)}>×</button></div>}</div>)}</div>
  </section>;
}

export default AccountManager;
