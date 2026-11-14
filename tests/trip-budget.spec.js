import { test, expect } from '@playwright/test'

// Fixed costs on the trip budget page (/budget/:id), against a faked backend: the
// fixed vs day-to-day split, the "Fixed" badge, and adding a fixed cost later
// through Trip.AddFixedCost. Nothing here reaches a server.
const PARENT = '0000002169:0000004554:'
const CHILD = '0000002828:0000006064:'
const ACCOMMODATION = 3
const FIXED = 5
const as = (page, v) => page.addInitScript((x) => sessionStorage.setItem('wetrip_session', x), v)
const json = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

const TRIP = {
  Id: 12,
  FamilyLinkId: 3,
  Destination: 'Kyoto',
  Currency: 'JPY',
  TripStartDate: '2027-04-01',
  TripEndDate: '2027-04-14',
  TargetBudgetSgd: 800,
  Status: 'Locked',
}
const line = (over) => ({
  CategoryId: 3,
  CategoryName: 'Accommodation',
  LimitAmount: 500,
  SpentAmount: 300,
  PercentUsed: 60,
  AlertLevel: 'OK',
  ...over,
})
// 300 of the 450 spent is fixed (SourceId 5); the other 150 is day-to-day.
const dash = (over = {}) => ({
  Summary: {
    TripId: 12,
    TotalLimit: 1000,
    TotalSpent: 450,
    TotalRemaining: 550,
    Lines: [line(), line({ CategoryId: 6, CategoryName: 'Food', SpentAmount: 150 })],
    ...over,
  },
  Expenses: [
    {
      Id: 1,
      ExpenseDate: '2026-11-02T10:00:00',
      MerchantName: 'Hotel',
      CategoryId: 3,
      Amount: 300,
      Currency: 'SGD',
      SourceId: FIXED,
    },
    {
      Id: 2,
      ExpenseDate: '2026-11-03T10:00:00',
      MerchantName: 'Ramen',
      CategoryId: 6,
      Amount: 150,
      Currency: 'SGD',
      SourceId: 1,
    },
  ],
})

// Each service answers by method name; AddFixedCost bodies are collected in `added`
// and every call name in `calls`.
async function mockApi(page, over = {}, { role = 'Parent', tripStatus = 'Locked' } = {}) {
  const added = []
  const calls = []
  const handlers = {
    GetMyFamilyRole: () => ({ role, FamilyLinkId: 3 }),
    GetChildren: () => [{ familyLinkId: 3, nickname: 'Jamie', status: 'Active' }],
    GetTrip: () => ({ Trip: { ...TRIP, Status: tripStatus }, Locks: [], Spends: [] }),
    GetDashboard: () => dash(),
    AddFixedCost: (route) => {
      added.push(route.request().postDataJSON())
      return {}
    },
    ...over,
  }
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const name = new URL(route.request().url()).pathname.split('/').pop()
      calls.push(name)
      const h = handlers[name]
      if (!h) return route.fulfill(json({ Errors: [`unmocked ${name}`] }, 500))
      const out = h(route)
      return route.fulfill(out?.__status ? json(out.body, out.__status) : json(out))
    },
  )
  return { added, calls }
}

const table = (page) => page.locator('.stack-table')
const form = (page) => page.getByLabel('Add a fixed cost', { exact: true })
async function fillCost(page, { name, category = 'Accommodation', amount }) {
  await form(page).getByLabel('Name').fill(name)
  await form(page).getByLabel('Category').selectOption({ label: category })
  await form(page).getByLabel('Amount (SGD)').fill(amount)
}
const submit = (page) => form(page).getByRole('button', { name: 'Add a fixed cost' })

test('the budget splits spending into fixed and day-to-day, and remaining stays as reported', async ({
  page,
}) => {
  await as(page, PARENT)
  await mockApi(page)
  await page.goto('/budget/12')
  const hero = page.locator('.hero')
  await expect(hero).toContainText('Fixed SGD 300.00')
  await expect(hero).toContainText('Day-to-day SGD 150.00')
  await expect(hero.locator('.hero-amount')).toHaveText('SGD 550.00')
  await expect(hero.locator('.hero-sub')).toHaveText('SGD 450.00 spent of SGD 1,000.00')
})

