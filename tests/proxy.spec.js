import { expect, test } from '@playwright/test'
import { SERVICES, upstream } from '../api/_services.js'
import handler from '../api/proxy.js'

// The proxy that adds composite keys on the server (api/proxy.js on Vercel, the
// same map in vite.config.js). Pure Node: no browser, no backend.
const ENV = { VITE_FAMILY_API_KEY: 'fam' }

test('header services get X-Contacts-Key and keep their query string', () => {
  const t = upstream('trip', 'GetTripOverview', new URLSearchParams('TripId=12'), ENV)
  expect(t.url).toBe(
    'https://smuedu-dev.outsystemsenterprise.com/WeTrip_Trip_Composite/rest/Trip/GetTripOverview?TripId=12',
  )
  expect(t.headers).toEqual({ 'X-Contacts-Key': 'fam' })
})

test('SmartFX gets apiKey in the query, replacing anything the caller sent', () => {
  const t = upstream(
    'fx',
    'GetTrips',
    new URLSearchParams('familyLinkId=3&apiKey=evil&sessionToken=s'),
    ENV,
  )
  const u = new URL(t.url)
  expect(u.pathname).toBe('/WeTrip_SmartFX_Composite/rest/SmartFX/GetTrips')
  expect(u.searchParams.get('apiKey')).toBe('fam')
  expect(u.searchParams.get('sessionToken')).toBe('s')
  expect(t.headers).toEqual({})
})

test('the old VITE_FAMILY_API_KEY name still works; unknown services are refused', () => {
  expect(upstream('budget', 'x', '', ENV).headers['X-Contacts-Key']).toBe('fam')
  expect(upstream('scantopay', 'x', '', ENV).headers['X-Contacts-Key']).toBe('fam')
  expect(upstream('nope', 'x', '', ENV)).toBeNull()
  expect(Object.keys(SERVICES).sort()).toEqual([
    'budget',
    'family',
    'fx',
    'insurance',
    'scantopay',
    'trip',
  ])
})

test('WETRIP_SERVER_KEY is the one key for every service when it is set', () => {
  const env = { ...ENV, WETRIP_SERVER_KEY: 'one' }
  for (const s of ['family', 'budget', 'insurance', 'trip', 'scantopay'])
    expect(upstream(s, 'x', '', env).headers['X-Contacts-Key']).toBe('one')
  expect(new URL(upstream('fx', 'x', '', env).url).searchParams.get('apiKey')).toBe('one')
})

test('the Vercel handler forwards method, body and session, and adds the key', async () => {
  const seen = []
  const realFetch = globalThis.fetch
  const realEnv = { ...process.env }
  Object.assign(process.env, ENV)
  globalThis.fetch = async (url, init) => {
    seen.push({ url, init })
    return new Response('{"Status":"Paid"}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  const res = {
    statusCode: 0,
    headers: {},
    body: null,
    status(c) {
      this.statusCode = c
      return this
    },
    setHeader(k, v) {
      this.headers[k] = v
    },
    send(b) {
      this.body = b.toString()
    },
    json(o) {
      this.body = JSON.stringify(o)
    },
  }
  try {
    await handler(
      {
        url: '/api/proxy?service=trip&path=PayOnTrip',
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-session-token': 'c:a:n' },
        body: { TripId: 12 },
      },
      res,
    )
  } finally {
    globalThis.fetch = realFetch
    process.env = realEnv
  }
  expect(res.statusCode).toBe(200)
  expect(res.body).toBe('{"Status":"Paid"}')
  expect(seen[0].url).toMatch(/\/WeTrip_Trip_Composite\/rest\/Trip\/PayOnTrip$/)
  expect(seen[0].init.method).toBe('POST')
  expect(seen[0].init.body).toBe('{"TripId":12}')
  expect(seen[0].init.headers).toMatchObject({
    'X-Contacts-Key': 'fam',
    'X-Session-Token': 'c:a:n',
  })
})
