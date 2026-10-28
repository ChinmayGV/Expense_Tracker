import express from "express";
import { database } from "./database.js";
import { accountTypes, parseAmount, transactionFilters, validateTransaction } from "./transactions.js";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/categories", (_request, response) => {
  const categories = database.prepare("SELECT id, name, kind, color FROM categories ORDER BY name").all();
  response.json(categories);
});

app.post("/api/categories", (request, response) => {
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
  const kind = request.body?.kind;
  const color = typeof request.body?.color === "string" ? request.body.color : "#64748b";
  const errors = {};
  if (!name || name.length > 40) errors.name = "Enter a category name of up to 40 characters.";
  if (!["income", "expense", "transfer", "both"].includes(kind)) errors.kind = "Choose a valid category type.";
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) errors.color = "Choose a valid six-digit hex color.";
  if (Object.keys(errors).length) return response.status(400).json({ error: "Check the category details.", fields: errors });
  try {
    const result = database.prepare("INSERT INTO categories (name, kind, color) VALUES (?, ?, ?)").run(name, kind, color);
    return response.status(201).json(database.prepare("SELECT id, name, kind, color FROM categories WHERE id = ?").get(result.lastInsertRowid));
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return response.status(409).json({ error: "A category with this name already exists." });
    throw error;
  }
});

app.put("/api/categories/:id", (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) return response.status(400).json({ error: "Invalid category ID." });
  const existing = database.prepare("SELECT id FROM categories WHERE id = ?").get(id);
  if (!existing) return response.status(404).json({ error: "Category not found." });
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
  const kind = request.body?.kind;
  const color = typeof request.body?.color === "string" ? request.body.color : "#64748b";
  const errors = {};
  if (!name || name.length > 40) errors.name = "Enter a category name of up to 40 characters.";
  if (!["income", "expense", "transfer", "both"].includes(kind)) errors.kind = "Choose a valid category type.";
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) errors.color = "Choose a valid six-digit hex color.";
  if (Object.keys(errors).length) return response.status(400).json({ error: "Check the category details.", fields: errors });
  const incompatibleTransaction = database.prepare(
    "SELECT 1 FROM transactions WHERE category_id = ? AND type != ? AND ? != 'both' LIMIT 1",
  ).get(id, kind, kind);
  const incompatibleBudget = database.prepare(
    "SELECT 1 FROM budgets WHERE category_id = ? LIMIT 1",
  ).get(id);
  if ((incompatibleTransaction && kind !== "both") || (incompatibleBudget && !["expense", "both"].includes(kind))) {
    return response.status(409).json({ error: "This category type conflicts with assigned transactions or budgets." });
  }
  try {
    database.prepare("UPDATE categories SET name = ?, kind = ?, color = ? WHERE id = ?").run(name, kind, color, id);
    return response.json(database.prepare("SELECT id, name, kind, color FROM categories WHERE id = ?").get(id));
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return response.status(409).json({ error: "A category with this name already exists." });
    throw error;
  }
});

app.delete("/api/categories/:id", (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) return response.status(400).json({ error: "Invalid category ID." });
  if (!database.prepare("SELECT 1 FROM categories WHERE id = ?").get(id)) return response.status(404).json({ error: "Category not found." });
  const usedByTransaction = database.prepare("SELECT 1 FROM transactions WHERE category_id = ? LIMIT 1").get(id);
  const usedByBudget = database.prepare("SELECT 1 FROM budgets WHERE category_id = ? LIMIT 1").get(id);
  if (usedByTransaction || usedByBudget) return response.status(409).json({ error: "This category is in use. Reassign its transactions and budgets before deleting it." });
  database.prepare("DELETE FROM categories WHERE id = ?").run(id);
  response.status(204).end();
});

