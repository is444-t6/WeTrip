// Shared by predemo.ts and postdemo.ts: who the demo signs in as, the service
// URLs, a tiny HTTP helper and the state file that lets postdemo undo exactly
// what predemo did. Override any id with DEMO_* variables in .env.local.

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { env, field } from './_lib.mjs'

const ORIGIN = 'https://smuedu-dev.outsystemsenterprise.com'
export const KEY = env('WETRIP_SERVER_KEY')

export const PARENT = `${env('DEMO_PARENT_CUSTOMER_ID', '0000002169')}:${env('DEMO_PARENT_ACCOUNT_ID', '0000004554')}:Demo`
// 0000003003 (link 45) is the child whose trip wallets can carry a pay-later.
export const CHILD = `${env('DEMO_CHILD_CUSTOMER_ID', '0000003003')}:${env('DEMO_CHILD_ACCOUNT_ID', '0000006353')}:Demo`
export const LINK_ID = Number(env('DEMO_FAMILY_LINK_ID', '45'))
export const childAccount = () => CHILD.split(':')[1]
export const parentAccount = () => PARENT.split(':')[1]

const SVC = {
  family: `${ORIGIN}/WeTrip_Family_Composite/rest/Family`,
  trip: `${ORIGIN}/WeTrip_Trip_Composite/rest/Trip`,
  smartfx: `${ORIGIN}/WeTrip_SmartFX_Composite/rest/SmartFX`,
  fxAtomic: `${ORIGIN}/WeTrip_SmartFX_Atomic/rest/SmartFXData`,
  stpAtomic: `${ORIGIN}/WeTrip_ScanToPay_Atomic/rest/QRPaymentRecords`,
  analytics: `${ORIGIN}/WeTrip_Analytics_Composite/rest/Analytics`,
}

// One call. Every service gets the key and session as headers; SmartFX can't
// read headers, so it also gets them in the query. Throws with the server's
// own message on any non-2xx.
export async function api(
  svc: keyof typeof SVC,
  method: string,
  path: string,
  opts: { as?: string; body?: unknown } = {},
) {
  const token = opts.as ?? PARENT
  let url = `${SVC[svc]}/${path}`
  if (svc === 'smartfx')
    url += `${url.includes('?') ? '&' : '?'}${new URLSearchParams({ apiKey: KEY, sessionToken: token })}`
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Contacts-Key': KEY,
      'X-Session-Token': token,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const text = await res.text()
  let json: any
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    const msg = (json?.Errors ?? json?.errors)?.[0] ?? json?.raw ?? text
    throw new Error(`${svc} ${path.split('?')[0]} ${res.status}: ${String(msg).slice(0, 300)}`)
  }
  return json
}
export { field }

// The demo market switch: a per-trip percent the server moves the FX rates by
// (Trip.DemoRateShiftPct; the trip pages show a "Demo market" badge). UpdateTrip
// replaces the whole record, so send back everything GetTrip returned.
export const getTrip = (id: number) => api('fxAtomic', 'GET', `GetTrip?TripId=${id}`)
export async function setShift(id: number, pct: number) {
  const trip = await getTrip(id)
  if (!trip.Id) throw new Error(`no trip ${id}`)
  await api('fxAtomic', 'POST', 'UpdateTrip', { body: { ...trip, DemoRateShiftPct: pct } })
}
export const allTrips = (): Promise<any[]> => api('fxAtomic', 'GET', 'GetAllTrips')

export async function rate(currency: string, period = '1M') {
  const r = await api('smartfx', 'GET', `GetRate?${new URLSearchParams({ currency, period })}`)
  return { forward: Number(field(r, 'forwardRate')), spot: Number(field(r, 'spotRate')) }
}

// --- state: what predemo changed, so postdemo can undo exactly that ---
export type State = {
  createdAt: string
  trips: { id: number; label: string }[]
  topUpSgd: number
}
const STATE = new URL('../.demo-state.json', import.meta.url)
export const readState = (): State | null =>
  existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : null
export const writeState = (s: State) => writeFileSync(STATE, `${JSON.stringify(s, null, 2)}\n`)
export const clearState = () => rmSync(STATE, { force: true })

// --- output ---
let failures = 0
export async function step<T>(
  name: string,
  fn: () => Promise<T>,
  { soft = false } = {},
): Promise<T | undefined> {
  try {
    const r = await fn()
    console.log(`  \x1b[32m✓\x1b[0m ${name}`)
    return r
  } catch (e) {
    if (!soft) failures++
    console.log(
      `  ${soft ? '\x1b[33m!' : '\x1b[31m✗'}\x1b[0m ${name}\n      ${(e as Error).message}`,
    )
    return undefined
  }
}
export const failed = () => failures
export const note = (s: string) => console.log(`      ${s}`)
export const sgd = (n: number) => `SGD ${n.toFixed(2)}`
// Today's date in Singapore, and its midnight as a UTC instant.
export const sgtToday = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
export const sgtMidnightUtc = () => new Date(`${sgtToday()}T00:00:00+08:00`).toISOString()
export const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
