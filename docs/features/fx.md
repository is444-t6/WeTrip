# SmartFX (FX)

Foreign-exchange trip goals: quote a forward rate, lock SGD into a trip wallet, watch the target, cancel a trip.

**Routes:** `/fx/`, `/fx/trips/$tripId`; `/fx/trips/` redirects to `/fx`.
**Service:** `WeTrip_SmartFX_Composite` → `/api/fx` → `/rest/SmartFX`.
**Code:** `src/features/fx/`.

## Screens

| Route               | Screen                                                                      | Access    |
| ------------------- | --------------------------------------------------------------------------- | --------- |
| `/fx/`              | `FxHome`: parent trip list per active child, child trip list, `NewTripForm` | Signed in |
| `/fx/trips/$tripId` | `TripDetail`: rate gauge, locks, spends, lock/cancel/close controls         | Signed in |

`NewTripForm` collects destination, currency, dates, target SGD budget and target rate; it calls Trip `PlanTrip` and navigates to `/trips/$tripId`. `TripDetail` is the SmartFX view (locks and spends); `/trips/$tripId` is the cross-feature hub. Ended trips collapse under a "Past trips" section on `FxHome`.

## Backend contract

Headers are unavailable to this composite, so the key and session ride as query parameters: `?apiKey=…&sessionToken=…` on every call. The proxy adds `apiKey` and replaces any caller value.

| Method | Endpoint                  | Purpose                                                 |
| ------ | ------------------------- | ------------------------------------------------------- |
| GET    | `GetTrips?familyLinkId=`  | Trips for one link, with a live rate for watching trips |
| GET    | `GetTrip?tripId=`         | `{Trip, Locks, Spends}`                                 |
| GET    | `GetRate?currency&period` | `{spotRate, forwardRate, currency, period}`             |
| POST   | `LockNow`                 | Server-quoted lock; any client `rate` is ignored        |
| POST   | `CancelTrip?tripId=`      | Cancel when nothing is locked                           |
| POST   | `CheckRatesNow`           | Manual watcher run; returns a bare integer              |

`CreateTrip`, `TripSpend` and `CloseTrip` were retired from this composite; the live suite asserts they fail. Trip-level actions live in [trips.md](trips.md).

Responses are not `decap`ed by the service; `fx/api.js` maps `Id` → `tripId` / `lockId` / `spendId` and `GetRate` is already camelCase.

## Query keys

| Key                                   | Data                                                             |
| ------------------------------------- | ---------------------------------------------------------------- |
| `['fx','trips', linkIds.join(',')]`   | Parent trip list (`fx/queries.js`); one cache entry per link set |
| `['fx','trips','link', familyLinkId]` | One child's trips (`family/tripQueries.js`, same prefix)         |
| `['fx','trip', id]`                   | Trip detail                                                      |
| `['fx','rate', currency, period]`     | Quote, `staleTime: 60 s`                                         |

Cancelling or locking invalidates the list and the trip. `CheckRatesNow` invalidation exists in `queries.js` but the UI's "Check now" button refetches the quote instead.

## Domain rules

- Base currency is SGD; quote is the trip currency; every rate is foreign units per 1 SGD. Higher is better.
- Auto-lock fires when `forwardRate >= targetRate`.
- Supported currencies: USD, EUR, JPY, GBP, CHF. KRW/THB fail because MarketData has no benchmark rate for them.
- Tenors: `1M`, `3M`, `6M`, `1Y`, chosen from days to departure (≤31, ≤92, ≤183, else `1Y`).
- Statuses: `Watching`, `PartiallyLocked`, `Locked`, `Spending`, `Completed`, `Cancelled`.
- Only an Active family link can own a trip; the parent funds locks and the child spends from the pot.
- `ForeignAmount ≈ SgdAmount × LockedRate`.
- A lock books a real FX forward only when the trip has `ParentAccountId` and `ForeignAccountId` (trips created by `PlanTrip` do; older trips do not).
- Closing uses the **server** spot rate and moves no money; see [trips.md](trips.md).

The five-minute `SmartFXWatcher` timer lives in the composite and auto-locks watching trips. Timer locks write rows only and do not book contracts. Details are in [architecture §4.6](../ARCHITECTURE.md#46-smartfx-watcher).

## Components

`TripCard`, `RateGauge`, `NewTripForm`; pure status helpers in `status.js`.

## Tests

- `tests/fx-mobile.spec.js` — mobile layout, loading/error, tables, lock/close/cancel confirmations.
- `tests/smartfx-api.spec.js` — live contract test; writes trips and locks, cancels one, and closes one through `Trip.CloseTrip`.
- `bun run test:smartfx` — runs that spec.
- `bun run test:trip` — Trip composite lifecycle including lock and close.

## Known issues

- The composite's API key is declared but **not enforced**, and `sessionToken` has no server-side counterpart.
- Header auth is impossible for this module; do not move the token back into headers.
- The UI overrides the label when status reads `PartiallyLocked` after the full budget is locked.
- `GetTrips` is called once per active link, then merged; a child role only queries its own link.
- `GetRate` is the one response that is not normalised through `decap`.

Back to [architecture](../ARCHITECTURE.md) · [feature index](README.md)
