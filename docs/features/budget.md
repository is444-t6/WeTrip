# Budget

Per-trip category budgets and an expense ledger. Budget amounts are SGD even when the trip currency differs; foreign money belongs to SmartFX.

**Routes:** `/budget/`, `/budget/$tripId`.
**Service:** `WeTrip_Budget_Composite` → `/api/budget` → `/rest/BudgetComposite`.
**Code:** `src/features/budget/`.

## Screens

| Route             | Screen                                                                                                                                                                            | Access    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `/budget/`        | `BudgetHome`: trips for the active link; a parent sees every active child                                                                                                         | Signed in |
| `/budget/$tripId` | `BudgetDetail`: summary hero (fixed vs day-to-day), bars, expense list, add-expense form (everyone), set-limit and add-fixed-cost forms (parents; fixed costs only on open trips) | Signed in |

`BudgetDetail` reads the SmartFX trip only for the destination name; the budget still renders when SmartFX fails. Ended trips collapse under "Past trips" on `BudgetHome`.

## Backend contract

Request bodies and query parameters are **PascalCase**; responses pass through `decap`, though the feature's `api.js` comment says they already arrive camelCase.

| Method | Endpoint               | Purpose                                               |
| ------ | ---------------------- | ----------------------------------------------------- |
| GET    | `GetDashboard?TripId=` | Summary and expense list                              |
| POST   | `RecordSpending`       | Append an expense; returns `{hasAlert, alertMessage}` |
| POST   | `SetBudget`            | Upsert one category limit                             |

`GetDashboard` returns:

```text
Summary: { TripId, TotalLimit, TotalSpent, TotalRemaining,
           Lines: [{ CategoryId, CategoryName, LimitAmount, SpentAmount,
                     PercentUsed, AlertLevel: OK|WARNING|OVER }] }
Expenses: [{ Id, ExpenseDate, MerchantName, CategoryId, Amount, Currency, Description, SourceId }]
```

`RecordSpending` body: `TripId`, `ChildAccountId`, `CategoryId`, `Amount`, `Currency`, `MerchantName`, `Description`, `ExpenseDate`, `SourceId`, `BankTransactionId`, `ReceiptId`.

`SetBudget` body: `TripId`, `ChildAccountId`, `CategoryId`, `LimitAmount`, `Currency`.

## Categories and sources

| Id  | Category      | Id  | Source  |
| --- | ------------- | --- | ------- |
| 1   | Activities    | 1   | Manual  |
| 2   | Transport     | 2   | QR      |
| 3   | Accommodation | 3   | Receipt |
| 4   | Others        | 4   | Bank    |
| 5   | Shopping      | 5   | Fixed   |
| 6   | Food          |     |         |

`DEFAULT_CURRENCY = 'SGD'`; there is no currency picker.

## Query keys

`['budget','dashboard', String(tripId)]` for `GetDashboard`. `RecordSpending` and `SetBudget` invalidate exactly that key.

## Domain rules

- There is at most one row per category; uniqueness on `(TripId, CategoryId)` is **[inferred]**.
- `PercentUsed` drives the bar width; `AlertLevel` (`OK`/`WARNING`/`OVER`) drives the bar colour.
- `RecordSpending` returns the alert rather than throwing when a category crosses its limit.
- Budget rows and expenses reference the SmartFX `tripId` logically; this service's database has no FK to the SmartFX database.
- `PlanTrip` creates the initial category budgets in the Trip composite; the forms here edit them later.
- A **fixed cost** (hotel, flights, a rail pass) is an expense with `SourceId` 5, so it uses up its category's limit and is already inside `TotalSpent` and `TotalRemaining`. The page splits the total for display only: "Fixed" is the sum of `SourceId` 5 amounts, "Day-to-day" is `TotalSpent` minus that, and fixed rows carry a "Fixed" badge. Parents add one later through `Trip.AddFixedCost` (not `RecordSpending`) while the trip is open; children see them read-only. Editing and removing are not built.

## Files

`BudgetHome.jsx`, `BudgetDetail.jsx`, `api.js`, `queries.js`, `constants.js`, and components `BudgetBars`, `ExpenseList`, `AddExpenseForm`, `SetBudgetForm`, `AddFixedCostForm`, `FixedCostFields` (also used by the new-trip form). `BudgetShell.jsx` exists but is unused.

## Tests

- `tests/budget-mobile.spec.js` — 375 px layout, category rows, expense blocks, trip list, SmartFX-down fallback, query id, signed-out state, wide-screen table.
- `tests/trip-budget.spec.js` — fixed vs day-to-day split, "Fixed" badge, negative remaining, `AddFixedCost` body and `RequestId` reuse, read-only for the child, no form on a closed trip.
- `tests/trip-hub.spec.js` covers the trip hub's Budget card link to `/budget/$tripId` and its fixed line.

## Known issues

- Currency is a fixed SGD placeholder; the trip currency is not wired through.
- Both forms send `ChildAccountId: getSessionAccountId()` — the signed-in user, not the linked child. There is a TODO in `SetBudgetForm.jsx`; a parent's own account id is attributed.
- Expense dates are sent in UTC (`toISOString`) and displayed from the UTC string; an early-morning expense (roughly 00:00–07:59 SGT) can land on the previous UTC day. Budget has no local date filter; the local-date helpers are Family's.
- `useDashboard` is gated only on `!!tripId`, so signed-out navigation to `/budget/$tripId` still calls the API.
- `ImportBank` appears in test route matching but no UI calls it.

Back to [architecture](../ARCHITECTURE.md) · [feature index](README.md)
