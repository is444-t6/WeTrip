# WeTrip — Family, SmartFX, Budget, Insurance & Payments

Redesigned React frontend for WeTrip. The UI applies the YouTrip design system
(see [`docs/DESIGN.md`](docs/DESIGN.md)) while keeping the existing product
behaviour and API contracts intact.

The current build covers the front-door home and dev login, role-aware Family
dashboards and child insights, SmartFX trip goals, category budgets, travel
insurance and Scan-to-Pay / My Payments.

Talks only to `WeTrip_Family_Composite`, `WeTrip_SmartFX_Composite`,
`WeTrip_Budget_Composite`, `WeTrip_Insurance_Composite` and `ScanToPay` — never
to the atomic modules, never directly to SMUtBank.

Routing is TanStack Router (file-based, `src/routes`). Server state is TanStack
Query (`src/features/*/queries.js`). The API clients stay plain fetch
(`src/features/*/api.js` over `src/lib/http.js`).

## Run the app

```
npm install
npm run dev
```

Fill in `.env.local` first (see `.env.example`). The dev server proxies
`/api/family/*`, `/api/fx/*`, `/api/budget/*` and `/scantopay/*` (see
`vite.config.js`), so CORS never comes up locally. For the Scan-to-Pay camera,
use `npm run dev:https` and open the LAN URL on your phone.

Before any screen works, you need a session. Visit `/login` and enter a demo
customer's `CustomerId`; the app looks up their SGD deposit account and writes
a stub token into `sessionStorage` that `ValidateSessionStub` (Task 12.4 Option
C) expects. Swap this for real WeTrip login later; nothing else in the feature
folders needs to change.

## Screens

| Route                         | What                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| `/`                           | signed-in home or the WeTrip sign-in card                     |
| `/family`                     | role-aware family home                                        |
| `/login`                      | dev session stub (`/family/dev-login` redirects here)         |
| `/family/child/:familyLinkId` | budget, allowance, top-up, expenses, trend                    |
| `/fx`                         | trip goals (parent) / trips (child), live quote, check-now    |
| `/fx/trips/:tripId`           | locked pot, rate watch, locks, spending, close & convert back |
| `/budget` / `/budget/:tripId` | category budgets, budget bars/alerts, add expense, ledger     |
| `/insurance`                  | travel insurance: trip details, plans, travellers, checkout   |
| `/insurance/policies`         | purchased policies                                            |
| `/pay` / `/pay/history`       | Scan to Pay, PayNow/PayLater, payment history                 |

## Test

```
# uses the same .env.local as the app (see .env.example); no separate test env file
npm run test:atomic               # Family_Atomic only, writes test rows
npm run test:composite            # Family_Composite + real SMUtBank calls
npm run test:smartfx              # SmartFX E2E, defaults to the live sandbox
```

UI suites:

```
npx playwright install chromium
npx playwright test --config playwright.config.js
```

`family.spec.js` reads the live sandbox; the home, auth, family, insurance,
budget-mobile, FX-mobile and Scan-to-Pay suites use mocked APIs. Scan-to-Pay
payments are always mocked so no real money moves. The UI suites pass (209
tests at the time of writing). `smartfx-api.spec.js` is the live contract test
and writes real trips, so keep it to the sandbox.

`test:composite` moves real sandbox money (TopUp, allowance, ChildSpend) and
creates a family link — only run it against demo accounts you're fine
mutating. It's safe to re-run (it reuses an existing link if one exists).

`test:smartfx` is the end-to-end contract test for the SmartFX feature: rate
quote, trip lifecycle, server-quoted lock, spend, convert-back, watcher and
cancel. It needs no env vars — every value has a working default — and it
writes real trips and wallets, so keep it to the sandbox.
