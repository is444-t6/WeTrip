import { test, expect } from '@playwright/test'

// Whole Family frontend against a mocked API (no live backend needed).
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
    hostCurrency: 'JPY',
    balance: 250.5,
    budget: 200,
    period: 'Weekly',
    spent: 50,
    hasAllowance: true,
  },
  {
    familyLinkId: 4,
    nickname: 'Second kid',
    childCustomerId: '0000002197',
    status: 'Active',
    hostCurrency: 'JPY',
    balance: 20,
    budget: 0,
  },
]
const REQUESTS = [
  {
    RequestId: 11,
    FamilyLinkId: 3,
    Nickname: 'Jamie',
    MerchantAccountId: '0000006718',
    Amount: 40,
    Category: 'Food',
    Narrative: 'Lunch',
  },
]
const DASH = {
  Nickname: 'Jamie',
  HasBudget: true,
  Period: 'Weekly',
  Budget: 200,
  Spent: 50,
  Remaining: 150,
  Balance: 250.5,
  HostCurrency: 'JPY',
  Rate: 123.517,
  ByCategory: [{ Category: 'Food', Total: 50 }],
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
    GetPendingRequests: () => REQUESTS,
    GetChildDashboard: () => DASH,
    GetMyLinkInvite: () => ({ FamilyLinkId: 3, ParentCustomerId: '0000002169', Nickname: 'Mum' }),
    GetChildExpenses: () => ({
      Expenses: [
        {
          TransactionId: 'T1',
          Date: '2026-11-03T10:00:00Z',
          Amount: 40,
          Currency: 'SGD',
          AccountTo: '0000006718',
          Category: 'Food',
          Source: 'Approved',
        },
      ],
      Total: 40,
      HostCurrency: 'JPY',
      Rate: 123.5,
    }),
    GetBalanceTrend: () => [
      { YearMonth: '2026-09-01' },
      { YearMonth: '2026-10-01', Balance: 100 },
      { YearMonth: '2026-11-07', Balance: 250.5 },
    ],
    FindCustomerByPhone: () => ({ customerId: '0000009999', name: 'New Kid' }),
    LinkChild: () => ({ id: 9 }),
    AcceptLink: () => ({ status: 'Active' }),
    SetBudget: () => ({}),
    TopUp: () => ({ TransactionId: '0000001', BalanceAfter: 975 }),
    SetupAllowance: () => ({ StandingInstructionId: 5 }),
    StopAllowance: () => ({}),
    ChildSpend: () => ({ Status: 'Completed', Remaining: 140 }),
    DecideRequest: (b) => ({ Status: b.approve ? 'Approved' : 'Rejected' }),
    // SmartFX reads the Family screens make. Faked too, so a mocked run never
    // reaches the live sandbox through the dev proxy.
    GetTrips: () => [],
    GetTrip: () => ({ Trip: {}, Locks: [], Spends: [] }),
    GetRate: () => ({ spotRate: 123.548, forwardRate: 121.0494, period: '6M', currency: 'JPY' }),
    // The home page, where sign-in now lands, also lists recent Scan to Pay payments.
    GetHistory: () => ({ Payments: [], BnplPlans: [] }),
    // The sign-in looks the deposit account up from the customer id.
    GetMyAccounts: () => [
      { AccountId: '0000004554', ProductName: 'CASA', Currency: 'SGD', Balance: 1000 },
    ],
    ...over,
  }
  const serve = (route) => {
    const url = new URL(route.request().url())
    const name = url.pathname.split('/').pop()
    const raw = route.request().postData()
    const body = raw ? JSON.parse(raw) : undefined
    calls.push({ name, body, query: Object.fromEntries(url.searchParams) })
    const h = handlers[name]
    if (!h) return route.fulfill(reply({ Errors: [`unmocked ${name}`] }, 500))
    const out = h(body, Object.fromEntries(url.searchParams))
    return out && out.__status
      ? route.fulfill(reply(out.body, out.__status))
      : route.fulfill(reply(out))
  }
  await page.route('**/api/family/**', serve)
  await page.route('**/api/fx/**', serve)
  // Path match, not a glob: a glob would also catch /src/features/scantopay/ modules.
  await page.route((url) => url.pathname.startsWith('/scantopay/'), serve)
  return calls
}
const last = (calls, name) => calls.filter((c) => c.name === name).at(-1)
const field = (scope, label) =>
  scope.locator('.field', { hasText: label }).locator('input,select').first()
const openTab = (page, name) => page.getByRole('tab', { name }).click()
const card = (page, btn) =>
  page.locator('.card', { has: page.getByRole('button', { name: btn, exact: true }) })

test.describe('signed out / login', () => {
  test('signed-out visitor sees the sign-in card', async ({ page }) => {
    await page.goto('/family')
    await expect(page.getByText("You're not signed in yet.")).toBeVisible()
  })
  test('dev login stores the session token', async ({ page }) => {
    await mockApi(page)
    await page.goto('/login')
    await page.getByPlaceholder('0000003018').fill('0000002169')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/$/)
    // The name is not asked for; it is whatever GetMe knows.
    expect(await page.evaluate(() => sessionStorage.getItem('wetrip_session'))).toBe(
      '0000002169:0000004554:Parent Demo',
    )
    await expect(page.getByText('Hi, Parent!')).toBeVisible()
    await expect(page.getByText('Available balance')).toBeVisible()
  })
})

