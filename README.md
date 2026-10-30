# Paisawise Expense Tracker

A local-first personal finance app for recording income, expenses, and transfers in
Indian rupees. Financial records are stored in a local SQLite database, and the
theme preference stays in browser storage. The app does not require an account
or send financial data to a hosted service.

## Features

- Dashboard totals, monthly savings, recent activity, spending trends, category
  breakdowns, and budget progress.
- Create, edit, inspect, search, filter, sort, and delete transactions.
- Manage categories, accounts, and monthly overall or category budgets.
- Import CSV files with a row-by-row preview, validation, and duplicate checks;
  export the transactions matching the current filters.
- Light and dark themes.

## Requirements

- Node.js 20, or Node.js 22 and newer.
- npm.

## Run locally

Install the dependencies:

```sh
npm install
```

Start the API in one terminal:

```sh
npm run server
```

Start Vite in another terminal:

```sh
npm run dev
```

Open the local URL printed by Vite. The frontend proxies `/api` requests to the
API at `http://127.0.0.1:3001`.

The API creates `server/data/expense-tracker.sqlite` automatically. To change
the database path, copy `.env.example` to `.env` and edit `DATABASE_PATH`. The
development proxy expects the API on port 3001. Keep the database file private;
it contains your financial records.

## CSV import and export

The importer accepts a CSV with these required columns:

```text
description,amount,type,occurred_at,category
```

`type` must be `expense`, `income`, or `transfer`. Amounts must be positive and
have at most two decimal places. Dates should be ISO 8601 values. The optional
columns are `payment_method`, `account`, `target_account`, and `notes`. Category
and account names must match entries in the app. Imports are limited to 500 data
rows and 1 MB per file. The export button downloads the currently filtered
transactions as CSV.

## End-to-end checks

Start the test API and frontend in separate terminals:

```sh
npm run server:test
npm run dev
```

Then run the Cypress workflows in a third terminal:

```sh
npm run cypress:run
```

To open the Cypress runner interactively, use `npm run cypress:open`. The test
API uses `server/data/cypress.sqlite`, separate from your regular database, and
provides a reset route only while running in test mode. Do not use the test API
for personal data.

## Production build

```sh
npm run build
npm run preview
```

The preview server serves the static frontend. A production deployment also
needs an HTTP reverse proxy that routes `/api` requests to the Express API.
