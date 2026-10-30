import { test, expect } from '@playwright/test'

// API-level E2E for WeTrip_SmartFX_Composite. Drives the live composite the
// same way the frontend does and locks in the behaviour that works today.
//
// SIDE EFFECTS — it writes to the sandbox: one trip (plus the foreign-currency
// wallet CreateTrip opens at SMUtBank), one rate lock, one spend, one
// convert-back, and a second trip that is cancelled. Sandbox only.
//
// Run: npm run test:smartfx

const BASE = process.env.SMARTFX_BASE ?? 'https://smuedu-dev.outsystemsenterprise.com/WeTrip_SmartFX_Composite/rest/SmartFX'
const API_KEY = process.env.SMARTFX_API_KEY ?? 'changeme'

const PARENT = { id: process.env.PARENT_CUSTOMER_ID ?? '0000002169', account: process.env.PARENT_ACCOUNT_ID ?? '0000004554' }
const CHILD = { id: process.env.CHILD_CUSTOMER_ID ?? '0000002828' }
const FAMILY_LINK_ID = Number(process.env.FAMILY_LINK_ID ?? 1)
const CURRENCY = process.env.SMARTFX_CURRENCY ?? 'JPY'
const TENOR = process.env.SMARTFX_TENOR ?? '3M'

// Auth travels as query/body params, not headers (see docs/smartfx.md §6).
const auth = { apiKey: API_KEY, sessionToken: `${PARENT.id}:${PARENT.account}:E2E` }

function withAuth(path) {
  const sep = path.includes('?') ? '&' : '?'
  return `${BASE}/${path}${sep}${new URLSearchParams(auth).toString()}`
}

const get = (request, path) => request.get(withAuth(path))
const post = (request, path, data) => request.post(`${BASE}/${path}`, { data: { ...(data ?? {}), ...auth } })

const today = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10)
const near = (actual, expected, tolerance = 0.01) =>
  Math.abs(Number(actual) - Number(expected)) <= Math.abs(Number(expected)) * tolerance

