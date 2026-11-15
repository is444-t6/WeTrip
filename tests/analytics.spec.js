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
    { Category: 'Food', SpendSgd: 150.5, Currency: 'JPY', Month: '2026-10' },
    { Category: 'Food', SpendSgd: 100, Currency: 'EUR', Month: '2026-11' },
    { Category: 'Transport', SpendSgd: 90, Currency: 'EUR', Month: '2026-11' },
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

test('a positive total reads "saved", with every chart and figure', async ({ page }) => {
  await signedIn(page)
  await mockApi(page)
  await page.goto('/insights')
  await expect(
    page.getByRole('heading', { name: 'Locking saved families SGD 12.34' }),
  ).toBeVisible()
  await expect(page.getByText('25% of completed trips went over budget').first()).toBeVisible()
  await expect(page.getByText('Pay later: 3 plans · SGD 75.00')).toBeVisible()
  await expect(page.getByText(/Last updated .* · 118 rows/)).toBeVisible()
  await expect(page.getByRole('img', { name: 'Spend by month, in SGD' })).toBeVisible()
  await expect(
    page.getByRole('img', { name: 'Saved versus spot rate by month, in SGD' }),
  ).toBeVisible()
  const categories = page.getByRole('list', { name: 'Spend by category, in SGD' })
  await expect(categories.getByRole('listitem').first()).toContainText('Food')
  await expect(categories.getByRole('listitem').first()).toContainText('SGD 250.50')
  await expect(page.getByRole('list', { name: 'Spend by trip currency, in SGD' })).toContainText(
    'JPY',
  )
  await page.getByText('Show as table').click()
  const rows = page.locator('table tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('2026-10')
  await expect(rows.first()).toContainText('SGD 200.00')
  await expect(rows.first()).toContainText('SGD 8.10')
})

test('the currency filter narrows the headline, months and categories', async ({ page }) => {
  await signedIn(page)
  await mockApi(page)
  await page.goto('/insights')
  await page.getByRole('button', { name: 'EUR' }).click()
  await expect(page.getByRole('button', { name: 'EUR' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'Locking saved families SGD 4.24' })).toBeVisible()
  await expect(page.getByText('SGD 140.50 spent in EUR')).toBeVisible()
  const categories = page.getByRole('list', { name: 'Spend by category, in SGD' })
  await expect(categories.getByRole('listitem')).toHaveCount(2)
  await expect(categories.getByRole('listitem').first()).toContainText('SGD 100.00')
  await expect(page.getByRole('list', { name: 'Spend by trip currency, in SGD' })).toHaveCount(0)
})

test('the period filter drops older months', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-20T04:00:00Z'))
  await signedIn(page)
  await mockApi(page, {
    get: () =>
      insights({
        ByCurrencyMonth: [
          { Currency: 'JPY', Month: '2025-12', SpendSgd: 50, SavedVsSpotSgd: -1 },
          { Currency: 'JPY', Month: '2026-11', SpendSgd: 70, SavedVsSpotSgd: 2 },
        ],
      }),
  })
  await page.goto('/insights')
  await expect(page.getByText('SGD 120.00 spent')).toBeVisible()
  await page.getByRole('button', { name: '3 months' }).click()
  await expect(page.getByText('SGD 70.00 spent')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Locking saved families SGD 2.00' })).toBeVisible()
  await page.getByText('Show as table').click()
  await expect(page.locator('table tbody tr')).toHaveCount(1)
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
  await expect(page.getByRole('img', { name: /over budget/ })).toHaveCount(0)
})

test('an empty data mart says so and shows no charts', async ({ page }) => {
  await signedIn(page)
  await mockApi(page, { get: () => EMPTY })
  await page.goto('/insights')
  await expect(page.getByText('No data yet. Refresh to load trip activity.')).toBeVisible()
  await expect(page.locator('table')).toHaveCount(0)
  await expect(page.locator('figure.chart')).toHaveCount(0)
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
  await expect(page.getByRole('img', { name: 'Spend by month, in SGD' })).toBeVisible()
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

test('insightsData: month series fills gaps and periods count the current month', async () => {
  const { monthSeries, periodStart, totalsBy } =
    await import('../src/features/analytics/insightsData.js')
  const s = monthSeries([
    { month: '2026-09', spendSgd: 10, savedVsSpotSgd: 1 },
    { month: '2026-11', spendSgd: 5, savedVsSpotSgd: -2 },
    { month: '2026-11', spendSgd: 5, savedVsSpotSgd: 0 },
  ])
  expect(s.map((p) => p.month)).toEqual(['2026-09', '2026-10', '2026-11'])
  expect(s[1]).toEqual({ month: '2026-10', spend: 0, saved: 0 })
  expect(s[2]).toEqual({ month: '2026-11', spend: 10, saved: -2 })
  expect(periodStart('3m', '2026-01')).toBe('2025-11')
  expect(periodStart('12m', '2026-11')).toBe('2025-12')
  expect(periodStart('all', '2026-11')).toBe('')
  expect(
    totalsBy(
      [
        { c: 'A', spendSgd: 1 },
        { c: 'B', spendSgd: 3 },
        { c: 'A', spendSgd: 1 },
      ],
      'c',
    ),
  ).toEqual([
    { label: 'B', value: 3 },
    { label: 'A', value: 2 },
  ])
})
