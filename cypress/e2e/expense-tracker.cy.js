const apiUrl = "http://127.0.0.1:3001";

function addTransaction({ description, amount, type = "expense", category, targetAccount }) {
  cy.contains("button", "Add transaction").should("not.be.disabled").click();
  cy.get(".expense-dialog").should("be.visible");
  if (type !== "expense") cy.get(".type-option").contains(new RegExp(type, "i")).click();
  cy.get('input[placeholder="e.g. Dinner with friends"]').type(description);
  cy.get(".amount-input input").clear().type(String(amount));
  cy.contains("label", "Category").find("select").select(category);
  if (targetAccount) cy.contains("label", "Move to").find("select").select(targetAccount);
  cy.get(".expense-dialog button[type=submit]").click();
  cy.get(".expense-dialog").should("not.exist");
}

function openTransactions() {
  cy.contains(".nav-link", "Transactions").click();
  cy.get(".transaction-list").should("exist");
}

describe("Paisawise personal expense tracker", () => {
  beforeEach(() => {
    cy.request("POST", `${apiUrl}/api/test/reset`).its("status").should("eq", 200);
    cy.visit("/");
    cy.clearLocalStorage();
    cy.window().then((window) => window.localStorage.setItem("expense-theme", "light"));
    cy.reload();
    cy.get(".loading-card").should("not.exist");
  });

  it("loads the application with an honest empty state", () => {
    cy.contains("h1", "Good to see you").should("be.visible");
    cy.contains("No transactions in this period yet").should("be.visible");
  });

  it("creates an expense and shows the saved INR amount", () => {
    addTransaction({ description: "Coffee", amount: "42.50", category: "Food and dining" });
    cy.contains("Coffee").should("be.visible");
    cy.contains("₹42.50").should("be.visible");
  });

  it("edits a saved transaction", () => {
    addTransaction({ description: "Lunch", amount: "180", category: "Food and dining" });
    openTransactions();
    cy.get('[aria-label="Edit Lunch"]').click();
    cy.get(".amount-input input").clear().type("210.75");
    cy.get(".expense-dialog button[type=submit]").click();
    cy.get(".expense-dialog").should("not.exist");
    cy.contains("₹210.75").should("be.visible");
  });

  it("requires confirmation before deleting a transaction", () => {
    addTransaction({ description: "Bus fare", amount: "35", category: "Transportation" });
    openTransactions();
    cy.get('[aria-label="Delete Bus fare"]').click();
    cy.get(".row-confirm").should("contain", "Delete?");
    cy.get(".row-confirm").contains("button", "Yes").click();
    cy.contains("Bus fare").should("not.exist");
  });

  it("searches and filters the transaction list", () => {
    addTransaction({ description: "Coffee", amount: "40", category: "Food and dining" });
    addTransaction({ description: "Taxi", amount: "250", category: "Transportation" });
    openTransactions();
    cy.get('input[aria-label="Search transactions"]').type("Coffee");
    cy.get(".transaction-row").should("have.length", 1).and("contain", "Coffee");
    cy.get('input[aria-label="Search transactions"]').clear();
    cy.get(".filter-card select").eq(0).select("Transportation");
    cy.get(".transaction-row").should("have.length", 1).and("contain", "Taxi");
    cy.get(".filter-card select").eq(1).select("income");
    cy.contains("No transactions found").should("be.visible");
  });

  it("updates dashboard income and expense totals from saved records", () => {
    addTransaction({ description: "Salary", amount: "5000", type: "income", category: "Salary and other income" });
    addTransaction({ description: "Groceries", amount: "125.75", category: "Groceries" });
    cy.contains(".summary-card", "Total income").should("contain", "₹5,000.00");
    cy.contains(".summary-card", "Total expenses").should("contain", "₹125.75");
    cy.contains(".summary-card", "Monthly savings").should("contain", "₹4,874.25");
  });

  it("calculates an overall budget from saved expenses", () => {
    addTransaction({ description: "Groceries", amount: "75", category: "Groceries" });
    cy.contains(".nav-link", "Budgets").click();
    cy.contains("label", "Budget amount").find("input").type("100");
    cy.contains("button", "Save budget").click();
    cy.get(".budget-spent").should("contain", "₹75.00").and("contain", "₹100.00");
    cy.contains("75%").should("be.visible");
  });

  it("previews valid, duplicate, and invalid CSV rows before import", () => {
    cy.contains(".nav-link", "Import").click();
    cy.get('input[type="file"]').selectFile("cypress/fixtures/transactions.csv");
    cy.contains("Review import").should("be.visible");
    cy.contains("1 ready").should("be.visible");
    cy.contains("1 likely duplicates").should("be.visible");
    cy.contains("1 need attention").should("be.visible");
    cy.get(".import-table").should("contain", "Amount must be positive");
    cy.contains("button", "Confirm and import 1 transaction").click();
    cy.contains("Transactions imported.").should("be.visible");
    cy.request(`${apiUrl}/api/transactions`).its("body").should("have.length", 1);
  });

  it("recognizes duplicates when the same file is imported again", () => {
    cy.contains(".nav-link", "Import").click();
    cy.get('input[type="file"]').selectFile("cypress/fixtures/transactions.csv");
    cy.contains("button", "Confirm and import 1 transaction").click();
    cy.contains("Transactions imported.").should("be.visible");
    cy.contains("button", "Clear preview").click();
    cy.get('input[type="file"]').selectFile("cypress/fixtures/transactions.csv");
    cy.contains("2 likely duplicates").should("be.visible");
    cy.get(".import-confirm-row button").should("be.disabled");
  });

  it("keeps transfers out of income and expense totals", () => {
    cy.contains(".nav-link", "Settings").click();
    cy.get('input[placeholder="e.g. SBI savings"]').type("Savings");
    cy.contains("button", "Add account").click();
    cy.contains(".nav-link", "Dashboard").click();
    addTransaction({ description: "Salary", amount: "20000", type: "income", category: "Salary and other income" });
    addTransaction({ description: "Move savings", amount: "5000", type: "transfer", category: "Transfers", targetAccount: "Savings" });
    cy.contains(".summary-card", "Total income").should("contain", "₹20,000.00");
    cy.contains(".summary-card", "Total expenses").should("contain", "₹0.00");
    cy.contains(".summary-card", "Net balance").should("contain", "₹20,000.00");
  });

  it("persists transactions after reloading the page", () => {
    addTransaction({ description: "Reload proof", amount: "67.25", category: "Other" });
    cy.reload();
    cy.contains("Reload proof").should("be.visible");
    cy.contains("₹67.25").should("be.visible");
  });

  it("shows accessible field errors for invalid input", () => {
    cy.contains("button", "Add transaction").click();
    cy.get(".amount-input input").type("0");
    cy.get(".expense-dialog button[type=submit]").click();
    cy.get("#description-error").should("be.visible");
    cy.get("#amount-error").should("be.visible");
    cy.request(`${apiUrl}/api/transactions`).its("body").should("have.length", 0);
  });
});
