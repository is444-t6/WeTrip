import { test, expect } from '@playwright/test'

// The "New trip goal" form on /fx, against a faked backend: category limits and
// fixed (upfront) costs, and what PlanTrip is sent. Nothing here reaches a server.
const PARENT = '0000002169:0000004554:'
const ACCOMMODATION = 3
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
  Status: 'Watching',
}

// Each service answers by method name; PlanTrip bodies are collected in `planned`.
async function mockApi(page, over = {}) {
  const planned = []
  const handlers = {
    GetMyFamilyRole: () => ({ role: 'Parent', FamilyLinkId: 3 }),
    GetChildren: () => [{ familyLinkId: 3, nickname: 'Jamie', status: 'Active' }],
    GetTrips: () => [],
    GetRate: () => ({ spotRate: 123.5, forwardRate: 121.05, period: '3M', currency: 'JPY' }),
    PlanTrip: (route) => {
      planned.push(route.request().postDataJSON())
      return TRIP
    },
    GetTripOverview: () => ({
      Trip: TRIP,
      Locks: [],
      Spends: [],
      HasBudget: false,
      Budget: {},
      Policies: [],
      CallerRole: 'Parent',
    }),
    MyInsurance: () => [],
    ...over,
  }
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const name = new URL(route.request().url()).pathname.split('/').pop()
      const h = handlers[name]
      return route.fulfill(h ? json(h(route)) : json({ Errors: [`unmocked ${name}`] }, 500))
    },
  )
  return planned
}

async function openForm(page) {
  await page.goto('/fx')
  await page.getByRole('button', { name: 'New trip goal' }).click()
}

// The trip basics, so only the budget split and fixed costs differ per test.
async function fillTrip(page, { budget = '1000', split = {} } = {}) {
  await page.getByLabel('Child', { exact: true }).selectOption({ label: 'Jamie' })
  await page.getByLabel('Destination').fill('Kyoto')
  await page.getByLabel('Depart').fill('2027-04-01')
  await page.getByLabel('Return').fill('2027-04-14')
  await page.getByLabel('Budget (SGD)', { exact: true }).fill(budget)
  await page.getByLabel(/^Target rate/).fill('120')
  for (const [category, limit] of Object.entries(split)) {
    await page.getByLabel(category, { exact: true }).fill(limit)
  }
}

const row = (page, n) => page.getByRole('group', { name: `Fixed cost ${n}`, exact: true })
const groups = (page) => page.getByRole('group', { name: /^Fixed cost \d+$/ })
async function addCost(page, n, { name, category = 'Accommodation', amount }) {
  await page.getByRole('button', { name: 'Add a fixed cost' }).click()
  await row(page, n).getByLabel('Name').fill(name)
  await row(page, n).getByLabel('Category').selectOption({ label: category })
  await row(page, n).getByLabel('Amount (SGD)').fill(amount)
}
const planButton = (page) => page.getByRole('button', { name: 'Plan trip' })

test.beforeEach(({ page }) => as(page, PARENT))

test('Add a fixed cost adds a row, up to ten, and Remove takes it away again', async ({ page }) => {
  await mockApi(page)
  await openForm(page)
  await expect(groups(page)).toHaveCount(0)

  const add = page.getByRole('button', { name: 'Add a fixed cost' })
  await add.click()
  await expect(row(page, 1).getByLabel('Name')).toBeVisible()
  await expect(row(page, 1).getByLabel('Category')).toBeVisible()
  await expect(row(page, 1).getByLabel('Amount (SGD)')).toBeVisible()

  for (let i = 2; i <= 10; i++) await add.click()
  await expect(groups(page)).toHaveCount(10)
  await expect(add).toBeDisabled()

  await page.getByRole('button', { name: 'Remove fixed cost 10', exact: true }).click()
  await expect(add).toBeEnabled()
  for (let i = 9; i >= 1; i--)
    await page.getByRole('button', { name: `Remove fixed cost ${i}`, exact: true }).click()
  await expect(groups(page)).toHaveCount(0)
})

test('fixed costs over a category limit say so and block Plan trip', async ({ page }) => {
  await mockApi(page)
  await openForm(page)
  await fillTrip(page, { split: { Accommodation: '200' } })
  await addCost(page, 1, { name: 'Hotel', amount: '300' })
  await expect(
    page.getByText('Fixed costs in Accommodation are more than its limit.'),
  ).toBeVisible()
  await expect(planButton(page)).toBeDisabled()

  // Several costs in one category add up against its limit.
  await row(page, 1).getByLabel('Amount (SGD)').fill('150')
  await expect(page.getByText(/Fixed costs in .* are more than its limit/)).toHaveCount(0)
  await expect(planButton(page)).toBeEnabled()
  await addCost(page, 2, { name: 'Extra night', amount: '60' })
  await expect(
    page.getByText('Fixed costs in Accommodation are more than its limit.'),
  ).toBeVisible()
  await expect(planButton(page)).toBeDisabled()
})

test('fixed costs that exactly fill a limit are fine, whatever the decimals', async ({ page }) => {
  await mockApi(page)
  await openForm(page)
  await fillTrip(page, { split: { Others: '0.3' } })
  await addCost(page, 1, { name: 'Pass', category: 'Others', amount: '0.1' })
  await addCost(page, 2, { name: 'Locker', category: 'Others', amount: '0.2' })
  await expect(page.getByText(/more than its limit/)).toHaveCount(0)
  await expect(planButton(page)).toBeEnabled()
})

test('limits that add up to more than the trip budget still block Plan trip', async ({ page }) => {
  await mockApi(page)
  await openForm(page)
  await fillTrip(page, { budget: '500', split: { Accommodation: '400', Food: '200' } })
  await expect(page.getByText('The categories add up to more than the trip budget.')).toBeVisible()
  await expect(planButton(page)).toBeDisabled()
})

test('PlanTrip is sent the fixed costs, with the category id and SGD amount', async ({ page }) => {
  const planned = await mockApi(page)
  await openForm(page)
  await fillTrip(page, { split: { Accommodation: '500' } })
  await addCost(page, 1, { name: '  Hotel ', amount: '300' })
  await planButton(page).click()

  await expect(page).toHaveURL(/\/trips\/12$/)
  expect(planned).toHaveLength(1)
  expect(planned[0].FixedCosts).toEqual([
    { Name: 'Hotel', CategoryId: ACCOMMODATION, AmountSgd: 300 },
  ])
  expect(planned[0].Budgets).toEqual([{ CategoryId: ACCOMMODATION, LimitAmount: 500 }])
  // A fully saved plan shows no warning on the trip page.
  await expect(page.getByRole('heading', { name: 'Kyoto' })).toBeVisible()
  await expect(page.getByText(/fixed cost.* saved/)).toHaveCount(0)
})

test('with no fixed cost rows PlanTrip is sent an empty list', async ({ page }) => {
  const planned = await mockApi(page)
  await openForm(page)
  await fillTrip(page)
  await planButton(page).click()
  await expect(page).toHaveURL(/\/trips\/12$/)
  expect(planned[0].FixedCosts).toEqual([])
})

test('the trip page says when a fixed cost was not saved', async ({ page }) => {
  await mockApi(page, { PlanTrip: () => ({ ...TRIP, FixedCostsFailed: 1 }) })
  await openForm(page)
  await fillTrip(page)
  await addCost(page, 1, { name: 'Hotel', amount: '300' })
  await planButton(page).click()
  await expect(page).toHaveURL(/\/trips\/12$/)
  await expect(
    page.getByText("1 fixed cost wasn't saved. Add it on the budget page."),
  ).toBeVisible()
})
