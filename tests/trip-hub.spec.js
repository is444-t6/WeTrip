import { test, expect } from '@playwright/test'

// The one-trip overview (/trips/:id), against a faked backend. The trip, its
// money, budget and trip-linked policies come from one call, Trip.GetTripOverview;
// Family is read as before. Only policies linked by TripId count as cover.
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
  // Two date-overlapping policies bought for nothing in particular must not add to the count.
  await mockApi(page, { MyInsurance: () => [DATED_POLICY, { ...DATED_POLICY, PurchaseId: 6 }] })
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
  await expect(section(page, 'Insurance').getByText('Covered', { exact: true })).toBeVisible()
  await expect(section(page, 'Family')).toContainText('Jamie has SGD 250.50')
  await expect(section(page, 'Family')).toContainText('SGD 50.00 spent of SGD 200.00 this period')
})

test('the Money card shows the miles earned on the trip, and nothing when none', async ({
  page,
}) => {
  await as(page, CHILD)
  const child = { GetMyFamilyRole: () => ({ role: 'Child', FamilyLinkId: 3 }) }
  let earned = 30
  await mockApi(page, { ...child, GetTripOverview: () => overview({ MilesEarned: earned }) })
  await page.goto('/trips/12')
  await expect(section(page, 'Money')).toContainText('30 miles earned on this trip')

  earned = 0
  await page.reload()
  await expect(section(page, 'Money')).toContainText('SGD 400.00 locked')
  await expect(section(page, 'Money')).not.toContainText('miles')
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

test('the Budget card shows the fixed costs when the budget has any', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, { GetTripOverview: () => overview({ Budget: { ...BUDGET, FixedSgd: 300 } }) })
  await page.goto('/trips/12')
  await expect(section(page, 'Budget')).toContainText('SGD 300.00 fixed')
  await expect(section(page, 'Budget')).toContainText('SGD 150.00 spent of SGD 600.00')
})

test('the Budget card has no fixed line when there are no fixed costs', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, { GetTripOverview: () => overview({ Budget: { ...BUDGET, FixedSgd: 0 } }) })
  await page.goto('/trips/12')
  await expect(section(page, 'Budget')).toContainText('spent of')
  await expect(section(page, 'Budget')).not.toContainText('fixed')
})

test('policies that overlap the dates but are not linked to this trip do not count', async ({
  page,
}) => {
  await as(page, PARENT)
  await mockApi(page, {
    GetTripOverview: () => overview({ Policies: [] }),
    MyInsurance: () => [
      { ...DATED_POLICY, TripId: 0 },
      { ...DATED_POLICY, PurchaseId: 6, TripId: 99 },
    ],
  })
  await page.goto('/trips/12')
  await expect(section(page, 'Insurance')).toContainText('No policy covers this trip yet')
  await expect(section(page, 'Insurance').getByText('Covered', { exact: true })).toHaveCount(0)
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
  await expect(section(page, 'Insurance')).toContainText('No policy covers this trip yet')
})

test('the Family card says Loading… until the children arrive, not that none is linked', async ({
  page,
}) => {
  await as(page, PARENT)
  await mockApi(page)
  // Registered after mockApi, so they win; never fulfilling keeps the queries loading.
  await page.route('**/GetChildren*', () => {})
  await page.route('**/MyInsurance*', () => {})
  await page.goto('/trips/12')
  await expect(section(page, 'Family')).toContainText('Loading…')
  await expect(section(page, 'Family')).not.toContainText('No child account')
  // The Insurance card reads only the overview, so it never flashes an empty state.
  await expect(section(page, 'Insurance')).toContainText('1 policy covers this trip')
})

