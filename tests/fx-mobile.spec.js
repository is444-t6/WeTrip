import { test, expect } from '@playwright/test'

// The SmartFX pages on a phone (375px wide), against a mocked API.
const PARENT = '0000002169:0000004554:Parent Demo'
const as = (page, v) => page.addInitScript((x) => sessionStorage.setItem('wetrip_session', x), v)
const reply = (body, status = 200) => ({
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
  TargetRate: 120.8236,
  Status: 'PartiallyLocked',
  LockedSgd: 800,
  LockedForeign: 96675.38,
  LastCheckedRate: 121.019,
}
const LOCKS = [
  {
    Id: 9,
    TripId: 12,
    SgdAmount: 200,
    ForeignAmount: 24164.72,
    LockedRate: 120.8236,
    Source: 'Manual',
    CreatedAt: '2026-10-28T19:35:33Z',
  },
  {
    Id: 11,
    TripId: 12,
    SgdAmount: 600,
    ForeignAmount: 72510.66,
    LockedRate: 120.8511,
    Source: 'Auto',
    CreatedAt: '2026-10-29T19:59:10Z',
  },
]
const SPENDS = [
  {
    Id: 1,
    TripId: 12,
    Amount: 20000,
    Category: 'Food',
    MerchantAccountId: '0000006718',
    CreatedAt: '2026-11-02T10:00:00Z',
  },
]

async function mockApi(page, over = {}) {
  const handlers = {
    GetMyFamilyRole: () => ({ role: 'Parent', FamilyLinkId: 3 }),
    GetMe: () => ({
      customerId: '0000002169',
      accountId: '0000004554',
      displayName: 'Parent Demo',
      balance: 1000,
    }),
    GetChildren: () => [
      { familyLinkId: 3, nickname: 'Jamie', childCustomerId: '0000002828', status: 'Active' },
    ],
    GetTrips: () => [TRIP],
    GetTrip: () => ({ Trip: TRIP, Locks: LOCKS, Spends: SPENDS }),
    GetRate: () => ({ spotRate: 123.548, forwardRate: 121.0494, period: '6M', currency: 'JPY' }),
    ...over,
  }
  const serve = (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()
    const h = handlers[name]
    return h
      ? route.fulfill(reply(h()))
      : route.fulfill(reply({ Errors: [`unmocked ${name}`] }, 500))
  }
  await page.route('**/api/family/**', serve)
  await page.route('**/api/fx/**', serve)
}

const horizontalOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })
  test.beforeEach(({ page }) => as(page, PARENT))

  test('the trip page has the app navbar and a side gutter, like every other page', async ({
    page,
  }) => {
    await mockApi(page)
    await page.goto('/fx/trips/12')
    await expect(page.getByRole('heading', { name: 'Kyoto' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'WeTrip' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    const left = await page
      .getByRole('heading', { name: 'Kyoto' })
      .evaluate((e) => e.getBoundingClientRect().left)
    expect(left).toBeGreaterThanOrEqual(16)
  })

  test('the trip page is also in the shell while loading and after an error', async ({ page }) => {
    await mockApi(page)
    // Registered last, so it answers GetTrip before the default mock does.
    await page.route('**/api/fx/GetTrip*', (route) =>
      route.fulfill(reply({ Errors: ['Not found: trip 99'] }, 500)),
    )
    await page.goto('/fx/trips/99')
    await expect(page.getByText('Not found: trip 99')).toBeVisible()
    await expect(page.getByRole('link', { name: 'WeTrip' })).toBeVisible()
  })

  test('nothing scrolls sideways on the trip list or the trip page', async ({ page }) => {
    await mockApi(page)
    await page.goto('/fx')
    await expect(page.getByText('Kyoto')).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    await page.goto('/fx/trips/12')
    await expect(page.getByText('Rate locks')).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  })

  test('a very large locked amount still fits the header card', async ({ page }) => {
    const big = { ...TRIP, LockedForeign: 123456789.55 }
    await mockApi(page, { GetTrip: () => ({ Trip: big, Locks: LOCKS, Spends: [] }) })
    await page.goto('/fx/trips/12')
    await expect(page.locator('.hero-amount')).toContainText('JPY 123,456,789.55')
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  })

  test('locks and spending become labelled blocks instead of a cramped table', async ({ page }) => {
    await mockApi(page)
    await page.goto('/fx/trips/12')
    await expect(page.getByText('Rate locks')).toBeVisible()
    const locks = page.locator('.stack-table').first()
    await expect(locks.locator('thead')).toBeHidden()
    const firstRow = locks.locator('tbody tr').first()
    await expect(firstRow.locator('td[data-label="Date"]')).toHaveText('28 Oct 2026')
    await expect(firstRow.locator('td[data-label="Rate"]')).toHaveText('120.82')
    await expect(firstRow.locator('td[data-label="SGD"]')).toContainText('SGD 200.00')
    await expect(firstRow.locator('td[data-label="JPY"]')).toHaveText('JPY 24,164.72')
    // Each cell is a row of its own, with its label drawn beside the value.
    const display = await firstRow
      .locator('td')
      .first()
      .evaluate((e) => getComputedStyle(e).display)
    expect(display).toBe('flex')
    const label = await firstRow
      .locator('td')
      .first()
      .evaluate((e) => getComputedStyle(e, '::before').content)
    expect(label).toBe('"Date"')

    const spend = page.locator('.stack-table').nth(1).locator('tbody tr').first()
    await expect(spend.locator('td[data-label="Category"]')).toHaveText('Food')
    await expect(spend.locator('td[data-label="To"]')).toHaveText('····6718')
  })

  test('the action buttons stack full width, and closing lives on the trip page', async ({
    page,
  }) => {
    await mockApi(page)
    await page.goto('/fx/trips/12')
    const box = (name) => page.getByRole('button', { name }).boundingBox()
    const [lock, check] = await Promise.all([box('Lock rate'), box('Check the rate now')])
    expect(Math.round(lock.width)).toBe(Math.round(check.width))
    expect(check.y).toBeGreaterThan(lock.y)
    await expect(page.getByRole('button', { name: /Close/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Close it from the trip page' })).toHaveAttribute(
      'href',
      '/trips/12',
    )
  })

  test('the back link returns to the trip, not the list', async ({ page }) => {
    await mockApi(page)
    await page.goto('/fx/trips/12')
    await expect(page.getByRole('link', { name: '← Back to Kyoto' })).toHaveAttribute(
      'href',
      '/trips/12',
    )
  })

  test('the trip card header keeps the dates on one line and moves the badge below', async ({
    page,
  }) => {
    await mockApi(page)
    await page.goto('/fx')
    const dates = page.getByText('1–14 Apr 2027')
    await expect(dates).toBeVisible()
    const height = await dates.evaluate((e) => e.getBoundingClientRect().height)
    expect(height).toBeLessThan(24)
  })

  test('the trip card shows the last checked rate instead of a dash', async ({ page }) => {
    await mockApi(page)
    await page.goto('/fx')
    await expect(page.locator('.card', { hasText: 'Kyoto' })).toContainText('1 SGD = 121.02 JPY')
  })

  test('the trip card opens the trip hub, with FX management one link away', async ({ page }) => {
    await mockApi(page)
    await page.goto('/fx')
    const card = page.locator('.card', { hasText: 'Kyoto' })
    await expect(card).toContainText('Partly locked')
    await expect(card).not.toContainText('PartiallyLocked')
    await expect(card.getByRole('link', { name: 'Open trip' })).toHaveAttribute('href', '/trips/12')
    await expect(card.getByRole('link', { name: 'Manage rates & locks' })).toHaveAttribute(
      'href',
      '/fx/trips/12',
    )
  })
})

test.describe('trip pages, any width', () => {
  test.beforeEach(({ page }) => as(page, PARENT))

  test('/fx/trips has no page of its own and goes to the trip list', async ({ page }) => {
    await mockApi(page)
    await page.goto('/fx/trips')
    await expect(page).toHaveURL(/\/fx$/)
    await expect(page.getByRole('heading', { name: 'Trips', exact: true })).toBeVisible()
  })

  test('a trip page opened without signing in offers sign-in, not an endless "Loading…"', async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ baseURL })
    const page = await ctx.newPage()
    await mockApi(page)
    await page.goto('/fx/trips/12')
    await expect(page.getByText("You're not signed in yet.")).toBeVisible()
    await expect(page.getByRole('link', { name: 'Continue to sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
    await ctx.close()
  })

  test('on a wider screen the locks stay a normal table', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 })
    await mockApi(page)
    await page.goto('/fx/trips/12')
    await expect(page.getByText('Rate locks')).toBeVisible()
    await expect(page.locator('.stack-table').first().locator('thead')).toBeVisible()
  })
})

