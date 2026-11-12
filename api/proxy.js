import { upstream } from './_services.js'

// Production proxy for every composite (vercel.json rewrites /api/<service>/<path>
// and /scantopay/<path> here). It adds the composite key from the server's
// environment, forwards the session token and body, and returns the reply as is.
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const service = url.searchParams.get('service')
  const path = url.searchParams.get('path') ?? ''
  url.searchParams.delete('service')
  url.searchParams.delete('path')

  const target = upstream(service, path, url.searchParams, process.env)
  if (!target) return res.status(404).json({ Errors: ['Unknown service'] })

  const hasBody = !['GET', 'HEAD'].includes(req.method) && req.body !== undefined
  const body = hasBody
    ? typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body)
    : undefined
  const headers = { ...target.headers }
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type']
  if (req.headers['x-session-token']) headers['X-Session-Token'] = req.headers['x-session-token']

  try {
    const reply = await fetch(target.url, { method: req.method, headers, body })
    res.status(reply.status)
    res.setHeader('Content-Type', reply.headers.get('content-type') ?? 'application/json')
    res.send(Buffer.from(await reply.arrayBuffer()))
  } catch {
    // The composite never answered: a gateway failure, so the client treats a
    // payment as possibly completed and does not offer a blind retry.
    res.status(502).json({ Errors: ['The service did not respond'] })
  }
}
