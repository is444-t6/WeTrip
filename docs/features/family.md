# Family

Family accounts: invites, links, child dashboards, limits, allowances, top-ups, approvals and spending.

**Routes:** `/family/`, `/family/child/$familyLinkId`.
**Service:** `WeTrip_Family_Composite` → `/api/family` → `/rest/Family`.
**Code:** `src/features/family/`.

## Screens

| Route                         | Screen                                                                           | Access    |
| ----------------------------- | -------------------------------------------------------------------------------- | --------- |
| `/family/`                    | `FamilyHome` → `ParentHome`, `ChildHome`, `ChildInvite` or an inactive-link card | Signed in |
| `/family/child/$familyLinkId` | `ChildDetail` (Overview / Manage / Activity tabs)                                | Parent    |

`ChildDetail` finds the child by `familyLinkId` in `GetChildren`; there is no single-child endpoint.

## Backend contract

Headers: `X-Contacts-Key` (added by proxy) + `X-Session-Token`.

| Method | Endpoint                                          | Purpose                                     |
| ------ | ------------------------------------------------- | ------------------------------------------- |
| GET    | `GetMyFamilyRole`                                 | Role and link id                            |
| GET    | `GetMe`                                           | Profile and SGD balance                     |
| GET    | `GetMyAccounts`                                   | Sign-in account list                        |
| GET    | `FindCustomerByPhone?countryCode&phoneNumber`     | Look up a child                             |
| POST   | `LinkChild`                                       | Create a pending invite                     |
| GET    | `GetMyLinkInvite`                                 | Child's invite (may answer as an error)     |
| POST   | `AcceptLink`                                      | Activate the link with an account           |
| GET    | `GetChildren`                                     | Parent child cards                          |
| POST   | `SetBudget`                                       | Weekly/monthly limit                        |
| POST   | `SetupAllowance` / `StopAllowance`                | Standing instruction                        |
| POST   | `TopUp`                                           | Parent → child transfer                     |
| GET    | `GetChildDashboard`                               | Child wallet and categories                 |
| POST   | `ChildSpend`                                      | Child → merchant payment                    |
| GET    | `GetPendingRequests`                              | Approval queue                              |
| POST   | `DecideRequest`                                   | Approve/reject, optionally grant hours      |
| POST   | `GrantBudget`                                     | Temporary limit raise                       |
| POST   | `SetSpendingRules`                                | Freeze/categories/auto-approve (write-only) |
| POST   | `AskForMore`                                      | Child requests more                         |
| GET    | `GetMyRequests`                                   | Child's requests                            |
| GET    | `GetChildExpenses?familyLinkId&startDate&endDate` | Activity                                    |
| GET    | `GetBalanceTrend?familyLinkId&months`             | Monthly balance                             |

Request bodies are camelCase. Responses are `decap`ed.

## Query keys and invalidation

| Key                                                 | Data                                           |
| --------------------------------------------------- | ---------------------------------------------- |
| `['family','role']`                                 | `GetMyFamilyRole`                              |
| `['family','me']`                                   | `GetMe`                                        |
| `['family','children']`                             | `GetChildren`                                  |
| `['family','requests']` / `['family','myRequests']` | Approvals / child asks                         |
| `['family','invite']`                               | `GetMyLinkInvite`                              |
| `['family','accounts']`                             | `GetMyAccounts` (account picker for an invite) |
| `['family','dash']`                                 | `GetChildDashboard`                            |
| `['family','expenses', id, from, to]`               | `GetChildExpenses`                             |
| `['family','trend', id, months]`                    | `GetBalanceTrend`                              |

Mutations invalidate the keys they affect: linking a child refreshes children/requests/me/role; decisions refresh requests, children, profile, asks, expenses and trends; top-ups refresh children, profile, expenses and trends. See `queries.js` for the full matrix.

## Domain rules

- Roles are `Parent`, `Child`, `Pending`, `None`; only `Status === 'Active'` links count.
- A new link is `Pending` with no `ChildAccountId` until the child accepts.
- Parents set the limit (`SetBudget`), create/stop allowances (`SetupAllowance`/`StopAllowance`), top up (`TopUp`), decide requests (`DecideRequest`), raise limits (`GrantBudget`) and set rules (`SetSpendingRules`).
- `GrantBudget` lasts `days` (default 1) and cannot be revoked early; a grant made while deciding an ask lasts `hours`.
- `SetSpendingRules` replaces prior rules and has no read-back endpoint.
- `ChildSpend` decline is a successful HTTP response with `status: 'Declined'`, `shortBy` and a message; nothing moves and no request is created.
- Multiple `AskForMore` calls are not de-duplicated.

## Flows

**Invite:** `FindCustomerByPhone` → `LinkChild` (Pending) → child `GetMyLinkInvite` → `AcceptLink` (Active).

**Spend:** `ChildSpend` checks freeze, categories, limit and grants → credit transfer + spend log (`Paid`), or a `Declined` response. The child can then `AskForMore`; the parent decides the ask (`DecideRequest`, which grants `grantAmount` for `hours`) or raises the limit independently with `GrantBudget`.

## Tests

- `tests/family-mocked.spec.js` — full parent/child UI, approvals, link-a-child, budgets, rules, insights, forms.
- `tests/family.spec.js` — live read-only UI against the sandbox.
- `tests/insights.spec.js`, `tests/approvals-chart.spec.js` — pure helpers.
- `bun run test:atomic` — Family_Atomic CRUD with synthetic `ATOMIC_TEST_*` identities.
- `bun run test:composite` — Family_Composite; moves sandbox money.

## Known issues

- `GetChildren` calls the bank balance API for links without `ChildAccountId` (pending invites) and fails with 400; the guard belongs in the composite.
- Newly created links read back with an empty `Status`; `AcceptLink` was relaxed to accept it.
- `GetMyLinkInvite` can report "no link" as an error, hence `retry: false`.
- A child visiting `/fx` or `/budget` can trigger a parent-only `GetChildren` call that fails.
- A parent approving an ask moves money from the child's account only if the child has sufficient balance.

Back to [architecture](../ARCHITECTURE.md) · [feature index](README.md)
