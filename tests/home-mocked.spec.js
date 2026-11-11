import { test, expect } from '@playwright/test'

// The home page against a mocked API (no live backend needed). Family, SmartFX
// and Scan to Pay are all faked, so a run never reaches the live sandbox.
const PARENT = '0000002169:0000004554:Parent Demo'
const CHILD = '0000002828:0000006064:Jamie'
const as = (page, v) => page.addInitScript((x) => sessionStorage.setItem('wetrip_session', x), v)
const reply = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

const CHILDREN = [
  {
    familyLinkId: 3,
    nickname: 'Jamie',
    childCustomerId: '0000002828',
    status: 'Active',
    balance: 250.5,
    budget: 200,
    period: 'Weekly',
    spent: 170,
  },
  {
    familyLinkId: 4,
    nickname: 'Second kid',
    childCustomerId: '0000002197',
    status: 'Active',
    balance: 20,
    budget: 0,
  },
]
const TRIP = {
  Id: 12,
  FamilyLinkId: 3,
  Destination: 'Kyoto',
  Currency: 'JPY',
  TripStartDate: '2027-04-01',
  TripEndDate: '2027-04-14',
  TargetBudgetSgd: 800,
  Status: 'Locked',
  LockedSgd: 800,
  LockedForeign: 96675.38,
}
const PAYMENTS = [
  pay(1, 'Old Chang Kee', '2026-11-01T10:00:00Z', 4.5, 'NOW'),
  pay(2, 'Ichiran Ramen', '2026-11-06T12:00:00Z', 1800, 'NOW', 'JPY'),
  pay(3, 'Uniqlo', '2026-11-04T09:00:00Z', 59.9, 'BNPL'),
  pay(4, 'Kopitiam', '2026-10-20T08:00:00Z', 3.2, 'NOW'),
]
function pay(Id, MerchantName, DateTime, Amount, PaymentType, Currency = 'SGD') {
  return { Id, MerchantName, DateTime, Amount, Currency, PaymentType, TransactionId: `T${Id}` }
}

async function mockApi(page, over = {}) {
  const calls = []
  const handlers = {
    GetMyFamilyRole: () => ({ role: 'Parent', FamilyLinkId: 3 }),
    GetMe: () => ({
      customerId: '0000002169',
      accountId: '0000004554',
      displayName: 'Parent Demo',
      balance: 1000,
    }),
    GetChildren: () => CHILDREN,
    GetPendingRequests: () => [{ RequestId: 11, FamilyLinkId: 3, Nickname: 'Jamie', Amount: 40 }],
    GetChildDashboard: () => ({
      HasBudget: true,
      Period: 'Weekly',
      Budget: 200,
      Spent: 50,
      Remaining: 150,
      Balance: 250.5,
    }),
    GetTrips: (_b, q) => (q.familyLinkId === '3' ? [TRIP] : []),
    GetHistory: () => ({ Payments: PAYMENTS, BnplPlans: [] }),
    GetMyAccounts: () => [
      { AccountId: '0000004554', ProductName: 'CASA', Currency: 'SGD', Balance: 1000 },
    ],
    ...over,
  }
  const serve = (route) => {
    const url = new URL(route.request().url())
    const name = url.pathname.split('/').pop()
    const query = Object.fromEntries(url.searchParams)
    calls.push({ name, query })
    const h = handlers[name]
    if (!h) return route.fulfill(reply({ Errors: [`unmocked ${name}`] }, 500))
    const out = h(undefined, query)
    return out && out.__status
      ? route.fulfill(reply(out.body, out.__status))
      : route.fulfill(reply(out))
  }
  await page.route('**/api/family/**', serve)
  await page.route('**/api/fx/**', serve)
  // Only the API path: a glob would also catch the app's own
  // /src/features/scantopay/ modules and break the page.
  await page.route((url) => url.pathname.startsWith('/scantopay/'), serve)
  return calls
}

