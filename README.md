# WeTrip Family + SmartFX

Coded React frontend for the FamilyWallet and SmartFX features. Talks only to
`WeTrip_Family_Composite` and `WeTrip_SmartFX_Composite` — never to the atomic
modules, never directly to SMUtBank.

Routing is TanStack Router (file-based, `src/routes`). Server state is TanStack
Query (`src/features/*/queries.js`). The API clients stay plain fetch
(`src/features/*/api.js` over `src/lib/http.js`).

## Run the app

```
npm install
npm run dev
```

Fill in `.env.local` first (see `.env.example`): `VITE_FAMILY_API_KEY` and
`VITE_FX_API_KEY` are the `ApiKey` Site Properties from the two composite
modules. The dev server proxies `/api/family/*` and `/api/fx/*` (see
`vite.config.js`), so CORS never comes up locally.

Before any screen works, you need a session. Visit `/family/dev-login` and
enter a demo customer's `CustomerId` + deposit `AccountId` — this writes a
stub token into `sessionStorage` that `ValidateSessionStub` (Task 12.4 Option
C) expects. Swap this for real WeTrip login later; nothing else in the feature
folders needs to change.

## Screens

| Route | What |
|---|---|
| `/family` | role-aware family home |
| `/family/dev-login` | dev session stub |
| `/family/child/:familyLinkId` | budget, allowance, top-up, expenses, trend |
| `/fx` | trip goals (parent) / trips (child), live quote, check-now |
| `/fx/trips/:tripId` | locked pot, rate watch, locks, spending, close & convert back |

## Test the OutSystems setup

Plain Node scripts, no Postman needed — they replicate the build guide's
Task 10 and Task 20.3 test tables against your live endpoints.

```
cp .env.test.example .env.test   # fill in real values
npm run test:atomic               # Family_Atomic only, writes test rows
npm run test:composite            # Family_Composite + real SMUtBank calls
npm run test:smartfx              # SmartFX E2E, defaults to the live sandbox
npm run test:ui                   # Playwright UI suite (family + SmartFX screens)
```

`test:composite` moves real sandbox money (TopUp, allowance, ChildSpend) and
creates a family link — only run it against demo accounts you're fine
mutating. It's safe to re-run (it reuses an existing link if one exists).

`test:smartfx` is the end-to-end contract test for the SmartFX feature: rate
quote, trip lifecycle, server-quoted lock, spend, convert-back, watcher and
cancel. It needs no env vars — every value has a working default — and it
writes real trips and wallets, so keep it to the sandbox.

`test:ui` drives the real screens in Chromium against the dev server (which
proxies the live APIs). It covers the signed-out redirect, the dev login form,
the parent home, the child detail page, the child dashboard, and the
parent/child split on SmartFX. It is read-only — it never creates a trip or
moves money — and it reuses a running dev server on port 5199 if there is one.
Run `npx playwright install chromium` once before the first run.
