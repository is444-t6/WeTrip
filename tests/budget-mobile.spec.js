import { test, expect } from '@playwright/test'

// The Budget pages on a phone (375px wide), against a mocked API.
const PARENT = '0000002169:0000004554:Parent Demo'
const as = (page, v) => page.addInitScript((x) => sessionStorage.setItem('wetrip_session', x), v)
const reply = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

const DASH = {
  Summary: {
    TripId: 12,
    TotalLimit: 1000,
    TotalSpent: 805.5,
    TotalRemaining: 194.5,
    Lines: [
      {
        CategoryId: 6,
        CategoryName: 'Food',
        LimitAmount: 300,
        SpentAmount: 120.4,
        PercentUsed: 40,
        AlertLevel: 'OK',
      },
      {
        CategoryId: 4,
        CategoryName: 'Accommodation',
        LimitAmount: 500,
        SpentAmount: 430,
        PercentUsed: 86,
        AlertLevel: 'WARNING',
      },
      {
        CategoryId: 1,
        CategoryName: 'Activities',
        LimitAmount: 200,
        SpentAmount: 255.1,
        PercentUsed: 100,
        AlertLevel: 'OVER',
      },
    ],
  },
  Expenses: [
    {
      Id: 1,
      ExpenseDate: '2026-11-02T10:00:00',
      MerchantName: 'Ichiran Ramen Shinjuku Chuo-ku Honten Annex Building Branch',
      CategoryId: 6,
      Amount: 38.5,
      Currency: 'SGD',
    },
    { Id: 2, ExpenseDate: '2026-11-03T10:00:00', CategoryId: 2, Amount: 12, Currency: 'SGD' },
  ],
}

// The Budget client's base URL comes from VITE_BUDGET_API_BASE, which these
// tests do not control, so the mock matches on the endpoint name wherever it is
// served from. Family's own calls are under /api/family and are matched first.
const BUDGET_ENDPOINT = /\/(GetDashboard|RecordSpending|SetBudget|ImportBank)$/

async function mockApi(page, dashboard = () => reply(DASH)) {
  const calls = []
  await page.route('**/api/family/**', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()
    return route.fulfill(
      reply(name === 'GetMyFamilyRole' ? { role: 'Parent', FamilyLinkId: 3 } : {}),
    )
  })
  await page.route(
    (url) => !url.pathname.startsWith('/api/family/') && BUDGET_ENDPOINT.test(url.pathname),
    (route) => {
      const url = new URL(route.request().url())
      calls.push({ path: url.pathname, query: Object.fromEntries(url.searchParams) })
      return route.fulfill(url.pathname.endsWith('GetDashboard') ? dashboard() : reply({}))
    },
  )
  return calls
}

const horizontalOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })
  test.beforeEach(({ page }) => as(page, PARENT))

  test('the budget pages have the app navbar and a side gutter', async ({ page }) => {
    await mockApi(page)
    for (const [path, heading] of [
      ['/budget', 'Budget'],
      ['/budget/12', 'Trip 12 budget'],
    ]) {
      await page.goto(path)
      const h1 = page.getByRole('heading', { name: heading })
      await expect(h1).toBeVisible()
      await expect(page.getByRole('link', { name: 'WeTrip' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
      expect((await h1.boundingBox()).x).toBeGreaterThanOrEqual(16)
    }
  })

  test('nothing scrolls sideways, even with a very long merchant name', async ({ page }) => {
    await mockApi(page)
    await page.goto('/budget')
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    await page.goto('/budget/12')
    await expect(page.getByText('Ichiran Ramen')).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  })

  test('category rows stay inside their card, with the alert badge and amount on the right', async ({
    page,
  }) => {
    await mockApi(page)
    await page.goto('/budget/12')
    const card = page.locator('.card', { has: page.locator('.budget-line') })
    const cardBox = await card.boundingBox()
    for (const row of await page.locator('.budget-line').all()) {
      const box = await row.boundingBox()
      expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1)
    }
    await expect(card.getByText('WARNING')).toBeVisible()
    await expect(card.getByText('OVER')).toBeVisible()
    // The amount is right-aligned whether or not the row had to wrap.
    const money = await card
      .locator('.money')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right))
    const spread = Math.max(...money) - Math.min(...money)
    expect(spread).toBeLessThan(2)
  })

  test('expenses become labelled blocks instead of a four-column table', async ({ page }) => {
    await mockApi(page)
    await page.goto('/budget/12')
    const table = page.locator('.stack-table')
    await expect(table.locator('thead')).toBeHidden()
    const first = table.locator('tbody tr').first()
    await expect(first.locator('td[data-label="Date"]')).toHaveText('2026-11-02')
    await expect(first.locator('td[data-label="Category"]')).toHaveText('Food')
    await expect(first.locator('td[data-label="Amount"]')).toHaveText('38.50 SGD')
    const second = table.locator('tbody tr').nth(1)
    await expect(second.locator('td[data-label="Details"]')).toHaveText('Expense')
    const display = await first
      .locator('td')
      .first()
      .evaluate((e) => getComputedStyle(e).display)
    expect(display).toBe('flex')
  })

  test('the Trip Id box opens that trip’s budget', async ({ page }) => {
    await mockApi(page)
    await page.goto('/budget')
    await expect(page.getByRole('button', { name: 'Open budget' })).toBeDisabled()
    await page.locator('input[type="number"]').fill('12')
    await page.getByRole('button', { name: 'Open budget' }).click()
    await expect(page).toHaveURL(/\/budget\/12$/)
    await expect(page.getByText('By category')).toBeVisible()
  })

  test('a dashboard error shows inside the shell, not as a bare line of text', async ({ page }) => {
    await mockApi(page, () => reply({ Errors: ['Trip 99 has no budget'] }, 500))
    await page.goto('/budget/99')
    await expect(page.getByText('Trip 99 has no budget')).toBeVisible()
    await expect(page.getByRole('link', { name: 'WeTrip' })).toBeVisible()
  })
})

test.describe('budget pages, any width', () => {
  test('the dashboard is asked for by trip id', async ({ page }) => {
    await as(page, PARENT)
    const calls = await mockApi(page)
    await page.goto('/budget/12')
    await expect(page.getByText('By category')).toBeVisible()
    expect(calls.find((c) => c.path.endsWith('GetDashboard')).query).toEqual({ TripId: '12' })
  })

  test('without a session both pages offer sign-in', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL })
    const page = await ctx.newPage()
    await mockApi(page)
    for (const path of ['/budget', '/budget/12']) {
      await page.goto(path)
      await expect(page.getByText("You're not signed in yet.")).toBeVisible()
      await expect(page.getByRole('link', { name: 'Continue to sign in' })).toHaveAttribute(
        'href',
        '/login',
      )
    }
    await ctx.close()
  })

  test('on a wider screen the expenses stay a normal table', async ({ page }) => {
    await as(page, PARENT)
    await page.setViewportSize({ width: 800, height: 900 })
    await mockApi(page)
    await page.goto('/budget/12')
    await expect(page.getByText('Expenses', { exact: true })).toBeVisible()
    await expect(page.locator('.stack-table thead')).toBeVisible()
  })
})