test.describe('signed out', () => {
  test('a visitor without a session sees a WeTrip sign-in card, not the Family page', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'WeTrip', exact: true })).toBeVisible()
    await expect(page.getByText("You're not signed in yet.")).toBeVisible()
    await expect(page.getByText('WeTrip Family')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Continue to sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  test('the sign-in page is /login, and the old Family address still gets there', async ({
    page,
  }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in to WeTrip' })).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)

    await page.goto('/family/dev-login')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Sign in to WeTrip' })).toBeVisible()
  })

  test('signing in from /login lands on the home page', async ({ page }) => {
    await mockApi(page)
    await page.goto('/login')
    await page.getByPlaceholder('0000003018').fill('0000002169')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('Hi, Parent!')).toBeVisible()
  })

  test('signing out returns to that same front page', async ({ page }) => {
    // Seed the session once. The shared helper re-seeds on every page load,
    // which would undo the reload that signing out triggers.
    await page.addInitScript((token) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('wetrip_session', token)
        sessionStorage.setItem('seeded', '1')
      }
    }, PARENT)
    await mockApi(page)
    await page.goto('/')
    await expect(page.getByText('Hi, Parent!')).toBeVisible()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText("You're not signed in yet.")).toBeVisible()
  })
})

test.describe('parent home page', () => {
  test.beforeEach(({ page }) => as(page, PARENT))

  test('greets by name and shows the balance with a masked account number', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    await expect(page.getByText('Hi, Parent!')).toBeVisible()
    await expect(page.locator('.hero-amount')).toHaveText('SGD 1000.00')
    await expect(page.getByText('Deposit account ····4554')).toBeVisible()
  })

  test('quick actions go to each product', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    const quick = page.getByRole('navigation', { name: 'Quick actions' })
    for (const [name, href] of [
      ['Scan to Pay', '/pay'],
      ['Family', '/family'],
      ['SmartFX', '/fx'],
      ['Insurance', '/insurance'],
      ['Budget', '/budget'],
    ]) {
      await expect(quick.getByRole('link', { name })).toHaveAttribute('href', href)
    }
  })

  test('family card lists children, their budget state and the total', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    const family = page.locator('.card', { has: page.getByRole('heading', { name: 'Family' }) })
    await expect(family).toContainText('Jamie')
    await expect(family).toContainText('80%+ of budget used')
    await expect(family).toContainText('Second kid')
    await expect(family).toContainText('No budget set')
    await expect(family).toContainText('2 children linked')
    await expect(family).toContainText('Total SGD 270.50')
    await expect(family.getByRole('link', { name: 'Manage family' })).toHaveAttribute(
      'href',
      '/family',
    )
  })

  test('trip money shows what is set aside for each upcoming trip', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    const chip = page.locator('.wallet-chip')
    await expect(chip).toHaveCount(1)
    await expect(chip).toContainText('JPY')
    await expect(chip).toContainText('96675.38')
    await expect(chip).toContainText('Kyoto')
    // Every trip tile opens the trip hub, which links on to FX, budget and cover.
    await expect(chip).toHaveAttribute('href', '/trips/12')
  })

  test('the top nav is Home, Trips, Family and Pay only', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'WeTrip', exact: true })
    await expect(nav.getByRole('link')).toHaveText(['Home', 'Trips', 'Family', 'Pay'])
    await expect(nav.getByRole('link', { name: 'Trips', exact: true })).toHaveAttribute(
      'href',
      '/fx',
    )
    await expect(nav.getByRole('link', { name: 'Pay', exact: true })).toHaveAttribute(
      'href',
      '/pay',
    )
  })

  test('recent payments: the newest three, with pay-later marked', async ({ page }) => {
    const calls = await mockApi(page)
    await page.goto('/')
    const card = page.locator('.card', {
      has: page.getByRole('heading', { name: 'Recent payments' }),
    })
    const rows = card.locator('.home-row')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toContainText('Ichiran Ramen')
    await expect(rows.nth(0)).toContainText('JPY 1800.00')
    await expect(rows.nth(1)).toContainText('Uniqlo')
    await expect(rows.nth(1)).toContainText('Pay later')
    await expect(rows.nth(2)).toContainText('Old Chang Kee')
    await expect(card.getByRole('link', { name: 'View all' })).toHaveAttribute(
      'href',
      '/pay/history',
    )
    expect(calls.find((c) => c.name === 'GetHistory').query.CustomerId).toBe('0000002169')
  })

  test('product tiles link to insurance, SmartFX, budget and Scan to Pay', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    const tiles = page.locator('.explore-card')
    await expect(tiles).toHaveCount(4)
    await expect(page.getByRole('link', { name: /Travel insurance/ })).toHaveAttribute(
      'href',
      '/insurance',
    )
    await expect(page.getByRole('link', { name: /Trip budget/ })).toHaveAttribute('href', '/budget')
  })

  test('waiting approvals flag the Family action and show a banner', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    await expect(page.getByText('1 spend request is waiting for your approval.')).toBeVisible()
    await expect(page.locator('.quick .dot')).toHaveCount(1)
    await expect(page.getByText('1 to approve')).toBeVisible()
  })

  test('no approvals means no banner and no dot', async ({ page }) => {
    await mockApi(page, { GetPendingRequests: () => [] })
    await page.goto('/')
    await expect(page.getByText('Second kid')).toBeVisible()
    await expect(page.locator('.banner.warn')).toHaveCount(0)
    await expect(page.locator('.quick .dot')).toHaveCount(0)
  })

  test('the balance can be hidden, and stays hidden after a reload', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    await expect(page.locator('.hero-amount')).toHaveText('SGD 1000.00')
    await page.getByRole('button', { name: 'Hide balance' }).click()
    await expect(page.locator('.hero-amount')).toHaveText('SGD ••••••')
    await page.reload()
    await expect(page.locator('.hero-amount')).toHaveText('SGD ••••••')
    await page.getByRole('button', { name: 'Show balance' }).click()
    await expect(page.locator('.hero-amount')).toHaveText('SGD 1000.00')
  })

  test('a Scan to Pay outage does not take the rest of the page down', async ({ page }) => {
    await mockApi(page, { GetHistory: () => ({ __status: 500, body: { Errors: ['down'] } }) })
    await page.goto('/')
    await expect(page.getByText('Recent payments are unavailable right now.')).toBeVisible()
    await expect(page.getByText('Second kid')).toBeVisible()
    await expect(page.locator('.wallet-chip')).toHaveCount(1)
    await expect(page.locator('.banner.error')).toHaveCount(0)
  })

  test('a parent with no payments is pointed at Scan to Pay', async ({ page }) => {
    await mockApi(page, { GetHistory: () => ({ Payments: [], BnplPlans: [] }) })
    await page.goto('/')
    await expect(page.getByText('No payments yet.')).toBeVisible()
  })
})

