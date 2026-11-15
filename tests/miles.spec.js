import { expect, test } from '@playwright/test'

// WeTrip Miles. RedeemReward can move real sandbox money (cashback), so every
// /api/miles/ request is answered in the browser and none reach OutSystems.
const SESSION = '0000002169:0000004554:Tester'

const rewards = [
  {
    rewardCode: 'CASH5',
    name: 'S$5 Cashback',
    description: 'S$5 credited to your bank account',
    rewardType: 'CASHBACK',
    milesCost: 500,
    cashValue: 5,
  },
  {
    rewardCode: 'CASH10',
    name: 'S$10 Cashback',
    description: 'S$10 credited to your bank account',
    rewardType: 'CASHBACK',
    milesCost: 950,
    cashValue: 10,
  },
  // OutSystems leaves out cashValue when it is 0.
  {
    rewardCode: 'FXWAIVER',
    name: 'FX Fee Waiver',
    description: 'Zero fees on your next currency conversion',
    rewardType: 'FX_FEE_WAIVER',
    milesCost: 300,
  },
]

const mine = (balance, transactions = []) => ({
  customerId: '0000002169',
  ...(balance ? { balance } : {}),
  ...(transactions.length ? { transactions } : {}),
})

const earned = {
  id: 1,
  transactionType: 'EARN',
  miles: 620,
  source: 'SMUTBANK',
  reference: 'T1',
  description: 'Ichiran Ramen (620.00 SGD)',
  createdOn: '2026-11-10T03:00:00Z',
}

const json = (body) => (route) => route.fulfill({ json: body })
const apiError = (message) => (route) =>
  route.fulfill({ status: 500, json: { Errors: [message], StatusCode: 500 } })

// A regex, so the app's own /src/features/miles/ files are not intercepted.
async function mockApi(page, handlers) {
  const calls = []
  await page.route(/^https?:\/\/[^/]+\/api\/miles\//, async (route) => {
    const request = route.request()
    const name = new URL(request.url()).pathname.split('/').pop()
    calls.push({
      name,
      key: request.headers()['x-contacts-key'],
      token: request.headers()['x-session-token'],
      body: request.postDataJSON(),
    })
    const handler = handlers[name] ?? apiError(`Unmocked call to ${name}`)
    await handler(route)
  })
  return calls
}

const signIn = (page) =>
  page.addInitScript((x) => sessionStorage.setItem('wetrip_session', x), SESSION)

test('signed-out visitors are asked to sign in', async ({ page }) => {
  await page.goto('/miles')
  await expect(page.getByText("You're not signed in yet.")).toBeVisible()
})

test('a new customer sees zero miles and locked rewards', async ({ page }) => {
  await signIn(page)
  const calls = await mockApi(page, { GetMyMiles: json(mine(0)), GetRewards: json(rewards) })

  await page.goto('/miles')
  await expect(page.getByText('0 miles', { exact: true })).toBeVisible()
  await expect(page.getByText('No miles yet.')).toBeVisible()
  await expect(page.getByText('300 more miles needed')).toBeVisible()
  for (const button of await page.getByRole('button', { name: 'Redeem' }).all()) {
    await expect(button).toBeDisabled()
  }
  expect(calls.find((c) => c.name === 'GetMyMiles').token).toBe(SESSION)
})

test('syncing adds miles and refreshes the balance', async ({ page }) => {
  await signIn(page)
  let synced = false
  const calls = await mockApi(page, {
    GetMyMiles: (route) => route.fulfill({ json: synced ? mine(620, [earned]) : mine(0) }),
    GetRewards: json(rewards),
    SyncMiles: (route) => {
      synced = true
      return route.fulfill({ json: { newTransactions: 1, milesEarned: 620, balance: 620 } })
    },
  })

  await page.goto('/miles')
  await page.getByRole('button', { name: 'Sync my spending' }).click()
  await expect(page.getByText('Added 620 miles from 1 new transaction.')).toBeVisible()
  await expect(page.getByText('620 miles', { exact: true })).toBeVisible()
  await expect(page.getByText('Ichiran Ramen (620.00 SGD)')).toBeVisible()
  expect(calls.filter((c) => c.name === 'SyncMiles')).toHaveLength(1)
})

