import { test, expect } from '@playwright/test'

// The one-trip overview (/trips/:id), against a faked backend. The trip, its
// money, budget and trip-linked policies come from one call, Trip.GetTripOverview;
// Family and Insurance (for older, date-matched policies) are read as before.
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
  TripId: 12,
  TotalLimit: 600,
  TotalSpent: 150,
  TotalRemaining: 450,
  Lines: [
    { CategoryName: 'Food', LimitAmount: 300, SpentAmount: 150, AlertLevel: 'OK' },
    { CategoryName: 'Transport', LimitAmount: 300, SpentAmount: 0, AlertLevel: 'OK' },
  ],
}
const LINKED_POLICY = { Id: 7, TripId: 12, Status: 'Confirmed', PolicyNumber: '7' }
const DATED_POLICY = {
  PurchaseId: 5,
  CoverageStart: '2027-03-30',
  CoverageEnd: '2027-04-15',
  DestinationCode: 'JP',
  CoveredTravellers: [{ FullName: 'Jamie' }, { FullName: 'Mum' }],
}
const CHILDREN = [
  { familyLinkId: 3, nickname: 'Jamie', status: 'Active', balance: 250.5, budget: 200, spent: 50 },
]
const overview = (over = {}) => ({
  Trip: TRIP,
  Locks: [],
  Spends: [{ Id: 1, TripId: 12, Amount: 10000 }],
  SpentForeign: 10000,
  RemainingForeign: 38000,
  LockedRate: 120,
  HasBudget: true,
  Budget: BUDGET,
  Policies: [LINKED_POLICY],
  CallerRole: 'Parent',
  ...over,
})

// Each service answers by method name; override one to change what it says.
async function mockApi(page, over = {}) {
  const handlers = {
    GetMyFamilyRole: () => ({ role: 'Parent', FamilyLinkId: 3 }),
    GetTripOverview: () => overview(),
    MyInsurance: () => [],
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
      const out = h(route)
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
  await expect(section(page, 'Money')).toContainText(
    'JPY 38000.00 left of JPY 48000.00 (JPY 10000.00 spent)',
  )
  await expect(section(page, 'Money')).toContainText('Locked at 120.0000 JPY per SGD')
  await expect(section(page, 'Budget')).toContainText('SGD 150.00 spent of SGD 600.00')
  await expect(
    section(page, 'Money').getByRole('link', { name: 'Manage FX & locks' }),
  ).toHaveAttribute('href', '/fx/trips/12')
  await expect(section(page, 'Budget').getByRole('link', { name: 'Open budget' })).toHaveAttribute(
    'href',
    '/budget/12',
  )
  await expect(page.getByRole('link', { name: 'Pay on this trip' })).toHaveCount(0)
  await expect(section(page, 'Insurance')).toContainText('1 policy covers this trip')
  await expect(section(page, 'Family')).toContainText('Jamie has SGD 250.50')
  await expect(section(page, 'Family')).toContainText('SGD 50.00 spent of SGD 200.00 this period')
})

test('the overview is read with the trip id from the URL', async ({ page }) => {
  await as(page, PARENT)
  const seen = []
  await mockApi(page, {
    GetTripOverview: (route) => {
      seen.push(new URL(route.request().url()).searchParams.get('TripId'))
      return overview()
    },
  })
  await page.goto('/trips/12')
  await expect(section(page, 'Budget')).toContainText('spent of')
  expect(seen).toContain('12')
})

test('a trip with no budget offers to set one', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, { GetTripOverview: () => overview({ HasBudget: false, Budget: {} }) })
  await page.goto('/trips/12')
  await expect(section(page, 'Budget')).toContainText('No category budget yet')
  await section(page, 'Budget').getByRole('link', { name: 'Set a budget' }).click()
  await expect(page).toHaveURL(/\/budget\/12$/)
})

test('older policies without a trip id still count when their dates overlap', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, {
    GetTripOverview: () => overview({ Policies: [] }),
    MyInsurance: () => [DATED_POLICY],
  })
  await page.goto('/trips/12')
  await expect(section(page, 'Insurance')).toContainText('1 policy covers this trip')
})

test('a policy that does not overlap the trip dates does not count as cover', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, {
    GetTripOverview: () => overview({ Policies: [] }),
    MyInsurance: () => [
      { ...DATED_POLICY, CoverageStart: '2027-06-01', CoverageEnd: '2027-06-05' },
    ],
  })
  await page.goto('/trips/12')
  await expect(section(page, 'Insurance')).toContainText('No policy covers these dates yet')
})

