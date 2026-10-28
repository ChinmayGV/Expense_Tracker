import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = dirname(fileURLToPath(import.meta.url));
const databasePath = resolve(
  process.env.DATABASE_PATH ?? `${serverDirectory}/data/expense-tracker.sqlite`,
);

mkdirSync(dirname(databasePath), { recursive: true });

export const database = new Database(databasePath);
database.pragma("foreign_keys = ON");
database.pragma("journal_mode = WAL");

database.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense', 'transfer', 'both')),
    color TEXT NOT NULL DEFAULT '#64748b',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'upi', 'credit_card', 'debit_card', 'other')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY,
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    occurred_at TEXT NOT NULL,
    description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 120),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    payment_method TEXT NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    target_account_id INTEGER REFERENCES accounts(id),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((type = 'transfer' AND target_account_id IS NOT NULL AND target_account_id != account_id)
      OR (type != 'transfer' AND target_account_id IS NULL))
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY,
    month TEXT NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
    category_id INTEGER REFERENCES categories(id),
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(month, category_id)
  );

  CREATE TABLE IF NOT EXISTS import_batches (
    id INTEGER PRIMARY KEY,
    source_name TEXT NOT NULL,
    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    row_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions(occurred_at);
  CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
  CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
`);

const insertCategory = database.prepare(
  "INSERT OR IGNORE INTO categories (name, kind, color) VALUES (?, ?, ?)",
);
const insertDefaults = database.transaction(() => {
  const categories = [
    ["Food and dining", "expense", "#f97316"],
    ["Groceries", "expense", "#22c55e"],
    ["Transportation", "expense", "#3b82f6"],
    ["Fuel", "expense", "#eab308"],
    ["Shopping", "expense", "#a855f7"],
    ["Rent", "expense", "#ec4899"],
    ["Utilities", "expense", "#14b8a6"],
    ["Entertainment", "expense", "#8b5cf6"],
    ["Health", "expense", "#ef4444"],
    ["Travel", "expense", "#06b6d4"],
    ["Education", "expense", "#6366f1"],
    ["Subscriptions", "expense", "#d946ef"],
    ["Salary and other income", "income", "#16a34a"],
    ["Transfers", "transfer", "#64748b"],
    ["Other", "both", "#64748b"],
  ];
  for (const category of categories) insertCategory.run(...category);

  database
    .prepare("INSERT OR IGNORE INTO accounts (name, type) VALUES (?, ?)")
    .run("Cash", "cash");
});
insertDefaults();
