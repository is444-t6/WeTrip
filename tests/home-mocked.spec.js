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
    GetMyMiles: () => ({ Balance: 1250 }),
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
  await page.route('**/api/trip/**', serve)
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
    await expect(page.locator('.hero-amount')).toHaveText('SGD 1,000.00')
    await expect(page.getByText('Deposit account ····4554')).toBeVisible()
  })

  test('a parent has no Miles card and never asks for miles', async ({ page }) => {
    const calls = await mockApi(page)
    await page.goto('/')
    await expect(page.getByText('Second kid')).toBeVisible()
    await expect(page.getByLabel('Miles', { exact: true })).toHaveCount(0)
    expect(calls.filter((c) => c.name === 'GetMyMiles')).toHaveLength(0)
  })

  test('quick actions hold only what the nav does not: rates, cover and budgets', async ({
    page,
  }) => {
    await mockApi(page)
    await page.goto('/')
    const quick = page.getByRole('navigation', { name: 'Quick actions' })
    await expect(quick.getByRole('link')).toHaveText(['Lock a rate', 'Insurance', 'Budgets'])
    for (const [name, href] of [
      ['Lock a rate', '/fx'],
      ['Insurance', '/insurance'],
      ['Budgets', '/budget'],
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

  test('the next trip leads the page and opens its hub', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    const next = page.locator('.next-trip')
    await expect(next).toHaveCount(1)
    await expect(next.getByRole('heading', { name: 'Kyoto' })).toBeVisible()
    await expect(next).toContainText('Next up')
    await expect(next).toContainText('1–14 Apr 2027 · JPY')
    await expect(next).toContainText('JPY 96,675.38')
    await expect(next).toContainText('Locked')
    // Every trip tile opens the trip hub, which links on to FX, budget and cover.
    await expect(next).toHaveAttribute('href', '/trips/12')
  })

  test('later trips are listed under the next one, soonest first', async ({ page }) => {
    const later = (Id, Destination, Currency, TripStartDate) => ({
      ...TRIP,
      Id,
      Destination,
      Currency,
      TripStartDate,
      LockedForeign: 0,
      Status: 'Watching',
    })
    await mockApi(page, {
      GetTrips: (_b, q) =>
        q.familyLinkId === '3'
          ? [
              later(14, 'Zurich', 'CHF', '2027-09-01'),
              TRIP,
              later(13, 'London', 'GBP', '2027-06-01'),
            ]
          : [],
    })
    await page.goto('/')
    await expect(page.locator('.next-trip')).toContainText('Kyoto')
    const rows = page.getByRole('list', { name: 'Other trips' }).getByRole('link')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('London')
    await expect(rows.nth(0)).toHaveAttribute('href', '/trips/13')
    await expect(rows.nth(1)).toContainText('Zurich')
  })

  test('the next trip shows its last and target rates', async ({ page }) => {
    await mockApi(page, {
      GetTrips: (_b, q) =>
        q.familyLinkId === '3' ? [{ ...TRIP, LastCheckedRate: 120.5, TargetRate: 122 }] : [],
    })
    await page.goto('/')
    const pot = page.locator('.next-trip-rates')
    await expect(pot).toContainText('Last checked120.50')
    await expect(pot).toContainText('Target · higher is better122.00')
    await expect(page.locator('.next-trip')).toContainText('JPY per 1 SGD')
  })

  test('a trip that ended but was never closed does not lead', async ({ page }) => {
    const stale = {
      ...TRIP,
      Id: 9,
      Destination: 'Paris',
      Currency: 'EUR',
      TripStartDate: '2025-01-01',
      TripEndDate: '2025-01-10',
    }
    await mockApi(page, { GetTrips: (_b, q) => (q.familyLinkId === '3' ? [stale, TRIP] : []) })
    await page.goto('/')
    await expect(page.locator('.next-trip')).toContainText('Kyoto')
    const other = page.getByRole('list', { name: 'Other trips' })
    await expect(other).toContainText('Paris')
    await expect(other).toContainText('Trip over')
  })

  test('no "Plan a trip" flashes while the children are still loading', async ({ page }) => {
    await mockApi(page)
    let release
    const held = new Promise((r) => (release = r))
    await page.route('**/api/family/GetChildren*', async (route) => {
      await held
      await route.fallback()
    })
    await page.goto('/')
    await expect(page.getByText('Loading your trips…')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Plan a trip' })).toHaveCount(0)
    release()
    await expect(page.locator('.next-trip')).toContainText('Kyoto')
  })

  test('a trips outage says so instead of offering to plan a trip', async ({ page }) => {
    await mockApi(page, { GetTrips: () => ({ __status: 500, body: { Errors: ['down'] } }) })
    await page.goto('/')
    await expect(page.getByText('Your trips are unavailable right now.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Plan a trip' })).toHaveCount(0)
  })

  test('a parent with no trip is offered to plan one', async ({ page }) => {
    await mockApi(page, { GetTrips: () => [] })
    await page.goto('/')
    await expect(page.getByText('No trip planned yet.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Plan a trip' })).toHaveAttribute('href', '/fx')
    await expect(page.locator('.next-trip')).toHaveCount(0)
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
    await expect(rows.nth(0)).toContainText('JPY 1,800.00')
    await expect(rows.nth(1)).toContainText('Uniqlo')
    await expect(rows.nth(1)).toContainText('Pay later')
    await expect(rows.nth(2)).toContainText('Old Chang Kee')
    await expect(card.getByRole('link', { name: 'View all' })).toHaveAttribute(
      'href',
      '/pay/history',
    )
    expect(calls.find((c) => c.name === 'GetHistory').query.CustomerId).toBe('0000002169')
  })

  test('waiting approvals flag the Family action and show a banner', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    await expect(page.getByText('1 spend request is waiting for your approval.')).toBeVisible()
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
    await expect(page.locator('.hero-amount')).toHaveText('SGD 1,000.00')
    await page.getByRole('button', { name: 'Hide balance' }).click()
    await expect(page.locator('.hero-amount')).toHaveText('SGD ••••••')
    await page.reload()
    await expect(page.locator('.hero-amount')).toHaveText('SGD ••••••')
    await page.getByRole('button', { name: 'Show balance' }).click()
    await expect(page.locator('.hero-amount')).toHaveText('SGD 1,000.00')
  })

  test('a Scan to Pay outage does not take the rest of the page down', async ({ page }) => {
    await mockApi(page, { GetHistory: () => ({ __status: 500, body: { Errors: ['down'] } }) })
    await page.goto('/')
    await expect(page.getByText('Recent payments are unavailable right now.')).toBeVisible()
    await expect(page.getByText('Second kid')).toBeVisible()
    await expect(page.locator('.next-trip')).toHaveCount(1)
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
    await expect(page.locator('.next-trip')).toContainText('Kyoto')
    await expect(page.locator('.next-trip')).toHaveAttribute('href', '/trips/12')
    expect(calls.filter((c) => c.name === 'GetPendingRequests')).toHaveLength(0)
    await expect(page.locator('.banner.warn')).toHaveCount(0)
  })

  test('a child with no trip is told their parent plans them', async ({ page }) => {
    await mockApi(page, { ...child, GetTrips: () => [] })
    await page.goto('/')
    await expect(page.getByText('No trip yet. When your parent plans one')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Plan a trip' })).toHaveCount(0)
  })

  const miles = (page) => page.getByLabel('Miles', { exact: true })

  test('the Miles card reads the balance, singular for one', async ({ page }) => {
    let balance = 1250
    await mockApi(page, { ...child, GetMyMiles: () => ({ Balance: balance }) })
    await page.goto('/')
    await expect(miles(page).locator('p')).toHaveText('1250 miles')

    balance = 1
    await page.reload()
    await expect(miles(page).locator('p')).toHaveText('1 mile')
  })

  test('with no miles yet the card points at paying on a trip', async ({ page }) => {
    await mockApi(page, { ...child, GetMyMiles: () => ({ Balance: 0 }) })
    await page.goto('/')
    await expect(miles(page).locator('p').first()).toHaveText('0 miles')
    await expect(miles(page)).toContainText('Pay on a trip to earn miles.')
  })

  test('a miles outage hides the card and leaves the rest of Home alone', async ({ page }) => {
    const calls = await mockApi(page, {
      ...child,
      GetMyMiles: () => ({ __status: 500, body: { Errors: ['down'] } }),
    })
    await page.goto('/')
    await expect.poll(() => calls.some((c) => c.name === 'GetMyMiles')).toBe(true)
    await expect(page.locator('.hero-amount')).toHaveText('SGD 1,000.00')
    await expect(page.locator('.next-trip')).toHaveCount(1)
    await expect(miles(page)).toHaveCount(0)
    await expect(page.locator('.banner.error')).toHaveCount(0)
  })

  test('a child whose parent has not set a budget is told so', async ({ page }) => {
    await mockApi(page, { ...child, GetChildDashboard: () => ({ HasBudget: false, Balance: 10 }) })
    await page.goto('/')
    await expect(page.getByText("Your parent hasn't set a spending limit yet.")).toBeVisible()
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

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })
  test.beforeEach(({ page }) => as(page, PARENT))

  const bar = (page) => page.getByRole('navigation', { name: 'WeTrip', exact: true })

  test('the main nav is a floating bottom bar with Pay as the scan pill', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    await expect(bar(page).getByRole('link')).toHaveText(['Home', 'Trips', 'Family', 'Pay'])
    await expect(bar(page).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const box = await bar(page).boundingBox()
    expect(box.y + box.height).toBeLessThanOrEqual(812)
    expect(box.y + box.height).toBeGreaterThan(812 - 40)
    expect(await bar(page).evaluate((e) => getComputedStyle(e).position)).toBe('fixed')
    const pay = bar(page).getByRole('link', { name: 'Pay' })
    expect(await pay.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(16, 219, 172)')
    for (const link of await bar(page).getByRole('link').all()) {
      expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44)
    }
    // The slim header keeps the brand and Sign out.
    await expect(page.getByRole('link', { name: 'WeTrip' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  })

  test('the last card scrolls clear of the bar, and nothing scrolls sideways', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    const last = page.locator('main .card').last()
    await expect(last).toBeVisible()
    await expect(page.getByText('Ichiran Ramen')).toBeVisible()
    await expect(page.getByText('Second kid')).toBeVisible()
    // Sections above can still settle and push it down, so measure until it holds.
    // The page scrolls smoothly; jump straight to the end instead.
    await expect
      .poll(async () => {
        await page.evaluate(() =>
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
        )
        const card = await last.boundingBox()
        const nav = await bar(page).boundingBox()
        return nav.y - (card.y + card.height)
      })
      .toBeGreaterThanOrEqual(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0)
  })

  test('the next trip runs edge to edge under the header', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    const hero = await page.locator('.home-hero').boundingBox()
    expect(hero.x).toBe(0)
    expect(hero.width).toBe(375)
    await expect(page.locator('.next-trip').getByRole('heading', { name: 'Kyoto' })).toBeVisible()
  })
})
