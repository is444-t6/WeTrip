import { createClient } from './http'

// Every backend service the app talks to, configured in one place: where it lives,
// how it wants the session sent, and whether its JSON is normalised. A feature's api.js asks for its service by name instead of building
// its own client, so changing a base URL or auth style is a one-line edit here.
//
// Every base is a same-origin path (/api/<name>): Vite forwards it in dev
// (vite.config.js) and Vercel rewrites it in production (vercel.json), so the
// browser never calls OutSystems directly. Nothing here reads import.meta.env:
// touching it would inline every VITE_* value, keys included, into the bundle.
// Composite keys are added by that proxy (api/proxy.js, vite.config.js), never here,
// so no key ships in the browser bundle.
export const SERVICES = {
  family: {
    base: '/api/family',
    normalize: true,
  },
  // SmartFX cannot read request headers, so the token rides in the query (the proxy adds the key).
  fx: {
    base: '/api/fx',
    auth: 'params',
  },
  budget: {
    base: '/api/budget',
    normalize: true,
  },
  insurance: {
    base: '/api/insurance',
    normalize: true,
  },
  // Cross-feature trip flows (plan, overview, pay on a trip, close).
  trip: {
    base: '/api/trip',
    normalize: true,
  },
  // Scan to Pay has its own key, added by the proxy.
  scantopay: {
    base: '/scantopay',
    normalize: true,
  },
  // Trip analytics data mart: ETL refresh and the aggregate insights.
  analytics: {
    base: '/api/analytics',
    normalize: true,
  },
}

// A client for one service. `overrides` is for the odd call that needs a different
// token, e.g. sign-in looks accounts up before there is a session.
export function serviceClient(name, overrides = {}) {
  const config = SERVICES[name]
  if (!config) throw new Error(`Unknown service "${name}"`)
  return createClient({ ...config, ...overrides })
}
