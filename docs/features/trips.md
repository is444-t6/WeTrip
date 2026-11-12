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
| POST   | `PayOnTrip`               | Child-only: one SGD transfer at the locked rate                                                              |
| POST   | `PayLaterOnTrip`          | Child-only: BNPL plan billed by the bank; not from the trip pot (proposed contract, issue #34)               |
| POST   | `CloseTrip?TripId=`       | Parent-only: spot valuation, mark `Completed`                                                                |

### `PlanTrip`

Request (PascalCase): `FamilyLinkId`, `Destination`, `Currency`, `TripStartDate`, `TripEndDate`, `TargetBudgetSgd`, `TargetRate`, `AutoLockEnabled`, `Budgets[]` of `{CategoryId, LimitAmount}`.

Returns a trip with `Id`, `Status: 'Watching'`, `ForeignAccountId`, `ParentAccountId`, `ChildCustomerId`. Child tokens are refused.

### `PayOnTrip`

Request: `TripId`, `MerchantCode`, `Amount` (trip currency), `CategoryId`, `RequestId`, `Narrative`.

Returns `status` (`Paid` / `Declined` / `Duplicate`), `transactionId`, `amount`, `currency`, `sgdCharged`, `remainingForeign`, `ledgerPending`, message.

- Requires a locked pot.
- **Idempotent by `RequestId`**; a repeat returns `Duplicate` and the UI shows "Already paid".
- An oversized amount returns `Declined`; no payment is attempted.
- One SGD transfer at the trip's locked rate; writes `TripSpend` and a Budget expense.
- `ledgerPending` may be true even when `Paid`.
- Never retried. `retry: false`; a lost reply is treated as "may have completed".

### `PayLaterOnTrip`

Proposed contract (frontend built against it, backend pending). Request: `TripId`, `QrText` (the scanned string as-is), `Amount`, `NumberOfMonths`, `CategoryId`, `RequestId`. Returns `Status`, `Principal`, `Currency`, `NumberOfMonths`, `MonthlyInstallment`, `TotalInterest`, `FirstRepaymentDate`, `MaturityDate`, `LedgerPending`.

- `TripPay` previews the QR with Scan-to-Pay `PreviewPayment` (`CustomerId` = session customer) for `bnplEligible` / `bnplOptions[]`. The preview never blocks Pay from trip; a failed preview just shows no options. Open-amount QRs are not previewed.
- Creates no `TripSpend`, leaves `remainingForeign` unchanged. A 4xx `Errors[0]` shows in a banner and the form stays.
- Same `retry: false` and lost-reply lockout as `PayOnTrip`. `GetTripOverview` may carry `BnplPlans[]` (`MerchantName`, `NumberOfMonths`, `MonthlyInstallment`, `FirstRepaymentDate`, `MaturityDate`, optional `Currency`), listed in the hub's "Pay later" card.

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
- Insurance policies appear in the overview when linked by `TripId`; older policies without one do not count as cover on the trip page.

## Components and helpers

`TripHub`, `TripPay`, and pure helpers in `trip.js`: `parseMerchantQr` (JSON `{merchantCode, amount, currency}`), `foreignSpent`, `COUNTRY_BY_CURRENCY`. `TripPay` reuses `PayLayout` and `QrScanner` from Scan-to-Pay; its preview and result panels are its own.

## Tests

- `tests/trip-hub.spec.js` — overview read by trip id, sections, policies, close confirmation, role handling, signed-out state, Pay later plans card.
- `tests/trip-pay.spec.js` — payload with one `RequestId`, open amount, decline form, invalid QR; pay later (options, ineligible, preview failure, confirmation, 4xx, lost reply). Mocks `/scantopay/` too.
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
