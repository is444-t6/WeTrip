import { expect, test } from '@playwright/test'

// Scan to Pay. PayNow and PayLater move real sandbox money, so everything here is
// mocked: mockApi answers every /scantopay/ request in the browser and none of
// them reach the bank. Keep it that way.
const DEMO_CUSTOMER = '0000002996'
const RAMEN_QR = '{"merchantCode":"M001","amount":1200,"currency":"JPY"}'
const USJ_QR = '{"merchantCode":"M003","amount":4500,"currency":"JPY"}'
const OPEN_QR = '{"merchantCode":"M002","amount":0,"currency":"JPY"}'

const ramenPreview = {
  merchantCode: 'M001',
  merchantName: 'Ichiran Ramen Shibuya',
  merchantCategory: 'Food',
  amount: 1200,
  currency: 'JPY',
  walletAccountId: '0000006816',
  walletBalance: 100000,
  sufficientBalance: true,
  amountSGD: 9.72,
  rateFound: true,
  bnplEligible: false,
}

const usjPreview = {
  ...ramenPreview,
  merchantCode: 'M003',
  merchantName: 'Universal Studios Japan',
  amount: 4500,
  amountSGD: 36.45,
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
    {
      numberOfMonths: 12,
      monthlyInstallment: 380.3,
      totalInterest: 63.63,
      maturityDate: '2027-11-07',
    },
  ],
}

const paid = {
  transactionId: '0000427916',
  paymentRecordId: 2,
  merchantName: 'Ichiran Ramen Shibuya',
  amount: 1200,
  currency: 'JPY',
  amountSGD: 9.72,
  balanceBefore: 100000,
  balanceAfter: 98799.95,
}

const planned = {
  bnplPlanId: 2,
  paymentRecordId: 3,
  merchantName: 'Universal Studios Japan',
  principal: 4500,
  currency: 'JPY',
  numberOfMonths: 6,
  monthlyInstallment: 755.7,
  totalInterest: 34.19,
  maturityDate: '2027-05-07',
  standingInstructionId: '178',
  firstRepaymentDate: '2026-12-07',
}

const json = (body) => (route) => route.fulfill({ json: body })
const apiError = (message) => (route) =>
  route.fulfill({ status: 500, json: { Errors: [message], StatusCode: 500 } })

// A regex, because a '**/scantopay/**' glob would also catch the app's own source
// files under /src/features/scantopay/.
async function mockApi(page, handlers) {
  const calls = []
  await page.route(/^https?:\/\/[^/]+\/scantopay\//, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const name = url.pathname.split('/').pop()
    calls.push({
      name,
      customerId: url.searchParams.get('CustomerId'),
      body: request.postDataJSON(),
    })
    const handler = handlers[name] ?? apiError(`Unmocked call to ${name}`)
    await handler(route)
  })
  return calls
}

const namesOf = (calls) => calls.map((call) => call.name)

async function pasteQr(page, text) {
  await page.goto('/pay')
  await page.getByLabel('Or paste the QR text').fill(text)
  await page.getByRole('button', { name: 'Continue' }).click()
}

test('pasted QR previews and pays now', async ({ page }) => {
  const calls = await mockApi(page, { PreviewPayment: json(ramenPreview), PayNow: json(paid) })

  await pasteQr(page, RAMEN_QR)
  await expect(page.getByText('Ichiran Ramen Shibuya')).toBeVisible()
  await expect(page.getByText('JPY 1200.00')).toBeVisible()
  await expect(page.getByText('SGD 9.72')).toBeVisible()
  await expect(page.getByText('0000006816')).toBeVisible()
  await expect(page.getByText('JPY 100000.00')).toBeVisible()

  await page.getByRole('button', { name: 'Pay now' }).click()
  await expect(page.getByText('Payment successful')).toBeVisible()
  await expect(page.getByText('0000427916')).toBeVisible()
  await expect(page.getByText('JPY 98799.95')).toBeVisible()

  expect(namesOf(calls)).toEqual(['PreviewPayment', 'PayNow'])
  expect(calls[1]).toMatchObject({
    customerId: DEMO_CUSTOMER,
    body: { qrText: RAMEN_QR, amount: 0, numberOfMonths: 0 },
  })

  await page.getByRole('button', { name: 'Scan another' }).click()
  await expect(page.getByLabel('Or paste the QR text')).toHaveValue('')
})

