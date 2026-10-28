import { useMemo, useRef, useState } from "react";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const requiredColumns = ["description", "amount", "type", "occurred_at", "category"];
const aliases = { date: "occurred_at", datetime: "occurred_at", merchant: "description", payment: "payment_method", account_name: "account" };

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"' && cell.length === 0) quoted = true;
    else if (character === ",") { row.push(cell); cell = ""; }
    else if (character === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += character;
  }
  if (quoted) throw new Error("This CSV has an unclosed quoted value.");
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((values) => values.some((value) => value.trim() !== ""));
}

function normalizedDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function makeSignature(transaction) {
  return JSON.stringify([
    Math.round(transaction.amount_paise ?? Number(transaction.amount) * 100),
    transaction.type,
    transaction.occurred_at,
    transaction.description.trim().toLowerCase(),
    Number(transaction.category_id),
    Number(transaction.account_id),
    transaction.target_account_id ? Number(transaction.target_account_id) : null,
  ]);
}

function ImportExport({ transactions, categories, accounts, onImported }) {
  // Props provide the selected export rows, reference data, and post-import refresh callback; local state holds the file preview and confirmation status.
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const fileInput = useRef(null);
  const validRows = useMemo(() => rows.filter((row) => !row.errors.length && !row.duplicate), [rows]);
  const invalidRows = rows.filter((row) => row.errors.length);
  const duplicateRows = rows.filter((row) => row.duplicate);

  const exportCsv = () => {
    const headers = ["description", "amount", "type", "occurred_at", "category", "payment_method", "account", "target_account", "notes"];
    const body = transactions.map((transaction) => [
      transaction.description,
      (transaction.amount_paise / 100).toFixed(2),
      transaction.type,
      transaction.occurred_at,
      transaction.category,
      transaction.payment_method,
      transaction.account,
      transaction.target_account ?? "",
      transaction.notes ?? "",
    ]);
    const csv = [headers, ...body].map((line) => line.map(csvEscape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `paisa-wise-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const previewFile = async (event) => {
    const file = event.target.files?.[0];
    setRows([]); setFileName(""); setError(""); setMessage(""); setImportSummary(null);
    if (!file) return;
    setFileName(file.name);
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Choose a .csv file."); return; }
    if (file.size > 1024 * 1024) { setError("Choose a CSV smaller than 1 MB."); return; }
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length < 2) throw new Error("The CSV needs a header row and at least one transaction.");
      const headers = parsed[0].map((header) => aliases[header.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/\s+/g, "_")] ?? header.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/\s+/g, "_"));
      const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
      if (duplicateHeaders.length) throw new Error(`Duplicate column: ${duplicateHeaders[0]}.`);
      const missing = requiredColumns.filter((header) => !headers.includes(header));
      if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}.`);
      if (parsed.length - 1 > 500) throw new Error("Choose a CSV with no more than 500 transaction rows.");

      const existing = new Set(transactions.map((transaction) => makeSignature({
        ...transaction,
        amount: transaction.amount_paise / 100,
      })));
      const inFile = new Set();
      const preview = parsed.slice(1).map((values, index) => {
        const record = Object.fromEntries(headers.map((header, column) => [header, values[column]?.trim() ?? ""]));
        const errors = [];
        const description = record.description ?? "";
        if (!description || description.length > 120) errors.push("Description is required and must be 120 characters or fewer.");
        const amountText = (record.amount ?? "").replace(/[₹,\s]/g, "");
        if (!/^\d+(\.\d{1,2})?$/.test(amountText) || Number(amountText) <= 0) errors.push("Amount must be positive with up to two decimal places.");
        const type = (record.type ?? "").toLowerCase();
        if (!["expense", "income", "transfer"].includes(type)) errors.push("Type must be income, expense, or transfer.");
        const occurredAt = normalizedDate(record.occurred_at);
        if (!occurredAt) errors.push("Date and time must be valid.");
        const category = categories.find((item) => item.name.toLowerCase() === (record.category ?? "").toLowerCase());
        if (!category) errors.push("Category does not match an existing category.");
        else if (category.kind !== "both" && category.kind !== type) errors.push("Category type does not match the transaction type.");
        const account = accounts.find((item) => item.name.toLowerCase() === (record.account ?? accounts[0]?.name ?? "").toLowerCase());
        if (!account) errors.push("Account does not match an existing account.");
        const targetAccount = record.target_account ? accounts.find((item) => item.name.toLowerCase() === record.target_account.toLowerCase()) : null;
        if (type === "transfer" && (!targetAccount || targetAccount.id === account?.id)) errors.push("Transfer needs a different existing destination account.");
        const amount = Number(amountText);
        const transaction = {
          description,
          amount,
          type,
          occurred_at: occurredAt ?? "",
          category_id: category?.id,
          category: category?.name ?? record.category,
          payment_method: record.payment_method || "Other",
          account_id: account?.id,
          account: account?.name,
          target_account_id: targetAccount?.id ?? null,
          target_account: targetAccount?.name ?? null,
          notes: record.notes ?? "",
        };
        let duplicate = false;
        if (!errors.length) {
          const signature = makeSignature(transaction);
          duplicate = existing.has(signature) || inFile.has(signature);
          inFile.add(signature);
        }
        return { rowNumber: index + 2, transaction, errors, duplicate };
      });
      setRows(preview);
    } catch (parseError) {
      setError(parseError.message);
    }
  };

  const importRows = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_name: fileName,
          transactions: validRows.map(({ transaction }) => ({
            description: transaction.description,
            amount: transaction.amount,
            type: transaction.type,
            occurred_at: transaction.occurred_at,
            category_id: transaction.category_id,
            payment_method: transaction.payment_method,
            account_id: transaction.account_id,
            target_account_id: transaction.target_account_id,
            notes: transaction.notes,
          })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "The import could not be completed.");
      setImportSummary(payload);
      setMessage(payload.message);
      if (payload.imported) await onImported();
    } catch (importError) {
      setError(importError.message);
    } finally {
      setBusy(false);
    }
  };

  return <section className="management-page import-page">
    <div className="page-heading-row"><div><p className="eyebrow">MOVE YOUR RECORDS SAFELY</p><h1>Import &amp; export</h1><p className="page-subtitle">Bring in a CSV, review it, then choose what to save.</p></div></div>
    <div className="import-export-grid">
      <section className="panel export-panel"><span className="import-card-icon export-icon" aria-hidden="true">⇧</span><p className="eyebrow">TAKE YOUR DATA WITH YOU</p><h2>Export transactions</h2><p>Download the transactions matching your current date, search, category, and type filters.</p><div className="export-count">{transactions.length} {transactions.length === 1 ? "transaction" : "transactions"} selected</div><button className="button button-primary" onClick={exportCsv} disabled={!transactions.length}>Download CSV</button></section>
      <section className="panel import-panel"><span className="import-card-icon" aria-hidden="true">⇩</span><p className="eyebrow">PREVIEW BEFORE SAVING</p><h2>Import a CSV</h2><p>Use the exported CSV columns or a CSV with description, amount, type, occurred_at, and category.</p><label className="file-picker">Choose CSV file<input ref={fileInput} type="file" accept=".csv,text/csv" onChange={previewFile} /></label><small className="file-limit">CSV only · up to 500 rows · 1 MB max</small></section>
    </div>
    {error && <div className="alert alert-error import-alert" role="alert">{error}</div>}
    {message && <div className="alert alert-success" role="status">{message}{importSummary?.duplicates?.length ? ` ${importSummary.duplicates.length} duplicate ${importSummary.duplicates.length === 1 ? "row was" : "rows were"} skipped.` : ""}</div>}
    {rows.length > 0 && <section className="panel import-preview"><div className="panel-heading"><div><p className="eyebrow">{fileName}</p><h2>Review import</h2></div><button className="button button-quiet" onClick={() => { setRows([]); setFileName(""); setImportSummary(null); if (fileInput.current) fileInput.current.value = ""; }}>Clear preview</button></div>
      <div className="import-summary"><span><strong>{validRows.length}</strong> ready</span><span><strong>{duplicateRows.length}</strong> likely duplicates</span><span><strong>{invalidRows.length}</strong> need attention</span></div>
      <div className="import-table-wrap"><table className="import-table"><thead><tr><th>CSV row</th><th>Description</th><th>Amount</th><th>Category</th><th>Review</th></tr></thead><tbody>{rows.map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.transaction.description || "—"}</td><td>{Number.isFinite(row.transaction.amount) ? currency.format(row.transaction.amount) : "—"}</td><td>{row.transaction.category}</td><td>{row.errors.length ? <span className="import-status invalid" title={row.errors.join(" ")}>{row.errors.join(" ")}</span> : row.duplicate ? <span className="import-status duplicate">Likely duplicate</span> : <span className="import-status ready">Ready</span>}</td></tr>)}</tbody></table></div>
      <div className="import-confirm-row"><p>Only valid, non-duplicate rows will be saved. You’ll confirm this import with the button.</p><button className="button button-primary" onClick={importRows} disabled={!validRows.length || busy || Boolean(importSummary)}>{busy ? "Importing…" : `Confirm and import ${validRows.length} ${validRows.length === 1 ? "transaction" : "transactions"}`}</button></div>
    </section>}
  </section>;
}

export default ImportExport;
