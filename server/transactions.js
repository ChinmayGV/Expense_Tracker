export const transactionTypes = new Set(["income", "expense", "transfer"]);
export const accountTypes = new Set(["cash", "bank", "upi", "credit_card", "debit_card", "other"]);

function isValidDate(value) {
  if (typeof value !== "string" || value.trim() === "" || Number.isNaN(Date.parse(value))) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value).toISOString().slice(0, 10) === value;
  return true;
}

function queryDate(value, isEndDate = false) {
  const date = new Date(value);
  if (isEndDate && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCDate(date.getUTCDate() + 1);
    return { value: date.toISOString(), inclusive: false };
  }
  return { value: date.toISOString(), inclusive: true };
}

export function parseAmount(amount) {
  if (typeof amount !== "number" && typeof amount !== "string") return null;
  if (String(amount).trim() === "") return null;
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(amount).trim())) return null;
  const paise = Math.round(parsed * 100);
  return Number.isSafeInteger(paise) ? paise : null;
}

export function validateTransaction(input, database) {
  const errors = {};
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!description || description.length > 120) errors.description = "Enter a description of up to 120 characters.";

  const amountPaise = parseAmount(input.amount);
  if (amountPaise === null) errors.amount = "Enter an amount greater than ₹0 with at most two decimal places.";

  if (!transactionTypes.has(input.type)) errors.type = "Choose income, expense, or transfer.";
  if (!isValidDate(input.occurred_at)) errors.occurred_at = "Enter a valid date and time.";

  const categoryId = Number(input.category_id);
  const category = Number.isInteger(categoryId)
    ? database.prepare("SELECT id, kind FROM categories WHERE id = ?").get(categoryId)
    : null;
  if (!category) errors.category_id = "Choose an existing category.";
  else if (category.kind !== "both" && category.kind !== input.type) errors.category_id = "Choose a category that matches the transaction type.";

  const accountId = Number(input.account_id);
  const account = Number.isInteger(accountId)
    ? database.prepare("SELECT id FROM accounts WHERE id = ?").get(accountId)
    : null;
  if (!account) errors.account_id = "Choose an existing account.";

  let targetAccountId = null;
  if (input.type === "transfer") {
    targetAccountId = Number(input.target_account_id);
    const targetAccount = Number.isInteger(targetAccountId)
      ? database.prepare("SELECT id FROM accounts WHERE id = ?").get(targetAccountId)
      : null;
    if (!targetAccount) errors.target_account_id = "Choose an existing destination account.";
    else if (targetAccountId === accountId) errors.target_account_id = "Choose a different destination account.";
  }

  const paymentMethod = typeof input.payment_method === "string" ? input.payment_method.trim() : "";
  if (!paymentMethod || paymentMethod.length > 40) errors.payment_method = "Enter a payment method of up to 40 characters.";

  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (notes.length > 1000) errors.notes = "Notes must be 1,000 characters or fewer.";

  if (Object.keys(errors).length) return { errors };
  return {
    value: {
      amount_paise: amountPaise,
      type: input.type,
      occurred_at: new Date(input.occurred_at).toISOString(),
      description,
      category_id: categoryId,
      payment_method: paymentMethod,
      account_id: accountId,
      target_account_id: targetAccountId,
      notes,
    },
  };
}

export function transactionFilters(query, database) {
  const clauses = [];
  const values = [];
  if (query.type) {
    if (!transactionTypes.has(query.type)) return { error: "Invalid transaction type filter." };
    clauses.push("t.type = ?");
    values.push(query.type);
  }
  if (query.category_id) {
    const categoryId = Number(query.category_id);
    if (!Number.isInteger(categoryId) || !database.prepare("SELECT 1 FROM categories WHERE id = ?").get(categoryId)) {
      return { error: "Invalid category filter." };
    }
    clauses.push("t.category_id = ?");
    values.push(categoryId);
  }
  if (query.from) {
    if (!isValidDate(query.from)) return { error: "Invalid start date filter." };
    clauses.push("t.occurred_at >= ?");
    values.push(queryDate(query.from).value);
  }
  if (query.to) {
    if (!isValidDate(query.to)) return { error: "Invalid end date filter." };
    const endDate = queryDate(query.to, true);
    clauses.push(endDate.inclusive ? "t.occurred_at <= ?" : "t.occurred_at < ?");
    values.push(endDate.value);
  }
  if (query.search) {
    const search = String(query.search).trim();
    if (search.length > 120) return { error: "Search text must be 120 characters or fewer." };
    clauses.push("(t.description LIKE ? OR t.notes LIKE ?)");
    values.push(`%${search}%`, `%${search}%`);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", values };
}