test('getting cover starts the insurance flow with this trip filled in', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, { GetTripOverview: () => overview({ Policies: [] }) })
  await page.goto('/trips/12')
  await section(page, 'Insurance').getByRole('button', { name: 'Get cover for this trip' }).click()

  await expect(page).toHaveURL(/\/insurance(\?|$)/)
  await expect(page.getByLabel('Destination', { exact: true })).toHaveValue('Kyoto')
  await expect(page.getByLabel(/country code/i)).toHaveValue('JP')
  const stored = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('wetrip.insurance.trip')),
  )
  expect(stored).toMatchObject({ tripId: 12, startDate: '2027-04-01', endDate: '2027-04-14' })
})

test('the overview failing shows the error instead of an empty page', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, {
    GetTripOverview: () => ({
      __status: 500,
      body: { Errors: ['This trip belongs to another family'] },
    }),
  })
  await page.goto('/trips/12')
  await expect(page.getByText('This trip belongs to another family')).toBeVisible()
})

test('a child can pay on the trip, with no parent actions', async ({ page }) => {
  await as(page, CHILD)
  await mockApi(page, {
    GetMyFamilyRole: () => ({ role: 'Child', FamilyLinkId: 3 }),
    GetTripOverview: () => overview({ CallerRole: 'Child', HasBudget: false, Policies: [] }),
  })
  await page.goto('/trips/12')
  await expect(section(page, 'Family')).toContainText('Jamie has SGD 250.50')
  await expect(page.getByRole('button', { name: 'Get cover for this trip' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Set a budget' })).toHaveCount(0)
  await expect(page.getByLabel('Close trip', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Pay on this trip' })).toHaveAttribute(
    'href',
    '/pay?tripId=12',
  )
})

test('closing takes a confirm, then keeps showing what locking saved', async ({ page }) => {
  await as(page, PARENT)
  const calls = []
  const CLOSED = {
    ...TRIP,
    Status: 'Completed',
    ReturnedForeign: 38000,
    ReturnedSgd: 319.33,
    ReturnRate: 119,
  }
  await mockApi(page, {
    // After closing, the refetched overview reads Completed; the result must not vanish.
    GetTripOverview: () => overview(calls.length ? { Trip: CLOSED } : {}),
    CloseTrip: (route) => {
      calls.push(new URL(route.request().url()).searchParams.get('TripId'))
      return {
        Trip: { ...TRIP, Status: 'Completed' },
        SpentForeign: 10000,
        ReturnedForeign: 38000,
        SpotRate: 119,
        LockedRate: 120,
        ReturnedSgd: 319.33,
        SavedVsSpotSgd: 0.7,
      }
    },
  })
  await page.goto('/trips/12')
  const card = section(page, 'Close trip')
  await card.getByRole('button', { name: 'Close trip' }).click()
  expect(calls).toEqual([])
  await card.getByRole('button', { name: 'Close trip' }).click()
  await expect(card).toContainText('JPY 38000.00 unspent, worth SGD 319.33 today')
  await expect(card).toContainText('Locking saved SGD 0.70 versus today')
  expect(calls).toEqual(['12'])
  await expect(page.getByText('Completed', { exact: true })).toBeVisible()
  await expect(card).toContainText('Locking saved SGD 0.70 versus today')
})

test('a closed trip shows the stored result when opened later', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, {
    GetTripOverview: () =>
      overview({
        Trip: {
          ...TRIP,
          Status: 'Completed',
          ReturnedForeign: 38000,
          ReturnedSgd: 319.33,
          ReturnRate: 115,
        },
      }),
  })
  await page.goto('/trips/12')
  // 48000 JPY locked for SGD 400 is worth 48000 / 115 = SGD 417.39 at the close rate.
  await expect(section(page, 'Close trip')).toContainText('Locking saved SGD 17.39 versus today')
})

test('a trip in demo market mode says so', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, {
    GetTripOverview: () => overview({ Trip: { ...TRIP, DemoRateShiftPct: -4 } }),
  })
  await page.goto('/trips/12')
  await expect(page.getByText('Demo market -4%')).toBeVisible()
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
    GetTripOverview: () =>
      overview({
        Trip: { ...TRIP, LockedForeign: 96675.38 },
        SpentForeign: 20000.5,
        RemainingForeign: 76674.88,
      }),
  })
  await page.goto('/trips/12')
  await expect(section(page, 'Money')).toContainText(
    'JPY 76674.88 left of JPY 96675.38 (JPY 20000.50 spent)',
  )
})