function validMonth(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

app.get("/api/budgets", (request, response) => {
  const indiaNow = new Date(Date.now() + 330 * 60 * 1000);
  const month = request.query.month ?? indiaNow.toISOString().slice(0, 7);
  if (!validMonth(month)) return response.status(400).json({ error: "Month must use YYYY-MM format." });
  const rows = database.prepare(`
    SELECT b.id, b.month, b.category_id, c.name AS category, b.amount_paise,
      COALESCE(SUM(t.amount_paise), 0) AS spent_paise
    FROM budgets b
    LEFT JOIN categories c ON c.id = b.category_id
    LEFT JOIN transactions t ON t.type = 'expense'
      AND substr(datetime(t.occurred_at, '+5 hours', '+30 minutes'), 1, 7) = b.month
      AND (b.category_id IS NULL OR t.category_id = b.category_id)
    WHERE b.month = ?
    GROUP BY b.id
    ORDER BY b.category_id IS NOT NULL, c.name
  `).all(month);
  response.json(rows.map((budget) => ({
    ...budget,
    remaining_paise: budget.amount_paise - budget.spent_paise,
    utilization_percent: Math.round((budget.spent_paise / budget.amount_paise) * 100),
  })));
});

app.post("/api/budgets", (request, response) => {
  const month = request.body?.month;
  const amountPaise = parseAmount(request.body?.amount);
  let categoryId = null;
  if (request.body?.category_id !== undefined && request.body?.category_id !== null && request.body?.category_id !== "") {
    categoryId = Number(request.body.category_id);
  }
  if (!validMonth(month)) return response.status(400).json({ error: "Month must use YYYY-MM format." });
  if (amountPaise === null) return response.status(400).json({ error: "Budget must be a positive amount with at most two decimal places." });
  if (categoryId !== null) {
    if (!Number.isInteger(categoryId)) return response.status(400).json({ error: "Invalid category ID." });
    const category = database.prepare("SELECT kind FROM categories WHERE id = ?").get(categoryId);
    if (!category || !["expense", "both"].includes(category.kind)) return response.status(400).json({ error: "Choose an expense category." });
  }
  const existing = categoryId === null
    ? database.prepare("SELECT id FROM budgets WHERE month = ? AND category_id IS NULL").get(month)
    : database.prepare("SELECT id FROM budgets WHERE month = ? AND category_id = ?").get(month, categoryId);
  if (existing) {
    database.prepare("UPDATE budgets SET amount_paise = ? WHERE id = ?").run(amountPaise, existing.id);
    return response.json(database.prepare("SELECT id, month, category_id, amount_paise FROM budgets WHERE id = ?").get(existing.id));
  }
  const result = database.prepare("INSERT INTO budgets (month, category_id, amount_paise) VALUES (?, ?, ?)").run(month, categoryId, amountPaise);
  response.status(201).json(database.prepare("SELECT id, month, category_id, amount_paise FROM budgets WHERE id = ?").get(result.lastInsertRowid));
});

app.delete("/api/budgets/:id", (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) return response.status(400).json({ error: "Invalid budget ID." });
  const result = database.prepare("DELETE FROM budgets WHERE id = ?").run(id);
  if (!result.changes) return response.status(404).json({ error: "Budget not found." });
  response.status(204).end();
});

app.get("/api/accounts", (_request, response) => {
  const accounts = database.prepare("SELECT id, name, type FROM accounts ORDER BY name").all();
  response.json(accounts);
});

app.post("/api/accounts", (request, response) => {
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
  const type = request.body?.type;
  const errors = {};
  if (!name || name.length > 60) errors.name = "Enter an account name of up to 60 characters.";
  if (!accountTypes.has(type)) errors.type = "Choose a supported account type.";
  if (Object.keys(errors).length) return response.status(400).json({ error: "Check the account details.", fields: errors });

  try {
    const result = database.prepare("INSERT INTO accounts (name, type) VALUES (?, ?)").run(name, type);
    return response.status(201).json(database.prepare("SELECT id, name, type FROM accounts WHERE id = ?").get(result.lastInsertRowid));
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return response.status(409).json({ error: "An account with this name already exists." });
    }
    throw error;
  }
});