// Starts "Get cover for this trip" on trip 12 and buys the plan, returning the Purchase body.
// `newEndInDays` edits the return date on the first insurance step.
async function buyCoverFromTrip(page, newEndInDays) {
  const inDays = (n) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d.toLocaleDateString('sv')
  }
  let body
  await as(page, PARENT)
  await mockApi(page, {
    GetTripOverview: () =>
      overview({
        Policies: [],
        Trip: { ...TRIP, TripStartDate: inDays(30), TripEndDate: inDays(37) },
      }),
    Plans: () => [
      { Id: 1, Name: 'Essential', MaxTravellers: 1, CurrencyCode: 'SGD', IsActive: true },
    ],
    Benefits: () => [],
    Quote: () => ({ TotalPremium: 24, CurrencyCode: 'SGD', TripDays: 8 }),
    Purchase: (route) => {
      body = route.request().postDataJSON()
      return { PaymentSuccess: true, PurchaseId: 77, PolicyNumber: 'POL-1', Status: 'Confirmed' }
    },
    GetMe: () => ({ DisplayName: 'Parent', CustomerId: '0000002169', Balance: 100 }),
  })
  await page.goto('/trips/12')
  await section(page, 'Insurance').getByRole('button', { name: 'Get cover for this trip' }).click()
  if (newEndInDays) await page.getByLabel('Return').fill(inDays(newEndInDays))
  await page.getByRole('button', { name: 'Continue to insurance plans' }).click()
  await page.getByRole('button', { name: 'Choose plan' }).click()
  await page.getByRole('button', { name: 'Choose this plan' }).click()
  await page.getByLabel('Full name').fill('Jamie Example')
  await page.getByLabel('Date of birth').fill('2000-01-01')
  await page.getByLabel('Nationality code').fill('SG')
  await page.getByLabel('Contact email').fill('jamie@example.com')
  await page.getByRole('button', { name: 'Get quote and review' }).click()
  await page.getByRole('button', { name: 'Confirm purchase' }).click()
  await expect(page).toHaveURL(/\/insurance\/confirmation$/)
  return body
}

test('cover bought from the trip page is sent with that trip id', async ({ page }) => {
  expect(await buyCoverFromTrip(page)).toMatchObject({ TripId: 12 })
})

