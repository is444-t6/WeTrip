// Where each same-origin API path goes, and how its key is attached. Shared by the
// Vercel proxy function (api/proxy.js) and the Vite dev proxy (vite.config.js),
// so composite keys are added on the server and never ship in the browser bundle.
// The leading underscore keeps Vercel from deploying this file as a function.
export const ORIGIN = 'https://smuedu-dev.outsystemsenterprise.com'

// Every WeTrip module accepts one shared key, WETRIP_SERVER_KEY (each module's
// WETRIP_SERVER_KEY site property holds it). VITE_FAMILY_API_KEY is accepted as a
// fallback name for environments that still use it; it holds the same value.
const KEY = ['WETRIP_SERVER_KEY', 'VITE_FAMILY_API_KEY']
// keyIn: 'header' sends X-Contacts-Key; 'query' appends apiKey (the SmartFX
// composite cannot read request headers).
export const SERVICES = {
  family: {
    path: '/WeTrip_Family_Composite/rest/Family',
    key: KEY,
  },
  fx: {
    path: '/WeTrip_SmartFX_Composite/rest/SmartFX',
    key: KEY,
    keyIn: 'query',
  },
  budget: {
    path: '/WeTrip_Budget_Composite/rest/BudgetComposite',
    key: KEY,
  },
  insurance: {
    path: '/WeTrip_Insurance_Composite/rest/InsuranceAPI',
    key: KEY,
  },
  trip: {
    path: '/WeTrip_Trip_Composite/rest/Trip',
    key: KEY,
  },
  scantopay: {
    path: '/WeTrip_ScanToPay_Composite/rest/ScanToPay',
    key: KEY,
  },
}

const keyFor = (svc, env) => svc.key.map((name) => env[name]).find(Boolean) ?? ''

// The upstream URL and extra headers for one call. `query` is a URLSearchParams of
// the caller's own query string; any apiKey the caller sent is replaced.
export function upstream(service, path, query, env) {
  const svc = SERVICES[service]
  if (!svc) return null
  const params = new URLSearchParams(query)
  const headers = {}
  const key = keyFor(svc, env)
  if (svc.keyIn === 'query') params.set('apiKey', key)
  else headers['X-Contacts-Key'] = key
  const qs = params.toString()
  const clean = String(path ?? '').replace(/^\/+/, '')
  return { url: `${ORIGIN}${svc.path}/${clean}${qs ? `?${qs}` : ''}`, headers }
}