test.describe('parent home', () => {
  test.beforeEach(({ page }) => as(page, PARENT))

  test('shows balance, linked count, approvals and children', async ({ page }) => {
    await mockApi(page)
    await page.goto('/family')
    await expect(page.getByText('2 children linked')).toBeVisible()
    await expect(page.getByText('1 awaiting approval')).toBeVisible()
    await expect(page.getByText('Second kid')).toBeVisible()
    await expect(page.getByText('allowance', { exact: true })).toBeVisible()
  })

  test('child card balance is labelled SGD, not the host currency', async ({ page }) => {
    await mockApi(page)
    await page.goto('/family')
    const jamie = page.locator('.card', { hasText: 'Jamie' }).filter({ hasText: 'Manage' }).first()
    await expect(jamie).toContainText('SGD 250.50')
    await expect(jamie).not.toContainText('JPY 250.50')
  })

  test('approve and reject send the right DecideRequest payloads', async ({ page }) => {
    const calls = await mockApi(page)
    await page.goto('/family')
    // Let every query on the page land first so the click can't hit a card
    // that is about to re-render.
    await expect(page.getByText('Second kid')).toBeVisible()
    await expect(page.getByText('1 awaiting approval')).toBeVisible()
    await page.getByRole('button', { name: 'Approve' }).click()
    await expect
      .poll(() => last(calls, 'DecideRequest')?.body, { timeout: 10_000 })
      .toEqual({ requestId: 11, approve: true })
    // The list refetches after a decision, and a click that lands mid re-render
    // is lost, so retry the click until the call is seen.
    await expect(async () => {
      await page.getByRole('button', { name: 'Reject' }).click({ timeout: 2_000 })
      expect(last(calls, 'DecideRequest')?.body).toEqual({ requestId: 11, approve: false })
    }).toPass({ timeout: 10_000 })
  })

  test('link a child: find by phone, then send the invite', async ({ page }) => {
    const calls = await mockApi(page)
    await page.goto('/family')
    await page.getByRole('button', { name: 'Add a child' }).click()
    const form = page.locator('.card', { has: page.getByRole('button', { name: 'Find' }) })
    await field(form, 'Phone number').fill('91234567')
    await form.getByRole('button', { name: 'Find' }).click()
    await expect(page.getByText('New Kid')).toBeVisible()
    expect(last(calls, 'FindCustomerByPhone').query).toMatchObject({
      countryCode: '65',
      phoneNumber: '91234567',
    })
    await field(page, 'Nickname').fill('Kiddo')
    await page.getByRole('button', { name: 'Send invite' }).click()
    await expect(page.getByText('Invite sent')).toBeVisible()
    expect(last(calls, 'LinkChild').body).toEqual({
      childCustomerId: '0000009999',
      nickname: 'Kiddo',
      hostCurrency: 'SGD',
    })
  })

  test('found card still reads well when the backend returns no customer name', async ({
    page,
  }) => {
    await mockApi(page, { FindCustomerByPhone: () => ({ CustomerId: '0000009999' }) })
    await page.goto('/family')
    await page.getByRole('button', { name: 'Add a child' }).click()
    const form = page.locator('.card', { has: page.getByRole('button', { name: 'Find' }) })
    await field(form, 'Phone number').fill('91234567')
    await form.getByRole('button', { name: 'Find' }).click()
    await expect(page.getByText('Customer found')).toBeVisible()
    await expect(page.getByText('Customer id 0000009999')).toBeVisible()
  })

  test('a raw HTML backend error is not shown to the user', async ({ page }) => {
    await mockApi(page, {
      GetChildren: () => ({
        __status: 500,
        body: { Errors: ['SMUtBank error 404: <!DOCTYPE html><html>x</html>'] },
      }),
    })
    await page.goto('/family')
    const banner = page.locator('.banner.error').first()
    await expect(banner).toContainText('Something went wrong')
    await expect(banner).not.toContainText('DOCTYPE')
  })
})