test('changing the dates on the first insurance step drops the trip link', async ({ page }) => {
  expect(await buyCoverFromTrip(page, 38)).toMatchObject({ TripId: 0 })
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

// GetCloseOptions (Trip composite, parent only): leftover foreign money at today's
// rate against what it cost at the locked rate. Better is "Spot", "Locked" or "Equal".
const OPTIONS = {
  UnspentForeign: 38000,
  Currency: 'JPY',
  SpotRate: 119,
  LockedRate: 120,
  ValueAtSpotSgd: 319.33,
  CostAtLockedSgd: 316.67,
  Better: 'Spot',
}
const withOptions = (page, over, extra = {}) =>
  mockApi(page, { GetCloseOptions: () => ({ ...OPTIONS, ...over }), ...extra })

test('the close card compares today’s rate with the locked cost', async ({ page }) => {
  await as(page, PARENT)
  const seen = []
  await mockApi(page, {
    GetCloseOptions: (route) => {
      seen.push(new URL(route.request().url()).searchParams.get('TripId'))
      return OPTIONS
    },
  })
  await page.goto('/trips/12')
  const card = section(page, 'Close trip')
  await expect(card).toContainText("Value in SGD at today's rate: SGD 319.33")
  await expect(card).toContainText('What it cost you at your locked rate: SGD 316.67')
  await expect(card).toContainText('Converting now beats your locked cost')
  await expect(card).toContainText('No money moves when you close.')
  expect(seen).toEqual(['12'])
  // Still there on the confirm step.
  await card.getByRole('button', { name: 'Close trip' }).click()
  await expect(card).toContainText('Converting now beats your locked cost')
})

test('a lower locked rate makes the locked cost the better side', async ({ page }) => {
  await as(page, PARENT)
  await withOptions(page, { LockedRate: 118, CostAtLockedSgd: 322.03, Better: 'Locked' })
  await page.goto('/trips/12')
  const card = section(page, 'Close trip')
  await expect(card).toContainText('What it cost you at your locked rate: SGD 322.03')
  await expect(card).toContainText("Your locked cost beats today's rate")
  await expect(card).not.toContainText('Converting now beats your locked cost')
})

test('equal values show both amounts and no comparison line', async ({ page }) => {
  await as(page, PARENT)
  await withOptions(page, { CostAtLockedSgd: 319.33, Better: 'Equal' })
  await page.goto('/trips/12')
  const card = section(page, 'Close trip')
  await expect(card).toContainText("Value in SGD at today's rate: SGD 319.33")
  await expect(card).not.toContainText('beats')
})

// The options request has been answered, and the card is still the plain one.
async function expectPlainCloseCard(page, answered) {
  const card = section(page, 'Close trip')
  await expect(card.getByRole('button', { name: 'Close trip' })).toBeVisible()
  await expect.poll(answered).toBe(true)
  await expect(card).not.toContainText("today's rate")
  await expect(card).not.toContainText('No money moves')
  await expect(page.getByRole('alert')).toHaveCount(0)
}

test('with nothing unspent the close card is the plain one', async ({ page }) => {
  await as(page, PARENT)
  let answered = false
  await mockApi(page, {
    GetCloseOptions: () => ((answered = true), { ...OPTIONS, UnspentForeign: 0 }),
  })
  await page.goto('/trips/12')
  await expectPlainCloseCard(page, () => answered)
})

test('a failing GetCloseOptions leaves the plain close card, with no error', async ({ page }) => {
  await as(page, PARENT)
  let answered = false
  await mockApi(page, {
    GetCloseOptions: () => (
      (answered = true),
      { __status: 500, body: { Errors: ['Trip has ended'] } }
    ),
  })
  await page.goto('/trips/12')
  await expectPlainCloseCard(page, () => answered)
  await expect(page.getByText('Trip has ended')).toHaveCount(0)
})

test('the CloseTrip reply, not the preview, is what the closed card shows', async ({ page }) => {
  await as(page, PARENT)
  await withOptions(
    page,
    {},
    {
      // Spot moved between the preview and the confirm.
      CloseTrip: () => ({
        Trip: { ...TRIP, Status: 'Completed' },
        ReturnedForeign: 38000,
        ReturnedSgd: 317.5,
        SavedVsSpotSgd: -1.25,
      }),
    },
  )
  await page.goto('/trips/12')
  const card = section(page, 'Close trip')
  await card.getByRole('button', { name: 'Close trip' }).click()
  await card.getByRole('button', { name: 'Close trip' }).click()
  await expect(card).toContainText('Trip closed. JPY 38000.00 unspent, worth SGD 317.50 today.')
  await expect(card).toContainText("Locking cost SGD 1.25 versus today's rate")
  await expect(card).not.toContainText('Value in SGD at today')
})

test('a child does not read the close options', async ({ page }) => {
  await as(page, CHILD)
  let calls = 0
  await mockApi(page, {
    GetCloseOptions: () => (calls++, OPTIONS),
    GetMyFamilyRole: () => ({ role: 'Child', FamilyLinkId: 3 }),
    GetTripOverview: () => overview({ CallerRole: 'Child' }),
  })
  await page.goto('/trips/12')
  await expect(section(page, 'Family')).toContainText('Jamie has SGD 250.50')
  await expect(section(page, 'Close trip')).toHaveCount(0)
  expect(calls).toBe(0)
})

test('an ended trip shows its stored result, not a fresh comparison', async ({ page }) => {
  await as(page, PARENT)
  let calls = 0
  await mockApi(page, {
    GetCloseOptions: () => (calls++, OPTIONS),
    GetTripOverview: () => overview({ Trip: { ...TRIP, Status: 'Completed', ReturnRate: 115 } }),
  })
  await page.goto('/trips/12')
  await expect(section(page, 'Close trip')).toContainText('Trip closed.')
  expect(calls).toBe(0)
})

// Keep for my next trip: GetCloseOptions lists EligibleTrips, and CloseTrip takes
// CarryToTripId. A carried trip is Completed with CarriedForeign and CarriedToTripId.
const OSAKA = {
  TripId: 21,
  Destination: 'Osaka',
  TripStartDate: '2027-05-01',
  TripEndDate: '2027-05-10',
}
const TOKYO = {
  TripId: 22,
  Destination: 'Tokyo',
  TripStartDate: '2027-06-01',
  TripEndDate: '2027-06-09',
}
const LEFTOVER = { ...OPTIONS, UnspentForeign: 1094, EligibleTrips: [OSAKA, TOKYO] }
const CARRIED = {
  ...TRIP,
  Status: 'Completed',
  ReturnedForeign: 0,
  CarriedForeign: 1094,
  CarriedToTripId: 22,
}
const FAMILY_TRIPS = [
  { ...TRIP, Id: 21, Destination: 'Osaka' },
  { ...TRIP, Id: 22, Destination: 'Tokyo' },
]
const confirmClose = async (card) => {
  await card.getByRole('button', { name: 'Close trip' }).click()
  await card.getByLabel('Keep for my next trip').check()
}

test('keeping the money lists the eligible trips and closes with the one picked', async ({
  page,
}) => {
  await as(page, PARENT)
  const calls = []
  await mockApi(page, {
    GetCloseOptions: () => LEFTOVER,
    GetTrips: () => FAMILY_TRIPS,
    GetTripOverview: () => overview(calls.length ? { Trip: CARRIED } : {}),
    CloseTrip: (route) => {
      calls.push(Object.fromEntries(new URL(route.request().url()).searchParams))
      return { Trip: CARRIED, ReturnedForeign: 0, ReturnedSgd: 0, SavedVsSpotSgd: 0 }
    },
  })
  await page.goto('/trips/12')
  const card = section(page, 'Close trip')
  await confirmClose(card)
  const next = card.getByLabel('Which trip')
  await expect(next.locator('option')).toHaveText([
    'Osaka, 2027-05-01 → 2027-05-10',
    'Tokyo, 2027-06-01 → 2027-06-09',
  ])
  await next.selectOption('22')
  await card.getByRole('button', { name: 'Close trip' }).click()
  await expect(card).toContainText('Trip closed. JPY 1094.00 carried to Tokyo.')
  expect(calls).toEqual([{ TripId: '12', CarryToTripId: '22' }])
  await expect(card).not.toContainText('worth')
  await expect(card).not.toContainText('Locking')
})

test('converting back still sends no CarryToTripId when trips are eligible', async ({ page }) => {
  await as(page, PARENT)
  const calls = []
  await mockApi(page, {
    GetCloseOptions: () => LEFTOVER,
    CloseTrip: (route) => {
      calls.push(new URL(route.request().url()).searchParams.has('CarryToTripId'))
      return { Trip: { ...TRIP, Status: 'Completed' }, ReturnedForeign: 1094, ReturnedSgd: 9.17 }
    },
  })
  await page.goto('/trips/12')
  const card = section(page, 'Close trip')
  await card.getByRole('button', { name: 'Close trip' }).click()
  await card.getByRole('button', { name: 'Close trip' }).click()
  await expect(card).toContainText('Trip closed. JPY 1094.00 unspent')
  expect(calls).toEqual([false])
})

test('with no eligible trip, keeping the money cannot be confirmed', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, { GetCloseOptions: () => ({ ...LEFTOVER, EligibleTrips: [] }) })
  await page.goto('/trips/12')
  const card = section(page, 'Close trip')
  await confirmClose(card)
  await expect(card).toContainText('No Watching or Partly locked JPY trip has room for this yet')
  await expect(card.getByRole('button', { name: 'Close trip' })).toBeDisabled()
  await card.getByLabel('Keep for my next trip').uncheck()
  await expect(card.getByRole('button', { name: 'Close trip' })).toBeEnabled()
})

