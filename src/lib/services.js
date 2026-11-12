import { createClient } from './http'

// Every backend service the app talks to, configured in one place: where it lives,
// which key it gets, how it wants authentication sent, and whether its JSON is
// normalised. A feature's api.js asks for its service by name instead of building
// its own client, so changing a base URL or auth style is a one-line edit here.
//
// Every base is a same-origin path (/api/<name>): Vite forwards it in dev
// (vite.config.js) and Vercel rewrites it in production (vercel.json), so the
// browser never calls OutSystems directly. A VITE_*_API_BASE variable overrides one.
// Outside Vite (the plain-Node unit tests import helpers from api modules) there is no env.
const env = import.meta.env ?? {}

// SmartFX, Budget and Insurance fall back to the Family key when they have none of their own.
const familyKey = env.VITE_FAMILY_API_KEY

export const SERVICES = {
  family: {
    base: env.VITE_FAMILY_API_BASE || '/api/family',
    apiKey: familyKey,
    normalize: true,
  },
  // SmartFX cannot read request headers, so it takes the key and token as query/body fields.
  fx: {
    base: env.VITE_FX_API_BASE || '/api/fx',
    apiKey: env.VITE_FX_API_KEY || familyKey,
    auth: 'params',
  },
  budget: {
    base: env.VITE_BUDGET_API_BASE || '/api/budget',
    apiKey: env.VITE_BUDGET_API_KEY || familyKey,
    normalize: true,
  },
  insurance: {
    base: env.VITE_INSURANCE_API_BASE || '/api/insurance',
    apiKey: env.VITE_INSURANCE_API_KEY || familyKey,
    normalize: true,
  },
  // Cross-feature trip flows (plan, overview, pay on a trip, close). Same key as Family.
  trip: {
    base: env.VITE_TRIP_API_BASE || '/api/trip',
    apiKey: env.VITE_TRIP_API_KEY || familyKey,
    normalize: true,
  },
  // Scan to Pay lives in a separate OutSystems environment, with its own key.
  scantopay: {
    base: env.VITE_SCANTOPAY_API_BASE || '/scantopay',
    apiKey: env.VITE_SCANTOPAY_KEY,
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
