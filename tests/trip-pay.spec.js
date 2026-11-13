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

const PREVIEW = {
  merchantCode: 'M001',
  merchantName: 'Ichiran Ramen Shibuya',
  amount: 1200,
  currency: 'JPY',
  bnplEligible: false,
}
const BNPL_PREVIEW = {
  ...PREVIEW,
  merchantCode: 'M003',
  amount: 4500,
  bnplEligible: true,
  bnplOptions: [
    {
      numberOfMonths: 3,
      monthlyInstallment: 1506.5,
      totalInterest: 19.51,
      maturityDate: '2027-02-07',
    },
    {
      numberOfMonths: 6,
      monthlyInstallment: 755.7,
      totalInterest: 34.19,
      maturityDate: '2027-05-07',
    },
  ],
}
const PLAN = {
  Status: 'Created',
  Principal: 4500,
  Currency: 'JPY',
  NumberOfMonths: 3,
  MonthlyInstallment: 1506.5,
  TotalInterest: 19.51,
  FirstRepaymentDate: '2026-12-07T00:00:00',
  MaturityDate: '2027-02-07T00:00:00',
  LedgerPending: false,
}
const USJ_QR = '{"merchantCode":"M003","amount":4500,"currency":"JPY"}'

// PayOnTrip bodies are returned. The Scan-to-Pay preview and PayLaterOnTrip are
// recorded into opts.calls ({ name, customerId, body }). The preview is a regex,
// because a '**/scantopay/**' glob would also catch /src/features/scantopay/.
async function mockApi(page, payReply, opts = {}) {
  const bodies = []
  const { preview = PREVIEW, later = (route) => route.fulfill(json(PLAN)), calls = [] } = opts
  await page.route(/^https?:\/\/[^/]+\/scantopay\//, (route) => {
    const url = new URL(route.request().url())
    const name = url.pathname.split('/').pop()
    calls.push({
      name,
      customerId: url.searchParams.get('CustomerId'),
      body: route.request().postDataJSON(),
    })
    if (name === 'PreviewPayment') {
      return preview.Errors ? route.fulfill(json(preview, 500)) : route.fulfill(json(preview))
    }
    return route.fulfill(json({ Errors: [`unmocked ${name}`] }, 500))
  })
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
      if (name === 'PayLaterOnTrip') {
        calls.push({ name, body: route.request().postDataJSON() })
        return later(route)
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

test('an eligible QR offers each pay-later option next to Pay from trip', async ({ page }) => {
  await as(page, CHILD)
  const calls = []
  await mockApi(page, {}, { preview: BNPL_PREVIEW, calls })
  await page.goto('/pay?tripId=12')
  await scan(page, USJ_QR)
  await expect(page.getByRole('button', { name: 'Pay from trip' })).toBeEnabled()
  await expect(page.getByRole('radio', { name: /^3 months · JPY 1506\.50\/month/ })).toBeVisible()
  await expect(page.getByRole('radio', { name: /^6 months · JPY 755\.70\/month/ })).toBeVisible()
  await expect(page.getByText('Billed by the bank, not from your trip pot')).toBeVisible()
  expect(calls).toEqual([
    {
      name: 'PreviewPayment',
      customerId: '0000002828',
      body: expect.objectContaining({ qrText: USJ_QR }),
    },
  ])
})

test('an ineligible QR shows only Pay from trip', async ({ page }) => {
  await as(page, CHILD)
  await mockApi(page, {})
  await page.goto('/pay?tripId=12')
  await scan(page, RAMEN_QR)
  await expect(page.getByRole('button', { name: 'Pay from trip' })).toBeVisible()
  await expect(page.getByRole('radio')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pay later' })).toHaveCount(0)
  await expect(page.getByText('Billed by the bank')).toHaveCount(0)
})

test('a failed preview leaves Pay from trip working', async ({ page }) => {
  await as(page, CHILD)
  const bodies = await mockApi(
    page,
    { Status: 'Paid', Amount: 1200, Currency: 'JPY', SgdCharged: 10 },
    { preview: { Errors: ['Preview is down'] } },
  )
  await page.goto('/pay?tripId=12')
  await scan(page, RAMEN_QR)
  await page.getByRole('button', { name: 'Pay from trip' }).click()
  await expect(page.getByRole('status')).toContainText('JPY 1200.00 charged as SGD 10.00')
  expect(bodies).toHaveLength(1)
})

test('picking 3 months pays later: one PayLaterOnTrip, no trip payment, plan shown', async ({
  page,
}) => {
  await as(page, CHILD)
  const calls = []
  const bodies = await mockApi(page, {}, { preview: BNPL_PREVIEW, calls })
  await page.goto('/pay?tripId=12')
  await scan(page, USJ_QR)
  await page.getByLabel('Budget category').selectOption({ label: 'Food' })
  await expect(page.getByRole('button', { name: 'Pay later' })).toBeDisabled()
  await page.getByRole('radio', { name: /^3 months/ }).check()
  await page.getByRole('button', { name: 'Pay later' }).click()

  const status = page.getByRole('status')
  await expect(status).toContainText('Pay-later plan created')
  await expect(status).toContainText('3 × JPY 1506.50')
  await expect(status.locator('.row-between', { hasText: 'Total interest' })).toContainText(
    'JPY 19.51',
  )
  await expect(status.locator('.row-between', { hasText: 'First repayment' })).toContainText(
    '2026-12-07',
  )
  await expect(status.locator('.row-between', { hasText: 'Ends' })).toContainText('2027-02-07')

  const later = calls.filter((c) => c.name === 'PayLaterOnTrip')
  expect(later).toHaveLength(1)
  expect(later[0].body).toEqual({
    TripId: 12,
    MerchantCode: JSON.parse(USJ_QR).merchantCode,
    QrText: USJ_QR,
    Amount: 4500,
    NumberOfMonths: 3,
    CategoryId: 6,
    RequestId: expect.any(String),
  })
  expect(bodies).toHaveLength(0)
})

test('a rejected pay-later shows why, keeps the form and Pay from trip', async ({ page }) => {
  await as(page, CHILD)
  await mockApi(
    page,
    {},
    {
      preview: BNPL_PREVIEW,
      later: (route) => route.fulfill(json({ Errors: ['Over your pay-later limit'] }, 400)),
    },
  )
  await page.goto('/pay?tripId=12')
  await scan(page, USJ_QR)
  await page.getByRole('radio', { name: /^3 months/ }).check()
  await page.getByRole('button', { name: 'Pay later' }).click()
  await expect(page.getByRole('alert')).toHaveText('Over your pay-later limit')
  await expect(page.getByRole('button', { name: 'Pay from trip' })).toBeEnabled()
  await expect(page.getByRole('radio', { name: /^6 months/ })).toBeVisible()
})

test('a pay-later the bank declines shows its message and keeps the form', async ({ page }) => {
  await as(page, CHILD)
  await mockApi(
    page,
    {},
    {
      preview: BNPL_PREVIEW,
      later: (route) =>
        route.fulfill(json({ Status: 'Declined', Message: 'The bank did not accept the payment' })),
    },
  )
  await page.goto('/pay?tripId=12')
  await scan(page, USJ_QR)
  await page.getByRole('radio', { name: /^3 months/ }).check()
  await page.getByRole('button', { name: 'Pay later' }).click()
  await expect(page.getByRole('alert')).toHaveText('The bank did not accept the payment')
  await expect(page.getByRole('button', { name: 'Pay from trip' })).toBeEnabled()
})

test('a lost pay-later reply locks both buttons and is never resent', async ({ page }) => {
  await as(page, CHILD)
  const calls = []
  await mockApi(page, {}, { preview: BNPL_PREVIEW, calls, later: (route) => route.abort('failed') })
  await page.goto('/pay?tripId=12')
  await scan(page, USJ_QR)
  await page.getByRole('radio', { name: /^3 months/ }).check()
  await page.getByRole('button', { name: 'Pay later' }).click()
  await expect(page.getByText('this payment may have gone through')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay from trip' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Pay later' })).toBeDisabled()
  await page.waitForTimeout(500)
  expect(calls.filter((c) => c.name === 'PayLaterOnTrip')).toHaveLength(1)
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