test('a refused carry-over shows the reason and leaves the trip open', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, {
    GetCloseOptions: () => LEFTOVER,
    CloseTrip: () => ({
      __status: 400,
      body: { Errors: ["That trip can't take the carry-over"] },
    }),
  })
  await page.goto('/trips/12')
  const card = section(page, 'Close trip')
  await confirmClose(card)
  await card.getByRole('button', { name: 'Close trip' }).click()
  await expect(page.getByRole('alert')).toHaveText("That trip can't take the carry-over")
  await expect(card.getByRole('button', { name: 'Close trip' })).toBeEnabled()
  await expect(card).not.toContainText('Trip closed.')
})

test('a carried trip opened later says where the money went', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, {
    GetTrips: () => FAMILY_TRIPS,
    GetTripOverview: () => overview({ Trip: CARRIED }),
  })
  await page.goto('/trips/12')
  const card = section(page, 'Close trip')
  await expect(card).toContainText('Trip closed. JPY 1094.00 carried to Tokyo.')
  await expect(card).not.toContainText('worth')
  await expect(card).not.toContainText('Locking')
})

test('a carried trip says "your next trip" while its destination is unknown', async ({ page }) => {
  await as(page, PARENT)
  // GetTrips is not mocked, so the list never loads.
  await mockApi(page, { GetTripOverview: () => overview({ Trip: CARRIED }) })
  await page.goto('/trips/12')
  await expect(section(page, 'Close trip')).toContainText(
    'Trip closed. JPY 1094.00 carried to your next trip.',
  )
})

