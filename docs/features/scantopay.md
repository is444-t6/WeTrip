# Scan-to-Pay

Wallet QR payments and BNPL, plus the trip-payment scanner reused by [trips](trips.md).

**Routes:** `/pay/`, `/pay/history`.
**Service:** `WeTrip_ScanToPay_Composite` → `/scantopay` → `/rest/ScanToPay`.
**Code:** `src/features/scantopay/`.

## Screens

| Route           | Screen                                                                                               | Behaviour                                               |
| --------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `/pay/`         | `ScanToPay` → `WalletPay`                                                                            | Scan/paste a merchant QR, preview, pay now or pay later |
| `/pay/?tripId=` | `TripPay` (from `src/features/trips/`) when signed in; otherwise the wallet screen's signed-out card | Pays from the trip pot; see [trips.md](trips.md)        |
| `/pay/history`  | `MyPayments`                                                                                         | BNPL plans then payment history                         |

## Backend contract

`CustomerId` is a query parameter on every call, taken from the session. Request bodies are camelCase; responses are `decap`ed.

| Method | Endpoint                     | Purpose                                        |
| ------ | ---------------------------- | ---------------------------------------------- |
| POST   | `PreviewPayment?CustomerId=` | Merchant, amount, wallet balance, BNPL options |
| POST   | `PayNow?CustomerId=`         | Immediate payment                              |
| POST   | `PayLater?CustomerId=`       | BNPL plan + standing instruction               |
| GET    | `GetHistory?CustomerId=`     | Payments and BNPL plans                        |

Body: `{qrText, amount, numberOfMonths}`. `PreviewPayment` and `PayNow` send `numberOfMonths: 0`.

Response shapes:

- Preview: `merchantCode`, `merchantName`, `merchantCategory`, `amount`, `currency`, `walletAccountId`, `walletBalance`, `sufficientBalance`, `amountSGD`, `rateFound`, `bnplEligible`, `bnplOptions[]`.
- Pay: `transactionId`, `paymentRecordId`, `merchantName`, `amount`, `currency`, `amountSGD`, `balanceBefore`, `balanceAfter`.
- BNPL: `bnplPlanId`, `paymentRecordId`, `principal`, `numberOfMonths`, `monthlyInstallment`, `totalInterest`, `maturityDate`, `standingInstructionId`, `firstRepaymentDate`.

`decap` turns `BNPLPlanId` into `bNPLPlanId`; the screen checks both spellings.

## QR format

The client parses the QR as JSON: `{"merchantCode":"M001","amount":1200,"currency":"JPY"}`. `amount: 0` means an open amount, which the user types before preview. Invalid JSON is rejected with a friendly message.

The camera uses `html5-qrcode` with the rear camera. It requires HTTPS or localhost; `npm run dev:https` exists for phone testing.

## Query keys

`['scantopay','history', customerId]` for `GetHistory`. `PayNow`/`PayLater` invalidate it in `onSettled`, including on failure, because the bank may have completed after the response was lost.

## Payment safety

- Payments are user-triggered only; no effect, timer or automatic flow calls them.
- Mutations use `retry: false`; a double-tap `useRef` guard blocks clicks while the request is in flight.
- A network `TypeError` or a `502/503/504` from the proxy is treated as "may have gone through"; the UI shows a warning and links to history.
- The pay buttons are **not** disabled after a lost response (only `TripPay` does that), so a second tap can submit a second `PayNow`/`PayLater`.
- A 2xx response without a receipt field (`transactionId`, `paymentRecordId`, `bnplPlanId` or `bNPLPlanId`) is not treated as a receipt.
- `PreviewPayment` does not invalidate anything; balances refresh with history.

## Domain rules

- Preview first; payment is a separate, explicit action.
- Pay-now is blocked when `sufficientBalance` is false.
- BNPL is offered only when `bnplEligible`; the plan creates a repayment standing instruction in the bank.
- History is per customer; there is no merchant-side view.
- This composite is on the **same** `smuedu-dev` host as the other five. Older docs claiming a separate OutSystems environment are stale.

## Files

`ScanToPay.jsx`, `MyPayments.jsx`, `api.js`, `queries.js`, `customer.js`, `scantopay.css`, and components `PayLayout`, `QrScanner`, `PaymentPreview`, `PaymentResult`, `DetailRow`.

## Tests

- `tests/scantopay.spec.js` — preview/pay now, pay later, open amount, insufficient funds, double-click guard, API errors, lost-response warning, signed-out no calls, history.

## Known issues

- `CustomerId` is supplied by the caller from the session; no server-side ownership check is documented.
- No idempotency key on `PayNow`/`PayLater` (only `PayOnTrip` has `RequestId`); the in-flight ref plus `retry: false` are the only guards, and the buttons remain enabled after a lost reply.
- `html5-qrcode` is a static import, so the `/pay` route chunk is ~380 KB (most of it the scanner).
- The composite is reached through the same open proxy as every other service.

Back to [architecture](../ARCHITECTURE.md) · [feature index](README.md)
