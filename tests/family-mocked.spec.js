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
    ...over,
  }
  await page.route('**/api/family/**', (route) => {
    const url = new URL(route.request().url())
    const name = url.pathname.split('/').pop()
    const raw = route.request().postData()
    const body = raw ? JSON.parse(raw) : undefined
    calls.push({ name, body, query: Object.fromEntries(url.searchParams) })
    const h = handlers[name]
    if (!h) return route.fulfill(reply({ Errors: [`unmocked ${name}`] }, 500))
    const out = h(body)
    return out && out.__status
      ? route.fulfill(reply(out.body, out.__status))
      : route.fulfill(reply(out))
  })
  return calls
}
const last = (calls, name) => calls.filter((c) => c.name === name).at(-1)
const field = (scope, label) =>
  scope.locator('.field', { hasText: label }).locator('input,select').first()
const card = (page, btn) =>
  page.locator('.card', { has: page.getByRole('button', { name: btn, exact: true }) })

test.describe('signed out / login', () => {
  test('signed-out visitor sees the sign-in card', async ({ page }) => {
    await page.goto('/family')
    await expect(page.getByText("You're not signed in yet.")).toBeVisible()
  })
  test('dev login stores the session token', async ({ page }) => {
    await mockApi(page)
    await page.goto('/family/dev-login')
    await page.getByPlaceholder('SMU_TUSER2').fill('0000002169')
    await page.getByPlaceholder('0000006385').fill('0000004554')
    await page.getByPlaceholder('timothy.loo').fill('Parent Demo')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/family$/)
    expect(await page.evaluate(() => sessionStorage.getItem('wetrip_session'))).toBe(PARENT)
    await expect(page.getByText('Your WeTrip balance')).toBeVisible()
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
    await expect(page.getByRole('button', { name: 'Reject' })).toBeEnabled()
    await page.getByRole('button', { name: 'Reject' }).click()
    await expect
      .poll(() => last(calls, 'DecideRequest')?.body, { timeout: 10_000 })
      .toEqual({ requestId: 11, approve: false })
  })

  test('link a child: find by phone, then send the invite', async ({ page }) => {
    const calls = await mockApi(page)
    await page.goto('/family')
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
    const calls = await mockApi(page, { GetMyFamilyRole: () => ({ role: 'Pending' }) })
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

  test('paying within budget confirms; over budget says it needs approval', async ({ page }) => {
    let status = 'Completed'
    const calls = await mockApi(page, {
      ...child,
      ChildSpend: () => ({ Status: status, Remaining: 140 }),
    })
    await page.goto('/family')
    await field(page, 'Merchant account id').fill('0000006718')
    await field(page, 'Amount').fill('10')
    await page.getByRole('button', { name: 'Pay', exact: true }).click()
    await expect(page.getByText('Paid! Remaining this period: 140')).toBeVisible()
    expect(last(calls, 'ChildSpend').body).toMatchObject({
      merchantAccountId: '0000006718',
      amount: 10,
      category: 'General',
    })
    status = 'PendingApproval'
    await field(page, 'Merchant account id').fill('0000006718')
    await field(page, 'Amount').fill('500')
    await page.getByRole('button', { name: 'Pay', exact: true }).click()
    await expect(page.getByText('Over budget — sent to your parent for approval.')).toBeVisible()
  })
})

test.describe('child detail (parent)', () => {
  test.beforeEach(({ page }) => as(page, PARENT))

  test('budget form is pre-filled and saves the right payload', async ({ page }) => {
    const calls = await mockApi(page)
    await page.goto('/family/child/3')
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
    const c = card(page, 'Top up')
    await field(c, 'Amount (SGD)').fill('25')
    await c.getByRole('button', { name: 'Top up' }).click()
    await expect(page.getByText('Your balance is now SGD 975.00.')).toBeVisible()
    expect(last(calls, 'TopUp').body).toMatchObject({ familyLinkId: 3, amount: 25 })
  })

  test('allowance: set up, and stop asks for confirmation', async ({ page }) => {
    const calls = await mockApi(page)
    await page.goto('/family/child/3')
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
    await expect(
      page.getByText('No outgoing payments').or(page.getByText('0000006718')),
    ).toBeVisible()
    expect(calls.find((c) => c.name === 'GetChildExpenses').query).toMatchObject({
      startDate: '2026-11-01',
      endDate: '2026-11-07',
    })
    await ctx.close()
  })

  test('expenses render; trend shows a dash for empty months and trims month labels', async ({
    page,
  }) => {
    await mockApi(page)
    await page.goto('/family/child/3')
    await expect(page.getByText('0000006718')).toBeVisible()
    const trend = page.locator('table').last()
    await expect(trend).toContainText('2026-11')
    await expect(trend).not.toContainText('2026-11-07')
    await expect(trend).toContainText('—')
  })

  test('typing in the months box sends one request after a pause and can be cleared', async ({
    page,
  }) => {
    const calls = await mockApi(page)
    await page.goto('/family/child/3')
    await expect(page.locator('table').last()).toBeVisible()
    await page.waitForTimeout(600)
    const before = calls.filter((c) => c.name === 'GetBalanceTrend').length
    const months = page.locator('input[min="1"][max="24"]')
    await months.fill('')
    await months.pressSequentially('12', { delay: 60 })
    await page.waitForTimeout(900)
    expect(calls.filter((c) => c.name === 'GetBalanceTrend').length - before).toBe(1)
    expect(last(calls, 'GetBalanceTrend').query.months).toBe('12')
    await months.fill('')
    await expect(months).toHaveValue('')
  })
})
