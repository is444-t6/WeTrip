import { expect, test } from '@playwright/test'
import { parseMerchantQr } from '../src/features/trips/trip.js'
import { tripIdFor } from '../src/features/insurance/storage.js'

// Paying on a trip (/pay?tripId=…). PayOnTrip moves real sandbox money, so every
// /api/ request here is answered in the browser and none reach the bank.
const CHILD = '0000002828:0000006064:Jamie'
const RAMEN_QR = '{"merchantCode":"M001","amount":1200,"currency":"JPY"}'
const OPEN_QR = '{"merchantCode":"M002","amount":0,"currency":"JPY"}'
const as = (page, v) => page.addInitScript((x) => sessionStorage.setItem('wetrip_session', x), v)
const json = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})
const OVERVIEW = {
  Trip: {
    Id: 12,
    Destination: 'Kyoto',
    Currency: 'JPY',
    Status: 'Locked',
    LockedSgd: 400,
    LockedForeign: 48000,
  },
  SpentForeign: 0,
  RemainingForeign: 48000,
  LockedRate: 120,
  CallerRole: 'Child',
}

async function mockApi(page, payReply) {
  const bodies = []
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const name = new URL(route.request().url()).pathname.split('/').pop()
      if (name === 'GetTripOverview') return route.fulfill(json(OVERVIEW))
      if (name === 'GetMyFamilyRole') return route.fulfill(json({ role: 'Child', FamilyLinkId: 3 }))
      if (name === 'PayOnTrip') {
        bodies.push(route.request().postDataJSON())
        return route.fulfill(json(payReply))
      }
      return route.fulfill(json({ Errors: [`unmocked ${name}`] }, 500))
    },
  )
  return bodies
}

async function scan(page, qr) {
  await page.getByLabel('Or paste the QR text').fill(qr)
  await page.getByRole('button', { name: 'Continue' }).click()
}

test('a trip payment sends the trip, merchant, amount, category and one request id', async ({
  page,
}) => {
  await as(page, CHILD)
  const bodies = await mockApi(page, {
    Status: 'Paid',
    Amount: 1200,
    Currency: 'JPY',
    SgdCharged: 10,
    RemainingForeign: 46800,
    TransactionId: 'T1',
  })
  await page.goto('/pay?tripId=12')
  await expect(page.getByRole('heading', { name: 'Pay on Kyoto' })).toBeVisible()
  await scan(page, RAMEN_QR)
  await expect(page.getByText('JPY 48000.00 left on this trip')).toBeVisible()
  await page.getByLabel('Budget category').selectOption({ label: 'Food' })
  await page.getByRole('button', { name: 'Pay from trip' }).click()

  await expect(page.getByRole('status')).toContainText('JPY 1200.00 charged as SGD 10.00')
  await expect(page.getByRole('status')).toContainText('JPY 46800.00 left on this trip')
  expect(bodies).toHaveLength(1)
  expect(bodies[0]).toMatchObject({ TripId: 12, MerchantCode: 'M001', Amount: 1200, CategoryId: 6 })
  expect(bodies[0].RequestId).toBeTruthy()
})

test('the Paid card shows the miles earned, and nothing when none were', async ({ page }) => {
  await as(page, CHILD)
  const reply = { Status: 'Paid', Amount: 1200, Currency: 'JPY', SgdCharged: 10, MilesEarned: 12 }
  await mockApi(page, reply)
  await page.goto('/pay?tripId=12')
  await scan(page, RAMEN_QR)
  await page.getByRole('button', { name: 'Pay from trip' }).click()
  await expect(page.getByRole('status')).toContainText('+12 miles')

  reply.MilesEarned = 0
  await page.getByRole('button', { name: 'Pay again' }).click()
  await scan(page, RAMEN_QR)
  await page.getByRole('button', { name: 'Pay from trip' }).click()
  await expect(page.getByRole('status')).toContainText('JPY 1200.00 charged as SGD 10.00')
  await expect(page.getByRole('status')).not.toContainText('mile')
})

test('an open-amount QR asks for the amount before paying', async ({ page }) => {
  await as(page, CHILD)
  const bodies = await mockApi(page, {
    Status: 'Paid',
    Amount: 500,
    Currency: 'JPY',
    SgdCharged: 4.17,
  })
  await page.goto('/pay?tripId=12')
  await scan(page, OPEN_QR)
  await expect(page.getByRole('button', { name: 'Pay from trip' })).toBeDisabled()
  await page.getByLabel('Amount (JPY)').fill('500')
  await page.getByRole('button', { name: 'Pay from trip' }).click()
  await expect.poll(() => bodies.length).toBe(1)
  expect(bodies[0]).toMatchObject({ MerchantCode: 'M002', Amount: 500 })
})

test('a decline keeps the form and shows why', async ({ page }) => {
  await as(page, CHILD)
  await mockApi(page, { Status: 'Declined', Message: 'Only 100.00 JPY left in the trip pot' })
  await page.goto('/pay?tripId=12')
  await scan(page, RAMEN_QR)
  await page.getByRole('button', { name: 'Pay from trip' }).click()
  await expect(page.getByText('Only 100.00 JPY left in the trip pot')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay from trip' })).toBeVisible()
})

test('a QR that is not a merchant code is rejected before anything is sent', async ({ page }) => {
  await as(page, CHILD)
  const bodies = await mockApi(page, {})
  await page.goto('/pay?tripId=12')
  await scan(page, 'hello')
  await expect(page.getByText('That QR is not a WeTrip merchant code.')).toBeVisible()
  expect(bodies).toHaveLength(0)
})

test('parseMerchantQr reads merchant QRs and rejects anything else', () => {
  expect(parseMerchantQr(RAMEN_QR)).toEqual({ merchantCode: 'M001', amount: 1200, currency: 'JPY' })
  expect(parseMerchantQr(OPEN_QR)).toMatchObject({ amount: 0 })
  expect(parseMerchantQr('{"amount":5}')).toBeNull()
  expect(parseMerchantQr('not json')).toBeNull()
})

test('tripIdFor only links a policy when the dates still match the trip', () => {
  const stored = { tripId: 12, startDate: '2027-04-01', endDate: '2027-04-14' }
  expect(tripIdFor(stored, { startDate: '2027-04-01', endDate: '2027-04-14' })).toBe(12)
  expect(tripIdFor(stored, { startDate: '2027-04-02', endDate: '2027-04-14' })).toBe(0)
  expect(tripIdFor({}, { startDate: '2027-04-01', endDate: '2027-04-14' })).toBe(0)
})