test.describe.serial('SmartFX API', () => {
  /** @type {any} */ let quote
  /** @type {any} */ let trip

  test('GetRate returns spot and forward for a supported pair', async ({ request }) => {
    const res = await get(request, `GetRate?currency=${CURRENCY}&period=${TENOR}`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(Number(body.spotRate)).toBeGreaterThan(0)
    expect(Number(body.forwardRate)).toBeGreaterThan(0)
    expect(body.currency).toBe(CURRENCY)
    expect(body.period).toBe(TENOR)
    quote = body
  })

  test('GetRate rejects an unsupported currency (KRW has no benchmark rate)', async ({ request }) => {
    const res = await get(request, 'GetRate?currency=KRW&period=3M')
    expect(res.ok()).toBeFalsy()
    expect((await res.json()).Errors?.[0]).toMatch(/bad request/i)
  })

  test('CreateTrip opens a foreign wallet and starts Watching', async ({ request }) => {
    const res = await post(request, 'CreateTrip', {
      familyLinkId: FAMILY_LINK_ID,
      parentCustomerId: PARENT.id,
      childCustomerId: CHILD.id,
      destination: `E2E ${Date.now()}`,
      currency: CURRENCY,
      tripStartDate: today(120),
      tripEndDate: today(134),
      targetBudgetSgd: 400,
      targetRate: Number(quote.forwardRate),
      autoLockEnabled: true,
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.Id).toBeGreaterThan(0)
    expect(body.Status).toBe('Watching')
    expect(body.ForeignAccountId).toBeTruthy() // CreateTrip opens the trip wallet
    expect(body.Currency).toBe(CURRENCY)
    trip = body
  })

  test('GetTrips lists the trip for its family link', async ({ request }) => {
    const res = await get(request, `GetTrips?familyLinkId=${FAMILY_LINK_ID}`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBeTruthy()
    expect(body.some((t) => t.Id === trip.Id)).toBeTruthy()
  })

  test('GetTrip returns Trip, Locks and Spends', async ({ request }) => {
    const res = await get(request, `GetTrip?tripId=${trip.Id}`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.Trip?.Id).toBe(trip.Id)
    expect(Array.isArray(body.Locks ?? [])).toBeTruthy()
    expect(Array.isArray(body.Spends ?? [])).toBeTruthy()
  })

  test('LockNow quotes server-side and ignores the rate in the request', async ({ request }) => {
    const res = await post(request, 'LockNow', {
      tripId: trip.Id,
      sgdAmount: 150,
      rate: 999999, // deliberately absurd — the server must not use this
      period: TENOR,
      parentAccountId: PARENT.account,
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    const lock = body.Lock
    expect(lock?.Id).toBeGreaterThan(0)
    expect(Number(lock.SgdAmount)).toBe(150)
    expect(Number(lock.LockedRate)).not.toBe(999999)
    expect(near(lock.LockedRate, quote.forwardRate, 0.02)).toBeTruthy()
    expect(near(lock.ForeignAmount, 150 * lock.LockedRate, 0.001)).toBeTruthy()
    expect(body.Trip.Status).toBe('PartiallyLocked')
  })

  test('LockNow rejects an unknown trip', async ({ request }) => {
    const res = await post(request, 'LockNow', {
      tripId: 99_999_999,
      sgdAmount: 10,
      period: TENOR,
      parentAccountId: PARENT.account,
    })
    expect(res.ok()).toBeFalsy()
  })

  test('TripSpend records a spend against the pot', async ({ request }) => {
    const res = await post(request, 'TripSpend', {
      tripId: trip.Id,
      merchantAccountId: '0000009999',
      amount: 20,
      category: 'Food',
      narrative: 'e2e',
    })
    expect(res.status()).toBe(200)

    const spend = await res.json()
    expect(spend.Id).toBeGreaterThan(0)

    const detail = await (await get(request, `GetTrip?tripId=${trip.Id}`)).json()
    const saved = (detail.Spends ?? []).find((s) => s.Id === spend.Id)
    expect(saved).toBeTruthy()
    expect(Number(saved.TripId)).toBe(Number(trip.Id))
    expect(Number(saved.Amount)).toBe(20)
    expect(saved.Category).toBe('Food')
  })

  test('CloseTrip converts the pot back at the given rate', async ({ request }) => {
    const returnRate = Number(quote.spotRate)
    const res = await request.post(withAuth(`CloseTrip?tripId=${trip.Id}&rate=${returnRate}`))
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.Status).toBe('Completed')
    expect(Number(body.ReturnedForeign)).toBe(Number(body.LockedForeign))
    expect(near(body.ReturnedSgd, Number(body.LockedForeign) / returnRate, 0.01)).toBeTruthy()
  })

  test('CheckRatesNow reports how many active trips it checked', async ({ request }) => {
    const res = await request.post(withAuth('CheckRatesNow'))
    expect(res.status()).toBe(200)

    // The single body output is a bare integer, so the payload is the count.
    const checked = Number(await res.text())
    expect(Number.isFinite(checked)).toBeTruthy()
    expect(checked).toBeGreaterThanOrEqual(0)
  })

  test('CancelTrip marks a fresh trip Cancelled', async ({ request }) => {
    const created = await post(request, 'CreateTrip', {
      familyLinkId: FAMILY_LINK_ID,
      parentCustomerId: PARENT.id,
      childCustomerId: CHILD.id,
      destination: `E2E cancel ${Date.now()}`,
      currency: CURRENCY,
      tripStartDate: today(150),
      tripEndDate: today(160),
      targetBudgetSgd: 50,
      targetRate: Number(quote.forwardRate),
      autoLockEnabled: false,
    })
    expect(created.status()).toBe(200)
    const { Id } = await created.json()

    const res = await request.post(withAuth(`CancelTrip?tripId=${Id}`))
    expect(res.status()).toBe(200)

    const detail = await (await get(request, `GetTrip?tripId=${Id}`)).json()
    expect(detail.Trip.Status).toBe('Cancelled')
  })
})
