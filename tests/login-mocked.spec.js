import { test, expect } from '@playwright/test'

// The dev sign-in asks for a customer id only and looks the account up. The
// API is faked, so these run without the sandbox.
const reply = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

const CASA = (AccountId, Balance) => ({ AccountId, ProductName: 'CASA', Currency: 'SGD', Balance })
const ACCOUNTS = {
  // One deposit account (plus a loan, which is never the one).
  '0000003018': [
    CASA('0000006385', 4943.8),
    { AccountId: '0000006402', ProductName: 'Home Loan', Currency: 'SGD', Balance: 500000 },
  ],
  // Several deposit accounts, a term deposit and a yen wallet among them.
  '0000002169': [
    CASA('0000004554', 8207.23),
    { AccountId: '0000004847', ProductName: 'TD 5 Year', Currency: 'SGD', Balance: 20000 },
    { AccountId: '0000006703', Currency: 'JPY' },
    CASA('0000004848', 4699.02),
  ],
  // One deposit account, and GetMe knows the customer's name.
  '0000004444': [CASA('0000005555', 100)],
  // Only a loan: nothing to sign in with.
  '0000007777': [
    { AccountId: '0000007778', ProductName: 'Home Loan', Currency: 'SGD', Balance: 1000 },
  ],
}

async function mockApi(page, { delay = 0 } = {}) {
  const lookups = []
  await page.route('**/api/family/**', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()
    const token = route.request().headers()['x-session-token'] ?? ''
    if (name === 'GetMyAccounts') {
      const id = token.split(':')[0]
      lookups.push({ token, id })
      if (delay) await new Promise((r) => setTimeout(r, delay))
      return ACCOUNTS[id]
        ? route.fulfill(reply(ACCOUNTS[id]))
        : route.fulfill(
            reply(
              {
                Errors: [
                  'SMUtBank error 400: {"Errors":["Customer record not found"],"StatusCode":400}',
                ],
              },
              500,
            ),
          )
    }
    const [customerId, accountId] = token.split(':')
    const body =
      name === 'GetMyFamilyRole'
        ? { role: 'Parent' }
        : name === 'GetMe'
          ? {
              customerId,
              accountId,
              displayName: customerId === '0000004444' ? 'Sam Lee' : '',
              balance: 1000,
            }
          : name === 'GetChildren' || name === 'GetPendingRequests'
            ? []
            : {}
    return route.fulfill(reply(body))
  })
  await page.route('**/api/fx/**', (route) => route.fulfill(reply([])))
  await page.route(
    (url) => url.pathname.startsWith('/scantopay/'),
    (route) => route.fulfill(reply({ Payments: [], BnplPlans: [] })),
  )
  return lookups
}

const session = (page) => page.evaluate(() => sessionStorage.getItem('wetrip_session'))
const customerField = (page) => page.getByLabel('CustomerId (the number, not the username)')

test.describe('one field', () => {
  test('the form asks for the customer id and nothing else', async ({ page }) => {
    await mockApi(page)
    await page.goto('/login')
    await expect(page.locator('form input')).toHaveCount(1)
    await expect(customerField(page)).toBeVisible()
    await expect(page.getByText('Deposit AccountId')).toHaveCount(0)
    await expect(page.getByText('Display name')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
  })

  test('a customer with one deposit account goes straight in', async ({ page }) => {
    const lookups = await mockApi(page)
    await page.goto('/login')
    await customerField(page).fill('0000003018')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('Available balance')).toBeVisible()
    // The account came from the lookup (the loan was ignored), and no name is stored.
    expect(await session(page)).toBe('0000003018:0000006385:')
    // The lookup asked with the customer id only.
    expect(lookups).toEqual([{ token: '0000003018::', id: '0000003018' }])
  })

  test('a name GetMe knows is kept in the session and greets on the home page', async ({
    page,
  }) => {
    await mockApi(page)
    await page.goto('/login')
    await customerField(page).fill('0000004444')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Hi, Sam!')).toBeVisible()
    expect(await session(page)).toBe('0000004444:0000005555:Sam Lee')
  })

  test('the sign-in page no longer carries developer copy', async ({ page }) => {
    await mockApi(page)
    await page.goto('/login')
    await expect(page.getByText('Sign in with your WeTrip customer ID.')).toBeVisible()
    await expect(page.getByText(/Dev stub|ValidateSessionStub|SMU_TUSER2/)).toHaveCount(0)
  })

  test('the button shows the lookup is in progress and cannot be pressed twice', async ({
    page,
  }) => {
    const lookups = await mockApi(page, { delay: 500 })
    await page.goto('/login')
    await customerField(page).fill('0000003018')
    const button = page.getByRole('button', { name: /Continue|Looking up/ })
    await button.click()
    await expect(page.getByRole('button', { name: 'Looking up…' })).toBeDisabled()
    await expect(page).toHaveURL(/\/$/)
    expect(lookups).toHaveLength(1)
  })
})

