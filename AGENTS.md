# AGENTS.md — WeTrip

WeTrip is a React SPA for a student travel-fintech concept: family accounts, SmartFX trip forwards, trip budgets, travel insurance and Scan-to-Pay. It is the IS444 group project and talks to OutSystems composite services layered over the SMU tBank (`SMUtBank`) sandbox.

**This repository is the frontend only.** The OutSystems backend source is not here.

## Read when

- Running or testing → `README.md`. Deploying → `.github/workflows/cd.yml`.
- Needing product truth (users, positioning, scope, evidence) → `PRODUCT.md`.
- Touching any UI or CSS → `docs/DESIGN.md` (YouTrip design system; read "Application layer (WeTrip)").
- Touching SmartFX, rates, trips or FX contracts → the domain rules below, plus the request shapes in `src/features/fx/api.js`.
- Debugging Family API failures → the role and token rules below, plus `src/features/family/api.js`.
- Needing course or backend context → `../.scratch/IS444 Project Idea.md` (feature ownership), `../.scratch/smartfx.md` (proposal and architecture), `../.scratch/lab*.txt` (lab guides).

## Commands

Run from `WeTrip/`:

```bash
npm install
npm run dev          # Vite dev server; proxies every API, so no CORS locally
npm run dev:https    # HTTPS + LAN URL for the phone camera (Scan-to-Pay)
npm run build
npm run lint         # oxlint
npm run format       # oxfmt: no semicolons, single quotes
npm run format:check
```

Tests, also from `WeTrip/`:

```bash
npx playwright install chromium
npm run test:e2e         # all suites, including the live SmartFX writer; not a default check
npm run test:ui:mocked   # mocked Family UI; never reaches a backend
npm run test:ui          # Family UI against the live sandbox (read-only)
npm run test:atomic      # Family_Atomic; writes test rows with synthetic identities
npm run test:composite   # Family_Composite; moves sandbox money
npm run test:smartfx     # live contract test; writes a trip, lock, spend and convert-back
```

Among the npm scripts, only `test:ui:mocked` is backend-free. Several individual specs are too (`home-mocked`, `login-mocked`, `budget-mobile`, `fx-mobile`, `scantopay`, `trip-hub`, `insurance`, plus the pure unit specs); run one with `npx playwright test tests/<file>.spec.js`. Everything live shares one sandbox, so runs are serialized (`workers: 1`) — do not parallelise them. Use demo accounts for `test:composite`, the UI suites and `test:smartfx`; `test:atomic` deliberately uses its own synthetic `ATOMIC_TEST_*` identities, and pointing it at the demo parent/child creates links with fake accounts that break `GetChildren`. Run write suites only when the change actually touches their contract.

## Architecture

React 19 + Vite 8. TanStack Router (file-based) for routing, TanStack Query for server state, plain `fetch` for HTTP. No state library, no UI kit.

```text
src/routes/*.jsx        thin file routes; only import a feature screen
src/features/<name>/    screen(s) + api.js + queries.js + components/
src/lib/services.js     service registry: base path, key, auth style, normalisation
src/lib/http.js         one fetch client; decap() response casing; friendlyError()
src/components/         shared AppShell, BalanceHero, Money, Banner, SignedOutCard
src/index.css           design tokens and most app CSS; Scan-to-Pay layout lives in
                        src/features/scantopay/scantopay.css
```

Every backend path is same-origin, proxied in dev by `vite.config.js` and in production by `vercel.json`:

| App path         | OutSystems module / REST endpoint                            |
| ---------------- | ------------------------------------------------------------ |
| `/api/family`    | `WeTrip_Family_Composite/rest/Family`                        |
| `/api/fx`        | `WeTrip_SmartFX_Composite/rest/SmartFX`                      |
| `/api/budget`    | `WeTrip_Budget_Composite/rest/BudgetComposite`               |
| `/api/insurance` | `WeTrip_Insurance_Composite/rest/InsuranceAPI`               |
| `/api/trip`      | `WeTrip_Trip_Composite/rest/Trip`                            |
| `/scantopay`     | `ScanToPay/rest/ScanToPay` (separate OutSystems environment) |

A base URL change means editing `services.js`, `vite.config.js` and `vercel.json` together.

To add or change a screen:

1. Add the method to `src/features/<name>/api.js` through `serviceClient()`.
2. Add the query/mutation to `src/features/<name>/queries.js` with a stable query key and invalidation.
3. Build the screen in `src/features/<name>/`.
4. Add a thin route in `src/routes/`; the Vite plugin regenerates `src/routeTree.gen.ts`.

## Rules