test('sync with nothing new says so', async ({ page }) => {
  await signIn(page)
  await mockApi(page, {
    GetMyMiles: json(mine(620, [earned])),
    GetRewards: json(rewards),
    SyncMiles: json({ balance: 620 }),
  })

  await page.goto('/miles')
  await page.getByRole('button', { name: 'Sync my spending' }).click()
  await expect(page.getByText("You're up to date. No new spending to add.")).toBeVisible()
})

test('redeeming cashback asks to confirm, then sends the reward code once', async ({ page }) => {
  await signIn(page)
  let redeemed = false
  const calls = await mockApi(page, {
    GetMyMiles: (route) => route.fulfill({ json: mine(redeemed ? 120 : 620, [earned]) }),
    GetRewards: json(rewards),
    RedeemReward: (route) => {
      redeemed = true
      return route.fulfill({
        json: {
          redemptionReference: 'RDM1',
          rewardName: 'S$5 Cashback',
          milesDeducted: 500,
          balance: 120,
          cashbackAmount: 5,
          bankTransactionId: '0000427999',
        },
      })
    },
  })

  await page.goto('/miles')
  const card = page.locator('.miles-reward', { hasText: 'S$5 Cashback' })
  await card.getByRole('button', { name: 'Redeem' }).click()
  await expect(card.getByText('Use 500 of your 620 miles for S$5 Cashback?')).toBeVisible()
  await card.getByRole('button', { name: 'Confirm' }).dblclick()

  await expect(
    page.getByText('Redeemed S$5 Cashback. SGD 5.00 has been credited to your account.'),
  ).toBeVisible()
  await expect(page.getByText('120 miles', { exact: true })).toBeVisible()
  const redeems = calls.filter((c) => c.name === 'RedeemReward')
  expect(redeems).toHaveLength(1)
  expect(redeems[0].body).toEqual({ rewardCode: 'CASH5' })
})

test('cancel leaves the reward unredeemed', async ({ page }) => {
  await signIn(page)
  const calls = await mockApi(page, {
    GetMyMiles: json(mine(620, [earned])),
    GetRewards: json(rewards),
  })

  await page.goto('/miles')
  const card = page.locator('.miles-reward', { hasText: 'FX Fee Waiver' })
  await card.getByRole('button', { name: 'Redeem' }).click()
  await card.getByRole('button', { name: 'Cancel' }).click()
  await expect(card.getByRole('button', { name: 'Redeem' })).toBeEnabled()
  expect(calls.map((c) => c.name)).not.toContain('RedeemReward')
})

test('backend errors are shown to the customer', async ({ page }) => {
  await signIn(page)
  await mockApi(page, {
    GetMyMiles: json(mine(620, [earned])),
    GetRewards: json(rewards),
    RedeemReward: apiError('Cashback rewards are not available yet. Please try again later.'),
  })

  await page.goto('/miles')
  const card = page.locator('.miles-reward', { hasText: 'S$10 Cashback' })
  await expect(card.getByText('330 more miles needed')).toBeVisible()
  const five = page.locator('.miles-reward', { hasText: 'S$5 Cashback' })
  await five.getByRole('button', { name: 'Redeem' }).click()
  await five.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'Cashback rewards are not available yet. Please try again later.',
  )
})

test('when the API is down, the error shows once and no empty boxes appear', async ({ page }) => {
  await signIn(page)
  await mockApi(page, {
    GetMyMiles: apiError('Invalid API Key'),
    GetRewards: apiError('Invalid API Key'),
  })

  await page.goto('/miles')
  await expect(page.getByRole('alert')).toHaveCount(1)
  await expect(page.getByRole('alert')).toHaveText('Invalid API Key')
  await expect(page.locator('.miles-row')).toHaveCount(0)
  await expect(page.getByText('No miles yet.')).toHaveCount(0)
})