test.describe('roles', () => {
  test('an unrecognised role shows a fallback card', async ({ page }) => {
    await as(page, PARENT)
    await mockApi(page, { GetMyFamilyRole: () => ({ role: 'Removed' }) })
    await page.goto('/family')
    await expect(page.getByText("Your family link isn't active.")).toBeVisible()
  })

  test('a pending child can accept the invite', async ({ page }) => {
    await as(page, CHILD)
    const calls = await mockApi(page, {
      GetMyFamilyRole: () => ({ role: 'Pending' }),
      // The account list failing is what puts the typed field on screen (the
      // dropdown and the fallback have tests of their own below).
      GetMyAccounts: () => ({ __status: 500, body: { Errors: ['boom'] } }),
    })
    await page.goto('/family')
    await expect(page.getByText('Mum')).toBeVisible()
    await page.getByPlaceholder('Your deposit AccountId').fill('0000006064')
    await page.getByRole('button', { name: 'Accept invite' }).click()
    await expect(page.getByText('Link accepted')).toBeVisible()
    expect(last(calls, 'AcceptLink').body).toEqual({ familyLinkId: 3, accountId: '0000006064' })
  })

  test('a child with no invite sees the not-linked message', async ({ page }) => {
    await as(page, CHILD)
    await mockApi(page, { GetMyFamilyRole: () => ({ role: 'None' }), GetMyLinkInvite: () => ({}) })
    await page.goto('/family')
    await expect(page.getByText("You're not linked to a family yet.")).toBeVisible()
  })

  test('hasInvite:false (an already-active link) is not shown as an invite', async ({ page }) => {
    await as(page, CHILD)
    await mockApi(page, {
      GetMyFamilyRole: () => ({ role: 'None' }),
      GetMyLinkInvite: () => ({ hasInvite: false, FamilyLinkId: 3, Nickname: 'Mum' }),
    })
    await page.goto('/family')
    await expect(page.getByText("You're not linked to a family yet.")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Accept invite' })).toHaveCount(0)
  })

  test('"no family link" from the backend reads as not linked, not as an error', async ({
    page,
  }) => {
    await as(page, CHILD)
    await mockApi(page, {
      GetMyFamilyRole: () => ({ role: 'None' }),
      GetMyLinkInvite: () => ({
        __status: 500,
        body: { Errors: ['Not found: no family link for this child'] },
      }),
    })
    await page.goto('/family')
    await expect(page.getByText("You're not linked to a family yet.")).toBeVisible()
    await expect(page.locator('.banner.error')).toHaveCount(0)
  })

  test('a real failure loading the invite is still shown as an error', async ({ page }) => {
    await as(page, CHILD)
    await mockApi(page, {
      GetMyFamilyRole: () => ({ role: 'Pending' }),
      GetMyLinkInvite: () => ({ __status: 500, body: { Errors: ['Invalid API Key'] } }),
    })
    await page.goto('/family')
    await expect(page.locator('.banner.error')).toContainText('Invalid API Key')
  })

  test('the invite offers the child’s own accounts in a dropdown', async ({ page }) => {
    await as(page, CHILD)
    const calls = await mockApi(page, {
      GetMyFamilyRole: () => ({ role: 'Pending' }),
      GetMyAccounts: () => [
        { accountId: '0000006064', balance: 14235.2, currency: 'SGD', currentStatus: 'Open' },
        { accountId: '0000006999', balance: 1, currency: 'SGD', currentStatus: 'Closed' },
      ],
    })
    await page.goto('/family')
    const select = page.locator('.field select')
    await expect(select).toBeVisible()
    await expect(select.locator('option')).toHaveCount(2) // placeholder + the open account
    await select.selectOption('0000006064')
    await page.getByRole('button', { name: 'Accept invite' }).click()
    await expect(page.getByText('Link accepted')).toBeVisible()
    expect(last(calls, 'AcceptLink').body).toEqual({ familyLinkId: 3, accountId: '0000006064' })
  })

  test('if the account list fails, the invite falls back to typing the account id', async ({
    page,
  }) => {
    await as(page, CHILD)
    await mockApi(page, {
      GetMyFamilyRole: () => ({ role: 'Pending' }),
      GetMyAccounts: () => ({ __status: 500, body: { Errors: ['boom'] } }),
    })
    await page.goto('/family')
    await expect(page.getByPlaceholder('Your deposit AccountId')).toBeVisible()
    await expect(page.locator('.field select')).toHaveCount(0)
  })
})

test.describe('child dashboard', () => {
  test.beforeEach(({ page }) => as(page, CHILD))
  const child = { GetMyFamilyRole: () => ({ role: 'Child' }) }

  test('hero is SGD with a clear rate line; budget bar and categories render', async ({ page }) => {
    await mockApi(page, child)
    await page.goto('/family')
    await expect(page.locator('.hero-amount')).toContainText('SGD 250.50')
    await expect(page.locator('.hero-sub')).toContainText('1 SGD = 123.52 JPY')
    await expect(page.getByText('150.00 remaining')).toBeVisible()
    await expect(page.locator('.card', { hasText: 'Budget this' }).getByText('Food')).toBeVisible()
  })

  test('paying within budget confirms; over budget is declined, not held', async ({ page }) => {
    let status = 'Completed'
    const calls = await mockApi(page, {
      ...child,
      ChildSpend: () => ({ Status: status, Remaining: 140 }),
    })
    await page.goto('/family')
    await field(page, 'Merchant account id').fill('0000006718')
    await field(page, 'Amount').fill('10')
    await page.getByRole('button', { name: 'Pay', exact: true }).click()
    await expect(page.getByText('Paid! Remaining this period: SGD 140.00')).toBeVisible()
    expect(last(calls, 'ChildSpend').body).toMatchObject({
      merchantAccountId: '0000006718',
      amount: 10,
      category: 'Others',
    })
    status = 'Declined'
    await field(page, 'Merchant account id').fill('0000006718')
    await field(page, 'Amount').fill('500')
    await page.getByRole('button', { name: 'Pay', exact: true }).click()
    await expect(page.getByText('Payment not made')).toBeVisible()
    await expect(page.getByText('Paid!')).toHaveCount(0)
  })
})

test.describe('asking for more', () => {
  const child = { GetChildDashboard: () => DASH, GetMyFamilyRole: () => ({ role: 'Child' }) }

  test('a declined payment offers an ask, prefilled with how far over it is', async ({ page }) => {
    await as(page, CHILD)
    const calls = await mockApi(page, {
      ...child,
      ChildSpend: () => ({
        Status: 'Declined',
        shortBy: 350,
        message: "Over this month's budget by SGD 350.00",
      }),
      AskForMore: () => ({ requestId: 21, status: 'PendingApproval' }),
    })
    await page.goto('/family')
    await field(page, 'Merchant account id').fill('0000006718')
    await field(page, 'Amount').fill('500')
    await page.getByRole('button', { name: 'Pay', exact: true }).click()

    await expect(page.getByText("Over this month's budget by SGD 350.00")).toBeVisible()
    await expect(page.getByLabel('Ask your parent for')).toHaveValue('350')

    await page.getByLabel('What is it for?').fill('School trip')
    await page.getByRole('button', { name: 'Ask for more' }).click()
    await expect
      .poll(() => last(calls, 'AskForMore')?.body)
      .toEqual({ amount: 350, reason: 'School trip' })
    await expect(page.getByText('Payment not made')).toHaveCount(0)
    await expect(page.getByText(/Asked your parent/)).toBeVisible()
  })

  test('a failed ask shows the error and keeps the form', async ({ page }) => {
    await as(page, CHILD)
    await mockApi(page, {
      ...child,
      ChildSpend: () => ({ Status: 'Declined', shortBy: 10 }),
    })
    await page.goto('/family')
    await field(page, 'Merchant account id').fill('0000006718')
    await field(page, 'Amount').fill('500')
    await page.getByRole('button', { name: 'Pay', exact: true }).click()
    // AskForMore is left unmocked, so the mock answers it with a 500.
    await page.getByRole('button', { name: 'Ask for more' }).click()
    await expect(page.locator('.banner.error', { hasText: 'unmocked AskForMore' })).toBeVisible()
    await expect(page.getByLabel('Ask your parent for')).toBeVisible()
  })

  test('a parent grants an ask: the amount asked for, for 24 hours', async ({ page }) => {
    await as(page, PARENT)
    const calls = await mockApi(page, {
      GetPendingRequests: () => [
        {
          RequestId: 22,
          FamilyLinkId: 3,
          Nickname: 'Jamie',
          MerchantAccountId: '',
          Amount: 35,
          Narrative: 'School trip',
        },
      ],
    })
    await page.goto('/family')
    await expect(page.getByText('School trip')).toBeVisible()
    await expect(page.getByText('To account')).toHaveCount(0)
    await page.getByRole('button', { name: 'Give it' }).click()
    await expect
      .poll(() => last(calls, 'DecideRequest')?.body)
      .toEqual({ requestId: 22, approve: true, grantAmount: 35, hours: 24 })
  })

  test('turning an ask down sends no grant', async ({ page }) => {
    await as(page, PARENT)
    const calls = await mockApi(page, {
      GetPendingRequests: () => [
        { RequestId: 23, FamilyLinkId: 3, Nickname: 'Jamie', MerchantAccountId: '', Amount: 35 },
      ],
    })
    await page.goto('/family')
    await page.getByRole('button', { name: 'Not now' }).click()
    await expect
      .poll(() => last(calls, 'DecideRequest')?.body)
      .toEqual({ requestId: 23, approve: false })
  })
})

test.describe('grants, history and spending rules', () => {
  const child = { GetChildDashboard: () => DASH, GetMyFamilyRole: () => ({ role: 'Child' }) }

  test('a parent can raise the limit in one tap, for a day', async ({ page }) => {
    await as(page, PARENT)
    const calls = await mockApi(page, { GrantBudget: () => ({ id: 5 }) })
    await page.goto('/family/child/3')
    await page.getByRole('tab', { name: 'Manage' }).click()
    await page.getByRole('button', { name: '+ SGD 20' }).click()
    await expect
      .poll(() => last(calls, 'GrantBudget')?.body)
      .toEqual({ familyLinkId: 3, amount: 20, days: 1, note: '' })
    await expect(page.getByText('Added SGD 20 for 1 day.')).toBeVisible()
  })

  test('the child sees how earlier asks went', async ({ page }) => {
    await as(page, CHILD)
    await mockApi(page, {
      ...child,
      GetMyRequests: () => [
        {
          requestId: 20,
          requestedAmount: 30,
          reason: 'Books',
          status: 'Rejected',
          parentNote: 'Next week',
        },
        {
          requestId: 19,
          requestedAmount: 20,
          reason: 'Lunch',
          status: 'Approved',
          grantedAmount: 15,
        },
        { requestId: 18, requestedAmount: 10, reason: 'Bus', status: 'Pending' },
      ],
    })
    await page.goto('/family')
    const card = page.locator('.card', { hasText: 'Your asks' })
    await expect(card.getByText('Not now')).toBeVisible()
    await expect(card.getByText('“Next week”')).toBeVisible()
    await expect(card.getByText('Granted')).toBeVisible()
    await expect(card.getByText('SGD 15.00')).toBeVisible()
    await expect(card.getByText('Waiting')).toBeVisible()
  })

  test('a missing GetMyRequests does not break the dashboard', async ({ page }) => {
    await as(page, CHILD)
    // GetMyRequests is left unmocked, so the mock answers it with a 500.
    await mockApi(page, child)
    await page.goto('/family')
    await expect(page.getByRole('heading', { name: 'Pay a merchant' })).toBeVisible()
    await expect(page.getByText('Your asks')).toHaveCount(0)
  })

  test('an ask that is approved straight away says so', async ({ page }) => {
    await as(page, CHILD)
    await mockApi(page, {
      ...child,
      ChildSpend: () => ({ Status: 'Declined', shortBy: 5 }),
      AskForMore: () => ({ requestId: 30, status: 'Approved' }),
    })
    await page.goto('/family')
    await field(page, 'Merchant account id').fill('0000006718')
    await field(page, 'Amount').fill('500')
    await page.getByRole('button', { name: 'Pay', exact: true }).click()
    await page.getByRole('button', { name: 'Ask for more' }).click()
    await expect(page.getByText('Approved straight away. You can pay again now.')).toBeVisible()
  })

  test('spending rules are saved as one set', async ({ page }) => {
    await as(page, PARENT)
    const calls = await mockApi(page, { SetSpendingRules: () => ({ status: 'Saved' }) })
    await page.goto('/family/child/3')
    await page.getByRole('tab', { name: 'Manage' }).click()
    await page.getByLabel('Freeze all spending').check()
    await page.getByRole('button', { name: 'Food', exact: true }).click()
    await page.getByRole('button', { name: 'Transport', exact: true }).click()
    await page.getByLabel(/Approve asks under/).fill('15')
    await page.getByRole('button', { name: 'Save rules' }).click()
    await expect
      .poll(() => last(calls, 'SetSpendingRules')?.body)
      .toEqual({
        familyLinkId: 3,
        isFrozen: true,
        allowedCategories: 'Food,Transport',
        autoApproveUnder: 15,
      })
    await expect(page.getByText('Saved. Spending is frozen.')).toBeVisible()
  })

  test('saving blank rules clears them', async ({ page }) => {
    await as(page, PARENT)
    const calls = await mockApi(page, { SetSpendingRules: () => ({ status: 'Saved' }) })
    await page.goto('/family/child/3')
    await page.getByRole('tab', { name: 'Manage' }).click()
    await page.getByRole('button', { name: 'Save rules' }).click()
    await expect
      .poll(() => last(calls, 'SetSpendingRules')?.body)
      .toEqual({ familyLinkId: 3, isFrozen: false, allowedCategories: '', autoApproveUnder: 0 })
  })
})

test.describe('budget alerts', () => {
  const jamie = (spent) => [{ ...CHILDREN[0], spent }, CHILDREN[1]]

  test('a parent hears nothing while spending is comfortably inside the budget', async ({
    page,
  }) => {
    await as(page, PARENT)
    await mockApi(page)
    await page.goto('/family')
    await expect(page.getByText('Second kid')).toBeVisible()
    await expect(page.locator('.banner.warn, .banner.error')).toHaveCount(0)
    await expect(page.getByText('80%+ used')).toHaveCount(0)
  })

  test('parent home warns at 80% and flags an over-budget child', async ({ page }) => {
    await as(page, PARENT)
    await mockApi(page, { GetChildren: () => jamie(170) })
    await page.goto('/family')
    await expect(
      page.getByText('Jamie has used 85% of their weekly budget (SGD 170.00 of SGD 200.00).'),
    ).toBeVisible()
    await expect(page.getByText('80%+ used')).toBeVisible()
  })

  test('parent home says how far over, and that approval is now needed', async ({ page }) => {
    await as(page, PARENT)
    await mockApi(page, { GetChildren: () => jamie(230) })
    await page.goto('/family')
    await expect(
      page.getByText(
        'Jamie is over their weekly budget by SGD 30.00. New payments will be declined unless you raise their limit.',
      ),
    ).toBeVisible()
    await expect(page.getByText('over budget', { exact: true })).toBeVisible()
  })

  test('the child sees how much is left, then that payments need approval', async ({ page }) => {
    await as(page, CHILD)
    let spent = 170
    await mockApi(page, {
      GetMyFamilyRole: () => ({ role: 'Child' }),
      GetChildDashboard: () => ({ ...DASH, Spent: spent, Remaining: Math.max(0, 200 - spent) }),
    })
    await page.goto('/family')
    await expect(
      page.getByText("You've used 85% of this week's budget. SGD 30.00 left."),
    ).toBeVisible()
    spent = 200
    await page.reload()
    await expect(
      page.getByText(
        "You've reached this week's budget. New payments will be declined unless your parent raises your limit.",
      ),
    ).toBeVisible()
  })
})

test.describe('SmartFX trips in the family screens', () => {
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
  }
  // Only Jamie (link 3) has a trip.
  const fx = (trip = TRIP) => ({
    GetTrips: (_b, q) => (q.familyLinkId === '3' ? [trip] : []),
    GetTrip: () => ({ Trip: trip, Locks: [], Spends: [{ Id: 1, TripId: 12, Amount: 20000 }] }),
  })
  // Family_Composite names the next trip itself (camelCase, read from SmartFX).
  const NEXT = {
    tripId: 12,
    destination: 'Kyoto',
    currency: 'JPY',
    tripStartDate: '2027-04-01',
    tripEndDate: '2027-04-14',
    status: 'PartiallyLocked',
    lockedSgd: 800,
    targetBudgetSgd: 800,
  }
  const withNext = (next = NEXT) => ({
    GetChildren: () => [{ ...CHILDREN[0], nextTrip: next }, CHILDREN[1]],
    GetChildDashboard: () => ({ ...DASH, nextTrip: next }),
  })
  const FIXED_NOW = new Date('2026-11-08T12:00:00')

  test('the child card names the next trip and how soon it is', async ({ page }) => {
    await as(page, PARENT)
    await page.clock.setFixedTime(FIXED_NOW)
    const calls = await mockApi(page, { ...fx(), ...withNext() })
    await page.goto('/family')
    const jamie = page.locator('.card', { hasText: 'Jamie' }).filter({ hasText: 'Manage' }).first()
    await expect(jamie).toContainText('Next trip: Kyoto')
    await expect(jamie).toContainText('in 144 days')
    await expect(page.getByText('Next trip:')).toHaveCount(1)
    // GetChildren carries it, so the cards make no SmartFX call per child.
    expect(calls.some((c) => c.name === 'GetTrips')).toBe(false)
  })

  test('child detail shows the trip, its funding, and locked rate against today', async ({
    page,
  }) => {
    await as(page, PARENT)
    await page.clock.setFixedTime(FIXED_NOW)
    const calls = await mockApi(page, fx())
    await page.goto('/family/child/3')
    const trip = page.locator('.card', { hasText: 'Kyoto' })
    await expect(trip).toContainText('2027-04-01 → 2027-04-14 · in 144 days')
    await expect(trip).toContainText('Partly locked')
    await expect(trip).not.toContainText('PartiallyLocked')
    await expect(trip).toContainText('SGD 800.00 locked')
    await expect(trip).toContainText('120.8236 JPY')
    await expect(trip).toContainText("Today's 6M forward")
    await expect(trip).toContainText('121.0494 JPY')
    await expect(trip).toContainText(
      "Locked JPY 96675.38 for SGD 800.00 (average rate 120.8442). At today's 6M forward of 121.0494 that would cost SGD 798.64, so locking early cost SGD 1.36 more.",
    )
    expect(last(calls, 'GetRate').query).toMatchObject({ currency: 'JPY', period: '6M' })
    await expect(trip.getByRole('link', { name: 'Open trip' })).toHaveAttribute('href', '/trips/12')
    await expect(trip.getByRole('link', { name: 'Manage FX & locks' })).toHaveAttribute(
      'href',
      '/fx/trips/12',
    )
  })

  test('a child with no trips is told where trips are planned', async ({ page }) => {
    await as(page, PARENT)
    await mockApi(page, fx())
    await page.goto('/family/child/4')
    await expect(page.getByText('No trips planned yet.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'SmartFX' }).last()).toHaveAttribute('href', '/fx')
  })

  test('a SmartFX outage leaves the parent home working', async ({ page }) => {
    await as(page, PARENT)
    // When SmartFX is down, GetChildren still answers, just without nextTrip.
    await mockApi(page, { GetTrips: () => ({ __status: 500, body: { Errors: ['boom'] } }) })
    await page.goto('/family')
    await expect(page.getByText('Second kid')).toBeVisible()
    await expect(page.getByText('Jamie').first()).toBeVisible()
    await expect(page.getByText('Next trip:')).toHaveCount(0)
    await expect(page.locator('.banner.error')).toHaveCount(0)
  })

  test('the child sees how much trip money is left', async ({ page }) => {
    await as(page, CHILD)
    await page.clock.setFixedTime(FIXED_NOW)
    const calls = await mockApi(page, {
      GetMyFamilyRole: () => ({ role: 'Child', FamilyLinkId: 3 }),
      ...fx(),
      ...withNext(),
    })
    await page.goto('/family')
    const card = page.locator('.card', { hasText: 'My trip to Kyoto' })
    await expect(card).toContainText('in 144 days')
    await expect(card).toContainText('JPY 76675.38')
    await expect(card).toContainText('left to spend')
    await expect(card).toContainText('JPY 20000.00 spent of JPY 96675.38')
    expect(last(calls, 'GetTrip').query).toMatchObject({ tripId: '12' })
  })

  test('if SmartFX cannot be reached, the child still sees what was set aside', async ({
    page,
  }) => {
    await as(page, CHILD)
    await mockApi(page, {
      GetMyFamilyRole: () => ({ role: 'Child', FamilyLinkId: 3 }),
      GetTrip: () => ({ __status: 500, body: { Errors: ['boom'] } }),
      ...withNext(),
    })
    await page.goto('/family')
    const card = page.locator('.card', { hasText: 'My trip to Kyoto' })
    await expect(card).toContainText('SGD 800.00 set aside for this trip.')
    await expect(page.locator('.banner.error')).toHaveCount(0)
  })

  test('a trip with nothing locked yet says the parent is still saving', async ({ page }) => {
    await as(page, CHILD)
    await mockApi(page, {
      GetMyFamilyRole: () => ({ role: 'Child', FamilyLinkId: 3 }),
      ...fx({ ...TRIP, LockedSgd: 0, LockedForeign: 0 }),
      ...withNext({ ...NEXT, lockedSgd: 0 }),
    })
    await page.goto('/family')
    await expect(
      page.getByText('Your parent is still setting aside money for this trip.'),
    ).toBeVisible()
  })

  test('a child with no trip sees no trip card', async ({ page }) => {
    await as(page, CHILD)
    await mockApi(page, { GetMyFamilyRole: () => ({ role: 'Child', FamilyLinkId: 3 }) })
    await page.goto('/family')
    await expect(page.locator('.hero-amount')).toContainText('SGD 250.50')
    await expect(page.getByText('My trip to')).toHaveCount(0)
  })
})

test.describe('child detail (parent)', () => {
  test.beforeEach(({ page }) => as(page, PARENT))

  test('spending insights: pace forecast, top categories, change on last week', async ({
    page,
  }) => {
    // Wednesday: three days into the week, so 150 spent projects to 350.
    await page.clock.setFixedTime(new Date('2026-11-04T12:00:00'))
    await mockApi(page, {
      GetChildExpenses: (_b, q) =>
        q.startDate === '2026-11-02'
          ? {
              Expenses: [
                { TransactionId: 'A', Date: '2026-11-02', Amount: 100, Category: 'Food' },
                { TransactionId: 'B', Date: '2026-11-03', Amount: 50, Category: 'Study' },
              ],
              Total: 150,
            }
          : q.startDate === '2026-10-26'
            ? { Expenses: [], Total: 300 }
            : { Expenses: [], Total: 0 },
    })
    await page.goto('/family/child/3')
    const insights = page.locator('.card', { hasText: 'Spent this week so far' })
    await expect(insights).toContainText('SGD 150.00')
    await expect(insights).toContainText(
      'At this pace: about SGD 350.00 this week, SGD 150.00 over budget.',
    )
    await expect(insights.locator('.insight-cat').first()).toContainText('Food')
    await expect(insights.locator('.insight-cat').first()).toContainText('67%')
    await expect(insights).toContainText('50% less than last week (SGD 300.00).')
  })

  test('spending insights: no budget means no forecast', async ({ page }) => {
    await mockApi(page)
    await page.goto('/family/child/4')
    await expect(page.getByText('Set a budget to see a spending forecast.')).toBeVisible()
  })

  test('budget form is pre-filled and saves the right payload', async ({ page }) => {
    const calls = await mockApi(page)
    await page.goto('/family/child/3')
    await openTab(page, 'Manage')
    const c = card(page, 'Save budget')
    await expect(field(c, 'Amount (SGD)')).toHaveValue('200')
    await expect(field(c, 'Period')).toHaveValue('Weekly')
    await c.getByRole('button', { name: 'Save budget' }).click()
    await expect(page.getByText('Budget saved.')).toBeVisible()
    expect(last(calls, 'SetBudget').body).toEqual({
      familyLinkId: 3,
      period: 'Weekly',
      amount: 200,
    })
  })

  test('top-up message names whose balance it is', async ({ page }) => {
    const calls = await mockApi(page)
    await page.goto('/family/child/3')
    await openTab(page, 'Manage')
    const c = card(page, 'Top up')
    await field(c, 'Amount (SGD)').fill('25')
    await c.getByRole('button', { name: 'Top up' }).click()
    await expect(page.getByText('Your balance is now SGD 975.00.')).toBeVisible()
    expect(last(calls, 'TopUp').body).toMatchObject({ familyLinkId: 3, amount: 25 })
  })

  test('allowance: set up, and stop asks for confirmation', async ({ page }) => {
    const calls = await mockApi(page)
    await page.goto('/family/child/3')
    await openTab(page, 'Manage')
    await expect(page.getByText('Postman')).toHaveCount(0)
    const c = card(page, 'Set up allowance')
    await field(c, 'Amount (SGD)').fill('100')
    await c.getByRole('button', { name: 'Set up allowance' }).click()
    await expect(page.getByText('Allowance set up.')).toBeVisible()
    expect(last(calls, 'SetupAllowance').body).toMatchObject({
      familyLinkId: 3,
      amount: 100,
      weeklyMonthly: 'Monthly',
    })

    await c.getByRole('button', { name: 'Stop allowance' }).click()
    await expect(c.getByRole('button', { name: 'Confirm stop' })).toBeVisible()
    await c.getByRole('button', { name: 'Keep allowance' }).click()
    await expect(c.getByRole('button', { name: 'Stop allowance' })).toBeVisible()
    expect(calls.filter((x) => x.name === 'StopAllowance')).toHaveLength(0)
    await c.getByRole('button', { name: 'Stop allowance' }).click()
    await c.getByRole('button', { name: 'Confirm stop' }).click()
    await expect(page.getByText('Allowance stopped.')).toBeVisible()
    expect(last(calls, 'StopAllowance').body).toEqual({ familyLinkId: 3 })
  })

  test('stop allowance is disabled when the child has none', async ({ page }) => {
    await mockApi(page, { GetChildren: () => [{ ...CHILDREN[0], hasAllowance: false }] })
    await page.goto('/family/child/3')
    await openTab(page, 'Manage')
    await expect(page.getByRole('button', { name: 'Stop allowance' })).toBeDisabled()
  })

  test('default expense range uses local dates (Singapore, 00:30 on 7 Nov)', async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ timezoneId: 'Asia/Singapore', baseURL })
    const page = await ctx.newPage()
    await as(page, PARENT)
    await page.clock.setFixedTime(new Date('2026-11-07T00:30:00+08:00'))
    const calls = await mockApi(page)
    await page.goto('/family/child/3')
    await openTab(page, 'Activity')
    await expect(
      page.getByText('No outgoing payments').or(page.getByText('0000006718')),
    ).toBeVisible()
    // The expenses card asks for the month so far; the insights card sends its
    // own (weekly) windows alongside it.
    expect(calls.filter((c) => c.name === 'GetChildExpenses').map((c) => c.query)).toContainEqual({
      familyLinkId: '3',
      startDate: '2026-11-01',
      endDate: '2026-11-07',
    })
    await ctx.close()
  })

  test('activity lists the expenses and draws the balance trend', async ({ page }) => {
    await mockApi(page)
    await page.goto('/family/child/3')
    await openTab(page, 'Activity')
    await expect(page.getByText('0000006718')).toBeVisible()
    const chart = page.getByRole('img', { name: 'Balance by month' })
    await expect(chart).toBeVisible()
    // Every month is labelled, including September, which has no balance yet.
    await expect(chart.locator('.chart-label')).toHaveText(['Sep', 'Oct', 'Nov'])
    await expect(chart.locator('.trend-dot')).toHaveCount(2)
    await expect(page.getByText(/Balance is up SGD 150\.50/)).toBeVisible()
    await expect(page.getByText(/since Oct\./)).toBeVisible()
  })

  test('the trend window switches between 3, 6 and 12 months', async ({ page }) => {
    const calls = await mockApi(page)
    await page.goto('/family/child/3')
    await openTab(page, 'Activity')
    await expect(page.getByRole('img', { name: 'Balance by month' })).toBeVisible()
    expect(last(calls, 'GetBalanceTrend').query.months).toBe('6')
    await expect(page.getByRole('button', { name: '6 months' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('button', { name: '12 months' }).click()
    await expect.poll(() => last(calls, 'GetBalanceTrend').query.months).toBe('12')
    await page.getByRole('button', { name: '3 months' }).click()
    await expect.poll(() => last(calls, 'GetBalanceTrend').query.months).toBe('3')
  })
})

// ---------------------------------------------------------------------------
// Flow and insights: the overview header, tabs, charts, and the pre-flight
// checks on top-up, budget, approvals and payments.
// ---------------------------------------------------------------------------

// A Wednesday, three days into the week of Monday 2 Nov, so Jamie's weekly
// budget (200, 50 spent) has five days left including today.
const WEDNESDAY = new Date('2026-11-04T12:00:00')
const weekExpenses = (_b, q) =>
  q.startDate === '2026-11-02'
    ? {
        Expenses: [
          { TransactionId: 'A', Date: '2026-11-02', Amount: 100, Category: 'Food' },
          { TransactionId: 'B', Date: '2026-11-03', Amount: 50, Category: 'Study' },
        ],
        Total: 150,
      }
    : q.startDate === '2026-10-26'
      ? { Expenses: [], Total: 300 }
      : { Expenses: [], Total: 0 }
const withSpent = (spent) => ({ GetChildren: () => [{ ...CHILDREN[0], spent }, CHILDREN[1]] })

test.describe('child overview', () => {
  test.beforeEach(async ({ page }) => {
    await as(page, PARENT)
    await page.clock.setFixedTime(WEDNESDAY)
  })

  test('summarises balance, pace, time left and the safe daily amount', async ({ page }) => {
    await mockApi(page, { GetChildExpenses: weekExpenses })
    await page.goto('/family/child/3')
    const overview = page.locator('.overview')
    await expect(overview).toContainText('Jamie')
    await expect(overview).toContainText('SGD 250.50')
    await expect(overview).toContainText('On track')
    await expect(overview).toContainText('5 days left this week')
    await expect(overview).toContainText('SGD 50.00 of SGD 200.00')
    const tile = (label) => overview.locator('.tile', { hasText: label })
    await expect(tile('Left to spend')).toContainText('SGD 150.00')
    await expect(tile('Safe per day')).toContainText('SGD 30.00')
    await expect(tile('vs last week')).toContainText('-50%')
    await expect(overview.locator('.pace-tick')).toHaveCount(1)
  })

  test('says "Spending fast" when spending is ahead of the calendar', async ({ page }) => {
    await mockApi(page, withSpent(120))
    await page.goto('/family/child/3')
    await expect(page.locator('.overview')).toContainText('Spending fast')
  })

  test('says "Over budget" with no safe daily amount once the budget is used', async ({ page }) => {
    await mockApi(page, withSpent(230))
    await page.goto('/family/child/3')
    const overview = page.locator('.overview')
    await expect(overview).toContainText('Over budget')
    await expect(overview.locator('.tile', { hasText: 'Safe per day' })).toContainText('—')
    await expect(overview.locator('.pace-tick')).toHaveCount(0)
  })

  test('with no budget it offers to set one instead of showing an empty pace', async ({ page }) => {
    await mockApi(page)
    await page.goto('/family/child/4')
    await expect(page.getByText('No budget set yet, so there is no pace to show.')).toBeVisible()
    await page.getByRole('button', { name: 'Set a budget' }).click()
    await expect(page.getByRole('tab', { name: 'Manage' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('button', { name: 'Save budget' })).toBeVisible()
  })
})

test.describe('child tabs', () => {
  test('Overview is the default; Manage and Activity hold the forms and the history', async ({
    page,
  }) => {
    await as(page, PARENT)
    await mockApi(page)
    await page.goto('/family/child/3')
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByText('Spending insights')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save budget' })).toHaveCount(0)
    await expect(page.getByText('Balance trend')).toHaveCount(0)

    await openTab(page, 'Manage')
    await expect(page.getByRole('button', { name: 'Save budget' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Set up allowance' })).toBeVisible()
    await expect(page.getByText('Spending insights')).toHaveCount(0)

    await openTab(page, 'Activity')
    await expect(page.getByText('Balance trend')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save budget' })).toHaveCount(0)
  })
})

test.describe('spending chart', () => {
  test('draws a bar per day and marks days above the safe daily amount', async ({ page }) => {
    await as(page, PARENT)
    await page.clock.setFixedTime(WEDNESDAY)
    await mockApi(page, { GetChildExpenses: weekExpenses })
    await page.goto('/family/child/3')
    const chart = page.getByRole('img', { name: 'Spending per day this period' })
    await expect(chart.locator('.bar')).toHaveCount(3) // Mon, Tue, Wed
    // Safe amount is SGD 30 a day: Monday (100) and Tuesday (50) are above it.
    await expect(chart.locator('.bar-over')).toHaveCount(2)
    await expect(chart.locator('.chart-limit')).toHaveCount(1)
    await expect(
      page.getByText('Dashed line: SGD 30.00 a day keeps the budget on track.'),
    ).toBeVisible()
  })

  test('no spending, no chart', async ({ page }) => {
    await as(page, PARENT)
    await mockApi(page, { GetChildExpenses: () => ({ Expenses: [], Total: 0 }) })
    await page.goto('/family/child/3')
    await expect(page.getByText('Spent this week so far')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Spending per day this period' })).toHaveCount(0)
  })
})

test.describe('manage: budget and top-up checks', () => {
  test.beforeEach(({ page }) => as(page, PARENT))

  test('the budget form offers last period’s spending as a starting point', async ({ page }) => {
    await page.clock.setFixedTime(WEDNESDAY)
    const calls = await mockApi(page, { GetChildExpenses: weekExpenses })
    await page.goto('/family/child/3')
    await openTab(page, 'Manage')
    const c = card(page, 'Save budget')
    const suggestion = c.getByRole('button', { name: "Use last week's spending (SGD 300.00)" })
    await expect(suggestion).toBeVisible()
    await suggestion.click()
    await expect(field(c, 'Amount (SGD)')).toHaveValue('300.00')
    await expect(suggestion).toHaveCount(0)
    await c.getByRole('button', { name: 'Save budget' }).click()
    await expect.poll(() => last(calls, 'SetBudget')?.body?.amount).toBe(300)
  })

  test('no suggestion when there was no spending last period', async ({ page }) => {
    await mockApi(page, { GetChildExpenses: () => ({ Expenses: [], Total: 0 }) })
    await page.goto('/family/child/3')
    await openTab(page, 'Manage')
    await expect(page.getByRole('button', { name: /Use last/ })).toHaveCount(0)
  })

  test('quick amounts fill the field and a preview shows both balances afterwards', async ({
    page,
  }) => {
    const calls = await mockApi(page)
    await page.goto('/family/child/3')
    await openTab(page, 'Manage')
    const c = card(page, 'Top up')
    await expect(c.locator('.preview')).toHaveCount(0)
    await c.getByRole('button', { name: '50', exact: true }).click()
    await expect(field(c, 'Amount (SGD)')).toHaveValue('50')
    await expect(c.locator('.preview')).toContainText('SGD 1000.00 → SGD 950.00')
    await expect(c.locator('.preview')).toContainText("Jamie's balance")
    await expect(c.locator('.preview')).toContainText('SGD 250.50 → SGD 300.50')
    await c.getByRole('button', { name: 'Top up', exact: true }).click()
    await expect(page.getByText('Your balance is now SGD 975.00.')).toBeVisible()
    expect(last(calls, 'TopUp').body).toMatchObject({ familyLinkId: 3, amount: 50 })
  })

  test('sending more than you have is blocked before it reaches the bank', async ({ page }) => {
    const calls = await mockApi(page)
    await page.goto('/family/child/3')
    await openTab(page, 'Manage')
    const c = card(page, 'Top up')
    await field(c, 'Amount (SGD)').fill('5000')
    await expect(page.getByText('You only have SGD 1000.00 to send.')).toBeVisible()
    await expect(c.getByRole('button', { name: 'Top up', exact: true })).toBeDisabled()
    expect(calls.filter((x) => x.name === 'TopUp')).toHaveLength(0)
    await field(c, 'Amount (SGD)').fill('1000')
    await expect(c.getByRole('button', { name: 'Top up', exact: true })).toBeEnabled()
  })
})

test.describe('parent home flow', () => {
  test.beforeEach(({ page }) => as(page, PARENT))

  const REQUEST = (id, amount) => ({
    RequestId: id,
    FamilyLinkId: 3,
    Nickname: 'Jamie',
    MerchantAccountId: '0000006718',
    Amount: amount,
    Category: 'Food',
  })

  test('approvals are totalled, and a request bigger than the balance is flagged', async ({
    page,
  }) => {
    await mockApi(page, { GetPendingRequests: () => [REQUEST(11, 40), REQUEST(12, 9999)] })
    await page.goto('/family')
    await expect(page.getByText('SGD 10039.00 waiting across 2 requests')).toBeVisible()
    // Said once for the child, then a small badge on the row that does not fit.
    await expect(
      page.getByText(
        'Jamie has SGD 250.50, so 1 request above that will not go through until you top them up.',
      ),
    ).toBeVisible()
    await expect(page.getByText('Over balance')).toHaveCount(1)
    await expect(
      page.locator('.request', { hasText: 'SGD 9999.00' }).getByText('Over balance'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(2)
  })

  test('several requests over the balance still produce one warning', async ({ page }) => {
    await mockApi(page, {
      GetPendingRequests: () => [REQUEST(11, 300), REQUEST(12, 400), REQUEST(13, 9999)],
    })
    await page.goto('/family')
    await expect(page.getByText(/so 3 requests above that will not go through/)).toHaveCount(1)
    await expect(page.getByText('Over balance')).toHaveCount(3)
  })

  test('a single affordable request has no warning', async ({ page }) => {
    await mockApi(page)
    await page.goto('/family')
    await expect(page.getByText('SGD 40.00 waiting across 1 request')).toBeVisible()
    await expect(page.getByText('Over balance')).toHaveCount(0)
    await expect(page.locator('.banner.warn')).toHaveCount(0)
  })

  test('the link-a-child form stays out of the way until asked for', async ({ page }) => {
    await mockApi(page)
    await page.goto('/family')
    await expect(page.getByText('Second kid')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Find' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Add a child' }).click()
    await expect(page.getByRole('button', { name: 'Find' })).toBeVisible()
  })

  test('with no children the link form is shown straight away', async ({ page }) => {
    await mockApi(page, { GetChildren: () => [], GetPendingRequests: () => [] })
    await page.goto('/family')
    await expect(page.getByRole('button', { name: 'Find' })).toBeVisible()
  })

  test('each child card says how many days are left in the budget period', async ({ page }) => {
    await page.clock.setFixedTime(WEDNESDAY)
    await mockApi(page)
    await page.goto('/family')
    const jamie = page.locator('.card', { hasText: 'Jamie' }).filter({ hasText: 'Manage' }).first()
    await expect(jamie).toContainText('SGD 50.00 of SGD 200.00 · 5 days left')
    await expect(jamie.locator('.pace-tick')).toHaveCount(1)
  })
})

test.describe('child pay flow', () => {
  test.beforeEach(async ({ page }) => {
    await as(page, CHILD)
    await page.clock.setFixedTime(WEDNESDAY)
  })
  const child = { GetMyFamilyRole: () => ({ role: 'Child' }) }

  test('the budget card shows a daily amount to stay on track', async ({ page }) => {
    await mockApi(page, child)
    await page.goto('/family')
    const budget = page.locator('.card', { hasText: 'Budget this week' })
    await expect(budget).toContainText('SGD 150.00 remaining')
    await expect(budget).toContainText('about SGD 30.00 a day for 5 days')
    await expect(budget.locator('.pace-tick')).toHaveCount(1)
  })

  test("category is picked from Budget's six chips, Others by default", async ({ page }) => {
    const calls = await mockApi(page, child)
    await page.goto('/family')
    await expect(page.locator('.chips .chip')).toHaveText([
      'Food',
      'Transport',
      'Shopping',
      'Accommodation',
      'Activities',
      'Others',
    ])
    await expect(page.getByRole('button', { name: 'Others' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await field(page, 'Merchant account id').fill('0000006718')
    await field(page, 'Amount').fill('10')
    await page.getByRole('button', { name: 'Food', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Food', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('button', { name: 'Pay', exact: true }).click()
    await expect.poll(() => last(calls, 'ChildSpend')?.body?.category).toBe('Food')
  })

  test('a payment over the budget is flagged before paying', async ({ page }) => {
    await mockApi(page, child)
    await page.goto('/family')
    await field(page, 'Amount').fill('10')
    await expect(page.locator('.banner.warn, .banner.error')).toHaveCount(0)
    await field(page, 'Amount').fill('200')
    await expect(
      page.getByText(
        'That is SGD 50.00 over what is left in your budget, so it will be declined unless your parent raises your limit.',
      ),
    ).toBeVisible()
  })

  test('a payment over the balance is flagged as an error', async ({ page }) => {
    await mockApi(page, child)
    await page.goto('/family')
    await field(page, 'Amount').fill('300')
    await expect(page.getByText('That is more than your balance (SGD 250.50).')).toBeVisible()
  })
})

test.describe('a parent with no children yet', () => {
  test.beforeEach(({ page }) => as(page, PARENT))
  const nobody = {
    GetMyFamilyRole: () => ({ role: 'None' }),
    GetMyLinkInvite: () => ({ Errors: ['No family link for this customer'] }),
  }

  test('can still link a first child from the not-linked screen', async ({ page }) => {
    const calls = await mockApi(page, nobody)
    await page.goto('/family')
    await expect(page.getByText("You're not linked to a family yet.")).toBeVisible()
    await expect(page.getByText('Are you a parent?')).toBeVisible()

    const form = page.locator('.card', { has: page.getByRole('button', { name: 'Find' }) })
    await field(form, 'Phone number').fill('91234567')
    await form.getByRole('button', { name: 'Find' }).click()
    await expect(page.getByText('New Kid')).toBeVisible()
    await field(page, 'Nickname').fill('Kiddo')
    await page.getByRole('button', { name: 'Send invite' }).click()
    await expect(page.getByText('Invite sent')).toBeVisible()
    expect(last(calls, 'LinkChild').body).toEqual({
      childCustomerId: '0000009999',
      nickname: 'Kiddo',
      hostCurrency: 'SGD',
    })
  })

  test('sending the first invite refreshes the role, so the parent screen can take over', async ({
    page,
  }) => {
    let linked = false
    const calls = await mockApi(page, {
      GetMyFamilyRole: () => (linked ? { role: 'Parent', FamilyLinkId: 9 } : { role: 'None' }),
      GetMyLinkInvite: () => ({ Errors: ['No family link for this customer'] }),
      GetChildren: () =>
        linked
          ? [
              {
                familyLinkId: 9,
                nickname: 'Kiddo',
                childCustomerId: '0000009999',
                status: 'Pending',
              },
            ]
          : [],
      LinkChild: () => {
        linked = true
        return { id: 9 }
      },
    })
    await page.goto('/family')
    const form = page.locator('.card', { has: page.getByRole('button', { name: 'Find' }) })
    await field(form, 'Phone number').fill('91234567')
    await form.getByRole('button', { name: 'Find' }).click()
    await expect(page.getByText('New Kid')).toBeVisible()
    await field(page, 'Nickname').fill('Kiddo')
    await page.getByRole('button', { name: 'Send invite' }).click()
    // The role is asked for again, and the parent's own screen now shows the child.
    await expect(page.getByText('Kiddo', { exact: true })).toBeVisible()
    await expect(page.getByText('Pending', { exact: true })).toBeVisible()
    expect(calls.filter((c) => c.name === 'GetMyFamilyRole').length).toBeGreaterThan(1)
  })

  test('a child with a real invite does not see the parent form', async ({ page }) => {
    await as(page, CHILD)
    await mockApi(page, {
      GetMyFamilyRole: () => ({ role: 'Pending' }),
      GetMyLinkInvite: () => ({
        FamilyLinkId: 3,
        ParentCustomerId: '0000002169',
        Nickname: 'Mum',
        HasInvite: true,
      }),
    })
    await page.goto('/family')
    await expect(page.getByText('Family invite')).toBeVisible()
    await expect(page.getByText('Are you a parent?')).toHaveCount(0)
  })
})

test.describe('the SmartFX page with nothing linked', () => {
  test('a customer with no children is told why there are no trips', async ({ page }) => {
    await as(page, PARENT)
    await mockApi(page, { GetMyFamilyRole: () => ({ role: 'None' }), GetChildren: () => [] })
    await page.goto('/fx')
    await expect(page.getByText('no child is linked to your account yet')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Link a child in Family' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Start a trip' })).toHaveCount(0)
  })

  test('a parent whose children are all pending sees the same explanation', async ({ page }) => {
    await as(page, PARENT)
    await mockApi(page, { GetChildren: () => [{ ...CHILDREN[0], status: 'Pending' }] })
    await page.goto('/fx')
    await expect(page.getByText('no child is linked to your account yet')).toBeVisible()
  })

  test('a child sees their own trips', async ({ page }) => {
    await as(page, CHILD)
    const calls = await mockApi(page, {
      GetMyFamilyRole: () => ({ role: 'Child', FamilyLinkId: 3 }),
      GetTrips: (_b, q) =>
        q.familyLinkId === '3'
          ? [
              {
                Id: 12,
                FamilyLinkId: 3,
                Destination: 'Kyoto',
                Currency: 'JPY',
                TripStartDate: '2027-04-01',
                TripEndDate: '2027-04-14',
                TargetBudgetSgd: 800,
                Status: 'Watching',
              },
            ]
          : [],
    })
    await page.goto('/fx')
    await expect(page.getByRole('heading', { name: 'Your trips' })).toBeVisible()
    await expect(page.getByText('Kyoto')).toBeVisible()
    expect(calls.some((c) => c.name === 'GetTrips' && c.query.familyLinkId === '3')).toBe(true)
  })
})
