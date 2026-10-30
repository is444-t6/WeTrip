import { getSessionToken } from '../features/family/session'

// OutSystems serialises structure attributes with their declared names, which
// in these modules is PascalCase. The components speak camelCase, so normalise
// every response at the client boundary.
export function decap(obj) {
  if (Array.isArray(obj)) return obj.map(decap)
  if (!obj || typeof obj !== 'object') return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k.charAt(0).toLowerCase() + k.slice(1)] = decap(v)
  }
  return out
}

// One HTTP client shape for every WeTrip composite: API key + stub session
// token, OutSystems `Errors[0]` surfaced as the thrown message.
// `auth: 'params'` sends them as query/body fields instead of headers — the
// SmartFX composite can't read request headers without a cross-module
// dependency on HTTPRequestHandler.
export function createClient({ base, apiKey, getToken = getSessionToken, auth = 'header', normalize = false }) {
  async function call(method, path, body) {
    const token = getToken()
    let url = `${base}/${path}`
    let payload = body

    if (auth === 'params') {
      if (method === 'GET') {
        const q = new URLSearchParams({ apiKey, sessionToken: token })
        url += (path.includes('?') ? '&' : '?') + q.toString()
      } else {
        payload = { ...body, apiKey, sessionToken: token }
      }
    }

    const res = await fetch(url, {
      method,
      headers:
        auth === 'params'
          ? { 'Content-Type': 'application/json' }
          : {
              'Content-Type': 'application/json',
              'X-Contacts-Key': apiKey,
              'X-Session-Token': token,
            },
      body: payload ? JSON.stringify(payload) : undefined,
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = data?.Errors?.[0] || `Request failed (${res.status})`
      throw new Error(message)
    }
    return normalize ? decap(data) : data
  }

  function qs(params) {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    if (entries.length === 0) return ''
    return '?' + new URLSearchParams(entries).toString()
  }

  return { call, qs }
}
