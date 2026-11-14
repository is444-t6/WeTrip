import { test, expect } from '@playwright/test'

// Live tests: they read the real sandbox, so they need the seeded demo accounts
// below (including a parent with children "Jamie" and "Second kid", and link 3).
// tests/family-mocked.spec.js covers the same screens against a faked API and
// does not depend on sandbox data.
const PARENT = { id: '0000002169', account: '0000004554', name: 'Parent Demo' }
const CHILD = { id: '0000002828', account: '0000006064', name: 'Jamie' }

const token = (u) => `${u.id}:${u.account}:${u.name}`

// The dev stub reads its session from sessionStorage; seeding it is faster and
// less brittle than typing into the form. One test below still exercises the
// form itself.
async function signInAs(page, user) {
  await page.addInitScript((value) => sessionStorage.setItem('wetrip_session', value), token(user))
}

test.describe('auth', () => {
  test('a signed-out visitor sees the sign-in card on the front page', async ({ page }) => {
    await page.goto('/')
    // It stays on / rather than being sent into one product.
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'WeTrip', exact: true })).toBeVisible()
    await expect(page.getByText("You're not signed in yet.")).toBeVisible()
    await expect(page.getByRole('link', { name: 'Continue to sign in' })).toBeVisible()
  })

  test('the dev login form stores a session and opens the parent home', async ({ page }) => {
    await page.goto('/login')

    // Only the customer id is asked for; the account is looked up from it.
    await page.getByPlaceholder('0000003018').fill(PARENT.id)
    await page.getByRole('button', { name: 'Continue' }).click()

    // This customer has several deposit accounts, so there is one more step,
    // with the first (the one the demo data is built around) preselected.
    await expect(page.getByLabel('Which account should WeTrip use?')).toHaveValue(PARENT.account, {
      timeout: 15_000,
    })
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Signing in lands on the home page, not the Family screen.
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('Available balance')).toBeVisible({ timeout: 15_000 })
    expect(await page.evaluate(() => sessionStorage.getItem('wetrip_session'))).toBe(
      `${PARENT.id}:${PARENT.account}:`,
    )
  })
})

test.describe('parent view', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, PARENT)
  })

  test('lists linked children with status and balance', async ({ page }) => {
    await page.goto('/family')

    await expect(page.getByText('Your children')).toBeVisible()
    // Exact: the budget-warning banner also contains the child's name.
    await expect(page.getByText('Jamie', { exact: true })).toBeVisible()
    await expect(page.getByText('Second kid', { exact: true })).toBeVisible()

    // Every active child renders a Manage button and an "Active" badge.
    await expect(page.getByRole('button', { name: 'Manage' }).first()).toBeVisible()
    await expect(page.getByText('Active').first()).toBeVisible()

    // The hero reports how many children are linked.
    await expect(page.getByText(/children linked/)).toBeVisible()
  })

  test('child detail has an overview, then budget/allowance/top-up and expenses/trend tabs', async ({
    page,
  }) => {
    await page.goto('/family/child/3')

    // Overview is the default: who the child is, then insights.
    await expect(page.locator('.overview')).toContainText('Jamie', { timeout: 15_000 })
    await expect(page.getByText('Spending insights')).toBeVisible()

    await page.getByRole('tab', { name: 'Manage' }).click()
    for (const section of ['Spending limit', 'Allowance', 'Top up']) {
      await expect(page.getByText(section, { exact: true }).first()).toBeVisible()
    }
    await expect(page.getByRole('button', { name: 'Save budget' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Top up', exact: true })).toBeVisible()

    await page.getByRole('tab', { name: 'Activity' }).click()
    for (const section of ['Expenses', 'Balance trend']) {
      await expect(page.getByText(section, { exact: true }).first()).toBeVisible()
    }
  })

  test('SmartFX home lists trip goals for the parent', async ({ page }) => {
    await page.goto('/fx')

    await expect(page.getByRole('heading', { name: 'Trips', exact: true })).toBeVisible()
    await expect(page.getByText('Your trips')).toBeVisible()

    // Opening the create form is the stable assertion: the trip list itself
    // depends on sandbox data.
    await page.getByRole('button', { name: 'New trip goal' }).click()
    await expect(page.getByRole('heading', { name: 'New trip goal' })).toBeVisible()
    await expect(page.getByPlaceholder('Tokyo')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Plan trip' })).toBeVisible()
  })
})

test.describe('child view', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, CHILD)
  })

  test('dashboard shows the balance, budget progress and pay form', async ({ page }) => {
    await page.goto('/family')

    // The child dashboard waits on an exchange-rate lookup that can take ~10s
    // when the rate source is slow, so the first assertion gets a long timeout.
    // By then everything else on the page is there.
    await expect(page.getByText(/balance/).first()).toBeVisible({ timeout: 25_000 })
    await expect(page.getByRole('heading', { name: /Spending limit this/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pay a merchant' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pay' })).toBeVisible()
  })

  test('child does not get the parent-only trip form on SmartFX', async ({ page }) => {
    await page.goto('/fx')

    await expect(page.getByRole('heading', { name: 'Trips', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New trip goal' })).toHaveCount(0)
  })
})

test.describe('navigation', () => {
  test('the shell links between Family and SmartFX', async ({ page }) => {
    await signInAs(page, PARENT)
    await page.goto('/family')

    await page.getByRole('link', { name: 'Trips', exact: true }).click()
    await expect(page).toHaveURL(/\/fx$/)

    await page.getByRole('link', { name: 'Family' }).click()
    await expect(page).toHaveURL(/\/family$/)
  })
})
