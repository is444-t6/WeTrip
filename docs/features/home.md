# Home

Signed-in dashboard and the public front door.

**Route:** `/`.
**Services:** Family, SmartFX, Scan-to-Pay (reads only).
**Code:** `src/features/home/`, `src/components/`.

## Screens

| Screen      | Behaviour                                                                     |
| ----------- | ----------------------------------------------------------------------------- |
| `FrontDoor` | Chooses once at render: `Home` when `isLoggedIn()`, otherwise `SignedOutCard` |
| `Home`      | Balance hero, family overview, trip wallets, recent payments, quick actions   |

## Data

| Section                 | Source                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| Name + SGD balance      | `useCurrentUser({ profile: true })` → `GetMyFamilyRole` + `GetMe`      |
| Pending approvals badge | `GetPendingRequests` for parents only                                  |
| Family overview         | `GetChildren` (parent) or `GetChildDashboard` (child)                  |
| Trip wallets            | SmartFX `GetTrips` per active family link (parent) or own link (child) |
| Recent payments         | Scan-to-Pay `GetHistory`, three newest                                 |
| Miles (child only)      | Trip composite `GetMyMiles` → `{Balance}`; card hidden if it fails     |

`tripWallets()` filters out ended trips and trips with no locked foreign balance. `latestPayments()` sorts and slices history. Both are pure functions in `homeData.js`.

The balance can be masked; the preference is stored in `localStorage['wetrip_hide_balance']`. `maskAccount` shows the last four digits of the account id.

## Components

`Icons`, `QuickActions`, `ExploreProducts`, `FamilyOverview`, `TripWallets`, `MilesCard`, `RecentPayments`, plus `Money` and `Banner` from the shared kit. Home renders its own hero markup rather than `BalanceHero`.

Quick actions and product tiles are static links; there is no polling or auto-refresh.

## Tests

- `tests/home-mocked.spec.js` — signed-out card, sign-in/out, parent and child dashboards, trip money, recent payments, balance-hide persistence, Scan-to-Pay outage isolation, Miles card (balance, zero, outage, parent).
- `tests/home-data.spec.js` — pure helpers (`firstName`, `maskAccount`, `tripWallets`, `latestPayments`, `totalChildBalance`).

## Known issues

- `FrontDoor` decides authentication at render; changing session requires navigation or reload.
- A failing Scan-to-Pay history call must not break the rest of the dashboard; the section shows a fallback message.
- Budget has no top-level nav tab; it is reachable from Home and the trip hub.

Back to [architecture](../ARCHITECTURE.md) · [feature index](README.md)