test.describe('parent controls on a trip', () => {
  test.beforeEach(({ page }) => as(page, PARENT))
  const WATCHING = { ...TRIP, Status: 'Watching', LockedSgd: 0, LockedForeign: 0 }
  const open = async (page, trip) => {
    await mockApi(page, { GetTrip: () => ({ Trip: trip, Locks: [], Spends: [] }) })
    await page.goto('/fx/trips/12')
    await expect(page.getByRole('heading', { name: trip.Destination })).toBeVisible()
  }
  const button = (page, name) => page.getByRole('button', { name })

  test('a fully locked trip says so and offers no more locking or cancelling', async ({ page }) => {
    await open(page, TRIP)
    await expect(page.getByText('Fully locked')).toBeVisible()
    await expect(button(page, 'Lock rate')).toBeDisabled()
    // Locked money can't be cancelled: no dead button, a pointer to closing instead.
    await expect(button(page, 'Cancel trip')).toHaveCount(0)
    await expect(page.getByText("Trips with locked money can't be cancelled.")).toBeVisible()
  })

  test('a finished trip has no controls left', async ({ page }) => {
    await open(page, { ...TRIP, Status: 'Completed' })
    await expect(page.getByText(/· Completed/)).toBeVisible()
    await expect(button(page, 'Lock rate')).toBeDisabled()
    await expect(button(page, 'Cancel trip')).toHaveCount(0)
  })

  test('locking needs an amount, is capped at what is left and sends no rate or account', async ({
    page,
  }) => {
    const bodies = []
    await open(page, WATCHING)
    await expect(page.getByText('Partly locked')).toHaveCount(0)
    await page.route('**/api/fx/LockNow*', (route) => {
      bodies.push(route.request().postDataJSON())
      return route.fulfill(reply({ Lock: { SgdAmount: 800, LockedRate: 121.05 }, Trip: WATCHING }))
    })
    await expect(button(page, 'Lock rate')).toBeDisabled()
    await page.getByLabel('Lock now (SGD)').fill('5000')
    await button(page, 'Lock rate').click()
    await expect.poll(() => bodies.length).toBe(1)
    expect(bodies[0]).toMatchObject({ tripId: 12, sgdAmount: 800 })
    expect(bodies[0]).not.toHaveProperty('rate')
    expect(bodies[0]).not.toHaveProperty('parentAccountId')
  })

  test('after a lock the page shows the new pot without a reload', async ({ page }) => {
    // Regression: the page cached the trip under '12' (from the URL) and the lock
    // refreshed 12 (a number), so it kept showing nothing locked.
    let trip = WATCHING
    await mockApi(page, { GetTrip: () => ({ Trip: trip, Locks: [], Spends: [] }) })
    await page.route('**/api/fx/LockNow*', (route) => {
      trip = { ...TRIP, Status: 'Locked' }
      return route.fulfill(reply({ Lock: { SgdAmount: 800, LockedRate: 120.82 }, Trip: trip }))
    })
    await page.goto('/fx/trips/12')
    await expect(page.locator('.hero-amount')).toContainText('JPY 0.00')
    await page.getByLabel('Lock now (SGD)').fill('800')
    await button(page, 'Lock rate').click()
    await expect(page.getByText(/^Locked SGD 800\.00 at/)).toBeVisible()
    await expect(page.locator('.hero-amount')).toContainText('JPY 96,675.38')
    await expect(page.getByText('Fully locked')).toBeVisible()
  })

  test('the tenor is a row of pills, and the picked one is what gets locked', async ({ page }) => {
    const bodies = []
    await open(page, WATCHING)
    await page.route('**/api/fx/LockNow*', (route) => {
      bodies.push(route.request().postDataJSON())
      return route.fulfill(reply({ Lock: { SgdAmount: 100, LockedRate: 121.05 }, Trip: WATCHING }))
    })
    const tenor = page.getByRole('group', { name: 'Lock for' })
    await expect(tenor.getByRole('radio')).toHaveCount(4)
    expect((await tenor.locator('span').first().boundingBox()).height).toBeGreaterThanOrEqual(44)
    await tenor.getByRole('radio', { name: '1-year' }).check()
    await expect(tenor.getByRole('radio', { name: '1-year' })).toBeChecked()
    await expect(page.getByText(/Locks at today's 1-year rate/)).toBeVisible()
    await page.getByLabel('Lock now (SGD)').fill('100')
    await button(page, 'Lock rate').click()
    await expect.poll(() => bodies.length).toBe(1)
    expect(bodies[0]).toMatchObject({ tripId: 12, period: '1Y' })
  })

  test('cancelling takes a second tap, and Go back changes nothing', async ({ page }) => {
    const sent = []
    await open(page, WATCHING)
    await page.route(/\/api\/(fx|trip)\/(CancelTrip|CloseTrip)/, (route) => {
      sent.push(new URL(route.request().url()).pathname.split('/').pop())
      return route.fulfill(reply({ Id: 12, Status: 'Cancelled' }))
    })
    await button(page, 'Cancel trip').click()
    await expect(button(page, 'Confirm cancel?')).toBeVisible()
    await button(page, 'Go back').click()
    await expect(button(page, 'Cancel trip')).toBeVisible()
    expect(sent).toEqual([])
    await button(page, 'Cancel trip').click()
    await button(page, 'Confirm cancel?').click()
    await expect.poll(() => sent).toEqual(['CancelTrip'])
  })
})
