import { test, expect } from '@playwright/test'

// The one-trip overview (/trips/:id), against a faked backend for every service it
// reads: SmartFX (the trip), Budget, Insurance and Family.
const PARENT = '0000002169:0000004554:'
const CHILD = '0000002828:0000006064:'
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
  Status: 'PartiallyLocked',
  LockedSgd: 400,
  LockedForeign: 48000,
}
const BUDGET = {
  Summary: {
    TripId: 12,
    TotalLimit: 600,
    TotalSpent: 150,
    TotalRemaining: 450,
    Lines: [
      { Category: 'Food', Limit: 300, Spent: 150, AlertLevel: 'OK' },
      { Category: 'Transport', Limit: 300, Spent: 0, AlertLevel: 'OK' },
    ],
  },
  Expenses: [],
}
const EMPTY_BUDGET = { Summary: { TripId: 12 } }
const POLICY = {
  PurchaseId: 5,
  CoverageStart: '2027-03-30',
  CoverageEnd: '2027-04-15',
  DestinationCode: 'JP',
  CoveredTravellers: [{ FullName: 'Jamie' }, { FullName: 'Mum' }],
}
const CHILDREN = [
  { familyLinkId: 3, nickname: 'Jamie', status: 'Active', balance: 250.5, budget: 200, spent: 50 },
]

// Each service answers by name; override one to change what it says.
async function mockApi(page, over = {}) {
  const handlers = {
    GetMyFamilyRole: () => ({ role: 'Parent', FamilyLinkId: 3 }),
    GetTrip: () => ({ Trip: TRIP, Locks: [], Spends: [{ Id: 1, TripId: 12, Amount: 10000 }] }),
    GetDashboard: () => BUDGET,
    MyInsurance: () => [POLICY],
    GetChildren: () => CHILDREN,
    GetChildDashboard: () => ({ Nickname: 'Jamie', Balance: 250.5, Budget: 200, Spent: 50 }),
    ...over,
  }
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const name = new URL(route.request().url()).pathname.split('/').pop()
      const h = handlers[name]
      if (!h) return route.fulfill(json({ Errors: [`unmocked ${name}`] }, 500))
      const out = h()
      return out && out.__status
        ? route.fulfill(json(out.body, out.__status))
        : route.fulfill(json(out))
    },
  )
}
const section = (page, name) => page.getByLabel(name, { exact: true })

test('the trip header and all four sections show their own data', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page)
  await page.goto('/trips/12')

  await expect(page.getByRole('heading', { name: 'Kyoto' })).toBeVisible()
  await expect(page.getByText('2027-04-01 → 2027-04-14')).toBeVisible()

  await expect(section(page, 'Money')).toContainText('SGD 400.00 locked')
  await expect(section(page, 'Money')).toContainText('JPY 48000.00 locked, JPY 10000.00 spent')
  await expect(section(page, 'Budget')).toContainText('SGD 150.00 spent of SGD 600.00')
  await expect(
    section(page, 'Money').getByRole('link', { name: 'Manage FX & locks' }),
  ).toHaveAttribute('href', '/fx/trips/12')
  await expect(section(page, 'Budget').getByRole('link', { name: 'Open budget' })).toHaveAttribute(
    'href',
    '/budget/12',
  )
  await expect(page.locator('.page').getByRole('link', { name: 'Pay', exact: true })).toHaveCount(0)
  await expect(section(page, 'Insurance')).toContainText('1 policy covers these dates, for 2')
  await expect(section(page, 'Family')).toContainText('Jamie has SGD 250.50')
  await expect(section(page, 'Family')).toContainText('SGD 50.00 spent of SGD 200.00 this period')
})

test('Budget is read with the SmartFX trip id', async ({ page }) => {
  await as(page, PARENT)
  const seen = []
  await mockApi(page, {})
  await page.route('**/api/budget/GetDashboard*', (route) => {
    seen.push(new URL(route.request().url()).searchParams.get('TripId'))
    return route.fulfill(json(BUDGET))
  })
  await page.goto('/trips/12')
  await expect(section(page, 'Budget')).toContainText('spent of')
  expect(seen).toContain('12')
})

test('a trip with no budget offers to set one', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, { GetDashboard: () => EMPTY_BUDGET })
  await page.goto('/trips/12')
  await expect(section(page, 'Budget')).toContainText('No category budget yet')
  await section(page, 'Budget').getByRole('link', { name: 'Set a budget' }).click()
  await expect(page).toHaveURL(/\/budget\/12$/)
})

test('a policy that does not overlap the trip dates does not count as cover', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, {
    MyInsurance: () => [{ ...POLICY, CoverageStart: '2027-06-01', CoverageEnd: '2027-06-05' }],
  })
  await page.goto('/trips/12')
  await expect(section(page, 'Insurance')).toContainText('No policy covers these dates yet')
})

test('getting cover starts the insurance flow with this trip filled in', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, { MyInsurance: () => [] })
  await page.goto('/trips/12')
  await section(page, 'Insurance').getByRole('button', { name: 'Get cover for this trip' }).click()

  await expect(page).toHaveURL(/\/insurance(\?|$)/)
  await expect(page.getByLabel('Destination', { exact: true })).toHaveValue('Kyoto')
  await expect(page.getByLabel(/country code/i)).toHaveValue('JP')
})

test('one service being down leaves the other sections working', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, {
    GetDashboard: () => ({ __status: 500, body: { Errors: ['budget down'] } }),
    MyInsurance: () => ({ __status: 500, body: { Errors: ['insurance down'] } }),
  })
  await page.goto('/trips/12')
  await expect(section(page, 'Budget')).toContainText('could not be loaded')
  await expect(section(page, 'Insurance')).toContainText('could not be loaded')
  await expect(section(page, 'Money')).toContainText('SGD 400.00 locked')
  await expect(section(page, 'Family')).toContainText('Jamie has SGD 250.50')
})

test('a child sees their own money, with no parent actions', async ({ page }) => {
  await as(page, CHILD)
  await mockApi(page, {
    GetMyFamilyRole: () => ({ role: 'Child', FamilyLinkId: 3 }),
    MyInsurance: () => [],
    GetDashboard: () => EMPTY_BUDGET,
  })
  await page.goto('/trips/12')
  await expect(section(page, 'Family')).toContainText('Jamie has SGD 250.50')
  await expect(section(page, 'Family').getByRole('link', { name: 'Open Family' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Get cover for this trip' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Set a budget' })).toHaveCount(0)
  await expect(
    page.locator('.page').getByRole('link', { name: 'Pay', exact: true }),
  ).toHaveAttribute('href', '/pay')
})

test('signed out, the page offers sign-in', async ({ page }) => {
  await page.goto('/trips/12')
  await expect(page.getByText("You're not signed in yet.")).toBeVisible()
})

test('the SmartFX trip card links to the overview', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, {
    GetTrips: () => [{ ...TRIP }],
  })
  await page.goto('/fx')
  await page.getByRole('link', { name: 'Open trip' }).click()
  await expect(page).toHaveURL(/\/trips\/12$/)
})

test('foreign amounts keep their cents', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, {
    GetTrip: () => ({
      Trip: { ...TRIP, LockedForeign: 96675.38 },
      Locks: [],
      Spends: [{ Amount: 20000.5 }],
    }),
  })
  await page.goto('/trips/12')
  await expect(section(page, 'Money')).toContainText('JPY 96675.38 locked, JPY 20000.50 spent')
})
