import { test, expect } from '@playwright/test'

// The internal insights page (/insights), against a faked WeTrip_Analytics_Composite.
// (tests/insights.spec.js is the Family insights unit spec, hence the different name.)
const as = (page, v) => page.addInitScript((x) => sessionStorage.setItem('wetrip_session', x), v)
const json = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

const RUN = {
  EtlRunId: 7,
  Status: 'Success',
  RowsExtracted: 120,
  RowsLoaded: 118,
  RowsRejected: 2,
  StartedOn: '2026-11-15T02:00:00',
  FinishedOn: '2026-11-15T02:01:00',
  Error: '',
}
const insights = (over = {}) => ({
  LastRun: RUN,
  LastSuccessOn: '2026-11-15T02:01:00',
  SpendSgd: 340.5,
  SavedVsSpotSgd: 12.34,
  TripsCount: 4,
  OverBudgetTripPct: 25,
  OverBudgetEligibleTrips: 4,
  ByCurrencyMonth: [
    { Currency: 'JPY', Month: '2026-10', SpendSgd: 200, SavedVsSpotSgd: 8.1 },
    { Currency: 'EUR', Month: '2026-11', SpendSgd: 140.5, SavedVsSpotSgd: 4.24 },
  ],
  ByCategory: [
    { Category: 'Food', SpendSgd: 250.5 },
    { Category: 'Transport', SpendSgd: 90 },
  ],
  Bnpl: { Plans: 3, PrincipalSgd: 75 },
  ...over,
})
const EMPTY = insights({
  LastRun: { ...RUN, Status: '' },
  TripsCount: 0,
  SpendSgd: 0,
  SavedVsSpotSgd: 0,
  OverBudgetTripPct: 0,
  OverBudgetEligibleTrips: 0,
  ByCurrencyMonth: [],
  ByCategory: [],
  Bnpl: { Plans: 0, PrincipalSgd: 0 },
})

// Answers by method name and counts the calls; `get` may be a function to change over time.
async function mockApi(page, { get = () => insights(), run } = {}) {
  const calls = { GetInsights: 0, RunEtlNow: 0 }
  await page.route('**/api/analytics/**', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()
    calls[name] = (calls[name] ?? 0) + 1
    if (name === 'GetInsights') {
      const out = get(calls.GetInsights)
      return route.fulfill(out.__status ? json(out.body, out.__status) : json(out))
    }
    return name === 'RunEtlNow'
      ? route.fulfill(
          json(run ?? { EtlRunId: 8, Status: 'Running', StartedOn: '2026-11-15T10:00:00' }),
        )
      : route.fulfill(json({ Errors: [`unmocked ${name}`] }, 500))
  })
  return calls
}
const signedIn = (page) => as(page, '0000002169:0000004554:Parent')

test('a positive total reads "saved", with every figure and table', async ({ page }) => {
  await signedIn(page)
  await mockApi(page)
  await page.goto('/insights')
  await expect(
    page.getByRole('heading', { name: 'Locking saved families SGD 12.34' }),
  ).toBeVisible()
  await expect(page.getByText('25% of completed trips went over budget')).toBeVisible()
  await expect(page.getByText('Pay later: 3 plans · SGD 75.00')).toBeVisible()
  await expect(page.getByText(/Last updated .* · 118 rows/)).toBeVisible()
  const rows = page.locator('table').first().locator('tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('JPY')
  await expect(rows.first()).toContainText('2026-10')
  await expect(rows.first()).toContainText('SGD 200.00')
  await expect(rows.first()).toContainText('SGD 8.10')
  await expect(page.locator('table').nth(1)).toContainText('Food')
  await expect(page.locator('table').nth(1)).toContainText('SGD 250.50')
})

test('a negative total reads "cost" with the absolute amount; no over-budget data shows a dash', async ({
  page,
}) => {
  await signedIn(page)
  await mockApi(page, {
    get: () => insights({ SavedVsSpotSgd: -0.2, OverBudgetTripPct: 0, OverBudgetEligibleTrips: 0 }),
  })
  await page.goto('/insights')
  await expect(page.getByRole('heading', { name: 'Locking cost families SGD 0.20' })).toBeVisible()
  await expect(page.getByText('— of completed trips went over budget')).toBeVisible()
})

test('an empty data mart says so and shows no tables', async ({ page }) => {
  await signedIn(page)
  await mockApi(page, { get: () => EMPTY })
  await page.goto('/insights')
  await expect(page.getByText('No data yet. Refresh to load trip activity.')).toBeVisible()
  await expect(page.locator('table')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Refresh data' })).toBeEnabled()
})

test('a failed latest run shows its error and keeps the numbers', async ({ page }) => {
  await signedIn(page)
  await mockApi(page, {
    get: () => insights({ LastRun: { ...RUN, Status: 'Failed', Error: 'Budget atomic is down' } }),
  })
  await page.goto('/insights')
  await expect(page.getByRole('alert')).toHaveText('Budget atomic is down')
  await expect(
    page.getByRole('heading', { name: 'Locking saved families SGD 12.34' }),
  ).toBeVisible()
  await expect(page.locator('table')).toHaveCount(2)
})

test('Refresh data disables the button, polls until the run ends, then shows its counts', async ({
  page,
}) => {
  await signedIn(page)
  // 1st read: idle. After RunEtlNow: Running, then Success with new counts.
  const calls = await mockApi(page, {
    get: (n) =>
      n === 1
        ? insights()
        : n === 2
          ? insights({ LastRun: { ...RUN, EtlRunId: 8, Status: 'Running' } })
          : insights({
              LastRun: { ...RUN, EtlRunId: 8, RowsExtracted: 9, RowsLoaded: 7, RowsRejected: 2 },
              SavedVsSpotSgd: 20,
            }),
  })
  await page.goto('/insights')
  await page.getByRole('button', { name: 'Refresh data' }).click()
  await expect(page.getByRole('button', { name: 'Refreshing…' })).toBeDisabled()
  await expect(page.getByText('Refresh finished: 9 extracted, 7 loaded, 2 rejected.')).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByRole('button', { name: 'Refresh data' })).toBeEnabled()
  await expect(
    page.getByRole('heading', { name: 'Locking saved families SGD 20.00' }),
  ).toBeVisible()
  expect(calls.RunEtlNow).toBe(1)
})

test('a GetInsights error shows its message', async ({ page }) => {
  await signedIn(page)
  await mockApi(page, {
    get: () => ({ __status: 500, body: { Errors: ['Analytics is offline'] } }),
  })
  await page.goto('/insights')
  await expect(page.getByRole('alert')).toHaveText('Analytics is offline')
})

test('signed out shows the sign-in card and calls nothing', async ({ page }) => {
  const calls = await mockApi(page)
  await page.goto('/insights')
  await expect(page.getByText("You're not signed in yet.")).toBeVisible()
  expect(calls.GetInsights).toBe(0)
})