test.describe('child home page', () => {
  test.beforeEach(({ page }) => as(page, CHILD))
  const child = { GetMyFamilyRole: () => ({ role: 'Child', FamilyLinkId: 3 }) }

  test('shows the child’s budget and trip money, and never asks for parent-only data', async ({
    page,
  }) => {
    const calls = await mockApi(page, {
      ...child,
      GetMe: () => ({
        customerId: '0000002828',
        accountId: '0000006064',
        displayName: 'Jamie',
        balance: 250.5,
      }),
    })
    await page.goto('/')
    await expect(page.getByText('Hi, Jamie!')).toBeVisible()
    const budget = page.locator('.card', { has: page.getByRole('heading', { name: 'My budget' }) })
    await expect(budget).toContainText('SGD 150.00')
    await expect(budget).toContainText('left this week')
    await expect(budget).toContainText('SGD 50.00 of SGD 200.00 spent')
    await expect(page.locator('.wallet-chip')).toContainText('Kyoto')
    await expect(page.locator('.wallet-chip')).toHaveAttribute('href', '/trips/12')
    expect(calls.filter((c) => c.name === 'GetPendingRequests')).toHaveLength(0)
    await expect(page.locator('.banner.warn')).toHaveCount(0)
  })

  test('a child whose parent has not set a budget is told so', async ({ page }) => {
    await mockApi(page, { ...child, GetChildDashboard: () => ({ HasBudget: false, Balance: 10 }) })
    await page.goto('/')
    await expect(page.getByText("Your parent hasn't set a budget yet.")).toBeVisible()
  })
})

test.describe('someone not linked to a family yet', () => {
  test('is offered both ways in: link a child, or accept an invite', async ({ page }) => {
    await as(page, CHILD)
    await mockApi(page, { GetMyFamilyRole: () => ({ role: 'None' }) })
    await page.goto('/')
    await expect(page.getByText(/Parents can link a child/)).toBeVisible()
    await expect(page.getByText(/Children can accept an invite from a parent/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Set up family' })).toHaveAttribute(
      'href',
      '/family',
    )
  })
})

test.describe('navigation', () => {
  test('the brand and Home link both return to the home page', async ({ page }) => {
    await as(page, PARENT)
    await mockApi(page)
    await page.goto('/family')
    await page.getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('Hi, Parent!')).toBeVisible()
    await page.goto('/fx')
    await page.getByRole('link', { name: 'WeTrip' }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})
