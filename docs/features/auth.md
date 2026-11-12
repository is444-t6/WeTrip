# Auth

Dev session handling for WeTrip. There is no real authentication: the "token" is an unsigned string stored in `sessionStorage`, and the backend's `ValidateSessionStub` trusts it.

**Routes:** `/login`, plus `/family/dev-login` (redirects to `/login`).
**Service:** Family.
**Code:** `src/features/auth/`.

## Login flow

1. `/login` asks only for a numeric `CustomerId`.
2. `fetchAccounts` calls `GetMyAccounts` with the partial token `customerId::` before any session exists.
3. `depositAccounts` keeps open SGD `CASA` accounts. Zero accounts is an error; several are offered in a `<select>`.
4. `fetchDisplayName` calls `GetMe` with `customerId:accountId:`; failures fall back to an empty name, and non-printable-ASCII names are dropped.
5. `setDevSession` writes `customerId:accountId:displayName` to `sessionStorage.wetrip_session`.
6. `queryClient.clear()` runs before navigating to `/`.

If a session already exists, `/login` shows the raw token with a Clear action and does not redirect away.

## Session transport

| Consumer                                     | Transport                                                            |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Family, Budget, Insurance, Trip, Scan-to-Pay | `X-Session-Token` header                                             |
| SmartFX                                      | `?sessionToken=` query parameter (the composite cannot read headers) |

`useCurrentUser()` reads `isLoggedIn()` and runs one shared `['family','role']` query (`GetMyFamilyRole`), optionally loading `GetMe` when `profile: true`. It returns `role`, `familyLinkId`, `isParent`, `isChild`, `profile` and loading/error state.

## Guards and sign-out

- There is no router-level guard. Gated screens show the signed-out card (`FxHome` uses an inline copy); `/login` and `/insurance/*` do not.
- Most screens sign out with `clearSession()` + `window.location.reload()`.
- `InsuranceLayout` and `PayLayout` clear the session and navigate to `/family`; `PayLayout` hides the Sign out button when signed out.
- Login always returns to `/`, so a deep link is not preserved.

## Files

| File                | Role                                                                              |
| ------------------- | --------------------------------------------------------------------------------- |
| `session.js`        | Storage key, token format, getters, `setDevSession`, `clearSession`, `isLoggedIn` |
| `accounts.js`       | Account lookup, CASA/SGD filtering, display-name lookup, friendly lookup errors   |
| `useCurrentUser.js` | Shared role/profile query                                                         |
| `Login.jsx`         | Customer id → account → session                                                   |

## Tests

- `tests/login-mocked.spec.js` — single/multiple accounts, unknown customer, no deposit account, busy state, session preservation.
- `tests/auth-accounts.spec.js` — pure unit tests for `depositAccounts` and lookup messages.
- `tests/family.spec.js` — live login path.

## Known issues

- The token is unsigned, unexpired and user-editable. This is demo-grade only.
- `sessionStorage` is per tab: a new tab is signed out.
- Sign-out does not clear the TanStack Query cache unless the screen reloads.
- Sign-out clears only `wetrip_session`; the three `wetrip.insurance.*` keys persist until the tab closes, so the next sign-in can see the previous draft and purchase result.
- Display names containing non-ASCII characters are silently dropped from the header.

Back to [architecture](../ARCHITECTURE.md) · [feature index](README.md)
