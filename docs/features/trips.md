# Trips (cross-feature hub)

The unified trip view: plan a trip, see its money, budget, insurance and family context, pay from the trip pot, and close it.

**Routes:** `/trips/$tripId`; `TripPay` renders at `/pay/?tripId=`.
**Service:** `WeTrip_Trip_Composite` → `/api/trip` → `/rest/Trip`.
**Code:** `src/features/trips/`.

## Screens

| Route            | Screen                                                                                      | Access                   |
| ---------------- | ------------------------------------------------------------------------------------------- | ------------------------ |
| `/trips/$tripId` | `TripHub`: Money, Budget, Insurance, Family cards; close for parents; pay link for children | Signed in, family member |
| `/pay/?tripId=`  | `TripPay`: QR scan → `PayOnTrip`                                                            | Signed in child          |

`TripHub` makes one `GetTripOverview` call. It does not use the SmartFX-only `TripDetail` screen; that one is for locks/rates.

## Backend contract

Headers: `X-Contacts-Key` + `X-Session-Token`. Caller role is derived server-side.

| Method | Endpoint                  | Purpose                                                                                                      |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| POST   | `PlanTrip`                | Parent-only: derive child from link, open foreign wallet, create trip, set category budgets                  |
| GET    | `GetTripOverview?TripId=` | `{Trip, Locks, Spends, SpentForeign, RemainingForeign, LockedRate, HasBudget, Budget, Policies, CallerRole}` |
| POST   | `AddFixedCost`            | Parent-only, open trip: one fixed cost as a Budget expense (SourceId 5)                                      |
| POST   | `PayOnTrip`               | Child-only: one SGD transfer at the locked rate                                                              |
| POST   | `CloseTrip?TripId=`       | Parent-only: spot valuation, mark `Completed`                                                                |

### `PlanTrip`

Request (PascalCase): `FamilyLinkId`, `Destination`, `Currency`, `TripStartDate`, `TripEndDate`, `TargetBudgetSgd`, `TargetRate`, `AutoLockEnabled`, `Budgets[]` of `{CategoryId, LimitAmount}`, `FixedCosts[]` of `{Name, CategoryId, AmountSgd}` (max 10, always sent, `[]` when none).

Returns a trip with `Id`, `Status: 'Watching'`, `ForeignAccountId`, `ParentAccountId`, `ChildCustomerId`, `FixedCostsFailed` (count of fixed costs that were not saved; the trip exists regardless). Child tokens are refused. The new-trip form hands `FixedCostsFailed` to the trip page in router state and the page shows "1 fixed cost wasn't saved. Add it on the budget page."

### Fixed costs

A fixed cost is a Budget expense with `SourceId` 5, so it uses up its category's limit like any spend and stays inside `TotalSpent` and `TotalRemaining`. The form blocks Plan trip when one category's fixed costs exceed its limit; a category with no limit set is not checked.

`AddFixedCost` body: `TripId`, `Name`, `CategoryId`, `AmountSgd`, `RequestId`. The budget page keeps one `RequestId` per attempt: a resend after a lost reply reuses it, an edited cost gets a new one. `GetTripOverview.Budget.FixedSgd` feeds the Budget card's "SGD 300.00 fixed". Editing or removing fixed costs is not built; the Budget ledger is append-only.

### `PayOnTrip`

Request: `TripId`, `MerchantCode`, `Amount` (trip currency), `CategoryId`, `RequestId`, `Narrative`.

Returns `status` (`Paid` / `Declined` / `Duplicate`), `transactionId`, `amount`, `currency`, `sgdCharged`, `remainingForeign`, `ledgerPending`, message.

- Requires a locked pot.
- **Idempotent by `RequestId`**; a repeat returns `Duplicate` and the UI shows "Already paid".
- An oversized amount returns `Declined`; no payment is attempted.
- One SGD transfer at the trip's locked rate; writes `TripSpend` and a Budget expense.
- `ledgerPending` may be true even when `Paid`.
- Never retried. `retry: false`; a lost reply is treated as "may have completed".

### `CloseTrip`

No body; `?TripId=`. Values leftover foreign at the **server** spot rate. The reply carries top-level `ReturnedForeign`, `ReturnedSgd`, `SpotRate`, `SavedVsSpotSgd` and sets `Trip.Status = 'Completed'`. No money moves because sandbox forwards never settle. A second close is refused.

## Query keys

| Key                                                              | Data                                              |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| `['trip','overview', String(tripId)]`                            | `GetTripOverview`                                 |
| `['fx']`, `['family']`, `['budget','dashboard', String(tripId)]` | Cross-feature data refreshed after trip mutations |

`PlanTrip` and `CloseTrip` invalidate trip, FX, family and the trip budget on success. `PayOnTrip` invalidates them in `onSettled`, so a failed or lost call still refreshes what the bank may have changed.

## Flow

1. Parent plans the trip (`PlanTrip`); the composite opens the foreign wallet and writes budget rows.
2. Parent locks through SmartFX `LockNow` on `/fx/trips/$tripId`; see [fx.md](fx.md).
3. Child scans a merchant QR at `/pay?tripId=`, reviews the preview and pays (`PayOnTrip`).
4. Parent reviews the hub and closes (`CloseTrip`).

## Domain rules

- Only an Active family link can own a trip.
- The parent funds; the child spends. Role checks are server-side (`PlanTrip`/`CloseTrip` refuse children, `PayOnTrip` refuses parents, strangers are refused by the overview).
- The pot is a ledger: `remainingForeign = LockedForeign − Σ TripSpend.Amount`.
- `Amount` is in the trip currency; the bank transfer is SGD at the trip's blended locked rate.
- Insurance policies appear in the overview when linked by `TripId`; older policies are matched by date overlap in `trip.js`.

## Components and helpers

`TripHub`, `TripPay`, and pure helpers in `trip.js`: `parseMerchantQr` (JSON `{merchantCode, amount, currency}`), `policiesCovering`, `foreignSpent`, `COUNTRY_BY_CURRENCY`. `TripPay` reuses `PayLayout` and `QrScanner` from Scan-to-Pay; its preview and result panels are its own.

## Tests

- `tests/trip-hub.spec.js` — overview read by trip id, sections, policies, close confirmation, role handling, signed-out state, the Budget card's fixed line.
- `tests/new-trip.spec.js` — the new-trip form: fixed-cost rows, the over-limit rules, the `PlanTrip` body, the "not saved" notice on the trip page.
- `tests/trip-pay.spec.js` — payload with one `RequestId`, open amount, decline form, invalid QR.
- `tests/trips.spec.js` — pure date/trip helpers.
- `bun run test:trip` — live Trip composite contract; moves sandbox money.

## Known issues

- Sandbox forwards never settle; the pot is a ledger and `CloseTrip` only values it.
- Trips created before `PlanTrip` existed lack `ParentAccountId`/`ForeignAccountId`, so their locks cannot book contracts.
- `TripPay` has no route of its own; without `?tripId=` it falls through to the wallet scanner.
- The hub's family card calls both `GetChildren` and `GetChildDashboard`; one role-specific call may fail silently.
- Budget and insurance rows can outlive a closed trip; there is no cascade.
- The `Duplicate` "Already paid" banner is implemented but not covered by the Playwright suite.

Back to [architecture](../ARCHITECTURE.md) · [feature index](README.md)