test.describe('more than one deposit account', () => {
  test('asks which one, with the first preselected and only deposit accounts listed', async ({
    page,
  }) => {
    await mockApi(page)
    await page.goto('/login')
    await customerField(page).fill('0000002169')
    await page.getByRole('button', { name: 'Continue' }).click()

    const select = page.getByLabel('Which account should WeTrip use?')
    await expect(select).toHaveValue('0000004554')
    await expect(select.locator('option')).toHaveText([
      '0000004554 · SGD 8207.23',
      '0000004848 · SGD 4699.02',
    ])
    // Nothing is stored until a choice is confirmed.
    expect(await session(page)).toBeNull()

    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/$/)
    expect(await session(page)).toBe('0000002169:0000004554:')
  })

  test('the other account can be chosen', async ({ page }) => {
    await mockApi(page)
    await page.goto('/login')
    await customerField(page).fill('0000002169')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByLabel('Which account should WeTrip use?').selectOption('0000004848')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/$/)
    expect(await session(page)).toBe('0000002169:0000004848:')
  })

  test('Back returns to the customer id, which is still filled in', async ({ page }) => {
    await mockApi(page)
    await page.goto('/login')
    await customerField(page).fill('0000002169')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(customerField(page)).toHaveValue('0000002169')
    expect(await session(page)).toBeNull()
  })
})

test.describe('when it cannot sign in', () => {
  test('an unknown customer id gets a plain message and no session', async ({ page }) => {
    await mockApi(page)
    await page.goto('/login')
    await customerField(page).fill('0000009999')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText("We couldn't find a customer with that id.")).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    expect(await session(page)).toBeNull()
    // And it can be corrected and tried again.
    await customerField(page).fill('0000003018')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('a customer with no deposit account is told so, with no session', async ({ page }) => {
    await mockApi(page)
    await page.goto('/login')
    await customerField(page).fill('0000007777')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(
      page.getByText('That customer has no SGD deposit account to sign in with.'),
    ).toBeVisible()
    expect(await session(page)).toBeNull()
  })

  test('a failed lookup leaves an existing session alone', async ({ page }) => {
    await mockApi(page)
    // Seed once, so the page's own reloads do not overwrite what the test checks.
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('wetrip_session', '0000003018:0000006385:')
        sessionStorage.setItem('seeded', '1')
      }
    })
    await page.goto('/login')
    await customerField(page).fill('0000009999')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText("We couldn't find a customer with that id.")).toBeVisible()
    expect(await session(page)).toBe('0000003018:0000006385:')
  })

  test('text that is not a number is stopped in the browser, before any request', async ({
    page,
  }) => {
    const lookups = await mockApi(page)
    await page.goto('/login')
    await customerField(page).fill('SMU_TUSER2')
    await page.getByRole('button', { name: 'Continue' }).click()
    expect(await customerField(page).evaluate((el) => el.validity.valid)).toBe(false)
    expect(lookups).toHaveLength(0)
  })
})
