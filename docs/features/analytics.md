# Analytics (insights)

An internal page that answers the product's core claim: does locking a rate actually save families money? A nightly ETL copies trip activity into a read-only data mart; the page shows the aggregates.

**Routes:** `/insights` (by URL only; not in the nav, no footer link).
**Service:** `WeTrip_Analytics_Composite` → `/api/analytics` → `/rest/Analytics`.
**Code:** `src/features/analytics/`.

The data mart is **not a system of record**: nothing reads it to move money, and it only holds copies. The page shows **aggregates only**, never customer ids, names or account numbers. All figures cover all time (no period picker), and months are SGT.

## Backend contract

Headers: `X-Contacts-Key` + `X-Session-Token` (any signed-in customer). Responses are `decap`ed.

| Method | Endpoint      | Purpose                                                                                                                            |
| ------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `RunEtlNow`   | Wakes the ETL timer and returns at once `{EtlRunId, Status: "Running", StartedOn}`; a run under 10 minutes old is returned instead |
| GET    | `GetInsights` | `{LastRun, LastSuccessOn, SpendSgd, SavedVsSpotSgd, TripsCount, OverBudgetTripPct, ByCurrencyMonth[], ByCategory[], Bnpl}`         |

`LastRun` is `{EtlRunId, Status (Running/Success/Failed), RowsExtracted, RowsLoaded, RowsRejected, StartedOn, FinishedOn, Error}`. `ByCurrencyMonth[]` is `{Currency, Month, SpendSgd, SavedVsSpotSgd}`, `ByCategory[]` is `{Category, SpendSgd}` and `Bnpl` is `{Plans, PrincipalSgd}`. `SavedVsSpotSgd` is positive when locking saved money. `OverBudgetTripPct` is null when no completed trip has a budget.

## Screen

`Insights` shows:

- the headline "Locking saved families SGD x", or "Locking cost families SGD x" when the total is negative;
- spend and saved vs spot by currency and month, spend by category, the share of completed trips over budget, pay-later plans and principal;
- "Last updated" with the rows loaded by the latest successful run;
- a banner with the run's error when the latest run `Failed` (the numbers still show);
- "No data yet. Refresh to load trip activity." and no tables when the mart is empty.

"Refresh data" calls `RunEtlNow` once and is never retried. While the run is `Running` the button is disabled and reads "Refreshing…", and `GetInsights` is polled every 3 s; when the run ends a status line shows its extracted, loaded and rejected counts.

## Query keys

`['analytics', 'insights']`. `useRunEtlNow` invalidates it on success.

## Tests

`tests/analytics.spec.js` (mocked): headline sign, empty state, failed-run banner, refresh with polling, error banner, signed out. The live ETL check belongs with the backend (`scripts/test-analytics.mjs`).
