# EliteBudget Pro Ultimate

EliteBudget Pro Ultimate is a complete offline-first personal budgeting, bills, accounting, savings, debt, risk analysis, reporting, and financial dashboard web application.

## How to run

1. Open `index.html` in any modern browser.
2. No installation is required.
3. No internet is required.
4. Your data is stored locally in your browser using `localStorage`.

## Included files

- `index.html` — application structure and screens
- `style.css` — premium responsive dashboard design, light/dark mode, glassmorphism UI
- `script.js` — finance engine, local database, forms, charts, reports, import/export
- `README.md` — setup and usage instructions

## Main features

- Dashboard with live KPIs
- Income/paycheck calculator
- Expense tracker
- Bill manager with paid/unpaid status
- Transaction center
- Budget generator
- Savings goals
- Debt payoff planner
- Risk/reward calculator
- Accounting statements and journal entries
- Reports and forecasts
- Local PIN lock
- JSON backup and restore
- CSV transaction import/export
- Light and dark mode
- Responsive mobile layout

## Privacy

This app is offline-first. It does not send financial data anywhere. All data stays inside the browser on the device where the app is opened.

## Important note

This is a local financial planning tool, not licensed financial advice. Use the calculations as decision support only.


## Blank Start Version

This version starts with completely blank user data. There are no sample transactions, income records, expenses, bills, accounts, debts, savings goals, risk records, or journal entries.

To clear old browser data after upgrading from an older sample-data version:

1. Open the app.
2. Go to **Settings**.
3. Click **Clear All Data**.
4. Refresh the page.

New users can then add their own financial information from scratch.

## Pay Calendar Update

This version calculates recurring bi-weekly / fortnightly income from the user's actual next payday instead of using a fixed monthly multiplier.

Example:
- Amount: J$55,000
- Frequency: biweekly / fortnightly
- Next Pay Date: 2026-07-10

The app will show:
- July 2026: J$110,000
- October 2026: J$165,000 because it has three paydays
- Next 12 months: J$1,430,000

If old browser data still appears, use Settings -> Clear All Data and enter income again.

## Balance Engine Update
The dashboard Current Balance now uses a connected monthly balance formula:

Monthly Plan Income - Total Monthly Outflow = Current Balance

Total Monthly Outflow includes expenses, transaction spending, paid bills, savings, debt payments, and investments. Bills only reduce the balance after they are marked paid. Unpaid bills remain in Bills Due.

## Connected Expense/Bill Balance Update

This version uses one dashboard balance formula:

Current Balance = Monthly Plan Income + Transaction Income - Expense Tab Deductions - Paid Bills - Other Transaction Outflows

Expense entries now deduct from Current Balance immediately. Bills do not deduct when created; they deduct only after Mark Paid is clicked. Expense frequency is supported so weekly, fortnightly, monthly, quarterly, yearly, and one-time expenses convert correctly for the current month.


## Automatic Ledger Architecture Update

This version prevents duplicate income and expense entry.

Recommended workflow:

1. Add recurring salary or business income in the **Income** tab.
2. Add normal spending in the **Expenses** tab.
3. Add scheduled obligations in the **Bills** tab.
4. Click **Mark Paid** on a bill only when it is actually paid.
5. Use **Transactions** mainly as the automatic ledger. The manual transaction button is for unusual money movement only, such as refunds, one-time deposits, corrections, transfers, investments, savings, or debt payments.

Automatic ledger behavior:

- Income records generate automatic income ledger entries for paydays in the current month.
- Expense records generate automatic expense ledger entries.
- Paid bills generate automatic bill-payment ledger entries.
- The dashboard does not double count these automatic ledger entries. It calculates income, expenses, and paid bills from the master tabs and only adds manual transactions separately.

This keeps Dashboard, Income, Expenses, Bills, Transactions, Reports, Budget, and Charts synchronized from one financial engine.

## Debt Payment Workflow Update

The Debt Center now includes a **Make Payment** action for each debt. Debt balances should not be manually reduced after payments. Instead, click **Make Payment**, enter the amount/date/method, and the app will:

- reduce the debt's remaining balance,
- create a debt-payment transaction in the ledger,
- deduct the payment from Current Balance,
- update Dashboard, Reports, Charts, and Debt Progress,
- keep payment history for audit tracking.

## Offline Multi-User + PWA Update

This version includes offline multi-user support for one shared device.

### Multi-user behavior

- Each user creates a local account with a name and PIN.
- Each user has separate saved data for income, expenses, bills, transactions, savings, debts, risk entries, reports, and settings.
- Users can switch accounts from the top bar using the switch-user button.
- Data is stored locally in the browser using user-specific storage keys.
- Users should export a JSON backup before clearing browser data or moving to another device.

### PWA behavior

This version includes:

- `manifest.json`
- `service-worker.js`
- App icons
- Install button support where the browser allows it
- Offline cache support after the first successful load from a web server or GitHub Pages

Important: service workers do not run from a normal `file://` double-click in some browsers. For full PWA install/offline-update behavior, upload the folder to GitHub Pages or run it from a local web server.

### GitHub Pages update behavior

If users open the GitHub Pages website, they will receive code updates when the site refreshes and the service worker updates its cache. Their financial data remains local to their browser/device.

If users download the ZIP, they must download a new ZIP manually to receive app updates.

### Layout density fix

The default layout has been scaled down for normal browser zoom. Chrome/Brave at 100% should no longer feel as close as the earlier version.
