# WeTrip Deployment

How WeTrip is built, tested and shipped: a static React SPA on Vercel plus one Node serverless function that proxies six OutSystems services. The backend itself is deployed separately in OutSystems; this repository only deploys the frontend and the proxy.

Related: [ARCHITECTURE.md](ARCHITECTURE.md) · [README](../README.md) · [CI](../.github/workflows/ci.yml) · [CD](../.github/workflows/cd.yml)

> **Status.** This is a course prototype. It deploys to the OutSystems **sandbox** (`smuedu-dev`), uses an unsigned session stub, and should not be treated as production banking infrastructure.

## Contents

1. [Environments](#1-environments)
2. [Topology](#2-topology)
3. [Vercel configuration](#3-vercel-configuration)
4. [Environment variables and secrets](#4-environment-variables-and-secrets)
5. [CI pipeline](#5-ci-pipeline)
6. [CD pipeline](#6-cd-pipeline)
7. [Deploying](#7-deploying)
8. [Local development](#8-local-development)
9. [Testing and verification](#9-testing-and-verification)
10. [Operations](#10-operations)
11. [Troubleshooting](#11-troubleshooting)
12. [Security posture](#12-security-posture)

---

## 1. Environments

| Environment | URL                     | Frontend                                             | API path                                             | Key source          | Data                                           |
| ----------- | ----------------------- | ---------------------------------------------------- | ---------------------------------------------------- | ------------------- | ---------------------------------------------- |
| Local       | `http://localhost:5173` | Vite dev server                                      | Vite `server.proxy` → OutSystems                     | `.env.local`        | Shared sandbox                                 |
| Local HTTPS | `https://<LAN-IP>:5173` | Vite + self-signed cert                              | Same proxy                                           | `.env.local`        | Shared sandbox                                 |
| Playwright  | `http://localhost:5199` | `bun run build` + `vite preview`                     | Same proxy (`preview.proxy` inherits `server.proxy`) | env or `.env.local` | Mocked specs: none. Live specs: shared sandbox |
| CI          | GitHub runner           | `bun install --frozen-lockfile` + build + Playwright | Same Vite proxy                                      | GitHub secret       | Shared sandbox (live project)                  |
| Production  | Vercel project `wetrip` | Vercel CDN (`dist/`)                                 | `api/proxy.js`                                       | Vercel project env  | Shared sandbox                                 |

There is **no staging environment** and no separate preview deploy workflow. Preview URLs exist only if the Vercel project's Git integration is enabled in the dashboard; they share the same sandbox and key unless Preview env vars are added.

The production URL is not recorded in the repository; read it from the Vercel dashboard.

---

## 2. Topology

```text
GitHub  is444-t6/WeTrip
  │ push / pull_request
  ▼
CI (ubuntu-latest, Bun 1.4.4; Node 22 for Playwright)
  ├─ checks: bun install --frozen-lockfile → format:check → lint → build
  └─ e2e:    Playwright mocked project, then live project
  │ push to main, CI success
  ▼
CD (ubuntu-latest, Bun 1.4.4, Vercel CLI 63.1.2)
  └─ checkout tested SHA → bun install --frozen-lockfile → vercel pull → vercel build --prod
     → confirm SHA is still origin/main → vercel deploy --prebuilt --prod
  ▼
Vercel project "wetrip"
  ├─ Static CDN: dist/ (hashed assets, index.html, fonts)
  └─ Serverless function: api/proxy.js

Browser ──HTTPS──▶ Vercel CDN / rewrite ──▶ api/proxy.js ──HTTPS──▶ smuedu-dev.outsystemsenterprise.com
                                                   │                seven composites
                                                   │                  → atomics → SMUtBank
                                                   └─ adds WETRIP_SERVER_KEY, forwards X-Session-Token
```

Vercel holds no database, queue, cron or object storage. The only scheduled backend work is the OutSystems `SmartFXWatcher` timer.

---

## 3. Vercel configuration

The project is linked by IDs, not by a committed `.vercel/` directory:

| Setting                             | Value                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------- |
| Project name                        | `wetrip`                                                                    |
| Project ID                          | `prj_jzBF2zUnIDyhXQzrz87o239c9IaQ` (also in `cd.yml`)                       |
| Org ID                              | `team_qxSt8IYPnfIh6WNbpzI2nMBq` (also in `cd.yml`)                          |
| Framework preset                    | Vite (dashboard setting; not pinned in `vercel.json`)                       |
| Build command                       | `bun run build` → `vite build` (under Bun)                                  |
| Output directory                    | `dist`                                                                      |
| Toolchain                           | Bun 1.4.4 for installs, format, lint and build; Node 22 for Playwright only |
| Function runtime                    | Node.js (the handler uses `req`/`res` and `Buffer`; not Edge)               |
| Function region / memory / duration | Not configured — Vercel project/plan defaults                               |
| Domains / TLS                       | Vercel-managed; custom domain not recorded                                  |

`vercel.json` contains rewrites only:

| Source                  | Destination                                |
| ----------------------- | ------------------------------------------ |
| `/api/family/:path*`    | `/api/proxy?service=family&path=:path*`    |
| `/api/fx/:path*`        | `/api/proxy?service=fx&path=:path*`        |
| `/api/budget/:path*`    | `/api/proxy?service=budget&path=:path*`    |
| `/api/trip/:path*`      | `/api/proxy?service=trip&path=:path*`      |
| `/api/insurance/:path*` | `/api/proxy?service=insurance&path=:path*` |
| `/scantopay/:path*`     | `/api/proxy?service=scantopay&path=:path*` |
| `/(.*)`                 | `/index.html` (SPA fallback)               |

Consequences:

- Static files and `/api/proxy` are resolved before rewrites, so hashed assets are served normally.
- An unknown `/api/*` path falls through to `/(.*)` and returns **HTML with 200**, not JSON 404. The client then sees an empty successful body.
- `/api/proxy` is directly callable: `/api/proxy?service=fx&path=GetRate` reaches OutSystems with the server key.
- There is no `headers` block: no CSP, HSTS, frame protection or explicit cache policy.

### The proxy function

`api/proxy.js` and `api/_services.js`:

- Read `?service` and `?path`, then delete them from the forwarded query.
- Look up the service in `SERVICES`; unknown → `404 {"Errors":["Unknown service"]}`.
- Build `https://smuedu-dev.outsystemsenterprise.com<module path>/<path><query>`.
- Forward method, body (`JSON.stringify` unless already a string), `Content-Type` and `X-Session-Token`.
- Inject `WETRIP_SERVER_KEY` as `X-Contacts-Key` for all services except SmartFX, which gets `apiKey` in the query (overwriting any caller value).
- Copy upstream status and `Content-Type`, buffer the body, and return it unchanged.
- On `fetch` failure → `502 {"Errors":["The service did not respond"]}`. There is no logging in the catch, no timeout and no retry.

Operational limits that follow:

- The whole upstream response is buffered; Vercel's request/response body limit applies (roughly 4.5 MB).
- No `maxDuration`/`memory`/`regions`; a slow composite can consume the platform default and then surface as a platform 504.
- One function serves all six services, so cold starts and deploys affect every feature together.
- Only an allowlist of headers crosses the proxy: `Content-Type`, `X-Session-Token` and the injected key. Cookies, `Authorization`, tracing headers and idempotency headers are dropped.

---

## 4. Environment variables and secrets

| Variable                                     | Where                                                                         | Purpose                                                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `WETRIP_SERVER_KEY`                          | Vercel project env (Production; add Preview/Development if previews are used) | Added by `api/proxy.js` to every composite call. One value for all six modules. Must match each module's `WETRIP_SERVER_KEY` site property. |
| `WETRIP_SERVER_KEY`                          | GitHub Actions secret                                                         | Supplied to Playwright so the Vite proxy can call the sandbox.                                                                              |
| `WETRIP_SERVER_KEY`                          | Local `.env.local`                                                            | Same value for `bun run dev`, `dev:https`, Playwright and the test scripts.                                                                 |
| `VERCEL_TOKEN`                               | GitHub Actions secret `VERCEL_TOKEN`                                          | Used by `vercel pull`, `build` and `deploy`. Not a runtime variable.                                                                        |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`         | Hardcoded in `cd.yml`                                                         | Link the CLI to the project. Not secrets.                                                                                                   |
| `ATOMIC_TEST_*`, `MERCHANT_ACCOUNT_ID`, etc. | Local `.env.local` only                                                       | Inputs for `scripts/test-atomic.mjs`, `test-composite.mjs`, `test-trip.mjs`. `.env.test.example` is stale.                                  |

Rules:

- The key must never have a `VITE_` prefix and must never be read by browser code. Vite inlines every reachable `VITE_*` value into the bundle.
- `.env.local` is gitignored (`*.local`) and must stay local. Only server-side code reads it: `vite.config.js`, `api/proxy.js`, `playwright.config.js`, `scripts/*.mjs`.
- `.env` is **not** ignored — keep secrets in `.env.local`, not `.env`.
- A missing key is silent: `keyFor()` returns `''`, so the proxy sends `X-Contacts-Key: ''` or `apiKey=`. There is no startup check or health endpoint.

### Rotating the key

1. Generate the new value.
2. Update the `WETRIP_SERVER_KEY` site property in **every** WeTrip module (OutSystems Service Center / Service Studio) and publish each module.
3. Update the Vercel project env var (Production, and Preview/Development if used).
4. Update the GitHub Actions secret `WETRIP_SERVER_KEY`.
5. Update each developer's `.env.local`.
6. Redeploy production so the function picks up the new env value.

Order matters: the OutSystems side can hold both old and new only if the modules are published together; otherwise rotate during a quiet window.

### Key names

CI, Playwright, the Vite proxy and `api/proxy.js` all use `WETRIP_SERVER_KEY`. Legacy `VITE_FAMILY_API_KEY` / `VITE_FX_API_KEY` names are ignored by design (`tests/proxy.spec.js` pins this). Set the Vercel project env and the GitHub secret to the same value; do not reintroduce `VITE_*` aliases.

---

## 5. CI pipeline

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Triggers: every pull request and every push to `main`, except docs-only changes (`**/*.md` or `docs/**`), which skip CI and therefore CD.

| Stage             | What runs                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `checks` (15 min) | `bun install --frozen-lockfile` → `bun run format:check` → `bun run lint` → `bun run build`                      |
| `e2e` (20 min)    | Reusable [`e2e-tests.yml`](../.github/workflows/e2e-tests.yml), skipped for fork PRs because they get no secrets |

The E2E workflow:

1. Installs Bun 1.4.4 and Node 22, runs `bun install --frozen-lockfile`, caches `~/.cache/ms-playwright`.
2. Installs Chromium with `npx playwright install --with-deps chromium`.
3. Runs `bun run test:e2e`, which is `playwright test --project=mocked` followed by `playwright test --project=live --workers=1`.
4. Uploads `test-results/` on failure (7-day retention).

Playwright runs on Node.js and is the only Node-only tool in the pipeline; Bun manages dependencies and runs the package scripts.

Live runs share one sandbox, so the workflow is serialized with `concurrency: group: e2e-live-sandbox`. Mocked specs run fully parallel; the `live` project matches only `family.spec.js` and `smartfx-api.spec.js` and runs with one worker.

No tests run against the deployed Vercel URL. CI tests the Vite proxy and the Playwright mocks, not the production rewrites or function runtime.

There is no top-level CI concurrency group; two pushes to `main` can run CI in parallel, and CD is the stage that serializes production.

---

## 6. CD pipeline

Workflow: [`.github/workflows/cd.yml`](../.github/workflows/cd.yml). It is triggered by `workflow_run` when **CI completes on `main`**, not directly by a push.

Guard conditions (all must hold):

- CI conclusion is `success`;
- the CI event was `push` (not a pull request);
- the branch is `main`;
- the head repository is this repository.

Steps:

1. Checkout the exact SHA that CI tested.
2. `bun install --frozen-lockfile`.
3. `bunx vercel@63.1.2 pull --yes --environment=production` with `VERCEL_TOKEN`.
4. `bunx vercel@63.1.2 build --prod` on the GitHub runner.
5. Fetch `origin/main` and fail unless it still equals the CI-tested SHA.
6. `bunx vercel@63.1.2 deploy --prebuilt --prod`.

Properties:

- Builds happen on the GitHub runner; Vercel receives prebuilt output. Vercel's own build infrastructure is not used for CD.
- The freshness check prevents an older CI run from rolling production back after a newer push. Docs-only commits after the tested SHA are allowed through, because CI is skipped for them and they cannot change the deployed bundle.
- Only production is deployed; there is no approval gate, canary, staging promotion or post-deploy smoke test.
- `concurrency: production` with `cancel-in-progress: false` serializes deploys.
- Environment-variable changes do not redeploy by themselves; the next deploy picks them up.

---

## 7. Deploying

### Normal deploy

1. Merge the change to `main`.
2. Watch the CI run (checks + E2E).
3. CI success automatically starts CD.
4. Confirm the Vercel deployment and open the production URL.

Nothing else is required. A sandbox outage, a flaky live spec or a failing format/lint check blocks the deploy.

### Manual redeploy

There is no `workflow_dispatch` on CD. Options:

- Re-run the failed/previous **CI** workflow for a commit that is still `main`; CD follows automatically.
- Or run the CLI locally with a `VERCEL_TOKEN`:

```bash
bunx vercel@63.1.2 pull --yes --environment=production
bunx vercel@63.1.2 build --prod
bunx vercel@63.1.2 deploy --prebuilt --prod
```

The CLI path bypasses the CI gate; use it only when the tested SHA is current `main`.

### First-time setup

1. Publish all six OutSystems composites with the same `WETRIP_SERVER_KEY` site property value.
2. Create or link the Vercel project (`vercel link`), framework Vite, output `dist`.
3. Add `WETRIP_SERVER_KEY` to the Vercel project env (Production; Preview if used).
4. Add GitHub secrets: `VERCEL_TOKEN`, `WETRIP_SERVER_KEY` (and update the workflow secret names as described above).
5. Confirm `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` in `cd.yml` match the Vercel project.
6. Push to `main` and let CI/CD run.
7. Smoke test: `/` loads, `/login` accepts a demo customer id, `/family` loads children, `/fx` lists trips.

### Backend deploys

The OutSystems backend is deployed from Service Studio or the Model API, separately from this repository. Publishing can require a manual confirmation in Service Studio. Frontend and backend are not versioned together; the live Playwright suite is the contract gate.

---

## 8. Local development

```bash
cd WeTrip
bun install
cp .env.example .env.local     # then fill WETRIP_SERVER_KEY
bun run dev                    # http://localhost:5173
```

Bun 1.4+ is the package manager and runs the app tooling. Node 22 is only needed for Playwright.

The Vite proxy forwards `/api/family`, `/api/fx`, `/api/budget`, `/api/trip`, `/api/insurance` and `/scantopay` to the same OutSystems host as production, adding the key from `.env.local`. The browser only ever sees same-origin paths, so there is no CORS.

Scan-to-Pay needs the camera, which requires HTTPS or localhost:

```bash
bun run dev:https              # HTTPS + LAN URL for a phone
```

`@vitejs/plugin-basic-ssl` uses a self-signed certificate; accept the warning on the phone.

`bun run preview` serves the built `dist/` and inherits the same proxy config. It is not a Vercel emulator: it does not run `api/proxy.js`, and it does not reproduce Vercel rewrites or function limits.

Useful checks before pushing:

```bash
bun run format:check
bun run lint
bun run build
```

---

## 9. Testing and verification

Playwright starts a production build served by `vite preview` on port 5199 (`bun run build && bun --bun vite preview --port 5199`). It reuses an existing server on that port if one is running.

| Command                                          | Scope                                             | Writes to the sandbox?                        |
| ------------------------------------------------ | ------------------------------------------------- | --------------------------------------------- |
| `bun run test:mocked` / `bun run test:ui:mocked` | Mocked browser specs, parallel                    | No                                            |
| `bun run test:ui`                                | `family.spec.js` live, read-only                  | No (reads)                                    |
| `bun run test:smartfx`                           | `smartfx-api.spec.js` live contract test          | Yes: trips, locks, a cancellation and a close |
| `bun run test:e2e`                               | Mocked project, then live project with one worker | Yes (live part)                               |
| `bun run test:atomic`                            | `scripts/test-atomic.mjs`, Family atomic          | Yes: synthetic links/rows                     |
| `bun run test:composite`                         | `scripts/test-composite.mjs`, Family composite    | Yes: moves sandbox money                      |
| `bun run test:trip`                              | `scripts/test-trip.mjs`, Trip composite           | Yes: moves sandbox money                      |
| `bun run test:analytics`                         | `scripts/test-analytics.mjs`, Analytics composite | Writes the data mart only; no money           |

Guidelines:

- All live suites share one sandbox. Do not run them in parallel; the CI workflow and Playwright's live project already serialize them.
- `test:atomic` deliberately uses synthetic `ATOMIC_TEST_*` identities. Do not point it at the demo parent/child; it creates links with fake accounts that break `GetChildren`.
- `test:composite`, `test:ui` and `test:smartfx` use the demo accounts.
- Run a live suite only when the change touches its contract. `test:composite` and `test:trip` move sandbox money.
- Mocked specs intercept at the browser with `page.route`, so they never reach a backend.

The E2E gate in CI runs the whole suite, including the live writer. A sandbox failure blocks production deployment.

---

## 10. Operations

### Observability

- Vercel function logs (dashboard) are the only server-side runtime signal. The proxy has no structured logging, request ids or latency metrics, and its 502 branch swallows the error.
- OutSystems Service Center logs cover composite and timer behaviour.
- No Sentry, OpenTelemetry, analytics, uptime check, alerting or log drain is configured.
- CI artifacts: Playwright traces in `test-results/` on failure; no HTML report upload.

### Limits

| Concern               | Current behaviour                                                            |
| --------------------- | ---------------------------------------------------------------------------- |
| Function duration     | Vercel plan default; not pinned. Slow composites surface as platform 504.    |
| Function memory       | Default; responses are buffered in memory.                                   |
| Request/response size | Vercel body limit (~4.5 MB), no streaming.                                   |
| Cold starts           | One small function; no keep-warm or min instances.                           |
| Region                | Not pinned; function-to-OutSystems latency varies.                           |
| Rate limiting         | None.                                                                        |
| Retries               | None at the proxy. Reads retry once in TanStack Query; payments never retry. |

### Rollback

Vercel keeps immutable deployments. To roll back:

1. Open the Vercel project → Deployments.
2. Promote a previous deployment to Production (or `vercel rollback` from the CLI).

Do **not** try to re-run CD for an older commit: the freshness guard fails if `origin/main` has moved, unless the only newer commits are docs-only. A revert commit on `main` is the Git-based route.

A frontend rollback does not revert OutSystems publishes, database rows, site properties or Vercel env changes.

### Change checklist

- Frontend-only change: `format:check`, `lint`, `build`, mocked specs.
- API contract change: the relevant live suite, then CI.
- Env/key change: update OutSystems, Vercel, GitHub and `.env.local`, then redeploy.
- New service: add it to `api/_services.js`, `src/lib/services.js` and `vercel.json` (all three), plus the dev proxy, and test locally before merging.

---

## 11. Troubleshooting

| Symptom                                                                      | Likely cause                                                                      | Check                                                                            |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Every API call fails with `Invalid API Key` or 401                           | `WETRIP_SERVER_KEY` missing/mismatched in Vercel, or an OutSystems site property  | Compare Vercel env, GitHub secret, `.env.local` and each module's site property  |
| Every API call returns `502 The service did not respond`                     | OutSystems host down, DNS/network failure, or an invalid upstream path            | Open the composite REST URL directly; check the OutSystems environment           |
| API call returns HTML instead of JSON                                        | Path did not match a rewrite, so the SPA fallback served `index.html`             | Confirm the path starts with `/api/<known service>` or `/scantopay`              |
| `Unknown service` 404                                                        | `service` query value is not one of the six names                                 | `api/_services.js`                                                               |
| Login says the customer cannot be found                                      | Wrong demo `CustomerId`, or the account is not open SGD `CASA`                    | Use a demo id; check `GetMyAccounts` output                                      |
| Parent family page fails with `SMUtBank error 400: Account record not found` | A pending link has no `ChildAccountId`; `GetChildren` still calls the balance API | Known backend gap; guard belongs in the composite                                |
| Deploy succeeds but production is old                                        | Vercel Git integration may have deployed independently, or CD was skipped         | Check the deployment's commit SHA in Vercel                                      |
| CI is green but production API calls fail                                    | CD has no smoke test; production env can differ from CI                           | Check Vercel env and function logs                                               |
| Camera does not open                                                         | Insecure context (plain HTTP on a LAN IP)                                         | Use `bun run dev:https`, or localhost                                            |
| Live Playwright fails only in CI                                             | Sandbox contention, missing key secret, or an OutSystems/Vercel key mismatch      | Re-run; verify the `WETRIP_SERVER_KEY` value and `concurrency: e2e-live-sandbox` |

---

## 12. Security posture

Known and accepted for a course demo, but worth stating:

1. **Open proxy.** `/api/proxy` is publicly reachable, has no caller authentication or rate limit, and injects the shared key for any known service path. `path` is only stripped of leading slashes, so sibling paths on the OutSystems host are reachable.
2. **Unsigned session.** The token is `customerId:accountId:displayName` in `sessionStorage`; anyone can write their own. The backend `ValidateSessionStub` trusts it.
3. **Sandbox in production.** Production serves the `smuedu-dev` environment and shares its data with local dev, CI and previews.
4. **No security headers or CSP.** `vercel.json` defines no headers; the bundle has no CSP meta tag.
5. **Secrets are long-lived.** `VERCEL_TOKEN` is a static secret, not OIDC; `WETRIP_SERVER_KEY` is duplicated across OutSystems, Vercel, GitHub and local files. Rotation is manual.
6. **No secret scanning.** Pre-commit runs formatting and linting only. Keep `.env.local` and untracked helper scripts out of Git.

Hardening, if this ever leaves the sandbox: authenticate callers at the proxy, allowlist upstream paths, add timeouts and logging, replace the stub token with a signed session, pin security headers, and split dev/staging/production backends.