test('pay later needs a plan and sends the chosen months', async ({ page }) => {
  const calls = await mockApi(page, { PreviewPayment: json(usjPreview), PayLater: json(planned) })

  await pasteQr(page, USJ_QR)
  const payLater = page.getByRole('button', { name: 'Pay later' })
  await expect(payLater).toBeDisabled()

  await page.getByRole('radio', { name: /^6 months/ }).check()
  await payLater.click()

  await expect(page.getByText('Pay-later plan created')).toBeVisible()
  await expect(page.getByText('2026-12-07')).toBeVisible()
  await expect(page.getByText('2027-05-07')).toBeVisible()
  expect(calls.at(-1)).toMatchObject({
    name: 'PayLater',
    body: { qrText: USJ_QR, amount: 0, numberOfMonths: 6 },
  })
})

test('open-amount QR asks for the amount before previewing', async ({ page }) => {
  const calls = await mockApi(page, {
    PreviewPayment: json({ ...ramenPreview, merchantName: 'Don Quijote Shinjuku', amount: 800 }),
    PayNow: json(paid),
  })

  await pasteQr(page, OPEN_QR)
  await expect(page.getByLabel('Amount to pay JPY')).toBeVisible()
  expect(calls).toEqual([])

  const next = page.getByRole('button', { name: 'Continue' })
  await expect(next).toBeDisabled()
  await page.getByLabel('Amount to pay JPY').fill('800')
  await next.click()
  await expect(page.getByText('Don Quijote Shinjuku')).toBeVisible()

  await page.getByRole('button', { name: 'Pay now' }).click()
  await expect(page.getByText('Payment successful')).toBeVisible()
  expect(calls[0].body).toMatchObject({ qrText: OPEN_QR, amount: 800 })
  expect(calls[1].body).toMatchObject({ qrText: OPEN_QR, amount: 800 })
})

test('blocks pay now without funds and hides pay later when not eligible', async ({ page }) => {
  await mockApi(page, {
    PreviewPayment: json({ ...ramenPreview, sufficientBalance: false, rateFound: false }),
  })

  await pasteQr(page, RAMEN_QR)
  await expect(page.getByRole('button', { name: 'Pay now' })).toBeDisabled()
  await expect(page.getByText('Not enough in this wallet')).toBeVisible()
  await expect(page.getByText('Or split it')).toHaveCount(0)
  await expect(page.getByText('Approx.')).toHaveCount(0)
})