app.put("/api/accounts/:id", (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) return response.status(400).json({ error: "Invalid account ID." });
  if (!database.prepare("SELECT 1 FROM accounts WHERE id = ?").get(id)) return response.status(404).json({ error: "Account not found." });
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
  const type = request.body?.type;
  if (!name || name.length > 60) return response.status(400).json({ error: "Enter an account name of up to 60 characters." });
  if (!accountTypes.has(type)) return response.status(400).json({ error: "Choose a supported account type." });
  try {
    database.prepare("UPDATE accounts SET name = ?, type = ? WHERE id = ?").run(name, type, id);
    return response.json(database.prepare("SELECT id, name, type FROM accounts WHERE id = ?").get(id));
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return response.status(409).json({ error: "An account with this name already exists." });
    throw error;
  }
});

app.delete("/api/accounts/:id", (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) return response.status(400).json({ error: "Invalid account ID." });
  if (!database.prepare("SELECT 1 FROM accounts WHERE id = ?").get(id)) return response.status(404).json({ error: "Account not found." });
  const usage = database.prepare("SELECT 1 FROM transactions WHERE account_id = ? OR target_account_id = ? LIMIT 1").get(id, id);
  if (usage) return response.status(409).json({ error: "This account is used by a transaction. Reassign those transactions before deleting it." });
  database.prepare("DELETE FROM accounts WHERE id = ?").run(id);
  response.status(204).end();
});

app.get("/api/transactions", (request, response) => {
  const filters = transactionFilters(request.query, database);
  if (filters.error) return response.status(400).json({ error: filters.error });

  const sortFields = {
    date: "t.occurred_at",
    amount: "t.amount_paise",
    description: "t.description",
  };
  const sortBy = sortFields[request.query.sort] ?? sortFields.date;
  const direction = request.query.order === "asc" ? "ASC" : "DESC";
  const rows = database.prepare(`
    SELECT t.id, t.amount_paise, t.type, t.occurred_at, t.description,
      t.category_id, c.name AS category, c.color AS category_color,
      t.payment_method, t.account_id, a.name AS account,
      t.target_account_id, ta.name AS target_account, t.notes,
      t.created_at, t.updated_at
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN accounts ta ON ta.id = t.target_account_id
    ${filters.where}
    ORDER BY ${sortBy} ${direction}, t.id DESC
  `).all(...filters.values);
  response.json(rows);
});

app.get("/api/transactions/:id", (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) return response.status(400).json({ error: "Invalid transaction ID." });
  const row = database.prepare(`
    SELECT t.id, t.amount_paise, t.type, t.occurred_at, t.description,
      t.category_id, c.name AS category, c.color AS category_color,
      t.payment_method, t.account_id, a.name AS account,
      t.target_account_id, ta.name AS target_account, t.notes,
      t.created_at, t.updated_at
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN accounts ta ON ta.id = t.target_account_id
    WHERE t.id = ?
  `).get(id);
  if (!row) return response.status(404).json({ error: "Transaction not found." });
  response.json(row);
});

