# Feature docs

One page per feature: routes, screens, backend contract, query keys, rules, tests and known issues. The [architecture doc](../ARCHITECTURE.md) keeps the system-wide view (C4, module layering, data model, cross-cutting rules).

| Feature     | Routes                                                     | Service                                | Doc                          |
| ----------- | ---------------------------------------------------------- | -------------------------------------- | ---------------------------- |
| Auth        | `/login`, `/family/dev-login` (redirect)                   | Family                                 | [auth.md](auth.md)           |
| Home        | `/`                                                        | Family + SmartFX + Scan-to-Pay (reads) | [home.md](home.md)           |
| Family      | `/family/`, `/family/child/$familyLinkId`                  | `WeTrip_Family_Composite`              | [family.md](family.md)       |
| SmartFX     | `/fx/`, `/fx/trips/$tripId` (the index redirects to `/fx`) | `WeTrip_SmartFX_Composite`             | [fx.md](fx.md)               |
| Trips       | `/trips/$tripId`, `/pay/?tripId=`                          | `WeTrip_Trip_Composite`                | [trips.md](trips.md)         |
| Budget      | `/budget/`, `/budget/$tripId`                              | `WeTrip_Budget_Composite`              | [budget.md](budget.md)       |
| Insurance   | `/insurance/*`                                             | `WeTrip_Insurance_Composite`           | [insurance.md](insurance.md) |
| Scan-to-Pay | `/pay/`, `/pay/history`                                    | `WeTrip_ScanToPay_Composite`           | [scantopay.md](scantopay.md) |

Shared code that every feature uses:

- `src/lib/http.js` — `createClient` (the client exposes `call`/`qs`), plus `decap` and `friendlyError`.
- `src/lib/services.js` — service registry and `serviceClient`.
- `src/components/` — `AppShell`, `Money`, `Banner`, `BalanceHero`, `SignedOutCard`.
- `src/index.css` — design tokens and global styles ([DESIGN.md](../DESIGN.md)).

Deployment, CI/CD and test-suite operation are in [DEPLOYMENT.md](../DEPLOYMENT.md). The product scope is in [PRODUCT.md](../../PRODUCT.md).
