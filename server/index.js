import express from "express";
import { database } from "./database.js";
import { accountTypes, transactionFilters, validateTransaction } from "./transactions.js";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/categories", (_request, response) => {
  const categories = database.prepare("SELECT id, name, kind, color FROM categories ORDER BY name").all();
  response.json(categories);
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
