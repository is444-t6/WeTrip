# Trips (cross-feature hub)

The unified trip view: plan a trip, see its money, budget, insurance and family context, pay from the trip pot, and close it.

**Routes:** `/trips/$tripId`; `TripPay` renders at `/pay/?tripId=`.
**Service:** `WeTrip_Trip_Composite` → `/api/trip` → `/rest/Trip`.
**Code:** `src/features/trips/`.

## Screens

| Route            | Screen                                                                                                        | Access                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `/trips/$tripId` | `TripHub`: Money, Budget, Insurance, Family cards; close for parents; pay link and Add a receipt for children | Signed in, family member |
| `/pay/?tripId=`  | `TripPay`: QR scan → `PayOnTrip` or `PayLaterOnTrip`                                                          | Signed in child          |

`TripHub` makes one `GetTripOverview` call. It does not use the SmartFX-only `TripDetail` screen; that one is for locks/rates.

## Backend contract

Headers: `X-Contacts-Key` + `X-Session-Token`. Caller role is derived server-side.

| Method | Endpoint                  | Purpose                                                                                                                              |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `PlanTrip`                | Parent-only: derive child from link, open foreign wallet, create trip, set category budgets                                          |
| GET    | `GetTripOverview?TripId=` | `{Trip, Locks, Spends, SpentForeign, RemainingForeign, LockedRate, HasBudget, Budget, Policies, MilesEarned, BnplPlans, CallerRole}` |
| POST   | `AddFixedCost`            | Parent-only, open trip: one fixed cost as a Budget expense (SourceId 5)                                                              |
| POST   | `PayOnTrip`               | Child-only: one SGD transfer at the locked rate                                                                                      |
| POST   | `PayLaterOnTrip`          | Child-only: BNPL plan billed by the bank to the child's wallet; not from the trip pot                                                |
| POST   | `CloseTrip?TripId=`       | Parent-only: spot valuation, mark `Completed`                                                                                        |
| POST   | `AddReceipt`              | Child-only: record a cash receipt as a budget expense; moves no money                                                                |
| GET    | `GetReceipt?ReceiptId=`   | `{ContentType, ImageBase64}`; family members only                                                                                    |
| GET    | `GetMyMiles`              | No parameters; the customer comes from `X-Session-Token`. Returns `{Balance}` (int)                                                  |
| GET    | `GetCloseOptions?TripId=` | Parent-only, open trip: leftover at spot vs the locked cost; read-only                                                               |
| GET    | `GetTripMiles?TripId=`    | `{ChildBalance}`: the trip child's miles (Loyalty ledger), readable by the parent (insurance checkout)                               |

### `PlanTrip`

Request (PascalCase): `FamilyLinkId`, `Destination`, `Currency`, `TripStartDate`, `TripEndDate`, `TargetBudgetSgd`, `TargetRate`, `AutoLockEnabled`, `Budgets[]` of `{CategoryId, LimitAmount}`, `FixedCosts[]` of `{Name, CategoryId, AmountSgd}` (max 10, always sent, `[]` when none).

Returns a trip with `Id`, `Status: 'Watching'`, `ForeignAccountId`, `ParentAccountId`, `ChildCustomerId`, `FixedCostsFailed` (count of fixed costs that were not saved; the trip exists regardless). Child tokens are refused. The new-trip form hands `FixedCostsFailed` to the trip page in router state and the page shows "1 fixed cost wasn't saved. Add it on the budget page."

### Fixed costs

A fixed cost is a Budget expense with `SourceId` 5, so it uses up its category's limit like any spend and stays inside `TotalSpent` and `TotalRemaining`. The form blocks Plan trip when one category's fixed costs exceed its limit; a category with no limit set is not checked.

`AddFixedCost` body: `TripId`, `Name`, `CategoryId`, `AmountSgd`, `RequestId`. The budget page keeps one `RequestId` per attempt: a resend after a lost reply reuses it, an edited cost gets a new one. `GetTripOverview.Budget.FixedSgd` feeds the Budget card's "SGD 300.00 fixed". Editing or removing fixed costs is not built; the Budget ledger is append-only.

### `PayOnTrip`

Request: `TripId`, `MerchantCode`, `Amount` (trip currency), `CategoryId`, `RequestId`, `Narrative`.

Returns `status` (`Paid` / `Declined` / `Duplicate`), `transactionId`, `amount`, `currency`, `sgdCharged`, `remainingForeign`, `ledgerPending`, `milesEarned`, message.