app.post("/api/imports", (request, response) => {
  const sourceName = typeof request.body?.source_name === "string" ? request.body.source_name.trim().slice(0, 120) : "CSV import";
  const inputRows = request.body?.transactions;
  if (!Array.isArray(inputRows) || inputRows.length === 0) {
    return response.status(400).json({ error: "Select at least one valid transaction to import." });
  }
  if (inputRows.length > 500) return response.status(413).json({ error: "Import up to 500 transactions at a time." });

  const validRows = [];
  const invalidRows = [];
  for (let index = 0; index < inputRows.length; index += 1) {
    const result = validateTransaction(inputRows[index] ?? {}, database);
    if (result.errors) invalidRows.push({ row: index + 1, fields: result.errors });
    else validRows.push({ row: index + 1, value: result.value });
  }
  if (invalidRows.length) {
    return response.status(400).json({ error: "Some transactions are invalid. No rows were imported.", invalid_rows: invalidRows });
  }

  const findDuplicate = database.prepare(`
    SELECT id FROM transactions
    WHERE amount_paise = ? AND type = ? AND occurred_at = ?
      AND lower(description) = lower(?) AND category_id = ? AND account_id = ?
      AND target_account_id IS ?
    LIMIT 1
  `);
  const insertTransaction = database.prepare(`
    INSERT INTO transactions (amount_paise, type, occurred_at, description, category_id,
      payment_method, account_id, target_account_id, notes)
    VALUES (@amount_paise, @type, @occurred_at, @description, @category_id,
      @payment_method, @account_id, @target_account_id, @notes)
  `);
  const insertedDescriptions = new Set();
  const duplicates = [];
  const rowsToInsert = [];
  for (const item of validRows) {
    const value = item.value;
    const signature = JSON.stringify([
      value.amount_paise, value.type, value.occurred_at, value.description.toLowerCase(),
      value.category_id, value.account_id, value.target_account_id,
    ]);
    if (insertedDescriptions.has(signature) || findDuplicate.get(
      value.amount_paise, value.type, value.occurred_at, value.description,
      value.category_id, value.account_id, value.target_account_id,
    )) {
      duplicates.push({ row: item.row, description: value.description });
      continue;
    }
    insertedDescriptions.add(signature);
    rowsToInsert.push(item);
  }

  let batchId = null;
  if (rowsToInsert.length) {
    const importRows = database.transaction(() => {
      const batch = database.prepare("INSERT INTO import_batches (source_name, row_count) VALUES (?, ?)")
        .run(sourceName || "CSV import", rowsToInsert.length);
      for (const item of rowsToInsert) insertTransaction.run(item.value);
      return batch.lastInsertRowid;
    });
    batchId = importRows();
  }

  response.status(rowsToInsert.length ? 201 : 200).json({
    batch_id: batchId,
    imported: rowsToInsert.length,
    duplicates,
    message: rowsToInsert.length ? "Transactions imported." : "All selected rows were duplicates.",
  });
});

app.post("/api/transactions", (request, response) => {
  const result = validateTransaction(request.body ?? {}, database);
  if (result.errors) return response.status(400).json({ error: "Check the transaction details.", fields: result.errors });

  const fields = Object.keys(result.value);
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((field) => result.value[field]);
  const inserted = database.prepare(
    `INSERT INTO transactions (${fields.join(", ")}) VALUES (${placeholders})`,
  ).run(...values);
  const row = database.prepare("SELECT * FROM transactions WHERE id = ?").get(inserted.lastInsertRowid);
  response.status(201).json(row);
});

app.put("/api/transactions/:id", (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) return response.status(400).json({ error: "Invalid transaction ID." });
  if (!database.prepare("SELECT 1 FROM transactions WHERE id = ?").get(id)) {
    return response.status(404).json({ error: "Transaction not found." });
  }

  const result = validateTransaction(request.body ?? {}, database);
  if (result.errors) return response.status(400).json({ error: "Check the transaction details.", fields: result.errors });
  const fields = Object.keys(result.value);
  const assignments = fields.map((field) => `${field} = ?`).join(", ");
  database.prepare(
    `UPDATE transactions SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).run(...fields.map((field) => result.value[field]), id);
  response.json(database.prepare("SELECT * FROM transactions WHERE id = ?").get(id));
});

app.delete("/api/transactions/:id", (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) return response.status(400).json({ error: "Invalid transaction ID." });
  const result = database.prepare("DELETE FROM transactions WHERE id = ?").run(id);
  if (!result.changes) return response.status(404).json({ error: "Transaction not found." });
  response.status(204).end();
});

app.use((error, _request, response, _next) => {
  if (error?.type === "entity.parse.failed") {
    return response.status(400).json({ error: "Request body must contain valid JSON." });
  }
  if (error?.type === "entity.too.large") {
    return response.status(413).json({ error: "Request body is too large." });
  }
  if (error?.code === "SQLITE_CONSTRAINT_FOREIGNKEY" || error?.code === "SQLITE_CONSTRAINT_CHECK") {
    return response.status(400).json({ error: "The transaction conflicts with a database constraint." });
  }
  console.error("Unhandled API error:", error?.message ?? "unknown error");
  response.status(500).json({ error: "The server could not complete the request." });
});

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Expense Tracker API listening on http://127.0.0.1:${port}`);
});

function shutDown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutDown);
process.on("SIGTERM", shutDown);