test('a budget with no fixed costs shows no split', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, {
    GetDashboard: () => ({ ...dash(), Expenses: [{ ...dash().Expenses[1] }] }),
  })
  await page.goto('/budget/12')
  await expect(page.getByText('Ramen')).toBeVisible()
  await expect(page.locator('.hero')).not.toContainText('Fixed')
})

test('only fixed-cost expenses get the Fixed badge', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page)
  await page.goto('/budget/12')
  const rows = table(page).locator('tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0).locator('.badge')).toHaveText('Fixed')
  await expect(rows.nth(0)).toContainText('Hotel')
  await expect(rows.nth(1).locator('.badge')).toHaveCount(0)
})

test('overspending shows a negative remaining and the OVER alert', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, {
    GetDashboard: () =>
      dash({
        TotalLimit: 430,
        TotalRemaining: -20,
        Lines: [line({ LimitAmount: 280, SpentAmount: 300, PercentUsed: 100, AlertLevel: 'OVER' })],
      }),
  })
  await page.goto('/budget/12')
  await expect(page.locator('.hero-amount')).toHaveText('-SGD 20.00')
  await expect(page.locator('.budget-line').getByText('Over', { exact: true })).toBeVisible()
})

test('the parent adds a fixed cost through AddFixedCost, not RecordSpending', async ({ page }) => {
  await as(page, PARENT)
  const { added, calls } = await mockApi(page)
  await page.goto('/budget/12')
  await expect(form(page)).toBeVisible()
  await fillCost(page, { name: 'Rail pass', amount: '120.50' })
  await submit(page).click()

  await expect(page.getByText('Fixed cost added.')).toBeVisible()
  expect(added).toHaveLength(1)
  expect(added[0]).toEqual({
    TripId: 12,
    Name: 'Rail pass',
    CategoryId: ACCOMMODATION,
    AmountSgd: 120.5,
    RequestId: expect.stringMatching(/\S/),
  })
  expect(calls).not.toContain('RecordSpending')
  // The budget is read again, and the form is empty for the next one.
  expect(calls.filter((c) => c === 'GetDashboard').length).toBeGreaterThanOrEqual(2)
  await expect(form(page).getByLabel('Name')).toHaveValue('')
})

test('resending the same fixed cost after a failure reuses its RequestId; editing it does not', async ({
  page,
}) => {
  await as(page, PARENT)
  const ids = []
  let fail = true
  await mockApi(page, {
    AddFixedCost: (route) => {
      ids.push(route.request().postDataJSON().RequestId)
      return fail ? { __status: 500, body: { Errors: ['Budget is unavailable'] } } : {}
    },
  })
  await page.goto('/budget/12')
  await fillCost(page, { name: 'Hotel', amount: '300' })
  await submit(page).click()
  await expect(page.getByText('Budget is unavailable')).toBeVisible()

  await submit(page).click()
  await expect.poll(() => ids.length).toBe(2)
  expect(ids[1]).toBe(ids[0])

  await form(page).getByLabel('Amount (SGD)').fill('310')
  await submit(page).click()
  await expect.poll(() => ids.length).toBe(3)
  expect(ids[2]).not.toBe(ids[0])

  fail = false
  await submit(page).click()
  await expect(page.getByText('Fixed cost added.')).toBeVisible()
})

test('the child sees fixed costs read-only', async ({ page }) => {
  await as(page, CHILD)
  await mockApi(page, {}, { role: 'Child' })
  await page.goto('/budget/12')
  await expect(page.locator('.hero')).toContainText('Fixed SGD 300.00')
  await expect(table(page).locator('tbody tr').first().locator('.badge')).toHaveText('Fixed')
  await expect(page.getByRole('heading', { name: 'Kyoto budget' })).toBeVisible()
  await expect(form(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add a fixed cost' })).toHaveCount(0)
})

test('a closed trip takes no new fixed cost', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, {}, { tripStatus: 'Completed' })
  await page.goto('/budget/12')
  await expect(page.getByRole('heading', { name: 'Kyoto budget' })).toBeVisible()
  await expect(form(page)).toHaveCount(0)
})
