# Trips (cross-feature hub)

The unified trip view: plan a trip, see its money, budget, insurance and family context, pay from the trip pot, and close it.

**Routes:** `/trips/$tripId`; `TripPay` renders at `/pay/?tripId=`.
**Service:** `WeTrip_Trip_Composite` → `/api/trip` → `/rest/Trip`.
**Code:** `src/features/trips/`.

## Screens

| Route            | Screen                                                                                                        | Access                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `/trips/$tripId` | `TripHub`: Money, Budget, Insurance, Family cards; close for parents; pay link and Add a receipt for children | Signed in, family member |
| `/pay/?tripId=`  | `TripPay`: QR scan → `PayOnTrip`                                                                              | Signed in child          |

`TripHub` makes one `GetTripOverview` call. It does not use the SmartFX-only `TripDetail` screen; that one is for locks/rates.

## Backend contract

Headers: `X-Contacts-Key` + `X-Session-Token`. Caller role is derived server-side.

| Method | Endpoint                  | Purpose                                                                                                      |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| POST   | `PlanTrip`                | Parent-only: derive child from link, open foreign wallet, create trip, set category budgets                  |
| GET    | `GetTripOverview?TripId=` | `{Trip, Locks, Spends, SpentForeign, RemainingForeign, LockedRate, HasBudget, Budget, Policies, CallerRole}` |
| POST   | `PayOnTrip`               | Child-only: one SGD transfer at the locked rate                                                              |
| POST   | `CloseTrip?TripId=`       | Parent-only: spot valuation, mark `Completed`                                                                |
| POST   | `AddReceipt`              | Child-only: record a cash receipt as a budget expense; moves no money                                        |
| GET    | `GetReceipt?ReceiptId=`   | `{ContentType, ImageBase64}`; family members only                                                            |

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

### `AddReceipt` and `GetReceipt`

There is no OCR: the child types the amount. `ReceiptForm` (child, trip not Completed or Cancelled) sends `TripId`, `Amount`, `Currency` (the trip's or `SGD`), `CategoryId`, `RequestId` and, if a photo was picked, `ImageBase64` + `ContentType`. Returns `{ExpenseId, AmountSgd}`.

- The photo is resized in the browser (canvas, longest edge 1280 px, JPEG); over 1 MB afterwards it is refused ("That photo is too large").
- One `RequestId` per opened form, so a double submit is one POST (the server dedupes on it too).
- A receipt creates no `TripSpend`, leaves the pot unchanged and earns no miles. Non-SGD amounts convert at the trip's locked rate; with nothing locked the server answers 400 "Lock a rate first so we can convert this receipt".
- Budget expenses carry `SourceId` 3 and `ReceiptId`; `GetReceipt` serves the photo.

### `CloseTrip`

No body; `?TripId=`. Values leftover foreign at the **server** spot rate. The reply carries top-level `ReturnedForeign`, `ReturnedSgd`, `SpotRate`, `SavedVsSpotSgd` and sets `Trip.Status = 'Completed'`. No money moves because sandbox forwards never settle. A second close is refused.

## Query keys

| Key                                                              | Data                                              |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| `['trip','overview', String(tripId)]`                            | `GetTripOverview`                                 |
| `['fx']`, `['family']`, `['budget','dashboard', String(tripId)]` | Cross-feature data refreshed after trip mutations |

`AddReceipt` invalidates the same keys on success; a receipt photo is cached under `['receipt', String(receiptId)]`. `PlanTrip` and `CloseTrip` invalidate trip, FX, family and the trip budget on success. `PayOnTrip` invalidates them in `onSettled`, so a failed or lost call still refreshes what the bank may have changed.

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

`TripHub`, `TripPay`, `ReceiptForm`, and pure helpers in `trip.js`: `parseMerchantQr` (JSON `{merchantCode, amount, currency}`), `policiesCovering`, `foreignSpent`, `COUNTRY_BY_CURRENCY`. `TripPay` reuses `PayLayout` and `QrScanner` from Scan-to-Pay; its preview and result panels are its own.

## Tests

- `tests/trip-hub.spec.js` — overview read by trip id, sections, policies, close confirmation, role handling, signed-out state.
- `tests/trip-pay.spec.js` — payload with one `RequestId`, open amount, decline form, invalid QR.
- `tests/trip-receipt.spec.js` — receipt form (fields, photo resize, validation, lock message, double submit), receipt rows and photo in the budget.
- `tests/trips.spec.js` — pure date/trip helpers.
- `bun run test:trip` — live Trip composite contract (including `AddReceipt` / `GetReceipt`); moves sandbox money.

## Known issues

- Sandbox forwards never settle; the pot is a ledger and `CloseTrip` only values it.
- Trips created before `PlanTrip` existed lack `ParentAccountId`/`ForeignAccountId`, so their locks cannot book contracts.
- `TripPay` has no route of its own; without `?tripId=` it falls through to the wallet scanner.
- The hub's family card calls both `GetChildren` and `GetChildDashboard`; one role-specific call may fail silently.
- Budget and insurance rows can outlive a closed trip; there is no cascade.
- The `Duplicate` "Already paid" banner is implemented but not covered by the Playwright suite.

Back to [architecture](../ARCHITECTURE.md) · [feature index](README.md)
