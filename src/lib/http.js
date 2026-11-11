import { getSessionToken } from '../features/auth/session'

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

// Backend errors can carry a whole upstream HTML page or a JSON blob
// ("SMUtBank error 400: {...}"). Surface the readable part, or a generic
// message when there isn't one.
export function friendlyError(raw, status) {
  const generic = `Something went wrong (${status}). Please try again.`
  if (typeof raw !== 'string' || !raw.trim()) return generic
  let msg = raw.trim()
  if (/<\s*(!doctype|html|body)/i.test(msg)) return generic
  const upstream = msg.match(/^[\w ]+ error \d+:\s*([\s\S]*)$/)
  if (upstream) {
    msg = upstream[1].trim()
    try {
      const parsed = JSON.parse(msg)
      msg = parsed?.Errors?.[0] || parsed?.Message || parsed?.message || ''
    } catch {
      // not JSON — keep the text as is
    }
  }
  if (!msg || msg.length > 200) return generic
  return msg
}

// One HTTP client shape for every WeTrip composite: API key + stub session
// token, OutSystems `Errors[0]` surfaced as the thrown message.
// `auth: 'params'` sends them as query/body fields instead of headers — the
// SmartFX composite can't read request headers without a cross-module
// dependency on HTTPRequestHandler.
export function createClient({
  base,
  apiKey,
  getToken = getSessionToken,
  auth = 'header',
  normalize = false,
}) {
  async function call(method, path, body) {
    const token = auth === 'none' ? '' : getToken()
    let url = `${base}/${path}`
    let payload = body

    if (auth === 'params') {
      // Every SmartFX REST method declares apiKey as a URL parameter — GET and
      // POST alike — so it always rides in the query string. sessionToken has
      // no server-side counterpart yet and is ignored.
      const q = new URLSearchParams({ apiKey, sessionToken: token })
      url += (path.includes('?') ? '&' : '?') + q.toString()
    }

    const res = await fetch(url, {
      method,
      headers:
        auth === 'none'
          ? payload
            ? { 'Content-Type': 'application/json' }
            : undefined
          : auth === 'params'
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
      // `status` lets callers tell a rejection from a gateway failure (502/503/504).
      throw Object.assign(new Error(friendlyError(data?.Errors?.[0], res.status)), {
        status: res.status,
      })
    }
    return normalize ? decap(data) : data
  }

  function qs(params) {
    const entries = Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== '',
    )
    if (entries.length === 0) return ''
    return '?' + new URLSearchParams(entries).toString()
  }

  return { call, qs }
}
