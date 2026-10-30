import { useState } from "react";

async function request(path, options) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error ?? "Could not complete the request.");
  return payload;
}

function CategoryManager({ categories, onChanged }) {
  // Props supply the category list and reload callback; local state tracks the create/edit draft, delete confirmation, and request feedback.
  const [name, setName] = useState("");
  const [kind, setKind] = useState("expense");
  const [color, setColor] = useState("#5a9a67");
  const [editingId, setEditingId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => { setName(""); setKind("expense"); setColor("#5a9a67"); setEditingId(null); };
  const editCategory = (category) => { setEditingId(category.id); setName(category.name); setKind(category.kind); setColor(category.color); setError(""); };
  const saveCategory = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request(editingId ? `/api/categories/${editingId}` : "/api/categories", {
        method: editingId ? "PUT" : "POST", body: JSON.stringify({ name, kind, color }),
      });
      resetForm();
      await onChanged();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };
  const deleteCategory = async (category) => {
    setError("");
    try {
      await request(`/api/categories/${category.id}`, { method: "DELETE" });
      setConfirmingId(null);
      await onChanged();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return <section className="management-page">
    <div className="page-heading-row"><div><p className="eyebrow">MAKE IT YOURS</p><h1>Categories</h1><p className="page-subtitle">Keep your money organized in a way that makes sense to you.</p></div></div>
    <section className="panel category-form-panel"><div className="panel-heading"><div><p className="eyebrow">{editingId ? "UPDATE CATEGORY" : "ADD YOUR OWN"}</p><h2>{editingId ? "Edit category" : "Create a custom category"}</h2></div></div>
      <form className="category-form" onSubmit={saveCategory}><label className="form-field">Category name<input required maxLength="40" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Pet care" /></label><label className="form-field">Type<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option><option value="both">Income or expense</option></select></label><label className="form-field color-field">Color<input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label><div className="category-form-actions"><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add category"}</button>{editingId && <button type="button" className="button button-quiet" onClick={resetForm}>Cancel</button>}</div></form>
      {error && <p role="alert" className="field-error budget-error">{error}</p>}
    </section>
    <div className="budget-list-heading"><div><p className="eyebrow">YOUR ORGANIZATION</p><h2>All categories</h2></div><span>{categories.length} categories</span></div>
    <div className="category-grid">{categories.map((category) => <article className="panel category-manage-card" key={category.id}>
      <span className="category-color-large" style={{ "--category-color": category.color }} />
      <span className="category-manage-info"><strong>{category.name}</strong><small>{category.kind === "both" ? "Income or expense" : category.kind}</small></span>
      {confirmingId === category.id ? <div className="category-confirm"><button className="text-danger" onClick={() => deleteCategory(category)}>Delete</button><button onClick={() => setConfirmingId(null)}>Cancel</button></div> : <div className="row-actions always-visible"><button aria-label={`Edit ${category.name}`} onClick={() => editCategory(category)}>✎</button><button aria-label={`Delete ${category.name}`} onClick={() => setConfirmingId(category.id)}>×</button></div>}
    </article>)}</div>
  </section>;
}

export default CategoryManager;