- All data goes through the WeTrip composites. The browser never calls an atomic module or `SMUtBank` directly; composites exist to own that orchestration.
- Reuse `serviceClient`, `qs`, `decap` and `friendlyError`. Create another fetch wrapper only if a service genuinely cannot fit `src/lib/http.js`.
- Match each feature's existing casing. Family and SmartFX request bodies are camelCase; Budget request bodies and query parameters are PascalCase; Scan-to-Pay passes `CustomerId` in the query. All responses are decapped; SmartFX additionally maps `Id` to `tripId`, `lockId` and `spendId`.
- Authentication is the dev stub in `sessionStorage.wetrip_session`, formatted `customerId:accountId:displayName`. Use `src/features/auth/session.js` and `useCurrentUser()`; keep the token format and `X-Session-Token` header, because the backend's `ValidateSessionStub` expects them. `wetrip_session` is only the client-side storage key.
- SmartFX carries `apiKey` and `sessionToken` as query/body parameters because that composite cannot read request headers. Keep that transport.
- Payments are user-triggered only. `PayNow`/`PayLater` never retry and must never be called from an effect, timer or automatic flow.
- Server state lives in TanStack Query. Invalidate the keys a mutation affects; do not add manual `reload()` callbacks.
- Reuse `AppShell`, `Money`, `Banner`, `SignedOutCard`, `BalanceHero` and the tokens/classes in `index.css`. Product screens use mint primary buttons with `primary-deep` labels, purple surfaces, Poppins, and no speculative shadows or gradients (`docs/DESIGN.md`).
- Prefer an existing dependency or platform feature over adding a package.

## Domain rules to preserve

- **SmartFX:** base is SGD, quote is the trip currency, and every rate is foreign units per 1 SGD. Higher is better; auto-lock fires at `forwardRate >= targetRate`. Supported currencies: USD, EUR, JPY, GBP, CHF. Tenors: 1M, 3M, 6M, 1Y. Only an Active family link can own a trip; the parent funds locks, the child spends from the pot, and closing converts unused foreign balance back.
- **Family:** roles are `Parent`, `Child`, `Pending` or `None`; only `Active` links count. Parent sets budgets/allowance, tops up, approves or rejects asks, grants extra budget, and can freeze spending or restrict categories.
- **Budget:** categories and sources live in `src/features/budget/constants.js`. Budgets are keyed by the SmartFX `tripId`. Responses are camelCase but request bodies and query parameters are PascalCase. Budget amounts are SGD by design (`DEFAULT_CURRENCY`); a trip's foreign money lives in SmartFX.
- **Insurance:** plans → travellers → checkout → policies. A purchase started from a trip page sends that trip's `TripId` (only while the dates still match); older policies have none and are matched by date overlap.
- **Scan-to-Pay:** preview first, then PayNow or PayLater (BNPL). History is per customer. Payment mutations refresh history even on failure, because the bank may have completed after the request died.
- **Trip hub:** `/trips/$tripId` reads `Trip.GetTripOverview` (trip, locks, spends, pot left, SGD budget, trip-linked policies). The child pays from a trip at `/pay?tripId=` through `Trip.PayOnTrip` (one SGD transfer at the trip's locked rate, a `RequestId` per scan, never retried); the parent closes it with `Trip.CloseTrip` (server spot rate, no money moves). New trips are planned with `Trip.PlanTrip`, which derives the child from the family link and sets the SGD category budgets.

## OutSystems and tBank context

- The course platform is `SMUtBank` ("tBank"), a training core bank. The provided atomic services WeTrip uses are `MarketData` (spot and benchmark rates), `FXForward` (quote, open and list contracts), `Deposit Account` (accounts and balances) and `Payments` (transfers and beneficiaries).
- WeTrip composites on `smuedu-dev.outsystemsenterprise.com` orchestrate those atomics and own the WeTrip tables. SmartFX is split into `WeTrip_SmartFX_Atomic` (Trip/TripLock/TripSpend CRUD) and `WeTrip_SmartFX_Composite` (orchestration, session checks, an API key that is sent but not enforced, and the five-minute watcher timer).
- Backend edits happen in Service Studio or through the Model API. When editing an `.oml`, use the `servicestudio-mcp-oml` skill under `../.agents/skills/servicestudio-mcp-oml`. Publishing can still require a manual step.
- Layering: atomics own the tables and expose CRUD REST; composites call only atomics and SMUtBank and own no tables. `WeTrip_Trip_Composite` holds the cross-feature flows.
- Known backend gaps: the SmartFX composite cannot read headers; a lock books a real FXForward contract only for trips that carry `ParentAccountId` and `ForeignAccountId` (trips made by `PlanTrip` do; older ones don't); sandbox forwards never settle, so the trip pot is a ledger and the only money movement is `PayOnTrip`.
- Family failures to check before assuming a frontend bug: an empty session user, an empty `Status` on newly created links, and swapped `GetDepositAccountBalance` arguments.

## Environment and secrets

- `.env.local` is gitignored and holds real composite API keys. Read it through Vite env vars; never echo, copy or commit its contents.
- `.env.example` covers the app's `VITE_*` variables (it omits `VITE_INSURANCE_API_KEY`, which `services.js` reads). `test:atomic` and `test:composite` read their own variables from `.env.local`; see the headers of `scripts/test-atomic.mjs` and `scripts/test-composite.mjs`. `.env.test.example` is out of date.
- Playwright takes `SMARTFX_API_KEY` from the environment, else maps `VITE_FX_API_KEY` from the environment or `.env.local`.
- `VITE_*` values are bundled into the browser. This is a class sandbox, not production authentication; do not describe the key as secret in user-facing code.

## Done

Run `npm run format:check`, `npm run lint` and `npm run build`. Run the mocked UI suites for interface changes and the relevant API suite for contract changes. Update `README.md` or `docs/DESIGN.md` when behaviour they describe changes. Let the router plugin write `src/routeTree.gen.ts`; never hand-edit it.
