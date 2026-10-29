import { test, expect } from '@playwright/test'

// Demo accounts already seeded in the sandbox (see docs/family-module-diagnosis.md).
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
  test('a signed-out visitor is redirected to the sign-in card', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/family$/)
    await expect(page.getByText("You're not signed in yet.")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue to sign in' })).toBeVisible()
  })

  test('the dev login form stores a session and opens the parent home', async ({ page }) => {
    await page.goto('/family/dev-login')

    await page.getByPlaceholder('SMU_TUSER2').fill(PARENT.id)
    await page.getByPlaceholder('0000006385').fill(PARENT.account)
    await page.getByPlaceholder('timothy.loo').fill(PARENT.name)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/family$/)
    await expect(page.getByText('Your WeTrip balance')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(PARENT.name)).toBeVisible()
  })
})

test.describe('parent view', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, PARENT)
  })

  test('lists linked children with status and balance', async ({ page }) => {
    await page.goto('/family')

    await expect(page.getByText('Your children')).toBeVisible()
    await expect(page.getByText('Jamie')).toBeVisible()
    await expect(page.getByText('Second kid')).toBeVisible()

    // Every active child renders a Manage button and an "Active" badge.
    await expect(page.getByRole('button', { name: 'Manage' }).first()).toBeVisible()
    await expect(page.getByText('Active').first()).toBeVisible()

    // The hero reports how many children are linked.
    await expect(page.getByText(/children linked/)).toBeVisible()
  })

  test('child detail exposes budget, allowance, top-up, expenses and trend', async ({ page }) => {
    await page.goto('/family/child/3')

    await expect(page.getByRole('heading', { name: 'Jamie' })).toBeVisible({ timeout: 15_000 })
    for (const section of ['Budget', 'Allowance', 'Top up', 'Expenses', 'Balance trend']) {
      await expect(page.getByText(section, { exact: true }).first()).toBeVisible()
    }
    await expect(page.getByRole('button', { name: 'Save budget' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Top up' })).toBeVisible()
  })

  test('SmartFX home lists trip goals for the parent', async ({ page }) => {
    await page.goto('/fx')

    await expect(page.getByRole('heading', { name: 'SmartFX' })).toBeVisible()
    await expect(page.getByText('Trip goals')).toBeVisible()

    // Opening the create form is the stable assertion: the trip list itself
    // depends on sandbox data.
    await page.getByRole('button', { name: 'New trip goal' }).click()
    await expect(page.getByRole('heading', { name: 'New trip goal' })).toBeVisible()
    await expect(page.getByPlaceholder('Tokyo')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create trip goal' })).toBeVisible()
  })
})

test.describe('child view', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, CHILD)
  })

  test('dashboard shows the balance, budget progress and pay form', async ({ page }) => {
    await page.goto('/family')

    await expect(page.getByText(/balance/).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /Budget this/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pay a merchant' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pay' })).toBeVisible()
  })

  test('child does not get the parent-only trip form on SmartFX', async ({ page }) => {
    await page.goto('/fx')

    await expect(page.getByRole('heading', { name: 'SmartFX' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New trip goal' })).toHaveCount(0)
  })
})

test.describe('navigation', () => {
  test('the shell links between Family and SmartFX', async ({ page }) => {
    await signInAs(page, PARENT)
    await page.goto('/family')

    await page.getByRole('link', { name: 'SmartFX' }).click()
    await expect(page).toHaveURL(/\/fx$/)

    await page.getByRole('link', { name: 'Family' }).click()
    await expect(page).toHaveURL(/\/family$/)
  })
})