test('sends one payment on a double click and locks the screen while busy', async ({ page }) => {
  let finish
  const held = new Promise((resolve) => {
    finish = resolve
  })
  const calls = await mockApi(page, {
    PreviewPayment: json(usjPreview),
    PayNow: async (route) => {
      await held
      await route.fulfill({ json: paid })
    },
  })

  await pasteQr(page, USJ_QR)
  await page.getByRole('button', { name: 'Pay now' }).dblclick()

  await expect(page.getByRole('button', { name: 'Paying…' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  await expect(page.getByRole('radio', { name: /^3 months/ })).toBeDisabled()
  await expect(page.getByRole('status')).toContainText('2–5 seconds')

  finish()
  await expect(page.getByText('Payment successful')).toBeVisible()
  expect(namesOf(calls).filter((name) => name === 'PayNow')).toHaveLength(1)
})

test('shows the API error when a QR is rejected', async ({ page }) => {
  await mockApi(page, { PreviewPayment: apiError('This is not a WeTrip QR code') })

  await pasteQr(page, 'not a wetrip qr')
  await expect(page.getByText('This is not a WeTrip QR code')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
})

test('shows the API error when a payment is refused', async ({ page }) => {
  await mockApi(page, {
    PreviewPayment: json(ramenPreview),
    PayNow: apiError('Insufficient balance in wallet 0000006816'),
  })

  await pasteQr(page, RAMEN_QR)
  await page.getByRole('button', { name: 'Pay now' }).click()
  await expect(page.getByText('Insufficient balance in wallet 0000006816')).toBeVisible()
  await expect(page.getByText('may still have gone through')).toHaveCount(0)
})

test('warns and does not retry when a payment response is lost', async ({ page }) => {
  const calls = await mockApi(page, {
    PreviewPayment: json(ramenPreview),
    PayNow: (route) => route.abort(),
    GetHistory: json({ payments: [], bnplPlans: [] }),
  })

  await pasteQr(page, RAMEN_QR)
  await page.getByRole('button', { name: 'Pay now' }).click()
  await expect(page.getByText('may still have gone through')).toBeVisible()
  await expect(page.getByRole('link', { name: 'My Payments' }).last()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay now' })).toBeEnabled()
  expect(namesOf(calls).filter((name) => name === 'PayNow')).toHaveLength(1)
})

test('uses the signed-in customer instead of the demo one', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('wetrip_session', '0000001111:0000002222:Test')
  })
  const calls = await mockApi(page, { GetHistory: json({ payments: [], bnplPlans: [] }) })

  await page.goto('/pay/history')
  await expect(page.getByText('No payments yet.')).toBeVisible()
  await expect(page.getByText('0000001111')).toBeVisible()
  await expect(page.getByText('(demo)')).toHaveCount(0)
  expect(calls[0].customerId).toBe('0000001111')
})

test('My Payments lists payments and plans', async ({ page }) => {
  await mockApi(page, {
    GetHistory: json({
      payments: [
        {
          Id: 3,
          MerchantName: 'Universal Studios Japan',
          Amount: 400,
          Currency: 'JPY',
          AmountSGD: 3.24,
          PaymentType: 'BNPL',
          TransactionId: '0000427933',
          BNPLPlanId: 2,
          DateTime: '2026-11-07T04:04:44Z',
        },
        {
          Id: 2,
          MerchantName: 'Ichiran Ramen Shibuya',
          Amount: 1200,
          Currency: 'JPY',
          AmountSGD: 9.72,
          PaymentType: 'PAYNOW',
          TransactionId: '0000427916',
          DateTime: '2026-11-06T04:04:44Z',
        },
      ],
      bnplPlans: [
        {
          Id: 2,
          MerchantName: 'Universal Studios Japan',
          Principal: 400,
          Currency: 'JPY',
          NumberOfMonths: 3,
          MonthlyInstallment: 133.91,
          TotalInterest: 1.73,
          MaturityDate: '2027-02-07',
          Status: 'ACTIVE',
          CreatedOn: '2026-11-07T04:04:44Z',
        },
      ],
    }),
  })

  await page.goto('/pay/history')
  await expect(page.getByText('0000427933')).toBeVisible()
  await expect(page.getByText('0000427916')).toBeVisible()
  await expect(page.locator('.badge', { hasText: 'Pay later' })).toHaveCount(1)
  await expect(page.locator('.badge', { hasText: 'Pay now' })).toHaveCount(1)
  await expect(page.getByText('JPY 133.91')).toBeVisible()
  await expect(page.locator('.badge', { hasText: 'ACTIVE' })).toBeVisible()
  await expect(page.getByText('2027-02-07')).toBeVisible()
})

test('My Payments shows the API error', async ({ page }) => {
  await mockApi(page, { GetHistory: apiError('Invalid API Key') })

  await page.goto('/pay/history')
  await expect(page.getByText('Invalid API Key')).toBeVisible()
})

test('nav reaches both screens', async ({ page }) => {
  await mockApi(page, { GetHistory: json({ payments: [], bnplPlans: [] }) })

  await page.goto('/pay')
  await page.getByRole('link', { name: 'My Payments' }).click()
  await expect(page.getByRole('heading', { name: 'My Payments' })).toBeVisible()
  await page.getByRole('link', { name: 'Scan to Pay', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Scan to Pay' })).toBeVisible()
})