- Requires a locked pot.
- **Idempotent by `RequestId`**; a repeat returns `Duplicate` and the UI shows "Already paid".
- An oversized amount returns `Declined`; no payment is attempted.
- One SGD transfer at the trip's locked rate; writes `TripSpend` and a Budget expense.
- `ledgerPending` may be true even when `Paid`.
- Earns miles: `milesEarned = floor(round2(sgdCharged) × 10)`, 0 for `Duplicate` and `Declined`. The Paid card shows "+N miles" when it is above 0.
- Never retried. `retry: false`; a lost reply is treated as "may have completed".

### `GetMyMiles`

Child's miles balance, derived on the server from their trip spends (10 miles per SGD charged). `TripHub`'s Money card shows the overview's `MilesEarned` ("N miles earned on this trip") when it is above 0. Home's `MilesCard` reads `GetMyMiles` for children only (`['trip','miles']`, so `PayOnTrip` refreshes it); a failed read hides the card.

### `AddReceipt` and `GetReceipt`

There is no OCR: the child types the amount. `ReceiptForm` (child, trip not Completed or Cancelled) sends `TripId`, `Amount`, `Currency` (the trip's or `SGD`), `CategoryId`, `RequestId` and, if a photo was picked, `ImageBase64` + `ContentType`. Returns `{ExpenseId, AmountSgd}`.

- The photo is resized in the browser (canvas, longest edge 1280 px, JPEG); over 1 MB afterwards it is refused ("That photo is too large").
- One `RequestId` per opened form, so a double submit is one POST (the server dedupes on it too).
- A receipt creates no `TripSpend`, leaves the pot unchanged and earns no miles. Non-SGD amounts convert at the trip's locked rate; with nothing locked the server answers 400 "Lock a rate first so we can convert this receipt".
- Budget expenses carry `SourceId` 3 and `ReceiptId`; `GetReceipt` serves the photo.

### `PayLaterOnTrip`

Request: `TripId`, `MerchantCode` (from the QR), `QrText` (the scanned string, unused by the server), `Amount`, `NumberOfMonths`, `CategoryId`, `RequestId`. Returns `Status` (`Paid`, `Duplicate` or `Declined`), `Message`, `BnplPlanId`, `MerchantName`, `SgdBudgeted`, `Principal`, `Currency`, `NumberOfMonths`, `MonthlyInstallment`, `TotalInterest`, `FirstRepaymentDate`, `MaturityDate`, `LedgerPending`.

- `TripPay` previews the QR with Scan-to-Pay `PreviewPayment` (`CustomerId` = session customer) for `bnplEligible` / `bnplOptions[]`. The preview never blocks Pay from trip; a failed preview just shows no options. Open-amount QRs are not previewed.
- Creates no `TripSpend`, leaves `remainingForeign` unchanged. A 4xx `Errors[0]` shows in a banner and the form stays.
- Same `retry: false` and lost-reply lockout as `PayOnTrip`. `GetTripOverview` may carry `BnplPlans[]` (`MerchantName`, `NumberOfMonths`, `MonthlyInstallment`, `FirstRepaymentDate`, `MaturityDate`, optional `Currency`), listed in the hub's "Pay later" card.
- Server: mirrors Scan-to-Pay `PayLater`. The BNPL pool pays the merchant; a monthly standing instruction bills the child's wallet in the trip currency (that wallet must cover the first instalment). The plan is stored in the Scan-to-Pay atomic with `TripId` and `RequestId`; a repeated `RequestId` returns `Duplicate` with the stored plan.
- Budget: one expense, `SourceId` 2, amount = principal ÷ locked rate (SGD, interest not budgeted), dedupe key `bnpl:<RequestId>`. If a ledger write fails after the pool paid, the reply is `Paid` with `LedgerPending: true`.
- Limits: 3, 6 or 12 months; SGD 20 to 3000 at the locked rate (site properties copied from the Scan-to-Pay composite).

### `CloseTrip`

No body; `?TripId=` and optionally `&CarryToTripId=` (0 or absent = convert back). Values leftover foreign at the **server** spot rate. The reply carries top-level `ReturnedForeign`, `ReturnedSgd`, `SpotRate`, `SavedVsSpotSgd` and sets `Trip.Status = 'Completed'`. No money moves because sandbox forwards never settle. A second close is refused.

With `CarryToTripId` the leftover moves to that trip instead (a WeTrip ledger move, not a bank transfer, #38). The closed trip is `Completed` with `ReturnedForeign` 0, `CarriedForeign` = the amount and `CarriedToTripId`; the receiving trip gets a `TripLock` with `Source` `CarryOver` and `ReferenceNumber` `carry:<closed trip id>`, which `GetTripOverview` lists in `Locks`. A trip that can no longer take it is refused with 4xx "That trip can't take the carry-over" and the closed trip stays open.

### `GetCloseOptions`

`?TripId=`, read-only, parent only, refused once the trip has ended. Returns `UnspentForeign`, `Currency`, `SpotRate`, `LockedRate`, `ValueAtSpotSgd`, `CostAtLockedSgd` (both rounded to cents) and `Better` (`Spot`, `Locked` or `Equal`). Rates are foreign per 1 SGD and SGD = foreign ÷ rate; spot includes `DemoRateShiftPct`, as `CloseTrip` does.

`CloseTripCard` shows the two SGD values and, unless `Better` is `Equal`, one comparison line before the parent closes. Nothing shows when `UnspentForeign` is 0 or the call fails. The `CloseTrip` reply stays authoritative because spot is re-read at confirm.

It also returns `EligibleTrips[]` (`TripId`, `Destination`, `TripStartDate`, `TripEndDate`): same family link, not this trip, same currency, Watching or PartiallyLocked, with room for the leftover. On the confirm step, "Keep for my next trip" shows when `UnspentForeign` > 0; ticking it shows a select of those trips and sends `CarryToTripId` on confirm. With none eligible it says "No Watching or Partly locked JPY trip has room for this yet." and confirm is disabled. A refused close reloads the options.

A carried trip's close card reads "Trip closed. JPY 1094.00 carried to <destination>." with no saved/cost line, and the receiving trip's Money card reads "Carried JPY 1094.00 from <destination>" for each `CarryOver` lock. Destinations come from `GetTrips` for the trip's family link, read only when a carry exists; until it loads the cards say "your next trip" / "an earlier trip".

## Query keys

| Key                                                              | Data                                              |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| `['trip','overview', String(tripId)]`                            | `GetTripOverview`                                 |
| `['trip','closeOptions', String(tripId)]`                        | `GetCloseOptions` (parent, open trip only)        |
| `['fx']`, `['family']`, `['budget','dashboard', String(tripId)]` | Cross-feature data refreshed after trip mutations |

`AddReceipt` invalidates the same keys on success; a receipt photo is cached under `['receipt', String(receiptId)]`. `PlanTrip` and `CloseTrip` invalidate trip, FX, family and the trip budget on success. `PayOnTrip` invalidates them in `onSettled`, so a failed or lost call still refreshes what the bank may have changed.

## Flow

1. Parent plans the trip (`PlanTrip`); the composite opens the foreign wallet and writes budget rows.
2. Parent locks through SmartFX `LockNow` on `/fx/trips/$tripId`; see [fx.md](fx.md).
3. Child scans a merchant QR at `/pay?tripId=`, reviews the preview and pays from the trip (`PayOnTrip`) or pays later (`PayLaterOnTrip`).
4. Parent reviews the hub and closes (`CloseTrip`).

## Domain rules

- Only an Active family link can own a trip.
- The parent funds; the child spends. Role checks are server-side (`PlanTrip`/`CloseTrip` refuse children, `PayOnTrip` refuses parents, strangers are refused by the overview).
- The pot is a ledger: `remainingForeign = LockedForeign − Σ TripSpend.Amount`.
- `Amount` is in the trip currency; the bank transfer is SGD at the trip's blended locked rate.
- Insurance policies appear in the overview when linked by `TripId`; older policies without one do not count as cover on the trip page.

## Components and helpers

`TripHub`, `TripPay`, `TripPayLater` (options and confirmation), `PayLaterCard`, `ReceiptForm`, and pure helpers in `trip.js`: `parseMerchantQr` (JSON `{merchantCode, amount, currency}`), `foreignSpent`, `milesLabel`, `COUNTRY_BY_CURRENCY`. `TripPay` reuses `PayLayout` and `QrScanner` from Scan-to-Pay; its preview and result panels are its own; pay later reuses `PlanOptions` and `PaidLater` from the Scan-to-Pay components.

## Tests

- `tests/trip-hub.spec.js` — overview read by trip id, sections, policies, close confirmation, carry-over (Keep for my next trip), role handling, signed-out state, the Budget card's fixed line, Pay later plans card.
- `tests/new-trip.spec.js` — the new-trip form: fixed-cost rows, the over-limit rules, the `PlanTrip` body, the "not saved" notice on the trip page.
- `tests/trip-pay.spec.js` — payload with one `RequestId`, open amount, decline form, invalid QR, miles on the Paid card; pay later (options, ineligible, preview failure, confirmation, 4xx, lost reply). Mocks `/scantopay/` too.
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