test('the trip that received a carry-over shows where it came from', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, {
    GetTrips: () => FAMILY_TRIPS,
    GetTripOverview: () =>
      overview({
        Locks: [
          {
            Id: 90,
            TripId: 12,
            Source: 'CarryOver',
            ForeignAmount: 1094,
            SgdAmount: 9.01,
            ReferenceNumber: 'carry:21',
          },
        ],
      }),
  })
  await page.goto('/trips/12')
  await expect(section(page, 'Money')).toContainText('Carried JPY 1094.00 from Osaka')
})

test('a trip with no carry-over lock does not read the trip list', async ({ page }) => {
  await as(page, PARENT)
  let calls = 0
  await mockApi(page, { GetTrips: () => (calls++, FAMILY_TRIPS) })
  await page.goto('/trips/12')
  await expect(section(page, 'Money')).toContainText('SGD 400.00 locked')
  await expect(section(page, 'Money')).not.toContainText('Carried')
  expect(calls).toBe(0)
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

test('a Pay later card lists the trip instalment plans', async ({ page }) => {
  await as(page, CHILD)
  await mockApi(page, {
    GetTripOverview: () =>
      overview({
        CallerRole: 'Child',
        BnplPlans: [
          {
            MerchantName: 'Universal Studios Japan',
            NumberOfMonths: 3,
            MonthlyInstallment: 1506.5,
            FirstRepaymentDate: '2027-04-07T00:00:00',
            MaturityDate: '2027-06-07',
          },
        ],
      }),
  })
  await page.goto('/trips/12')
  await expect(section(page, 'Pay later')).toContainText(
    'Universal Studios Japan · 3 × JPY 1506.50 · first 2027-04-07 · ends 2027-06-07',
  )
})

test('a trip with no instalment plans has no Pay later card', async ({ page }) => {
  await as(page, CHILD)
  await mockApi(page, { GetTripOverview: () => overview({ BnplPlans: [] }) })
  await page.goto('/trips/12')
  await expect(section(page, 'Money')).toBeVisible()
  await expect(section(page, 'Pay later')).toHaveCount(0)
})
