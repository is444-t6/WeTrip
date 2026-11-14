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

`LastRun` is `{EtlRunId, Status (Running/Success/Failed), RowsExtracted, RowsLoaded, RowsRejected, StartedOn, FinishedOn, Error}`. `ByCurrencyMonth[]` is `{Currency, Month, SpendSgd, SavedVsSpotSgd}`, `ByCategory[]` is `{Category, SpendSgd}` and `Bnpl` is `{Plans, PrincipalSgd}`. `SavedVsSpotSgd` is positive when locking saved money. `OverBudgetTripPct` is 0–100. OutSystems cannot send null, so `OverBudgetEligibleTrips` (completed trips that have category limits) says whether it means anything: the page shows "—" when it is 0. `LastRun` also carries `RowsInserted` (new `SourceKey`s) and `Watermark`; an empty `LastSuccessOn` arrives as `1900-01-01`.

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

`tests/analytics.spec.js` (mocked): headline sign, empty state, failed-run banner, refresh with polling, error banner, signed out. Live: `bun run test:analytics` runs the ETL twice and checks the second run inserts nothing, the totals do not move, `Extracted = Loaded + Rejected`, and the response carries no customer ids. It writes only to the data mart.

## Backend (OutSystems)

Course mapping: Session 9 (EDW) and Lab 7 (ETL). OutSystems is not an ETL tool; like the lab, this mimics ETL with a **timer** (no BPT process).

| Module                       | Owns / does                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WeTrip_Analytics_Atomic`    | Tables: staging (`StgTrip`, `StgTripBudget`, `StgTripSpend`, `StgExpense`, `StgBnplPlan`), `EtlRun`, `DailyRate` (unique on date + currency), `FactTripSpend` (unique `SourceKey`), `FactBnplPlan` (unique `SourceKey`), `FactTrip` (unique `TripId`). REST `AnalyticsData`: `GetRunState`, `SaveRun`, `LoadRun`, `GetInsights`. |
| `WeTrip_Analytics_Composite` | Timer `EtlNightly` (02:00 SGT), server actions `StartRun` and `RunEtl`, REST `Analytics` (`RunEtlNow`, `GetInsights`). Calls only atomics and SMUtBank MarketData. Site properties: `WETRIP_SERVER_KEY`, `SMUtBankAuthHeader`, `ScrubDestinationPrefixes`.                                                                       |

New read-only extract endpoints on the source atomics: `SmartFXData.GetAllTrips` and `GetSpendsSince?Since=` (SmartFX atomic), `BudgetAPI.GetExpensesSince?Since=` and `GetTripBudgetTotals` (Budget atomic), `QRPaymentRecords.GetBnplPlansSince?Since=` (ScanToPay atomic).

**One run (`RunEtl`):**

1. `StartRun`: a `Running` run under 10 minutes old is reused (that is the one `RunEtlNow` created); an older one is marked `Failed` ("Timed out"); otherwise a new `Running` row is written.
2. **Extract.** Static: every trip, plus per-trip budget totals. Incremental: spends (`TripSpend.CreatedAt`), expenses (`Expense.CreatedOn`) and plans (`BNPLPlan.CreatedOn`) created since the last successful run's watermark minus 5 minutes. Plus today's **raw** MarketData spot for USD, EUR, JPY, GBP and CHF (`base=SGD`, so foreign per SGD; no `DemoRateShiftPct`). The source JSON is passed through as text.
3. **Load into staging, scrub, transform, load** happen in one atomic call (`LoadRun`), as one transaction: `OPENJSON` copies the extracts into the staging tables; test trips (destination prefix in `ScrubDestinationPrefixes`, default `Trip harness;E2E;Deploy check;Prod verify`) and their rows, wallet plans (`TripId = 0`), non-positive amounts and duplicate keys are rejected; facts are upserted (`MERGE`) by `SourceKey` / `TripId`; `DailyRate` is refreshed for today; staging is emptied.
4. The run is saved `Success` with `RowsExtracted`, `RowsLoaded`, `RowsRejected`, `RowsInserted` and `Watermark = StartedOn`. On any error it is saved `Failed` with the message; the watermark does not move and the transaction leaves no staging rows.

**Transform rules:** `TripSpend` → `spend:<Id>`, channel `QR`, `SgdAtLocked = SgdEquivalent`. Budget expenses → `expense:<Id>` with channel by `SourceId` (1 Manual, 3 Receipt, 4 Bank, 5 Fixed, 2 with a `bnpl:` `BankTransactionId` → BNPL); `SourceId 2` without `bnpl:` is the pot spend already loaded from `TripSpend`, so it is skipped and **counted as rejected** (that keeps `Extracted = Loaded + Rejected`). Category ids map to the names in `src/features/budget/constants.js`. `SpentOn` is the SGT date of `TripSpend.CreatedAt` or `Expense.ExpenseDate`. QR spends: `SgdAtSpot = ROUND(ForeignAmount / SpotRate, 2)` using the nearest earlier `DailyRate`, `SavedVsSpotSgd = SgdAtSpot − SgdAtLocked`; with no earlier rate `HasSpotRate = 0` and the row counts in spend but not savings. `FactBnplPlan.PrincipalSgd` = the matching `bnpl:<RequestId>` expense, else principal × locked SGD / locked foreign. `FactTrip.OverBudget` = Σ expenses > Σ category limits (Budget atomic); `HasLimits = 0` stands in for null.

**Deliberate simplifications:**

- **Denormalised star schema.** Trip attributes (currency, destination) are copied onto each fact row instead of separate dimension tables (slides 20–24).
- **The transform runs as set-based SQL inside the atomic** (ELT). OutSystems flows would need a loop per row and per mapping, and the atomic owns both staging and facts. The composite still owns the run: the 10-minute rule, the watermark, the timer and the Failed path.
- Nullable measures are flags (`HasSpotRate`, `HasLimits`) because OutSystems decimals and booleans cannot be null.
- Times: sources serialise UTC, so SGT is UTC + 8 in SQL. The timer's `0 18 * * *` assumes the server clock is UTC.
