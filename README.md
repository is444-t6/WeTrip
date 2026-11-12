# WeTrip

A student travel-fintech prototype for the IS444 group project: family accounts, SmartFX trip forwards, trip budgets, travel insurance and Scan-to-Pay. The React SPA in this repository talks to six OutSystems composite services layered over the SMU tBank (`SMUtBank`) sandbox.

React 19 · Vite 8 · TanStack Router · TanStack Query · plain `fetch` · no UI kit.

## Quick start

```bash
npm install
cp .env.example .env.local     # then set WETRIP_SERVER_KEY
npm run dev                    # http://localhost:5173
```

The dev server proxies every API path to OutSystems and adds the key server-side, so there is no CORS and no secret in the browser bundle.

Open `/login`, enter a demo customer's `CustomerId`, and the app looks up their SGD deposit account and stores a stub session. For the Scan-to-Pay camera, use `npm run dev:https` and open the LAN URL on a phone.

## Scripts

| Command                                                                 | What                                                      |
| ----------------------------------------------------------------------- | --------------------------------------------------------- |
| `npm run dev`                                                           | Vite dev server with the API proxy                        |
| `npm run dev:https`                                                     | HTTPS + LAN URL for the phone camera                      |
| `npm run build`                                                         | Production build into `dist/`                             |
| `npm run lint` / `npm run format` / `npm run format:check`              | oxlint / oxfmt                                            |
| `npm run test:mocked` / `npm run test:ui:mocked`                        | Mocked browser specs, no backend                          |
| `npm run test:ui`                                                       | Live read-only Family UI suite                            |
| `npm run test:e2e`                                                      | All specs (mocked, then live; live writes to the sandbox) |
| `npm run test:atomic` / `test:composite` / `test:trip` / `test:smartfx` | API contract suites; several write to the shared sandbox  |

Run `npm run format:check`, `npm run lint` and `npm run build` before pushing. Live suites are serialized because they share one sandbox.

## Docs

| Doc                                          | Contents                                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | C4 context/container/component diagrams, OutSystems module boundaries, data model and ERDs, cross-cutting rules |
| [docs/features/](docs/features/README.md)    | One page per feature: routes, API contract, query keys, rules, tests, known issues                              |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)     | Vercel topology, env vars and keys, CI/CD, deploy/rollback, test suites, troubleshooting                        |
| [docs/DESIGN.md](docs/DESIGN.md)             | YouTrip design system and application-layer rules                                                               |
| [PRODUCT.md](PRODUCT.md)                     | Product truth: users, scope, evidence, limitations                                                              |
| [AGENTS.md](AGENTS.md)                       | Working rules for contributors and coding agents                                                                |
